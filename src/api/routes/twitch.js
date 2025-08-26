const express = require('express');
const { PermissionsBitField } = require('discord.js');
const { audit } = require('../middleware/audit');

// Use built-in global fetch (Node 18+) to avoid ESM require issues
const fetchFn = (...args) => globalThis.fetch(...args);

function createTwitchRoutes(client, store) {
  const router = express.Router();

  // Get Twitch config
  router.get('/config', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });
      
      const cfg = await store.getGuildTwitchConfig(guildId);
      res.json(cfg);
    } catch(e) { 
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Update Twitch config
  router.put('/config', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });

      // Permissions: require Manage Guild if discord user
      if (req.user.type === 'discord') {
        try {
          const guild = client.guilds.cache.get(guildId);
          if (!guild) return res.status(400).json({ error: 'bot_not_in_guild' });
          
          const member = await guild.members.fetch(req.user.userId).catch(() => null);
          if (!member) return res.status(403).json({ error: 'not_in_guild' });
          
          if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return res.status(403).json({ error: 'insufficient_permissions' });
          }
        } catch { 
          return res.status(403).json({ error: 'permission_check_failed' }); 
        }
      }

      const partial = {
        streamers: Array.isArray(req.body.streamers) ? req.body.streamers : undefined,
        announceChannelId: req.body.announceChannelId,
        mentionRoleId: req.body.mentionRoleId,
        mentionTargets: Array.isArray(req.body.mentionTargets) ? req.body.mentionTargets : undefined,
        enabled: req.body.enabled,
        intervalSec: req.body.intervalSec,
        liveTemplate: req.body.liveTemplate,
        embedEnabled: req.body.embedEnabled,
        streamerMessages: req.body.streamerMessages,
        streamerNames: req.body.streamerNames
      };

      const cfg = await store.setGuildTwitchConfig(guildId, partial);
      
      if (store.invalidateGuildTwitchConfig) { 
        store.invalidateGuildTwitchConfig(guildId); 
      }
      
      audit(req, { action: 'update-twitch-config', guildId });

      // Re-fetch to ensure values reflect DB authoritative columns
      const fresh = await store.getGuildTwitchConfig(guildId);
      res.json(fresh);
    } catch(e) { 
      res.status(500).json({ error: 'persist_failed' }); 
    }
  });

  // Resolve Twitch streamer input (username / URL) -> username
  router.post('/resolve-streamer', async (req, res) => {
    try {
      const { input } = req.body || {};
      if (!input || typeof input !== 'string') {
        return res.status(400).json({ error: 'input_required' });
      }

      const raw = input.trim();
      
      // Extract username from various Twitch URL formats
      let username = null;
      if (raw.startsWith('https://www.twitch.tv/') || raw.startsWith('https://twitch.tv/')) {
        const parts = raw.split('/');
        username = parts[parts.length - 1];
      } else if (raw.startsWith('twitch.tv/')) {
        username = raw.split('/')[1];
      } else {
        // Assume it's already a username, clean it
        username = raw.replace(/^@/, ''); // remove @ if present
      }
      
      // Validate username format (Twitch usernames: 4-25 chars, alphanumeric + underscore)
      if (!username || !/^[a-zA-Z0-9_]{4,25}$/.test(username)) {
        return res.status(400).json({ error: 'invalid_username' });
      }
      
      // Try to get display name from Twitch API
      let displayName = username;
      try {
        const clientId = process.env.TWITCH_CLIENT_ID;
        const clientSecret = process.env.TWITCH_CLIENT_SECRET;
        
        if (clientId && clientSecret) {
          // Get OAuth token
          const tokenResp = await fetchFn('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: 'client_credentials'
            })
          });
          const tokenData = await tokenResp.json();
          
          if (tokenData.access_token) {
            // Get user info
            const userResp = await fetchFn(`https://api.twitch.tv/helix/users?login=${username}`, {
              headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${tokenData.access_token}`
              }
            });
            const userData = await userResp.json();
            
            if (userData.data && userData.data.length > 0) {
              displayName = userData.data[0].display_name;
            }
          }
        }
      } catch(e) {
        console.warn('Twitch API lookup failed:', e.message);
        // Continue with cleaned username if API fails
      }
      
      res.json({ 
        username: username.toLowerCase(), 
        displayName, 
        source: 'api' 
      });
    } catch(e) { 
      res.status(500).json({ error: 'resolve_failed' }); 
    }
  });

  return router;
}

module.exports = createTwitchRoutes;
