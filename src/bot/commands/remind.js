module.exports = (client) => ({
  name: 'remind',
  execute: async (interaction) => {
    const minutes = interaction.options.getInteger('minutes');
    const text = interaction.options.getString('text');
    const ms = Math.max(1000, minutes * 60 * 1000);
    await interaction.reply({ content: `Okay — I'll remind you in ${minutes} minute(s).`, flags: 64 });
    setTimeout(async () => {
      try { await interaction.user.send(`Reminder: ${text}`); }
      catch {
        const channel = await client.channels.fetch(interaction.channelId).catch(() => null);
        if (channel) channel.send(`${interaction.user}, Reminder: ${text}`);
      }
    }, ms);
  }
});
