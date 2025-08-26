const express = require('express');
const { audit } = require('../middleware/audit');

function createCommandsRoutes(store, commandMap) {
  const router = express.Router();

  // Get commands with toggles
  router.get('/', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      let toggleMap = {};
      if (guildId && store.getGuildCommandToggles) {
        toggleMap = await store.getGuildCommandToggles(guildId);
      } else if (store.getCommandToggles) {
        toggleMap = await store.getCommandToggles();
      }

      const commands = Array.from(commandMap.values()).map(c => ({
        name: c.name,
        description: c.description || c.data?.description || '',
        enabled: toggleMap[c.name]?.enabled !== undefined ? 
          toggleMap[c.name].enabled : toggleMap[c.name] !== false,
        createdAt: toggleMap[c.name]?.createdAt || null,
        createdBy: toggleMap[c.name]?.createdBy || null,
        updatedAt: toggleMap[c.name]?.updatedAt || null,
        updatedBy: toggleMap[c.name]?.updatedBy || null,
      }));

      res.json({ guildId, commands });
    } catch(e) { 
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Toggle command
  router.post('/toggle', async (req, res) => {
    const { name, enabled } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });

    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      let result;
      const actor = req.user.userId || req.user.user || null;
      
      if (guildId && store.setGuildCommandToggle) {
        result = await store.setGuildCommandToggle(guildId, name, !!enabled, actor);
      } else if (store.setCommandToggle) {
        result = await store.setCommandToggle(name, !!enabled, actor);
      }

      audit(req, { action: 'command-toggle', guildId, name, enabled });
      res.json({ ok: true, name, enabled: result });
    } catch(e) { 
      res.status(500).json({ error: 'persist_failed' }); 
    }
  });

  return router;
}

module.exports = createCommandsRoutes;
