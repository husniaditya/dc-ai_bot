const express = require('express');
const jwt = require('jsonwebtoken');
const { audit } = require('../middleware/audit');
const authMiddleware = require('../middleware/auth');

// In-memory OAuth state store (anti-CSRF). Key: state -> timestamp
const oauthStateStore = new Map();

function createAuthRoutes(client, store) {
  const router = express.Router();

  // OAuth state helpers (using database for persistence across restarts/instances)
  async function saveOAuthState(state) {
    if (store.sqlPool) {
      try {
        const result = await store.sqlPool.query(
          'INSERT INTO oauth_states (state, created_at, expires_at, active) VALUES (?, NOW(), DATE_ADD(NOW(), INTERVAL 10 MINUTE), 1) ON DUPLICATE KEY UPDATE created_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE), active = 1',
          [state]
        );
        
        // Handle different result structures
        const affectedRows = result.affectedRows || result[0]?.affectedRows || (Array.isArray(result) && result[0]?.affectedRows) || 0;
        if (process.env.DEBUG_PERSONALIZATION === '1') {
            console.log('[OAuth] Saved state to DB:', state, 'affected rows:', affectedRows);
        }
        return true;
      } catch(e) {
        console.warn('Failed to save OAuth state to DB:', e.message);
        return false;
      }
    }
    // Fallback to in-memory
    oauthStateStore.set(state, Date.now());
    if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Saved state to memory:', state);
    }
    return true;
  }

  async function verifyOAuthState(state) {
    if (store.sqlPool) {
      try {
        const [rows] = await store.sqlPool.query(
          'SELECT state FROM oauth_states WHERE state = ? AND expires_at > NOW() AND active = 1',
          [state]
        );
        return rows.length > 0;
      } catch(e) {
        console.warn('Failed to verify OAuth state from DB:', e.message);
        // Fallback to in-memory
        return oauthStateStore.has(state);
      }
    }
    // Fallback to in-memory
    return oauthStateStore.has(state);
  }

  async function deleteOAuthState(state) {
    if (store.sqlPool) {
      try {
        // Instead of deleting, mark as inactive for debugging/tracking
        const result = await store.sqlPool.query('UPDATE oauth_states SET active = 0 WHERE state = ?', [state]);
        
        // Handle different result structures from mysql2
        const affectedRows = result.affectedRows || result[0]?.affectedRows || (Array.isArray(result) && result[0]?.affectedRows) || 0;
        
        if (process.env.DEBUG_PERSONALIZATION === '1') {
            console.log('[OAuth] Deactivated state in DB:', state, 'affected rows:', affectedRows);
        }
        
        return true;
      } catch(e) {
        console.warn('Failed to deactivate OAuth state in DB:', e.message);
        return false;
      }
    }
    // Fallback to in-memory
    oauthStateStore.delete(state);
    return true;
  }

  async function cleanupExpiredStates() {
    if (store.sqlPool) {
      try {
        // Mark expired states as inactive instead of deleting them
        const result = await store.sqlPool.query('UPDATE oauth_states SET active = 0 WHERE expires_at < NOW() AND active = 1');
        const affectedRows = result.affectedRows || result[0]?.affectedRows || (Array.isArray(result) && result[0]?.affectedRows) || 0;
        
        if (affectedRows > 0) {
          if (process.env.DEBUG_PERSONALIZATION === '1') {
              console.log('[OAuth] Marked', affectedRows, 'expired states as inactive');
          }
        }
        
        // Optionally delete very old inactive states (older than 1 day) to keep table clean
        const deleteResult = await store.sqlPool.query('DELETE FROM oauth_states WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 DAY) AND active = 0');
        const deletedRows = deleteResult.affectedRows || deleteResult[0]?.affectedRows || (Array.isArray(deleteResult) && deleteResult[0]?.affectedRows) || 0;
        
        if (deletedRows > 0) {
          if (process.env.DEBUG_PERSONALIZATION === '1') {
            console.log('[OAuth] Deleted', deletedRows, 'old inactive states');
          }
        }
      } catch(e) {
        console.warn('Failed to cleanup expired OAuth states:', e.message);
      }
    } else {
      // Fallback: prune expired in-memory states (>10m)
      const now = Date.now();
      for (const [s, ts] of oauthStateStore) {
        if (now - ts > 10 * 60 * 1000) oauthStateStore.delete(s);
      }
    }
  }

  // Discord OAuth config - read environment variables inside function after dotenv is loaded
  const OAUTH_CLIENT_ID = process.env.CLIENT_ID;
  const OAUTH_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const OAUTH_REDIRECT_URI = process.env.DASHBOARD_OAUTH_REDIRECT;
  const OAUTH_SCOPES = ['identify', 'guilds'];
  const DEBUG_PERSONALIZATION = process.env.DEBUG_PERSONALIZATION;
  
  // JWT and admin config
  const JWT_SECRET_RAW = process.env.DASHBOARD_JWT_SECRET || 'changeme_dev_secret';
  const JWT_SECRETS = JWT_SECRET_RAW.split(',').map(s => s.trim()).filter(s => s.length > 0);
  const PRIMARY_JWT_SECRET = JWT_SECRETS[0]; // Use first secret for signing new tokens
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN; 
  const ADMIN_USER = process.env.DASHBOARD_ADMIN_USER;
  const ADMIN_PASS = process.env.DASHBOARD_ADMIN_PASS;

  // Discord OAuth authorize URL (front-end will redirect user here)
  router.get('/oauth/discord/url', async (req, res) => {
    const { preferApp, isMobile } = req.query;
    const userAgent = req.headers['user-agent'] || '';
    
    // Server-side mobile detection as backup
    const serverMobileDetection = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isActuallyMobile = isMobile === 'true' || serverMobileDetection;
    
    const state = Math.random().toString(36).slice(2, 18);
    const saved = await saveOAuthState(state);
    
    // Cleanup expired states
    await cleanupExpiredStates();
    
    const params = new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      response_type: 'code',
      redirect_uri: OAUTH_REDIRECT_URI,
      scope: OAUTH_SCOPES.join(' '),
      state
    });
    
    // Generate URLs
    const webUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    const appUrl = `discord://discord.com/api/oauth2/authorize?${params.toString()}`;
    
    // Smart URL selection based on device type and preference
    let primaryUrl;
    if (isActuallyMobile) {
      // Mobile: Always prefer Discord app
      primaryUrl = appUrl;
    } else if (preferApp === 'true') {
      // Desktop: User specifically requested app
      primaryUrl = appUrl;
    } else {
      // Desktop: Default to web browser
      primaryUrl = webUrl;
    }
    
    res.json({ 
      url: primaryUrl,
      webUrl,
      appUrl,
      isMobile: isActuallyMobile,
      preferApp: preferApp === 'true'
    });
  });

  // OAuth callback exchange (code -> token -> user info & guilds)
  router.post('/oauth/discord/exchange', express.json(), async (req, res) => {
    const { code, state } = req.body || {};
    
    if (!code) return res.status(400).json({ error: 'missing code' });
    
    const stateValid = await verifyOAuthState(state);
    if (!state || !stateValid) {
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Invalid state:', state, 'valid:', stateValid);
      }
      return res.status(400).json({ error: 'invalid_state' });
    }
    
    try {
      // Delete state immediately to prevent reuse
      await deleteOAuthState(state);
      
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
    if (process.env.DEBUG_PERSONALIZATION=== '1') {
        console.log('Guild selection request from user:', req.user.userId);
    }
    const { guildId } = req.body || {};
    if (!guildId) return res.status(400).json({ error: 'guildId required' });
    
    try {
      // minimal server-side validation: ensure bot is in guild
      if (!client.guilds.cache.has(guildId)) {
        console.log('Bot not in guild:', guildId);
        return res.status(400).json({ error: 'bot_not_in_guild' });
      }
      
      if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.log('Setting user selected guild:', req.user.userId, guildId);
      }
      await store.setUserSelectedGuild(req.user.userId, guildId);
      
      // Trigger seed (loads defaults into guild tables if empty)
      try {
        await store.getGuildSettings(guildId);
        await store.getGuildAutoResponses(guildId);
      } catch(seedErr) { 
        console.warn('Guild seed failed', seedErr.message); 
      }
      
      audit(req, { action: 'select-guild', guild: guildId });
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('Guild selection successful for user:', req.user.userId);
      }
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

  // Debug endpoint to view OAuth states (remove in production)
  router.get('/debug/oauth-states', async (req, res) => {
    if (store.sqlPool) {
      try {
        const [rows] = await store.sqlPool.query(
          'SELECT state, created_at, expires_at, active, (expires_at > NOW()) as valid FROM oauth_states ORDER BY created_at DESC LIMIT 20'
        );
        res.json({ 
          database: rows,
          inMemory: Array.from(oauthStateStore.entries()).map(([state, timestamp]) => ({
            state,
            timestamp: new Date(timestamp).toISOString(),
            age_minutes: Math.round((Date.now() - timestamp) / 60000)
          }))
        });
      } catch(e) {
        res.status(500).json({ error: e.message });
      }
    } else {
      res.json({ 
        database: 'Not connected',
        inMemory: Array.from(oauthStateStore.entries()).map(([state, timestamp]) => ({
          state,
          timestamp: new Date(timestamp).toISOString(),
          age_minutes: Math.round((Date.now() - timestamp) / 60000)
        }))
      });
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
