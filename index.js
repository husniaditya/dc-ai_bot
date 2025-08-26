const { Client, GatewayIntentBits, Partials, ActivityType, PermissionsBitField } = require('discord.js');
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

// Intents: make privileged intents optional (to avoid 'Disallowed intents' login error)
const enableAutoReply = process.env.AUTOREPLY_ENABLED === '1';
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
// Message Content intent (privileged) – required for reading message text for auto-replies & AI commands
if (process.env.ENABLE_MESSAGE_CONTENT !== '0') intents.push(GatewayIntentBits.MessageContent);
// Guild Members intent (privileged) – required for welcome join tracking & some member operations
if (process.env.ENABLE_GUILD_MEMBERS === '1' || process.env.ENABLE_WELCOME === '1') intents.push(GatewayIntentBits.GuildMembers);
const client = new Client({ intents, partials:[Partials.Channel, Partials.Message] });
loadCommands(client);

// --- Personalization runtime helpers ---
const personalizationRuntime = {
  lastAvatarHash: null,
  lastAvatarUpdateTs: 0,
  activityApplied: null
};
function hashString(str){
  let h = 0, i, chr; if(!str) return 0; for(i=0;i<str.length;i++){ chr=str.charCodeAt(i); h=((h<<5)-h)+chr; h|=0; } return h;
}
async function applyGuildPersonalization(guildId){
  try {
    const p = await store.getGuildPersonalization(guildId);
    const guild = client.guilds.cache.get(guildId);
    if(!guild || !p) return;
    // Nickname (guild specific)
    if (p.nickname !== undefined && p.nickname !== null){
      try { if (guild.members.me && guild.members.me.nickname !== p.nickname) await guild.members.me.setNickname(p.nickname).catch(()=>{}); } catch{}
    }
    // Activity (global) – we just apply last saved one encountered
    if (p.activityType && p.activityText){
      const typeMap = {
        PLAYING: ActivityType.Playing,
        LISTENING: ActivityType.Listening,
        WATCHING: ActivityType.Watching,
        COMPETING: ActivityType.Competing,
        STREAMING: ActivityType.Streaming
      };
      const mappedType = typeMap[p.activityType.toUpperCase()] ?? ActivityType.Playing;
      const key = `${mappedType}:${p.activityText}`;
      if (personalizationRuntime.activityApplied !== key){
        try { await client.user.setActivity(p.activityText, { type: mappedType }); personalizationRuntime.activityApplied = key; } catch(e){ console.warn('Set activity failed', e.message); }
      }
    }
    // Status (online/dnd/idle/invisible)
    if (p.status){
      const valid = ['online','dnd','idle','invisible'];
      if (valid.includes(p.status)){
        try { await client.user.setStatus(p.status); } catch(e){ console.warn('Set status failed', e.message); }
      }
    }
    // Avatar (global) – apply only if changed & not rate limited
    if (p.avatarBase64){
      const b64 = p.avatarBase64.includes(',') ? p.avatarBase64.split(',').pop() : p.avatarBase64; // strip data URI
      if (b64 && b64.length < 15_000_000){ // ~11MB raw -> 15MB b64
        const h = hashString(b64);
        const now = Date.now();
        const intervalMs = 10*60*1000; // 10 minutes
        if (h !== personalizationRuntime.lastAvatarHash && (now - personalizationRuntime.lastAvatarUpdateTs) > intervalMs){
          try {
            const buf = Buffer.from(b64, 'base64');
            if (buf.length <= 8_000_000){ // Discord hard limit 8MB
              await client.user.setAvatar(buf);
              personalizationRuntime.lastAvatarHash = h;
              personalizationRuntime.lastAvatarUpdateTs = now;
            } else {
              console.warn('Avatar too large, skipping apply');
            }
          } catch(e){ console.warn('Set avatar failed', e.message); }
        }
      }
    }
  } catch(e){ /* silent */ }
}

