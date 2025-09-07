// Anti-Raid Protection Service
// Monitors join patterns, account age, and suspicious activity to protect against raids

const { PermissionsBitField } = require('discord.js');

// Stores join timestamps per guild for rate limiting
const guildJoinTracking = new Map();

// Grace period monitoring for new members
const newMemberTracking = new Map();

/**
 * Map raid action config values to database enum values
 * @param {string} action - The configured raid action
 * @returns {string|null} - Valid enum value or null
 */
function mapRaidActionToEnum(action) {
  const actionMap = {
    'kick': 'kick',
    'ban': 'ban',
    'mute': 'mute',
    'lockdown': 'lockdown',
    'none': 'alert_only',
    'alert': 'alert_only'
  };
  return actionMap[action] || 'alert_only';
}

/**
 * Initialize anti-raid monitoring for a guild member join
 * @param {GuildMember} member - The member who joined
 * @param {Object} store - Database store instance
 * @param {Client} client - Discord client
 */
async function handleMemberJoin(member, store, client) {
  try {
    const guildId = member.guild.id;
    const userId = member.user.id;
    
    // Get anti-raid configuration for this guild
    const config = await store.getGuildAntiRaidSettings(guildId);
    
    if (!config || !config.enabled) {
      return; // Anti-raid disabled for this guild
    }

    // Check if user has bypass roles (if they somehow have roles on join)
    if (config.bypassRoles && config.bypassRoles.length > 0) {
      const hasBypassRole = member.roles.cache.some(role => 
        config.bypassRoles.includes(role.id)
      );
      if (hasBypassRole) {
        console.log(`[AntiRaid] User ${userId} bypassed anti-raid protection in guild ${guildId} (bypass role)`);
        
        // Log bypass event
        try {
          if (store.insertAntiRaidLog) {
            await store.insertAntiRaidLog(guildId, {
              eventType: 'legitimate_join',
              userId: userId,
              userTag: member.user.tag,
              accountAgeDays: Math.round(((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24)) * 10) / 10,
              joinTimestamp: member.joinedAt || new Date(),
              joinsInWindow: 1, // Single join
              youngAccountRatio: 0.0, // Bypass users are trusted
              actionType: 'none', // No action taken for bypass
              actionDuration: 0, // No duration for bypass
              moderatorId: null, // Automated system action
              memberCountAtJoin: member.guild.memberCount,
              verificationLevelAtJoin: member.guild.verificationLevel,
              joinSource: 'bypass_role'
            });
          }
        } catch (logError) {
          console.error('[AntiRaid] Error logging bypass join:', logError);
        }
        
        return;
      }
    }

    const now = Date.now();
    const accountAge = now - member.user.createdTimestamp;
    const accountAgeDays = accountAge / (1000 * 60 * 60 * 24);
    
    // Initialize guild tracking if not exists
    if (!guildJoinTracking.has(guildId)) {
      guildJoinTracking.set(guildId, []);
    }
    
    const joinHistory = guildJoinTracking.get(guildId);
    
    // Add current join to history
    joinHistory.push({ userId, timestamp: now, accountAgeDays });
    
    // Clean old joins outside the time window
    const windowMs = (config.joinWindow || 60) * 1000;
    const cutoff = now - windowMs;
    const recentJoins = joinHistory.filter(join => join.timestamp > cutoff);
    guildJoinTracking.set(guildId, recentJoins);
    
    // Check for raid conditions
    const isRaid = checkForRaid(recentJoins, config);
    const isSuspicious = checkSuspiciousAccount(member, config, accountAgeDays);
    
    // Calculate young account ratio for this join window
    const youngAccounts = recentJoins.filter(join => join.accountAgeDays < (config.accountAge || 7)).length;
    const youngAccountRatio = recentJoins.length > 0 ? youngAccounts / recentJoins.length : 0;
    
    // Log member join to database
    try {
      if (store.insertAntiRaidLog) {
        await store.insertAntiRaidLog(guildId, {
          eventType: isSuspicious ? 'suspicious_member' : 'legitimate_join',
          userId: userId,
          userTag: member.user.tag,
          accountAgeDays: Math.round(accountAgeDays * 10) / 10, // Round to 1 decimal
          joinTimestamp: member.joinedAt || new Date(), // Actual join timestamp
          joinsInWindow: recentJoins.length,
          youngAccountRatio: Math.round(youngAccountRatio * 100) / 100, // Round to 2 decimals
          actionType: isSuspicious ? 'monitor' : 'none', // Action taken for this specific join
          actionDuration: 0, // No immediate action duration for regular joins
          moderatorId: null, // Automated system detection
          memberCountAtJoin: member.guild.memberCount,
          verificationLevelAtJoin: member.guild.verificationLevel,
          joinSource: 'direct' // Default, can be enhanced with invite tracking
        });
      }
    } catch (logError) {
      console.error('[AntiRaid] Error logging member join:', logError);
    }
    
    if (isRaid) {
      await handleRaidDetected(member.guild, config, store, client, recentJoins);
    }
    
    if (isSuspicious) {
      await handleSuspiciousAccount(member, config, store, client, accountAgeDays);
    }
    
    // Start monitoring new member for grace period
    if (config.gracePeriod && config.gracePeriod > 0) {
      startNewMemberMonitoring(member, config);
    }
    
  } catch (error) {
    console.error('[AntiRaid] Error handling member join:', error);
  }
}

