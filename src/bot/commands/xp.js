const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'xp',
  description: 'XP and leveling commands',
  slash: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('XP and leveling commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Check your or another user\'s XP and level')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to check (defaults to yourself)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('Show the XP leaderboard for this server')
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of users to show (default: 10, max: 25)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)
        )
    ),

  async execute(interaction, store) {
    try {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'check') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        // Get user's XP data
        const userData = await store.getUserXp(interaction.guild.id, targetUser.id);
        
        if (!userData || userData.total_xp === 0) {
          return interaction.editReply({
            content: `${targetUser.id === interaction.user.id ? 'You haven\'t' : `${targetUser} hasn't`} earned any XP yet! Start chatting to gain XP.`
          });
        }

        // Calculate level progress
        const currentLevel = userData.level;
        const totalXp = userData.total_xp;
        const xpForCurrentLevel = store.getXpForLevel ? store.getXpForLevel(currentLevel) : (currentLevel - 1) * 100;
        const xpForNextLevel = store.getXpForLevel ? store.getXpForLevel(currentLevel + 1) : currentLevel * 100;
        const progressXp = totalXp - xpForCurrentLevel;
        const neededXp = xpForNextLevel - xpForCurrentLevel;
        const progressPercent = Math.floor((progressXp / neededXp) * 100);

        // Create progress bar
        const progressBarLength = 10;
        const filledBars = Math.floor((progressPercent / 100) * progressBarLength);
        const emptyBars = progressBarLength - filledBars;
        const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

        const xpEmbed = new EmbedBuilder()
          .setTitle(`⭐ ${targetUser.username}'s Level & XP`)
          .setThumbnail(targetUser.displayAvatarURL())
          .addFields(
            { name: '🎯 Level', value: currentLevel.toString(), inline: true },
            { name: '💫 Total XP', value: totalXp.toLocaleString(), inline: true },
            { name: '📊 Progress to Next Level', value: `${progressXp}/${neededXp} XP (${progressPercent}%)\n\`${progressBar}\``, inline: false }
          )
          .setColor(0x00ff00)
          .setTimestamp();

        await interaction.editReply({ embeds: [xpEmbed] });

      } else if (subcommand === 'leaderboard') {
        const limit = interaction.options.getInteger('limit') || 10;
        
        // Get leaderboard data
        const leaderboard = await store.getUserLeaderboard(interaction.guild.id, limit);
        
        if (!leaderboard || leaderboard.length === 0) {
          return interaction.editReply({
            content: '📊 No XP data found for this server yet. Start chatting to build the leaderboard!'
          });
        }

        const leaderboardEmbed = new EmbedBuilder()
          .setTitle(`🏆 ${interaction.guild.name} XP Leaderboard`)
          .setColor(0xffd700)
          .setTimestamp();

        let description = '';
        for (let i = 0; i < leaderboard.length; i++) {
          const user = leaderboard[i];
          let rank;
          
          if (i === 0) rank = '🥇';
          else if (i === 1) rank = '🥈';
          else if (i === 2) rank = '🥉';
          else rank = `${i + 1}.`;

          try {
            const discordUser = await interaction.client.users.fetch(user.user_id);
            description += `${rank} **${discordUser.username}** - Level ${user.level} (${user.total_xp.toLocaleString()} XP)\n`;
          } catch (error) {
            description += `${rank} Unknown User - Level ${user.level} (${user.total_xp.toLocaleString()} XP)\n`;
          }
        }

        leaderboardEmbed.setDescription(description);
        
        // Add user's rank if they're not in the top list
        try {
          const fullLeaderboard = await store.getUserLeaderboard(interaction.guild.id, 100);
          const userRank = fullLeaderboard.findIndex(user => user.user_id === interaction.user.id) + 1;
          
          if (userRank > limit && userRank > 0) {
            const userData = fullLeaderboard[userRank - 1];
            leaderboardEmbed.setFooter({ 
              text: `Your rank: #${userRank} - Level ${userData.level} (${userData.total_xp.toLocaleString()} XP)`,
              iconURL: interaction.user.displayAvatarURL()
            });
          }
        } catch (error) {
          console.error('Error getting user rank for footer:', error);
        }

        await interaction.editReply({ embeds: [leaderboardEmbed] });
      }

    } catch (error) {
      console.error('Error in xp command:', error);
      
      const errorMessage = interaction.deferred 
        ? { content: '❌ An error occurred while processing the XP command.' }
        : { content: '❌ An error occurred while processing the XP command.', ephemeral: true };
      
      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
