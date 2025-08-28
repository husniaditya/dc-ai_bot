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
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN; 
  const ADMIN_USER = process.env.DASHBOARD_ADMIN_USER;
  const ADMIN_PASS = process.env.DASHBOARD_ADMIN_PASS;

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
      
      // Get guilds where the bot is present
      const botGuildIds = new Set(client.guilds.cache.map(g => g.id));
      
      // Process all guilds to determine manageable ones (for JWT storage)
      const MANAGE_GUILD = 1 << 5; // 0x20
      const allManageableGuilds = Array.isArray(rawGuilds) ? rawGuilds
        .filter(g => {
          let permsNumber = 0;
          try { permsNumber = g.permissions ? Number(g.permissions) : 0; } catch {}
          return (permsNumber & MANAGE_GUILD) === MANAGE_GUILD;
        })
        .map(g => g.id) : [];
      
      // For the response, only return guilds where BOTH conditions are met:
      // 1. User can manage AND 2. Bot is present
      const guilds = Array.isArray(rawGuilds) ? rawGuilds
        .filter(g => {
          // Must be manageable by user
          let permsNumber = 0;
          try { permsNumber = g.permissions ? Number(g.permissions) : 0; } catch {}
          const canManage = (permsNumber & MANAGE_GUILD) === MANAGE_GUILD;
          
          // Must have bot present
          const botPresent = botGuildIds.has(g.id);
          
          return canManage && botPresent;
        })
        .map(g => {
          return { 
            id: g.id, 
            name: g.name, 
            icon: g.icon, 
            canManage: true // We know they can manage since we filtered for it
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
        type: 'discord',
        manageableGuilds: allManageableGuilds // Store ALL manageable guild IDs (for future use)
      }, PRIMARY_JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      
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

  // Logout endpoint - invalidates current session
  router.post('/logout', authMiddleware, async (req, res) => {
    try {
      // Optional: Add token to blacklist if you implement token blacklisting
      // await store.blacklistToken(req.headers.authorization?.slice(7));
      
      audit(req, { 
        action: 'logout', 
        user: req.user.userId || req.user.user,
        type: req.user.type 
      });
      
      res.json({ 
        success: true, 
        message: 'Successfully logged out',
        requiresLogout: true 
      });
    } catch(e) {
      console.error('Logout error:', e);
      res.status(500).json({ 
        error: 'logout_failed',
        message: 'Error during logout process',
        requiresLogout: true 
      });
    }
  });

  // Check token validity endpoint
  router.get('/validate', authMiddleware, (req, res) => {
    // If we reach here, token is valid (middleware passed)
    res.json({ 
      valid: true, 
      user: {
        userId: req.user.userId,
        username: req.user.username,
        type: req.user.type
      },
      expiresAt: req.user.exp ? new Date(req.user.exp * 1000).toISOString() : null
    });
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
        }, PRIMARY_JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        
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