/**
 * Check if current join pattern indicates a raid
 * @param {Array} recentJoins - Recent join data
 * @param {Object} config - Anti-raid configuration
 * @returns {boolean} - True if raid detected
 */
function checkForRaid(recentJoins, config) {
  const joinLimit = config.joinRate || 5;
  
  if (recentJoins.length < joinLimit) {
    return false; // Not enough joins to trigger
  }
  
  // Additional heuristics for raid detection
  const youngAccounts = recentJoins.filter(join => 
    join.accountAgeDays < (config.accountAge || 7)
  ).length;
  
  // If more than 60% of recent joins are young accounts, likely a raid
  const youngAccountRatio = youngAccounts / recentJoins.length;
  
  return youngAccountRatio > 0.6 || recentJoins.length >= joinLimit;
}

/**
 * Check if an account is suspicious based on various factors
 * @param {GuildMember} member - The member to check
 * @param {Object} config - Anti-raid configuration
 * @param {number} accountAgeDays - Account age in days
 * @returns {boolean} - True if account is suspicious
 */
function checkSuspiciousAccount(member, config, accountAgeDays) {
  const factors = [];
  
  // Account age check
  if (accountAgeDays < (config.accountAge || 7)) {
    factors.push('young_account');
  }
  
  // No avatar (default Discord avatar)
  if (!member.user.avatar) {
    factors.push('no_avatar');
  }
  
  // Username patterns (numbers at end, common bot patterns)
  const username = member.user.username.toLowerCase();
  if (/\d{4,}$/.test(username) || /^user\d+/.test(username)) {
    factors.push('suspicious_username');
  }
  
  // Return true if multiple suspicious factors
  return factors.length >= 2;
}

/**
 * Handle detected raid - take immediate action
 * @param {Guild} guild - The Discord guild
 * @param {Object} config - Anti-raid configuration
 * @param {Object} store - Database store
 * @param {Client} client - Discord client
 * @param {Array} recentJoins - Recent join data
 */
async function handleRaidDetected(guild, config, store, client, recentJoins) {
  try {
    console.log(`[AntiRaid] RAID DETECTED in guild ${guild.id} - ${recentJoins.length} recent joins`);
    
    // Log raid detection to database
    try {
      if (store.insertAntiRaidLog) {
        const youngAccounts = recentJoins.filter(join => join.accountAgeDays < (config.accountAge || 7)).length;
        const raidId = `raid_${guild.id}_${Date.now()}`; // Generate unique raid ID
        
        await store.insertAntiRaidLog(guild.id, {
          eventType: 'raid_detected',
          raidId: raidId,
          joinTimestamp: new Date(),
          joinsInWindow: recentJoins.length,
          youngAccountRatio: Math.round((youngAccounts / recentJoins.length) * 100) / 100,
          actionType: config.raidAction || 'lockdown',
          actionDuration: config.raidActionDuration || 5,
          moderatorId: null, // Automated raid response
          memberCountAtJoin: guild.memberCount,
          verificationLevelAtJoin: guild.verificationLevel
        });
      }
    } catch (logError) {
      console.error('[AntiRaid] Error logging raid detection:', logError);
    }
    
    // Send alert to configured channel
    if (config.alertChannel) {
      await sendRaidAlert(guild, config.alertChannel, recentJoins, client);
    }
    
    // Take configured raid action
    const action = config.raidAction || 'lockdown';
    const duration = config.raidActionDuration || 5;
    
    switch (action) {
      case 'lockdown':
        await performServerLockdown(guild, config, duration);
        break;
      case 'kick':
        await kickRecentJoins(guild, recentJoins, 'Raid protection - suspicious join pattern');
        break;
      case 'ban':
        await banRecentJoins(guild, recentJoins, duration, 'Raid protection - suspicious join pattern');
        break;
      case 'mute':
        await muteRecentJoins(guild, recentJoins, duration, 'Raid protection - suspicious join pattern');
        break;
      case 'none':
        // Just alert, no action
        break;
    }
    
    // Update raid status in database
    await store.updateGuildAntiRaidSettings(guild.id, {
      raidActive: true,
      raidStartedAt: new Date()
    });
    
  } catch (error) {
    console.error('[AntiRaid] Error handling raid:', error);
  }
}

