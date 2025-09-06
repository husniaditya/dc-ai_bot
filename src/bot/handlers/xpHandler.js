const { EmbedBuilder } = require('discord.js');

/**
 * XP Handler - Manages XP gain, level calculations, and level-up messages
 */
class XPHandler {
  constructor(store) {
    this.store = store;
    this.userCooldowns = new Map(); // userId -> lastXpGain timestamp
  }

  /**
   * Process a message for XP gain
   * @param {Message} message - Discord message object
   */
  async processMessage(message) {
    try {
      // Ignore bots and DM messages
      if (!message.guild || message.author.bot) return;

      const guildId = message.guild.id;
      const userId = message.author.id;

      // Get XP settings for this guild
      const xpSettings = await this.store.getGuildXpSettings(guildId);
      
      // Check if XP system is enabled
      if (!xpSettings.enabled) return;

      // Check cooldown
      if (this.isOnCooldown(userId, xpSettings.cooldownSeconds || 60)) return;

      // Check if channel is ignored
      if (this.isChannelIgnored(message.channel.id, xpSettings.excludedChannels)) return;

      // Check if user has ignored role
      if (this.hasIgnoredRole(message.member, xpSettings.excludedRoles)) return;

      // Calculate XP to award
      const xpAmount = this.calculateMessageXP(message, xpSettings);
      
      // Award XP and check for level up
      const result = await this.awardXP(guildId, userId, xpAmount, 'message');
      
      // Send level up message if user leveled up
      if (result.leveledUp) {
        await this.sendLevelUpMessage(message, result);
        
        // Check for level rewards
        await this.handleLevelRewards(message, result.newLevel);
      }

      // Update cooldown
      this.updateCooldown(userId);

    } catch (error) {
      console.error('Error processing XP for message:', error);
    }
  }

  /**
   * Process voice activity for XP gain
   * @param {VoiceState} oldState - Previous voice state
   * @param {VoiceState} newState - New voice state
   */
  async processVoiceActivity(oldState, newState) {
    try {
      // This will be called periodically for users in voice channels
      // Implementation would track voice time and award XP
      // For now, this is a placeholder for future voice XP implementation
    } catch (error) {
      console.error('Error processing voice XP:', error);
    }
  }

  /**
   * Check if user is on XP cooldown
   * @param {string} userId - User ID
   * @param {number} cooldownSeconds - Cooldown in seconds
   * @returns {boolean} - True if on cooldown
   */
  isOnCooldown(userId, cooldownSeconds) {
    const lastGain = this.userCooldowns.get(userId);
    if (!lastGain) return false;
    
    const now = Date.now();
    const cooldownMs = cooldownSeconds * 1000;
    return (now - lastGain) < cooldownMs;
  }

  /**
   * Update user's XP cooldown
   * @param {string} userId - User ID
   */
  updateCooldown(userId) {
    this.userCooldowns.set(userId, Date.now());
  }

  /**
   * Check if channel is ignored for XP
   * @param {string} channelId - Channel ID
   * @param {Array} excludedChannels - Array of excluded channel IDs
   * @returns {boolean} - True if channel is ignored
   */
  isChannelIgnored(channelId, excludedChannels) {
    if (!excludedChannels || !Array.isArray(excludedChannels)) return false;
    return excludedChannels.includes(channelId);
  }

  /**
   * Check if user has an ignored role
   * @param {GuildMember} member - Guild member
   * @param {Array} excludedRoles - Array of excluded role IDs
   * @returns {boolean} - True if user has ignored role
   */
  hasIgnoredRole(member, excludedRoles) {
    if (!excludedRoles || !Array.isArray(excludedRoles) || !member) return false;
    return member.roles.cache.some(role => excludedRoles.includes(role.id));
  }

  /**
   * Calculate XP to award for a message
   * @param {Message} message - Discord message
   * @param {Object} xpSettings - XP settings
   * @returns {number} - XP amount to award
   */
  calculateMessageXP(message, xpSettings) {
    const baseXP = xpSettings.xpPerMessage || 15;
    
    // Add some randomness (±20%)
    const randomMultiplier = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
    let xpAmount = Math.floor(baseXP * randomMultiplier);
    
    // Bonus XP for longer messages (up to 50% bonus)
    const messageLength = message.content.length;
    if (messageLength > 50) {
      const lengthBonus = Math.min(0.5, (messageLength - 50) / 200);
      xpAmount = Math.floor(xpAmount * (1 + lengthBonus));
    }
    
    // Apply role-based XP multiplier
    const roleMultiplier = this.getRoleMultiplier(message.member, xpSettings.doubleXpEvents || []);
    if (roleMultiplier > 1) {
      xpAmount = Math.floor(xpAmount * roleMultiplier);
    }
    
    // Apply double XP events multiplier
    const activeMultiplier = this.getActiveXpMultiplier(xpSettings.doubleXpEvents || []);
    if (activeMultiplier > 1) {
      xpAmount = Math.floor(xpAmount * activeMultiplier);
    }
    
    // Ensure minimum of 1 XP
    return Math.max(1, xpAmount);
  }

