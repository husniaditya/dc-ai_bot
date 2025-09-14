const { PermissionsBitField } = require('discord.js');

module.exports = (client, store) => {
  // Handle message updates (edits) - recheck links and other moderation rules
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    try {
      // Ignore bots, DMs, and partial messages
      if (!newMessage.guild || newMessage.author?.bot || newMessage.partial) return;
      
      // Skip if content didn't change
      if (oldMessage.content === newMessage.content) return;

      const guildId = newMessage.guild.id;
      
      // Get guild auto moderation rules
      const autoModRules = await store.getGuildAutoModRules(guildId);
      if (!autoModRules || autoModRules.length === 0) return;

      // Check if user has bypass roles
      const member = newMessage.member;
      if (!member) return;

      // Get moderation features to check bypass roles
      const moderationFeatures = await store.getModerationFeatures(guildId);
      const bypassRoles = moderationFeatures?.automod?.config?.bypassRoles || [];
      
      if (bypassRoles.length > 0) {
        const userHasBypassRole = member.roles.cache.some(role => bypassRoles.includes(role.id));
        if (userHasBypassRole) return; // User has bypass role, skip moderation
      }

      // Process each enabled auto mod rule for the updated message
      for (const rule of autoModRules) {
        if (!rule.enabled) continue;

        // Check if channel/role is whitelisted for this rule
        if (rule.whitelistChannels && rule.whitelistChannels.includes(newMessage.channel.id)) continue;
        if (rule.whitelistRoles && rule.whitelistRoles.some(roleId => member.roles.cache.has(roleId))) continue;

        let shouldTrigger = false;
        let reason = '';

        switch (rule.triggerType) {
          case 'spam':
            // Check for spam in edited messages - look for rapid edits or spammy content
            shouldTrigger = await checkEditSpamDetection(newMessage, oldMessage, rule.thresholdValue || 3);
            reason = 'Spam content in edited message';
            break;
          
          case 'caps':
            shouldTrigger = checkExcessiveCaps(newMessage.content, rule.thresholdValue || 70);
            reason = 'Excessive caps';
            break;
          
          case 'links':
            shouldTrigger = await checkLinks(newMessage.content, guildId, store, newMessage);
            reason = 'Unauthorized or malicious links';
            break;
          
          case 'invite_links':
            shouldTrigger = checkInviteLinks(newMessage.content);
            reason = 'Discord invite links';
            break;
          
          case 'profanity':
            shouldTrigger = await checkProfanity(newMessage.content, guildId, store);
            reason = 'Inappropriate language';
            break;
          
          case 'mention_spam':
            shouldTrigger = checkMentionSpam(newMessage, rule.thresholdValue || 5);
            reason = 'Excessive mentions';
            break;
        }

        if (shouldTrigger) {
          // Add context that this was an edited message
          await executeAutoModActionForEdit(newMessage, oldMessage, rule, reason, store);
          break; // Only trigger first matching rule
        }
      }
    } catch (error) {
      console.error('Error in messageUpdate auto moderation:', error);
    }
  });
};

// Check for excessive caps (excluding URLs from analysis)
function checkExcessiveCaps(content, threshold = 75) {
  if (!content || content.length < 10) return false; // Ignore short messages
  
  // Remove URLs from content before analyzing caps
  // This prevents technical URLs like "VC11" from unfairly triggering caps detection
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const contentWithoutUrls = content.replace(urlRegex, '').trim();
  
  // If after removing URLs there's not enough content, skip caps check
  if (!contentWithoutUrls || contentWithoutUrls.length < 10) return false;
  
  const upperCount = (contentWithoutUrls.match(/[A-Z]/g) || []).length;
  const letterCount = (contentWithoutUrls.match(/[A-Za-z]/g) || []).length;
  
  if (letterCount === 0) return false;
  
  const capsPercentage = (upperCount / letterCount) * 100;
  return capsPercentage >= threshold;
}

// Check for links with online malicious detection
async function checkLinks(content, guildId, store, message) {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = content.match(urlRegex);
  
  if (!urls || urls.length === 0) return false;
  
  let hasAnyMaliciousLinks = false;
  let safeLinksChecked = 0;
  
  for (const url of urls) {
    try {
      // Clean the URL (remove trailing punctuation)
      const cleanUrl = url.replace(/[.,;!?]+$/, '');
      
      // Check if this URL is malicious using online services
      if (await isMaliciousLink(cleanUrl, guildId, store)) {
        hasAnyMaliciousLinks = true;
      } else {
        safeLinksChecked++;
      }
    } catch (error) {
      console.error('Error checking link:', error);
      // If online check fails, use basic suspicious pattern check
      if (hasSuspiciousPattern(cleanUrl)) {
        hasAnyMaliciousLinks = true;
      } else {
        safeLinksChecked++;
      }
    }
  }
  
  // If we found safe links and no malicious ones, send a positive feedback
  if (!hasAnyMaliciousLinks && safeLinksChecked > 0 && message) {
    try {
      await sendSafeLinkConfirmation(message, safeLinksChecked);
    } catch (error) {
      console.error('Error sending safe link confirmation:', error);
    }
  }
  
  return hasAnyMaliciousLinks;
}

// Check for Discord invite links
function checkInviteLinks(content) {
  return hasDiscordInvitePattern(content) || hasOtherInvitePattern(content);
}

