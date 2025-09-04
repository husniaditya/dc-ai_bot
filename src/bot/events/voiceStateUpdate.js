const XPHandler = require('../handlers/xpHandler');

module.exports = (client, store) => {
  const xpHandler = new XPHandler(store);
  
  // Track users in voice channels for XP
  const voiceTracking = new Map(); // userId -> { joinedAt, channelId }
  
  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      const userId = newState.id || oldState.id;
      const guildId = newState.guild?.id || oldState.guild?.id;
      
      if (!guildId || !userId) return;
      
      // User joined a voice channel
      if (!oldState.channelId && newState.channelId) {
        // Start tracking this user
        voiceTracking.set(userId, {
          joinedAt: Date.now(),
          channelId: newState.channelId,
          guildId: guildId
        });
        console.log(`[VOICE XP] User ${userId} joined voice channel ${newState.channelId}`);
      }
      
      // User left a voice channel
      else if (oldState.channelId && !newState.channelId) {
        const tracking = voiceTracking.get(userId);
        if (tracking) {
          // Calculate time spent in voice
          const timeSpent = Date.now() - tracking.joinedAt;
          const minutesSpent = Math.floor(timeSpent / (1000 * 60));
          
          // Award XP if they were in voice for at least 1 minute
          if (minutesSpent >= 1) {
            await awardVoiceXP(guildId, userId, minutesSpent, store);
          }
          
          voiceTracking.delete(userId);
          console.log(`[VOICE XP] User ${userId} left voice channel after ${minutesSpent} minutes`);
        }
      }
      
      // User switched voice channels
      else if (oldState.channelId !== newState.channelId && oldState.channelId && newState.channelId) {
        const tracking = voiceTracking.get(userId);
        if (tracking) {
          // Calculate time in previous channel
          const timeSpent = Date.now() - tracking.joinedAt;
          const minutesSpent = Math.floor(timeSpent / (1000 * 60));
          
          // Award XP for previous channel if they were there for at least 1 minute
          if (minutesSpent >= 1) {
            await awardVoiceXP(guildId, userId, minutesSpent, store);
          }
          
          // Update tracking for new channel
          tracking.joinedAt = Date.now();
          tracking.channelId = newState.channelId;
          console.log(`[VOICE XP] User ${userId} switched to voice channel ${newState.channelId}`);
        }
      }
    } catch (error) {
      console.error('Error in voice state update:', error);
    }
  });
  
  // Periodic XP award for users still in voice (every 5 minutes)
  setInterval(async () => {
    try {
      const now = Date.now();
      const voiceXpInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      for (const [userId, tracking] of voiceTracking.entries()) {
        const timeSinceJoin = now - tracking.joinedAt;
        
        // Award XP every 5 minutes
        if (timeSinceJoin >= voiceXpInterval) {
          const minutesToAward = Math.floor(timeSinceJoin / (1000 * 60));
          
          // Award XP for the time spent
          await awardVoiceXP(tracking.guildId, userId, minutesToAward, store);
          
          // Update the join time to now (reset the clock)
          tracking.joinedAt = now;
        }
      }
    } catch (error) {
      console.error('Error in periodic voice XP award:', error);
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
};

/**
 * Award voice XP to a user
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID  
 * @param {number} minutes - Minutes spent in voice
 * @param {Object} store - Database store
 */
async function awardVoiceXP(guildId, userId, minutes, store) {
  try {
    // Get XP settings for this guild
    const xpSettings = await store.getGuildXpSettings(guildId);
    
    // Check if XP system is enabled
    if (!xpSettings.enabled) return;
    
    // Calculate XP (default 5 XP per minute)
    const xpPerMinute = xpSettings.xpPerVoiceMinute || 5;
    const xpAmount = minutes * xpPerMinute;
    
    if (xpAmount <= 0) return;
    
    // Get current user XP to check for level up
    const currentData = await store.getUserXp(guildId, userId);
    const oldLevel = calculateLevel(currentData.totalXp || 0);
    
    // Award XP
    const result = await store.addUserXp(guildId, userId, xpAmount, 'voice');
    const newLevel = calculateLevel(result.totalXp);
    
    console.log(`[VOICE XP] Awarded ${xpAmount} XP to user ${userId} for ${minutes} minutes in voice`);
    
    // Check for level up
    if (newLevel > oldLevel) {
      // Get guild to send level up message
      const client = require('discord.js').Client;
      const guild = client?.guilds?.cache?.get(guildId);
      
      if (guild) {
        // Find a suitable channel to send the level up message
        let targetChannel = null;
        
        // Try to use configured level up channel
        if (xpSettings.levelUpChannel) {
          targetChannel = guild.channels.cache.get(xpSettings.levelUpChannel);
        }
        
        // Fallback to general channel
        if (!targetChannel) {
          targetChannel = guild.channels.cache.find(channel => 
            channel.name.includes('general') && 
            channel.isTextBased() && 
            channel.permissionsFor(guild.members.me).has('SendMessages')
          );
        }
        
        // Fallback to any text channel
        if (!targetChannel) {
          targetChannel = guild.channels.cache.find(channel => 
            channel.isTextBased() && 
            channel.permissionsFor(guild.members.me).has('SendMessages')
          );
        }
        
        if (targetChannel && xpSettings.levelUpMessages) {
          try {
            const user = await guild.members.fetch(userId);
            const { EmbedBuilder } = require('discord.js');
            
            const embed = new EmbedBuilder()
              .setColor(0x9c27b0) // Purple for voice level up
              .setTitle('🎤 Voice Level Up!')
              .setDescription(`Congratulations <@${userId}>! You've reached **Level ${newLevel}** through voice activity!`)
              .addFields(
                { name: '📊 Total XP', value: result.totalXp.toLocaleString(), inline: true },
                { name: '⭐ Current Level', value: newLevel.toString(), inline: true },
                { name: '🎯 XP to Next Level', value: (getXpForLevel(newLevel + 1) - result.totalXp).toLocaleString(), inline: true }
              )
              .setThumbnail(user.displayAvatarURL({ dynamic: true }))
              .setFooter({ text: 'Stay active in voice channels to gain more XP!' })
              .setTimestamp();

            await targetChannel.send({ embeds: [embed] });
            
            // Handle level rewards
            await handleVoiceLevelRewards(guild, user, newLevel, store, xpSettings);
            
          } catch (error) {
            console.error('Error sending voice level up message:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error awarding voice XP:', error);
  }
}

/**
 * Handle level rewards for voice level ups
 */
async function handleVoiceLevelRewards(guild, member, level, store, xpSettings) {
  try {
    const rewards = await store.getGuildLevelRewards(guild.id);
    const levelRewards = rewards.filter(reward => reward.level === level);
    
    for (const reward of levelRewards) {
      try {
        const role = guild.roles.cache.get(reward.roleId);
        if (!role) continue;
        
        await member.roles.add(role);
        
        // Send role reward notification
        let targetChannel = null;
        if (xpSettings.levelUpChannel) {
          targetChannel = guild.channels.cache.get(xpSettings.levelUpChannel);
        }
        
        if (!targetChannel) {
          targetChannel = guild.channels.cache.find(channel => 
            channel.isTextBased() && 
            channel.permissionsFor(guild.members.me).has('SendMessages')
          );
        }
        
        if (targetChannel) {
          const { EmbedBuilder } = require('discord.js');
          
          const roleEmbed = new EmbedBuilder()
            .setColor(role.color || 0x9c27b0)
            .setTitle('🏆 Voice Level Reward!')
            .setDescription(`You've been awarded the **${role.name}** role for reaching Level ${level} through voice activity!`)
            .setThumbnail(member.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Voice Level Reward System' })
            .setTimestamp();

          await targetChannel.send({ embeds: [roleEmbed] });
        }
        
        console.log(`[VOICE XP] Awarded role ${role.name} to ${member.user.tag} for voice level ${level}`);
        
      } catch (roleError) {
        console.error(`Error awarding voice level role:`, roleError);
      }
    }
  } catch (error) {
    console.error('Error handling voice level rewards:', error);
  }
}

/**
 * Calculate level from total XP
 */
function calculateLevel(totalXp) {
  if (totalXp < 0) return 1;
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}

/**
 * Calculate XP needed for a specific level
 */
function getXpForLevel(level) {
  if (level <= 1) return 0;
  return Math.pow(level - 1, 2) * 100;
}
