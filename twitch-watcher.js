// Twitch watcher: polls configured streamers per guild and announces when they go live.
const store = require('./config/store');

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

// Access token cache
let accessToken = null;
let tokenExpiry = 0;

// Debug events for dashboard display
const debugEvents = [];
function pushDebug(msg, type = 'info') {
  const event = { time: new Date().toISOString(), type, message: msg };
  debugEvents.push(event);
  if (debugEvents.length > 200) debugEvents.shift(); // cap at 200 events
  if (process.env.TWITCH_DEBUG === '1') console.log(`[TWITCH-DEBUG] ${msg}`);
}

// Rate limiting and error handling
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;
let lastErrorTime = 0;

// Track live status to avoid duplicate notifications
const liveStreamersCache = new Map(); // guildId -> Set of live streamer usernames

// Get OAuth token for Twitch API
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }
  
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      })
    });
    
    const data = await response.json();
    if (data.access_token) {
      accessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer
      pushDebug(`OAuth token refreshed, expires in ${data.expires_in} seconds`);
      return accessToken;
    } else {
      throw new Error('No access token received');
    }
  } catch (error) {
    pushDebug(`Failed to get OAuth token: ${error.message}`, 'error');
    throw error;
  }
}

// Check if streamers are live
async function checkStreamersLive(streamers) {
  if (!streamers || streamers.length === 0) return [];
  
  try {
    const token = await getAccessToken();
    const usernames = streamers.map(s => s.toLowerCase()).join('&user_login=');
    const url = `https://api.twitch.tv/helix/streams?user_login=${usernames}`;
    
    const response = await fetch(url, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`API response ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    pushDebug(`Failed to check live streams: ${error.message}`, 'error');
    throw error;
  }
}

// Get streamer info (display names, etc.)
async function getStreamerInfo(streamers) {
  if (!streamers || streamers.length === 0) return {};
  
  try {
    const token = await getAccessToken();
    const usernames = streamers.map(s => s.toLowerCase()).join('&login=');
    const url = `https://api.twitch.tv/helix/users?login=${usernames}`;
    
    const response = await fetch(url, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`API response ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const info = {};
    
    if (data.data) {
      for (const user of data.data) {
        info[user.login.toLowerCase()] = {
          displayName: user.display_name,
          profileImage: user.profile_image_url
        };
      }
    }
    
    return info;
  } catch (error) {
    pushDebug(`Failed to get streamer info: ${error.message}`, 'error');
    return {};
  }
}

// Format message template
function formatTemplate(template, data) {
  if (!template) return '';
  
  return template
    .replace(/\{streamerName\}/g, data.streamerName || 'Unknown')
    .replace(/\{title\}/g, data.title || 'Untitled Stream')
    .replace(/\{url\}/g, data.url || '')
    .replace(/\{roleMention\}/g, data.roleMention || '')
    .replace(/\{roleNames\}/g, data.roleNames || '')
    .replace(/\{game\}/g, data.game || 'Unknown')
    .replace(/\{viewers\}/g, data.viewers || '0')
    .replace(/\{thumbnail\}/g, data.thumbnail || '')
    .replace(/\{startedAt\}/g, data.startedAt || new Date().toISOString())
    .replace(/\{startedAtRelative\}/g, data.startedAtRelative || 'just now');
}

// Send notification to Discord
async function sendNotification(client, guildId, cfg, streamData, streamerInfo) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      pushDebug(`Guild ${guildId} not found`, 'warn');
      return;
    }
    
    const channel = guild.channels.cache.get(cfg.announceChannelId);
    if (!channel) {
      pushDebug(`Announce channel ${cfg.announceChannelId} not found in guild ${guildId}`, 'warn');
      return;
    }
    
    // Build role mentions
    const list = cfg.mentionTargets && cfg.mentionTargets.length ? cfg.mentionTargets : (cfg.mentionRoleId ? [cfg.mentionRoleId] : []);
    const roleMention = list.map(id => {
      if (id === 'everyone') return '@everyone';
      if (id === 'here') return '@here';
      if (/^[0-9]{5,32}$/.test(id)) return `<@&${id}>`;
      return id;
    }).join(' ');
    
    const roleNames = list.map(id => {
      if (id === 'everyone') return '@everyone';
      if (id === 'here') return '@here';
      const role = guild.roles.cache.get(id);
      if (role) return `@${role.name}`;
      return id.startsWith('@') ? id : '@' + id;
    }).join(', ');
    
    // Get streamer-specific template or use global
    const username = streamData.user_login.toLowerCase();
    const streamerMessages = cfg.streamerMessages || {};
    const template = streamerMessages[username]?.liveTemplate || cfg.liveTemplate;
    
    // Build template data
    const streamerName = streamerInfo[username]?.displayName || streamData.user_name || username;
    const templateData = {
      streamerName,
      title: streamData.title || 'Untitled Stream',
      url: `https://twitch.tv/${username}`,
      roleMention,
      roleNames,
      game: streamData.game_name || 'Unknown',
      viewers: streamData.viewer_count?.toString() || '0',
      thumbnail: streamData.thumbnail_url?.replace('{width}', '1920').replace('{height}', '1080') || '',
      startedAt: streamData.started_at || new Date().toISOString(),
      startedAtRelative: 'just now' // Could be enhanced with relative time
    };
    
    const messageContent = formatTemplate(template, templateData);
    
    // Send message
    if (cfg.embedEnabled !== false) {
      const embed = {
        title: `🔴 ${streamerName} is now LIVE!`,
        description: streamData.title || 'Untitled Stream',
        url: `https://twitch.tv/${username}`,
        color: 0x9146FF, // Twitch purple
        thumbnail: { url: streamerInfo[username]?.profileImage || '' },
        image: { url: templateData.thumbnail },
        fields: [
          { name: 'Game', value: templateData.game, inline: true },
          { name: 'Viewers', value: templateData.viewers, inline: true }
        ],
        timestamp: streamData.started_at,
        footer: { text: 'Twitch', icon_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-70x70.png' }
      };
      
      await channel.send({
        content: roleMention ? `${roleMention}\n${messageContent}` : messageContent,
        embeds: [embed]
      });
    } else {
      await channel.send(messageContent);
    }
    
    pushDebug(`Sent live notification for ${streamerName} to guild ${guildId}`);
  } catch (error) {
    pushDebug(`Failed to send notification for guild ${guildId}: ${error.message}`, 'error');
  }
}

// Main check function for a single guild
async function checkGuildStreamers(client, guild) {
  if (!guild) return;
  
  let cfg;
  try {
    cfg = await store.getGuildTwitchConfig(guild.id);
  } catch (error) {
    pushDebug(`Failed to load config for guild ${guild.id}: ${error.message}`, 'error');
    return;
  }
  
  if (!cfg || !cfg.enabled || !Array.isArray(cfg.streamers) || cfg.streamers.length === 0) {
    return;
  }
  
  if (!cfg.announceChannelId) {
    pushDebug(`No announce channel set for guild ${guild.id}`, 'warn');
    return;
  }
  
  try {
    const liveStreams = await checkStreamersLive(cfg.streamers);
    const streamerInfo = await getStreamerInfo(cfg.streamers);
    
    // Get current live streamers for this guild
    const currentLive = liveStreamersCache.get(guild.id) || new Set();
    const newLive = new Set();
    
    // Check each live stream
    for (const stream of liveStreams) {
      const username = stream.user_login.toLowerCase();
      newLive.add(username);
      
      // Only send notification if streamer wasn't live before
      if (!currentLive.has(username)) {
        pushDebug(`New live stream detected: ${stream.user_name} in guild ${guild.id}`);
        await sendNotification(client, guild.id, cfg, stream, streamerInfo);
      }
    }
    
    // Update cache
    liveStreamersCache.set(guild.id, newLive);
    
    // Reset error counter on success
    consecutiveErrors = 0;
    
    pushDebug(`Checked ${cfg.streamers.length} streamers for guild ${guild.id}, ${liveStreams.length} live, ${newLive.size - currentLive.size} new`);
    
  } catch (error) {
    consecutiveErrors++;
    lastErrorTime = Date.now();
    pushDebug(`Error checking streamers for guild ${guild.id}: ${error.message}`, 'error');
    
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      pushDebug(`Too many consecutive errors (${consecutiveErrors}), backing off`, 'error');
    }
  }
}

// Main watcher function
async function startTwitchWatcher(client) {
  if (!clientId || !clientSecret) {
    console.warn('Twitch watcher disabled: Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET');
    return;
  }
  
  pushDebug('Twitch watcher starting...');
  
  // Test OAuth connection
  try {
    await getAccessToken();
    pushDebug('Twitch OAuth connection successful');
  } catch (error) {
    console.error('Failed to connect to Twitch API:', error.message);
    pushDebug(`Failed to connect to Twitch API: ${error.message}`, 'error');
    return;
  }
  
  // Check interval (default 5 minutes)
  const checkInterval = parseInt(process.env.TWITCH_CHECK_INTERVAL_SEC || '300', 10) * 1000;
  
  async function runCheck() {
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      const timeSinceError = Date.now() - lastErrorTime;
      if (timeSinceError < 30 * 60 * 1000) { // 30 minute backoff
        return;
      } else {
        consecutiveErrors = 0; // Reset after backoff period
      }
    }
    
    try {
      const guilds = client.guilds.cache.values();
      for (const guild of guilds) {
        try {
          const cfg = await store.getGuildTwitchConfig(guild.id);
          if (cfg && cfg.enabled) {
            await checkGuildStreamers(client, guild);
            // Small delay between guilds to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          pushDebug(`Error processing guild ${guild.id}: ${error.message}`, 'error');
        }
      }
      
      pushDebug(`Twitch check completed for ${Array.from(guilds).length} guilds`);
    } catch (error) {
      pushDebug(`Error in main check loop: ${error.message}`, 'error');
    }
  }
  
  // Run initial check after 30 seconds
  setTimeout(runCheck, 30000);
  
  // Set up interval
  setInterval(runCheck, checkInterval);
  
  console.log(`Twitch watcher started with ${checkInterval / 1000}s interval`);
  pushDebug(`Twitch watcher initialized with ${checkInterval / 1000}s check interval`);
}

function getTwitchDebugEvents() {
  return [...debugEvents];
}

module.exports = {
  startTwitchWatcher,
  getTwitchDebugEvents,
  checkGuildStreamers
};
