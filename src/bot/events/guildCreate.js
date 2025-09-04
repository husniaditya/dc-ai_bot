// Guild join/leave event handler
module.exports = {
  name: 'guildCreate',
  once: false,
  execute: async (guild, client) => {
    console.log(`Bot joined guild: ${guild.name} (${guild.id})`);
    
    try {
      // Initialize default guild settings
      const store = client.store;
      if (store) {
        // Ensure guild has default settings
        await store.initializeGuildSettings(guild.id);
        console.log(`Initialized settings for guild: ${guild.name}`);
      }
    } catch (error) {
      console.error(`Failed to initialize guild settings for ${guild.name}:`, error);
    }
  }
};
