const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const XPHandler = require('../handlers/xpHandler');

module.exports = {
  name: 'xp',
  description: 'Manage user XP (Admin only)',
  slash: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Manage user XP (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add XP to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to add XP to')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Amount of XP to add')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10000)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove XP from a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to remove XP from')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Amount of XP to remove')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10000)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set a user\'s total XP')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to set XP for')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Total XP to set')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100000)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Reset a user\'s XP to 0')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to reset XP for')
            .setRequired(true)
        )
    ),

  async execute(interaction, store) {
    try {
      // Check permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return await interaction.reply({ 
          content: 'You need the "Manage Server" permission to use this command.',
          ephemeral: true 
        });
      }

      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();
      const targetUser = interaction.options.getUser('user');
      const guildId = interaction.guild.id;
      const userId = targetUser.id;
      
      // Create XP handler instance
      const xpHandler = new XPHandler(store);

      // Get current user data
      const currentData = await store.getUserXp(guildId, userId);
      const currentLevel = xpHandler.calculateLevel(currentData.totalXp || 0);

      let newTotalXp;
      let actionDescription;

      switch (subcommand) {
        case 'add':
          const addAmount = interaction.options.getInteger('amount');
          const addResult = await store.addUserXp(guildId, userId, addAmount, 'admin_add');
          newTotalXp = addResult.totalXp;
          actionDescription = `Added ${addAmount.toLocaleString()} XP`;
          break;

        case 'remove':
          const removeAmount = interaction.options.getInteger('amount');
          const currentXp = currentData.totalXp || 0;
          const newXp = Math.max(0, currentXp - removeAmount);
          
          // Reset user XP and set to new amount
          await store.resetUserXp(guildId, userId);
          if (newXp > 0) {
            const setResult = await store.addUserXp(guildId, userId, newXp, 'admin_set');
            newTotalXp = setResult.totalXp;
          } else {
            newTotalXp = 0;
          }
          
          actionDescription = `Removed ${removeAmount.toLocaleString()} XP`;
          break;

        case 'set':
          const setAmount = interaction.options.getInteger('amount');
          await store.resetUserXp(guildId, userId);
          
          if (setAmount > 0) {
            const setResult = await store.addUserXp(guildId, userId, setAmount, 'admin_set');
            newTotalXp = setResult.totalXp;
          } else {
            newTotalXp = 0;
          }
          
          actionDescription = `Set total XP to ${setAmount.toLocaleString()}`;
          break;

        case 'reset':
          await store.resetUserXp(guildId, userId);
          newTotalXp = 0;
          actionDescription = 'Reset XP to 0';
          break;

        default:
          return await interaction.editReply({
            content: 'Invalid subcommand.',
            ephemeral: true
          });
      }

      const newLevel = xpHandler.calculateLevel(newTotalXp);
      const levelChanged = newLevel !== currentLevel;

      // Create response embed
      const embed = new EmbedBuilder()
        .setColor(levelChanged ? (newLevel > currentLevel ? 0x00ff00 : 0xff9500) : 0x7289da)
        .setTitle('✅ XP Management')
        .setDescription(`${actionDescription} for ${targetUser}`)
        .addFields(
          { name: 'Previous Level', value: currentLevel.toString(), inline: true },
          { name: 'New Level', value: newLevel.toString(), inline: true },
          { name: 'Total XP', value: newTotalXp.toLocaleString(), inline: true }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Action performed by ${interaction.user.username}` })
        .setTimestamp();

      if (levelChanged) {
        const levelChange = newLevel - currentLevel;
        embed.addFields({
          name: 'Level Change',
          value: `${levelChange > 0 ? '+' : ''}${levelChange} level${Math.abs(levelChange) !== 1 ? 's' : ''}`,
          inline: true
        });
      }

      await interaction.editReply({ embeds: [embed] });

      // Log the action
      console.log(`[XP ADMIN] ${interaction.user.tag} ${actionDescription.toLowerCase()} for ${targetUser.tag} in ${interaction.guild.name}`);

    } catch (error) {
      console.error('Error in XP admin command:', error);
      await interaction.editReply({ 
        content: 'An error occurred while managing XP. Please try again later.',
        ephemeral: true 
      });
    }
  }
};
