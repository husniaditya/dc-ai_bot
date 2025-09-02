// Utility functions for Games & Socials section

/**
 * Clean up malformed channel IDs from database
 * @param {Array} channels - Array of channel IDs to clean
 * @returns {Array} - Cleaned array of channel IDs
 */
export function cleanChannelIds(channels) {
  if (!Array.isArray(channels)) return [];
  return channels.map(cid => {
    if (typeof cid !== 'string') return cid;
    
    // Remove extra quotes and JSON stringification
    let clean = cid;
    
    // Handle various malformed patterns
    // Pattern: ["UCwOygeWv6P6wnjBpTh5mUzQ"]
    if (clean.startsWith('[') && clean.endsWith(']')) {
      try {
        clean = JSON.parse(clean);
        if (Array.isArray(clean) && clean.length > 0) clean = clean[0];
      } catch (e) {
        // If JSON parsing fails, manually extract
        clean = clean.slice(1, -1); // Remove [ and ]
      }
    }
    
    // Pattern: "UCwOygeWv6P6wnjBpTh5mUzQ"]
    if (clean.endsWith(']')) {
      clean = clean.slice(0, -1); // Remove trailing ]
    }
    
    // Pattern: ["UCwOygeWv6P6wnjBpTh5mUzQ"
    if (clean.startsWith('[')) {
      clean = clean.slice(1); // Remove leading [
    }
    
    // Pattern: "UCwOygeWv6P6wnjBpTh5mUzQ"
    if (clean.startsWith('"') && clean.endsWith('"')) {
      clean = clean.slice(1, -1);
    }
    
    // Remove any remaining quotes
    clean = clean.replace(/['"]/g, '');
    
    return clean;
  });
}

/**
 * Clean up malformed streamer usernames from database
 * @param {Array} streamers - Array of streamer usernames to clean
 * @returns {Array} - Cleaned array of streamer usernames
 */
export function cleanStreamerUsernames(streamers) {
  if (!Array.isArray(streamers)) return [];
  return streamers.map(username => {
    if (typeof username !== 'string') return username;
    
    // Remove extra quotes and JSON stringification
    let clean = username;
    
    // Handle various malformed patterns
    // Pattern: ["username"]
    if (clean.startsWith('[') && clean.endsWith(']')) {
      try {
        clean = JSON.parse(clean);
        if (Array.isArray(clean) && clean.length > 0) clean = clean[0];
      } catch (e) {
        // If JSON parsing fails, manually extract
        clean = clean.slice(1, -1); // Remove [ and ]
      }
    }
    
    // Pattern: "username"]
    if (clean.endsWith(']')) {
      clean = clean.slice(0, -1); // Remove trailing ]
    }
    
    // Pattern: ["username"
    if (clean.startsWith('[')) {
      clean = clean.slice(1); // Remove leading [
    }
    
    // Pattern: "username"
    if (clean.startsWith('"') && clean.endsWith('"')) {
      clean = clean.slice(1, -1);
    }
    
    // Remove any remaining quotes
    clean = clean.replace(/['"]/g, '');
    
    return clean;
  });
}

/**
 * Build a preview string from a template
 * @param {string} template - The template string
 * @param {string} channelId - Channel ID or username
 * @param {string} type - Service type ('youtube' or 'twitch')
 * @param {Object} config - Configuration object
 * @param {Array} guildRoles - Array of guild roles
 * @returns {string} - Preview string
 */
export function buildPreview(template, channelId, type = 'youtube', config = {}, guildRoles = []) {
  if (!template) return '';
  
  if (type === 'twitch') {
    const streamerNames = config?.streamerNames || {};
    const streamerName = channelId ? (streamerNames[channelId] || 'StreamerName') : (streamerNames[config?.streamers?.[0]] || 'StreamerName');
    const streamTitle = 'Amazing Live Stream';
    const url = `https://twitch.tv/${channelId || 'streamername'}`;
    const thumbnail = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelId || 'streamername'}-1920x1080.jpg`;
    const list = config?.mentionTargets && config.mentionTargets.length ? config.mentionTargets : (config?.mentionRoleId ? [config.mentionRoleId] : []);
    const roleMention = list.map(id => id === 'everyone' ? '@everyone' : id === 'here' ? '@here' : (/^[0-9]{5,32}$/.test(id) ? `<@&${id}>` : id)).join(' ');
    const rolesById = Object.fromEntries((guildRoles || []).map(r => [r.id, r.name]));
    const roleNames = list.map(id => {
      if (id === 'everyone') return '@everyone';
      if (id === 'here') return '@here';
      if (rolesById[id]) {
        const n = rolesById[id];
        return n.startsWith('@') ? n : '@' + n;
      }
      return id.startsWith('@') ? id : '@' + id;
    }).join(', ');
    
    return template
      .replace(/\{streamerName\}/g, streamerName)
      .replace(/\{title\}/g, streamTitle)
      .replace(/\{url\}/g, url)
      .replace(/\{roleMention\}/g, roleMention)
      .replace(/\{roleNames\}/g, roleNames)
      .replace(/\{thumbnail\}/g, thumbnail)
      .replace(/\{game\}/g, 'Just Chatting')
      .replace(/\{viewers\}/g, '1337')
      .replace(/\{startedAt\}/g, new Date().toISOString())
      .replace(/\{startedAtRelative\}/g, 'just now');
  }
  
  // YouTube preview
  const sampleVideoId = 'VIDEO12345';
  const channelNames = config?.channelNames || {};
  const channelTitle = channelId ? (channelNames[channelId] || 'Channel Name') : (channelNames[config?.channels?.[0]] || 'Channel Name');
  const videoTitle = 'Amazing New Upload';
  const url = `https://youtu.be/${sampleVideoId}`;
  const thumbnail = `https://img.youtube.com/vi/${sampleVideoId}/hqdefault.jpg`;
  const list = config?.mentionTargets && config.mentionTargets.length ? config.mentionTargets : (config?.mentionRoleId ? [config.mentionRoleId] : []);
  const roleMention = list.map(id => id === 'everyone' ? '@everyone' : id === 'here' ? '@here' : (/^[0-9]{5,32}$/.test(id) ? `<@&${id}>` : id)).join(' ');
  const rolesById = Object.fromEntries((guildRoles || []).map(r => [r.id, r.name]));
  const roleNames = list.map(id => {
    if (id === 'everyone') return '@everyone';
    if (id === 'here') return '@here';
    if (rolesById[id]) {
      const n = rolesById[id];
      return n.startsWith('@') ? n : '@' + n;
    }
    return id.startsWith('@') ? id : '@' + id;
  }).join(', ');
  
  return template
    .replace(/\{channelTitle\}/g, channelTitle)
    .replace(/\{title\}/g, videoTitle)
    .replace(/\{url\}/g, url)
    .replace(/\{roleMention\}/g, roleMention)
    .replace(/\{roleNames\}/g, roleNames)
    .replace(/\{thumbnail\}/g, thumbnail)
    .replace(/\{publishedAt\}/g, new Date().toISOString())
    .replace(/\{publishedAtRelative\}/g, 'just now')
    .replace(/\{memberText\}/g, ' (Members Only)');
}

/**
 * Check if configuration has unsaved changes
 * @param {Object} current - Current configuration
 * @param {Object} original - Original configuration
 * @returns {boolean} - True if there are unsaved changes
 */
export function hasUnsavedChanges(current, original) {
  if (!current || !original) return false;
  return JSON.stringify(current) !== JSON.stringify(original);
}
