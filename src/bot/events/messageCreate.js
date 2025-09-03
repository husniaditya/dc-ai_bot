const { PermissionsBitField } = require('discord.js');

module.exports = (client, store) => {
  client.on('messageCreate', async (message) => {
    try {
      // Ignore bots and DMs
      if (!message.guild || message.author.bot) return;

      const guildId = message.guild.id;
      
      // Get guild auto moderation rules
      const autoModRules = await store.getGuildAutoModRules(guildId);
      if (!autoModRules || autoModRules.length === 0) return;

      // Check if user has bypass roles
      const member = message.member;
      if (!member) return;

      // Get moderation features to check bypass roles
      const moderationFeatures = await store.getModerationFeatures(guildId);
      const bypassRoles = moderationFeatures?.automod?.config?.bypassRoles || [];
      
      if (bypassRoles.length > 0) {
        const userHasBypassRole = member.roles.cache.some(role => bypassRoles.includes(role.id));
        if (userHasBypassRole) return; // User has bypass role, skip moderation
      }

      // Process each enabled auto mod rule
      for (const rule of autoModRules) {
        if (!rule.enabled) continue;

        // Check if channel/role is whitelisted for this rule
        if (rule.whitelistChannels && rule.whitelistChannels.includes(message.channel.id)) continue;
        if (rule.whitelistRoles && rule.whitelistRoles.some(roleId => member.roles.cache.has(roleId))) continue;

        let shouldTrigger = false;
        let reason = '';

        switch (rule.triggerType) {
          case 'spam':
            shouldTrigger = await checkSpamDetection(message, rule.thresholdValue || 5);
            reason = 'Spam detection';
            break;
          
          case 'caps':
            shouldTrigger = checkExcessiveCaps(message.content, rule.thresholdValue || 70);
            reason = 'Excessive caps';
            break;
          
          case 'links':
            shouldTrigger = checkLinks(message.content);
            reason = 'Unauthorized links';
            break;
          
          case 'invite_links':
            shouldTrigger = checkInviteLinks(message.content);
            reason = 'Discord invite links';
            break;
          
          case 'profanity':
            shouldTrigger = await checkProfanity(message.content, guildId, store);
            reason = 'Inappropriate language';
            break;
          
          case 'mention_spam':
            shouldTrigger = checkMentionSpam(message, rule.thresholdValue || 5);
            reason = 'Excessive mentions';
            break;
        }

        if (shouldTrigger) {
          await executeAutoModAction(message, rule, reason, store);
          break; // Only trigger first matching rule
        }
      }
    } catch (error) {
      console.error('Error in messageCreate auto moderation:', error);
    }
  });
};

// Spam detection - check for repeated messages
const spamCache = new Map(); // userId -> { messages: [], timestamps: [] }
async function checkSpamDetection(message, threshold) {
  const userId = message.author.id;
  const content = message.content.toLowerCase();
  const now = Date.now();
  
  if (!spamCache.has(userId)) {
    spamCache.set(userId, { messages: [], timestamps: [] });
  }
  
  const userCache = spamCache.get(userId);
  
  // Clean old entries (older than 10 seconds)
  const cutoff = now - 10000;
  userCache.messages = userCache.messages.filter((_, i) => userCache.timestamps[i] > cutoff);
  userCache.timestamps = userCache.timestamps.filter(t => t > cutoff);
  
  // Add current message
  userCache.messages.push(content);
  userCache.timestamps.push(now);
  
  // Check for spam patterns
  if (userCache.messages.length >= threshold) {
    // Check for identical messages
    const recentMessages = userCache.messages.slice(-threshold);
    const identicalCount = recentMessages.filter(msg => msg === content).length;
    if (identicalCount >= Math.ceil(threshold * 0.8)) return true;
    
    // Check for very similar messages (character overlap)
    let similarityCount = 0;
    for (const msg of recentMessages) {
      if (calculateSimilarity(content, msg) > 0.8) {
        similarityCount++;
      }
    }
    if (similarityCount >= Math.ceil(threshold * 0.7)) return true;
  }
  
  return false;
}

