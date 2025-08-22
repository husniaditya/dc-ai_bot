const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
// Use built-in global fetch (Node 18+) to avoid ESM require issues
const fetchFn = (...args) => globalThis.fetch(...args);
require('dotenv').config();
const { askGemini, explainImage } = require('./ai-client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { sendLongReply, buildImageEmbedResponse } = require('./util');
const { getConversationStore } = require('./state');
// dynamic command collection
const commandMap = new Map();
const startTimestamp = Date.now();
function loadCommands(client){
  const dir = path.join(__dirname, 'commands');
  for (const file of fs.readdirSync(dir)){
    if (!file.endsWith('.js')) continue;
    const full = path.join(dir, file);
    const mod = require(full);
    try {
      if (typeof mod === 'function') {
        let instantiated;
        if (file === 'uptime.js') instantiated = mod(startTimestamp); // uptime needs timestamp
        else if (file === 'remind.js') instantiated = mod(client); // remind needs client for DM fallback
        else instantiated = mod(client); // default attempt
        if (instantiated && instantiated.name && instantiated.execute) {
          commandMap.set(instantiated.name, instantiated);
          continue;
        }
      }
      if (mod && mod.name && mod.execute) commandMap.set(mod.name, mod);
    } catch (e) {
      console.error('Failed loading command', file, e.message);
    }
  }
}

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.log('No DISCORD_TOKEN found. Exiting.');
  process.exit(0);
}

// Intents: include MessageContent (feature gated by settings at runtime)
const enableAutoReply = process.env.AUTOREPLY_ENABLED === '1';
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent];
const client = new Client({ intents, partials:[Partials.Channel, Partials.Message] });
loadCommands(client);

// --- Settings / Dashboard API (basic) ---
const store = require('./config/store');
store.initPersistence().then(mode => console.log('Persistence mode:', mode));
const app = express();
app.use(express.json());

// Basic in-memory rate limiting (per IP) for dashboard API
const rlWindowMs = parseInt(process.env.DASHBOARD_RATE_WINDOW_MS || '60000',10); // 1 min
const rlMax = parseInt(process.env.DASHBOARD_RATE_MAX || '120',10);
const rlMap = new Map(); // ip -> { count, ts }
app.use('/api', (req,res,next)=>{
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  let rec = rlMap.get(ip);
  if(!rec || rec.ts + rlWindowMs < now){ rec = { count:0, ts: now }; }
  rec.count++;
  rlMap.set(ip, rec);
  if(rec.count > rlMax){ return res.status(429).json({ error: 'rate limit exceeded' }); }
  next();
});

// Audit log (append to file) for mutating routes
const auditPath = path.join(__dirname, 'dashboard-audit.log');
function audit(req, body){
  const line = JSON.stringify({ time:new Date().toISOString(), ip:req.ip, user:req.user && req.user.user, method:req.method, path:req.originalUrl, body }) + '\n';
  fs.appendFile(auditPath, line, ()=>{});
}

// CORS setup
const allowedOrigins = (process.env.DASHBOARD_CORS_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({ origin: (origin, cb) => {
  if (!origin) return cb(null, true); // non-browser / same-origin
  if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
  return cb(new Error('Not allowed by CORS'));
}, credentials: false }));

// Auth helpers
const JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || 'changeme_dev_secret';
// Legacy single admin creds (kept for fallback if DISABLE_LEGACY_LOGIN not set)
const ADMIN_USER = process.env.DASHBOARD_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.DASHBOARD_ADMIN_PASS || 'password';

// Discord OAuth config
const OAUTH_CLIENT_ID = process.env.CLIENT_ID; // already in .env
const OAUTH_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET; // new secret
const OAUTH_REDIRECT_URI = process.env.DASHBOARD_OAUTH_REDIRECT || 'http://localhost:3001/oauth/callback';
const OAUTH_SCOPES = ['identify', 'guilds'];
// In-memory OAuth state store (anti-CSRF). Key: state -> timestamp
const oauthStateStore = new Map();

function authMiddleware(req,res,next){
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch(e){ return res.status(401).json({ error: 'invalid token' }); }
}

// Discord OAuth authorize URL (front-end will redirect user here)
app.get('/api/oauth/discord/url', (req,res)=>{
  const state = Math.random().toString(36).slice(2,18);
  oauthStateStore.set(state, Date.now());
  // prune expired (>10m)
  const now = Date.now();
  for (const [s,ts] of oauthStateStore){ if (now - ts > 10*60*1000) oauthStateStore.delete(s); }
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    response_type: 'code',
    redirect_uri: OAUTH_REDIRECT_URI,
    scope: OAUTH_SCOPES.join(' '),
    state
  });
  res.json({ url: `https://discord.com/api/oauth2/authorize?${params.toString()}` });
});

