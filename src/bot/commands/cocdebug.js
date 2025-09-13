const { cocStats } = require('../services/clashofclans');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ClashOfClansAPI = require('../services/ClashOfClansAPI');

module.exports = {
  name: 'cocdebug',
  data: new SlashCommandBuilder()
    .setName('cocdebug')
    .setDescription('Debug Clash of Clans API configuration and status')
    .addStringOption(option =>
      option.setName('clan')
        .setDescription('Test a specific clan tag (optional)')
        .setRequired(false)
    ),
  execute: async (interaction) => {
    // Defer immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });
    
    const guild = interaction.guild;
    if(!guild){ 
      return interaction.editReply({ content:'Guild only.' }); 
    }
    
    // Use the member from the interaction instead of fetching (faster)
    const member = interaction.member;
    if(!member || !member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageGuild)){
      return interaction.editReply({ content:'Manage Server permission required.' });
    }
    
    try {
      const testClan = interaction.options.getString('clan');
      
      // Create API instance
      const api = new ClashOfClansAPI();
      
      // Check API key configuration
      const hasApiKey = !!(process.env.COC_API_KEY || process.env.COC_API_TOKEN);
      const apiKey = process.env.COC_API_KEY || process.env.COC_API_TOKEN;
      const apiKeyMasked = hasApiKey ? `${apiKey.substring(0, 8)}...` : 'Not set';
      const keySource = process.env.COC_API_KEY ? 'COC_API_KEY' : process.env.COC_API_TOKEN ? 'COC_API_TOKEN' : 'None';
      
      const embed = new EmbedBuilder()
        .setTitle('🔧 Clash of Clans Debug Information')
        .setColor('#f39c12')
        .addFields([
          {
            name: '🔑 API Configuration',
            value: `**API Key:** ${apiKeyMasked}\n**Source:** ${keySource}\n**Status:** ${hasApiKey ? '✅ Configured' : '❌ Missing'}`,
            inline: true
          },
          {
            name: '📊 Service Statistics',
            value: `**Total Polls:** ${cocStats.totalPolls}\n**API Calls:** ${cocStats.apiCalls}\n**Errors:** ${cocStats.totalErrors}`,
            inline: true
          }
        ]);

      // Test API if key is configured
      if (hasApiKey) {
        if (testClan) {
          try {
            embed.addFields([
              { name: '🧪 Testing Clan...', value: `Testing clan: ${testClan}`, inline: false }
            ]);
            
            await interaction.editReply({ embeds: [embed] });
            
            // Test the specific clan
            const clanData = await api.getClan(testClan);
            
            embed.addFields([
              {
                name: '✅ Clan Test Success',
                value: `**Name:** ${clanData.name}\n**Tag:** ${clanData.tag}\n**Members:** ${clanData.memberCount}/${clanData.size}\n**Level:** ${clanData.clanLevel}`,
                inline: false
              }
            ]);
            
            // Test donation data
            const donationData = await api.getClanDonationData(testClan, 'current_season');
            embed.addFields([
              {
                name: '📊 Donation Data',
                value: `**Players:** ${donationData.players.length}\n**Total Donations:** ${donationData.players.reduce((sum, p) => sum + (p.donations || 0), 0)}`,
                inline: false
              }
            ]);
            
          } catch (testError) {
            embed.addFields([
              {
                name: '❌ Clan Test Failed',
                value: `**Error:** ${testError.message}\n**Clan:** ${testClan}`,
                inline: false
              }
            ]);
            
            if (testError.message.includes('API key invalid')) {
              embed.addFields([
                {
                  name: '🔧 Fix API Key Issue',
                  value: '1. Visit https://developer.clashofclans.com\n2. Create/update your API key\n3. Ensure it includes this server\'s IP\n4. Set COC_API_KEY **or** COC_API_TOKEN environment variable\n5. Restart the bot',
                  inline: false
                }
              ]);
            }
          }
        } else {
          // No specific clan to test, just check API connectivity
          try {
            // Try a basic API call (get a well-known clan)
            await api.getClan('#2PP');
            embed.addFields([
              { name: '✅ API Connection', value: 'API key is working correctly', inline: false }
            ]);
          } catch (apiError) {
            embed.addFields([
              {
                name: '❌ API Connection Failed',
                value: `**Error:** ${apiError.message}`,
                inline: false
              }
            ]);
          }
        }
      } else {
        embed.addFields([
          {
            name: '❌ API Key Missing',
            value: 'Set COC_API_KEY or COC_API_TOKEN environment variable and restart the bot.',
            inline: false
          }
        ]);
      }
      
      // Get comprehensive stats from the service module
      const cocService = require('../services/clashofclans');
      const fullStats = cocService.getCOCStats ? cocService.getCOCStats() : null;
      
      if (fullStats) {
        embed.addFields([
          {
            name: '📈 Extended Stats',
            value: `**State Keys:** ${fullStats.stateKeys || 0}\n**Cache Hits:** ${cocStats.cacheHits || 0}\n**Last Poll:** ${cocStats.lastPoll || 'Never'}`,
            inline: false
          }
        ]);
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('cocdebug error:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Debug Error')
        .setDescription(`Failed to gather debug information: ${error.message}`)
        .setColor('#e74c3c');
        
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};