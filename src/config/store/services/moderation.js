// Moderation service - handles all moderation-related features and settings
const db = require('../database/connection');
const cache = require('../cache/manager');
const { defaultConfigs } = require('../models/defaults');
// Scheduler hooks
const { schedulerNotifyCreateOrUpdate, schedulerNotifyDelete, parseCanonicalNext } = require('./schedulerService');
const settingsService = require('./settings');

// Moderation Features Management
async function getModerationFeatures(guildId) {
  if (!guildId) return { ...defaultConfigs.guildModerationFeatures };
  
  const cacheData = cache.getCache();
  if (cacheData.guildModerationFeaturesCache.has(guildId)) {
    return { ...cacheData.guildModerationFeaturesCache.get(guildId) };
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(
        'SELECT feature_key, enabled, config FROM guild_moderation_features WHERE guild_id=?',
        [guildId]
      );
      
      const features = { ...defaultConfigs.guildModerationFeatures };
      for (const row of rows) {
        features[row.feature_key] = {
          enabled: !!row.enabled,
          config: row.config ? JSON.parse(row.config) : {}
        };
      }
      
      cacheData.guildModerationFeaturesCache.set(guildId, features);
      return { ...features };
    } catch (e) {
      console.error('Error loading moderation features:', e.message);
    }
  }
  
  // Default configuration
  const defaultFeatures = { ...defaultConfigs.guildModerationFeatures };
  cacheData.guildModerationFeaturesCache.set(guildId, defaultFeatures);
  return { ...defaultFeatures };
}

async function toggleModerationFeature(guildId, featureKey, enabled) {
  if (!guildId) throw new Error('guildId required');
  
  const current = await getModerationFeatures(guildId);
  current[featureKey] = { ...current[featureKey], enabled: !!enabled };
  
  const cacheData = cache.getCache();
  cacheData.guildModerationFeaturesCache.set(guildId, current);
  
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'REPLACE INTO guild_moderation_features(guild_id, feature_key, enabled, config) VALUES (?,?,?,?)',
      [guildId, featureKey, enabled ? 1 : 0, JSON.stringify(current[featureKey].config || {})]
    );
    
    // Special handling for XP feature - sync with guild_xp_settings and command toggles
    if (featureKey === 'xp') {
      // Sync guild_xp_settings enabled column
      await db.sqlPool.query(`
        INSERT INTO guild_xp_settings (guild_id, enabled) 
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
      `, [guildId, enabled ? 1 : 0]);
      
      // Toggle XP-related commands
      const xpCommands = ['level', 'xp', 'rank', 'leaderboard', 'xpadmin'];
      for (const commandName of xpCommands) {
        await db.sqlPool.query(`
          INSERT INTO guild_command_toggles (guild_id, command_name, enabled, created_at, created_by, updated_at, updated_by)
          VALUES (?, ?, ?, NOW(), 'system', NOW(), 'xp-feature-toggle')
          ON DUPLICATE KEY UPDATE 
            enabled = VALUES(enabled),
            updated_at = NOW(),
            updated_by = 'xp-feature-toggle'
        `, [guildId, commandName, enabled ? 1 : 0]);
      }
      
      // Clear caches to ensure consistency
      cacheData.guildXpSettingsCache.delete(guildId);
      cacheData.guildCommandToggles.delete(guildId);
    }
    
    // Special handling for logging feature - sync with guild_audit_logs_config table
    if (featureKey === 'logging') {
      // Sync guild_audit_logs_config enabled column
      await db.sqlPool.query(`
        INSERT INTO guild_audit_logs_config (guild_id, enabled) 
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
      `, [guildId, enabled ? 1 : 0]);
      
      // Clear audit log cache to ensure consistency
      if (cacheData.guildAuditConfigCache) {
        cacheData.guildAuditConfigCache.delete(guildId);
      }
    }
    
    // Special handling for antiraid feature - sync with guild_antiraid_settings table
    if (featureKey === 'antiraid') {
      // Sync guild_antiraid_settings enabled column
      await db.sqlPool.query(`
        INSERT INTO guild_antiraid_settings (guild_id, enabled) 
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
      `, [guildId, enabled ? 1 : 0]);
      
      // Clear antiraid cache to ensure consistency
      if (cacheData.guildAntiRaidSettingsCache) {
        cacheData.guildAntiRaidSettingsCache.delete(guildId);
      }
    }
  }
  
  return current;
}

async function updateModerationFeatureConfig(guildId, featureKey, config) {
  if (!guildId) throw new Error('guildId required');
  
  const current = await getModerationFeatures(guildId);
  current[featureKey] = { ...current[featureKey], config: config || {} };
  
  const cacheData = cache.getCache();
  cacheData.guildModerationFeaturesCache.set(guildId, current);
  
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'REPLACE INTO guild_moderation_features(guild_id, feature_key, enabled, config) VALUES (?,?,?,?)',
      [guildId, featureKey, current[featureKey].enabled ? 1 : 0, JSON.stringify(config || {})]
    );
  }
  
  return current[featureKey];
}

// Auto Moderation Rules
async function getGuildAutoModRules(guildId) {
  if (!guildId) return [];
  
  const cacheData = cache.getCache();
  if (cacheData.guildAutoModRulesCache.has(guildId)) {
    return [...cacheData.guildAutoModRulesCache.get(guildId)];
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT id, name, trigger_type, action_type, threshold_value, duration, enabled,
               whitelist_channels, whitelist_roles, log_channel_id, message_action
        FROM guild_automod_rules WHERE guild_id=? ORDER BY id
      `, [guildId]);
      
      const rules = rows.map(row => ({
        id: row.id,
        name: row.name,
        triggerType: row.trigger_type,
        actionType: row.action_type,
        thresholdValue: row.threshold_value,
        duration: row.duration,
        enabled: !!row.enabled,
        whitelistChannels: row.whitelist_channels ? JSON.parse(row.whitelist_channels) : [],
        whitelistRoles: row.whitelist_roles ? JSON.parse(row.whitelist_roles) : [],
        logChannelId: row.log_channel_id,
        messageAction: row.message_action || 'keep'
      }));
      
      cacheData.guildAutoModRulesCache.set(guildId, rules);
      return [...rules];
    } catch (e) {
      console.error('Error loading automod rules:', e.message);
    }
  }
  
  cacheData.guildAutoModRulesCache.set(guildId, []);
  return [];
}

async function createGuildAutoModRule(guildId, data) {
  if (!guildId) throw new Error('guildId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(`
        INSERT INTO guild_automod_rules(
          guild_id, name, trigger_type, action_type, threshold_value, duration, enabled,
          whitelist_channels, whitelist_roles, log_channel_id, message_action
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `, [
        guildId, data.name, data.triggerType, data.actionType, data.thresholdValue,
        data.duration, data.enabled ? 1 : 0, data.whitelistChannels || '[]',
        data.whitelistRoles || '[]', data.logChannelId || null,
        data.messageAction || 'keep'
      ]);
      
      // Invalidate cache
      const cacheData = cache.getCache();
      cacheData.guildAutoModRulesCache.delete(guildId);
      
      return result.insertId;
    } catch (e) {
      console.error('Error creating automod rule:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

async function updateGuildAutoModRule(guildId, ruleId, data) {
  if (!guildId) throw new Error('guildId required');
  if (!ruleId) throw new Error('ruleId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      await db.sqlPool.query(`
        UPDATE guild_automod_rules SET
          name=?, trigger_type=?, action_type=?, threshold_value=?, duration=?, enabled=?,
          whitelist_channels=?, whitelist_roles=?, log_channel_id=?, message_action=?
        WHERE guild_id=? AND id=?
      `, [
        data.name, data.triggerType, data.actionType, data.thresholdValue,
        data.duration, data.enabled ? 1 : 0, data.whitelistChannels || '[]',
        data.whitelistRoles || '[]', data.logChannelId || null,
        data.messageAction || 'keep', guildId, ruleId
      ]);
      
      // Invalidate cache
      const cacheData = cache.getCache();
      cacheData.guildAutoModRulesCache.delete(guildId);
      
      return true;
    } catch (e) {
      console.error('Error updating automod rule:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

async function deleteGuildAutoModRule(guildId, ruleId) {
  if (!guildId) throw new Error('guildId required');
  if (!ruleId) throw new Error('ruleId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      await db.sqlPool.query(
        'DELETE FROM guild_automod_rules WHERE guild_id=? AND id=?',
        [guildId, ruleId]
      );
      
      // Invalidate cache
      const cacheData = cache.getCache();
      cacheData.guildAutoModRulesCache.delete(guildId);
      
      return true;
    } catch (e) {
      console.error('Error deleting automod rule:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

async function toggleGuildAutoModRule(guildId, ruleId, enabled) {
  if (!guildId) throw new Error('guildId required');
  if (!ruleId) throw new Error('ruleId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      await db.sqlPool.query(
        'UPDATE guild_automod_rules SET enabled=? WHERE guild_id=? AND id=?',
        [enabled ? 1 : 0, guildId, ruleId]
      );
      
      // Invalidate cache
      const cacheData = cache.getCache();
      cacheData.guildAutoModRulesCache.delete(guildId);
      
      return true;
    } catch (e) {
      console.error('Error toggling automod rule:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

// XP Settings
async function getGuildXpSettings(guildId) {
  if (!guildId) return { ...defaultConfigs.guildXpSettings };
  
  const cacheData = cache.getCache();
  if (cacheData.guildXpSettingsCache.has(guildId)) {
    return { ...cacheData.guildXpSettingsCache.get(guildId) };
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT enabled, xp_per_message, xp_per_voice_minute, cooldown_seconds,
               ignored_channels, ignored_roles, level_up_messages, level_up_channel, double_xp_events
        FROM guild_xp_settings WHERE guild_id=?
      `, [guildId]);
      
      if (rows.length > 0) {
        const row = rows[0];
        const config = {
          enabled: !!row.enabled,
          xpPerMessage: row.xp_per_message,
          xpPerVoiceMinute: row.xp_per_voice_minute,
          cooldownSeconds: row.cooldown_seconds,
          excludedChannels: row.ignored_channels ? JSON.parse(row.ignored_channels) : [],
          excludedRoles: row.ignored_roles ? JSON.parse(row.ignored_roles) : [],
          levelUpMessages: !!row.level_up_messages,
          levelUpChannel: row.level_up_channel,
          doubleXpEvents: row.double_xp_events ? JSON.parse(row.double_xp_events) : []
        };
        
        cacheData.guildXpSettingsCache.set(guildId, config);
        return { ...config };
      }
    } catch (e) {
      console.error('Error loading XP settings:', e.message);
    }
  }
  
  // No specific XP settings found, check moderation feature status
  const defaultConfig = { ...defaultConfigs.guildXpSettings };
  
  try {
    const moderationFeatures = await getModerationFeatures(guildId);
    if (moderationFeatures.xp && moderationFeatures.xp.enabled) {
      defaultConfig.enabled = true;
    }
  } catch (e) {
    console.error('Error checking moderation features for XP:', e.message);
  }
  
  cacheData.guildXpSettingsCache.set(guildId, defaultConfig);
  return { ...defaultConfig };
}

