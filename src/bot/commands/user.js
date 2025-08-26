module.exports = {
  name: 'user',
  execute: async (interaction) => {
    const sub = interaction.options.getSubcommand();
    if (sub === 'info') {
      const user = interaction.options.getUser('target') || interaction.user;
      const member = interaction.guild ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;
      const joined = member ? (member.joinedAt ? member.joinedAt.toISOString() : 'unknown') : 'not a guild member';
      await interaction.reply({ content: `${user.tag} (id: ${user.id}) — Joined: ${joined}` });
    }
  }
};