/**
 * Handle suspicious account - individual action
 * @param {GuildMember} member - The suspicious member
 * @param {Object} config - Anti-raid configuration
 * @param {Object} store - Database store
 * @param {Client} client - Discord client
 * @param {number} accountAgeDays - Account age in days
 */
async function handleSuspiciousAccount(member, config, store, client, accountAgeDays) {
  try {
    console.log(`[AntiRaid] Suspicious account detected: ${member.user.tag} (${accountAgeDays.toFixed(1)} days old)`);
    
    if (config.autoKick) {
      try {
        await member.kick('Auto-kick: Suspicious account detected by anti-raid protection');
        console.log(`[AntiRaid] Auto-kicked suspicious account: ${member.user.tag}`);
        
        // Log the kick action
        try {
          if (store.insertAntiRaidLog) {
            await store.insertAntiRaidLog(member.guild.id, {
              eventType: 'suspicious_member',
              userId: member.user.id,
              userTag: member.user.tag,
              accountAgeDays: Math.round(accountAgeDays * 10) / 10,
              joinTimestamp: member.joinedAt || new Date(),
              joinsInWindow: 1, // Individual action
              youngAccountRatio: 1.0, // 100% young account (the kicked user)
              actionType: 'kick',
              actionDuration: 0, // Kick is immediate, no duration
              moderatorId: null, // Automated auto-kick
              memberCountAtJoin: member.guild.memberCount,
              verificationLevelAtJoin: member.guild.verificationLevel,
              joinSource: 'auto_kicked'
            });
          }
        } catch (logError) {
          console.error('[AntiRaid] Error logging auto-kick:', logError);
        }
        
        // Send notification to alert channel
        if (config.alertChannel) {
          const channel = member.guild.channels.cache.get(config.alertChannel);
          if (channel) {
            await channel.send({
              embeds: [{
                title: '🛡️ Suspicious Account Auto-Kicked',
                description: `**User:** ${member.user.tag} (${member.user.id})\n**Account Age:** ${accountAgeDays.toFixed(1)} days\n**Action:** Automatically kicked`,
                color: 0xff9500,
                timestamp: new Date().toISOString()
              }]
            });
          }
        }
      } catch (kickError) {
        console.error('[AntiRaid] Failed to kick suspicious account:', kickError);
      }
    }
  } catch (error) {
    console.error('[AntiRaid] Error handling suspicious account:', error);
  }
}

/**
 * Send raid alert to configured channel
 * @param {Guild} guild - The Discord guild
 * @param {string} alertChannelId - Channel ID to send alert
 * @param {Array} recentJoins - Recent join data
 * @param {Client} client - Discord client
 */
async function sendRaidAlert(guild, alertChannelId, recentJoins, client) {
  try {
    const channel = guild.channels.cache.get(alertChannelId);
    if (!channel) return;
    
    const youngAccounts = recentJoins.filter(join => join.accountAgeDays < 7).length;
    
    await channel.send({
      embeds: [{
        title: '🚨 RAID DETECTED',
        description: `**Server:** ${guild.name}\n**Recent Joins:** ${recentJoins.length}\n**Young Accounts:** ${youngAccounts}\n**Time Window:** Last 60 seconds`,
        color: 0xff0000,
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: 'Recent Joiners',
            value: recentJoins.slice(-10).map(join => 
              `<@${join.userId}> (${join.accountAgeDays.toFixed(1)}d old)`
            ).join('\n') || 'None',
            inline: false
          }
        ]
      }]
    });
  } catch (error) {
    console.error('[AntiRaid] Error sending raid alert:', error);
  }
}

/**
 * Perform server lockdown by changing verification level
 * @param {Guild} guild - The Discord guild
 * @param {Object} config - Anti-raid configuration
 * @param {number} duration - Duration in minutes
 */