async function updateGuildXpSettings(guildId, data) {
  if (!guildId) throw new Error('guildId required');
  
  const current = await getGuildXpSettings(guildId);
  const next = { ...current, ...data };
  
  const cacheData = cache.getCache();
  cacheData.guildXpSettingsCache.set(guildId, next);
  
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(`
      REPLACE INTO guild_xp_settings(
        guild_id, enabled, xp_per_message, xp_per_voice_minute, cooldown_seconds,
        ignored_channels, ignored_roles, level_up_messages, level_up_channel, double_xp_events
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `, [
      guildId, next.enabled ? 1 : 0, next.xpPerMessage, next.xpPerVoiceMinute, next.cooldownSeconds,
      JSON.stringify(next.excludedChannels || []), JSON.stringify(next.excludedRoles || []),
      next.levelUpMessages ? 1 : 0, next.levelUpChannel, JSON.stringify(next.doubleXpEvents || [])
    ]);
    
    // Sync with guild_moderation_features if enabled status changed
    if (data.hasOwnProperty('enabled')) {
      await db.sqlPool.query(`
        INSERT INTO guild_moderation_features (guild_id, feature_key, enabled, config) 
        VALUES (?, 'xp', ?, '{}')
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
      `, [guildId, next.enabled ? 1 : 0]);
      
      // Clear moderation features cache to ensure consistency
      cacheData.guildModerationFeaturesCache.delete(guildId);
    }
  }
  
  return { ...next };
}

// User XP Management
async function getUserXp(guildId, userId) {
  if (!guildId || !userId) throw new Error('guildId and userId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT total_xp, current_level, last_message_xp, last_voice_xp, total_messages, total_voice_minutes
        FROM guild_user_xp WHERE guild_id=? AND user_id=?
      `, [guildId, userId]);
      
      if (rows.length > 0) {
        const row = rows[0];
        return {
          total_xp: row.total_xp,
          level: row.current_level,
          last_message_xp: row.last_message_xp,
          last_voice_xp: row.last_voice_xp,
          total_messages: row.total_messages,
          total_voice_minutes: row.total_voice_minutes
        };
      }
    } catch (e) {
      console.error('Error getting user XP:', e.message);
    }
  }
  
  return {
    total_xp: 0,
    level: 0,
    last_message_xp: null,
    last_voice_xp: null,
    total_messages: 0,
    total_voice_minutes: 0
  };
}

async function addUserXp(guildId, userId, xpAmount, source = 'message') {
  if (!guildId || !userId || typeof xpAmount !== 'number') {
    throw new Error('guildId, userId, and xpAmount required');
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const current = await getUserXp(guildId, userId);
      const newTotalXp = (current.total_xp || 0) + xpAmount;
      const newLevel = calculateLevel(newTotalXp);
      const leveledUp = newLevel > (current.level || 0);
      
      const now = new Date();
      const updateFields = [];
      const updateValues = [];
      
      updateFields.push('total_xp=?', 'current_level=?', 'updated_at=?');
      updateValues.push(newTotalXp, newLevel, now);
      
      if (source === 'message') {
        updateFields.push('last_message_xp=?', 'total_messages=total_messages+1');
        updateValues.push(now);
      } else if (source === 'voice') {
        updateFields.push('last_voice_xp=?', 'total_voice_minutes=total_voice_minutes+1');
        updateValues.push(now);
      }
      
      updateValues.push(guildId, userId, guildId, userId);
      
      await db.sqlPool.query(`
        INSERT INTO guild_user_xp (guild_id, user_id, total_xp, current_level, ${source === 'message' ? 'last_message_xp, total_messages' : 'last_voice_xp, total_voice_minutes'})
        VALUES (?, ?, ?, ?, ${source === 'message' ? '?, 1' : '?, 1'})
        ON DUPLICATE KEY UPDATE ${updateFields.join(', ')}
      `, [guildId, userId, newTotalXp, newLevel, now, ...updateValues]);
      
      return {
        previousLevel: current.level || 0,
        newLevel,
        total_xp: newTotalXp,
        xpGained: xpAmount,
        leveledUp
      };
    } catch (e) {
      console.error('Error adding user XP:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

async function getGuildLeaderboard(guildId, limit = 10, offset = 0) {
  if (!guildId) throw new Error('guildId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT user_id, total_xp, current_level, total_messages, total_voice_minutes
        FROM guild_user_xp 
        WHERE guild_id=? 
        ORDER BY total_xp DESC, current_level DESC
        LIMIT ? OFFSET ?
      `, [guildId, limit, offset]);
      
      return rows.map((row, index) => ({
        rank: offset + index + 1,
        user_id: row.user_id,
        total_xp: row.total_xp,
        level: row.current_level,
        total_messages: row.total_messages,
        total_voice_minutes: row.total_voice_minutes
      }));
    } catch (e) {
      console.error('Error getting leaderboard:', e.message);
      return [];
    }
  }
  
  return [];
}