function hasDiscordInvitePattern(content) {
  const discordInvitePatterns = [
    // Standard Discord invite formats
    /(discord\.gg\/|discordapp\.com\/invite\/|discord\.com\/invite\/)[a-zA-Z0-9]+/gi,
    
    // Discord invite with custom vanity URLs
    /discord\.gg\/[a-zA-Z0-9\-_]+/gi,
    
    // Obfuscated Discord invites
    /d[il1]scord[\s\.]*(gg|com)[\s\/]*[a-zA-Z0-9]+/gi,
    /disc[o0]rd[\s\.]*(gg|com)[\s\/]*[a-zA-Z0-9]+/gi
  ];
  
  return discordInvitePatterns.some(pattern => pattern.test(content));
}

function hasOtherInvitePattern(content) {
  const otherInvitePatterns = [
    // Other gaming platform invites
    /(?:steam|epicgames|origin)[\s\.:\/]*(?:group|community|invite)/gi,
    
    // Social media invites that might be spam
    /(?:telegram|whatsapp)[\s\.:\/]*(?:invite|join|group)/gi
  ];
  
  return otherInvitePatterns.some(pattern => pattern.test(content));
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
function checkMentionSpam(message, threshold = 3) {
  const mentions = message.mentions.users.size + message.mentions.roles.size;
  return mentions >= threshold;
}

// Edit-specific spam detection - check for spammy edits
const editSpamCache = new Map(); // userId -> { edits: [], timestamps: [] }
async function checkEditSpamDetection(newMessage, oldMessage, threshold = 3) {
  const userId = newMessage.author.id;
  const newContent = (newMessage.content || '').toLowerCase();
  const oldContent = (oldMessage.content || '').toLowerCase();
  const now = Date.now();
  
  // If content is identical, not spam
  if (newContent === oldContent) return false;
  
  if (!editSpamCache.has(userId)) {
    editSpamCache.set(userId, { edits: [], timestamps: [] });
  }
  
  const userCache = editSpamCache.get(userId);
  
  // Clean old entries (older than 30 seconds for edits)
  const cutoff = now - 30000;
  userCache.edits = userCache.edits.filter((_, i) => userCache.timestamps[i] > cutoff);
  userCache.timestamps = userCache.timestamps.filter(t => t > cutoff);
  
  // Add current edit
  userCache.edits.push({
    messageId: newMessage.id,
    oldContent,
    newContent,
    editTime: now
  });
  userCache.timestamps.push(now);
  
  // Check for spam patterns in edits
  if (userCache.edits.length >= threshold) {
    const recentEdits = userCache.edits.slice(-threshold);
    
    // Check for rapid successive edits (more than threshold edits in 30 seconds)
    if (recentEdits.length >= threshold) {
      const timeSpan = now - recentEdits[0].editTime;
      if (timeSpan < 30000) { // 30 seconds
        return true; // Rapid edit spam
      }
    }
    
    // Check for repetitive edit content (editing to same content repeatedly)
    const contentCounts = {};
    for (const edit of recentEdits) {
      const content = edit.newContent;
      contentCounts[content] = (contentCounts[content] || 0) + 1;
      if (contentCounts[content] >= Math.ceil(threshold * 0.7)) {
        return true; // Repetitive content spam
      }
    }
    
    // Check for edit cycling (A->B->A->B pattern)
    if (recentEdits.length >= 4) {
      for (let i = 0; i < recentEdits.length - 3; i++) {
        const pattern1 = recentEdits[i].newContent;
        const pattern2 = recentEdits[i + 1].newContent;
        const pattern3 = recentEdits[i + 2].newContent;
        const pattern4 = recentEdits[i + 3].newContent;
        
        if (pattern1 === pattern3 && pattern2 === pattern4 && pattern1 !== pattern2) {
          return true; // Edit cycling detected
        }
      }
    }
  }
  
  // Check for spammy characteristics in the new content
  if (isSpammyContent(newContent)) {
    return true;
  }
  
  return false;
}

// Check if content has spammy characteristics
function isSpammyContent(content) {
  // Check for excessive repetition of characters or words
  const repetitivePatterns = [
    /(.)\1{10,}/g, // Same character repeated 10+ times
    /(\b\w+\b)(\s+\1){4,}/gi, // Same word repeated 5+ times
    /(.{2,}?)\1{5,}/g, // Same pattern repeated 6+ times
  ];
  
  for (const pattern of repetitivePatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }
  
  // Check for excessive special characters
  const specialCharCount = (content.match(/[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?~`]/g) || []).length;
  const specialCharRatio = specialCharCount / content.length;
  if (specialCharRatio > 0.3 && content.length > 10) { // More than 30% special chars
    return true;
  }
  
  // Check for excessive emojis
  const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
  const emojiRatio = emojiCount / content.length;
  if (emojiRatio > 0.2 && content.length > 5) { // More than 20% emojis
    return true;
  }
  
  return false;
}

// Determine what type of change was made in the edit
function determineChangeType(oldContent, newContent) {
  // Ensure we have valid strings to work with
  const safeOldContent = oldContent || '';
  const safeNewContent = newContent || '';
  
  // Check if links were added
  const oldLinks = (safeOldContent.match(/(https?:\/\/[^\s]+)/gi) || []).length;
  const newLinks = (safeNewContent.match(/(https?:\/\/[^\s]+)/gi) || []).length;
  
  // Check if mentions were added
  const oldMentions = (safeOldContent.match(/<@[!&]?\d+>/g) || []).length;
  const newMentions = (safeNewContent.match(/<@[!&]?\d+>/g) || []).length;
  
  // Check if content was made longer (potential spam)
  const lengthIncrease = safeNewContent.length - safeOldContent.length;
  
  // Determine primary change type
  const changes = [];
  
  if (newLinks > oldLinks) {
    changes.push(`added_${newLinks - oldLinks}_links`);
  } else if (newLinks < oldLinks) {
    changes.push(`removed_${oldLinks - newLinks}_links`);
  }
  
  if (newMentions > oldMentions) {
    changes.push(`added_${newMentions - oldMentions}_mentions`);
  } else if (newMentions < oldMentions) {
    changes.push(`removed_${oldMentions - newMentions}_mentions`);
  }
  
  if (lengthIncrease > 100) {
    changes.push('significant_content_addition');
  } else if (lengthIncrease < -100) {
    changes.push('significant_content_removal');
  }
  
  // Check for caps changes
  const oldCapsRatio = safeOldContent.length > 0 ? (safeOldContent.match(/[A-Z]/g) || []).length / safeOldContent.length : 0;
  const newCapsRatio = safeNewContent.length > 0 ? (safeNewContent.match(/[A-Z]/g) || []).length / safeNewContent.length : 0;
  if (newCapsRatio > oldCapsRatio + 0.2) {
    changes.push('increased_caps');
  }
  
  // Check for profanity addition (basic check)
  if (safeOldContent.length > 0 && (safeNewContent.includes('fuck') || safeNewContent.includes('shit'))) {
    changes.push('potential_profanity_added');
  }
  
  return changes.length > 0 ? changes.join(', ') : 'content_modification';
}

// Send safe link confirmation message
async function sendSafeLinkConfirmation(message, linkCount) {
  try {
    // Create a confirmation message that auto-deletes after a few seconds
    const confirmationMessage = await message.reply({
      embeds: [{
        color: 0x4caf50, // Green color for safe
        title: '🔗 Link Security Check - Edited Message',
        description: `✅ Link${linkCount > 1 ? 's' : ''} in edited message verified as safe!`,
        fields: [
          { 
            name: '🛡️ Security Status', 
            value: `${linkCount} link${linkCount > 1 ? 's' : ''} checked and approved`, 
            inline: true 
          },
          { 
            name: '🔒 Protection', 
            value: 'No threats detected', 
            inline: true 
          },
          { 
            name: '📝 Action', 
            value: 'Message edit scanned', 
            inline: true 
          }
        ],
        footer: { text: '🔍 Link Security System' },
        timestamp: new Date().toISOString()
      }]
    });
    
    // Auto-delete the confirmation message after 5 seconds
    // setTimeout(async () => {
    //   try {
    //     if (confirmationMessage.deletable) {
    //       await confirmationMessage.delete();
    //     }
    //   } catch (deleteError) {
    //     console.log('Could not delete safe link confirmation message:', deleteError.message);
    //   }
    // }, 5000);
    
  } catch (error) {
    console.error('Error sending safe link confirmation:', error);
  }
}

// Import shared malicious link detection functions
// These functions are imported from external modules or shared utilities
async function isMaliciousLink(url, guildId, store) {
  try {
    // Extract domain from URL
    const domain = extractDomain(url);
    
    // Check if domain is in trusted whitelist (never block these)
    if (isTrustedDomain(domain)) {
      return false;
    }
    
    // First check local blacklist for known bad domains (faster)
    if (await isBlacklistedDomain(domain, guildId, store)) {
      console.log(`[MALICIOUS LINK] Domain ${domain} found in blacklist`);
      return true;
    }
    
    // Additional heuristic checks for suspicious patterns (faster check first)
    if (hasSuspiciousPattern(url)) {
      console.log(`[MALICIOUS LINK] ${url} flagged by heuristic analysis`);
      return true;
    }
    
    // Check against multiple online services for comprehensive protection
    const results = await Promise.allSettled([
      checkGoogleSafeBrowsing(url),
      checkVirusTotal(url),
      checkPhishTank(url)
    ]);
    
    // If any service detects the URL as malicious, consider it unsafe
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value === true) {
        const serviceNames = ['Google Safe Browsing', 'VirusTotal', 'PhishTank'];
        console.log(`[MALICIOUS LINK] ${url} detected as malicious by ${serviceNames[i]}`);
        
        // Cache this domain as malicious for faster future checks
        await addToBlacklist(domain, guildId, store, `auto-detected by ${serviceNames[i]}`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error in malicious link check:', error);
    // If all services fail, use heuristic analysis as fallback
    return hasSuspiciousPattern(url);
  }
}

// Check if domain is trusted (whitelist)
function isTrustedDomain(domain) {
  const trustedDomains = [
    // Major search engines
    'google.com', 'google.co.uk', 'google.ca', 'google.com.au',
    'bing.com', 'yahoo.com', 'duckduckgo.com',
    
    // Social media platforms
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'linkedin.com', 'reddit.com', 'pinterest.com', 'tiktok.com',
    
    // Code repositories and development
    'github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com',
    'pypi.org', 'packagist.org', 'nuget.org',
    
    // Gaming platforms
    'steam.com', 'steampowered.com', 'steamcommunity.com',
    'epicgames.com', 'origin.com', 'battle.net', 'blizzard.com',
    'xbox.com', 'playstation.com', 'nintendo.com',
    
    // Discord official
    'discord.com', 'discordapp.com', 'discord.gg',
    
    // Cloud and tech companies
    'microsoft.com', 'apple.com', 'amazon.com', 'netflix.com',
    'spotify.com', 'dropbox.com', 'drive.google.com',
    
    // News and media
    'wikipedia.org', 'bbc.com', 'cnn.com', 'reuters.com',
    'nytimes.com', 'washingtonpost.com',
    
    // Educational
    'edu', 'mit.edu', 'stanford.edu', 'harvard.edu',
    'coursera.org', 'edx.org', 'khanacademy.org',
    
    // Government
    'gov', 'gov.uk', 'gov.ca', 'gov.au'
  ];
  
  const lowerDomain = domain.toLowerCase();
  
  // Check exact match
  if (trustedDomains.includes(lowerDomain)) {
    return true;
  }
  
  // Check if it's a subdomain of trusted domains
  for (const trustedDomain of trustedDomains) {
    if (lowerDomain.endsWith('.' + trustedDomain)) {
      return true;
    }
  }
  
  return false;
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch (error) {
    // Fallback for malformed URLs
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i);
    return match ? match[1].toLowerCase() : url;
  }
}

// Check local blacklist
async function isBlacklistedDomain(domain, guildId, store) {
  try {
    if (store.getBlacklistedDomains) {
      const blacklistedDomains = await store.getBlacklistedDomains(guildId);
      return blacklistedDomains.some(blacklisted => 
        domain === blacklisted.domain || 
        domain.endsWith('.' + blacklisted.domain)
      );
    }
  } catch (error) {
    console.error('Error checking blacklisted domains:', error);
  }
  return false;
}

// Add domain to blacklist
async function addToBlacklist(domain, guildId, store, reason = 'manual') {
  try {
    if (store.addBlacklistedDomain) {
      await store.addBlacklistedDomain(guildId, domain, reason);
      console.log(`[BLACKLIST] Added ${domain} to blacklist for guild ${guildId}: ${reason}`);
    }
  } catch (error) {
    console.error('Error adding to blacklist:', error);
  }
}

// Online service checks
async function checkGoogleSafeBrowsing(url) {
  try {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
    if (!apiKey) {
      return false;
    }
    
    const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client: {
          clientId: 'discord-automod',
          clientVersion: '1.0.0'
        },
        threatInfo: {
          threatTypes: [
            'MALWARE',
            'SOCIAL_ENGINEERING', 
            'UNWANTED_SOFTWARE',
            'POTENTIALLY_HARMFUL_APPLICATION'
          ],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url: url }]
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.matches && data.matches.length > 0;
    }
  } catch (error) {
    console.error('Google Safe Browsing API error:', error);
  }
  return false;
}

async function checkVirusTotal(url) {
  try {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) {
      return false;
    }
    
    // Encode URL for VirusTotal
    const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
    
    const response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: {
        'x-apikey': apiKey
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const stats = data.data?.attributes?.last_analysis_stats;
      
      if (stats) {
        // Consider malicious if more than 2 engines detect it as harmful
        const maliciousCount = (stats.malicious || 0) + (stats.suspicious || 0);
        return maliciousCount > 2;
      }
    }
  } catch (error) {
    console.error('VirusTotal API error:', error);
  }
  return false;
}

async function checkPhishTank(url) {
  try {
    // PhishTank has a simpler free API
    const response = await fetch('https://checkurl.phishtank.com/checkurl/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `url=${encodeURIComponent(url)}&format=json&app_key=discord-bot`
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.results && data.results.in_database === true && data.results.valid === true;
    }
  } catch (error) {
    console.error('PhishTank API error:', error);
  }
  return false;
}

// Heuristic analysis for suspicious patterns
function hasSuspiciousPattern(url) {
  return (
    hasDiscordPhishingPattern(url) ||
    hasGamingScamPattern(url) ||
    hasCryptoScamPattern(url) ||
    hasURLShortenerPattern(url) ||
    hasIPAddressPattern(url) ||
    hasSuspiciousTLDPattern(url) ||
    hasPhishingKeywordPattern(url) ||
    hasSocialEngineeringPattern(url)
  );
}

function hasDiscordPhishingPattern(url) {
  const discordPhishingPatterns = [
    // Discord Nitro/Gift scams
    /discord[\-.]?(?:nitro|gift|free)[\-.]?(?:free|gen|generator)/i,
    /(?:free|get)[\-.]?(?:discord|nitro)[\-.]?(?:gift|nitro|premium)/i,
    /discord[\-.]?(?:app|community)[\-.]?(?:org|net|info|biz)/i,
    
    // Discord fake domains
    /d[il1]scord[\-.]?(?:com|app|gg)/i,
    /disc[o0]rd[\-.]?(?:com|app|gg)/i,
    /discord[\-.]?(?:gift|nitro|free)[\-.]?[a-z]+/i
  ];
  
  return discordPhishingPatterns.some(pattern => pattern.test(url));
}

function hasGamingScamPattern(url) {
  const gamingScamPatterns = [
    // Steam phishing patterns  
    /steam[\-.]?(?:community|powered)[\-.]?(?:org|net|info|biz)/i,
    /steamcommunity[\-.]?(?:org|net|info|biz)/i,
    /steam[\-.]?(?:login|verify|security)/i,
    
    // Gaming currency scams
    /(?:free|get)[\-.]?(?:robux|v[\-.]?bucks|minecraft|vbucks)/i,
    /(?:roblox|fortnite|minecraft)[\-.]?(?:free|hack|generator)/i,
    
    // Gaming platform fake sites
    /(?:epicgames|origin|battlenet)[\-.]?(?:org|net|info)/i
  ];
  
  return gamingScamPatterns.some(pattern => pattern.test(url));
}

function hasCryptoScamPattern(url) {
  const cryptoScamPatterns = [
    // Crypto generators and free coin scams
    /(?:bitcoin|crypto|eth|btc)[\-.]?(?:free|generator|mining)/i,
    /(?:free|get)[\-.]?(?:bitcoin|btc|eth|crypto|coin)/i,
    
    // Crypto exchange phishing
    /(?:binance|coinbase|kraken)[\-.]?(?:org|net|info|biz)/i,
    
    // Investment/trading scams
    /(?:invest|trading|profit)[\-.]?(?:crypto|bitcoin|guarantee)/i,
    /(?:crypto|bitcoin)[\-.]?(?:doubler|multiplier|investment)/i
  ];
  
  return cryptoScamPatterns.some(pattern => pattern.test(url));
}

function hasURLShortenerPattern(url) {
  const shortenerPatterns = [
    // Popular URL shorteners (high risk for hiding malicious links)
    /bit\.ly|tinyurl|ow\.ly|t\.co|goo\.gl|short\.link/i,
    /tiny\.cc|is\.gd|buff\.ly|rebrand\.ly/i,
    /cutt\.ly|shorturl\.at|x\.co|lnkd\.in/i,
    
    // Suspicious custom shorteners
    /\.ly\/|\.gl\/|\.cc\/|\.co\/[a-z0-9]{1,6}$/i
  ];
  
  return shortenerPatterns.some(pattern => pattern.test(url));
}

function hasIPAddressPattern(url) {
  const ipPatterns = [
    // Direct IP addresses (suspicious for regular websites)
    /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
    
    // Local network IPs (potential internal network access)
    /^https?:\/\/(?:192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)[\d.]+/,
    
    // Localhost and loopback
    /^https?:\/\/(?:localhost|127\.0\.0\.1)/
  ];
  
  return ipPatterns.some(pattern => pattern.test(url));
}

function hasSuspiciousTLDPattern(url) {
  const suspiciousTLDPatterns = [
    // Free/suspicious TLDs commonly used for phishing
    /\.(?:tk|ml|ga|cf|pw|top|click)(?:\/|$)/i,
    
    // Recently popular phishing TLDs
    /\.(?:xyz|club|info|biz|online|site)(?:\/|$)/i,
    
    // Typosquatting common TLDs
    /\.(?:cam|org\.uk|co\.uk)(?:\/|$)/i
  ];
  
  return suspiciousTLDPatterns.some(pattern => pattern.test(url));
}

function hasPhishingKeywordPattern(url) {
  const phishingKeywordPatterns = [
    // Account security phishing
    /(?:verify|update|secure|login|account)[\-.]?(?:now|here|required)/i,
    /(?:suspended|locked|expired)[\-.]?(?:account|access)/i,
    
    // Urgency and action words
    /(?:click|download|install|update)[\-.]?(?:here|now|free|fast)/i,
    /(?:urgent|immediate|expires|limited)[\-.]?(?:action|time|offer)/i,
    
    // Financial phishing
    /(?:paypal|bank|payment)[\-.]?(?:verify|update|security)/i,
    /(?:refund|reward|prize|winner)/i
  ];
  
  return phishingKeywordPatterns.some(pattern => pattern.test(url));
}

function hasSocialEngineeringPattern(url) {
  const socialEngineeringPatterns = [
    // Too-good-to-be-true offers
    /(?:free|win|get|claim)[\-.]?(?:money|cash|prize|gift)/i,
    /(?:100%|guaranteed|instant|easy)[\-.]?(?:profit|money|income)/i,
    
    // Fake verification/support
    /(?:support|help|verification)[\-.]?(?:team|center|required)/i,
    /(?:customer|technical)[\-.]?(?:support|service)/i,
    
    // Fake official communications
    /(?:official|admin|moderator)[\-.]?(?:message|announcement)/i,
    /(?:system|security)[\-.]?(?:alert|warning|notice)/i
  ];
  
  return socialEngineeringPatterns.some(pattern => pattern.test(url));
}

// Database-only warning functions
async function getWarningCount(guildId, userId, ruleType, store) {
  try {
    const result = await store.getWarningCount(guildId, userId, ruleType);
    return result;
  } catch (error) {
    console.error('Error getting warning count from database:', error);
    return { count: 0, lastViolation: null };
  }
}

async function incrementWarningCount(guildId, userId, ruleType, increment = 1, store) {
  try {
    const newCount = await store.incrementWarningCount(guildId, userId, ruleType, increment);
    return newCount;
  } catch (error) {
    console.error('Error incrementing warning count in database:', error);
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

// Execute auto moderation action for edited messages
async function executeAutoModActionForEdit(newMessage, oldMessage, rule, reason, store) {
  try {
    const guild = newMessage.guild;
    const member = newMessage.member;
    const guildId = guild.id;
    const userId = newMessage.author.id;
    const ruleType = rule.triggerType;
    
    const shouldDelete = rule.messageAction === 'delete' || rule.autoDelete;
    const currentWarnings = await getWarningCount(guildId, userId, ruleType, store);
    let warningThreshold = rule.thresholdValue || 3;
    
    let actualAction = rule.actionType;
    let shouldWarn = false;
    let warningIncrement = 1;
    
    // Check if we should escalate through warnings first
    if (rule.enableWarningEscalation !== false && rule.actionType !== 'warn' && rule.actionType !== 'delete') {
      if (currentWarnings.count + warningIncrement < warningThreshold) {
        actualAction = 'warn';
        shouldWarn = true;
      }
    }
    
    // Log the action if log channel is specified (with edit context)
    if (rule.logChannelId) {
      await logModerationActionForEdit(guild, rule.logChannelId, {
        action: actualAction,
        user: newMessage.author,
        reason: reason,
        rule: rule.name,
        ruleType: ruleType,
        oldContent: oldMessage.content,
        newContent: newMessage.content,
        channel: newMessage.channel,
        deleted: shouldDelete,
        warningCount: currentWarnings.count + (shouldWarn ? warningIncrement : 0),
        warningThreshold: warningThreshold,
        warningIncrement: warningIncrement
      });
    }
    
    // Execute the determined action with edit-specific messaging
    switch (actualAction) {
      case 'warn':
        const newWarningCount = await incrementWarningCount(guildId, userId, ruleType, warningIncrement, store);
        
        await store.recordViolation({
          guildId,
          userId,
          ruleId: rule.id || null,
          ruleType,
          ruleName: rule.name,
          violationReason: reason,
          messageContent: newMessage.content,
          channelId: newMessage.channel.id,
          messageId: newMessage.id,
          actionTaken: 'warn',
          warningIncrement,
          totalWarningsAtTime: newWarningCount,
          thresholdAtTime: warningThreshold,
          isAutoMod: true,
          severity: warningIncrement > 1 ? 'high' : 'medium',
          metadata: JSON.stringify({ 
            editedMessage: true, 
            originalContent: oldMessage.content,
            changeType: determineChangeType(oldMessage.content, newMessage.content),
            editTimestamp: new Date().toISOString()
          })
        });
        
        await warnUserForEdit(newMessage, oldMessage, reason, rule, newWarningCount, warningThreshold, warningIncrement, ruleType);
        
        if (shouldDelete && newMessage.deletable) {
          await newMessage.delete();
        }
        break;
      
      case 'mute':
      case 'kick':
      case 'ban':
        await store.recordViolation({
          guildId,
          userId,
          ruleId: rule.id || null,
          ruleType,
          ruleName: rule.name,
          violationReason: reason,
          messageContent: newMessage.content,
          channelId: newMessage.channel.id,
          messageId: newMessage.id,
          actionTaken: actualAction,
          warningIncrement,
          totalWarningsAtTime: currentWarnings.count + warningIncrement,
          thresholdAtTime: warningThreshold,
          isAutoMod: true,
          severity: 'high',
          metadata: JSON.stringify({ editedMessage: true, originalContent: oldMessage.content })
        });
        
        // Use the same action functions but with edit context
        if (actualAction === 'mute') {
          await muteUserAfterWarnings(newMessage, rule.duration, `${reason} (edited message)`, warningThreshold);
        } else if (actualAction === 'kick') {
          await kickUserAfterWarnings(newMessage, `${reason} (edited message)`, warningThreshold);
        } else if (actualAction === 'ban') {
          await banUserAfterWarnings(newMessage, `${reason} (edited message)`, warningThreshold);
        }
        
        if (!shouldWarn && currentWarnings.count + warningIncrement >= warningThreshold) {
          await resetWarningCount(guildId, userId, ruleType, store);
        }
        
        if (shouldDelete && newMessage.deletable) {
          await newMessage.delete();
        }
        break;
      
      case 'delete':
        await store.recordViolation({
          guildId,
          userId,
          ruleId: rule.id || null,
          ruleType,
          ruleName: rule.name,
          violationReason: reason,
          messageContent: newMessage.content,
          channelId: newMessage.channel.id,
          messageId: newMessage.id,
          actionTaken: 'delete',
          warningIncrement: 0,
          totalWarningsAtTime: currentWarnings.count,
          thresholdAtTime: warningThreshold,
          isAutoMod: true,
          severity: 'low',
          metadata: JSON.stringify({ editedMessage: true, originalContent: oldMessage.content })
        });
        
        try {
          await newMessage.reply({
            embeds: [{
              color: 0xff6b6b,
              title: '✏️ Edited Message Deleted',
              description: `Your edited message was deleted for violating community guidelines.`,
              fields: [
                { name: '🛡️ Rule', value: rule.name, inline: true },
                { name: '⚠️ Reason', value: reason, inline: true },
                { name: '📝 Action', value: 'Message edit detected and removed', inline: true }
              ],
              footer: { text: 'Auto Moderation System' },
              timestamp: new Date().toISOString()
            }]
          });
          
          if (shouldDelete && newMessage.deletable) {
            await newMessage.delete();
          }
          
          await newMessage.author.send({
            embeds: [{
              color: 0xff6b6b,
              title: '✏️ Edited Message Deleted',
              description: `Your edited message in **${newMessage.guild.name}** was deleted for violating community guidelines.`,
              fields: [
                { name: '🛡️ Rule', value: rule.name, inline: true },
                { name: '📋 Channel', value: `#${newMessage.channel.name}`, inline: true },
                { name: '⚠️ Reason', value: reason, inline: false },
                { name: '💡 Tip', value: 'Editing messages to add prohibited content is still monitored', inline: false }
              ],
              footer: { text: 'Auto Moderation System' },
              timestamp: new Date().toISOString()
            }]
          });
        } catch (dmError) {
          console.log(`[AUTO MOD] Could not DM user about deleted edited message: ${dmError.message}`);
        }
        break;
    }
    
  } catch (error) {
    console.error('Error executing auto mod action for edited message:', error);
  }
}

