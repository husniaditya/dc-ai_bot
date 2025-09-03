// Moderation service - handles all moderation-related features and settings
const db = require('../database/connection');
const cache = require('../cache/manager');
const { defaultConfigs } = require('../models/defaults');

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
          ignoredChannels: row.ignored_channels ? JSON.parse(row.ignored_channels) : [],
          ignoredRoles: row.ignored_roles ? JSON.parse(row.ignored_roles) : [],
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
  
  const defaultConfig = { ...defaultConfigs.guildXpSettings };
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
      JSON.stringify(next.ignoredChannels), JSON.stringify(next.ignoredRoles),
      next.levelUpMessages ? 1 : 0, next.levelUpChannel, JSON.stringify(next.doubleXpEvents)
    ]);
  }
  
  return { ...next };
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
      cacheData.guildReactionRolesCache.delete(guildId);
      
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
      const [rows] = await db.sqlPool.query(`
        SELECT enabled, join_rate_limit, join_rate_window, account_age_limit,
               auto_lockdown, lockdown_duration, alert_channel_id
        FROM guild_antiraid_settings WHERE guild_id=?
      `, [guildId]);
      
      if (rows.length > 0) {
        const row = rows[0];
        const config = {
          enabled: !!row.enabled,
          joinRateLimit: row.join_rate_limit,
          joinRateWindow: row.join_rate_window,
          accountAgeLimit: row.account_age_limit,
          autoLockdown: !!row.auto_lockdown,
          lockdownDuration: row.lockdown_duration,
          alertChannelId: row.alert_channel_id
        };
        
        cacheData.guildAntiRaidSettingsCache.set(guildId, config);
        return { ...config };
      }
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
  
  const cacheData = cache.getCache();
  cacheData.guildAntiRaidSettingsCache.set(guildId, next);
  
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(`
      REPLACE INTO guild_antiraid_settings(
        guild_id, enabled, join_rate_limit, join_rate_window, account_age_limit,
        auto_lockdown, lockdown_duration, alert_channel_id
      ) VALUES (?,?,?,?,?,?,?,?)
    `, [
      guildId, next.enabled ? 1 : 0, next.joinRateLimit, next.joinRateWindow,
      next.accountAgeLimit, next.autoLockdown ? 1 : 0, next.lockdownDuration, next.alertChannelId
    ]);
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
        SELECT id, name, channel_id, message_content, embed_data, schedule_type,
               schedule_value, next_run, last_run, enabled, created_by
        FROM guild_scheduled_messages WHERE guild_id=? ORDER BY id
      `, [guildId]);
      
      const messages = rows.map(row => ({
        id: row.id,
        name: row.name,
        channelId: row.channel_id,
        messageContent: row.message_content,
        embedData: row.embed_data ? JSON.parse(row.embed_data) : null,
        scheduleType: row.schedule_type,
        scheduleValue: row.schedule_value,
        nextRun: row.next_run,
        lastRun: row.last_run,
        enabled: !!row.enabled,
        createdBy: row.created_by
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
  deleteGuildProfanityPattern
};
