// Genshin Impact service - handles player tracking and configuration
const db = require('../database/connection');
const cache = require('../cache/manager');
const { defaultConfigs } = require('../models/defaults');

/**
 * Formats a JavaScript Date object for MySQL datetime storage
 * @param {Date} date - Date to format
 * @returns {string} MySQL-compatible datetime string
 */
function formatDateForMySQL(date = new Date()) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function getGuildGenshinConfig(guildId) {
  if (!guildId) return { ...defaultConfigs.guildGenshinConfig };
  
  const cacheData = cache.getCache();
  if (cacheData.guildGenshinConfigCache && cacheData.guildGenshinConfigCache.has(guildId)) {
    return { ...cacheData.guildGenshinConfigCache.get(guildId) };
  }
  
  // Initialize cache if not exists
  if (!cacheData.guildGenshinConfigCache) {
    cacheData.guildGenshinConfigCache = new Map();
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      // Get all player configurations for this guild
      const [rows] = await db.sqlPool.query(`
        SELECT player_uid, player_name, player_order,
               profile_announce_channel_id, achievement_announce_channel_id, spiral_abyss_announce_channel_id,
               profile_mention_target, achievement_mention_target, spiral_abyss_mention_target,
               enabled, interval_sec, track_profile_updates, track_achievements, track_spiral_abyss,
               achievement_threshold, profile_update_template, achievement_template, spiral_abyss_template,
               embed_enabled, player_data, last_profile_check, last_achievement_count, last_spiral_abyss_floor
        FROM guild_genshin_watch 
        WHERE guild_id = ?
        ORDER BY player_order ASC, id ASC
      `, [guildId]);
      
      if (rows.length > 0) {
        // Build configuration from multiple player rows
        const firstRow = rows[0];
        const players = rows.map(row => row.player_uid);
        const playerNames = {};
        const playerMessages = {};
        
        rows.forEach(row => {
          if (row.player_name) {
            playerNames[row.player_uid] = row.player_name;
          }
          // Could add custom messages per player if needed
        });

        // Parse mention targets
        let mentionTargets = [];
        try {
          if (firstRow.profile_mention_target) {
            const parsed = JSON.parse(firstRow.profile_mention_target);
            if (Array.isArray(parsed)) {
              mentionTargets = parsed;
            }
          }
        } catch (e) {
          console.warn('Failed to parse Genshin mention targets for guild', guildId);
        }

        const config = {
          enabled: Boolean(firstRow.enabled),
          intervalSec: Number(firstRow.interval_sec) || 1800,
          embedEnabled: Boolean(firstRow.embed_enabled),
          players: players,
          playerNames: playerNames,
          playerMessages: playerMessages,
          mentionTargets: mentionTargets,
          profileUpdateTemplate: firstRow.profile_update_template || '',
          achievementTemplate: firstRow.achievement_template || '',
          spiralAbyssTemplate: firstRow.spiral_abyss_template || '',
          profileAnnounceChannelId: firstRow.profile_announce_channel_id,
          achievementAnnounceChannelId: firstRow.achievement_announce_channel_id,
          spiralAbyssAnnounceChannelId: firstRow.spiral_abyss_announce_channel_id,
          trackProfileUpdates: Boolean(firstRow.track_profile_updates),
          trackAchievements: Boolean(firstRow.track_achievements),
          trackSpiralAbyss: Boolean(firstRow.track_spiral_abyss),
          minAchievementThreshold: Number(firstRow.achievement_threshold) || 10
        };

        cacheData.guildGenshinConfigCache.set(guildId, config);
        return { ...config };
      }
    } catch (error) {
      console.error('Error fetching Genshin config for guild', guildId, ':', error);
    }
  }

  // Return default config if no data found or database unavailable
  const defaultConfig = { ...defaultConfigs.guildGenshinConfig };
  cacheData.guildGenshinConfigCache.set(guildId, defaultConfig);
  return defaultConfig;
}

