// Clash of Clans service - Core API functions and utilities for COC integration
// This service provides the foundational API calls and data processing for COC features
const store = require('../../config/store');

// Use global fetch (Node 18+) with fallback to dynamic import if unavailable
let fetchFn;
if (typeof globalThis.fetch === 'function') fetchFn = (...a)=> globalThis.fetch(...a);
else {
	try { fetchFn = (...a)=> require('node-fetch')(...a); } catch { fetchFn = ()=> { throw new Error('fetch not available'); }; }
}

// Initialize COC API token
const COC_API_TOKEN = process.env.COC_API_TOKEN;

// COC statistics and debug events (shared across watcher and commands)
const cocStats = {
	started: Date.now(),
	totalPolls: 0,
	totalAnnouncements: 0,
	totalErrors: 0,
	apiCalls: 0,
	quotaErrors: 0,
	lastPoll: null,
	// Detailed breakdowns
	clanApiCalls: 0,
	membersCalls: 0,
	warCalls: 0,
	cacheHits: 0,
	_debugEvents: [] // ring buffer of recent debug events
};

function pushDebug(evt){
	if(process.env.COC_DEBUG_EVENTS !== '1') return; // opt-in
	try {
		const line = `[${new Date().toISOString()}] ${evt}`.slice(0,500);
		cocStats._debugEvents.push(line);
		if(cocStats._debugEvents.length > 200) cocStats._debugEvents.splice(0, cocStats._debugEvents.length - 200);
	} catch {}
}