// OAuth callback exchange (code -> token -> user info & guilds)
app.post('/api/oauth/discord/exchange', express.json(), async (req,res)=>{
  const { code, state } = req.body || {};
  if(!code) return res.status(400).json({ error: 'missing code' });
  if(!state || !oauthStateStore.has(state)) return res.status(400).json({ error:'invalid_state' });
  try {
  oauthStateStore.delete(state);
  const tokenResp = await fetchFn('https://discord.com/api/oauth2/token', {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: OAUTH_REDIRECT_URI
      })
    });
    if(!tokenResp.ok){
      const text = await tokenResp.text();
      return res.status(400).json({ error:'token_exchange_failed', detail:text });
    }
    const tokenJson = await tokenResp.json();
    const accessToken = tokenJson.access_token;
    // Fetch user
  const userResp = await fetchFn('https://discord.com/api/users/@me', { headers:{ Authorization:`Bearer ${accessToken}` }});
    const user = await userResp.json();
    // Fetch guilds
  const guildResp = await fetchFn('https://discord.com/api/users/@me/guilds', { headers:{ Authorization:`Bearer ${accessToken}` }});
    const rawGuilds = await guildResp.json();
    // Filter guilds to those where the bot is actually present to avoid listing unrelated servers.
    const botGuildIds = new Set(client.guilds.cache.map(g=>g.id));
    const MANAGE_GUILD = 1 << 5; // 0x20
    const guilds = Array.isArray(rawGuilds) ? rawGuilds
      .filter(g => botGuildIds.has(g.id))
      .map(g => {
        let permsNumber = 0;
        try { permsNumber = g.permissions ? Number(g.permissions) : 0; } catch {}
        return { id: g.id, name: g.name, icon: g.icon, canManage: (permsNumber & MANAGE_GUILD) === MANAGE_GUILD };
      }) : [];
    // Persist user (MariaDB only currently)
    try { await store.upsertUser(user); } catch(e){ console.warn('Persist user failed', e.message); }
    const jwtToken = jwt.sign({ userId: user.id, username: user.username, type:'discord' }, JWT_SECRET, { expiresIn:'6h' });
    audit(req, { action:'oauth-login', user:user.id });
    res.json({ token: jwtToken, user, guilds });
  } catch(e){
    console.error('OAuth exchange error', e);
    res.status(500).json({ error:'oauth_failed' });
  }
});

// Set selected guild for user (must be one the bot is in; validated client-side for now)
app.post('/api/user/select-guild', authMiddleware, async (req,res)=>{
  const { guildId } = req.body || {};
  if(!guildId) return res.status(400).json({ error:'guildId required' });
  try {
  // minimal server-side validation: ensure bot is in guild
  if (!client.guilds.cache.has(guildId)) return res.status(400).json({ error:'bot_not_in_guild' });
    await store.setUserSelectedGuild(req.user.userId, guildId);
    // Trigger seed (loads defaults into guild tables if empty)
    try {
      await store.getGuildSettings(guildId);
      await store.getGuildAutoResponses(guildId);
    } catch(seedErr){ console.warn('Guild seed failed', seedErr.message); }
    audit(req, { action:'select-guild', guild:guildId });
    res.json({ ok:true });
  } catch(e){ res.status(500).json({ error:'persist_failed' }); }
});

// Get current user profile + stored selection
app.get('/api/user/me', authMiddleware, async (req,res)=>{
  try { const u = await store.getUser(req.user.userId); res.json(u || {}); } catch(e){ res.status(500).json({ error:'load_failed' }); }
});

if (!process.env.DISABLE_LEGACY_LOGIN) {
  app.post('/api/login', (req,res)=>{
    const { username, password } = req.body || {};
    if (username === ADMIN_USER && password === ADMIN_PASS){
      const token = jwt.sign({ user: username, role: 'admin', type:'legacy' }, JWT_SECRET, { expiresIn: '6h' });
      audit(req, { action:'login-success', user:username });
      return res.json({ token });
    }
    audit(req, { action:'login-fail', user:username });
    return res.status(401).json({ error: 'invalid credentials' });
  });
}

// Protected routes
app.get('/api/settings', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if (guildId) {
      const gs = await store.getGuildSettings(guildId);
      return res.json({ ...gs, guildId });
    }
    return res.json(store.getSettings());
  } catch(e){ return res.status(500).json({ error:'load_failed' }); }
});
app.put('/api/settings', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    const allowed = { autoReplyEnabled: req.body.autoReplyEnabled, autoReplyCooldownMs: req.body.autoReplyCooldownMs };
    let updated;
    if (guildId) updated = await store.setGuildSettings(guildId, allowed); else updated = await store.setSettings(allowed);
    audit(req, { action: guildId ? 'update-guild-settings':'update-settings', guildId, data:allowed });
    res.json(updated);
  } catch(e){ res.status(500).json({ error:'persist_failed' }); }
});