async function resetUserXp(guildId, userId) {
  if (!guildId || !userId) throw new Error('guildId and userId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      await db.sqlPool.query(`
        UPDATE guild_user_xp 
        SET total_xp=0, current_level=0, last_message_xp=NULL, last_voice_xp=NULL, 
            total_messages=0, total_voice_minutes=0
        WHERE guild_id=? AND user_id=?
      `, [guildId, userId]);
      
      return true;
    } catch (e) {
      console.error('Error resetting user XP:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

async function setUserXp(guildId, userId, xpAmount) {
  if (!guildId || !userId) throw new Error('guildId and userId required');
  if (typeof xpAmount !== 'number' || xpAmount < 0) throw new Error('xpAmount must be a non-negative number');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const newLevel = calculateLevel(xpAmount);
      
      await db.sqlPool.query(`
        INSERT INTO guild_user_xp 
        (guild_id, user_id, total_xp, current_level, last_message_xp, last_voice_xp, total_messages, total_voice_minutes, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
        total_xp = VALUES(total_xp),
        current_level = VALUES(current_level),
        updated_at = NOW()
      `, [guildId, userId, xpAmount, newLevel]);
      
      return true;
    } catch (e) {
      console.error('Error setting user XP:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

// Level calculation helper (standard formula: level = floor(sqrt(totalXp / 100)))
function calculateLevel(totalXp) {
  return Math.floor(Math.sqrt(totalXp / 100));
}

// Calculate XP needed for next level
function getXpForLevel(level) {
  return Math.pow(level, 2) * 100;
}

// Level Rewards Management
async function getGuildLevelRewards(guildId) {
  if (!guildId) return [];
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT id, level, role_id, remove_previous, enabled
        FROM guild_xp_level_rewards 
        WHERE guild_id=? AND enabled=1
        ORDER BY level ASC
      `, [guildId]);
      
      return rows.map(row => ({
        id: row.id,
        level: row.level,
        roleId: row.role_id,
        removePrevious: !!row.remove_previous,
        enabled: !!row.enabled
      }));
    } catch (e) {
      console.error('Error getting level rewards:', e.message);
      return [];
    }
  }
  
  return [];
}

async function addGuildLevelReward(guildId, level, roleId, removePrevious = false) {
  if (!guildId || !level || !roleId) {
    throw new Error('guildId, level, and roleId required');
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(`
        INSERT INTO guild_xp_level_rewards (guild_id, level, role_id, remove_previous)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE role_id=VALUES(role_id), remove_previous=VALUES(remove_previous)
      `, [guildId, level, roleId, removePrevious ? 1 : 0]);
      
      return result.insertId || true;
    } catch (e) {
      console.error('Error adding level reward:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

async function removeGuildLevelReward(guildId, level) {
  if (!guildId || !level) throw new Error('guildId and level required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      await db.sqlPool.query(`
        DELETE FROM guild_xp_level_rewards WHERE guild_id=? AND level=?
      `, [guildId, level]);
      
      return true;
    } catch (e) {
      console.error('Error removing level reward:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

// Reaction Roles
async function getGuildReactionRoles(guildId) {
  if (!guildId) return [];
  
  const cacheData = cache.getCache();
  if (cacheData.guildReactionRolesCache.has(guildId)) {
    return [...cacheData.guildReactionRolesCache.get(guildId)];
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT id, message_id, channel_id, emoji, role_id, type, custom_message, title, status
        FROM guild_reaction_roles WHERE guild_id=? ORDER BY id
      `, [guildId]);
      
      const roles = rows.map(row => ({
        id: row.id,
        messageId: row.message_id,
        channelId: row.channel_id,
        emoji: row.emoji,
        roleId: row.role_id,
        type: row.type,
        customMessage: row.custom_message,
        title: row.title,
        status: !!row.status
      }));
      
      cacheData.guildReactionRolesCache.set(guildId, roles);
      return [...roles];
    } catch (e) {
      console.error('Error loading reaction roles:', e.message);
    }
  }
  
  cacheData.guildReactionRolesCache.set(guildId, []);
  return [];
}

async function addGuildReactionRole(guildId, data) {
  if (!guildId) throw new Error('guildId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(`
        INSERT INTO guild_reaction_roles(guild_id, message_id, channel_id, emoji, role_id, type, custom_message, title, status)
        VALUES (?,?,?,?,?,?,?,?,?)
      `, [
        guildId, data.messageId, data.channelId, data.emoji, data.roleId,
        data.type || 'toggle', data.customMessage, data.title, data.status !== false ? 1 : 0
      ]);
      
      // Invalidate cache
      const cacheData = cache.getCache();
      cacheData.guildReactionRolesCache.delete(guildId);
      
      return result.insertId;
    } catch (e) {
      console.error('Error adding reaction role:', e.message);
    }
  }
  
  return null;
}

async function removeGuildReactionRolesByMessage(guildId, messageId) {
  if (!guildId || !messageId) return false;
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      await db.sqlPool.query(
        'DELETE FROM guild_reaction_roles WHERE guild_id=? AND message_id=?',
        [guildId, messageId]
      );
      
      // Invalidate cache
      const cacheData = cache.getCache();
      cacheData.guildReactionRolesCache.delete(guildId);
      
      return true;
    } catch (e) {
      console.error('Error removing reaction roles by message:', e.message);
    }
  }
  
  return false;
}

async function updateGuildReactionRole(guildId, id, data) {
  if (!guildId) throw new Error('guildId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      await db.sqlPool.query(`
        UPDATE guild_reaction_roles SET emoji=?, role_id=?, type=?, custom_message=?, title=?, status=?
        WHERE guild_id=? AND id=?
      `, [data.emoji, data.roleId, data.type, data.customMessage, data.title, data.status ? 1 : 0, guildId, id]);
      
      // Invalidate cache
      const cacheData = cache.getCache();
      cacheData.guildReactionRolesCache.delete(guildId);
      
      return true;
    } catch (e) {
      console.error('Error updating reaction role:', e.message);
    }
  }
  
  return false;
}

async function updateGuildReactionRoleStatus(guildId, id, status) {
  if (!guildId) throw new Error('guildId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      await db.sqlPool.query(
        'UPDATE guild_reaction_roles SET status=? WHERE guild_id=? AND id=?',
        [status ? 1 : 0, guildId, id]
      );
      
      // Invalidate cache
      const cacheData = cache.getCache();
      cacheData.guildReactionRolesCache.delete(guildId);
      
      return true;
    } catch (e) {
      console.error('Error updating reaction role status:', e.message);
    }
  }
  
  return false;
}

async function deleteGuildReactionRole(guildId, id) {
  if (!guildId) throw new Error('guildId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      await db.sqlPool.query(
        'DELETE FROM guild_reaction_roles WHERE guild_id=? AND id=?',
        [guildId, id]
      );
      
      // Invalidate cache
      const cacheData = cache.getCache();
      cacheData.guildReactionRolesCache.delete(guildId);
      
      return true;
    } catch (e) {
      console.error('Error deleting reaction role:', e.message);
    }
  }
  
  return false;
}

async function deleteGuildReactionRoleByMessageId(guildId, messageId) {
  if (!guildId || !messageId) return false;
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      await db.sqlPool.query(
        'DELETE FROM guild_reaction_roles WHERE guild_id=? AND message_id=?',
        [guildId, messageId]
      );
      
      // Invalidate cache
      const cacheData = cache.getCache();
      if (cacheData.guildReactionRolesCache) {
        cacheData.guildReactionRolesCache.delete(guildId);
      }
      
      return true;
    } catch (e) {
      console.error('Error deleting reaction role by message ID:', e.message);
    }
  }
  
  return false;
}

// Anti-Raid Settings
async function getGuildAntiRaidSettings(guildId) {
  if (!guildId) return { ...defaultConfigs.guildAntiRaidSettings };
  
  const cacheData = cache.getCache();
  if (cacheData.guildAntiRaidSettingsCache.has(guildId)) {
    return { ...cacheData.guildAntiRaidSettingsCache.get(guildId) };
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      // Get anti-raid settings from guild_antiraid_settings table
      const [rows] = await db.sqlPool.query(`
        SELECT enabled, join_rate_limit, join_rate_window, account_age_limit,
               auto_lockdown, auto_kick, lockdown_duration, alert_channel_id, raid_action, raid_action_duration,
               delete_spam_invites, new_member_period, whitelist_roles
        FROM guild_antiraid_settings WHERE guild_id=?
      `, [guildId]);
      
      // Also check moderation features table for enabled status
      const [featureRows] = await db.sqlPool.query(`
        SELECT enabled FROM guild_moderation_features 
        WHERE guild_id=? AND feature_key='antiraid'
      `, [guildId]);
      
      let config = { ...defaultConfigs.guildAntiRaidSettings };
      
      if (rows.length > 0) {
        const row = rows[0];
        config = {
          enabled: !!row.enabled,
          joinRate: row.join_rate_limit || 5,
          joinWindow: row.join_rate_window || 60,
          accountAge: row.account_age_limit || 7,
          autoLockdown: !!row.auto_lockdown,
          autoKick: !!row.auto_kick,
          lockdownDuration: row.lockdown_duration || 300,
          alertChannel: row.alert_channel_id,
          raidAction: row.raid_action || 'lockdown',
          raidActionDuration: row.raid_action_duration || 60,
          deleteInviteSpam: !!row.delete_spam_invites,
          gracePeriod: row.new_member_period || 30,
          bypassRoles: row.whitelist_roles ? JSON.parse(row.whitelist_roles) : [],
          verificationLevel: 'medium', // Default value, not stored in DB
          kickSuspicious: false // Default value, derived from raid_action
        };
        
        // Set kickSuspicious based on raid_action
        if (config.raidAction === 'kick' || config.raidAction === 'ban') {
          config.kickSuspicious = true;
        }
      }
      
      // If moderation features table has different enabled status, use the more restrictive one
      if (featureRows.length > 0) {
        const featureEnabled = !!featureRows[0].enabled;
        // Both tables must be enabled for the feature to be truly enabled
        config.enabled = config.enabled && featureEnabled;
      }
      
      cacheData.guildAntiRaidSettingsCache.set(guildId, config);
      return { ...config };
    } catch (e) {
      console.error('Error loading anti-raid settings:', e.message);
    }
  }
  
  const defaultConfig = { ...defaultConfigs.guildAntiRaidSettings };
  cacheData.guildAntiRaidSettingsCache.set(guildId, defaultConfig);
  return { ...defaultConfig };
}

async function updateGuildAntiRaidSettings(guildId, data) {
  if (!guildId) throw new Error('guildId required');
  
  const current = await getGuildAntiRaidSettings(guildId);
  const next = { ...current, ...data };
  
  // Map front-end field names to database column names
  const dbData = {
    enabled: next.enabled ? 1 : 0,
    join_rate_limit: next.joinRate || 5,
    join_rate_window: next.joinWindow || 60,
    account_age_limit: next.accountAge || 7,
    auto_lockdown: next.autoLockdown ? 1 : 0,
    auto_kick: next.autoKick ? 1 : 0,
    lockdown_duration: next.lockdownDuration || 300,
    alert_channel_id: next.alertChannel || null,
    raid_action: next.raidAction || 'lockdown',
    raid_action_duration: next.raidActionDuration || 60,
    delete_spam_invites: next.deleteInviteSpam ? 1 : 0,
    new_member_period: next.gracePeriod || 30,
    whitelist_roles: next.bypassRoles && next.bypassRoles.length > 0 ? JSON.stringify(next.bypassRoles) : null
  };
  
  const cacheData = cache.getCache();
  cacheData.guildAntiRaidSettingsCache.set(guildId, next);
  
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(`
      REPLACE INTO guild_antiraid_settings(
        guild_id, enabled, join_rate_limit, join_rate_window, account_age_limit,
        auto_lockdown, auto_kick, lockdown_duration, alert_channel_id, raid_action, raid_action_duration,
        delete_spam_invites, new_member_period, whitelist_roles
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      guildId, dbData.enabled, dbData.join_rate_limit, dbData.join_rate_window,
      dbData.account_age_limit, dbData.auto_lockdown, dbData.auto_kick, dbData.lockdown_duration,
      dbData.alert_channel_id, dbData.raid_action, dbData.raid_action_duration,
      dbData.delete_spam_invites, dbData.new_member_period, dbData.whitelist_roles
    ]);
    
    // If enabled status changed, sync with guild_moderation_features table
    if (data.hasOwnProperty('enabled') && current.enabled !== next.enabled) {
      await db.sqlPool.query(`
        INSERT INTO guild_moderation_features (guild_id, feature_key, enabled, config) 
        VALUES (?, 'antiraid', ?, '{}')
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
      `, [guildId, dbData.enabled]);
      
      // Clear moderation features cache to ensure consistency
      cacheData.guildModerationFeaturesCache.delete(guildId);
    }
  }
  
  return { ...next };
}

