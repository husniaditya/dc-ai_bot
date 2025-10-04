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

// Fetch CWL league group information
async function fetchCWLLeagueGroup(clanTag) {
  if (!COC_API_TOKEN) return null;
  
  const cleanTag = cleanClanTag(clanTag);
  if (!cleanTag) return null;
  
  cocStats.apiCalls++;
  pushDebug(`API_CALL: Fetching CWL league group for ${formatClanTag(cleanTag)}`);
  
  const url = `https://api.clashofclans.com/v1/clans/%23${encodeURIComponent(cleanTag)}/currentwar/leaguegroup`;
  
  try {
    const res = await fetchFn(url, {
      headers: {
        'Authorization': `Bearer ${COC_API_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    
    if (!res.ok) {
      if (res.status === 404) {
        pushDebug(`CWL_NOT_FOUND: Clan ${formatClanTag(cleanTag)} not in CWL`);
        return null;
      }
      if (res.status === 429) {
        cocStats.quotaErrors++;
        pushDebug(`RATE_LIMITED: COC API rate limit exceeded for CWL`);
        return null;
      }
      pushDebug(`CWL_API_ERROR: ${res.status} for clan ${formatClanTag(cleanTag)}`);
      cocStats.totalErrors++;
      return null;
    }
    
    const leagueData = await res.json();
    pushDebug(`CWL_FETCHED: ${leagueData.season} - ${leagueData.clans?.length || 0} clans`);
    return leagueData;
  } catch (error) {
    cocStats.totalErrors++;
    pushDebug(`CWL_FETCH_ERROR: ${error.message} for clan ${formatClanTag(cleanTag)}`);
    return null;
  }
}

// Fetch specific CWL war by war tag
async function fetchCWLWar(warTag) {
  if (!COC_API_TOKEN) return null;
  
  if (!warTag || !warTag.startsWith('#')) {
    pushDebug(`INVALID_WAR_TAG: ${warTag}`);
    return null;
  }
  
  const cleanWarTag = warTag.replace(/^#/, '');
  cocStats.apiCalls++;
  pushDebug(`API_CALL: Fetching CWL war ${warTag}`);
  
  const url = `https://api.clashofclans.com/v1/clanwarleagues/wars/%23${encodeURIComponent(cleanWarTag)}`;
  
  try {
    const res = await fetchFn(url, {
      headers: {
        'Authorization': `Bearer ${COC_API_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    
    if (!res.ok) {
      if (res.status === 404) {
        pushDebug(`CWL_WAR_NOT_FOUND: ${warTag}`);
        return null;
      }
      if (res.status === 429) {
        cocStats.quotaErrors++;
        pushDebug(`RATE_LIMITED: COC API rate limit exceeded for CWL war`);
        return null;
      }
      pushDebug(`CWL_WAR_API_ERROR: ${res.status} for war ${warTag}`);
      cocStats.totalErrors++;
      return null;
    }
    
    const warData = await res.json();
    pushDebug(`CWL_WAR_FETCHED: ${warData.clan?.name || 'Unknown'} vs ${warData.opponent?.name || 'Unknown'} - ${warData.state}`);
    return warData;
  } catch (error) {
    cocStats.totalErrors++;
    pushDebug(`CWL_WAR_FETCH_ERROR: ${error.message} for war ${warTag}`);
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
    case 'war_declared':
      embed.title = '⚔️ War Declared!';
      embed.description = `War has been declared against **${data.warOpponent}**`;
      embed.color = 0xFFA500; // Orange color for declaration
      embed.fields = [
        { name: 'Our Clan', value: `${data.clanName} (${data.clanTag})`, inline: true },
        { name: 'Enemy Clan', value: `${data.warOpponent} (${data.warOpponentTag})`, inline: true },
        { name: 'Enemy Level', value: `Level ${data.warOpponentLevel}`, inline: true },
        { name: 'Enemy Members', value: `${data.warOpponentMembers}/50`, inline: true },
        { name: 'Preparation Time', value: data.preparationTimeRemaining || 'Calculating...', inline: true },
        { name: 'War Size', value: `${data.warSize}vs${data.warSize}`, inline: true }
      ];
      
      // Add enemy war statistics if available
      if (data.warOpponentWinStreak !== undefined || data.warOpponentWinRate !== undefined) {
        if (data.warOpponentWinStreak !== undefined) {
          embed.fields.push({ name: 'Enemy Win Streak', value: `${data.warOpponentWinStreak} wins`, inline: true });
        }
        if (data.warOpponentWinRate !== undefined) {
          embed.fields.push({ name: 'Enemy Win Rate', value: `${data.warOpponentWinRate}%`, inline: true });
        }
      }
      
      if (data.warOpponentDescription) {
        embed.fields.push({ name: 'Enemy Description', value: data.warOpponentDescription.slice(0, 1024), inline: false });
      }
      break;
      
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
      
    case 'donation_leaderboard':
      embed.title = '📊 Donation Leaderboard';
      embed.description = `**${data.clanName}** Donation Statistics`;
      embed.color = 0x1E90FF; // Blue
      if (data.leaderboardImage) {
        embed.image = { url: 'attachment://donation_leaderboard.png' };
      }
      embed.fields = [
        { name: 'Clan', value: `${data.clanName} (${data.clanTag})`, inline: true },
        { name: 'Season', value: data.season || 'Current', inline: true },
        { name: 'Last Updated', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      ];
      break;
  }
  
  return embed;
}

// Helper function to get clan-specific mention targets
async function getClanSpecificMentionTargets(config, data, eventType) {
  // If we have per-clan configuration and a specific clan tag, use it
  if (data && data.clanTag && config.guildId) {
    try {
      // Import the new service here to avoid circular imports
      const clashOfClansService = require('../../config/store/services/clashofclans-updated');
      const clanMentions = await clashOfClansService.getClanMentionTargets(config.guildId, data.clanTag, eventType);
      if (clanMentions && clanMentions.length > 0) {
        return clanMentions;
      }
    } catch (error) {
      console.error('Error getting clan-specific mention targets:', error);
    }
  }
  
  // Fallback to global mention targets
  switch (eventType) {
    case 'war':
      return config.mentionTargets || config.warMentionTarget?.split(',').filter(Boolean) || [];
    case 'member':
      return config.mentionTargets || config.memberMentionTarget?.split(',').filter(Boolean) || [];
    case 'donation':
      return config.mentionTargets || config.donationMentionTarget?.split(',').filter(Boolean) || [];
    default:
      return config.mentionTargets || [];
  }
}

// Send announcement to Discord channel
async function announce(guild, config, data, type) {
  try {
    // console.log(`[COC] announce() called with type: ${type}, guild: ${guild.id}, clanTag: ${data.clanTag}`);
    
    let channelId, template, mentionTargets;
    
    // Helper function to get clan-specific channel ID from database
    async function getClanSpecificChannelId(clanTag, fallbackChannelId) {
      if (!clanTag) return fallbackChannelId;
      
      try {
        const store = require('../../config/store');
        const [rows] = await store.sqlPool.execute(
          'SELECT war_announce_channel_id FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
          [guild.id, clanTag.replace(/^#/, '').toUpperCase()]
        );
        
        if (rows.length > 0 && rows[0].war_announce_channel_id) {
          // console.log(`[COC] Using clan-specific channel ${rows[0].war_announce_channel_id} for clan ${clanTag}`);
          return rows[0].war_announce_channel_id;
        }
      } catch (error) {
        console.warn(`[COC] Error getting clan-specific channel for ${clanTag}:`, error.message);
      }
      
      // console.log(`[COC] Using fallback channel ${fallbackChannelId} for clan ${clanTag}`);
      return fallbackChannelId;
    }
    
    // Determine channel and template based on announcement type
    switch (type) {
      case 'war_declared':
        channelId = await getClanSpecificChannelId(data.clanTag, config.warAnnounceChannelId);
        template = config.warDeclaredTemplate || 'War declared against {warOpponent}!';
        mentionTargets = await getClanSpecificMentionTargets(config, data, 'war');
        console.log(`[COC] war_declared: channelId=${channelId}, template="${template}", warAnnounceChannelId=${config.warAnnounceChannelId}`);
        break;
      case 'war_start':
      case 'war_end':
        channelId = await getClanSpecificChannelId(data.clanTag, config.warAnnounceChannelId);
        template = type === 'war_start' ? config.warStartTemplate : config.warEndTemplate;
        mentionTargets = await getClanSpecificMentionTargets(config, data, 'war');
        break;
      case 'member_join':
      case 'member_leave':
        channelId = config.memberAnnounceChannelId;
        template = config.memberJoinTemplate;
        mentionTargets = await getClanSpecificMentionTargets(config, data, 'member');
        break;
      case 'donation_milestone':
        channelId = config.donationAnnounceChannelId;
        template = config.donationTemplate;
        mentionTargets = await getClanSpecificMentionTargets(config, data, 'donation');
        break;
      case 'donation_leaderboard':
        channelId = config.donationLeaderboardChannelId || config.donationAnnounceChannelId;
        template = config.donationLeaderboardTemplate || 'Weekly donation leaderboard update!';
        mentionTargets = await getClanSpecificMentionTargets(config, data, 'donation');
        break;
      default:
        pushDebug(`UNKNOWN_TYPE: Unknown announcement type ${type}`);
        return;
    }
    
    if (!channelId) {
      console.warn(`[COC] NO_CHANNEL: No channel configured for ${type} (config.warAnnounceChannelId: ${config.warAnnounceChannelId})`);
      pushDebug(`NO_CHANNEL: No channel configured for ${type}`);
      return;
    }
    
    // console.log(`[COC] Looking for channel: ${channelId}`);
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      // console.warn(`[COC] CHANNEL_NOT_FOUND: Channel ${channelId} not found for ${type}`);
      pushDebug(`CHANNEL_NOT_FOUND: Channel ${channelId} not found for ${type}`);
      return;
    }
    
    // console.log(`[COC] Found channel: #${channel.name} (${channel.id})`);
    
    // Build role mention string
    const roleMention = buildRoleMention(mentionTargets, guild);
    // console.log(`[COC] Role mention: "${roleMention}"`);
    
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
    
    // console.log(`[COC] Message content: "${content}"`);
    
    // Prepare message options
    const messageOptions = { 
      content: content || undefined,
      files: []
    };
    
    // Add embed if enabled
    if (config.embedEnabled || type === 'donation_leaderboard') {
      messageOptions.embeds = [createCOCEmbed(templateData, type, config)];
      // console.log(`[COC] Adding embed (embedEnabled: ${config.embedEnabled})`);
    }
    
    // Add leaderboard image if present
    if (type === 'donation_leaderboard' && data.leaderboardBuffer) {
      messageOptions.files.push({
        attachment: data.leaderboardBuffer,
        name: 'donation_leaderboard.png'
      });
    }

    // Handle donation leaderboard message updates
    if (type === 'donation_leaderboard') {
      let message = null;
      
      // Try to fetch and update existing message if we have a message ID
      if (config.donationMessageId) {
        try {
          message = await channel.messages.fetch(config.donationMessageId);
          if (message) {
            // Update existing message
            await message.edit(messageOptions);
            pushDebug(`UPDATED: ${type} message ${config.donationMessageId} in #${channel.name} for clan ${data.clanTag}`);
            cocStats.totalAnnouncements++;
            return { messageId: message.id, updated: true };
          }
        } catch (error) {
          // Message not found or couldn't fetch - will create new one
          pushDebug(`MESSAGE_NOT_FOUND: Could not fetch message ${config.donationMessageId}, creating new one: ${error.message}`);
        }
      }
      
      // Create new message if no existing message or update failed
      message = await channel.send(messageOptions);
      pushDebug(`ANNOUNCED: ${type} new message ${message.id} in #${channel.name} for clan ${data.clanTag}`);
      cocStats.totalAnnouncements++;
      
      // Return the message ID so the watcher can save it
      return { messageId: message.id, updated: false };
    } else {
      // For non-leaderboard messages, just send normally
      // console.log(`[COC] Sending ${type} message with options:`, JSON.stringify(messageOptions, null, 2));
      const sentMessage = await channel.send(messageOptions);
      // console.log(`[COC] Successfully sent ${type} message ${sentMessage.id} in #${channel.name}`);
      cocStats.totalAnnouncements++;
      pushDebug(`ANNOUNCED: ${type} in #${channel.name} for clan ${data.clanTag}`);
    }
  } catch (error) {
    console.error(`[COC] ANNOUNCE_ERROR: ${error.message} for ${type}`, error.stack);
    cocStats.totalErrors++;
    pushDebug(`ANNOUNCE_ERROR: ${error.message} for ${type}`);
  }
}

// Generate donation leaderboard image buffer (similar to the image shown)
async function generateDonationLeaderboard(clanInfo, options = {}) {
  try {
    // Import canvas only when needed (optional dependency)
    let Canvas;
    try {
      Canvas = require('canvas');
    } catch (err) {
      pushDebug(`CANVAS_NOT_AVAILABLE: Cannot generate leaderboard image - canvas not installed`);
      return null;
    }
    
    const { createCanvas } = Canvas;
    
    // Sort members by donations (descending)
    const sortedMembers = [...(clanInfo.memberList || [])]
      .sort((a, b) => (b.donations || 0) - (a.donations || 0))
      .slice(0, 50); // Limit to 50 members maximum
    
    if (sortedMembers.length === 0) {
      pushDebug(`NO_MEMBERS: No members to generate leaderboard for`);
      return null;
    }
    
    // Calculate layout
    const membersPerColumn = 25;
    const leftColumn = sortedMembers.slice(0, membersPerColumn);
    const rightColumn = sortedMembers.slice(membersPerColumn);
    
    // Canvas dimensions
    const width = 800;
    const height = Math.max(600, leftColumn.length * 22 + 120);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#2C2F33';
    ctx.fillRect(0, 0, width, height);
    
    // Header background
    ctx.fillStyle = '#5865F2';
    ctx.fillRect(0, 0, width, 80);
    
    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Donation Leaderboard', width / 2, 35);
    
    // Subtitle with clan name
    ctx.font = '16px Arial';
    ctx.fillText(`${clanInfo.name || 'Unknown Clan'} • Season ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`, width / 2, 60);
    
    // Helper function to draw member row
    function drawMemberRow(member, index, x, y) {
      const rowY = y + (index * 22);
      const isOddRow = index % 2 === 1;
      
      // Row background (alternating colors)
      ctx.fillStyle = isOddRow ? '#36393F' : '#40444B';
      ctx.fillRect(x, rowY - 2, 380, 20);
      
      // Rank
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      const globalRank = index < membersPerColumn ? index + 1 : index + 1;
      ctx.fillText(`${globalRank}.`, x + 5, rowY + 12);
      
      // Player name (truncate if too long)
      let playerName = member.name || 'Unknown';
      if (playerName.length > 12) {
        playerName = playerName.substring(0, 12) + '...';
      }
      ctx.fillText(playerName, x + 25, rowY + 12);
      
      // Donations
      const donations = member.donations || 0;
      ctx.textAlign = 'right';
      ctx.fillText(donations.toLocaleString(), x + 120, rowY + 12);
      
      // Donations received
      const received = member.donationsReceived || 0;
      ctx.fillText(received.toLocaleString(), x + 180, rowY + 12);
      
      // Ratio
      const ratio = received > 0 ? (donations / received).toFixed(2) : (donations > 0 ? '∞' : '0.00');
      ctx.fillText(ratio, x + 240, rowY + 12);
      
      // Last online (simplified)
      const lastSeen = member.lastSeen;
      let lastSeenText = 'Unknown';
      
      if (lastSeen && lastSeen !== 'Unknown') {
        try {
          // Parse ISO date or other format
          const date = new Date(lastSeen);
          if (!isNaN(date.getTime())) {
            const now = new Date();
            const diffMs = now - date;
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffMinutes < 60) {
              lastSeenText = diffMinutes <= 1 ? 'Now' : `${diffMinutes}m ago`;
            } else if (diffHours < 24) {
              lastSeenText = `${diffHours}h ago`;
            } else if (diffDays === 1) {
              lastSeenText = '1d ago';
            } else if (diffDays < 30) {
              lastSeenText = `${diffDays}d ago`;
            } else {
              const diffMonths = Math.floor(diffDays / 30);
              lastSeenText = `${diffMonths}mo ago`;
            }
          }
        } catch (error) {
          console.warn('Error parsing lastSeen date:', lastSeen, error);
          lastSeenText = 'Unknown';
        }
      }
      
      ctx.fillText(lastSeenText, x + 360, rowY + 12);
    }
    
    // Column headers
    const headerY = 100;
    
    // Left column header
    ctx.fillStyle = '#5865F2';
    ctx.fillRect(10, headerY - 5, 380, 20);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('#', 15, headerY + 8);
    ctx.fillText('Player Name', 30, headerY + 8);
    ctx.textAlign = 'right';
    ctx.fillText('Dons', 125, headerY + 8);
    ctx.fillText('Rec', 185, headerY + 8);
    ctx.fillText('Ratio', 245, headerY + 8);
    ctx.fillText('Last On', 365, headerY + 8);
    
    // Right column header (if needed)
    if (rightColumn.length > 0) {
      ctx.fillStyle = '#5865F2';
      ctx.fillRect(410, headerY - 5, 380, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText('#', 415, headerY + 8);
      ctx.fillText('Player Name', 430, headerY + 8);
      ctx.textAlign = 'right';
      ctx.fillText('Dons', 525, headerY + 8);
      ctx.fillText('Rec', 585, headerY + 8);
      ctx.fillText('Ratio', 645, headerY + 8);
      ctx.fillText('Last On', 765, headerY + 8);
    }
    
    // Draw member rows
    leftColumn.forEach((member, index) => {
      drawMemberRow(member, index, 10, 125);
    });
    
    rightColumn.forEach((member, index) => {
      drawMemberRow(member, index + membersPerColumn, 410, 125);
    });
    
    // Footer
    const footerY = height - 25;
    ctx.fillStyle = '#72767D';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Last Updated • ${new Date().toLocaleString()}`, width / 2, footerY);
    
    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    pushDebug(`LEADERBOARD_GENERATED: ${sortedMembers.length} members for ${clanInfo.name}`);
    return buffer;
    
  } catch (error) {
    pushDebug(`LEADERBOARD_ERROR: ${error.message}`);
    return null;
  }
}

//Get COC stats for debugging
function getCOCStats() {
  return {
    ...cocStats,
    hasApiToken: !!COC_API_TOKEN,
    stateKeys: 0 // Will be updated by watcher
  };
}

// Helper function to update donation message ID
async function updateDonationMessageId(guildId, messageId) {
  try {
    const store = require('../../config/store');
    const currentConfig = await store.getGuildClashOfClansConfig(guildId);
    await store.setGuildClashOfClansConfig(guildId, {
      ...currentConfig,
      donationMessageId: messageId
    });
    pushDebug(`UPDATED_MESSAGE_ID: Set donation message ID to ${messageId} for guild ${guildId}`);
    return true;
  } catch (error) {
    pushDebug(`ERROR_UPDATING_MESSAGE_ID: ${error.message} for guild ${guildId}`);
    return false;
  }
}

module.exports = {
  fetchClanInfo,
  fetchClanWar,
  fetchCWLLeagueGroup,
  fetchCWLWar,
  announce,
  cleanClanTag,
  formatClanTag,
  buildRoleMention,
  replacePlaceholders,
  createCOCEmbed,
  generateDonationLeaderboard,
  updateDonationMessageId,
  getCOCStats,
  cocStats,
  pushDebug
};