// Warn user with warning count (for edited messages)
async function warnUserForEdit(newMessage, oldMessage, reason, rule, warningCount, warningThreshold, warningIncrement = 1, ruleType = 'general') {
  try {
    let severityInfo = '';
    let severityColor = 0xff9500;
    
    if (warningIncrement > 1) {
      severityInfo = ` (+${warningIncrement} warnings - severe violation)`;
      severityColor = 0xff5722;
    }

    const ruleTypeDisplay = ruleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    const dmEmbed = {
      color: severityColor,
      title: '✏️ Auto Moderation Warning - Edited Message',
      description: `Your edited message in **${newMessage.guild.name}** was flagged for: **${reason}**${severityInfo}`,
      fields: [
        { name: '🛡️ Rule', value: rule.name, inline: true },
        { name: '🔍 Rule Type', value: ruleTypeDisplay, inline: true },
        { name: '📋 Channel', value: `#${newMessage.channel.name}`, inline: true },
        { name: '📊 Warning Count (for this rule)', value: `${warningCount}/${warningThreshold}`, inline: true },
        { name: '💡 Note', value: 'Editing messages to add prohibited content is still monitored', inline: false }
      ],
      footer: { 
        text: warningCount >= warningThreshold ? 
          'Next violation of this rule will result in further action!' : 
          'Please follow the server rules to avoid further action.' 
      },
      timestamp: new Date().toISOString()
    };
    
    if (warningIncrement > 1) {
      dmEmbed.fields.push({
        name: 'Violation Severity',
        value: `This violation added ${warningIncrement} warnings due to its serious nature.`,
        inline: false
      });
    }
    
    const actionText = rule.actionType || 'punished';
    const durationText = rule.duration ? `${rule.duration}` : '1';
    
    const channelEmbed = {
      color: warningCount >= warningThreshold - 1 ? 0xff5722 : severityColor,
      title: warningCount >= warningThreshold - 1 ? '✏️ Final Warning - Edited Message' : (warningIncrement > 1 ? '✏️ Severe Warning - Edited Message' : '✏️ Warning - Edited Message'),
      description: `<@${newMessage.author.id}> received a warning for editing their message to violate community guidelines. Will be **${actionText}** for **${durationText} minute(s)** upon reaching ${warningThreshold} warnings for this rule.`,
      fields: [
        { name: '🛡️ Rule', value: rule.name, inline: true },
        { name: '🔍 Rule Type', value: ruleTypeDisplay, inline: true },
        { name: '⚠️ Reason', value: reason, inline: true },
        { name: '📊 Warning Count', value: `${warningCount}/${warningThreshold} (${ruleTypeDisplay})`, inline: true },
        { name: '📝 Action', value: 'Message edit detected', inline: true }
      ],
      footer: { text: '🔒 Auto Moderation System' },
      timestamp: new Date().toISOString()
    };
    
    if (warningIncrement > 1) {
      channelEmbed.fields.push({
        name: 'Severity',
        value: `+${warningIncrement} warnings`,
        inline: true
      });
    }
    
    await newMessage.reply({ embeds: [channelEmbed] });
    
    try {
      await newMessage.author.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log(`[AUTO MOD] Could not DM user ${newMessage.author.tag}: ${dmError.message}`);
      await newMessage.followUp({
        content: `I couldn't send you a DM. Please check your message settings.`,
        allowedMentions: { users: [newMessage.author.id] }
      });
    }
  } catch (error) {
    console.error('Error warning user for edited message:', error);
  }
}