// Scheduled Messages
async function getGuildScheduledMessages(guildId) {
  if (!guildId) return [];
  
  const cacheData = cache.getCache();
  if (cacheData.guildScheduledMessagesCache.has(guildId)) {
    return [...cacheData.guildScheduledMessagesCache.get(guildId)];
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT id, title, channel_id, message_content, embed_data, schedule_type,
               schedule_value, next_run, last_run, enabled, created_by, created_at, updated_at
        FROM guild_scheduled_messages WHERE guild_id=? ORDER BY id
      `, [guildId]);
      
      const messages = rows.map(row => ({
        id: row.id,
        title: row.title,
        channelId: row.channel_id,
        messageContent: row.message_content,
        embedData: row.embed_data ? JSON.parse(row.embed_data) : null,
        scheduleType: row.schedule_type,
        scheduleValue: row.schedule_value,
        nextRun: row.next_run,
        lastRun: row.last_run,
        enabled: !!row.enabled,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      cacheData.guildScheduledMessagesCache.set(guildId, messages);
      return [...messages];
    } catch (e) {
      console.error('Error loading scheduled messages:', e.message);
    }
  }
  
  cacheData.guildScheduledMessagesCache.set(guildId, []);
  return [];
}

async function createGuildScheduledMessage(guildId, messageData, createdBy = 'system') {
  if (!guildId || !messageData.title || !messageData.channelId || (!messageData.messageContent && !messageData.message)) {
    throw new Error('Missing required fields: title, channelId, messageContent');
  }

  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(`
        INSERT INTO guild_scheduled_messages 
        (guild_id, title, channel_id, message_content, embed_data, schedule_type, schedule_value, enabled, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        guildId,
        messageData.title,
        messageData.channelId,
        messageData.messageContent || messageData.message,
        messageData.embedData ? JSON.stringify(messageData.embedData) : null,
        messageData.scheduleType || 'cron',
        messageData.scheduleValue,
        1, // Always enabled - no toggle functionality
        createdBy
      ]);

      // Clear cache
      const cacheData = cache.getCache();
      cacheData.guildScheduledMessagesCache.delete(guildId);

      // Fetch created message
      const messages = await getGuildScheduledMessages(guildId);
      const created = messages.find(msg => msg.id === result.insertId);

      // Timezone aware next_run (option 1) using guild timezone
      try {
        const guildSettings = await settingsService.getGuildSettings(guildId);
        const tz = guildSettings.timezone || 'UTC';
        // For once/daily/weekly/monthly we interpret schedule in guild TZ then convert to server Date
        if (created && created.scheduleType !== 'cron') {
          const nextDate = parseCanonicalNext(created.scheduleType, created.scheduleValue);
          if (nextDate) {
            await db.sqlPool.query('UPDATE guild_scheduled_messages SET next_run=? WHERE id=? AND guild_id=?',[nextDate, created.id, guildId]);
            created.nextRun = nextDate;
          }
        }
      } catch (e) { /* non-fatal */ }

      // Notify scheduler (option 3)
      if (created) {
        try { schedulerNotifyCreateOrUpdate(global.discordClient || null, guildId, created); } catch {}
      }
      return created;
    } catch (e) {
      console.error('Error creating scheduled message:', e.message);
      throw new Error('Failed to create scheduled message');
    }
  }

  throw new Error('Database not available');
}

async function updateGuildScheduledMessage(guildId, messageId, messageData) {
  if (!guildId || !messageId) {
    throw new Error('Guild ID and message ID are required');
  }

  if (db.mariaAvailable && db.sqlPool) {
    try {
      const updateFields = [];
      const updateValues = [];

      if (messageData.title !== undefined) {
        updateFields.push('title = ?');
        updateValues.push(messageData.title);
      }
      if (messageData.channelId !== undefined) {
        updateFields.push('channel_id = ?');
        updateValues.push(messageData.channelId);
      }
      if (messageData.messageContent !== undefined || messageData.message !== undefined) {
        updateFields.push('message_content = ?');
        updateValues.push(messageData.messageContent || messageData.message);
      }
      if (messageData.embedData !== undefined) {
        updateFields.push('embed_data = ?');
        updateValues.push(messageData.embedData ? JSON.stringify(messageData.embedData) : null);
      }
      if (messageData.scheduleType !== undefined) {
        updateFields.push('schedule_type = ?');
        updateValues.push(messageData.scheduleType);
      }
      if (messageData.scheduleValue !== undefined) {
        updateFields.push('schedule_value = ?');
        updateValues.push(messageData.scheduleValue);
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateValues.push(guildId, messageId);

      const [result] = await db.sqlPool.query(`
        UPDATE guild_scheduled_messages 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE guild_id = ? AND id = ?
      `, updateValues);

      if (result.affectedRows === 0) {
        throw new Error('Scheduled message not found');
      }

      // Clear cache
      const cacheData = cache.getCache();
      cacheData.guildScheduledMessagesCache.delete(guildId);

      // Return the updated message
      const messages = await getGuildScheduledMessages(guildId);
      const updated = messages.find(msg => msg.id == messageId);

      // Recompute next_run if schedule changed (option 3)
      if (updated && (messageData.scheduleType !== undefined || messageData.scheduleValue !== undefined)) {
        try {
          const nextDate = parseCanonicalNext(updated.scheduleType, updated.scheduleValue);
          if (nextDate) {
            await db.sqlPool.query('UPDATE guild_scheduled_messages SET next_run=? WHERE id=? AND guild_id=?',[nextDate, updated.id, guildId]);
            updated.nextRun = nextDate;
          }
        } catch {}
      }
      if (updated) {
        try { schedulerNotifyCreateOrUpdate(global.discordClient || null, guildId, updated); } catch {}
      }
      return updated;
    } catch (e) {
      console.error('Error updating scheduled message:', e.message);
      throw e;
    }
  }

  throw new Error('Database not available');
}

async function deleteGuildScheduledMessage(guildId, messageId) {
  if (!guildId || !messageId) {
    throw new Error('Guild ID and message ID are required');
  }

  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(`
        DELETE FROM guild_scheduled_messages 
        WHERE guild_id = ? AND id = ?
      `, [guildId, messageId]);

      if (result.affectedRows === 0) {
        throw new Error('Scheduled message not found');
      }

  // Clear cache
  const cacheData = cache.getCache();
  cacheData.guildScheduledMessagesCache.delete(guildId);
  try { schedulerNotifyDelete(guildId, messageId); } catch {}
  return true;
    } catch (e) {
      console.error('Error deleting scheduled message:', e.message);
      throw e;
    }
  }

  throw new Error('Database not available');
}

