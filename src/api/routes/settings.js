const express = require('express');
const { audit } = require('../middleware/audit');

function createSettingsRoutes(store) {
  const router = express.Router();

  // Get settings
  router.get('/', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (guildId) {
        const gs = await store.getGuildSettings(guildId);
        return res.json({ ...gs, guildId });
      }
      
      return res.json(store.getSettings());
    } catch(e) { 
      return res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Update settings
  router.put('/', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
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
      if (guildId) {
        updated = await store.setGuildSettings(guildId, allowed);
      } else {
        updated = await store.setSettings(allowed);
      }
      
      audit(req, { 
        action: guildId ? 'update-guild-settings' : 'update-settings', 
        guildId, 
        data: allowed 
      });
      
      res.json(updated);
    } catch(e) { 
      res.status(500).json({ error: 'persist_failed' }); 
    }
  });

  return router;
}

module.exports = createSettingsRoutes;
