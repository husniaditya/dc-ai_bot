// Slash command: /donationleaderboard refresh  -- manually refresh the donation leaderboard
// Registers a simple command handler pattern consistent with existing command style.

module.exports = {
  name: 'donationleaderboard',
  description: 'Manage the Clash of Clans donation leaderboard',
  options: [
    {
      type: 1, // SUB_COMMAND
      name: 'refresh',
      description: 'Force refresh the donation leaderboard now'
    }
  ],
  async execute(interaction, store, client) {
    if (!interaction.isChatInputCommand()) return;
    const sub = interaction.options.getSubcommand();

    if (!interaction.member.permissions.has('ManageGuild')) {
      return interaction.reply({ content: '❌ You need Manage Server permission.', ephemeral: true });
    }

    try {
      const cfg = await store.getGuildClashOfClansConfig(interaction.guildId);
      if (!cfg?.trackDonationLeaderboard) {
        return interaction.reply({ content: 'Donation leaderboard is not enabled for this server.', ephemeral: true });
      }
      if (!cfg.donationLeaderboardChannelId) {
        return interaction.reply({ content: 'No donation leaderboard channel configured.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      const LeaderboardEvents = require('../handlers/LeaderboardEvents');
      const lb = new LeaderboardEvents(client, store.sqlPool);
      const existingMessageId = cfg.donationMessageId || null;
      const result = await lb.postLeaderboard(interaction.guildId, cfg.donationLeaderboardChannelId, existingMessageId);

      if (result.success) {
        await interaction.editReply('✅ Donation leaderboard refreshed.');
      } else {
        await interaction.editReply(`❌ Failed to refresh: ${result.error}`);
      }
    } catch (err) {
      console.error('[Command] donationleaderboard refresh error:', err);
      if (interaction.deferred) {
        await interaction.editReply('❌ An error occurred while refreshing the leaderboard.');
      } else {
        await interaction.reply({ content: '❌ An error occurred while refreshing.', ephemeral: true });
      }
    }
  }
};