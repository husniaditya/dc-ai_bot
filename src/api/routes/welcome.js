const express = require('express');
const { PermissionsBitField } = require('discord.js');
const { audit } = require('../middleware/audit');

function createWelcomeRoutes(client, store) {
  const router = express.Router();

  // Get welcome config
  router.get('/', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });
      
      const cfg = await store.getGuildWelcome(guildId);
      res.json(cfg);
    } catch(e) { 
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Update welcome config
  router.put('/', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });

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

      const allowed = {
        channelId: req.body.channelId,
        messageType: req.body.messageType,
        messageText: req.body.messageText,
        cardEnabled: req.body.cardEnabled,
        enabled: req.body.enabled
      };

      if (allowed.messageText && allowed.messageText.length > 2000) {
        return res.status(400).json({ error: 'message_too_long' });
      }

      const updated = await store.setGuildWelcome(guildId, allowed);
      audit(req, { action: 'update-welcome', guildId });
      res.json(updated);
    } catch(e) { 
      res.status(500).json({ error: 'persist_failed' }); 
    }
  });

  return router;
}

module.exports = createWelcomeRoutes;