// Self-Assignable Roles
async function getGuildSelfAssignableRoles(guildId) {
  if (!guildId) return [];
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT command_name, description, channel_id, require_permission, allowed_roles, status,
               created_at, created_by, updated_at, updated_by,
               GROUP_CONCAT(CONCAT(id, ':', role_id, ':', role_type) SEPARATOR '|') as roles_data
        FROM guild_self_assignable_roles 
        WHERE guild_id = ? 
        GROUP BY command_name, description, channel_id, require_permission, allowed_roles, status, created_at, created_by, updated_at, updated_by
        ORDER BY command_name
      `, [guildId]);
      
      return rows.map(row => ({
        id: `${guildId}-${row.command_name}`,
        commandName: row.command_name,
        description: row.description,
        channelId: row.channel_id,
        requirePermission: row.require_permission,
        allowedRoles: row.allowed_roles ? JSON.parse(row.allowed_roles) : [],
        status: row.status,
        roles: row.roles_data ? row.roles_data.split('|').map(roleStr => {
          const [id, roleId, type] = roleStr.split(':');
          return { id: parseInt(id), roleId, type };
        }) : [],
        created_at: row.created_at,
        created_by: row.created_by,
        updated_at: row.updated_at,
        updated_by: row.updated_by
      }));
    } catch (e) {
      console.error('Error loading self-assignable roles:', e.message);
    }
  }
  
  return []; // Memory fallback
}

async function addGuildSelfAssignableRole(guildId, data, createdBy) {
  if (!guildId) throw new Error('guildId required');
  if (!data.commandName) throw new Error('commandName required');
  if (!data.roles || !Array.isArray(data.roles) || data.roles.length === 0) {
    throw new Error('At least one role is required');
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    const connection = await db.sqlPool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Delete existing roles for this command
      await connection.query(
        'DELETE FROM guild_self_assignable_roles WHERE guild_id = ? AND command_name = ?',
        [guildId, data.commandName]
      );
      
      // Insert new roles
      for (const role of data.roles) {
        await connection.query(`
          INSERT INTO guild_self_assignable_roles 
          (guild_id, command_name, description, channel_id, role_id, role_type, 
           require_permission, allowed_roles, status, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          guildId, data.commandName, data.description || '', data.channelId || null,
          role.roleId, role.type || 'toggle', data.requirePermission || false,
          JSON.stringify(data.allowedRoles || []), data.status !== false,
          createdBy || null, createdBy || null
        ]);
      }
      
      await connection.commit();
      return await getGuildSelfAssignableRoles(guildId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  throw new Error('Database not available');
}

async function updateGuildSelfAssignableRole(guildId, commandName, data, updatedBy) {
  if (!guildId) throw new Error('guildId required');
  if (!commandName) throw new Error('commandName required');
  
  if (db.mariaAvailable && db.sqlPool) {
    const connection = await db.sqlPool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Delete existing roles for this command
      await connection.query(
        'DELETE FROM guild_self_assignable_roles WHERE guild_id = ? AND command_name = ?',
        [guildId, commandName]
      );
      
      // Insert updated roles
      if (data.roles && data.roles.length > 0) {
        for (const role of data.roles) {
          await connection.query(`
            INSERT INTO guild_self_assignable_roles 
            (guild_id, command_name, description, channel_id, role_id, role_type, 
             require_permission, allowed_roles, status, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            guildId, commandName, data.description || '', data.channelId || null,
            role.roleId, role.type || 'toggle', data.requirePermission || false,
            JSON.stringify(data.allowedRoles || []), data.status !== false,
            updatedBy || null, updatedBy || null
          ]);
        }
      }
      
      await connection.commit();
      return await getGuildSelfAssignableRoles(guildId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  throw new Error('Database not available');
}

async function deleteGuildSelfAssignableRole(guildId, commandName) {
  if (!guildId) throw new Error('guildId required');
  if (!commandName) throw new Error('commandName required');
  
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'DELETE FROM guild_self_assignable_roles WHERE guild_id = ? AND command_name = ?',
      [guildId, commandName]
    );
    return true;
  }
  
  throw new Error('Database not available');
}

async function toggleGuildSelfAssignableRoleStatus(guildId, commandName, status) {
  if (!guildId) throw new Error('guildId required');
  if (!commandName) throw new Error('commandName required');
  
  // Ensure status is properly converted to database format
  const dbStatus = status === true || status === 'true' || status === 1 || status === '1' ? 1 : 0;
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(
        'UPDATE guild_self_assignable_roles SET status = ? WHERE guild_id = ? AND command_name = ?',
        [dbStatus, guildId, commandName]
      );
      
      if (result.affectedRows === 0) {
        throw new Error(`No self-assignable role found with command name: ${commandName}`);
      }
      
      return await getGuildSelfAssignableRoles(guildId);
    } catch (e) {
      console.error('[SelfAssignableRoles] Toggle error:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

async function getGuildSelfAssignableRoleByCommand(guildId, commandName) {
  if (!guildId) throw new Error('guildId required');
  if (!commandName) throw new Error('commandName required');
  
  if (db.mariaAvailable && db.sqlPool) {
    const [rows] = await db.sqlPool.query(`
      SELECT id, guild_id, command_name, description, channel_id, role_id, role_type, 
             require_permission, allowed_roles, status, created_at, created_by, 
             updated_at, updated_by
      FROM guild_self_assignable_roles 
      WHERE guild_id = ? AND command_name = ?
      ORDER BY role_id
    `, [guildId, commandName]);
    
    if (rows.length === 0) return null;
    
    const firstRow = rows[0];
    return {
      id: `${guildId}-${commandName}`,
      commandName: firstRow.command_name,
      description: firstRow.description,
      channelId: firstRow.channel_id,
      requirePermission: firstRow.require_permission,
      allowedRoles: firstRow.allowed_roles ? JSON.parse(firstRow.allowed_roles) : [],
      status: firstRow.status,
      roles: rows.map(row => ({
        id: row.id,
        roleId: row.role_id,
        type: row.role_type
      })),
      created_at: firstRow.created_at,
      created_by: firstRow.created_by,
      updated_at: firstRow.updated_at,
      updated_by: firstRow.updated_by
    };
  }
  
  return null;
}

// Profanity Words Management
async function getGuildProfanityWords(guildId) {
  if (!guildId) return [];
  
  const cacheData = cache.getCache();
  if (cacheData.guildProfanityWordsCache && cacheData.guildProfanityWordsCache.has(guildId)) {
    return [...cacheData.guildProfanityWordsCache.get(guildId)];
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT id, guild_id, word, severity, language, case_sensitive, 
               whole_word_only, enabled, created_at, updated_at, created_by
        FROM guild_profanity_words 
        WHERE guild_id = ? 
        ORDER BY severity DESC, word ASC
      `, [guildId]);
      
      const words = rows.map(row => ({
        id: row.id,
        guildId: row.guild_id,
        word: row.word,
        severity: row.severity,
        language: row.language,
        caseSensitive: row.case_sensitive,
        wholeWordOnly: row.whole_word_only,
        enabled: row.enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
      }));
      
      if (!cacheData.guildProfanityWordsCache) {
        cacheData.guildProfanityWordsCache = new Map();
      }
      cacheData.guildProfanityWordsCache.set(guildId, words);
      return [...words];
    } catch (e) {
      console.error('[Profanity] Get words error:', e.message);
    }
  }
  
  return [];
}

async function addGuildProfanityWord(guildId, data, createdBy) {
  if (!guildId) throw new Error('guildId required');
  if (!data.word) throw new Error('word required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(`
        INSERT INTO guild_profanity_words 
        (guild_id, word, severity, language, case_sensitive, whole_word_only, enabled, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        guildId, data.word, data.severity || 'medium', data.language || 'en',
        data.caseSensitive || false, data.wholeWordOnly !== false, 
        data.enabled !== false, createdBy
      ]);
      
      // Clear cache
      const cacheData = cache.getCache();
      if (cacheData.guildProfanityWordsCache) {
        cacheData.guildProfanityWordsCache.delete(guildId);
      }
      
      return await getGuildProfanityWords(guildId);
    } catch (e) {
      console.error('[Profanity] Add word error:', e.message);
      if (e.code === 'ER_DUP_ENTRY') {
        throw new Error('Word already exists for this guild');
      }
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

async function updateGuildProfanityWord(guildId, wordId, data, updatedBy) {
  if (!guildId) throw new Error('guildId required');
  if (!wordId) throw new Error('wordId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(`
        UPDATE guild_profanity_words 
        SET word = ?, severity = ?, language = ?, case_sensitive = ?, 
            whole_word_only = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND guild_id = ?
      `, [
        data.word, data.severity, data.language, data.caseSensitive,
        data.wholeWordOnly, data.enabled, wordId, guildId
      ]);
      
      if (result.affectedRows === 0) {
        throw new Error('Profanity word not found');
      }
      
      // Clear cache
      const cacheData = cache.getCache();
      if (cacheData.guildProfanityWordsCache) {
        cacheData.guildProfanityWordsCache.delete(guildId);
      }
      
      return await getGuildProfanityWords(guildId);
    } catch (e) {
      console.error('[Profanity] Update word error:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

async function deleteGuildProfanityWord(guildId, wordId) {
  if (!guildId) throw new Error('guildId required');
  if (!wordId) throw new Error('wordId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(
        'DELETE FROM guild_profanity_words WHERE id = ? AND guild_id = ?',
        [wordId, guildId]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('Profanity word not found');
      }
      
      // Clear cache
      const cacheData = cache.getCache();
      if (cacheData.guildProfanityWordsCache) {
        cacheData.guildProfanityWordsCache.delete(guildId);
      }
      
      return await getGuildProfanityWords(guildId);
    } catch (e) {
      console.error('[Profanity] Delete word error:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

// Profanity Patterns Management
async function getGuildProfanityPatterns(guildId) {
  if (!guildId) return [];
  
  const cacheData = cache.getCache();
  if (cacheData.guildProfanityPatternsCache && cacheData.guildProfanityPatternsCache.has(guildId)) {
    return [...cacheData.guildProfanityPatternsCache.get(guildId)];
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT id, guild_id, pattern, description, severity, flags, enabled, 
               created_at, updated_at, created_by
        FROM guild_profanity_patterns 
        WHERE guild_id = ? 
        ORDER BY severity DESC, created_at ASC
      `, [guildId]);
      
      const patterns = rows.map(row => ({
        id: row.id,
        guildId: row.guild_id,
        pattern: row.pattern,
        description: row.description,
        severity: row.severity,
        flags: row.flags,
        enabled: row.enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
      }));
      
      if (!cacheData.guildProfanityPatternsCache) {
        cacheData.guildProfanityPatternsCache = new Map();
      }
      cacheData.guildProfanityPatternsCache.set(guildId, patterns);
      return [...patterns];
    } catch (e) {
      console.error('[Profanity] Get patterns error:', e.message);
    }
  }
  
  return [];
}