  /**
   * Get active XP multiplier from double XP events
   * @param {Array} doubleXpEvents - Array of double XP events
   * @returns {number} - Active multiplier (1.0 if no active events)
   */
  getActiveXpMultiplier(doubleXpEvents) {
    if (!Array.isArray(doubleXpEvents) || doubleXpEvents.length === 0) {
      return 1.0;
    }

    const now = new Date();
    
    // Find any active double XP event
    for (const event of doubleXpEvents) {
      if (!event.enabled) continue;
      
      const startTime = new Date(event.startTime);
      const endTime = new Date(event.endTime);
      
      // Check if current time is within the event period
      if (now >= startTime && now <= endTime) {
        return event.multiplier || 2.0; // Default to 2x if no multiplier specified
      }
    }
    
    return 1.0; // No active events
  }

  /**
   * Get role-based XP multiplier for a user
   * @param {GuildMember} member - Discord guild member
   * @param {Array} doubleXpEvents - Array that may contain role multipliers
   * @returns {number} - Highest role multiplier (1.0 if no multiplier roles)
   */
  getRoleMultiplier(member, doubleXpEvents) {
    if (!Array.isArray(doubleXpEvents) || doubleXpEvents.length === 0 || !member) {
      return 1.0;
    }

    let highestMultiplier = 1.0;
    
    // Check if there are any role multipliers in the doubleXpEvents array
    for (const event of doubleXpEvents) {
      // Skip time-based events (they have startTime/endTime)
      if (event.startTime || event.endTime) continue;
      
      // Check for role-based multipliers (they have roleId)
      if (event.roleId && member.roles.cache.has(event.roleId)) {
        const multiplier = parseFloat(event.multiplier) || 1.0;
        if (multiplier > highestMultiplier) {
          highestMultiplier = multiplier;
        }
      }
    }
    
    return highestMultiplier;
  }

  /**
   * Award XP to a user and check for level up
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {number} xpAmount - XP amount to award
   * @param {string} source - Source of XP gain
   * @returns {Object} - Result with XP info and level up status
   */
  async awardXP(guildId, userId, xpAmount, source = 'message') {
    try {
      // Get current user XP
      const currentData = await this.store.getUserXp(guildId, userId);
      const oldLevel = this.calculateLevel(currentData.total_xp || 0);
      
      // Add XP
      const result = await this.store.addUserXp(guildId, userId, xpAmount, source);
      const newLevel = this.calculateLevel(result.total_xp);
      
      // Check if user leveled up
      const leveledUp = newLevel > oldLevel;
      
      return {
        xpGained: xpAmount,
        totalXp: result.total_xp,
        oldLevel,
        newLevel,
        leveledUp,
        xpForNext: this.getXpForLevel(newLevel + 1) - result.total_xp
      };
    } catch (error) {
      console.error('Error awarding XP:', error);
      return { leveledUp: false };
    }
  }

  /**
   * Calculate level from total XP
   * @param {number} totalXp - Total XP
   * @returns {number} - Level
   */
  calculateLevel(totalXp) {
    if (totalXp < 0) return 1;
    return Math.floor(Math.sqrt(totalXp / 100)) + 1;
  }

  /**
   * Calculate XP needed for a specific level
   * @param {number} level - Target level
   * @returns {number} - XP needed for that level
   */
  getXpForLevel(level) {
    if (level <= 1) return 0;
    return Math.pow(level - 1, 2) * 100;
  }

