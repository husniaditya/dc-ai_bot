const express = require('express');

function createGuildsRoutes(client, store) {
  const router = express.Router();

  // Get guilds for authenticated user
  router.get('/', async (req, res) => {
    try {
      // Get the user's manageable guild IDs from JWT token
      const userManageableGuilds = new Set(req.user.manageableGuilds || []);
      
      // Get all guilds that the bot is currently in
      const allBotGuilds = Array.from(client.guilds.cache.values());
      
      // Create a map of bot guilds for easy lookup
      const botGuildMap = new Map(allBotGuilds.map(g => [g.id, g]));
      
      // Build response: only include manageable guilds where bot is present
      const guilds = Array.from(userManageableGuilds)
        .map(guildId => {
          const botGuild = botGuildMap.get(guildId);
          return botGuild ? {
            id: botGuild.id,
            name: botGuild.name,
            icon: botGuild.icon,
            canManage: true,
            botPresent: true
          } : null;
        })
        .filter(Boolean); // Remove null entries (guilds where bot isn't present)
      
      res.json(guilds);
      
    } catch(e) {
      console.error('Error fetching guilds:', e);
      res.status(500).json({ error: 'Failed to fetch guilds' });
    }
  });

  return router;
}

module.exports = createGuildsRoutes;
