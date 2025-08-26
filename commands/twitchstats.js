const { getTwitchDebugEvents } = require('../twitch-watcher');

module.exports = {
  name: 'twitchstats',
  execute: async (interaction) => {
    const guild = interaction.guild;
    if(!guild){ return interaction.reply({ content:'Guild only.', flags:64 }); }
    const member = await guild.members.fetch(interaction.user.id).catch(()=>null);
    if(!member || !member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageGuild)){
      return interaction.reply({ content:'Manage Server permission required.', flags:64 });
    }
    
    const events = getTwitchDebugEvents();
    const totalEvents = events.length;
    const errors = events.filter(e => e.type === 'error').length;
    const warnings = events.filter(e => e.type === 'warn').length;
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;
    
    const lines = [
      `**Twitch Watcher Statistics:**`,
      `Total Events: ${totalEvents}`,
      `Errors: ${errors}`,
      `Warnings: ${warnings}`,
      `Last Event: ${lastEvent ? lastEvent.time : 'Never'}`,
      `Check Interval: ${process.env.TWITCH_CHECK_INTERVAL_SEC || '300'}s`,
      `Debug Mode: ${process.env.TWITCH_DEBUG === '1' ? 'Enabled' : 'Disabled'}`
    ];
    
    await interaction.reply({ content: lines.join('\n'), flags: 64 });
  }
};