  /**
   * Send level up message
   * @param {Message} message - Original message that triggered level up
   * @param {Object} levelData - Level up data
   */
  async sendLevelUpMessage(message, levelData) {
    try {
      const { newLevel, totalXp, xpForNext } = levelData;
      
      // Get XP settings to check if level up messages are enabled
      const xpSettings = await this.store.getGuildXpSettings(message.guild.id);
      
      if (!xpSettings.levelUpMessages) return;

      // Create level up embed
      const embed = new EmbedBuilder()
        .setColor(0x00d4aa) // Bright green for level up
        .setTitle('🎉 Level Up!')
        .setDescription(`Congratulations <@${message.author.id}>! You've reached **Level ${newLevel}**!`)
        .addFields(
          { name: '📊 Total XP', value: totalXp.toLocaleString(), inline: true },
          { name: '⭐ Current Level', value: newLevel.toString(), inline: true },
          { name: '🎯 XP to Next Level', value: xpForNext.toLocaleString(), inline: true }
        )
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Keep chatting to gain more XP!' })
        .setTimestamp();

      // Determine where to send the message
      let targetChannel = message.channel;
      
      // Check if there's a specific level up channel configured
      if (xpSettings.levelUpChannel) {
        const levelUpChannel = message.guild.channels.cache.get(xpSettings.levelUpChannel);
        if (levelUpChannel && levelUpChannel.isTextBased()) {
          targetChannel = levelUpChannel;
        }
      }

      // Send the level up message
      await targetChannel.send({ embeds: [embed] });

      console.log(`[XP] ${message.author.tag} leveled up to ${newLevel} in ${message.guild.name}`);
    } catch (error) {
      console.error('Error sending level up message:', error);
    }
  }

  /**
   * Handle level rewards (role assignments)
   * @param {Message} message - Original message
   * @param {number} level - New level achieved
   */
  async handleLevelRewards(message, level) {
    try {
      // Get level rewards for this guild
      const rewards = await this.store.getGuildLevelRewards(message.guild.id);
      
      // Find rewards for this level
      const levelRewards = rewards.filter(reward => reward.level === level);
      
      for (const reward of levelRewards) {
        try {
          // Get the role
          const role = message.guild.roles.cache.get(reward.roleId);
          if (!role) {
            console.warn(`[XP] Role ${reward.roleId} not found for level ${level} reward`);
            continue;
          }

          // Add role to user
          await message.member.roles.add(role);
          
          // Send role reward notification
          const roleEmbed = new EmbedBuilder()
            .setColor(role.color || 0x7289da)
            .setTitle('🏆 Level Reward!')
            .setDescription(`You've been awarded the **${role.name}** role for reaching Level ${level}!`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Level Reward System' })
            .setTimestamp();

          // Send in same channel as level up message or configured channel
          let targetChannel = message.channel;
          const xpSettings = await this.store.getGuildXpSettings(message.guild.id);
          if (xpSettings.levelUpChannel) {
            const levelUpChannel = message.guild.channels.cache.get(xpSettings.levelUpChannel);
            if (levelUpChannel && levelUpChannel.isTextBased()) {
              targetChannel = levelUpChannel;
            }
          }

          await targetChannel.send({ embeds: [roleEmbed] });
          
          console.log(`[XP] Awarded role ${role.name} to ${message.author.tag} for reaching level ${level}`);
          
          // Remove previous level roles if configured
          if (reward.removePrevious) {
            const previousRewards = rewards.filter(r => r.level < level && r.removePrevious);
            for (const prevReward of previousRewards) {
              const prevRole = message.guild.roles.cache.get(prevReward.roleId);
              if (prevRole && message.member.roles.cache.has(prevRole.id)) {
                await message.member.roles.remove(prevRole);
                console.log(`[XP] Removed previous role ${prevRole.name} from ${message.author.tag}`);
              }
            }
          }
        } catch (roleError) {
          console.error(`Error awarding role ${reward.roleId} for level ${level}:`, roleError);
        }
      }
    } catch (error) {
      console.error('Error handling level rewards:', error);
    }
  }

  /**
   * Get user's current rank in guild
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @returns {Object} - User's rank info
   */
  async getUserRank(guildId, userId) {
    try {
      const leaderboard = await this.store.getUserLeaderboard(guildId, 1000, 0);
      const userIndex = leaderboard.findIndex(user => user.user_id === userId);
      
      if (userIndex === -1) {
        return { rank: null, total: leaderboard.length };
      }
      
      return { 
        rank: userIndex + 1, 
        total: leaderboard.length,
        user: leaderboard[userIndex]
      };
    } catch (error) {
      console.error('Error getting user rank:', error);
      return { rank: null, total: 0 };
    }
  }
}

module.exports = XPHandler;
