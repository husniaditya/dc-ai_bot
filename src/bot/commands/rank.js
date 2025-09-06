const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'rank',
  description: 'Check your rank on the leaderboard',
  
  async execute(interaction, store) {
    try {
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('user') || interaction.user;
      
      // Get user's XP data
      const userData = await store.getUserXp(interaction.guild.id, targetUser.id);
      
      if (!userData || userData.total_xp === 0) {
        return interaction.editReply({
          content: `${targetUser.id === interaction.user.id ? 'You haven\'t' : `${targetUser} hasn't`} earned any XP yet! Start chatting to gain XP.`
        });
      }

      // Get leaderboard to find rank
      const leaderboard = await store.getUserLeaderboard(interaction.guild.id, 100);
      const userRank = leaderboard.findIndex(user => user.user_id === targetUser.id) + 1;

      if (userRank === 0) {
        return interaction.editReply({
          content: `${targetUser.id === interaction.user.id ? 'You are' : `${targetUser} is`} not on the leaderboard yet.`
        });
      }

      const xpForCurrentLevel = store.getXpForLevel ? store.getXpForLevel(userData.level) : (userData.level - 1) * 100;
      const xpForNextLevel = store.getXpForLevel ? store.getXpForLevel(userData.level + 1) : userData.level * 100;
      const progressXp = userData.total_xp - xpForCurrentLevel;
      const neededXp = xpForNextLevel - xpForCurrentLevel;
      const progressPercent = Math.floor((progressXp / neededXp) * 100);

      // Create progress bar
      const progressBarLength = 10;
      const filledBars = Math.floor((progressPercent / 100) * progressBarLength);
      const emptyBars = progressBarLength - filledBars;
      const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

      const rankEmbed = new EmbedBuilder()
        .setTitle(`🏆 Rank Information`)
        .setDescription(`${targetUser.id === interaction.user.id ? 'Your' : `${targetUser.username}'s`} current rank in ${interaction.guild.name}`)
        .addFields(
          { name: '📊 Rank', value: `#${userRank}`, inline: true },
          { name: '⭐ Level', value: userData.level.toString(), inline: true },
          { name: '💫 Total XP', value: userData.total_xp.toLocaleString(), inline: true },
          { name: '📈 Progress to Next Level', value: `${progressXp}/${neededXp} XP (${progressPercent}%)\n\`${progressBar}\``, inline: false }
        )
        .setColor(userRank <= 3 ? 0xffd700 : userRank <= 10 ? 0xc0c0c0 : 0xcd7f32)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      // Add rank emoji
      if (userRank === 1) {
        rankEmbed.setDescription(`🥇 ${targetUser.id === interaction.user.id ? 'You are' : `${targetUser.username} is`} the top ranked member in ${interaction.guild.name}!`);
      } else if (userRank === 2) {
        rankEmbed.setDescription(`🥈 ${targetUser.id === interaction.user.id ? 'You are' : `${targetUser.username} is`} the 2nd ranked member in ${interaction.guild.name}!`);
      } else if (userRank === 3) {
        rankEmbed.setDescription(`🥉 ${targetUser.id === interaction.user.id ? 'You are' : `${targetUser.username} is`} the 3rd ranked member in ${interaction.guild.name}!`);
      }

      await interaction.editReply({ embeds: [rankEmbed] });

    } catch (error) {
      console.error('Error in rank command:', error);
      
      const errorMessage = interaction.deferred 
        ? { content: '❌ An error occurred while fetching rank information.' }
        : { content: '❌ An error occurred while fetching rank information.', ephemeral: true };
      
      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
