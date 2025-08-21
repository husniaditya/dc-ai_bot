module.exports = {
  name: 'echo',
  execute: async (interaction) => {
    const text = interaction.options.getString('text') || '';
    await interaction.reply({ content: text });
  }
};
