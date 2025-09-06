// Command toggles service - handles global and guild-specific command enable/disable state
const db = require('../database/connection');
const cache = require('../cache/manager');

async function loadCommandToggles() {
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(
        'SELECT command_name, enabled, created_at, created_by, updated_at, updated_by FROM command_toggles'
      );
      
      const cacheData = cache.getCache();
      for (const row of rows) {
        cacheData.commandToggles[row.command_name] = {
          enabled: !!row.enabled,
          created_at: row.created_at,
          created_by: row.created_by,
          updated_at: row.updated_at,
          updated_by: row.updated_by
        };
      }
    } catch (e) {
      console.error('Error loading command toggles:', e.message);
    }
  }
}

function getCommandToggles() {
  const cacheData = cache.getCache();
  // Return simple map name->enabled for legacy callers
  const out = {};
  for (const k of Object.keys(cacheData.commandToggles)) {
    out[k] = cacheData.commandToggles[k].enabled;
  }
  return out;
}

function getAllCommandToggles() {
  const cacheData = cache.getCache();
  // Return full metadata structure
  const out = {};
  for (const k of Object.keys(cacheData.commandToggles)) {
    out[k] = { ...cacheData.commandToggles[k] };
  }
  return out;
}

async function setCommandToggle(name, enabled, actor) {
  const cacheData = cache.getCache();
  const nowMeta = cacheData.commandToggles[name];
  
  if (!nowMeta) {
    cacheData.commandToggles[name] = {
      enabled: !!enabled,
      created_at: new Date(),
      created_by: actor,
      updated_at: new Date(),
      updated_by: actor
    };
  } else {
    nowMeta.enabled = !!enabled;
    nowMeta.updated_at = new Date();
    nowMeta.updated_by = actor;
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'REPLACE INTO command_toggles(command_name, enabled, created_at, created_by, updated_at, updated_by) VALUES (?,?,?,?,?,?)',
      [name, enabled ? 1 : 0, cacheData.commandToggles[name].created_at, cacheData.commandToggles[name].created_by, cacheData.commandToggles[name].updated_at, cacheData.commandToggles[name].updated_by]
    );
  }
  
  return cacheData.commandToggles[name].enabled;
}

async function getGuildCommandToggles(guildId) {
  if (!guildId) return getCommandToggles();
  
  const cacheData = cache.getCache();
  const existing = cacheData.guildCommandToggles.get(guildId) || {};
  const base = getCommandToggles();
  
  // Merge overriding enabled flag only
  const merged = { ...base };
  for (const k of Object.keys(existing)) {
    merged[k] = existing[k].enabled;
  }
  
  // Check XP feature status and disable XP commands if feature is disabled
  try {
    // Import here to avoid circular dependencies
    const moderationService = require('./moderation');
    const moderationFeatures = await moderationService.getModerationFeatures(guildId);
    
    if (!moderationFeatures.xp?.enabled) {
      // XP feature is disabled, so disable all XP commands
      const xpCommands = ['level', 'xp', 'rank', 'leaderboard', 'xpadmin'];
      for (const cmd of xpCommands) {
        // Only override if not explicitly set in database
        if (!(cmd in existing)) {
          merged[cmd] = false;
        }
      }
    }
  } catch (error) {
    // If we can't check moderation features, don't modify command states
    console.warn('Could not check XP feature status for command toggles:', error.message);
  }
  
  return merged;
}

async function getAllGuildCommandToggles(guildId) {
  if (!guildId) return getAllCommandToggles();
  
  const cacheData = cache.getCache();
  const existing = cacheData.guildCommandToggles.get(guildId) || {};
  const base = getAllCommandToggles();
  const merged = { ...base };
  
  for (const k of Object.keys(existing)) {
    merged[k] = { ...existing[k] };
  }
  
  // Check XP feature status and disable XP commands if feature is disabled
  try {
    // Import here to avoid circular dependencies
    const moderationService = require('./moderation');
    const moderationFeatures = await moderationService.getModerationFeatures(guildId);
    
    if (!moderationFeatures.xp?.enabled) {
      // XP feature is disabled, so disable all XP commands
      const xpCommands = ['level', 'xp', 'rank', 'leaderboard', 'xpadmin'];
      for (const cmd of xpCommands) {
        // Only override if not explicitly set in database
        if (!(cmd in existing)) {
          merged[cmd] = {
            enabled: false,
            created_at: new Date(),
            created_by: 'xp-feature-auto-disable',
            updated_at: new Date(),
            updated_by: 'xp-feature-auto-disable'
          };
        }
      }
    }
  } catch (error) {
    // If we can't check moderation features, don't modify command states
    console.warn('Could not check XP feature status for command metadata:', error.message);
  }
  
  return merged;
}

async function setGuildCommandToggle(guildId, name, enabled, actor) {
  if (!guildId) throw new Error('guildId required');
  
  const cacheData = cache.getCache();
  const existing = cacheData.guildCommandToggles.get(guildId) || {};
  const meta = existing[name];
  
  if (!meta) {
    existing[name] = {
      enabled: !!enabled,
      created_at: new Date(),
      created_by: actor,
      updated_at: new Date(),
      updated_by: actor
    };
  } else {
    meta.enabled = !!enabled;
    meta.updated_at = new Date();
    meta.updated_by = actor;
  }
  
  cacheData.guildCommandToggles.set(guildId, existing);
  
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'REPLACE INTO guild_command_toggles(guild_id, command_name, enabled, created_at, created_by, updated_at, updated_by) VALUES (?,?,?,?,?,?,?)',
      [guildId, name, enabled ? 1 : 0, existing[name].created_at, existing[name].created_by, existing[name].updated_at, existing[name].updated_by]
    );
  }
  
  return existing[name].enabled;
}

module.exports = {
  loadCommandToggles,
  getCommandToggles,
  getAllCommandToggles,
  setCommandToggle,
  getGuildCommandToggles,
  getAllGuildCommandToggles,
  setGuildCommandToggle
};