app.get('/api/auto-responses', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if (guildId) return res.json(await store.getGuildAutoResponses(guildId));
    return res.json(store.getAutoResponses());
  } catch(e){ return res.status(500).json({ error:'load_failed' }); }
});
app.post('/api/auto-responses', authMiddleware, async (req,res)=>{
  const { key, pattern, flags, replies, enabled } = req.body || {};
  if (!key || !pattern) return res.status(400).json({ error: 'key and pattern required' });
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    let entry;
    if (guildId) entry = await store.upsertGuildAutoResponse(guildId, { key, pattern, flags, replies, enabled });
    else entry = await store.upsertAutoResponse({ key, pattern, flags, replies, enabled });
    audit(req, { action: guildId ? 'upsert-guild-auto':'upsert-auto', key, guildId, enabled });
    res.json(entry);
  } catch(e){ res.status(500).json({ error:'persist_failed' }); }
});
app.delete('/api/auto-responses/:key', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if (guildId) await store.removeGuildAutoResponse(guildId, req.params.key); else await store.removeAutoResponse(req.params.key);
    audit(req, { action: guildId ? 'delete-guild-auto':'delete-auto', key:req.params.key, guildId });
    res.json({ ok: true });
  } catch(e){ res.status(500).json({ error:'delete_failed' }); }
});

// Serve built dashboard (if built with vite build output in /dashboard/dist)
const distPath = path.join(__dirname, 'dashboard', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback (Express 5: avoid legacy '*' pattern that triggers path-to-regexp error)
  app.use((req,res,next)=>{
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.includes('.')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    return next();
  });
}

const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3001;
app.listen(DASHBOARD_PORT, ()=>console.log('Dashboard API listening on :' + DASHBOARD_PORT));

