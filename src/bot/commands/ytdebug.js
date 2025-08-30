const { ytStats } = require('../services/youtube');

module.exports = {
  name: 'ytdebug',
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
    
    const enabled = process.env.YT_DEBUG_EVENTS === '1';
    if(!enabled){
      return interaction.editReply({ content:'Set YT_DEBUG_EVENTS=1 and restart to collect debug events.' });
    }
    
    try {
      // Get comprehensive stats from the service module
      const youtubeService = require('../services/youtube');
      const fullStats = youtubeService.getYouTubeStats ? youtubeService.getYouTubeStats() : null;
      const keyStatus = fullStats?.keyStatus || youtubeService.getKeyStatus?.() || { totalKeys: 'Unknown', currentKey: 'Unknown', exhaustedKeys: 'Unknown' };
      
      // Show basic stats first
      let stats = `**YouTube Watcher Statistics:**
      Total Polls: ${ytStats.totalPolls}
      Total Announcements: ${ytStats.totalAnnouncements}
      Total Errors: ${ytStats.totalErrors}
      API Calls: ${ytStats.apiCalls}
      Quota Errors: ${ytStats.quotaErrors}
      Last Poll: ${ytStats.lastPoll || 'Never'}

      **API Key Status:**
      Total Keys: ${keyStatus.totalKeys}
      Current Key: ${keyStatus.currentKey}
      Exhausted Keys: ${keyStatus.exhaustedKeys}`;

      // Add WebSub stats if available
      if (fullStats?.websub) {
        const ws = fullStats.websub;
        stats += `
        **WebSub (Real-time) Status:**
        Enabled: ${ws.enabled !== false ? 'Yes' : 'No'}
        Active Subscriptions: ${ws.activeSubscriptions || 0}
        Total Channels: ${ws.totalChannels || 0}
        Notifications Received: ${ws.notifications || 0}
        Subscriptions Made: ${ws.subscriptions || 0}
        Unsubscriptions Made: ${ws.unsubscriptions || 0}
        Verifications: ${ws.verifications || 0}
        Last Notification: ${ws.lastNotification || 'Never'}`;
      } else {
        stats += `
        **WebSub (Real-time) Status:**
        Enabled: No
        Mode: Polling Only`;
      }

      stats += `
      **Recent Events (latest last):**`;
      
      const lines = ytStats._debugEvents.slice(-15); // Show last 15 events to fit in Discord message
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
        console.error('Error sending ytdebug response:', sendError);
        // If we can still edit reply, send a simple error message
        try {
          await interaction.editReply({ content: 'Error displaying debug information.' });
        } catch (fallbackError) {
          console.error('Failed to send fallback error message:', fallbackError);
        }
        throw sendError; // Re-throw to trigger main catch block
      }
      
    } catch (error) {
      console.error('ytdebug error:', error);
      // Try to edit the deferred reply with an error message
      try {
        await interaction.editReply({ content: 'An error occurred while retrieving debug information.' });
      } catch (editError) {
        console.error('Failed to edit reply with error message:', editError);
      }
    }
  }
};
