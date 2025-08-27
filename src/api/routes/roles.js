const express = require('express');

module.exports = function(client, store) {
  const router = express.Router();

  // Get Discord roles for a guild
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

      // Fetch all roles
      const roles = await guild.roles.fetch();
      const roleList = roles
        .filter(role => role.id !== guild.id) // Exclude @everyone role
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          mentionable: role.mentionable,
          managed: role.managed
        }))
        .sort((a, b) => b.position - a.position); // Sort by position (highest first)

      res.json({ roles: roleList });
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  });

  return router;
};
