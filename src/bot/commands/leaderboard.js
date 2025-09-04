const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const XPHandler = require('../handlers/xpHandler');

module.exports = {
  name: 'leaderboard',
  description: 'View the server XP leaderboard',
  slash: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server XP leaderboard')
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number to view (default: 1)')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction, store) {
    try {
      await interaction.deferReply();

      const page = interaction.options.getInteger('page') || 1;
      const itemsPerPage = 10;
      const offset = (page - 1) * itemsPerPage;
      const guildId = interaction.guild.id;
      
      // Create XP handler instance
      const xpHandler = new XPHandler(store);

      // Get leaderboard data
      const leaderboard = await store.getGuildLeaderboard(guildId, itemsPerPage + 1, offset);
      
      if (!leaderboard || leaderboard.length === 0) {
        return await interaction.editReply({
          content: 'No XP data found for this server yet. Start chatting and joining voice channels to gain XP!',
          ephemeral: true
        });
      }

      // Check if there are more pages
      const hasNextPage = leaderboard.length > itemsPerPage;
      const displayData = hasNextPage ? leaderboard.slice(0, itemsPerPage) : leaderboard;

      // Create leaderboard text
      let leaderboardText = '';
      
      for (let i = 0; i < displayData.length; i++) {
        const userData = displayData[i];
        const rank = offset + i + 1;
        const level = xpHandler.calculateLevel(userData.totalXp);
        
        // Try to get user from cache, fallback to user ID if not found
        let userDisplay;
        try {
          const user = await interaction.client.users.fetch(userData.userId);
          userDisplay = user.username;
        } catch {
          userDisplay = `User ${userData.userId}`;
        }

        // Medal emojis for top 3
        let rankEmoji = `**${rank}.**`;
        if (rank === 1) rankEmoji = '🥇';
        else if (rank === 2) rankEmoji = '🥈';
        else if (rank === 3) rankEmoji = '🥉';

        leaderboardText += `${rankEmoji} **${userDisplay}** - Level ${level} (${userData.totalXp.toLocaleString()} XP)\n`;
      }

      // Find current user's rank if not on current page
      let userRankText = '';
      const userRank = await xpHandler.getUserRank(guildId, interaction.user.id);
      if (userRank.rank && (userRank.rank < offset + 1 || userRank.rank > offset + itemsPerPage)) {
        const userLevel = xpHandler.calculateLevel(userRank.user.totalXp);
        userRankText = `\n**Your Rank:** #${userRank.rank} - Level ${userLevel} (${userRank.user.totalXp.toLocaleString()} XP)`;
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0xffd700) // Gold color for leaderboard
        .setTitle(`🏆 ${interaction.guild.name} XP Leaderboard`)
        .setDescription(leaderboardText + userRankText)
        .setFooter({ 
          text: `Page ${page}${hasNextPage ? ` • Use /leaderboard page:${page + 1} for next page` : ''}` 
        })
        .setTimestamp();

      // Add server icon if available
      if (interaction.guild.iconURL()) {
        embed.setThumbnail(interaction.guild.iconURL({ dynamic: true }));
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in leaderboard command:', error);
      await interaction.editReply({ 
        content: 'An error occurred while fetching the leaderboard. Please try again later.',
        ephemeral: true 
      });
    }
  }
};
