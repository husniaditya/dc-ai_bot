const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'xpadmin',
  description: 'XP administration commands (Manage Server required)',
  
  async execute(interaction, store) {
    // Check if user has Manage Server permission
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '❌ You need the "Manage Server" permission to use XP admin commands.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!targetUser) {
      return interaction.reply({
        content: '❌ Please specify a user.',
        ephemeral: true
      });
    }

    try {
      await interaction.deferReply();

      switch (subcommand) {
        case 'give':
          await store.addUserXp(interaction.guild.id, targetUser.id, amount);
          
          const newDataGive = await store.getUserXp(interaction.guild.id, targetUser.id);
          
          const giveEmbed = new EmbedBuilder()
            .setTitle('✅ XP Given')
            .setDescription(`Successfully gave **${amount} XP** to ${targetUser}`)
            .addFields(
              { name: 'New XP', value: newDataGive.total_xp.toString(), inline: true },
              { name: 'New Level', value: newDataGive.level.toString(), inline: true },
              { name: 'Reason', value: reason, inline: false }
            )
            .setColor(0x00ff00)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [giveEmbed] });
          break;

        case 'remove':
          await store.removeUserXp(interaction.guild.id, targetUser.id, amount);
          
          const newDataRemove = await store.getUserXp(interaction.guild.id, targetUser.id);
          
          const removeEmbed = new EmbedBuilder()
            .setTitle('✅ XP Removed')
            .setDescription(`Successfully removed **${amount} XP** from ${targetUser}`)
            .addFields(
              { name: 'New XP', value: newDataRemove.total_xp.toString(), inline: true },
              { name: 'New Level', value: newDataRemove.level.toString(), inline: true },
              { name: 'Reason', value: reason, inline: false }
            )
            .setColor(0xff9900)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [removeEmbed] });
          break;

        case 'set':
          await store.setUserXp(interaction.guild.id, targetUser.id, amount);
          
          const newDataSet = await store.getUserXp(interaction.guild.id, targetUser.id);
          
          const setEmbed = new EmbedBuilder()
            .setTitle('✅ XP Set')
            .setDescription(`Successfully set ${targetUser}'s XP to **${amount}**`)
            .addFields(
              { name: 'XP', value: newDataSet.total_xp.toString(), inline: true },
              { name: 'Level', value: newDataSet.level.toString(), inline: true },
              { name: 'Reason', value: reason, inline: false }
            )
            .setColor(0x0099ff)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [setEmbed] });
          break;

        case 'reset':
          const confirm = interaction.options.getString('confirm');
          
          if (confirm !== 'CONFIRM') {
            return interaction.editReply({
              content: '❌ You must type "CONFIRM" to reset a user\'s XP. This action cannot be undone.'
            });
          }

          await store.setUserXp(interaction.guild.id, targetUser.id, 0);
          
          const resetEmbed = new EmbedBuilder()
            .setTitle('✅ XP Reset')
            .setDescription(`Successfully reset ${targetUser}'s XP and level`)
            .addFields(
              { name: 'XP', value: '0', inline: true },
              { name: 'Level', value: '1', inline: true },
              { name: 'Reason', value: reason, inline: false }
            )
            .setColor(0xff0000)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [resetEmbed] });
          break;

        default:
          await interaction.editReply('❌ Invalid subcommand.');
      }

    } catch (error) {
      console.error('Error in xpadmin command:', error);
      
      const errorMessage = interaction.deferred 
        ? { content: '❌ An error occurred while managing XP.' }
        : { content: '❌ An error occurred while managing XP.', ephemeral: true };
      
      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
