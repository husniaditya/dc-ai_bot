const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { audit } = require('../middleware/audit');
const authMiddleware = require('../middleware/auth');

// In-memory OAuth state store (anti-CSRF). Key: state -> timestamp
const oauthStateStore = new Map();
// Track consumed states to prevent replay (used for stateless fallback too)
const consumedStateSet = new Set();

// Test database connection and table existence
async function testDatabaseConnection(store) {
  if (!store || !store.sqlPool) {
    if (process.env.DEBUG_PERSONALIZATION === '1') {
      console.warn('[OAuth] No database connection available');
    }
    return false;
  }
  
  try {
    // Test basic connection
    await store.sqlPool.query('SELECT 1');
    
    // Test oauth_states table exists
    await store.sqlPool.query('SELECT COUNT(*) FROM oauth_states LIMIT 1');
    
    if (process.env.DEBUG_PERSONALIZATION === '1') {
      console.log('[OAuth] Database connection and oauth_states table verified');
    }
    return true;
  } catch(e) {
    if (process.env.DEBUG_PERSONALIZATION === '1') {
      console.error('[OAuth] Database connection test failed:', e.message);
    }
    return false;
  }
}

function createAuthRoutes(client, store) {
  const router = express.Router();
  const AUTH_ROUTE_VERSION = 'oauth-v3.2-signed-fallback-verify';
  if (process.env.DEBUG_PERSONALIZATION === '1') {
    console.log('[OAuth] Auth route version loaded:', AUTH_ROUTE_VERSION);
  }

  // Test database connection on startup
  (async () => {
    const connected = await testDatabaseConnection(store);
    if (connected) {
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Database connection test passed');
      }
    } else {
      if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.warn('[OAuth] Database connection test failed - using in-memory fallback');
      }
    }
  })();

  // Stateless fallback configuration (allows surviving process restarts)
  const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || process.env.DASHBOARD_JWT_SECRET || 'dev_insecure_state_secret';
  const OAUTH_STATE_EXP_SECONDS = parseInt(process.env.OAUTH_STATE_EXP_SECONDS || '600', 10); // default 10 minutes

  function b64url(buf){
    return buf.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  }

  // Create signed state token: rand.ts.sig (sig = HMAC_SHA256(rand + '.' + ts) base64url trimmed)
  function createSignedState(){
    const rand = crypto.randomBytes(9).toString('hex'); // 18 hex chars
    const ts = Date.now();
    const sig = b64url(crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(rand + '.' + ts).digest()).slice(0,43);
    return `${rand}.${ts}.${sig}`;
  }

  function verifySignedStateFormat(state){
    if(!state || typeof state !== 'string') return { ok:false, reason:'empty' };
    const parts = state.split('.');
    if(parts.length !== 3) return { ok:false, reason:'parts' };
    const [rand, tsStr, sig] = parts;
    if(!/^[a-f0-9]{18}$/i.test(rand)) return { ok:false, reason:'rand_format' };
    if(!/^[0-9]+$/.test(tsStr)) return { ok:false, reason:'ts_format' };
    const ts = parseInt(tsStr,10);
    const ageMs = Date.now() - ts;
    if(ageMs < 0) return { ok:false, reason:'future_ts' };
    if(ageMs > OAUTH_STATE_EXP_SECONDS * 1000) return { ok:false, reason:'expired' };
    const expected = b64url(crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(rand + '.' + tsStr).digest()).slice(0,43);
    try {
      if(!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return { ok:false, reason:'sig' };
    } catch { return { ok:false, reason:'sig_cmp' }; }
    if(consumedStateSet.has(state)) return { ok:false, reason:'replay' };
    return { ok:true, ageSec: Math.round(ageMs/1000) };
  }

  // OAuth state helpers (using database + memory + stateless fallback)
  async function saveOAuthState(state) {
    const timestamp = Date.now();
    
    // Always save to memory as primary store for immediate availability
    oauthStateStore.set(state, timestamp);
    console.log('[OAuth] Saved state to memory:', state, 'timestamp:', timestamp);
    
    // Try to save to database as backup/persistence
    if (store.sqlPool) {
      try {
        const result = await store.sqlPool.query(
          'INSERT INTO oauth_states (state, created_at, expires_at, active) VALUES (?, NOW(), DATE_ADD(NOW(), INTERVAL 10 MINUTE), 1) ON DUPLICATE KEY UPDATE created_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE), active = 1',
          [state]
        );
        
        // Handle different result structures from mysql2
        const affectedRows = result.affectedRows || result[0]?.affectedRows || (Array.isArray(result) && result[0]?.affectedRows) || 0;
        
        if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.log('[OAuth] Saved state to both memory and DB:', state, 'affected rows:', affectedRows);
        }
        
        // Verify the state was actually saved
        const [verifyRows] = await store.sqlPool.query(
          'SELECT state FROM oauth_states WHERE state = ? AND active = 1',
          [state]
        );
        
        if (verifyRows.length === 0) {
          console.error('[OAuth] State verification failed - not found in database:', state);
          // Continue with memory-only storage
          if (process.env.DEBUG_PERSONALIZATION === '1') {
            console.log('[OAuth] Continuing with memory-only storage for state:', state);
          }
        } else if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.log('[OAuth] State verification successful:', state);
        }
        return true;
      } catch(e) {
        console.error('[OAuth] Failed to save OAuth state to DB:', e.message);
        // Continue with memory-only - don't fail the OAuth flow
        if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.log('[OAuth] Continuing with memory-only storage due to DB error');
        }
        return true;
      }
    }
    
    // Memory-only storage (no database available)
    if (process.env.DEBUG_PERSONALIZATION === '1') {
      console.log('[OAuth] Saved state to memory only (no DB):', state);
    }
    return true;
  }

  async function verifyOAuthState(state) {
    console.log('[OAuth] Verifying state:', state);
    console.log('[OAuth] Memory store size:', oauthStateStore.size);
    console.log('[OAuth] Memory store has state:', oauthStateStore.has(state));

    // Try database first if available
    if (store.sqlPool) {
      try {
        if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.log('[OAuth] Checking database for state:', state);
        }
        const [rows] = await store.sqlPool.query(
          'SELECT state, created_at, expires_at, active, (expires_at > NOW()) as notExpired FROM oauth_states WHERE state = ?',
          [state]
        );
        if (rows.length > 0) {
          const row = rows[0];
            if (row.active === 1 && row.notExpired) {
              console.log('[OAuth] State found in database - valid (active)');
              return true;
            } else if (row.active === 0 && row.notExpired) {
              if (process.env.OAUTH_ALLOW_REUSE === '1') {
                console.warn('[OAuth] Allowing reuse of inactive state due to OAUTH_ALLOW_REUSE=1 (reduced security):', state);
                return true;
              } else {
                console.warn('[OAuth] Found inactive (consumed) state in DB; will treat as invalid unless reuse enabled.');
              }
            } else if (!row.notExpired) {
              console.warn('[OAuth] State in DB expired:', state);
            }
        }
      } catch(e) {
        console.error('[OAuth] DB verify error (continuing):', e.message);
      }
    }

    // Memory fallback
    if (oauthStateStore.has(state)) {
      const ts = oauthStateStore.get(state);
      const ageMs = Date.now() - ts;
      const expired = ageMs > OAUTH_STATE_EXP_SECONDS * 1000;
      console.log('[OAuth] Memory state ageSec:', Math.round(ageMs/1000), 'expired:', expired);
      if (expired) {
        oauthStateStore.delete(state);
        return false;
      }
      return true;
    }

    // Stateless fallback
    const stateless = verifySignedStateFormat(state);
    if (stateless.ok) {
      console.log('[OAuth] Stateless fallback accepted, ageSec:', stateless.ageSec);
      return true;
    }
    // Legacy short state fallback (no dots). Accept to unblock login if format matches previous random base36 pattern.
    // Criteria: 6-18 chars, alphanumeric, no dots, not already consumed.
    if(/^[a-z0-9]{6,18}$/i.test(state)) {
      console.warn('[OAuth] Accepting legacy format state (reuse allowed TEMPORARILY; reduced CSRF protection) state:', state);
      // TODO: remove legacy acceptance once frontend confirmed issuing signed states with dots
      return true;
    }
    console.warn('[OAuth] State verification failed (not found; fallback reason:', stateless.reason, ')');
    return false;
  }

  async function deleteOAuthState(state) {
    if (store.sqlPool) {
      try {
        const result = await store.sqlPool.query('UPDATE oauth_states SET active = 0 WHERE state = ?', [state]);
        const affectedRows = result.affectedRows || result[0]?.affectedRows || (Array.isArray(result) && result[0]?.affectedRows) || 0;
        if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.log('[OAuth] Deactivated state in DB:', state, 'affected rows:', affectedRows);
        }
      } catch(e) {
        console.error('[OAuth] DB deactivate error:', e.message);
      }
    }
    const hadState = oauthStateStore.has(state);
    oauthStateStore.delete(state);
    consumedStateSet.add(state); // prevent stateless replay
    if (process.env.DEBUG_PERSONALIZATION === '1') {
      console.log('[OAuth] Consumed state (memory had:', hadState, '):', state);
    }
    return hadState;
  }

  async function cleanupExpiredStates() {
    if (store.sqlPool) {
      try {
        // Test database connection first
        await store.sqlPool.query('SELECT 1');
        
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
        console.error('[OAuth] Failed to cleanup expired OAuth states:', e.message, e.stack);
      }
    } else {
      // Fallback: prune expired in-memory states (>10m)
      const now = Date.now();
      let prunedCount = 0;
      for (const [s, ts] of oauthStateStore) {
        if (now - ts > 10 * 60 * 1000) {
          oauthStateStore.delete(s);
          prunedCount++;
        }
      }
      if (prunedCount > 0) {
        if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.log('[OAuth] Pruned', prunedCount, 'expired in-memory states');
        }
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
    
    const state = createSignedState();
    if (process.env.DEBUG_PERSONALIZATION === '1') {
      console.log('[OAuth] Generated state:', state);
      console.log('[OAuth] State format has dots:', state.includes('.'));
    }
    
    const saved = await saveOAuthState(state);
    if (!saved) {
      console.error('[OAuth] Failed to save state, aborting:', state);
      return res.status(500).json({ error: 'state_save_failed', message: 'Failed to save OAuth state' });
    }
    
    // Cleanup expired states (async, don't block the URL generation)
    cleanupExpiredStates().catch(e => {
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Cleanup error during URL generation:', e.message);
      }
    });
    
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
    if (preferApp === 'true' && isActuallyMobile) {
      // Only use Discord app if explicitly requested AND on mobile
      primaryUrl = appUrl;
    } else {
      // Default to web browser for better compatibility
      primaryUrl = webUrl;
    }
    
    // Debug logging
    if (process.env.DEBUG_PERSONALIZATION === '1') {
      console.log('[OAuth] URL selection:', {
        userAgent: userAgent.substring(0, 100),
        serverMobileDetection,
        isActuallyMobile,
        preferApp,
        selectedUrl: primaryUrl.includes('discord://') ? 'app' : 'web',
        state
      });
    }
    
  // Prevent caching of this response (state must be fresh)
  res.set('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma','no-cache');
  res.set('Expires','0');
  res.json({ 
      url: primaryUrl,
      webUrl,
      appUrl,
      isMobile: isActuallyMobile,
      preferApp: preferApp === 'true',
      state: process.env.DEBUG_PERSONALIZATION === '1' ? state : undefined,
      stateFormat: process.env.DEBUG_PERSONALIZATION === '1' ? 'signed(rand.ts.sig)' : undefined
    });
  });

  // Simple version probe for debugging running instance
  router.get('/version', (req, res) => {
    res.json({ version: AUTH_ROUTE_VERSION });
  });

  // OAuth callback exchange (code -> token -> user info & guilds)
  router.post('/oauth/discord/exchange', express.json(), async (req, res) => {
    const { code, state } = req.body || {};
    
    if (process.env.DEBUG_PERSONALIZATION === '1') {
      console.log('[OAuth] Exchange request:', { 
        hasCode: !!code, 
        state, 
        bodyKeys: Object.keys(req.body || {}),
        contentType: req.headers['content-type']
      });
    }
    
    if (!code) {
      console.error('[OAuth] Missing code in exchange request');
      return res.status(400).json({ error: 'missing_code', message: 'Authorization code is required' });
    }
    
    if (!state) {
      console.error('[OAuth] Missing state in exchange request');
      return res.status(400).json({ error: 'missing_state', message: 'OAuth state parameter is required' });
    }
    
  // Verify state BEFORE cleanup to avoid race conditions (supports stateless fallback)
  const stateValid = await verifyOAuthState(state);
    if (!stateValid) {
      console.error('[OAuth] Invalid state in exchange:', state);
      // Log additional debug info to help diagnose the issue
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Debug - checking state storage:');
        console.log('[OAuth] Database states count:', store.sqlPool ? 'checking...' : 'no database');
        console.log('[OAuth] Memory states count:', oauthStateStore.size);
        
        // Check if state exists in either storage
        const memoryHas = oauthStateStore.has(state);
        console.log('[OAuth] State in memory:', memoryHas);
        
        if (store.sqlPool) {
          try {
            const [rows] = await store.sqlPool.query(
              'SELECT state, expires_at, active, (expires_at > NOW()) as valid FROM oauth_states WHERE state = ?',
              [state]
            );
            console.log('[OAuth] State in database:', rows.length > 0 ? rows[0] : 'not found');
          } catch(e) {
            console.log('[OAuth] Database state check failed:', e.message);
          }
        }
      }
      
      return res.status(400).json({ 
        error: 'invalid_state', 
        message: 'OAuth state is invalid or expired. Please try logging in again.',
        receivedState: process.env.DEBUG_PERSONALIZATION === '1' ? state : undefined
      });
    }
    
    try {
      // Delete state immediately to prevent reuse
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Deleting used state:', state);
      }
      await deleteOAuthState(state);
      
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Exchanging code for token...');
      }
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
        console.error('[OAuth] Token exchange failed:', tokenResp.status, text);
        return res.status(400).json({ 
          error: 'token_exchange_failed', 
          detail: text,
          status: tokenResp.status
        });
      }
      
      const tokenJson = await tokenResp.json();
      const accessToken = tokenJson.access_token;
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Token exchange successful');
      }
      
      // Fetch user
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Fetching user info...');
      }
      const userResp = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const user = await userResp.json();
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] User fetched:', user.username, user.id);
      }
      
      // Fetch guilds
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Fetching user guilds...');
      }
      const guildResp = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const rawGuilds = await guildResp.json();
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Guilds fetched:', Array.isArray(rawGuilds) ? rawGuilds.length : 'not array');
      }
      
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
      
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] Manageable guilds with bot:', guilds.length);
      }
      
      // Persist user (MariaDB only currently)
      try { 
        if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.log('[OAuth] Persisting user...');
        }
        await store.upsertUser(user); 
        if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.log('[OAuth] User persisted successfully');
        }
      } catch(e) { 
        console.warn('[OAuth] Persist user failed:', e.message); 
      }
      
      const jwtToken = jwt.sign({ 
        userId: user.id, 
        username: user.username, 
        type: 'discord',
        manageableGuilds: allManageableGuilds // Store ALL manageable guild IDs (for future use)
      }, PRIMARY_JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      
      if (process.env.DEBUG_PERSONALIZATION === '1') {
        console.log('[OAuth] JWT token created for user:', user.username);
      }
      
      audit(req, { action: 'oauth-login', user: user.id });
      res.json({ token: jwtToken, user, guilds });
      
    } catch(e) {
      console.error('[OAuth] Exchange error:', e.message, e.stack);
      res.status(500).json({ 
        error: 'oauth_failed', 
        message: 'Internal server error during OAuth exchange',
        detail: process.env.DEBUG_PERSONALIZATION === '1' ? e.message : 'Internal error'
      });
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
    try {
      const dbStates = [];
      const memoryStates = [];
      
      if (store.sqlPool) {
        try {
          const [rows] = await store.sqlPool.query(
            'SELECT state, created_at, expires_at, active, (expires_at > NOW()) as valid FROM oauth_states ORDER BY created_at DESC LIMIT 20'
          );
          dbStates.push(...rows);
        } catch(e) {
          if (process.env.DEBUG_PERSONALIZATION === '1') {
            console.error('[OAuth Debug] Database query failed:', e.message);
          }
        }
      }
      
      // In-memory states
      for (const [state, timestamp] of oauthStateStore.entries()) {
        memoryStates.push({
          state: process.env.DEBUG_PERSONALIZATION === '1' ? state : 'hidden',
          timestamp: new Date(timestamp).toISOString(),
          age_minutes: Math.round((Date.now() - timestamp) / 60000),
          valid: (Date.now() - timestamp) < 10 * 60 * 1000
        });
      }
      
      res.json({ 
        database: {
          connected: !!store.sqlPool,
          states: process.env.DEBUG_PERSONALIZATION === '1' ? dbStates : dbStates.map(s => ({...s, state: 'hidden'})),
          count: dbStates.length
        },
        inMemory: {
          states: memoryStates,
          count: memoryStates.length
        },
        summary: {
          total_db: dbStates.length,
          total_memory: memoryStates.length,
          valid_db: dbStates.filter(s => s.valid).length,
          valid_memory: memoryStates.filter(s => s.valid).length
        },
        debug_mode: process.env.DEBUG_PERSONALIZATION === '1'
      });
    } catch(e) {
      console.error('[OAuth Debug] Debug endpoint error:', e.message);
      res.status(500).json({ error: e.message });
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
