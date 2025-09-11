const ProfanityAutoPopulateService = require('../services/profanity-auto-populate');
const AutoResponseAutoPopulateService = require('../services/auto-response-auto-populate');

// Guild join event handler
module.exports = (client, store) => {
  const profanityService = new ProfanityAutoPopulateService(store);
  const autoResponseService = new AutoResponseAutoPopulateService(store);
  
  client.on('guildCreate', async (guild) => {
    console.log(`Bot joined guild: ${guild.name} (${guild.id})`);
    
    try {
      // Initialize default guild settings
      if (store) {
        // Ensure guild has default settings
        await store.initializeGuildSettings(guild.id);
        console.log(`Initialized settings for guild: ${guild.name}`);
        
        // Auto-populate profanity system for new guild
        const profanityResult = await profanityService.populateForGuild(guild.id);
        
        if (profanityResult.success && !profanityResult.skipped) {
          console.log(`Auto-populated profanity system for guild: ${guild.name} (${profanityResult.totalInserted} items)`);
        } else if (profanityResult.skipped) {
          console.log(`Skipped profanity auto-population for guild: ${guild.name} (already has data)`);
        }
        
        // Auto-populate auto-responses for new guild
        const autoResponseResult = await autoResponseService.populateForGuild(guild.id);
        
        if (autoResponseResult.success && !autoResponseResult.skipped) {
          console.log(`Auto-populated auto-responses for guild: ${guild.name} (${autoResponseResult.totalInserted} responses)`);
        } else if (autoResponseResult.skipped) {
          console.log(`Skipped auto-response auto-population for guild: ${guild.name} (already has data)`);
        }
      }
    } catch (error) {
      console.error(`Failed to initialize guild for ${guild.name}:`, error);
    }
  });
};
