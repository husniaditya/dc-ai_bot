/**
 * API helper utilities
 */

const { isValidDiscordId } = require('./validation');

/**
 * Extract pagination parameters from query string
 */
function extractPagination(query, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || 10));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * Extract sort parameters from query string
 */
function extractSort(query, allowedFields = [], defaultSort = 'created_at') {
  const sort = query.sort || defaultSort;
  const order = (query.order || 'desc').toLowerCase();
  
  // Validate sort field
  if (!allowedFields.includes(sort)) {
    return { sort: defaultSort, order: 'desc' };
  }
  
  // Validate order
  if (!['asc', 'desc'].includes(order)) {
    return { sort, order: 'desc' };
  }
  
  return { sort, order };
}

/**
 * Extract search parameters from query string
 */
function extractSearch(query) {
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  return search.length > 0 ? search : null;
}

/**
 * Get user's selected guild ID from request
 */
async function getUserGuildId(req, store) {
  if (req.user.type !== 'discord') return null;
  
  // Check for explicit guildId parameter
  const explicitGuildId = req.query.guildId || req.body.guildId;
  if (explicitGuildId && isValidDiscordId(explicitGuildId)) {
    return explicitGuildId;
  }
  
  // Get user's selected guild
  try {
    const user = await store.getUser(req.user.userId);
    return user?.selected_guild_id || null;
  } catch (error) {
    console.warn('Failed to get user selected guild:', error.message);
    return null;
  }
}

/**
 * Check if user has permission to manage a guild
 */
async function canUserManageGuild(client, userId, guildId) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return false;
    
    const member = await guild.members.fetch(userId);
    if (!member) return false;
    
    return member.permissions.has('ManageGuild');
  } catch (error) {
    console.warn('Permission check failed:', error.message);
    return false;
  }
}

/**
 * Validate that a guild exists and bot has access
 */
function validateGuildAccess(client, guildId) {
  if (!isValidDiscordId(guildId)) {
    throw new Error('Invalid guild ID format');
  }
  
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error('Guild not found or bot not in guild');
  }
  
  return guild;
}

/**
 * Generate a random string for tokens, states, etc.
 */
function generateRandomString(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Clean and normalize text input
 */
function normalizeText(text, maxLength = 255) {
  if (typeof text !== 'string') return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ') // normalize whitespace
    .substring(0, maxLength);
}

/**
 * Convert milliseconds to human readable duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration) {
  if (typeof duration === 'number') return duration;
  if (typeof duration !== 'string') return 0;
  
  const match = duration.match(/^(\d+)([smhd]?)$/);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2] || 's';
  
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  
  return value * (multipliers[unit] || 1000);
}

/**
 * Rate limit key generator
 */
function generateRateLimitKey(req, identifier = 'ip') {
  switch (identifier) {
    case 'user':
      return req.user ? `user:${req.user.userId}` : `ip:${req.ip}`;
    case 'guild':
      return req.guildId ? `guild:${req.guildId}` : `ip:${req.ip}`;
    case 'ip':
    default:
      return `ip:${req.ip}`;
  }
}

/**
 * Deep merge objects
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

module.exports = {
  extractPagination,
  extractSort,
  extractSearch,
  getUserGuildId,
  canUserManageGuild,
  validateGuildAccess,
  generateRandomString,
  normalizeText,
  formatDuration,
  parseDuration,
  generateRateLimitKey,
  deepMerge
};
