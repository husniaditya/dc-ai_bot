const { cocStats } = require('../services/clashofclans');

module.exports = {
  name: 'cocdebug',
  execute: async (interaction) => {
    // Defer immediately to prevent timeout
    await interaction.deferReply({ flags: 64 });
    
    const guild = interaction.guild;
    if(!guild){ 
      return interaction.editReply({ content:'Guild only.' }); 
    }
    
    // Use the member from the interaction instead of fetching (faster)
    const member = interaction.member;
    if(!member || !member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageGuild)){
      return interaction.editReply({ content:'Manage Server permission required.' });
    }
    
    const enabled = process.env.COC_DEBUG_EVENTS === '1';
    if(!enabled){
      return interaction.editReply({ content:'Set COC_DEBUG_EVENTS=1 and restart to collect debug events.' });
    }
    
    try {
      // Get comprehensive stats from the service module
      const cocService = require('../services/clashofclans');
      const fullStats = cocService.getCOCStats ? cocService.getCOCStats() : null;
      
      // Show basic stats first
      let stats = `**Clash of Clans Watcher Statistics:**
      Total Polls: ${cocStats.totalPolls}
      Total Announcements: ${cocStats.totalAnnouncements}
      Total Errors: ${cocStats.totalErrors}
      API Calls: ${cocStats.apiCalls}
      Quota Errors: ${cocStats.quotaErrors}
      Last Poll: ${cocStats.lastPoll || 'Never'}

      **API Status:**
      Has API Token: ${fullStats?.hasApiToken ? 'Yes' : 'No'}
      State Keys: ${fullStats?.stateKeys || 0}

      **Detailed Breakdown:**
      Clan API Calls: ${cocStats.clanApiCalls}
      Members Calls: ${cocStats.membersCalls}
      War Calls: ${cocStats.warCalls}
      Cache Hits: ${cocStats.cacheHits}`;

      stats += `
      **Recent Events (latest last):**`;
      
      const lines = cocStats._debugEvents.slice(-15); // Show last 15 events to fit in Discord message
      if(!lines.length){
        return await interaction.editReply({ content: stats + '\nNo debug events recorded yet.' });
      }
      
      const events = lines.join('\n');
      const msg = stats + '\n```\n' + events + '\n```';
      
      // Send the response (handle splitting carefully)
      try {
        if(msg.length > 1900) {
          // Send stats first
          await interaction.editReply({ content: stats });
          
          // Prepare events message
          let eventMsg = '```\n' + events + '\n```';
          if (eventMsg.length > 1900) {
            const truncatedEvents = events.substring(0, 1800) + '\n... (truncated)';
            eventMsg = '```\n' + truncatedEvents + '\n```';
          }
          
          // Send events as follow-up
          await interaction.followUp({ content: eventMsg, flags:64 });
        } else {
          // Send everything in one message
          await interaction.editReply({ content: msg });
        }
      } catch (sendError) {
        console.error('Error sending cocdebug response:', sendError);
        // If we can still edit reply, send a simple error message
        try {
          await interaction.editReply({ content: 'Error displaying debug information.' });
        } catch (fallbackError) {
          console.error('Failed to send fallback error message:', fallbackError);
        }
        throw sendError; // Re-throw to trigger main catch block
      }
      
    } catch (error) {
      console.error('cocdebug error:', error);
      // Try to edit the deferred reply with an error message
      try {
        await interaction.editReply({ content: 'An error occurred while retrieving debug information.' });
      } catch (editError) {
        console.error('Failed to edit reply with error message:', editError);
      }
    }
  }
};