// Poll handler will come from commands/poll if present
const pollModule = commandMap.get('poll');

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Message context menus: Explain Image, Summarize
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isMessageContextMenuCommand()) return;
  if (interaction.commandName === 'Explain Image') {
    const msg = interaction.targetMessage;
    let imgAtt = null;
    if (msg.attachments && msg.attachments.size) {
      imgAtt = Array.from(msg.attachments.values()).find(att => (att.contentType && att.contentType.startsWith('image/')) || /\.(png|jpe?g|gif)$/i.test(att.url));
    }
    if (!imgAtt) {
      await interaction.reply({ content: 'No image found in the selected message.', flags: 64 });
      return;
    }
    await interaction.deferReply();
    try {
      const explanation = await explainImage(imgAtt.url);
      let fileBuffer = null;
      let filename = 'image';
      try {
        const resp = await axios.get(imgAtt.url, { responseType: 'arraybuffer' });
        fileBuffer = Buffer.from(resp.data);
        if (fileBuffer.length > 7_500_000) fileBuffer = null;
        const extMatch = imgAtt.url.split('?')[0].match(/\.([a-zA-Z0-9]{3,5})$/);
        if (extMatch) filename += '.' + extMatch[1].toLowerCase(); else filename += '.png';
      } catch (e) {
        console.warn('Could not fetch image for re-upload, falling back to embed URL');
      }
      const chunks = [];
      let remaining = explanation || '';
      const MAX_EMBED_DESC = 4000;
      while (remaining.length > 0) { chunks.push(remaining.slice(0, MAX_EMBED_DESC)); remaining = remaining.slice(MAX_EMBED_DESC); }
      const first = chunks.shift() || 'No explanation.';
      const embedImageRef = fileBuffer ? { url: `attachment://${filename}` } : { url: imgAtt.url };
      await interaction.editReply({
        embeds: [{ title: 'Image Explanation', description: first, image: embedImageRef, color: 0x5865F2 }],
        files: fileBuffer ? [{ attachment: fileBuffer, name: filename }] : []
      });
      for (const part of chunks) await interaction.followUp({ content: part });
    } catch (e) {
      console.error('Image explain failed (context menu)', e);
      await interaction.editReply({ content: 'Image explain failed.', flags: 64 });
    }
  } else if (interaction.commandName === 'Summarize') {
    await interaction.deferReply();
    try {
      const target = interaction.targetMessage;
      const channel = target.channel;
      const [before, after] = await Promise.all([
        channel.messages.fetch({ before: target.id, limit: 35 }).catch(()=>new Map()),
        channel.messages.fetch({ after: target.id, limit: 35 }).catch(()=>new Map())
      ]);
      const combined = [...before.values(), target, ...after.values()]
        .filter(m => !m.author.bot)
        .sort((a,b)=>a.createdTimestamp - b.createdTimestamp);
      function isNoise(content){
        const c = (content||'').trim();
        if (!c) return true;
        if (c.startsWith('/')) return true;
        if (/^m!\S+/.test(c)) return true;
        if (/^[!./]\w+$/.test(c)) return true;
        if (/^[a-zA-Z]$/.test(c)) return true;
        if (/^\w{1,3}$/i.test(c) && !/^(yes|no|ok)$/i.test(c)) return true;
        if (c.length <= 2) return true;
        return false;
      }
      const filtered = combined.filter(m => !isNoise(m.cleanContent));
      const targetIdx = filtered.findIndex(m=>m.id===target.id);
      const windowMsgs = filtered.slice(Math.max(0,targetIdx-15), targetIdx+16);
      const noiseCount = combined.length - filtered.length;
      const convo = windowMsgs.map(m => `${m.author.username}: ${m.cleanContent}`)
        .join('\n')
        .slice(0, 7000);
      if (!convo) { await interaction.editReply('Not enough meaningful content to summarize.'); return; }
      const numbered = process.env.SUMMARY_NUMBER_SECTIONS === '1';
      const prompt = numbered
        ? `Summarize this Discord chat excerpt around a highlighted message. Provide:\n1. Overview (1 sentence)\n2. Key Points (bulleted)\n3. Action Items (bulleted or 'None')\nDo not invent facts. If it's mostly a single creative post, capture tone and content succinctly. NoiseFiltered: ${noiseCount}\nCHAT:\n${convo}`
        : `Summarize this Discord chat excerpt around a highlighted message. Provide the following sections (without numbering):\nOverview: one concise sentence.\nKey Points: bullet list (use - ).\nAction Items: bullet list or 'None'.\nDo not invent facts. If it's mostly a single creative post, capture tone and content succinctly. NoiseFiltered: ${noiseCount}\nCHAT:\n${convo}`;
      const { askGemini } = require('./ai-client');
      const { formatAIOutput } = require('./util');
      const resp = await askGemini(prompt, { maxOutputTokens: 260 });
      const summary = formatAIOutput(resp.text || 'No summary');
      await sendLongReply(interaction, summary);
    } catch(e){
      console.error('Context menu summarize failed', e);
      try { await interaction.editReply({ content: 'Summarization failed.', flags: 64 }); } catch {}
    }
  } else if (interaction.commandName === 'Translate') {
    await interaction.deferReply();
    try {
      const target = interaction.targetMessage;
      const content = (target.cleanContent || '').trim();
      if (!content) { await interaction.editReply('No text content to translate.'); return; }
      // Simple heuristic: let model auto-detect source. Default target language can be English.
      const targetLang = 'ID';
      const prompt = `Detect the language of the following text and translate it into ${targetLang}. Only output the translation text without extra commentary.\n\nText:\n"""${content.slice(0,1500)}"""`;
      const { askGemini } = require('./ai-client');
      const { formatAIOutput } = require('./util');
      const resp = await askGemini(prompt, { maxOutputTokens: 150 });
      const translation = formatAIOutput(resp.text || 'No translation');
      await sendLongReply(interaction, translation);
    } catch (e) {
      console.error('Context menu translate failed', e);
      try { await interaction.editReply({ content: 'Translation failed.', flags: 64 }); } catch {}
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()){
    const cmd = commandMap.get(interaction.commandName);
  if (!cmd) return interaction.reply({ content: 'Unknown command (not loaded).', flags: 64 });
    try { await cmd.execute(interaction, client); } catch (e){
      console.error('Command error', interaction.commandName, e);
      if (interaction.deferred || interaction.replied) { try { await interaction.editReply('Command failed.'); } catch {} }
  else { try { await interaction.reply({ content:'Command failed.', flags:64 }); } catch {} }
    }
  } else if (interaction.isStringSelectMenu() && interaction.customId==='help_select') {
    const value = interaction.values[0];
    // re-use help command categories from module
    const help = commandMap.get('help');
    const categories = {
      core: '**Core**\n/ping\n/whoami\n/uptime\n/echo <text>\n/help',
      ai: '**AI**\n/ask\n/askfollow\n/explain_image (1-3 images)\n/summarize [count]\n/translate text target',
      polls: '**Polls**\n/poll create question options\n/poll results id',
      util: '**Utilities**\n/user info [target]\n/math add|sub|mul|div a b\n/remind minutes text',
      notes: '**Notes**\nOutputs chunked. Images >8MB skipped. Data in-memory.'
    };
    await interaction.update({ embeds:[{ title:'Help', description: categories[value] || 'Unknown', color:0x5865F2 }] });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()){
    if (pollModule && pollModule.handleButton){
      try { await pollModule.handleButton(interaction, client); } catch(e){ console.error('Poll button error', e); }
    }
  }
});

client.login(token).catch(err => { console.error('Failed to login:', err); process.exit(1); });