// Log moderation action for edited messages
async function logModerationActionForEdit(guild, logChannelId, actionData) {
  try {
    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel || !logChannel.isTextBased()) return;
    
    const ruleTypeDisplay = actionData.ruleType ? 
      actionData.ruleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
      'General';
    
    const embed = {
      color: 0xff7043, // Orange color to distinguish from regular mod actions
      title: '🛡️ Auto Moderation Action - Edited Message',
      fields: [
        { name: '👤 User', value: `${actionData.user} (${actionData.user.id})`, inline: true },
        { name: '🔨 Action', value: actionData.action, inline: true },
        { name: '🛡️ Rule', value: actionData.rule, inline: true },
        { name: '🔎 Rule Type', value: ruleTypeDisplay, inline: true },
        { name: '⚠️ Reason', value: actionData.reason, inline: true },
        { name: '📋 Channel', value: `<#${actionData.channel.id}>`, inline: true },
        { name: '💬 Message Deleted', value: actionData.deleted ? 'Yes' : 'No', inline: true },
        { name: '📝 Action Type', value: 'Message Edit Detected', inline: true }
      ],
      footer: { text: 'Auto Moderation System - Edit Monitor' },
      timestamp: new Date().toISOString()
    };
    
    if (actionData.warningCount !== undefined && actionData.warningThreshold !== undefined) {
      embed.fields.push({
        name: 'Warning Progress',
        value: `${actionData.warningCount}/${actionData.warningThreshold} (${ruleTypeDisplay})`,
        inline: true
      });
    }
    
    if (actionData.oldContent || actionData.newContent) {
      embed.fields.push({
        name: 'Content Changes',
        value: `**Before:** ${actionData.oldContent ? (actionData.oldContent.length > 100 ? actionData.oldContent.substring(0, 100) + '...' : actionData.oldContent) : 'No content'}\n\n**After:** ${actionData.newContent ? (actionData.newContent.length > 100 ? actionData.newContent.substring(0, 100) + '...' : actionData.newContent) : 'No content'}`,
        inline: false
      });
    }
    
    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error logging moderation action for edited message:', error);
  }
}