async function addGuildProfanityPattern(guildId, data, createdBy) {
  if (!guildId) throw new Error('guildId required');
  if (!data.pattern) throw new Error('pattern required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(`
        INSERT INTO guild_profanity_patterns 
        (guild_id, pattern, description, severity, flags, enabled, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        guildId, data.pattern, data.description || '', data.severity || 'medium',
        data.flags || 'gi', data.enabled !== false, createdBy
      ]);
      
      // Clear cache
      const cacheData = cache.getCache();
      if (cacheData.guildProfanityPatternsCache) {
        cacheData.guildProfanityPatternsCache.delete(guildId);
      }
      
      return await getGuildProfanityPatterns(guildId);
    } catch (e) {
      console.error('[Profanity] Add pattern error:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

async function updateGuildProfanityPattern(guildId, patternId, data) {
  if (!guildId) throw new Error('guildId required');
  if (!patternId) throw new Error('patternId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(`
        UPDATE guild_profanity_patterns 
        SET pattern = ?, description = ?, severity = ?, flags = ?, enabled = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND guild_id = ?
      `, [
        data.pattern, data.description, data.severity, data.flags, 
        data.enabled, patternId, guildId
      ]);
      
      if (result.affectedRows === 0) {
        throw new Error('Profanity pattern not found');
      }
      
      // Clear cache
      const cacheData = cache.getCache();
      if (cacheData.guildProfanityPatternsCache) {
        cacheData.guildProfanityPatternsCache.delete(guildId);
      }
      
      return await getGuildProfanityPatterns(guildId);
    } catch (e) {
      console.error('[Profanity] Update pattern error:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

async function deleteGuildProfanityPattern(guildId, patternId) {
  if (!guildId) throw new Error('guildId required');
  if (!patternId) throw new Error('patternId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(
        'DELETE FROM guild_profanity_patterns WHERE id = ? AND guild_id = ?',
        [patternId, guildId]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('Profanity pattern not found');
      }
      
      // Clear cache
      const cacheData = cache.getCache();
      if (cacheData.guildProfanityPatternsCache) {
        cacheData.guildProfanityPatternsCache.delete(guildId);
      }
      
      return await getGuildProfanityPatterns(guildId);
    } catch (e) {
      console.error('[Profanity] Delete pattern error:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

// === VIOLATION TRACKING FUNCTIONS ===

// Record a new violation
async function recordViolation(violationData) {
  if (!db.mariaAvailable || !db.sqlPool) {
    console.warn('Database not available for violation recording');
    return null;
  }

  const {
    guildId,
    userId,
    ruleId = null,
    ruleType,
    ruleName,
    violationReason,
    messageContent = null,
    channelId,
    messageId = null,
    actionTaken,
    warningIncrement = 1,
    totalWarningsAtTime,
    thresholdAtTime,
    moderatorId = null,
    isAutoMod = true,
    severity = 'medium',
    metadata = null
  } = violationData;

  try {
    // Insert violation record
    const [result] = await db.sqlPool.query(`
      INSERT INTO guild_user_violations 
      (guild_id, user_id, rule_id, rule_type, rule_name, violation_reason, message_content, 
       channel_id, message_id, action_taken, warning_increment, total_warnings_at_time, 
       threshold_at_time, moderator_id, is_auto_mod, severity, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      guildId, userId, ruleId, ruleType, ruleName, violationReason, messageContent,
      channelId, messageId, actionTaken, warningIncrement, totalWarningsAtTime,
      thresholdAtTime, moderatorId, isAutoMod, severity, metadata ? JSON.stringify(metadata) : null
    ]);

    return result.insertId;
  } catch (error) {
    console.error('Error recording violation:', error);
    return null;
  }
}

// Get current warning count for a user and rule type
async function getWarningCount(guildId, userId, ruleType) {
  if (!db.mariaAvailable || !db.sqlPool) {
    return { count: 0, lastViolation: null };
  }

  try {
    const [rows] = await db.sqlPool.query(`
      SELECT warning_count, last_violation_at, last_reset_at
      FROM guild_user_warning_counts 
      WHERE guild_id = ? AND user_id = ? AND rule_type = ?
    `, [guildId, userId, ruleType]);

    if (rows.length === 0) {
      return { count: 0, lastViolation: null };
    }

    const row = rows[0];
    
    // Check if warnings should be auto-reset (1 hour since last violation)
    if (row.last_violation_at) {
      const hoursSinceLastViolation = (Date.now() - new Date(row.last_violation_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastViolation >= 1) {
        // Auto-reset warnings
        await resetWarningCount(guildId, userId, ruleType);
        return { count: 0, lastViolation: null };
      }
    }

    return {
      count: row.warning_count,
      lastViolation: row.last_violation_at
    };
  } catch (error) {
    console.error('Error getting warning count:', error);
    return { count: 0, lastViolation: null };
  }
}

// Increment warning count for a user and rule type
async function incrementWarningCount(guildId, userId, ruleType, increment = 1) {
  if (!db.mariaAvailable || !db.sqlPool) {
    console.warn('Database not available for warning count increment');
    return increment;
  }

  try {
    // Use INSERT ... ON DUPLICATE KEY UPDATE for atomic operation
    await db.sqlPool.query(`
      INSERT INTO guild_user_warning_counts 
      (guild_id, user_id, rule_type, warning_count, last_violation_at, total_violations)
      VALUES (?, ?, ?, ?, NOW(), ?)
      ON DUPLICATE KEY UPDATE
        warning_count = warning_count + VALUES(warning_count),
        last_violation_at = VALUES(last_violation_at),
        total_violations = total_violations + VALUES(total_violations)
    `, [guildId, userId, ruleType, increment, increment]);

    // Get the new count
    const result = await getWarningCount(guildId, userId, ruleType);
    return result.count;
  } catch (error) {
    console.error('Error incrementing warning count:', error);
    return increment;
  }
}

// Reset warning count for a user and rule type
async function resetWarningCount(guildId, userId, ruleType) {
  if (!db.mariaAvailable || !db.sqlPool) {
    console.warn('Database not available for warning count reset');
    return false;
  }

  try {
    await db.sqlPool.query(`
      UPDATE guild_user_warning_counts 
      SET warning_count = 0, last_reset_at = NOW()
      WHERE guild_id = ? AND user_id = ? AND rule_type = ?
    `, [guildId, userId, ruleType]);

    return true;
  } catch (error) {
    console.error('Error resetting warning count:', error);
    return false;
  }
}

// Get user violations with pagination and filtering
async function getUserViolations(guildId, userId, options = {}) {
  if (!db.mariaAvailable || !db.sqlPool) {
    return { violations: [], total: 0 };
  }

  const {
    ruleType = null,
    status = 'active',
    limit = 50,
    offset = 0,
    orderBy = 'created_at DESC'
  } = options;

  try {
    let whereClause = 'WHERE guild_id = ? AND user_id = ?';
    let params = [guildId, userId];

    if (ruleType) {
      whereClause += ' AND rule_type = ?';
      params.push(ruleType);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // Get total count
    const [countRows] = await db.sqlPool.query(`
      SELECT COUNT(*) as total FROM guild_user_violations ${whereClause}
    `, params);

    // Get violations
    const [violations] = await db.sqlPool.query(`
      SELECT * FROM guild_user_violations ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return {
      violations: violations.map(v => ({
        ...v,
        metadata: v.metadata ? JSON.parse(v.metadata) : null
      })),
      total: countRows[0].total
    };
  } catch (error) {
    console.error('Error getting user violations:', error);
    return { violations: [], total: 0 };
  }
}

// Get guild violations with pagination and filtering
async function getGuildViolations(guildId, options = {}) {
  if (!db.mariaAvailable || !db.sqlPool) {
    return { violations: [], total: 0 };
  }

  const {
    ruleType = null,
    userId = null,
    status = 'active',
    limit = 100,
    offset = 0,
    orderBy = 'created_at DESC'
  } = options;

  try {
    let whereClause = 'WHERE guild_id = ?';
    let params = [guildId];

    if (ruleType) {
      whereClause += ' AND rule_type = ?';
      params.push(ruleType);
    }

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(userId);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // Get total count
    const [countRows] = await db.sqlPool.query(`
      SELECT COUNT(*) as total FROM guild_user_violations ${whereClause}
    `, params);

    // Get violations
    const [violations] = await db.sqlPool.query(`
      SELECT * FROM guild_user_violations ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return {
      violations: violations.map(v => ({
        ...v,
        metadata: v.metadata ? JSON.parse(v.metadata) : null
      })),
      total: countRows[0].total
    };
  } catch (error) {
    console.error('Error getting guild violations:', error);
    return { violations: [], total: 0 };
  }
}

// Update violation status (for appeals, pardons, etc.)
async function updateViolationStatus(violationId, status, reviewerId = null, notes = null) {
  if (!db.mariaAvailable || !db.sqlPool) {
    console.warn('Database not available for violation status update');
    return false;
  }

  try {
    await db.sqlPool.query(`
      UPDATE guild_user_violations 
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `, [status, violationId]);

    // If this is an appeal approval/rejection, you might want to update the appeals table too
    if (reviewerId && notes) {
      await db.sqlPool.query(`
        UPDATE guild_violation_appeals 
        SET appeal_status = ?, reviewed_by = ?, reviewer_notes = ?, updated_at = NOW()
        WHERE violation_id = ?
      `, [status === 'pardoned' ? 'approved' : 'rejected', reviewerId, notes, violationId]);
    }

    return true;
  } catch (error) {
    console.error('Error updating violation status:', error);
    return false;
  }
}

// Cleanup expired violations (run periodically)
async function cleanupExpiredViolations() {
  if (!db.mariaAvailable || !db.sqlPool) {
    return 0;
  }

  try {
    const [result] = await db.sqlPool.query(`
      DELETE FROM guild_violations 
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
    `);
    return result.affectedRows || 0;
  } catch (error) {
    console.error('Error cleaning up expired violations:', error);
    return 0;
  }
}

// === AUDIT LOGGING FUNCTIONS ===

// Get guild audit log configuration
async function getGuildAuditLogConfig(guildId) {
  if (!guildId) return {
    globalChannel: null,
    messageChannel: null,
    memberChannel: null,
    channelChannel: null,
    roleChannel: null,
    serverChannel: null,
    voiceChannel: null,
    includeBots: true,
    enhancedDetails: true,
    enabled: false
  };
  
  const cacheData = cache.getCache();
  const cacheKey = `audit_config_${guildId}`;
  
  if (cacheData.guildAuditConfigCache && cacheData.guildAuditConfigCache.has(guildId)) {
    return { ...cacheData.guildAuditConfigCache.get(guildId) };
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      // Get config from guild_audit_logs_config table
      const [rows] = await db.sqlPool.query(`
        SELECT 
          global_channel as globalChannel,
          message_channel as messageChannel,
          member_channel as memberChannel,
          channel_channel as channelChannel,
          role_channel as roleChannel,
          server_channel as serverChannel,
          voice_channel as voiceChannel,
          include_bots as includeBots,
          enhanced_details as enhancedDetails,
          enabled
        FROM guild_audit_logs_config 
        WHERE guild_id = ?
      `, [guildId]);
      
      let config;
      if (rows.length > 0) {
        config = {
          globalChannel: rows[0].globalChannel,
          messageChannel: rows[0].messageChannel,
          memberChannel: rows[0].memberChannel,
          channelChannel: rows[0].channelChannel,
          roleChannel: rows[0].roleChannel,
          serverChannel: rows[0].serverChannel,
          voiceChannel: rows[0].voiceChannel,
          includeBots: Boolean(rows[0].includeBots),
          enhancedDetails: Boolean(rows[0].enhancedDetails),
          enabled: Boolean(rows[0].enabled)
        };
      } else {
        // If no config in guild_audit_logs_config, check guild_moderation_features for enabled status
        const [moderationRows] = await db.sqlPool.query(`
          SELECT enabled 
          FROM guild_moderation_features 
          WHERE guild_id = ? AND feature_key = 'logging'
        `, [guildId]);
        
        const enabledFromModeration = moderationRows.length > 0 ? Boolean(moderationRows[0].enabled) : false;
        
        // Return default config with enabled status from moderation features
        config = {
          globalChannel: null,
          messageChannel: null,
          memberChannel: null,
          channelChannel: null,
          roleChannel: null,
          serverChannel: null,
          voiceChannel: null,
          includeBots: true,
          enhancedDetails: true,
          enabled: enabledFromModeration
        };
      }
      
      // Cache the result
      if (!cacheData.guildAuditConfigCache) {
        cacheData.guildAuditConfigCache = new Map();
      }
      cacheData.guildAuditConfigCache.set(guildId, config);
      
      return config;
    } catch (error) {
      console.error('Error getting audit log config:', error);
      return {
        globalChannel: null,
        messageChannel: null,
        memberChannel: null,
        channelChannel: null,
        roleChannel: null,
        serverChannel: null,
        voiceChannel: null,
        includeBots: true,
        enhancedDetails: true,
        enabled: false
      };
    }
  }

  // Return default config if no database or error
  return {
    globalChannel: null,
    messageChannel: null,
    memberChannel: null,
    channelChannel: null,
    roleChannel: null,
    serverChannel: null,
    voiceChannel: null,
    includeBots: true,
    enhancedDetails: true,
    enabled: false
  };
}

// Update guild audit log configuration
async function updateGuildAuditLogConfig(guildId, config) {
  if (!guildId) throw new Error('guildId required');
  
  // Get current config to merge with updates
  const current = await getGuildAuditLogConfig(guildId);
  const updated = { ...current, ...config };
  
  // Clear cache
  const cacheData = cache.getCache();
  if (cacheData.guildAuditConfigCache) {
    cacheData.guildAuditConfigCache.delete(guildId);
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      // Insert or update the configuration in guild_audit_logs_config table
      await db.sqlPool.query(`
        INSERT INTO guild_audit_logs_config (
          guild_id, global_channel, message_channel, member_channel, 
          channel_channel, role_channel, server_channel, voice_channel,
          include_bots, enhanced_details, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          global_channel = VALUES(global_channel),
          message_channel = VALUES(message_channel),
          member_channel = VALUES(member_channel),
          channel_channel = VALUES(channel_channel),
          role_channel = VALUES(role_channel),
          server_channel = VALUES(server_channel),
          voice_channel = VALUES(voice_channel),
          include_bots = VALUES(include_bots),
          enhanced_details = VALUES(enhanced_details),
          enabled = VALUES(enabled),
          updated_at = NOW()
      `, [
        guildId,
        updated.globalChannel,
        updated.messageChannel,
        updated.memberChannel,
        updated.channelChannel,
        updated.roleChannel,
        updated.serverChannel,
        updated.voiceChannel,
        updated.includeBots ? 1 : 0,
        updated.enhancedDetails ? 1 : 0,
        updated.enabled ? 1 : 0
      ]);
      
      // If enabled field was updated, also sync with guild_moderation_features table
      if (config.hasOwnProperty('enabled')) {
        await db.sqlPool.query(`
          INSERT INTO guild_moderation_features (guild_id, feature_key, enabled, config)
          VALUES (?, 'logging', ?, '{}')
          ON DUPLICATE KEY UPDATE 
            enabled = VALUES(enabled),
            updated_at = NOW()
        `, [guildId, updated.enabled ? 1 : 0]);
        
        // Clear moderation features cache too
        if (cacheData.guildModerationFeaturesCache) {
          cacheData.guildModerationFeaturesCache.delete(guildId);
        }
      }
      
      // Cache the updated config
      if (!cacheData.guildAuditConfigCache) {
        cacheData.guildAuditConfigCache = new Map();
      }
      cacheData.guildAuditConfigCache.set(guildId, updated);
      
      return { ...updated };
    } catch (error) {
      console.error('Error saving audit log config:', error);
      throw error;
    }
  }
}

// Get guild audit logs with pagination and filtering
async function getGuildAuditLogs(guildId, options = {}) {
  if (!guildId) return { logs: [], total: 0 };
  
  const {
    actionType = null,
    userId = null,
    channelId = null,
    limit = 50,
    offset = 0,
    orderBy = 'created_at DESC'
  } = options;
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      let whereClause = 'WHERE guild_id = ?';
      let params = [guildId];
      
      if (actionType) {
        whereClause += ' AND action_type = ?';
        params.push(actionType);
      }
      
      if (userId) {
        whereClause += ' AND user_id = ?';
        params.push(userId);
      }
      
      if (channelId) {
        whereClause += ' AND channel_id = ?';
        params.push(channelId);
      }
      
      // Get total count
      const [countRows] = await db.sqlPool.query(`
        SELECT COUNT(*) as total FROM guild_audit_logs ${whereClause}
      `, params);
      
      // Get logs
      const [logs] = await db.sqlPool.query(`
        SELECT * FROM guild_audit_logs ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);
      
      return {
        logs: logs.map(log => ({
          ...log,
          metadata: log.metadata ? JSON.parse(log.metadata) : null
        })),
        total: countRows[0].total
      };
    } catch (e) {
      console.error('Error getting audit logs:', e.message);
      return { logs: [], total: 0 };
    }
  }
  
  return { logs: [], total: 0 };
}

// Create new audit log entry
async function createAuditLogEntry(guildId, logData) {
  if (!guildId) throw new Error('guildId required');
  if (!logData.actionType) throw new Error('actionType required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(`
        INSERT INTO guild_audit_logs(
          guild_id, action_type, user_id, moderator_id, target_id, channel_id, reason, metadata
        ) VALUES (?,?,?,?,?,?,?,?)
      `, [
        guildId, logData.actionType, logData.userId || null, logData.moderatorId || null,
        logData.targetId || null, logData.channelId || null, logData.reason || null,
        logData.metadata ? JSON.stringify(logData.metadata) : null
      ]);
      
      return result.insertId;
    } catch (e) {
      console.error('Error creating audit log entry:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

// Delete audit log entry
async function deleteAuditLogEntry(guildId, logId) {
  if (!guildId) throw new Error('guildId required');
  if (!logId) throw new Error('logId required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(
        'DELETE FROM guild_audit_logs WHERE guild_id=? AND id=?',
        [guildId, logId]
      );
      
      return result.affectedRows > 0;
    } catch (e) {
      console.error('Error deleting audit log entry:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

// Anti-raid logging
async function insertAntiRaidLog(guildId, logData) {
  if (!guildId) throw new Error('guildId required');
  if (!logData.eventType) throw new Error('eventType required');
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [result] = await db.sqlPool.query(`
        INSERT INTO guild_antiraid_logs(
          guild_id, event_type, user_id, user_tag, account_age_days, join_timestamp,
          raid_id, joins_in_window, young_account_ratio, action_type, action_duration,
          moderator_id, member_count_at_join, join_source, verification_level_at_join,
          created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
      `, [
        guildId,
        logData.eventType,
        logData.userId || null,
        logData.userTag || null,
        logData.accountAgeDays || null,
        logData.joinTimestamp || null,
        logData.raidId || null,
        logData.joinsInWindow || null,
        logData.youngAccountRatio || null,
        logData.actionType || null,
        logData.actionDuration || null,
        logData.moderatorId || null,
        logData.memberCountAtJoin || null,
        logData.joinSource || null,
        logData.verificationLevelAtJoin || null
      ]);
      
      return result.insertId;
    } catch (e) {
      console.error('Error inserting anti-raid log:', e.message);
      throw e;
    }
  }
  
  throw new Error('Database not available');
}

module.exports = {
  getModerationFeatures,
  toggleModerationFeature,
  updateModerationFeatureConfig,
  getGuildAutoModRules,
  createGuildAutoModRule,
  updateGuildAutoModRule,
  deleteGuildAutoModRule,
  toggleGuildAutoModRule,
  getGuildXpSettings,
  updateGuildXpSettings,
  // User XP management
  getUserXp,
  addUserXp,
  getGuildLeaderboard,
  resetUserXp,
  setUserXp,
  calculateLevel,
  getXpForLevel,
  // Level rewards
  getGuildLevelRewards,
  addGuildLevelReward,
  removeGuildLevelReward,
  getGuildReactionRoles,
  addGuildReactionRole,
  removeGuildReactionRolesByMessage,
  updateGuildReactionRole,
  updateGuildReactionRoleStatus,
  deleteGuildReactionRole,
  deleteGuildReactionRoleByMessageId,
  getGuildAntiRaidSettings,
  updateGuildAntiRaidSettings,
  getGuildScheduledMessages,
  createGuildScheduledMessage,
  updateGuildScheduledMessage,
  deleteGuildScheduledMessage,
  getGuildSelfAssignableRoles,
  addGuildSelfAssignableRole,
  updateGuildSelfAssignableRole,
  deleteGuildSelfAssignableRole,
  toggleGuildSelfAssignableRoleStatus,
  getGuildSelfAssignableRoleByCommand,
  // Profanity management
  getGuildProfanityWords,
  addGuildProfanityWord,
  updateGuildProfanityWord,
  deleteGuildProfanityWord,
  getGuildProfanityPatterns,
  addGuildProfanityPattern,
  updateGuildProfanityPattern,
  deleteGuildProfanityPattern,
  // Violation tracking
  recordViolation,
  getWarningCount,
  incrementWarningCount,
  resetWarningCount,
  getUserViolations,
  getGuildViolations,
  updateViolationStatus,
  cleanupExpiredViolations,
  // Audit logging
  getGuildAuditLogConfig,
  updateGuildAuditLogConfig,
  getGuildAuditLogs,
  createAuditLogEntry,
  deleteAuditLogEntry,
  // Anti-raid logging
  insertAntiRaidLog
};