// Apply the most recent global personalization (activity/status/avatar) across all guilds
async function applyGlobalPersonalization(){
  if(!store.getAllGuildPersonalizations) return;
  try {
    const all = await store.getAllGuildPersonalizations();
    let latest = null; let latestTs = 0;
    for(const [gid, rec] of Object.entries(all)){
      const hasGlobal = (rec.activityType && rec.activityText) || rec.status || rec.avatarBase64;
      if(!hasGlobal) continue;
      const ts = rec.updatedAt ? new Date(rec.updatedAt).getTime() : 0;
      if(ts >= latestTs){ latestTs = ts; latest = { guildId: gid, ...rec }; }
    }
    if(!latest){
      console.log('[GlobalPersonalization] No global fields found to apply');
      return;
    }
    const p = latest;
    // Activity + status together for better reliability
    try {
      if(p.activityType && p.activityText){
        const typeMap = { PLAYING: ActivityType.Playing, LISTENING: ActivityType.Listening, WATCHING: ActivityType.Watching, COMPETING: ActivityType.Competing, STREAMING: ActivityType.Streaming };
        const mappedType = typeMap[p.activityType.toUpperCase()] ?? ActivityType.Playing;
        client.user.setPresence({ activities:[{ name: p.activityText, type: mappedType }], status: p.status || 'online' });
        personalizationRuntime.activityApplied = mappedType+':'+p.activityText;
      } else if(p.status){
        await client.user.setStatus(p.status);
      }
    } catch(e){ console.warn('[GlobalPersonalization] presence/status failed', e.message); }
    // Avatar (rate-limited) reuse existing logic
    if(p.avatarBase64){
      try {
        const b64 = p.avatarBase64.includes(',') ? p.avatarBase64.split(',').pop() : p.avatarBase64;
        if(b64){
          const h = hashString(b64);
            const now = Date.now();
            const intervalMs = 10*60*1000;
            if(h !== personalizationRuntime.lastAvatarHash && (now - personalizationRuntime.lastAvatarUpdateTs) > intervalMs){
              const buf = Buffer.from(b64, 'base64');
              if(buf.length <= 8_000_000){
                await client.user.setAvatar(buf);
                personalizationRuntime.lastAvatarHash = h;
                personalizationRuntime.lastAvatarUpdateTs = now;
              }
            }
        }
      } catch(e){ console.warn('[GlobalPersonalization] avatar failed', e.message); }
    }
  } catch(e){ console.warn('[GlobalPersonalization] Failed to gather/apply', e.message); }
}

// --- Settings / Dashboard API (basic) ---
const store = require('./config/store');
const persistenceModeRef = { mode:null };
store.initPersistence().then(mode => { persistenceModeRef.mode = mode; console.log('Persistence mode:', mode); });
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
// DASHBOARD_CORS_ORIGINS: comma separated list of exact origins (scheme+host+port). If empty -> allow all.
// DASHBOARD_CORS_ALLOW_ALL=1 forces allow-all (useful in dev). Trailing slashes must be removed.
const allowedOriginsRaw = (process.env.DASHBOARD_CORS_ORIGINS || '')
  .split(',')
  .map(s=>s.trim())
  .filter(Boolean)
  .map(o => o.replace(/\/$/, '')); // normalize by stripping trailing slash
