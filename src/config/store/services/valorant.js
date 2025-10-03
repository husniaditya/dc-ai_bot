// Valorant service - handles player tracking and configuration
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

async function getGuildValorantConfig(guildId) {
  if (!guildId) return { ...defaultConfigs.guildValorantConfig };
  
  const cacheData = cache.getCache();
  if (cacheData.guildValorantConfigCache && cacheData.guildValorantConfigCache.has(guildId)) {
    return { ...cacheData.guildValorantConfigCache.get(guildId) };
  }
  
  // Initialize cache if not exists
  if (!cacheData.guildValorantConfigCache) {
    cacheData.guildValorantConfigCache = new Map();
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      // Get all player configurations for this guild
      const [rows] = await db.sqlPool.query(`
        SELECT player_riot_id, player_name, player_region, player_order,
               match_announce_channel_id, rank_announce_channel_id, achievement_announce_channel_id,
               mention_targets,
               enabled, interval_sec, track_matches, track_rank_changes, track_achievements,
               match_types, min_kills_threshold,
               match_template, rank_change_template, achievement_template,
               embed_enabled, player_data, last_match_check, last_rank, last_rr
        FROM guild_valorant_watch 
        WHERE guild_id = ?
        ORDER BY player_order ASC, id ASC
      `, [guildId]);
      
      if (rows.length > 0) {
        // Build configuration from multiple player rows
        const firstRow = rows[0];
        const players = rows.map(row => row.player_riot_id);
        const playerNames = {};
        const playerMessages = {};
        const playerRegions = {};
        
        rows.forEach(row => {
          if (row.player_name) {
            playerNames[row.player_riot_id] = row.player_name;
          }
          if (row.player_region) {
            playerRegions[row.player_riot_id] = row.player_region;
          }
          // Could add custom messages per player if needed
        });

        // Parse mention targets
        let mentionTargets = [];
        try {
          if (firstRow.mention_targets) {
            const parsed = JSON.parse(firstRow.mention_targets);
            if (Array.isArray(parsed)) {
              mentionTargets = parsed;
            }
          }
        } catch (e) {
          console.warn('Failed to parse Valorant mention targets for guild', guildId);
        }

        // Parse match types
        let matchTypes = { competitive: true, unrated: false, deathmatch: false, spikerush: false };
        try {
          if (firstRow.match_types) {
            const parsed = JSON.parse(firstRow.match_types);
            if (typeof parsed === 'object') {
              matchTypes = { ...matchTypes, ...parsed };
            }
          }
        } catch (e) {
          console.warn('Failed to parse Valorant match types for guild', guildId);
        }

        const config = {
          enabled: Boolean(firstRow.enabled),
          intervalSec: Number(firstRow.interval_sec) || 1800,
          embedEnabled: Boolean(firstRow.embed_enabled),
          players: players,
          playerNames: playerNames,
          playerMessages: playerMessages,
          playerRegions: playerRegions,
          mentionTargets: mentionTargets,
          matchTemplate: firstRow.match_template || '',
          rankChangeTemplate: firstRow.rank_change_template || '',
          achievementTemplate: firstRow.achievement_template || '',
          matchAnnounceChannelId: firstRow.match_announce_channel_id,
          rankAnnounceChannelId: firstRow.rank_announce_channel_id,
          achievementAnnounceChannelId: firstRow.achievement_announce_channel_id,
          trackMatches: Boolean(firstRow.track_matches),
          trackRankChanges: Boolean(firstRow.track_rank_changes),
          trackAchievements: Boolean(firstRow.track_achievements),
          matchTypes: matchTypes,
          minKillsThreshold: Number(firstRow.min_kills_threshold) || 20
        };

        cacheData.guildValorantConfigCache.set(guildId, config);
        return { ...config };
      }
    } catch (error) {
      console.error('Error fetching Valorant config for guild', guildId, ':', error);
    }
  }

  // Return default config if no data found or database unavailable
  const defaultConfig = { ...defaultConfigs.guildValorantConfig };
  cacheData.guildValorantConfigCache.set(guildId, defaultConfig);
  return defaultConfig;
}