// Import action functions from messageCreate.js (these need to be shared)
async function muteUserAfterWarnings(message, duration, reason, warningThreshold) {
  try {
    const member = message.member;
    if (!member.guild.members.me?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      console.error('Bot lacks permission to moderate members (timeout)');
      return;
    }
    
    const durationMs = duration ? duration * 60 * 1000 : 5 * 60 * 1000;
    const maxDuration = 28 * 24 * 60 * 60 * 1000;
    const finalDuration = Math.min(durationMs, maxDuration);
    
    await member.timeout(finalDuration, `Auto-mod: ${reason} (exceeded ${warningThreshold} warnings)`);
    
    await message.reply({
      embeds: [{
        color: 0xef5350,
        title: '🔇 User Muted - Warning Limit Exceeded (Edited Message)',
        description: `You have been muted for editing your message to violate community guidelines after receiving ${warningThreshold} warnings.`,
        fields: [
          { name: '⏰ Duration', value: `${Math.round(finalDuration / 60000)} minutes`, inline: true },
          { name: '⚠️ Reason', value: reason, inline: true },
          { name: '📊 Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
        ],
        footer: { text: 'Auto Moderation System - Warning counter reset' },
        timestamp: new Date().toISOString()
      }]
    });
    
    try {
      await member.user.send({
        embeds: [{
          color: 0xef5350,
          title: '🔇 You Have Been Muted - Warning Limit Exceeded (Edited Message)',
          description: `You have been muted in **${member.guild.name}** for ${Math.round(finalDuration / 60000)} minutes after editing your message to violate guidelines.`,
          fields: [
            { name: '⚠️ Reason', value: reason, inline: true },
            { name: '🌐 Server', value: member.guild.name, inline: true },
            { name: '📊 Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
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

async function kickUserAfterWarnings(message, reason, warningThreshold) {
  try {
    const member = message.member;
    if (!member.guild.members.me?.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      console.error('Bot lacks permission to kick members');
      return;
    }
    
    await message.reply({
      embeds: [{
        color: 0xf44336,
        title: '👢 User Kicked - Warning Limit Exceeded (Edited Message)',
        description: `You have been kicked for editing your message to violate community guidelines after receiving ${warningThreshold} warnings.`,
        fields: [
          { name: '⚠️ Reason', value: reason, inline: true },
          { name: '📊 Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
        ],
        footer: { text: 'Auto Moderation System - Warning counter reset' },
        timestamp: new Date().toISOString()
      }]
    });
    
    try {
      await member.user.send({
        embeds: [{
          color: 0xf44336,
          title: '👢 You Have Been Kicked - Warning Limit Exceeded (Edited Message)',
          description: `You have been kicked from **${member.guild.name}** for editing your message to violate guidelines.`,
          fields: [
            { name: '⚠️ Reason', value: reason, inline: true },
            { name: '🌐 Server', value: member.guild.name, inline: true },
            { name: '📊 Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
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

async function banUserAfterWarnings(message, reason, warningThreshold) {
  try {
    const member = message.member;
    if (!member.guild.members.me?.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      console.error('Bot lacks permission to ban members');
      return;
    }
    
    await message.reply({
      embeds: [{
        color: 0xd32f2f,
        title: '⛔ User Banned - Warning Limit Exceeded (Edited Message)',
        description: `You have been banned for editing your message to violate community guidelines after receiving ${warningThreshold} warnings.`,
        fields: [
          { name: '⚠️ Reason', value: reason, inline: true },
          { name: '📊 Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
        ],
        footer: { text: 'Auto Moderation System - Warning counter reset' },
        timestamp: new Date().toISOString()
      }]
    });
    
    try {
      await member.user.send({
        embeds: [{
          color: 0xd32f2f,
          title: '⛔ You Have Been Banned - Warning Limit Exceeded (Edited Message)',
          description: `You have been banned from **${member.guild.name}** for editing your message to violate guidelines.`,
          fields: [
            { name: '⚠️ Reason', value: reason, inline: true },
            { name: '🌐 Server', value: member.guild.name, inline: true },
            { name: '📊 Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
          ],
          footer: { text: 'Auto Moderation System - Warning counter reset' },
          timestamp: new Date().toISOString()
        }]
      });
    } catch (dmError) {
      console.log(`[AUTO MOD] Could not DM user before ban: ${dmError.message}`);
    }
    
    await member.ban({ reason: `Auto-mod: ${reason} (exceeded ${warningThreshold} warnings)`, deleteMessageDays: 1 });
    
    const channel = member.guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(member.guild.members.me).has('SendMessages'));
    
    if (channel) {
      await channel.send({
        embeds: [{
          color: 0xd32f2f,
          title: '⛔ User Banned - Warning Limit Exceeded (Edited Message)',
          description: `${member.user.tag} has been banned for editing their message to violate guidelines.`,
          fields: [
            { name: '⚠️ Reason', value: reason, inline: true },
            { name: '👤 User ID', value: member.user.id, inline: true },
            { name: '📊 Warnings Given', value: `${warningThreshold}/${warningThreshold}`, inline: true }
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
