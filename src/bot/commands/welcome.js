const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'welcome',
  execute: async (interaction) => {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: 64 });
    const store = require('../../config/store');
    const guildId = interaction.guild.id;
    const manageGuild = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

    try {
      switch(sub){
        case 'preview': {
          const cfg = await store.getGuildWelcome(guildId);
          if(!cfg.enabled) return interaction.editReply('Welcome system disabled.');
          const embed = new EmbedBuilder()
            .setTitle('Welcome Preview')
            .setColor(0xFEE75C)
            .setDescription(cfg.messageText?.slice(0,1900) || '(no message)')
            .addFields(
              { name:'Channel', value: cfg.channelId? `<#${cfg.channelId}>`:'(none)', inline:true },
              { name:'Type', value: cfg.messageType || 'text', inline:true },
              { name:'Card', value: cfg.cardEnabled? 'yes':'no', inline:true },
              { name:'DM Enabled', value: cfg.dmEnabled? 'yes':'no', inline:true }
            )
            .setTimestamp();
          return interaction.editReply({ embeds:[embed] });
        }
        case 'toggle': {
          if(!manageGuild) return interaction.editReply('Missing Manage Server permission.');
          const enabled = interaction.options.getBoolean('enabled');
          await store.setGuildWelcome(guildId, { enabled });
          return interaction.editReply(`Welcome system ${enabled? 'enabled':'disabled'}.`);
        }
        default:
          return interaction.editReply('Unknown subcommand.');
      }
    } catch(e){
      console.error('welcome command error', e);
      return interaction.editReply('Error processing command.');
    }
  }
};