// Calculate text similarity (simple approach)
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Simple Levenshtein distance calculation
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Check for excessive caps
function checkExcessiveCaps(content, threshold) {
  if (!content || content.length < 10) return false; // Ignore short messages
  
  const upperCount = (content.match(/[A-Z]/g) || []).length;
  const letterCount = (content.match(/[A-Za-z]/g) || []).length;
  
  if (letterCount === 0) return false;
  
  const capsPercentage = (upperCount / letterCount) * 100;
  return capsPercentage >= threshold;
}

// Check for links
function checkLinks(content) {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  return urlRegex.test(content);
}

// Check for Discord invite links
function checkInviteLinks(content) {
  const inviteRegex = /(discord\.gg\/|discordapp\.com\/invite\/|discord\.com\/invite\/)[a-zA-Z0-9]+/gi;
  return inviteRegex.test(content);
}

// Check for profanity
async function checkProfanity(content, guildId, store) {
  try {
    // Get guild-specific profanity words and patterns
    const [profanityWords, profanityPatterns] = await Promise.all([
      store.getGuildProfanityWords(guildId),
      store.getGuildProfanityPatterns(guildId)
    ]);
    
    const contentLower = content.toLowerCase();
    
    // Check against profanity words
    for (const wordObj of profanityWords) {
      if (!wordObj.enabled) continue;
      
      const word = wordObj.word.toLowerCase();
      if (wordObj.wholeWordOnly) {
        const wordRegex = new RegExp(`\\b${escapeRegex(word)}\\b`, wordObj.caseSensitive ? 'g' : 'gi');
        if (wordRegex.test(wordObj.caseSensitive ? content : contentLower)) return true;
      } else {
        if (wordObj.caseSensitive) {
          if (content.includes(wordObj.word)) return true;
        } else {
          if (contentLower.includes(word)) return true;
        }
      }
    }
    
    // Check against profanity patterns
    for (const patternObj of profanityPatterns) {
      if (!patternObj.enabled) continue;
      
      try {
        const regex = new RegExp(patternObj.pattern, patternObj.flags || 'gi');
        if (regex.test(content)) return true;
      } catch (regexError) {
        console.warn(`Invalid regex pattern: ${patternObj.pattern}`, regexError);
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking profanity:', error);
    return false;
  }
}

// Escape special regex characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Check for mention spam
function checkMentionSpam(message, threshold) {
  const mentions = message.mentions.users.size + message.mentions.roles.size;
  return mentions >= threshold;
}

// Warning escalation helpers - now using database persistence
// Database-only warning functions (no memory cache fallback)
async function getWarningCount(guildId, userId, ruleType, store) {
  try {
    const result = await store.getWarningCount(guildId, userId, ruleType);
    return result;
  } catch (error) {
    console.error('Error getting warning count from database:', error);
    // Return zero warnings on error rather than using memory cache
    return { count: 0, lastViolation: null };
  }
}

async function incrementWarningCount(guildId, userId, ruleType, increment = 1, store) {
  try {
    const newCount = await store.incrementWarningCount(guildId, userId, ruleType, increment);
    return newCount;
  } catch (error) {
    console.error('Error incrementing warning count in database:', error);
    console.error('WARNING: Cannot track warning counts without database!');
    // Get current count and add increment as fallback
    const current = await getWarningCount(guildId, userId, ruleType, store);
    return current.count + increment;
  }
}

async function resetWarningCount(guildId, userId, ruleType, store) {
  try {
    await store.resetWarningCount(guildId, userId, ruleType);
    return true;
  } catch (error) {
    console.error('Error resetting warning count in database:', error);
    return false;
  }
}

// Execute auto moderation action
async function executeAutoModAction(message, rule, reason, store) {
  try {
    const guild = message.guild;
    const member = message.member;
    const guildId = guild.id;
    const userId = message.author.id;
    const ruleType = rule.triggerType; // Use trigger type as rule identifier
    
    // Don't delete message here - handle it in the specific action cases
    const shouldDelete = rule.messageAction === 'delete' || rule.autoDelete;
    
    // Get current warning count for this user and this specific rule type
    const currentWarnings = await getWarningCount(guildId, userId, ruleType, store);
    
    // Use the stored threshold value from the database as warning threshold
    // If no threshold is set, default to 3 warnings
    let warningThreshold = rule.thresholdValue || 3;
    
    // Determine what action to take based on warning count and rule settings
    let actualAction = rule.actionType;
    let shouldWarn = false;
    let warningIncrement = 1; // How many warnings to add for this violation
    
    
    // Check if we should escalate through warnings first
    if (rule.enableWarningEscalation !== false && rule.actionType !== 'warn' && rule.actionType !== 'delete') {
      if (currentWarnings.count + warningIncrement < warningThreshold) {
        // User hasn't reached warning threshold yet for this rule type, give warning instead
        actualAction = 'warn';
        shouldWarn = true;
      } else {
        // User has reached warning threshold for this rule type, will execute the actual action
        // Warning reset will happen after successful action execution
      }
    }
    
    // Log the action if log channel is specified
    if (rule.logChannelId) {
      await logModerationAction(guild, rule.logChannelId, {
        action: actualAction,
        user: message.author,
        reason: reason,
        rule: rule.name,
        ruleType: ruleType,
        messageContent: message.content,
        channel: message.channel,
        deleted: shouldDelete,
        warningCount: currentWarnings.count + (shouldWarn ? warningIncrement : 0),
        warningThreshold: warningThreshold,
        warningIncrement: warningIncrement
      });
    }
    
    // Execute the determined action
    switch (actualAction) {
      case 'warn':
        const newWarningCount = await incrementWarningCount(guildId, userId, ruleType, warningIncrement, store);
        
        // Record the violation in database
        await store.recordViolation({
          guildId,
          userId,
          ruleId: rule.id || null,
          ruleType,
          ruleName: rule.name,
          violationReason: reason,
          messageContent: message.content,
          channelId: message.channel.id,
          messageId: message.id,
          actionTaken: 'warn',
          warningIncrement,
          totalWarningsAtTime: newWarningCount,
          thresholdAtTime: warningThreshold,
          isAutoMod: true,
          severity: warningIncrement > 1 ? 'high' : 'medium'
        });
        
        await warnUserWithCount(message, reason, rule, newWarningCount, warningThreshold, warningIncrement, ruleType);
        // Delete message after warning if auto-delete is enabled
        if (shouldDelete && message.deletable) {
          await message.delete();
        }
        break;
      
      case 'mute':
        // Record the violation in database
        await store.recordViolation({
          guildId,
          userId,
          ruleId: rule.id || null,
          ruleType,
          ruleName: rule.name,
          violationReason: reason,
          messageContent: message.content,
          channelId: message.channel.id,
          messageId: message.id,
          actionTaken: 'mute',
          warningIncrement,
          totalWarningsAtTime: currentWarnings.count + warningIncrement,
          thresholdAtTime: warningThreshold,
          isAutoMod: true,
          severity: 'high'
        });
        
        await muteUserAfterWarnings(message, rule.duration, reason, warningThreshold);
        
        // Reset warnings after successful punishment action
        if (!shouldWarn && currentWarnings.count + warningIncrement >= warningThreshold) {
          await resetWarningCount(guildId, userId, ruleType, store);
        }
        
        // Delete message after muting if auto-delete is enabled
        if (shouldDelete && message.deletable) {
          await message.delete();
        }
        break;
      
      case 'kick':
        // Record the violation in database
        await store.recordViolation({
          guildId,
          userId,
          ruleId: rule.id || null,
          ruleType,
          ruleName: rule.name,
          violationReason: reason,
          messageContent: message.content,
          channelId: message.channel.id,
          messageId: message.id,
          actionTaken: 'kick',
          warningIncrement,
          totalWarningsAtTime: currentWarnings.count + warningIncrement,
          thresholdAtTime: warningThreshold,
          isAutoMod: true,
          severity: 'extreme'
        });
        
        await kickUserAfterWarnings(message, reason, warningThreshold);
        
        // Reset warnings after successful punishment action
        if (!shouldWarn && currentWarnings.count + warningIncrement >= warningThreshold) {
          await resetWarningCount(guildId, userId, ruleType, store);
        }
        
        // Delete message after kicking if auto-delete is enabled
        if (shouldDelete && message.deletable) {
          await message.delete();
        }
        break;
      
      case 'ban':
        // Record the violation in database
        await store.recordViolation({
          guildId,
          userId,
          ruleId: rule.id || null,
          ruleType,
          ruleName: rule.name,
          violationReason: reason,
          messageContent: message.content,
          channelId: message.channel.id,
          messageId: message.id,
          actionTaken: 'ban',
          warningIncrement,
          totalWarningsAtTime: currentWarnings.count + warningIncrement,
          thresholdAtTime: warningThreshold,
          isAutoMod: true,
          severity: 'extreme'
        });
        
        await banUserAfterWarnings(message, reason, warningThreshold);
        
        // Reset warnings after successful punishment action
        if (!shouldWarn && currentWarnings.count + warningIncrement >= warningThreshold) {
          await resetWarningCount(guildId, userId, ruleType, store);
        }
        
        // Delete message after banning if auto-delete is enabled
        if (shouldDelete && message.deletable) {
          await message.delete();
        }
        break;
      
      case 'delete':
        // Record the violation in database
        await store.recordViolation({
          guildId,
          userId,
          ruleId: rule.id || null,
          ruleType,
          ruleName: rule.name,
          violationReason: reason,
          messageContent: message.content,
          channelId: message.channel.id,
          messageId: message.id,
          actionTaken: 'delete',
          warningIncrement: 0, // Delete actions don't add warnings
          totalWarningsAtTime: currentWarnings.count,
          thresholdAtTime: warningThreshold,
          isAutoMod: true,
          severity: 'low'
        });
        
        // Reply to the message first, then delete it
        try {
          await message.reply({
            embeds: [{
              color: 0xff6b6b,
              title: '🗑️ Message Deleted',
              description: `Your message was deleted for violating community guidelines.`,
              fields: [
                { name: 'Rule', value: rule.name, inline: true },
                { name: 'Reason', value: reason, inline: true }
              ],
              footer: { text: 'Auto Moderation System' },
              timestamp: new Date().toISOString()
            }]
          });
          
          // Now delete the original message if it's deletable
          if (shouldDelete && message.deletable) {
            await message.delete();
          }
          
          // Try to send DM to user
          await message.author.send({
            embeds: [{
              color: 0xff6b6b,
              title: '🗑️ Message Deleted',
              description: `Your message in **${message.guild.name}** was deleted for violating community guidelines.`,
              fields: [
                { name: 'Rule', value: rule.name, inline: true },
                { name: 'Channel', value: `#${message.channel.name}`, inline: true },
                { name: 'Reason', value: reason, inline: false }
              ],
              footer: { text: 'Auto Moderation System' },
              timestamp: new Date().toISOString()
            }]
          });
        } catch (dmError) {
          console.log(`[AUTO MOD] Could not DM user about deleted message: ${dmError.message}`);
        }
        break;
    }
    
  } catch (error) {
    console.error('Error executing auto mod action:', error);
  }
}

// Warn user with warning count
async function warnUserWithCount(message, reason, rule, warningCount, warningThreshold, warningIncrement = 1, ruleType = 'general') {
  try {
    // Determine severity level based on warning increment and trigger type
    let severityInfo = '';
    let severityColor = 0xff9500; // Default orange
    
    if (warningIncrement > 1) {
      severityInfo = ` (+${warningIncrement} warnings - severe violation)`;
      severityColor = 0xff5722; // Red-orange for severe violations
    }

    // Format rule type for display
    const ruleTypeDisplay = ruleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    const dmEmbed = {
      color: severityColor,
      title: '⚠️ Auto Moderation Warning',
      description: `Your message in **${message.guild.name}** was flagged for: **${reason}**${severityInfo}`,
      fields: [
        { name: 'Rule', value: rule.name, inline: true },
        { name: 'Rule Type', value: ruleTypeDisplay, inline: true },
        { name: 'Channel', value: `#${message.channel.name}`, inline: true },
        { name: 'Warning Count (for this rule)', value: `${warningCount}/${warningThreshold}`, inline: true }
      ],
      footer: { 
        text: warningCount >= warningThreshold ? 
          'Next violation of this rule will result in further action!' : 
          'Please follow the server rules to avoid further action.' 
      },
      timestamp: new Date().toISOString()
    };
    
    // Add violation severity info if applicable
    if (warningIncrement > 1) {
      dmEmbed.fields.push({
        name: 'Violation Severity',
        value: `This violation added ${warningIncrement} warnings due to its serious nature.`,
        inline: false
      });
    }
    
    // Format action and duration from rule
    const actionText = rule.actionType || 'punished';
    const durationText = rule.duration ? `${rule.duration}` : '5';
    
    const channelEmbed = {
      color: warningCount >= warningThreshold - 1 ? 0xff5722 : severityColor,
      title: warningCount >= warningThreshold - 1 ? '⚠️ Final Warning' : (warningIncrement > 1 ? '⚠️ Severe Warning' : '⚠️ Warning Issued'),
      description: `<@${message.author.id}> received a warning for violating community guidelines. Will be **${actionText}** for **${durationText} minute(s)** upon reaching ${warningThreshold} warnings for this rule.`,
      fields: [
        { name: 'Rule', value: rule.name, inline: true },
        { name: 'Rule Type', value: ruleTypeDisplay, inline: true },
        { name: 'Reason', value: reason, inline: true },
        { name: 'Warning Count', value: `${warningCount}/${warningThreshold} (${ruleTypeDisplay})`, inline: true }
      ],
      footer: { text: 'Auto Moderation System' },
      timestamp: new Date().toISOString()
    };
    
    // Add severity info to channel embed if applicable
    if (warningIncrement > 1) {
      channelEmbed.fields.push({
        name: 'Severity',
        value: `+${warningIncrement} warnings`,
        inline: true
      });
    }
    
    // Reply to the original message with warning
    await message.reply({ embeds: [channelEmbed] });
    
    // Try to send DM to user
    try {
      await message.author.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log(`[AUTO MOD] Could not DM user ${message.author.tag}: ${dmError.message}`);
      // If DM fails, send a follow-up reply
      await message.followUp({
        content: `I couldn't send you a DM. Please check your message settings.`,
        allowedMentions: { users: [message.author.id] }
      });
    }
  } catch (error) {
    console.error('Error warning user:', error);
  }
}

// Warn user (legacy function for direct warn actions)
async function warnUser(message, reason, rule, store) {
  const guildId = message.guild.id;
  const userId = message.author.id;
  const ruleType = rule.triggerType;
  
  // Determine warning increment based on rule type
  let warningIncrement = 1;
  switch (rule.triggerType) {
    case 'profanity':
    case 'invite_links':
      warningIncrement = 2;
      break;
    default:
      warningIncrement = 1;
      break;
  }
  
  const warningCount = await incrementWarningCount(guildId, userId, ruleType, warningIncrement, store);
  const warningThreshold = rule.thresholdValue || 3; // Use thresholdValue from database
  
  // Record the violation in database
  await store.recordViolation({
    guildId,
    userId,
    ruleId: rule.id || null,
    ruleType,
    ruleName: rule.name,
    violationReason: reason,
    messageContent: message.content,
    channelId: message.channel.id,
    messageId: message.id,
    actionTaken: 'warn',
    warningIncrement,
    totalWarningsAtTime: warningCount,
    thresholdAtTime: warningThreshold,
    isAutoMod: true,
    severity: warningIncrement > 1 ? 'high' : 'medium'
  });
  
  await warnUserWithCount(message, reason, rule, warningCount, warningThreshold, warningIncrement, ruleType);
}

// Mute user after warning escalation
async function muteUserAfterWarnings(message, duration, reason, warningThreshold) {
  try {
    const member = message.member;
    if (!member.guild.members.me?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      console.error('Bot lacks permission to moderate members (timeout)');
      return;
    }
    
    const durationMs = duration ? duration * 60 * 1000 : 5 * 60 * 1000; // Default 5 minutes
    const maxDuration = 28 * 24 * 60 * 60 * 1000; // 28 days max
    const finalDuration = Math.min(durationMs, maxDuration);
    
    await member.timeout(finalDuration, `Auto-mod: ${reason} (exceeded ${warningThreshold} warnings)`);
    
    // Reply to the original message with mute notification
    await message.reply({
      embeds: [{
        color: 0xef5350,
        title: '🔇 User Muted - Warning Limit Exceeded',
        description: `You have been muted for violating community guidelines after receiving ${warningThreshold} warnings.`,
        fields: [
          { name: 'Duration', value: `${Math.round(finalDuration / 60000)} minutes`, inline: true },
          { name: 'Reason', value: reason, inline: true },
          { name: 'Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
        ],
        footer: { text: 'Auto Moderation System - Warning counter reset' },
        timestamp: new Date().toISOString()
      }]
    });
    
    // Try to send DM to user
    try {
      await member.user.send({
        embeds: [{
          color: 0xef5350,
          title: '🔇 You Have Been Muted - Warning Limit Exceeded',
          description: `You have been muted in **${member.guild.name}** for ${Math.round(finalDuration / 60000)} minutes after receiving ${warningThreshold} warnings.`,
          fields: [
            { name: 'Reason', value: reason, inline: true },
            { name: 'Server', value: member.guild.name, inline: true },
            { name: 'Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
          ],
          footer: { text: 'Auto Moderation System - Warning counter reset' },
          timestamp: new Date().toISOString()
        }]
      });
    } catch (dmError) {
      console.log(`[AUTO MOD] Could not DM muted user ${member.user.tag}: ${dmError.message}`);
    }
  } catch (error) {
    console.error('Error muting user:', error);
  }
}

// Mute user (legacy function for direct mute actions)
async function muteUser(message, duration, reason) {
  await muteUserAfterWarnings(message, duration, reason, 0);
}

// Kick user after warning escalation
async function kickUserAfterWarnings(message, reason, warningThreshold) {
  try {
    const member = message.member;
    if (!member.guild.members.me?.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      console.error('Bot lacks permission to kick members');
      return;
    }
    
    // Reply to the original message with kick notification
    await message.reply({
      embeds: [{
        color: 0xf44336,
        title: '👢 User Kicked - Warning Limit Exceeded',
        description: `You have been kicked for violating community guidelines after receiving ${warningThreshold} warnings.`,
        fields: [
          { name: 'Reason', value: reason, inline: true },
          { name: 'Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
        ],
        footer: { text: 'Auto Moderation System - Warning counter reset' },
        timestamp: new Date().toISOString()
      }]
    });
    
    // Send DM before kicking (so they can still receive it)
    try {
      await member.user.send({
        embeds: [{
          color: 0xf44336,
          title: '👢 You Have Been Kicked - Warning Limit Exceeded',
          description: `You have been kicked from **${member.guild.name}** for violating community guidelines after receiving ${warningThreshold} warnings.`,
          fields: [
            { name: 'Reason', value: reason, inline: true },
            { name: 'Server', value: member.guild.name, inline: true },
            { name: 'Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
          ],
          footer: { text: 'Auto Moderation System - Warning counter reset' },
          timestamp: new Date().toISOString()
        }]
      });
    } catch (dmError) {
      console.log(`[AUTO MOD] Could not DM user before kick: ${dmError.message}`);
    }
    
    await member.kick(`Auto-mod: ${reason} (exceeded ${warningThreshold} warnings)`);
    
    console.log(`[AUTO MOD] Kicked user: ${member.user.tag} for: ${reason} (after ${warningThreshold} warnings)`);
  } catch (error) {
    console.error('Error kicking user:', error);
  }
}

// Kick user (legacy function for direct kick actions)
async function kickUser(message, reason) {
  await kickUserAfterWarnings(message, reason, 0);
}

// Ban user
// Ban user after warning escalation
async function banUserAfterWarnings(message, reason, warningThreshold) {
  try {
    const member = message.member;
    if (!member.guild.members.me?.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      console.error('Bot lacks permission to ban members');
      return;
    }
    
    // Reply to the original message with ban notification
    await message.reply({
      embeds: [{
        color: 0xd32f2f,
        title: '🔨 User Banned - Warning Limit Exceeded',
        description: `You have been banned for violating community guidelines after receiving ${warningThreshold} warnings.`,
        fields: [
          { name: 'Reason', value: reason, inline: true },
          { name: 'Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
        ],
        footer: { text: 'Auto Moderation System - Warning counter reset' },
        timestamp: new Date().toISOString()
      }]
    });
    
    // Send DM before banning (so they can still receive it)
    try {
      await member.user.send({
        embeds: [{
          color: 0xd32f2f,
          title: '🔨 You Have Been Banned - Warning Limit Exceeded',
          description: `You have been banned from **${member.guild.name}** for violating community guidelines after receiving ${warningThreshold} warnings.`,
          fields: [
            { name: 'Reason', value: reason, inline: true },
            { name: 'Server', value: member.guild.name, inline: true },
            { name: 'Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
          ],
          footer: { text: 'Auto Moderation System - Warning counter reset' },
          timestamp: new Date().toISOString()
        }]
      });
    } catch (dmError) {
      console.log(`[AUTO MOD] Could not DM user before ban: ${dmError.message}`);
    }
    
    await member.ban({ reason: `Auto-mod: ${reason} (exceeded ${warningThreshold} warnings)`, deleteMessageDays: 1 });
    
    // Get a channel to send notification to
    const channel = member.guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(member.guild.members.me).has('SendMessages'));
    
    // Send notification in channel after ban
    if (channel) {
      await channel.send({
        embeds: [{
          color: 0xd32f2f,
          title: '🔨 User Banned - Warning Limit Exceeded',
          description: `${member.user.tag} has been banned for violating community guidelines after receiving ${warningThreshold} warnings.`,
          fields: [
            { name: 'Reason', value: reason, inline: true },
            { name: 'User ID', value: member.user.id, inline: true },
            { name: 'Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
          ],
          footer: { text: 'Auto Moderation System - Warning counter reset' },
          timestamp: new Date().toISOString()
        }]
      });
    }
  } catch (error) {
    console.error('Error banning user:', error);
  }
}

// Ban user (legacy function for direct ban actions)
async function banUser(message, reason) {
  await banUserAfterWarnings(message, reason, 0);
}

// Log moderation action
async function logModerationAction(guild, logChannelId, actionData) {
  try {
    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel || !logChannel.isTextBased()) return;
    
    // Format rule type for display
    const ruleTypeDisplay = actionData.ruleType ? 
      actionData.ruleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
      'General';
    
    const embed = {
      color: 0xdc2626,
      title: '🛡️ Auto Moderation Action',
      fields: [
        { name: 'User', value: `${actionData.user} (${actionData.user.id})`, inline: true },
        { name: 'Action', value: actionData.action, inline: true },
        { name: 'Rule', value: actionData.rule, inline: true },
        { name: 'Rule Type', value: ruleTypeDisplay, inline: true },
        { name: 'Reason', value: actionData.reason, inline: true },
        { name: 'Channel', value: `<#${actionData.channel.id}>`, inline: true },
        { name: 'Message Deleted', value: actionData.deleted ? 'Yes' : 'No', inline: true }
      ],
      footer: { text: 'Auto Moderation System' },
      timestamp: new Date().toISOString()
    };
    
    // Add warning information if applicable
    if (actionData.warningCount !== undefined && actionData.warningThreshold !== undefined) {
      embed.fields.push({
        name: 'Warning Progress',
        value: `${actionData.warningCount}/${actionData.warningThreshold} (${ruleTypeDisplay})`,
        inline: true
      });
    }
    
    if (actionData.messageContent && actionData.messageContent.length > 0) {
      embed.fields.push({
        name: 'Message Content',
        value: actionData.messageContent.length > 1000 
          ? actionData.messageContent.substring(0, 1000) + '...'
          : actionData.messageContent
      });
    }
    
    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error logging moderation action:', error);
  }
}