const forceAllowAll = process.env.DASHBOARD_CORS_ALLOW_ALL === '1';
if (forceAllowAll) console.warn('[CORS] DASHBOARD_CORS_ALLOW_ALL=1 -> allowing all origins');
app.use((req,res,next)=>{ res.setHeader('Vary','Origin'); next(); });
app.use(cors({ origin: (origin, cb) => {
  if (forceAllowAll) return cb(null,true);
  if (!origin) return cb(null, true); // non-browser / same-origin or curl
  const normalized = origin.replace(/\/$/,'');
  if (allowedOriginsRaw.length === 0 || allowedOriginsRaw.includes(normalized)) return cb(null, true);
  console.warn(`[CORS] Blocked origin ${origin}. Allowed: ${allowedOriginsRaw.length?allowedOriginsRaw.join(', '):'(all)'} . Set DASHBOARD_CORS_ORIGINS or DASHBOARD_CORS_ALLOW_ALL=1 to adjust.`);
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
const OAUTH_REDIRECT_URI = process.env.DASHBOARD_OAUTH_REDIRECT || 'http://localhost:5173/oauth/callback';
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
    const allowed = {
      autoReplyEnabled: req.body.autoReplyEnabled,
      autoReplyCooldownMs: req.body.autoReplyCooldownMs,
      language: req.body.language,
      timezone: req.body.timezone,
      hourFormat: req.body.hourFormat,
      embedColor: req.body.embedColor,
      prefix: req.body.prefix,
      slashCommandsEnabled: req.body.slashCommandsEnabled
    };
    let updated;
    if (guildId) updated = await store.setGuildSettings(guildId, allowed); else updated = await store.setSettings(allowed);
    audit(req, { action: guildId ? 'update-guild-settings':'update-settings', guildId, data:allowed });
    res.json(updated);
  } catch(e){ res.status(500).json({ error:'persist_failed' }); }
});

// Bot personalization (per guild)
app.get('/api/personalization', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if(!guildId) return res.status(400).json({ error:'guild_required' });
    const p = await store.getGuildPersonalization(guildId);
    res.json(p);
  } catch(e){ res.status(500).json({ error:'load_failed' }); }
});
app.put('/api/personalization', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if(!guildId) return res.status(400).json({ error:'guild_required' });
    // Permission check: require MANAGE_GUILD if user is discord auth
    if (req.user.type === 'discord'){
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(400).json({ error:'bot_not_in_guild' });
        const member = await guild.members.fetch(req.user.userId).catch(()=>null);
        if (!member) return res.status(403).json({ error:'not_in_guild' });
        const hasPerm = member.permissions.has(PermissionsBitField.Flags.ManageGuild);
        if (!hasPerm) return res.status(403).json({ error:'insufficient_permissions' });
      } catch { return res.status(403).json({ error:'permission_check_failed' }); }
    }
    const allowed = {
      nickname: req.body.nickname,
      activityType: req.body.activityType,
      activityText: req.body.activityText,
  avatarBase64: req.body.avatarBase64,
  status: req.body.status
    };
    // Basic validation
    if (allowed.nickname && allowed.nickname.length > 32) return res.status(400).json({ error:'nickname_too_long' });
    if (allowed.activityText && allowed.activityText.length > 128) return res.status(400).json({ error:'activity_text_too_long' });
    const updated = await store.setGuildPersonalization(guildId, allowed);
    audit(req, { action:'update-personalization', guildId });
    // Fire & forget apply (do not await full completion to keep API snappy)
    applyGuildPersonalization(guildId);
    res.json({ ...updated, applied:true });
  } catch(e){ res.status(500).json({ error:'persist_failed' }); }
});

// Debug / manual cache invalidation for personalization (not exposed in UI; use only for troubleshooting)
app.post('/api/personalization/invalidate', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.body && req.body.guildId;
    if(!guildId) return res.status(400).json({ error:'guildId required' });
    if(store.invalidateGuildPersonalization) store.invalidateGuildPersonalization(guildId);
    res.json({ ok:true });
  } catch(e){ res.status(500).json({ error:'invalidate_failed' }); }
});

// Debug endpoint: returns cached personalization + fresh DB row
app.get('/api/personalization/debug', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId;
    if(!guildId) return res.status(400).json({ error:'guildId required' });
    const cached = await store.getGuildPersonalization(guildId);
    const fresh = await store.getGuildPersonalizationFresh ? await store.getGuildPersonalizationFresh(guildId) : null;
    res.json({ guildId, cached, fresh, different: JSON.stringify(cached) !== JSON.stringify({ ...(fresh||{}) , updatedAt: undefined }) });
  } catch(e){ res.status(500).json({ error:'debug_failed' }); }
});