async function updateGuildValorantConfig(guildId, updates) {
  if (!guildId) throw new Error('Missing guild ID for Valorant config update');
  
  const cacheData = cache.getCache();
  
  // Initialize cache if not exists
  if (!cacheData.guildValorantConfigCache) {
    cacheData.guildValorantConfigCache = new Map();
  }

  if (db.mariaAvailable && db.sqlPool) {
    let connection;
    try {
      connection = await db.sqlPool.getConnection();
      
      // Get current config
      const current = await getGuildValorantConfig(guildId);
      
      // Merge with updates
      const newConfig = {
        ...current,
        ...updates
      };

      // Validate and sanitize
      if (newConfig.intervalSec !== undefined) {
        newConfig.intervalSec = Math.max(300, Math.min(86400, Number(newConfig.intervalSec)));
      }
      
      if (newConfig.minKillsThreshold !== undefined) {
        newConfig.minKillsThreshold = Math.max(0, Math.min(100, Number(newConfig.minKillsThreshold)));
      }

      // Ensure arrays and objects
      if (!Array.isArray(newConfig.players)) newConfig.players = [];
      if (typeof newConfig.playerNames !== 'object') newConfig.playerNames = {};
      if (typeof newConfig.playerMessages !== 'object') newConfig.playerMessages = {};
      if (typeof newConfig.playerRegions !== 'object') newConfig.playerRegions = {};
      if (!Array.isArray(newConfig.mentionTargets)) newConfig.mentionTargets = [];
      if (typeof newConfig.matchTypes !== 'object') {
        newConfig.matchTypes = { competitive: true, unrated: false, deathmatch: false, spikerush: false };
      }

      const now = formatDateForMySQL();

      // Start transaction
      await connection.beginTransaction();

      // Delete all existing player configurations
      await connection.query('DELETE FROM guild_valorant_watch WHERE guild_id = ?', [guildId]);

      // Insert new configurations for each player
      if (newConfig.players.length > 0) {
        for (let i = 0; i < newConfig.players.length; i++) {
          const riotId = newConfig.players[i];
          const playerName = newConfig.playerNames[riotId] || null;
          const playerRegion = newConfig.playerRegions[riotId] || 'na';
          
          await connection.query(`
            INSERT INTO guild_valorant_watch (
              guild_id, player_riot_id, player_name, player_region, player_order,
              match_announce_channel_id, rank_announce_channel_id, achievement_announce_channel_id,
              mention_targets,
              enabled, interval_sec, track_matches, track_rank_changes, track_achievements,
              match_types, min_kills_threshold,
              match_template, rank_change_template, achievement_template,
              embed_enabled, last_match_check
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            guildId,
            riotId,
            playerName,
            playerRegion,
            i,
            newConfig.matchAnnounceChannelId || null,
            newConfig.rankAnnounceChannelId || null,
            newConfig.achievementAnnounceChannelId || null,
            JSON.stringify(newConfig.mentionTargets),
            newConfig.enabled ? 1 : 0,
            newConfig.intervalSec,
            newConfig.trackMatches ? 1 : 0,
            newConfig.trackRankChanges ? 1 : 0,
            newConfig.trackAchievements ? 1 : 0,
            JSON.stringify(newConfig.matchTypes),
            newConfig.minKillsThreshold,
            newConfig.matchTemplate || '',
            newConfig.rankChangeTemplate || '',
            newConfig.achievementTemplate || '',
            newConfig.embedEnabled ? 1 : 0,
            now
          ]);
        }
      } else {
        // Insert a placeholder row with enabled = false if no players
        await connection.query(`
          INSERT INTO guild_valorant_watch (
            guild_id, player_riot_id, player_name, player_region, player_order,
            match_announce_channel_id, rank_announce_channel_id, achievement_announce_channel_id,
            mention_targets,
            enabled, interval_sec, track_matches, track_rank_changes, track_achievements,
            match_types, min_kills_threshold,
            match_template, rank_change_template, achievement_template,
            embed_enabled, last_match_check
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          guildId,
          '',
          null,
          'na',
          0,
          newConfig.matchAnnounceChannelId || null,
          newConfig.rankAnnounceChannelId || null,
          newConfig.achievementAnnounceChannelId || null,
          JSON.stringify(newConfig.mentionTargets),
          0, // enabled = false when no players
          newConfig.intervalSec,
          newConfig.trackMatches ? 1 : 0,
          newConfig.trackRankChanges ? 1 : 0,
          newConfig.trackAchievements ? 1 : 0,
          JSON.stringify(newConfig.matchTypes),
          newConfig.minKillsThreshold,
          newConfig.matchTemplate || '',
          newConfig.rankChangeTemplate || '',
          newConfig.achievementTemplate || '',
          newConfig.embedEnabled ? 1 : 0,
          now
        ]);
      }

      await connection.commit();
      
      // Update cache
      cacheData.guildValorantConfigCache.set(guildId, newConfig);
      
      return newConfig;
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error updating Valorant config for guild', guildId, ':', error);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  // If database unavailable, update cache only
  const current = cacheData.guildValorantConfigCache.get(guildId) || { ...defaultConfigs.guildValorantConfig };
  const newConfig = { ...current, ...updates };
  cacheData.guildValorantConfigCache.set(guildId, newConfig);
  return newConfig;
}

// Add a new player to watch
async function addValorantPlayer(guildId, riotId, playerName, region) {
  const config = await getGuildValorantConfig(guildId);
  if (!config.players.includes(riotId)) {
    config.players.push(riotId);
    config.playerNames[riotId] = playerName;
    config.playerRegions[riotId] = region;
    await updateGuildValorantConfig(guildId, {
      players: config.players,
      playerNames: config.playerNames,
      playerRegions: config.playerRegions
    });
  }
  return config;
}

// Remove a player from watch list
async function removeValorantPlayer(guildId, riotId) {
  const config = await getGuildValorantConfig(guildId);
  config.players = config.players.filter(p => p !== riotId);
  delete config.playerNames[riotId];
  delete config.playerMessages[riotId];
  delete config.playerRegions[riotId];
  
  await updateGuildValorantConfig(guildId, {
    players: config.players,
    playerNames: config.playerNames,
    playerMessages: config.playerMessages,
    playerRegions: config.playerRegions
  });
  return config;
}

module.exports = {
  getGuildValorantConfig,
  updateGuildValorantConfig,
  addValorantPlayer,
  removeValorantPlayer
};