async function performServerLockdown(guild, config, duration) {
  try {
    const currentLevel = guild.verificationLevel;
    const targetLevel = 4; // Highest verification level
    
    if (currentLevel < targetLevel) {
      await guild.setVerificationLevel(targetLevel, 'Anti-raid protection: Server lockdown');
      console.log(`[AntiRaid] Server ${guild.name} locked down (verification level ${targetLevel})`);
      
      // Schedule unlock after duration
      setTimeout(async () => {
        try {
          await guild.setVerificationLevel(currentLevel, 'Anti-raid protection: Lockdown expired');
          console.log(`[AntiRaid] Server ${guild.name} lockdown expired, verification level restored`);
        } catch (error) {
          console.error('[AntiRaid] Error restoring verification level:', error);
        }
      }, duration * 60 * 1000);
    }
  } catch (error) {
    console.error('[AntiRaid] Error performing server lockdown:', error);
  }
}

/**
 * Kick recent joiners identified in raid
 * @param {Guild} guild - The Discord guild
 * @param {Array} recentJoins - Recent join data
 * @param {string} reason - Kick reason
 */
async function kickRecentJoins(guild, recentJoins, reason) {
  try {
    for (const join of recentJoins) {
      try {
        const member = guild.members.cache.get(join.userId);
        if (member && member.kickable) {
          await member.kick(reason);
          console.log(`[AntiRaid] Kicked ${member.user.tag} as part of raid response`);
        }
      } catch (error) {
        console.error(`[AntiRaid] Failed to kick ${join.userId}:`, error);
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('[AntiRaid] Error kicking recent joins:', error);
  }
}

/**
 * Ban recent joiners identified in raid
 * @param {Guild} guild - The Discord guild
 * @param {Array} recentJoins - Recent join data
 * @param {number} duration - Ban duration in minutes
 * @param {string} reason - Ban reason
 */
async function banRecentJoins(guild, recentJoins, duration, reason) {
  try {
    for (const join of recentJoins) {
      try {
        const member = guild.members.cache.get(join.userId);
        if (member && member.bannable) {
          await member.ban({ reason, deleteMessageDays: 1 });
          console.log(`[AntiRaid] Banned ${member.user.tag} as part of raid response`);
          
          // Schedule unban after duration (if duration > 0)
          if (duration > 0) {
            setTimeout(async () => {
              try {
                await guild.members.unban(join.userId, 'Anti-raid protection: Ban duration expired');
                console.log(`[AntiRaid] Unbanned ${join.userId} after ${duration} minutes`);
              } catch (error) {
                console.error(`[AntiRaid] Error unbanning ${join.userId}:`, error);
              }
            }, duration * 60 * 1000);
          }
        }
      } catch (error) {
        console.error(`[AntiRaid] Failed to ban ${join.userId}:`, error);
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } catch (error) {
    console.error('[AntiRaid] Error banning recent joins:', error);
  }
}

/**
 * Mute recent joiners identified in raid
 * @param {Guild} guild - The Discord guild
 * @param {Array} recentJoins - Recent join data
 * @param {number} duration - Mute duration in minutes
 * @param {string} reason - Mute reason
 */
async function muteRecentJoins(guild, recentJoins, duration, reason) {
  try {
    for (const join of recentJoins) {
      try {
        const member = guild.members.cache.get(join.userId);
        if (member && member.moderatable) {
          const timeoutDuration = Math.min(duration * 60 * 1000, 28 * 24 * 60 * 60 * 1000); // Max 28 days
          await member.timeout(timeoutDuration, reason);
          console.log(`[AntiRaid] Muted ${member.user.tag} for ${duration} minutes as part of raid response`);
        }
      } catch (error) {
        console.error(`[AntiRaid] Failed to mute ${join.userId}:`, error);
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('[AntiRaid] Error muting recent joins:', error);
  }
}

/**
 * Start monitoring a new member during grace period
 * @param {GuildMember} member - The member to monitor
 * @param {Object} config - Anti-raid configuration
 */
function startNewMemberMonitoring(member, config) {
  const guildId = member.guild.id;
  const userId = member.user.id;
  const gracePeriodMs = (config.gracePeriod || 30) * 60 * 1000;
  
  if (!newMemberTracking.has(guildId)) {
    newMemberTracking.set(guildId, new Map());
  }
  
  const guildTracking = newMemberTracking.get(guildId);
  guildTracking.set(userId, {
    joinedAt: Date.now(),
    monitored: true
  });
  
  // Remove from monitoring after grace period
  setTimeout(() => {
    const guildTracking = newMemberTracking.get(guildId);
    if (guildTracking) {
      guildTracking.delete(userId);
    }
  }, gracePeriodMs);
}

/**
 * Check if a member is currently being monitored as a new member
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @returns {boolean} - True if being monitored
 */
function isNewMemberMonitored(guildId, userId) {
  const guildTracking = newMemberTracking.get(guildId);
  return guildTracking && guildTracking.has(userId);
}

/**
 * Handle message from a new member during grace period
 * @param {Message} message - The message
 * @param {Object} config - Anti-raid configuration
 * @param {Object} store - Database store
 * @param {Client} client - Discord client
 */
async function handleNewMemberMessage(message, config, store, client) {
  if (!config || !config.enabled) return;
  if (!isNewMemberMonitored(message.guildId, message.author.id)) return;
  
  try {
    const content = message.content.toLowerCase();
    let suspicious = false;
    let reason = '';
    
    // Check for invite spam
    if (config.deleteInviteSpam && /discord\.gg\/|discordapp\.com\/invite\//.test(content)) {
      suspicious = true;
      reason = 'Invite spam';
      await message.delete();
    }
    
    // Check for mass mentions
    if (message.mentions.users.size > 5) {
      suspicious = true;
      reason = 'Mass mentions';
      await message.delete();
    }
    
    // Check for excessive caps
    if (content.length > 10 && content.replace(/[^A-Z]/g, '').length / content.length > 0.7) {
      suspicious = true;
      reason = 'Excessive caps';
    }
    
    if (suspicious && config.autoKick) {
      try {
        const member = message.guild.members.cache.get(message.author.id);
        if (member && member.kickable) {
          await member.kick(`Anti-raid protection: ${reason} during grace period`);
          console.log(`[AntiRaid] Auto-kicked new member for ${reason}: ${message.author.tag}`);
          
          // Log the grace period kick
          try {
            if (store.insertAntiRaidLog) {
              await store.insertAntiRaidLog(message.guild.id, {
                eventType: 'suspicious_member',
                userId: message.author.id,
                userTag: message.author.tag,
                accountAgeDays: Math.round(((Date.now() - message.author.createdTimestamp) / (1000 * 60 * 60 * 24)) * 10) / 10,
                joinTimestamp: new Date(),
                joinsInWindow: 1, // Individual violation
                youngAccountRatio: 1.0, // 100% - this is the violating user
                actionType: 'kick',
                actionDuration: 0, // Kick is immediate
                moderatorId: null, // Automated grace period enforcement
                memberCountAtJoin: message.guild.memberCount,
                verificationLevelAtJoin: message.guild.verificationLevel,
                joinSource: `grace_violation_${reason.toLowerCase().replace(/\s+/g, '_')}`
              });
            }
          } catch (logError) {
            console.error('[AntiRaid] Error logging grace period kick:', logError);
          }
          
          // Send notification
          if (config.alertChannel) {
            const channel = message.guild.channels.cache.get(config.alertChannel);
            if (channel) {
              await channel.send({
                embeds: [{
                  title: '🛡️ New Member Auto-Kicked',
                  description: `**User:** ${message.author.tag} (${message.author.id})\n**Reason:** ${reason}\n**Message:** ${message.content.slice(0, 200)}${message.content.length > 200 ? '...' : ''}`,
                  color: 0xff9500,
                  timestamp: new Date().toISOString()
                }]
              });
            }
          }
        }
      } catch (error) {
        console.error('[AntiRaid] Failed to kick new member:', error);
      }
    }
  } catch (error) {
    console.error('[AntiRaid] Error handling new member message:', error);
  }
}

/**
 * Clean up old tracking data to prevent memory leaks
 */
function cleanupTrackingData() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  // Clean join tracking
  for (const [guildId, joins] of guildJoinTracking.entries()) {
    const recentJoins = joins.filter(join => now - join.timestamp < maxAge);
    if (recentJoins.length === 0) {
      guildJoinTracking.delete(guildId);
    } else {
      guildJoinTracking.set(guildId, recentJoins);
    }
  }
  
  // Clean new member tracking
  for (const [guildId, members] of newMemberTracking.entries()) {
    const activeMember = new Map();
    for (const [userId, data] of members.entries()) {
      if (now - data.joinedAt < maxAge) {
        activeMember.set(userId, data);
      }
    }
    if (activeMember.size === 0) {
      newMemberTracking.delete(guildId);
    } else {
      newMemberTracking.set(guildId, activeMember);
    }
  }
}

// Clean up tracking data every hour
setInterval(cleanupTrackingData, 60 * 60 * 1000);

module.exports = {
  handleMemberJoin,
  handleNewMemberMessage,
  isNewMemberMonitored,
  cleanupTrackingData
};