// Welcome config endpoints
app.get('/api/welcome', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if(!guildId) return res.status(400).json({ error:'guild_required' });
    const cfg = await store.getGuildWelcome(guildId);
    res.json(cfg);
  } catch(e){ res.status(500).json({ error:'load_failed' }); }
});
app.put('/api/welcome', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if(!guildId) return res.status(400).json({ error:'guild_required' });
    if (req.user.type==='discord'){
      try {
        const guild = client.guilds.cache.get(guildId);
        if(!guild) return res.status(400).json({ error:'bot_not_in_guild' });
        const member = await guild.members.fetch(req.user.userId).catch(()=>null);
        if(!member) return res.status(403).json({ error:'not_in_guild' });
        if(!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return res.status(403).json({ error:'insufficient_permissions' });
      } catch { return res.status(403).json({ error:'permission_check_failed' }); }
    }
    const allowed = {
      channelId: req.body.channelId,
      messageType: req.body.messageType,
      messageText: req.body.messageText,
  cardEnabled: req.body.cardEnabled,
  enabled: req.body.enabled
    };
    if (allowed.messageText && allowed.messageText.length > 2000) return res.status(400).json({ error:'message_too_long' });
    const updated = await store.setGuildWelcome(guildId, allowed);
    audit(req, { action:'update-welcome', guildId });
    res.json(updated);
  } catch(e){ res.status(500).json({ error:'persist_failed' }); }
});

// Command toggles (returns merged command metadata list)
app.get('/api/commands', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    let toggleMap = {};
    if (guildId && store.getGuildCommandToggles) toggleMap = await store.getGuildCommandToggles(guildId);
    else if (store.getCommandToggles) toggleMap = await store.getCommandToggles();
    const commands = Array.from(commandMap.values()).map(c => ({
      name: c.name,
      description: c.description || c.data?.description || '',
      enabled: toggleMap[c.name]?.enabled !== undefined ? toggleMap[c.name].enabled : toggleMap[c.name] !== false,
      createdAt: toggleMap[c.name]?.createdAt || null,
      createdBy: toggleMap[c.name]?.createdBy || null,
      updatedAt: toggleMap[c.name]?.updatedAt || null,
      updatedBy: toggleMap[c.name]?.updatedBy || null,
    }));
    res.json({ guildId, commands });
  } catch(e){ res.status(500).json({ error:'load_failed' }); }
});
app.post('/api/commands/toggle', authMiddleware, async (req,res)=>{
  const { name, enabled } = req.body || {};
  if(!name) return res.status(400).json({ error:'name required' });
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    let result;
  const actor = req.user.userId || req.user.user || null;
  if(guildId && store.setGuildCommandToggle) result = await store.setGuildCommandToggle(guildId, name, !!enabled, actor);
  else if(store.setCommandToggle) result = await store.setCommandToggle(name, !!enabled, actor);
    audit(req, { action:'command-toggle', guildId, name, enabled });
    res.json({ ok:true, name, enabled: result });
  } catch(e){ res.status(500).json({ error:'persist_failed' }); }
});

