module.exports = {
  name: 'whoami',
  execute: async (interaction) => {
    await interaction.reply(`${interaction.user.tag} (id: ${interaction.user.id})`);
  }
};
