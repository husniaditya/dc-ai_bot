module.exports = (startTimestamp) => ({
  name: 'uptime',
  execute: async (interaction) => {
    const seconds = Math.floor((Date.now() - startTimestamp) / 1000);
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    await interaction.reply(`Uptime: ${hrs}h ${mins}m ${secs}s`);
  }
});
