module.exports = {
  name: 'ping',
  execute: async (interaction) => {
    await interaction.reply('Pong!');
  }
};