app.get('/api/auto-responses', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if (guildId) return res.json(await store.getGuildAutoResponses(guildId));
    return res.json(store.getAutoResponses());
  } catch(e){ return res.status(500).json({ error:'load_failed' }); }
});
// Simple analytics snapshot for dashboard charts
app.get('/api/analytics/overview', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
  let autos = guildId ? await store.getGuildAutoResponses(guildId) : store.getAutoResponses();
  if (!Array.isArray(autos)) autos = [];
  const autoEnabled = autos.filter(a=>a && a.enabled!==false).length;
    const cmdList = Array.from(commandMap.values()).map(c=>c.name);
    let toggles = {};
    try { toggles = guildId ? await store.getGuildCommandToggles(guildId) : store.getCommandToggles(); } catch {}
    const commandsEnabled = cmdList.filter(n => toggles[n] !== false).length;
    const commandsDisabled = cmdList.length - commandsEnabled;
    // Rough category breakdown for autos by first letter bucket (demo purpose)
    const autoBuckets = autos.reduce((acc,a)=>{ const k = (a.key||'').charAt(0).toUpperCase() || '#'; acc[k]=(acc[k]||0)+1; return acc; }, {});
    res.json({
      guildId,
      totals: { autos: autos.length, autosEnabled: autoEnabled, commands: cmdList.length, commandsEnabled, commandsDisabled },
      autoBuckets
    });
  } catch(e){ res.status(500).json({ error:'load_failed' }); }
});
// Simple API status (Gemini availability)
app.get('/api/status', authMiddleware, (req,res)=>{
  const geminiEnabled = !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
  const discordReady = !!client.readyAt;
  const ping = typeof client.ws?.ping === 'number' ? Math.round(client.ws.ping) : null;
  const uptimeSeconds = Math.floor((Date.now() - startTimestamp)/1000);
  const dbMode = persistenceModeRef.mode || 'unknown';
  const dbConnected = dbMode !== 'memory' ? true : true; // memory still functions for dashboard
  res.json({
    gemini: { enabled: geminiEnabled },
    discord: { ready: discordReady, ping },
    database: { mode: dbMode, connected: dbConnected },
    uptime: { seconds: uptimeSeconds, startedAt: new Date(startTimestamp).toISOString() }
  });
});
// Lightweight guild list (names/icons) for dashboard refresh so we can render selected guild name after page reload
app.get('/api/guilds', authMiddleware, (req,res)=>{
  try {
    const list = client.guilds.cache.map(g=>({ id:g.id, name:g.name, icon:g.icon }));
    res.json(list);
  } catch(e){ res.status(500).json({ error:'load_failed' }); }
});
// List channels (text-based) for current guild
app.get('/api/channels', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if(!guildId) return res.status(400).json({ error:'guild_required' });
    const guild = client.guilds.cache.get(guildId);
    if(!guild) return res.status(400).json({ error:'bot_not_in_guild' });
    // Fetch to ensure cache population
    try { await guild.channels.fetch(); } catch {}
    const channels = guild.channels.cache
      .filter(c => c && c.isTextBased && typeof c.isTextBased === 'function' ? c.isTextBased() : (c.type && /text|forum|news/i.test(String(c.type))))
      .map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId || null, position: c.rawPosition || c.position || 0 }))
      .sort((a,b)=> a.position - b.position);
    res.json({ guildId, channels });
  } catch(e){ res.status(500).json({ error:'load_failed' }); }
});
// List roles for current guild
app.get('/api/roles', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if(!guildId) return res.status(400).json({ error:'guild_required' });
    const guild = client.guilds.cache.get(guildId);
    if(!guild) return res.status(400).json({ error:'bot_not_in_guild' });
    try { await guild.roles.fetch(); } catch {}
    const roles = guild.roles.cache
      .filter(r=> !r.managed) // skip integration managed roles
      .map(r => ({ id:r.id, name:r.name, position:r.position, mentionable:r.mentionable }))
      .sort((a,b)=> b.position - a.position);
    res.json({ guildId, roles });
  } catch(e){ res.status(500).json({ error:'load_failed' }); }
});
// --- YouTube Watcher Config (per guild) ---
app.get('/api/youtube/config', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if(!guildId) return res.status(400).json({ error:'guild_required' });
    const cfg = await store.getGuildYouTubeConfig(guildId);
    res.json(cfg);
  } catch(e){ res.status(500).json({ error:'load_failed' }); }
});
app.put('/api/youtube/config', authMiddleware, async (req,res)=>{
  try {
    const guildId = req.query.guildId || (req.user.type==='discord' ? (await store.getUser(req.user.userId))?.selected_guild_id : null);
    if(!guildId) return res.status(400).json({ error:'guild_required' });
    // Permissions: require Manage Guild if discord user
    if (req.user.type==='discord'){
      try {
        const guild = client.guilds.cache.get(guildId);
        if(!guild) return res.status(400).json({ error:'bot_not_in_guild' });
        const member = await guild.members.fetch(req.user.userId).catch(()=>null);
        if(!member) return res.status(403).json({ error:'not_in_guild' });
        if(!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return res.status(403).json({ error:'insufficient_permissions' });
      } catch { return res.status(403).json({ error:'permission_check_failed' }); }
    }
    const partial = {
      channels: Array.isArray(req.body.channels)? req.body.channels: undefined,
      announceChannelId: req.body.announceChannelId,
      mentionRoleId: req.body.mentionRoleId,
  mentionTargets: Array.isArray(req.body.mentionTargets)? req.body.mentionTargets: undefined,
      enabled: req.body.enabled,
  intervalSec: req.body.intervalSec,
  uploadTemplate: req.body.uploadTemplate,
  liveTemplate: req.body.liveTemplate,
  embedEnabled: req.body.embedEnabled,
    channelMessages: req.body.channelMessages,
    channelNames: req.body.channelNames
    };
  const cfg = await store.setGuildYouTubeConfig(guildId, partial);
  if(store.invalidateGuildYouTubeConfig){ store.invalidateGuildYouTubeConfig(guildId); }
    audit(req, { action:'update-youtube-config', guildId });
  // Re-fetch to ensure values (mention/flags) reflect DB authoritative columns
  const fresh = await store.getGuildYouTubeConfig(guildId);
  res.json(fresh);
  } catch(e){ res.status(500).json({ error:'persist_failed' }); }
});
// Resolve YouTube channel input (ID / URL / handle) -> channelId
app.post('/api/youtube/resolve-channel', authMiddleware, async (req,res)=>{
  try {
    const { input } = req.body || {};
    if(!input || typeof input !== 'string') return res.status(400).json({ error:'input_required' });
    const raw = input.trim();
    const idMatch = raw.match(/(UC[0-9A-Za-z_-]{21,})/);
    if(idMatch){ return res.json({ channelId: idMatch[1], source:'direct' }); }
    // Extract handle or path component
    let handle = null;
    let originalHandle = null; // keep a copy for alternate patterns
    if(raw.startsWith('@')) handle = raw.slice(1);
    else {
      try {
        const u = new URL(raw.startsWith('http')? raw : ('https://www.youtube.com/'+raw));
        // /@handle or /c/Custom or /user/Legacy
        const parts = u.pathname.split('/').filter(Boolean);
        if(parts.length){
          if(parts[0].startsWith('@')) handle = parts[0].slice(1);
          else if(['c','user'].includes(parts[0]) && parts[1]) handle = parts[1];
          else if(parts[0]) handle = parts[0].startsWith('@')? parts[0].slice(1): parts[0];
        }
      } catch{}
    }
    if(!handle) return res.status(400).json({ error:'unrecognized_format' });
    originalHandle = handle;
    // Attempt HTML scrape first
    async function scrapeVariants(h){
      const bases = [
        'https://www.youtube.com/@'+encodeURIComponent(h),
        'https://www.youtube.com/@'+encodeURIComponent(h)+'/about',
        'https://www.youtube.com/@'+encodeURIComponent(h)+'/videos',
        'https://www.youtube.com/@'+encodeURIComponent(h)+'/streams',
        'https://www.youtube.com/c/'+encodeURIComponent(h),
        'https://www.youtube.com/c/'+encodeURIComponent(h)+'/about',
        'https://www.youtube.com/user/'+encodeURIComponent(h),
        'https://www.youtube.com/user/'+encodeURIComponent(h)+'/about'
      ];
      const idRegexes = [
        /"channelId":"(UC[0-9A-Za-z_-]{21,})"/,
        /\\"channelId\\":\\"(UC[0-9A-Za-z_-]{21,})\\"/,
        /data-channel-external-id=\"(UC[0-9A-Za-z_-]{21,})\"/,
        /(UC[0-9A-Za-z_-]{21,})/ // broad fallback
      ];
      for (const url of bases){
        try {
          const resp = await fetchFn(url, { headers:{ 'User-Agent':'Mozilla/5.0','Accept-Language':'en-US,en;q=0.8' }});
          if(!resp.ok) continue;
          const html = await resp.text();
          let channelId = null;
          for (const r of idRegexes){ const m = html.match(r); if(m){ channelId = m[1]; break; } }
          if(channelId){
            // Avoid false positives: ensure UC id appears multiple times if matched only by broad regex
            if(/^(UC[0-9A-Za-z_-]{21,})$/.test(channelId)){
              const count = html.split(channelId).length - 1;
              if(count < 2 && !html.includes('channelId')){ continue; }
            }
            const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
            if(process.env.YT_DEBUG==='1') console.log('[YT-RESOLVE] success via', url, '->', channelId);
            return { channelId, title: titleMatch? titleMatch[1]: null, source:'scrape' };
          }
          if(process.env.YT_DEBUG==='1') console.log('[YT-RESOLVE] no id in', url);
        } catch(e){ if(process.env.YT_DEBUG==='1') console.log('[YT-RESOLVE] error', url, e.message); }
      }
      return null;
    }
    let out = await scrapeVariants(handle);
    // Fallback: use YouTube Data API search if key available
    if(!out){
      const apiKey = process.env.YOUTUBE_API_KEY;
      if(apiKey){
        try {
          const q = encodeURIComponent(handle);
          const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=5&q=${q}&key=${apiKey}`;
          const js = await (await fetchFn(url)).json();
          if(js && Array.isArray(js.items)){
            const best = js.items.find(it => it.snippet?.channelTitle?.toLowerCase().includes(handle.toLowerCase())) || js.items[0];
            if(best && best.snippet && best.id && best.id.channelId){
              out = { channelId: best.id.channelId, title: best.snippet.channelTitle, source:'api-search' };
            }
          }
        } catch {}
      }
    }
    // Final fallback: parse public search results HTML (no API key) if still unresolved
    if(!out){
      try {
        const q = encodeURIComponent(originalHandle.startsWith('@')? originalHandle.slice(1): originalHandle);
        const searchUrls = [
          'https://www.youtube.com/results?search_query='+q,
          'https://www.youtube.com/results?search_query=%40'+q // explicit @ query
        ];
        for (const sUrl of searchUrls){
          try {
            const searchResp = await fetchFn(sUrl, { headers:{ 'User-Agent':'Mozilla/5.0','Accept-Language':'en-US,en;q=0.8' }});
            if(!searchResp.ok) continue;
            const html = await searchResp.text();
            const m = html.match(/"channelId":"(UC[0-9A-Za-z_-]{21,})"/);
            if(m){
              let title = null;
              const titleMatch = html.match(/"title":\{"runs":\[\{"text":"([^"\\]{1,80})"/);
              if(titleMatch) title = titleMatch[1];
              out = { channelId: m[1], title, source:'html-search' };
              if(process.env.YT_DEBUG==='1') console.log('[YT-RESOLVE] html-search success', sUrl, '->', out.channelId);
              break;
            }
          } catch(e){ if(process.env.YT_DEBUG==='1') console.log('[YT-RESOLVE] html-search error', sUrl, e.message); }
        }
      } catch{}
    }
    if(!out) return res.status(404).json({ error:'not_found' });
    res.json(out);
  } catch(e){ res.status(500).json({ error:'resolve_failed' }); }
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

// Use a distinct API port (front-end dev server runs on 5173)
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3001;
app.listen(DASHBOARD_PORT, ()=>console.log('Dashboard API listening on :' + DASHBOARD_PORT));

// Poll handler will come from commands/poll if present
const pollModule = commandMap.get('poll');

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  // On startup apply personalization (nicknames per guild + latest global status/activity/avatar)
  async function applyStartupPersonalizations(){
    try {
      console.log('[StartupPersonalization] Applying per-guild nicknames…');
      for (const g of client.guilds.cache.values()) await applyGuildPersonalization(g.id);
      await applyGlobalPersonalization();
    } catch(e){ console.warn('[StartupPersonalization] Failed', e.message); }
  }
  applyStartupPersonalizations();
  // Re-apply after delays to overcome any initial gateway race conditions
  setTimeout(()=> applyGlobalPersonalization().catch(()=>{}), 5000);
  setTimeout(()=> applyGlobalPersonalization().catch(()=>{}), 15000);
  // Start YouTube watcher (announces new uploads & live streams if env configured)
  try {
    const { startYouTubeWatcher } = require('./youtube-watcher');
    startYouTubeWatcher(client);
  } catch(e){ console.warn('YouTube watcher failed to start', e.message); }
});

// Welcome event
client.on('guildMemberAdd', async (member) => {
  try {
    const guildId = member.guild.id;
    const cfg = await store.getGuildWelcome(guildId);
  if (!cfg || cfg.enabled === false || !cfg.channelId) return;
    const ch = member.guild.channels.cache.get(cfg.channelId);
    if(!ch || !ch.isTextBased()) return;
    const msgText = (cfg.messageText && cfg.messageText.trim()) ? cfg.messageText
      .replace(/\{user\}/g, `<@${member.id}>`)
      .replace(/\{server\}/g, member.guild.name)
      : `Welcome <@${member.id}>!`;
    if (cfg.messageType === 'embed'){
      const embed = { title: 'Welcome!', description: msgText, color: 0x5865F2 };
      if (cfg.cardEnabled){
        embed.thumbnail = { url: member.user.displayAvatarURL({ size:128 }) };
        embed.footer = { text: `Member #${member.guild.memberCount}` };
      }
      await ch.send({ embeds:[embed] });
    } else {
      if (cfg.cardEnabled){
        await ch.send({ content: msgText, files: [] }); // placeholder for future generated card image
      } else {
        await ch.send(msgText);
      }
    }
  } catch(e){ /* silent */ }
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
      let content = (target.cleanContent || '').trim();
      // If no raw text content, attempt to extract from first embed description
      if (!content && Array.isArray(target.embeds) && target.embeds.length){
        for (const emb of target.embeds){
          if (emb && emb.description){ content = (emb.description || '').trim(); if (content) break; }
        }
      }
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
    // Guild-level slash command master toggle
    try {
      const guildId = interaction.guildId;
      if (guildId) {
        const gs = await store.getGuildSettings(guildId);
        if (gs && gs.slashCommandsEnabled === false) {
          return interaction.reply({ content: 'Slash commands are disabled for this server by an administrator.', flags: 64 });
        }
      }
    } catch {}
    try {
      // Check command toggle
      const guildId = interaction.guildId;
      let enabled = true;
      try {
        if (guildId && store.getGuildCommandToggles){
          const toggles = await store.getGuildCommandToggles(guildId);
          if (toggles[interaction.commandName] === false) enabled = false;
        } else if (store.getCommandToggles){
          const toggles = store.getCommandToggles();
          if (toggles[interaction.commandName] === false) enabled = false;
        }
      } catch {}
      if(!enabled){
        return interaction.reply({ content: 'This command is disabled.', flags: 64 });
      }
    } catch {}
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

client.login(token).catch(err => {
  if (String(err).includes('Disallowed intents') || String(err).includes('Used disallowed intents')) {
    console.error('Failed to login due to disallowed intents. Adjusting to safe intents and retrying...');
    // Remove privileged intents and retry once
    try { client.destroy(); } catch {}
    const safeIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
    const safeClient = new Client({ intents: safeIntents, partials:[Partials.Channel, Partials.Message] });
    loadCommands(safeClient);
    // Re-bind minimal events needed
    safeClient.once('ready', () => {
      console.warn('Logged in with reduced intents (welcome & content-dependent features disabled). Enable intents in Developer Portal for full features.');
    });
    safeClient.login(token).catch(e2 => { console.error('Retry login failed:', e2); process.exit(1); });
  } else {
    console.error('Failed to login:', err);
    process.exit(1);
  }
});
