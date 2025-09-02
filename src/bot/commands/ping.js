module.exports = {
  name: 'ping',
  execute: async (interaction) => {
    const start = Date.now();
    await interaction.reply('Pong!');
    const end = Date.now();
    await interaction.editReply(`Pong! Latency: ${end - start}ms`);
  }
};
