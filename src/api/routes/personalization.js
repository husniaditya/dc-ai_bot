const express = require('express');
const { PermissionsBitField } = require('discord.js');
const { audit } = require('../middleware/audit');

function createPersonalizationRoutes(client, store) {
  const router = express.Router();

  // Personalization runtime helpers
  const personalizationRuntime = {
    lastAvatarHash: null,
    lastAvatarUpdateTs: 0,
    activityApplied: null
  };

  function hashString(str) {
    let h = 0, i, chr;
    if (!str) return 0;
    for (i = 0; i < str.length; i++) {
      chr = str.charCodeAt(i);
      h = ((h << 5) - h) + chr;
      h |= 0;
    }
    return h;
  }

  async function applyGuildPersonalization(guildId) {
    try {
      const p = await store.getGuildPersonalization(guildId);
      const guild = client.guilds.cache.get(guildId);
      if (!guild || !p) return;

      // Nickname (guild specific)
      if (p.nickname !== undefined && p.nickname !== null) {
        try {
          if (guild.members.me && guild.members.me.nickname !== p.nickname) {
            await guild.members.me.setNickname(p.nickname).catch(() => {});
          }
        } catch {}
      }

      // Activity (global) – we just apply last saved one encountered
      if (p.activityType && p.activityText) {
        const typeMap = {
          PLAYING: 0, // ActivityType.Playing
          LISTENING: 2, // ActivityType.Listening
          WATCHING: 3, // ActivityType.Watching
          COMPETING: 5, // ActivityType.Competing
          STREAMING: 1 // ActivityType.Streaming
        };
        const mappedType = typeMap[p.activityType.toUpperCase()] ?? 0;
        const key = `${mappedType}:${p.activityText}`;
        if (personalizationRuntime.activityApplied !== key) {
          try {
            await client.user.setActivity(p.activityText, { type: mappedType });
            personalizationRuntime.activityApplied = key;
          } catch(e) {
            console.warn('Set activity failed', e.message);
          }
        }
      }

      // Status (online/dnd/idle/invisible)
      if (p.status) {
        const valid = ['online', 'dnd', 'idle', 'invisible'];
        if (valid.includes(p.status)) {
          try {
            await client.user.setStatus(p.status);
          } catch(e) {
            console.warn('Set status failed', e.message);
          }
        }
      }

      // Avatar (global) – apply only if changed & not rate limited
      if (p.avatarBase64) {
        const b64 = p.avatarBase64.includes(',') ? 
          p.avatarBase64.split(',').pop() : p.avatarBase64;
        
        if (b64 && b64.length < 15_000_000) { // ~11MB raw -> 15MB b64
          const h = hashString(b64);
          const now = Date.now();
          const intervalMs = 10 * 60 * 1000; // 10 minutes
          
          if (h !== personalizationRuntime.lastAvatarHash && 
              (now - personalizationRuntime.lastAvatarUpdateTs) > intervalMs) {
            try {
              const buf = Buffer.from(b64, 'base64');
              if (buf.length <= 8_000_000) { // Discord hard limit 8MB
                await client.user.setAvatar(buf);
                personalizationRuntime.lastAvatarHash = h;
                personalizationRuntime.lastAvatarUpdateTs = now;
              } else {
                console.warn('Avatar too large, skipping apply');
              }
            } catch(e) {
              console.warn('Set avatar failed', e.message);
            }
          }
        }
      }
    } catch(e) { /* silent */ }
  }

  // Get personalization
  router.get('/', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });
      
      const p = await store.getGuildPersonalization(guildId);
      res.json(p);
    } catch(e) { 
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Update personalization
  router.put('/', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });

      // Permission check: require MANAGE_GUILD if user is discord auth
      if (req.user.type === 'discord') {
        try {
          const guild = client.guilds.cache.get(guildId);
          if (!guild) return res.status(400).json({ error: 'bot_not_in_guild' });
          
          const member = await guild.members.fetch(req.user.userId).catch(() => null);
          if (!member) return res.status(403).json({ error: 'not_in_guild' });
          
          const hasPerm = member.permissions.has(PermissionsBitField.Flags.ManageGuild);
          if (!hasPerm) return res.status(403).json({ error: 'insufficient_permissions' });
        } catch {
          return res.status(403).json({ error: 'permission_check_failed' });
        }
      }

      const allowed = {
        nickname: req.body.nickname,
        activityType: req.body.activityType,
        activityText: req.body.activityText,
        avatarBase64: req.body.avatarBase64,
        status: req.body.status
      };

      // Basic validation
      if (allowed.nickname && allowed.nickname.length > 32) {
        return res.status(400).json({ error: 'nickname_too_long' });
      }
      if (allowed.activityText && allowed.activityText.length > 128) {
        return res.status(400).json({ error: 'activity_text_too_long' });
      }

      const updated = await store.setGuildPersonalization(guildId, allowed);
      audit(req, { action: 'update-personalization', guildId });

      // Fire & forget apply (do not await full completion to keep API snappy)
      applyGuildPersonalization(guildId);

      res.json({ ...updated, applied: true });
    } catch(e) { 
      res.status(500).json({ error: 'persist_failed' }); 
    }
  });

  // Debug / manual cache invalidation
  router.post('/invalidate', async (req, res) => {
    try {
      const guildId = req.body && req.body.guildId;
      if (!guildId) return res.status(400).json({ error: 'guildId required' });
      
      if (store.invalidateGuildPersonalization) {
        store.invalidateGuildPersonalization(guildId);
      }
      
      res.json({ ok: true });
    } catch(e) { 
      res.status(500).json({ error: 'invalidate_failed' }); 
    }
  });

  // Debug endpoint: returns cached personalization + fresh DB row
  router.get('/debug', async (req, res) => {
    try {
      const guildId = req.query.guildId;
      if (!guildId) return res.status(400).json({ error: 'guildId required' });
      
      const cached = await store.getGuildPersonalization(guildId);
      const fresh = store.getGuildPersonalizationFresh ? 
        await store.getGuildPersonalizationFresh(guildId) : null;
      
      res.json({ 
        guildId, 
        cached, 
        fresh, 
        different: JSON.stringify(cached) !== JSON.stringify({ 
          ...(fresh || {}), 
          updatedAt: undefined 
        }) 
      });
    } catch(e) { 
      res.status(500).json({ error: 'debug_failed' }); 
    }
  });

  return router;
}

module.exports = createPersonalizationRoutes;
