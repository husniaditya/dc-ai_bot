const express = require('express');
const jwt = require('jsonwebtoken');
const { audit } = require('../middleware/audit');
const authMiddleware = require('../middleware/auth');

// In-memory OAuth state store (anti-CSRF). Key: state -> timestamp
const oauthStateStore = new Map();

function createAuthRoutes(client, store) {
  const router = express.Router();

  // Discord OAuth config - read environment variables inside function after dotenv is loaded
  const OAUTH_CLIENT_ID = process.env.CLIENT_ID;
  const OAUTH_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const OAUTH_REDIRECT_URI = process.env.DASHBOARD_OAUTH_REDIRECT;
  const OAUTH_SCOPES = ['identify', 'guilds'];
  
  // JWT and admin config
  const JWT_SECRET_RAW = process.env.DASHBOARD_JWT_SECRET || 'changeme_dev_secret';
  const JWT_SECRETS = JWT_SECRET_RAW.split(',').map(s => s.trim()).filter(s => s.length > 0);
  const PRIMARY_JWT_SECRET = JWT_SECRETS[0]; // Use first secret for signing new tokens
  const ADMIN_USER = process.env.DASHBOARD_ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.DASHBOARD_ADMIN_PASS || 'password';

  // Discord OAuth authorize URL (front-end will redirect user here)
  router.get('/oauth/discord/url', (req, res) => {
    const state = Math.random().toString(36).slice(2, 18);
    oauthStateStore.set(state, Date.now());
    
    // prune expired (>10m)
    const now = Date.now();
    for (const [s, ts] of oauthStateStore) {
      if (now - ts > 10 * 60 * 1000) oauthStateStore.delete(s);
    }
    
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
  router.post('/oauth/discord/exchange', express.json(), async (req, res) => {
    const { code, state } = req.body || {};
    
    if (!code) return res.status(400).json({ error: 'missing code' });
    if (!state || !oauthStateStore.has(state)) return res.status(400).json({ error: 'invalid_state' });
    
    try {
      oauthStateStore.delete(state);
      
      const tokenResp = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: OAUTH_CLIENT_ID,
          client_secret: OAUTH_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: OAUTH_REDIRECT_URI
        })
      });
      
      if (!tokenResp.ok) {
        const text = await tokenResp.text();
        return res.status(400).json({ error: 'token_exchange_failed', detail: text });
      }
      
      const tokenJson = await tokenResp.json();
      const accessToken = tokenJson.access_token;
      
      // Fetch user
      const userResp = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const user = await userResp.json();
      
      // Fetch guilds
      const guildResp = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const rawGuilds = await guildResp.json();
      
      // Filter guilds to those where the bot is actually present
      const botGuildIds = new Set(client.guilds.cache.map(g => g.id));
      const MANAGE_GUILD = 1 << 5; // 0x20
      const guilds = Array.isArray(rawGuilds) ? rawGuilds
        .filter(g => botGuildIds.has(g.id))
        .map(g => {
          let permsNumber = 0;
          try { permsNumber = g.permissions ? Number(g.permissions) : 0; } catch {}
          return { 
            id: g.id, 
            name: g.name, 
            icon: g.icon, 
            canManage: (permsNumber & MANAGE_GUILD) === MANAGE_GUILD 
          };
        }) : [];
      
      // Persist user (MariaDB only currently)
      try { 
        await store.upsertUser(user); 
      } catch(e) { 
        console.warn('Persist user failed', e.message); 
      }
      
      const jwtToken = jwt.sign({ 
        userId: user.id, 
        username: user.username, 
        type: 'discord' 
      }, PRIMARY_JWT_SECRET, { expiresIn: '6h' });
      
      audit(req, { action: 'oauth-login', user: user.id });
      res.json({ token: jwtToken, user, guilds });
      
    } catch(e) {
      console.error('OAuth exchange error', e);
      res.status(500).json({ error: 'oauth_failed' });
    }
  });

  // Set selected guild for user (requires authentication)
  router.post('/user/select-guild', authMiddleware, async (req, res) => {
    console.log('Guild selection request from user:', req.user.userId);
    const { guildId } = req.body || {};
    if (!guildId) return res.status(400).json({ error: 'guildId required' });
    
    try {
      // minimal server-side validation: ensure bot is in guild
      if (!client.guilds.cache.has(guildId)) {
        console.log('Bot not in guild:', guildId);
        return res.status(400).json({ error: 'bot_not_in_guild' });
      }
      
      console.log('Setting user selected guild:', req.user.userId, guildId);
      await store.setUserSelectedGuild(req.user.userId, guildId);
      
      // Trigger seed (loads defaults into guild tables if empty)
      try {
        await store.getGuildSettings(guildId);
        await store.getGuildAutoResponses(guildId);
      } catch(seedErr) { 
        console.warn('Guild seed failed', seedErr.message); 
      }
      
      audit(req, { action: 'select-guild', guild: guildId });
      console.log('Guild selection successful for user:', req.user.userId);
      res.json({ ok: true });
      
    } catch(e) { 
      console.error('Guild selection error:', e);
      res.status(500).json({ error: 'persist_failed' }); 
    }
  });

  // Get current user profile + stored selection (requires authentication)
  router.get('/user/me', authMiddleware, async (req, res) => {
    try { 
      const u = await store.getUser(req.user.userId); 
      res.json(u || {}); 
    } catch(e) { 
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Legacy login (if not disabled)
  if (!process.env.DISABLE_LEGACY_LOGIN) {
    router.post('/login', (req, res) => {
      const { username, password } = req.body || {};
      
      if (username === ADMIN_USER && password === ADMIN_PASS) {
        const token = jwt.sign({ 
          user: username, 
          role: 'admin', 
          type: 'legacy' 
        }, PRIMARY_JWT_SECRET, { expiresIn: '6h' });
        
        audit(req, { action: 'login-success', user: username });
        return res.json({ token });
      }
      
      audit(req, { action: 'login-fail', user: username });
      return res.status(401).json({ error: 'invalid credentials' });
    });
  }

  return router;
}

module.exports = createAuthRoutes;
