const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'antiraid',
  execute: async (interaction) => {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: 64 });
    const store = require('../../config/store');
    const guildId = interaction.guild.id;
    const manageGuild = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

    try {
      switch(sub){
        case 'status': {
          const cfg = await store.getGuildAntiRaidSettings(guildId);
          const embed = new EmbedBuilder()
            .setTitle('Anti-Raid Status')
            .setColor(cfg.enabled?0x57F287:0xED4245)
            .addFields(
              { name:'Enabled', value: cfg.enabled? 'yes':'no', inline:true },
              { name:'Join Rate Limit', value: (cfg.joinRate||0) + ' joins', inline:true },
              { name:'Join Rate Window', value: (cfg.joinWindow||0) + 's', inline:true },
              { name:'Account Age Limit', value: (cfg.accountAge||0) + ' days', inline:true },
              { name:'Auto Lockdown', value: cfg.autoLockdown? 'yes':'no', inline:true },
              { name:'Auto Kick', value: cfg.autoKick? 'yes':'no', inline:true },
              { name:'Lockdown Duration', value: (cfg.lockdownDuration||0)+'m', inline:true },
              { name:'Alert Channel', value: cfg.alertChannel? `<#${cfg.alertChannel}>`:'(none)', inline:true },
              { name:'Raid Action', value: cfg.raidAction || 'lockdown', inline:true },
              { name:'Raid Action Duration', value: (cfg.raidActionDuration||0)+'m', inline:true },
              { name:'Delete Spam Invites', value: cfg.deleteInviteSpam? 'yes':'no', inline:true },
              { name:'Grace Period', value: (cfg.gracePeriod||0) + ' days', inline:true }
            )
            .setTimestamp();
          if (cfg.bypassRoles && cfg.bypassRoles.length > 0) {
            embed.addFields({ name:'Bypass Roles', value: cfg.bypassRoles.map(r => `<@&${r}>`).join(', '), inline:false });
          }
          return interaction.editReply({ embeds:[embed] });
        }
        case 'toggle': {
          if (!manageGuild) return interaction.editReply('Missing Manage Server permission.');
          const enabled = interaction.options.getBoolean('enabled');
          const current = await store.getGuildAntiRaidSettings(guildId);
          await store.updateGuildAntiRaidSettings(guildId, { enabled });
          return interaction.editReply(`Anti-raid is now ${enabled? 'enabled':'disabled'}.`);
        }
        default:
          return interaction.editReply('Unknown subcommand.');
      }
    } catch(e){
      console.error('antiraid command error', e);
      return interaction.editReply('Error processing command.');
    }
  }
};
