const express = require('express');
const { audit } = require('../middleware/audit');

function createAutoResponsesRoutes(store) {
  const router = express.Router();

  // Get auto responses
  router.get('/', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (guildId) {
        return res.json(await store.getGuildAutoResponses(guildId));
      }
      
      return res.json(store.getAutoResponses());
    } catch(e) { 
      return res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Create/update auto response
  router.post('/', async (req, res) => {
    const { key, pattern, flags, replies, enabled, rawText, matchType } = req.body || {};
    if (!key || !pattern) {
      return res.status(400).json({ error: 'key and pattern required' });
    }

    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      // Prepare the entry with new fields
      const autoResponseData = { 
        key, 
        pattern, 
        flags, 
        replies, 
        enabled,
        rawText: rawText || pattern, // Use rawText if provided, otherwise use pattern
        matchType: matchType || 'contains' // Default to 'contains' if not specified
      };
      
      let entry;
      if (guildId) {
        entry = await store.upsertGuildAutoResponse(guildId, autoResponseData);
      } else {
        entry = await store.upsertAutoResponse(autoResponseData);
      }

      audit(req, { 
        action: guildId ? 'upsert-guild-auto' : 'upsert-auto', 
        key, 
        guildId, 
        enabled,
        matchType 
      });
      
      res.json(entry);
    } catch(e) { 
      res.status(500).json({ error: 'persist_failed' }); 
    }
  });

  // Delete auto response
  router.delete('/:key', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (guildId) {
        await store.removeGuildAutoResponse(guildId, req.params.key);
      } else {
        await store.removeAutoResponse(req.params.key);
      }

      audit(req, { 
        action: guildId ? 'delete-guild-auto' : 'delete-auto', 
        key: req.params.key, 
        guildId 
      });
      
      res.json({ ok: true });
    } catch(e) { 
      res.status(500).json({ error: 'delete_failed' }); 
    }
  });

  return router;
}

module.exports = createAutoResponsesRoutes;
