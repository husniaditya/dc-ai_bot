const express = require('express');

module.exports = function(client, store) {
  const router = express.Router();

  // Get Discord channels for a guild
  router.get('/', async (req, res) => {
    try {
      const { guildId } = req.query;
      if (!guildId) {
        return res.status(400).json({ error: 'guildId is required' });
      }

      // Get guild from Discord client
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      // Fetch all channels and filter for text channels
      const channels = await guild.channels.fetch();
      const textChannels = channels
        .filter(channel => channel.isTextBased() && channel.type !== 4) // Exclude categories
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          parentId: channel.parentId,
          position: channel.position
        }))
        .sort((a, b) => a.position - b.position);

      res.json({ channels: textChannels });
    } catch (error) {
      console.error('Error fetching channels:', error);
      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  });

  return router;
};
