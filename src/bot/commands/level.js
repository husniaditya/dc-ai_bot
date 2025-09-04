const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const XPHandler = require('../handlers/xpHandler');

module.exports = {
  name: 'level',
  description: 'Check your XP level or someone else\'s',
  slash: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your XP level or someone else\'s')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to check level for (optional)')
        .setRequired(false)
    ),

  async execute(interaction, store) {
    try {
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('user') || interaction.user;
      const guildId = interaction.guild.id;
      const userId = targetUser.id;
      
      // Create XP handler instance
      const xpHandler = new XPHandler(store);

      // Get user's XP data
      const userData = await store.getUserXp(guildId, userId);
      const level = xpHandler.calculateLevel(userData.total_xp || 0);
      const xpForCurrentLevel = xpHandler.getXpForLevel(level);
      const xpForNextLevel = xpHandler.getXpForLevel(level + 1);
      const xpInCurrentLevel = (userData.total_xp || 0) - xpForCurrentLevel;
      const xpNeededForNext = xpForNextLevel - (userData.total_xp || 0);
      const progressPercentage = Math.floor((xpInCurrentLevel / (xpForNextLevel - xpForCurrentLevel)) * 100);

      // Get user's rank
      const rankInfo = await xpHandler.getUserRank(guildId, userId);

      // Create progress bar
      const progressBarLength = 20;
      const filledBars = Math.floor((progressPercentage / 100) * progressBarLength);
      const emptyBars = progressBarLength - filledBars;
      const progressBar = '▓'.repeat(filledBars) + '░'.repeat(emptyBars);

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(targetUser.id === interaction.user.id ? 0x00d4aa : 0x7289da)
        .setTitle(`${targetUser.id === interaction.user.id ? 'Your' : `${targetUser.username}'s`} Level Info`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '⭐ Current Level', value: level.toString(), inline: true },
          { name: '📊 Total XP', value: (userData.total_xp || 0).toLocaleString(), inline: true },
          { name: '🏆 Server Rank', value: rankInfo.rank ? `#${rankInfo.rank}` : 'Unranked', inline: true },
          { name: '📈 Progress to Next Level', value: `${progressBar} ${progressPercentage}%`, inline: false },
          { name: '🎯 XP for Next Level', value: xpNeededForNext.toLocaleString(), inline: true },
          { name: '💫 XP in Current Level', value: xpInCurrentLevel.toLocaleString(), inline: true }
        )
        .setFooter({ 
          text: `${targetUser.username} • Keep chatting and joining voice to gain XP!` 
        })
        .setTimestamp();

      // Add message and voice XP breakdown if available
      if (userData.messageXp || userData.voiceXp) {
        embed.addFields({
          name: '📊 XP Breakdown',
          value: `💬 Messages: ${(userData.messageXp || 0).toLocaleString()}\n🎤 Voice: ${(userData.voiceXp || 0).toLocaleString()}`,
          inline: true
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in level command:', error);
      await interaction.editReply({ 
        content: 'An error occurred while fetching level information. Please try again later.',
        ephemeral: true 
      });
    }
  }
};
