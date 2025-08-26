const { getTwitchDebugEvents } = require('../services/twitch');

module.exports = {
  name: 'twitchdebug',
  execute: async (interaction) => {
    const guild = interaction.guild;
    if(!guild){ return interaction.reply({ content:'Guild only.', flags:64 }); }
    const member = await guild.members.fetch(interaction.user.id).catch(()=>null);
    if(!member || !member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageGuild)){
      return interaction.reply({ content:'Manage Server permission required.', flags:64 });
    }
    
    const events = getTwitchDebugEvents();
    if(!events.length){
      return interaction.reply({ content:'No Twitch debug events recorded yet.', flags:64 });
    }
    
    // Show basic stats first
    const errors = events.filter(e => e.type === 'error').length;
    const warnings = events.filter(e => e.type === 'warn').length;
    const stats = `**Twitch Watcher Debug Events:**
Total Events: ${events.length}
Errors: ${errors}
Warnings: ${warnings}
Debug Mode: ${process.env.TWITCH_DEBUG === '1' ? 'Enabled' : 'Disabled'}

**Recent Events (latest last):**`;
    
    const lines = events.slice(-15).map(e => `[${e.time.slice(11,19)}] ${e.type.toUpperCase()}: ${e.message}`);
    const eventsText = lines.join('\n');
    const msg = stats + '\n```\n' + eventsText + '\n```';
    
    // Split if too long
    if(msg.length > 1900) {
      await interaction.reply({ content: stats, flags:64 });
      await interaction.followUp({ content: '```\n' + eventsText + '\n```', flags:64 });
    } else {
      await interaction.reply({ content: msg, flags:64 });
    }
  }
};
