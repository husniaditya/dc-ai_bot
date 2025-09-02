// Twitch service - handles guild Twitch watcher configuration
const db = require('../database/connection');
const cache = require('../cache/manager');
const { defaultConfigs } = require('../models/defaults');

async function getGuildTwitchConfig(guildId) {
  if (!guildId) return { ...defaultConfigs.guildTwitchConfig };
  
  const cacheData = cache.getCache();
  if (cacheData.guildTwitchConfigCache.has(guildId)) {
    return { ...cacheData.guildTwitchConfigCache.get(guildId) };
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT streamers, announce_channel_id, mention_target, enabled, interval_sec,
               live_template, embed_enabled, streamer_messages, streamer_names
        FROM guild_twitch_watch WHERE guild_id=?
      `, [guildId]);
      
      if (rows.length > 0) {
        const row = rows[0];
        const config = {
          streamers: row.streamers ? row.streamers.split(',').filter(Boolean) : [],
          announceChannelId: row.announce_channel_id,
          mentionRoleId: null, // legacy field
          mentionTargets: row.mention_target ? row.mention_target.split(',').filter(Boolean) : [],
          enabled: !!row.enabled,
          intervalSec: row.interval_sec || 300,
          liveTemplate: row.live_template || defaultConfigs.guildTwitchConfig.liveTemplate,
          embedEnabled: row.embed_enabled !== 0,
          streamerMessages: row.streamer_messages ? JSON.parse(row.streamer_messages) : {},
          streamerNames: row.streamer_names ? JSON.parse(row.streamer_names) : {}
        };
        
        cacheData.guildTwitchConfigCache.set(guildId, config);
        return { ...config };
      }
    } catch (e) {
      console.error('Error loading guild Twitch config:', e.message);
    }
  }
  
  return { ...defaultConfigs.guildTwitchConfig }; // memory fallback (not persisted)
}

async function setGuildTwitchConfig(guildId, partial) {
  if (!guildId) throw new Error('guildId required');
  
  const current = await getGuildTwitchConfig(guildId);
  const next = { ...current };
  
  if (Array.isArray(partial.streamers)) {
    next.streamers = partial.streamers.slice(0, 50); // reasonable cap
  }
  if (partial.announceChannelId !== undefined) next.announceChannelId = partial.announceChannelId;
  
  // Multi-role logic: prefer mentionTargets if provided else fallback to mentionRoleId
  if (Array.isArray(partial.mentionTargets)) {
    next.mentionTargets = partial.mentionTargets.slice(0, 10);
    next.mentionRoleId = null; // clear legacy field
  } else if (partial.mentionRoleId !== undefined) {
    next.mentionRoleId = partial.mentionRoleId;
    next.mentionTargets = partial.mentionRoleId ? [partial.mentionRoleId] : [];
  }
  
  if (partial.enabled !== undefined) next.enabled = partial.enabled;
  if (partial.intervalSec !== undefined) {
    next.intervalSec = Math.max(60, Math.min(3600, partial.intervalSec)); // 1 min to 1 hour
  }
  if (partial.liveTemplate !== undefined) next.liveTemplate = partial.liveTemplate;
  if (partial.embedEnabled !== undefined) next.embedEnabled = partial.embedEnabled;
  if (partial.streamerMessages && typeof partial.streamerMessages === 'object') {
    next.streamerMessages = partial.streamerMessages;
  }
  if (partial.streamerNames && typeof partial.streamerNames === 'object') {
    next.streamerNames = partial.streamerNames;
  }
  
  const cacheData = cache.getCache();
  cacheData.guildTwitchConfigCache.set(guildId, next);
  
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(`
      REPLACE INTO guild_twitch_watch(
        guild_id, streamers, announce_channel_id, mention_target, enabled, interval_sec,
        live_template, embed_enabled, streamer_messages, streamer_names
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `, [
      guildId,
      next.streamers.join(','),
      next.announceChannelId,
      next.mentionTargets.join(','),
      next.enabled ? 1 : 0,
      next.intervalSec,
      next.liveTemplate,
      next.embedEnabled ? 1 : 0,
      JSON.stringify(next.streamerMessages),
      JSON.stringify(next.streamerNames)
    ]);
  }
  
  return { ...next };
}

module.exports = {
  getGuildTwitchConfig,
  setGuildTwitchConfig
};
