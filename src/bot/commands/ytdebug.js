const { ytStats } = require('../services/youtube');

module.exports = {
  name: 'ytdebug',
  execute: async (interaction) => {
    const guild = interaction.guild;
    if(!guild){ return interaction.reply({ content:'Guild only.', flags:64 }); }
    const member = await guild.members.fetch(interaction.user.id).catch(()=>null);
    if(!member || !member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageGuild)){
      return interaction.reply({ content:'Manage Server permission required.', flags:64 });
    }
    const enabled = process.env.YT_DEBUG_EVENTS === '1';
    if(!enabled){
      return interaction.reply({ content:'Set YT_DEBUG_EVENTS=1 and restart to collect debug events.', flags:64 });
    }
    
    // Show basic stats first
    const stats = `**YouTube Watcher Statistics:**
Total Polls: ${ytStats.totalPolls}
Total Announcements: ${ytStats.totalAnnouncements}
Total Errors: ${ytStats.totalErrors}
API Calls: ${ytStats.apiCalls}
Quota Errors: ${ytStats.quotaErrors}
Last Poll: ${ytStats.lastPoll || 'Never'}

**Recent Events (latest last):**`;
    
    const lines = ytStats._debugEvents.slice(-15); // Show last 15 events to fit in Discord message
    if(!lines.length){
      return interaction.reply({ content: stats + '\nNo debug events recorded yet.', flags:64 });
    }
    
    const events = lines.join('\n');
    const msg = stats + '\n```\n' + events + '\n```';
    
    // Split if too long
    if(msg.length > 1900) {
      await interaction.reply({ content: stats, flags:64 });
      await interaction.followUp({ content: '```\n' + events + '\n```', flags:64 });
    } else {
      await interaction.reply({ content: msg, flags:64 });
    }
  }
};
