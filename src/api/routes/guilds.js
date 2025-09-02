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

  // Get guild emojis
  router.get('/:guildId/emojis', async (req, res) => {
    try {
      const { guildId } = req.params;
      
      // Check if user can manage this guild
      const userManageableGuilds = new Set(req.user.manageableGuilds || []);
      if (!userManageableGuilds.has(guildId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Get the guild from Discord
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found or bot not present' });
      }
      
      // Get all custom emojis from the guild
      const emojis = Array.from(guild.emojis.cache.values()).map(emoji => ({
        id: emoji.id,
        name: emoji.name,
        animated: emoji.animated,
        available: emoji.available,
        url: emoji.imageURL()
      }));
      
      res.json({ emojis });
      
    } catch(e) {
      console.error('Error fetching guild emojis:', e);
      res.status(500).json({ error: 'Failed to fetch guild emojis' });
    }
  });

  return router;
}

module.exports = createGuildsRoutes;
