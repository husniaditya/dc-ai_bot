const { generateWelcomeCard } = require('../../utils/welcome-card-generator');

function setupGuildMemberAddHandler(client, store, startTimestamp, commandMap) {
  // Welcome event
  client.on('guildMemberAdd', async (member) => {
    try {
      const guildId = member.guild.id;
      const cfg = await store.getGuildWelcome(guildId);
      
      if (!cfg || cfg.enabled === false) return;
      
      // Handle auto-role assignment
      if (cfg.roleId) {
        try {
          const role = member.guild.roles.cache.get(cfg.roleId);
          if (role && role.position < member.guild.members.me?.roles.highest.position) {
            await member.roles.add(role);
          }
        } catch (roleError) {
          console.warn(`Failed to assign auto-role ${cfg.roleId} to ${member.id}:`, roleError.message);
        }
      }
      
      // Handle channel welcome message
      if (cfg.channelId) {
        const ch = member.guild.channels.cache.get(cfg.channelId);
        if (ch && ch.isTextBased()) {
          const msgText = (cfg.messageText && cfg.messageText.trim()) ? cfg.messageText
            .replace(/\{user\}/g, `<@${member.id}>`)
            .replace(/\{username\}/g, member.user.username)
            .replace(/\{server\}/g, member.guild.name)
            .replace(/\{memberCount\}/g, member.guild.memberCount.toString())
            // Channel mention support with improved emoji and special character handling
            .replace(/\{rules?\}/g, () => {
              const rulesChannel = member.guild.channels.cache.find(ch => {
                if (!ch.isTextBased()) return false;
                const cleanName = ch.name.toLowerCase()
                  .replace(/[^\w\s-]/g, '') // Keep hyphens for words like "server-rules"
                  .replace(/[-_]/g, ' '); // Convert hyphens and underscores to spaces
                return cleanName.includes('rule') || cleanName.includes('rules');
              });
              return rulesChannel ? `<#${rulesChannel.id}>` : '#rules';
            })
            .replace(/\{general\}/g, () => {
              const generalChannel = member.guild.channels.cache.find(ch => {
                if (!ch.isTextBased()) return false;
                const cleanName = ch.name.toLowerCase()
                  .replace(/[^\w\s-]/g, '') // Keep hyphens for words like "general-chat"
                  .replace(/[-_]/g, ' '); // Convert hyphens and underscores to spaces
                return cleanName.includes('general') || cleanName.includes('chat');
              });
              return generalChannel ? `<#${generalChannel.id}>` : '#general';
            })
            .replace(/\{welcome\}/g, () => {
              const welcomeChannel = member.guild.channels.cache.find(ch => {
                if (!ch.isTextBased()) return false;
                const cleanName = ch.name.toLowerCase()
                  .replace(/[^\w\s-]/g, '') // Keep hyphens for words like "welcome-here"
                  .replace(/[-_]/g, ' '); // Convert hyphens and underscores to spaces
                return cleanName.includes('welcome') || cleanName.includes('intro');
              });
              return welcomeChannel ? `<#${welcomeChannel.id}>` : '#welcome';
            })
            : `Welcome <@${member.id}>!`;
          
          if (cfg.messageType === 'embed') {
            const embed = { 
              title: 'Welcome!', 
              description: msgText, 
              color: 0x5865F2 
            };
            
            if (cfg.cardEnabled) {
              embed.thumbnail = { url: member.user.displayAvatarURL({ size: 128 }) };
              embed.footer = { text: `Member #${member.guild.memberCount}` };
            }
            
            await ch.send({ embeds: [embed] });
          } else {
            if (cfg.cardEnabled) {
              try {
                // Generate welcome card image with simple welcome text
                const cardBuffer = await generateWelcomeCard({
                  username: member.user.username,
                  avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                  guildName: member.guild.name,
                  memberCount: member.guild.memberCount,
                  welcomeText: "Welcome!" // Simple text for card, avoid database message
                });
                
                // Send message with card attachment
                await ch.send({ 
                  content: msgText,
                  files: [{
                    attachment: cardBuffer,
                    name: `welcome-${member.user.id}.png`
                  }]
                });
              } catch (cardError) {
                console.warn(`Failed to generate welcome card for ${member.id}:`, cardError.message);
                // Fallback to regular text message
                await ch.send(msgText);
              }
            } else {
              await ch.send(msgText);
            }
          }
        }
      }
      
      // Handle DM welcome message
      if (cfg.dmEnabled && cfg.dmMessage && cfg.dmMessage.trim()) {
        try {
          const dmText = cfg.dmMessage
            .replace(/\{user\}/g, `<@${member.id}>`)
            .replace(/\{username\}/g, member.user.username)
            .replace(/\{server\}/g, member.guild.name)
            .replace(/\{memberCount\}/g, member.guild.memberCount.toString())
            // Channel mention support for DMs with improved emoji and special character handling
            .replace(/\{rules?\}/g, () => {
              const rulesChannel = member.guild.channels.cache.find(ch => {
                if (!ch.isTextBased()) return false;
                const cleanName = ch.name.toLowerCase()
                  .replace(/[^\w\s-]/g, '') // Keep hyphens for words like "server-rules"
                  .replace(/[-_]/g, ' '); // Convert hyphens and underscores to spaces
                return cleanName.includes('rule') || cleanName.includes('rules');
              });
              return rulesChannel ? `<#${rulesChannel.id}>` : '#rules';
            })
            .replace(/\{general\}/g, () => {
              const generalChannel = member.guild.channels.cache.find(ch => {
                if (!ch.isTextBased()) return false;
                const cleanName = ch.name.toLowerCase()
                  .replace(/[^\w\s-]/g, '') // Keep hyphens for words like "general-chat"
                  .replace(/[-_]/g, ' '); // Convert hyphens and underscores to spaces
                return cleanName.includes('general') || cleanName.includes('chat');
              });
              return generalChannel ? `<#${generalChannel.id}>` : '#general';
            })
            .replace(/\{welcome\}/g, () => {
              const welcomeChannel = member.guild.channels.cache.find(ch => {
                if (!ch.isTextBased()) return false;
                const cleanName = ch.name.toLowerCase()
                  .replace(/[^\w\s-]/g, '') // Keep hyphens for words like "welcome-here"
                  .replace(/[-_]/g, ' '); // Convert hyphens and underscores to spaces
                return cleanName.includes('welcome') || cleanName.includes('intro');
              });
              return welcomeChannel ? `<#${welcomeChannel.id}>` : '#welcome';
            });
          
          await member.send(dmText);
        } catch (dmError) {
          console.warn(`Failed to send DM welcome to ${member.id}:`, dmError.message);
        }
      }
    } catch(e) { 
      console.error('Guild member add handler error:', e);
    }
  });
}

module.exports = setupGuildMemberAddHandler;
