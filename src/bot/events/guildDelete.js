// Guild leave event handler
module.exports = {
  name: 'guildDelete',
  once: false,
  execute: async (guild, client) => {
    console.log(`Bot left guild: ${guild.name} (${guild.id})`);
    
    // Optionally, you can clean up guild data here
    // or keep it for when the bot rejoins
  }
};