// Clean clan tag - remove # and ensure uppercase
function cleanClanTag(tag) {
  if (!tag) return '';
  return tag.replace(/^#/, '').toUpperCase();
}

// Format clan tag for display
function formatClanTag(tag) {
  return tag ? `#${cleanClanTag(tag)}` : '';
}

// Fetch clan information from COC API
async function fetchClanInfo(clanTag) {
  if (!COC_API_TOKEN) {
    pushDebug(`ERROR: No COC API token configured`);
    return null;
  }
  
  const cleanTag = cleanClanTag(clanTag);
  if (!cleanTag) {
    pushDebug(`ERROR: Invalid clan tag: ${clanTag}`);
    return null;
  }
  
  cocStats.apiCalls++;
  cocStats.clanApiCalls++;
  pushDebug(`API_CALL: Fetching clan info for ${formatClanTag(cleanTag)}`);
  
  const url = `https://api.clashofclans.com/v1/clans/%23${encodeURIComponent(cleanTag)}`;
  
  try {
    const res = await fetchFn(url, {
      headers: {
        'Authorization': `Bearer ${COC_API_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    
    if (!res.ok) {
      if (res.status === 404) {
        pushDebug(`CLAN_NOT_FOUND: ${formatClanTag(cleanTag)}`);
        return null;
      }
      if (res.status === 429) {
        cocStats.quotaErrors++;
        pushDebug(`RATE_LIMITED: COC API rate limit exceeded`);
        return null;
      }
      pushDebug(`API_ERROR: ${res.status} for clan ${formatClanTag(cleanTag)}`);
      cocStats.totalErrors++;
      return null;
    }
    
    const clanData = await res.json();
    pushDebug(`CLAN_FETCHED: ${clanData.name} (${formatClanTag(cleanTag)}) - ${clanData.members} members`);
    return clanData;
  } catch (error) {
    cocStats.totalErrors++;
    pushDebug(`FETCH_ERROR: ${error.message} for clan ${formatClanTag(cleanTag)}`);
    return null;
  }
}

// Fetch clan war information
async function fetchClanWar(clanTag) {
  if (!COC_API_TOKEN) return null;
  
  const cleanTag = cleanClanTag(clanTag);
  if (!cleanTag) return null;
  
  cocStats.apiCalls++;
  cocStats.warCalls++;
  pushDebug(`API_CALL: Fetching war info for ${formatClanTag(cleanTag)}`);
  
  const url = `https://api.clashofclans.com/v1/clans/%23${encodeURIComponent(cleanTag)}/currentwar`;
  
  try {
    const res = await fetchFn(url, {
      headers: {
        'Authorization': `Bearer ${COC_API_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    
    if (!res.ok) {
      if (res.status === 404) {
        pushDebug(`WAR_NOT_FOUND: No active war for ${formatClanTag(cleanTag)}`);
        return null;
      }
      if (res.status === 429) {
        cocStats.quotaErrors++;
        pushDebug(`RATE_LIMITED: COC API rate limit exceeded for war`);
        return null;
      }
      pushDebug(`WAR_API_ERROR: ${res.status} for clan ${formatClanTag(cleanTag)}`);
      cocStats.totalErrors++;
      return null;
    }
    
    const warData = await res.json();
    
    // Only return if there's an active war
    if (warData.state === 'notInWar') {
      pushDebug(`NO_WAR: ${formatClanTag(cleanTag)} not in war`);
      return null;
    }
    
    pushDebug(`WAR_FETCHED: ${warData.clan.name} vs ${warData.opponent.name} - ${warData.state}`);
    return warData;
  } catch (error) {
    cocStats.totalErrors++;
    pushDebug(`WAR_FETCH_ERROR: ${error.message} for clan ${formatClanTag(cleanTag)}`);
    return null;
  }
}

// Build role mention string from mention targets
function buildRoleMention(mentionTargets = [], guild) {
  if (!Array.isArray(mentionTargets) || !mentionTargets.length) return '';
  
  const mentions = [];
  
  for (const target of mentionTargets) {
    if (!target) continue;
    
    // Handle role mentions
    if (target.startsWith('<@&') && target.endsWith('>')) {
      mentions.push(target);
    } else if (/^\d{17,19}$/.test(target)) {
      // Raw role ID
      const role = guild?.roles?.cache?.get(target);
      if (role) {
        mentions.push(`<@&${target}>`);
      }
    }
    // Handle user mentions  
    else if (target.startsWith('<@') && target.endsWith('>')) {
      mentions.push(target);
    }
  }
  
  return mentions.join(' ');
}

// Replace placeholders in message templates
function replacePlaceholders(template, data) {
  if (!template) return '';
  
  return template
    .replace(/\{clanName\}/g, data.clanName || 'Unknown Clan')
    .replace(/\{clanTag\}/g, data.clanTag || '#UNKNOWN')
    .replace(/\{memberCount\}/g, data.memberCount || '0')
    .replace(/\{warOpponent\}/g, data.warOpponent || 'Unknown')
    .replace(/\{warResult\}/g, data.warResult || 'Unknown')
    .replace(/\{warStars\}/g, data.warStars || '0')
    .replace(/\{warDestructionPercentage\}/g, data.warDestructionPercentage || '0%')
    .replace(/\{warEndTime\}/g, data.warEndTime || 'Unknown')
    .replace(/\{playerName\}/g, data.playerName || 'Unknown Player')
    .replace(/\{donationCount\}/g, data.donationCount || '0')
    .replace(/\{roleNames\}/g, data.roleNames || '')
    .replace(/\{roleMention\}/g, data.roleMention || '');
}

// Create Discord embed for COC announcements
function createCOCEmbed(data, type, config) {
  const embed = {
    timestamp: new Date().toISOString(),
    footer: { text: 'Clash of Clans' }
  };
  
  switch (type) {
    case 'war_start':
      embed.title = '⚔️ War Started!';
      embed.description = `War has begun against **${data.warOpponent}**`;
      embed.color = 0xFF6B35; // Orange
      embed.fields = [
        { name: 'Clan', value: `${data.clanName} (${data.clanTag})`, inline: true },
        { name: 'Opponent', value: data.warOpponent, inline: true },
        { name: 'War Ends', value: data.warEndTime, inline: true }
      ];
      break;
      
    case 'war_end':
      const warColor = data.warResult === 'win' ? 0x00FF00 : data.warResult === 'lose' ? 0xFF0000 : 0xFFFF00;
      embed.title = data.warResult === 'win' ? '🏆 Victory!' : data.warResult === 'lose' ? '💀 Defeat' : '🤝 Tie';
      embed.description = `War ended against **${data.warOpponent}**`;
      embed.color = warColor;
      embed.fields = [
        { name: 'Clan', value: `${data.clanName} (${data.clanTag})`, inline: true },
        { name: 'Result', value: data.warResult?.toUpperCase() || 'UNKNOWN', inline: true },
        { name: 'Stars', value: data.warStars, inline: true },
        { name: 'Destruction', value: data.warDestructionPercentage, inline: true }
      ];
      break;
      
    case 'member_join':
      embed.title = '👋 New Member!';
      embed.description = `**${data.playerName}** joined the clan`;
      embed.color = 0x00FF00; // Green
      embed.fields = [
        { name: 'Clan', value: `${data.clanName} (${data.clanTag})`, inline: true },
        { name: 'Members', value: data.memberCount, inline: true }
      ];
      break;
      
    case 'member_leave':
      embed.title = '👋 Member Left';
      embed.description = `**${data.playerName}** left the clan`;
      embed.color = 0xFF0000; // Red
      embed.fields = [
        { name: 'Clan', value: `${data.clanName} (${data.clanTag})`, inline: true },
        { name: 'Members', value: data.memberCount, inline: true }
      ];
      break;
      
    case 'donation_milestone':
      embed.title = '🎁 Donation Milestone!';
      embed.description = `**${data.playerName}** reached ${data.donationCount} donations`;
      embed.color = 0x9370DB; // Purple
      embed.fields = [
        { name: 'Clan', value: `${data.clanName} (${data.clanTag})`, inline: true },
        { name: 'Donations', value: data.donationCount, inline: true }
      ];
      break;
  }
  
  return embed;
}

// Send announcement to Discord channel
async function announce(guild, config, data, type) {
  try {
    let channelId, template, mentionTargets;
    
    // Determine channel and template based on announcement type
    switch (type) {
      case 'war_start':
      case 'war_end':
        channelId = config.warAnnounceChannelId;
        template = type === 'war_start' ? config.warStartTemplate : config.warEndTemplate;
        mentionTargets = config.mentionTargets || config.warMentionTarget?.split(',').filter(Boolean) || [];
        break;
      case 'member_join':
      case 'member_leave':
        channelId = config.memberAnnounceChannelId;
        template = config.memberJoinTemplate;
        mentionTargets = config.mentionTargets || config.memberMentionTarget?.split(',').filter(Boolean) || [];
        break;
      case 'donation_milestone':
        channelId = config.donationAnnounceChannelId;
        template = config.donationTemplate;
        mentionTargets = config.mentionTargets || config.donationMentionTarget?.split(',').filter(Boolean) || [];
        break;
      default:
        pushDebug(`UNKNOWN_TYPE: Unknown announcement type ${type}`);
        return;
    }
    
    if (!channelId) {
      pushDebug(`NO_CHANNEL: No channel configured for ${type}`);
      return;
    }
    
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      pushDebug(`CHANNEL_NOT_FOUND: Channel ${channelId} not found for ${type}`);
      return;
    }
    
    // Build role mention string
    const roleMention = buildRoleMention(mentionTargets, guild);
    
    // Prepare data for placeholder replacement
    const templateData = {
      ...data,
      roleMention,
      roleNames: mentionTargets.map(t => {
        if (t.startsWith('<@&') && t.endsWith('>')) {
          const roleId = t.slice(3, -1);
          const role = guild.roles.cache.get(roleId);
          return role ? role.name : t;
        }
        return t;
      }).join(', ')
    };
    
    // Build message content
    let content = '';
    if (template) {
      content = replacePlaceholders(template, templateData);
    }
    if (roleMention && !content.includes(roleMention)) {
      content = roleMention + (content ? '\n' + content : '');
    }
    
    // Prepare message options
    const messageOptions = { content: content || undefined };
    
    // Add embed if enabled
    if (config.embedEnabled) {
      messageOptions.embeds = [createCOCEmbed(templateData, type, config)];
    }
    
    // Send message
    await channel.send(messageOptions);
    cocStats.totalAnnouncements++;
    pushDebug(`ANNOUNCED: ${type} in #${channel.name} for clan ${data.clanTag}`);
    
  } catch (error) {
    cocStats.totalErrors++;
    pushDebug(`ANNOUNCE_ERROR: ${error.message} for ${type}`);
  }
}

// Get COC stats for debugging
function getCOCStats() {
  return {
    ...cocStats,
    hasApiToken: !!COC_API_TOKEN,
    stateKeys: 0 // Will be updated by watcher
  };
}

module.exports = {
  fetchClanInfo,
  fetchClanWar,
  announce,
  cleanClanTag,
  formatClanTag,
  buildRoleMention,
  replacePlaceholders,
  createCOCEmbed,
  getCOCStats,
  cocStats,
  pushDebug
};