async function updateGuildGenshinConfig(guildId, updates) {
  if (!guildId) return;
  
  const cacheData = cache.getCache();
  if (!cacheData.guildGenshinConfigCache) {
    cacheData.guildGenshinConfigCache = new Map();
  }

  if (db.mariaAvailable && db.sqlPool) {
    const connection = await db.sqlPool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get current configuration to determine what to update
      const current = await getGuildGenshinConfig(guildId);
      const newConfig = { ...current, ...updates };

      // Delete existing entries for this guild
      await connection.query('DELETE FROM guild_genshin_watch WHERE guild_id = ?', [guildId]);

      // Insert new entries for each player
      if (newConfig.players && newConfig.players.length > 0) {
        const insertData = newConfig.players.map((uid, index) => [
          guildId,
          uid,
          newConfig.playerNames?.[uid] || null,
          index + 1, // player_order
          newConfig.profileAnnounceChannelId,
          newConfig.achievementAnnounceChannelId,
          newConfig.spiralAbyssAnnounceChannelId,
          JSON.stringify(newConfig.mentionTargets || []),
          JSON.stringify(newConfig.mentionTargets || []), // Same for all types for now
          JSON.stringify(newConfig.mentionTargets || []),
          newConfig.enabled ? 1 : 0,
          newConfig.intervalSec || 1800,
          newConfig.trackProfileUpdates ? 1 : 0,
          newConfig.trackAchievements ? 1 : 0,
          newConfig.trackSpiralAbyss ? 1 : 0,
          newConfig.minAchievementThreshold || 10,
          newConfig.profileUpdateTemplate || '',
          newConfig.achievementTemplate || '',
          newConfig.spiralAbyssTemplate || '',
          newConfig.embedEnabled ? 1 : 0,
          null, // player_data - will be populated by watcher
          formatDateForMySQL(), // last_profile_check
          0, // last_achievement_count
          null // last_spiral_abyss_floor
        ]);

        const placeholders = insertData.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
        const query = `
          INSERT INTO guild_genshin_watch (
            guild_id, player_uid, player_name, player_order,
            profile_announce_channel_id, achievement_announce_channel_id, spiral_abyss_announce_channel_id,
            profile_mention_target, achievement_mention_target, spiral_abyss_mention_target,
            enabled, interval_sec, track_profile_updates, track_achievements, track_spiral_abyss,
            achievement_threshold, profile_update_template, achievement_template, spiral_abyss_template,
            embed_enabled, player_data, last_profile_check, last_achievement_count, last_spiral_abyss_floor
          ) VALUES ${placeholders}
        `;

        await connection.query(query, insertData.flat());
      } else {
        // If no players, insert a single row with default configuration
        await connection.query(`
          INSERT INTO guild_genshin_watch (
            guild_id, player_uid, player_name, player_order,
            profile_announce_channel_id, achievement_announce_channel_id, spiral_abyss_announce_channel_id,
            profile_mention_target, achievement_mention_target, spiral_abyss_mention_target,
            enabled, interval_sec, track_profile_updates, track_achievements, track_spiral_abyss,
            achievement_threshold, profile_update_template, achievement_template, spiral_abyss_template,
            embed_enabled, player_data, last_profile_check, last_achievement_count, last_spiral_abyss_floor
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
          guildId, null, null, 1,
          newConfig.profileAnnounceChannelId,
          newConfig.achievementAnnounceChannelId,
          newConfig.spiralAbyssAnnounceChannelId,
          JSON.stringify(newConfig.mentionTargets || []),
          JSON.stringify(newConfig.mentionTargets || []),
          JSON.stringify(newConfig.mentionTargets || []),
          newConfig.enabled ? 1 : 0,
          newConfig.intervalSec || 1800,
          newConfig.trackProfileUpdates ? 1 : 0,
          newConfig.trackAchievements ? 1 : 0,
          newConfig.trackSpiralAbyss ? 1 : 0,
          newConfig.minAchievementThreshold || 10,
          newConfig.profileUpdateTemplate || '',
          newConfig.achievementTemplate || '',
          newConfig.spiralAbyssTemplate || '',
          newConfig.embedEnabled ? 1 : 0,
          null,
          formatDateForMySQL(),
          0,
          null
        ]);
      }

      await connection.commit();

      // Update cache
      cacheData.guildGenshinConfigCache.set(guildId, newConfig);

    } catch (error) {
      await connection.rollback();
      console.error('Error updating Genshin config for guild', guildId, ':', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

// Add a new player to tracking
async function addGenshinPlayer(guildId, uid, playerName = null) {
  const config = await getGuildGenshinConfig(guildId);
  
  if (!config.players.includes(uid)) {
    const newPlayers = [...config.players, uid];
    const newPlayerNames = { ...config.playerNames };
    
    if (playerName) {
      newPlayerNames[uid] = playerName;
    }
    
    await updateGuildGenshinConfig(guildId, {
      players: newPlayers,
      playerNames: newPlayerNames
    });
  }
}

// Remove a player from tracking
async function removeGenshinPlayer(guildId, uid) {
  const config = await getGuildGenshinConfig(guildId);
  
  const newPlayers = config.players.filter(p => p !== uid);
  const newPlayerNames = { ...config.playerNames };
  const newPlayerMessages = { ...config.playerMessages };
  
  delete newPlayerNames[uid];
  delete newPlayerMessages[uid];
  
  await updateGuildGenshinConfig(guildId, {
    players: newPlayers,
    playerNames: newPlayerNames,
    playerMessages: newPlayerMessages
  });
}

// Clear cache for a specific guild
async function clearGenshinConfigCache(guildId) {
  const cacheData = cache.getCache();
  if (cacheData.guildGenshinConfigCache && guildId) {
    cacheData.guildGenshinConfigCache.delete(guildId);
  }
}

module.exports = {
  getGuildGenshinConfig,
  updateGuildGenshinConfig,
  addGenshinPlayer,
  removeGenshinPlayer,
  clearGenshinConfigCache
};