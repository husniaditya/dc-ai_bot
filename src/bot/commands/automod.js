const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'automod',
  execute: async (interaction) => {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: 64 });
    const store = require('../../config/store');
    const guildId = interaction.guild.id;
    const manageGuild = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

    try {
      switch(sub){
        case 'list': {
          const rules = await store.getGuildAutoModRules(guildId);
          if(!rules.length) return interaction.editReply('No automod rules configured.');
          const text = rules.slice(0,25).map(r=>`#${r.id} ${r.rule_name || r.name || 'rule'} ${r.enabled? '✅':'❌'}` ).join('\n');
          return interaction.editReply(text);
        }
        case 'toggle': {
          if(!manageGuild) return interaction.editReply('Missing Manage Server permission.');
          const id = interaction.options.getInteger('id');
            const enabled = interaction.options.getBoolean('enabled');
            await store.toggleGuildAutoModRule(guildId, id, enabled);
            return interaction.editReply(`Rule #${id} is now ${enabled? 'enabled':'disabled'}.`);
        }
        case 'info': {
          const id = interaction.options.getInteger('id');
          const rules = await store.getGuildAutoModRules(guildId);
          const r = rules.find(x=>x.id===id);
          if(!r) return interaction.editReply('Not found.');
          
          // Get rule type description and info based on documentation
          const getRuleInfo = (triggerType, actionType) => {
            const descriptions = {
              'spam': 'Detects repetitive or flooding messages based on message frequency and similarity thresholds',
              'caps': 'Controls excessive uppercase text by checking percentage of caps in messages',
              'links': 'Filters URLs and external links, with support for whitelisting and security scanning supported by VirusTotal, safebrowsing, and phishing detection',
              'invite_links': 'Blocks suspicious Discord invite links to prevent phising supported by VirusTotal, safebrowsing, and phishing detection',
              'profanity': 'Custom word and pattern filtering using regex patterns and blacklisted terms',
              'mention_spam': 'Prevents @everyone/@here abuse and excessive user mentions in messages'
            };
            
            const actionDescriptions = {
              'delete': 'Automatically delete violating messages',
              'warn': 'Send warning message to user and log violation',
              'mute': 'Temporarily restrict user from sending messages',
              'kick': 'Remove user from server for rule violation',
              'ban': 'Permanently ban user from server'
            };
            
            return {
              triggerDescription: descriptions[triggerType] || 'Custom automod rule',
              actionDescription: actionDescriptions[actionType] || 'Custom action'
            };
          };
          
          const ruleInfo = getRuleInfo(r.triggerType, r.actionType);
          
          const embed = new EmbedBuilder()
             .setTitle(`AutoMod Rule #${r.id}`)
             .setColor(r.enabled?0x57F287:0xED4245)
             .setDescription(ruleInfo.triggerDescription)
             .addFields(
                { name:'Rule Name', value: r.name || 'Unnamed Rule', inline:true },
                { name:'Trigger Type', value: r.triggerType || 'unknown', inline:true },
                { name:'Enabled', value: r.enabled? '✅ Yes':'❌ No', inline:true },
                { name:'Action Type', value: r.actionType || 'warn', inline:true },
                { name:'Threshold', value: (r.thresholdValue || 5).toString(), inline:true },
                { name:'Duration', value: r.duration ? `${r.duration} minutes` : 'N/A', inline:true }
             );
          
          // Add action description
          embed.addFields({ 
            name:'Action Description', 
            value: ruleInfo.actionDescription, 
            inline:false 
          });
          
          // Add additional info based on rule type
          if (r.triggerType === 'spam') {
            embed.addFields({ 
              name:'Spam Detection', 
              value: `• Message limit: ${r.thresholdValue || 5} messages\n• Time window: Variable\n• Duplicate detection: Enabled\n• Similarity threshold: 80%`, 
              inline:false 
            });
          } else if (r.triggerType === 'caps') {
            embed.addFields({ 
              name:'Caps Filter Settings', 
              value: `• Threshold: ${r.thresholdValue || 70}% uppercase\n• Minimum length: 10 characters\n• Bypass roles: Supported`, 
              inline:false 
            });
          } else if (r.triggerType === 'links') {
            embed.addFields({ 
              name:'Link Filter Features', 
              value: `• URL security scanning\n• Shortener detection\n• Phishing protection\n• VirusTotal integration\n• safebrowsing integration`, 
              inline:false 
            });
          } else if (r.triggerType === 'profanity') {
            embed.addFields({ 
              name:'Profanity Filter', 
              value: `• Custom word lists\n• Regex pattern matching\n• Severity levels\n• Language detection\n• Case sensitivity options`, 
              inline:false 
            });
          } else if (r.triggerType === 'mention_spam') {
            embed.addFields({ 
              name:'Mention Protection', 
              value: `• Max mentions: ${r.thresholdValue || 5}\n• @everyone/@here blocking\n• Role mention limits\n• Mass ping prevention`, 
              inline:false 
            });
          } else if (r.triggerType === 'invite_links') {
            embed.addFields({ 
              name:'Invite Link Control', 
              value: `• Discord invite detection\n• Server protection\n• Whitelist exceptions\n• Phishing protection\n• VirusTotal integration\n• safebrowsing integration\n• Pattern matching: discord.gg/*, discord.com/invite/*`, 
              inline:false 
            });
          }
          
          // Add bypass info if available
          if (r.whitelistRoles || r.whitelistChannels) {
            embed.addFields({ 
              name:'Bypass Configuration', 
              value: 'Trusted roles and channels can be exempted from this rule', 
              inline:false 
            });
          }
          
          embed.setTimestamp();
          embed.setFooter({ text: 'AutoMod System • See docs for full configuration options' });
          
          return interaction.editReply({ embeds:[embed] });
        }
        default:
          return interaction.editReply('Unknown subcommand.');
      }
    } catch(e){
      console.error('automod command error', e);
      return interaction.editReply('Error processing command.');
    }
  }
};
