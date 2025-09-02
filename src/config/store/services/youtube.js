// YouTube service - handles guild YouTube watcher configuration
const db = require('../database/connection');
const cache = require('../cache/manager');
const { defaultConfigs } = require('../models/defaults');

async function ensureYouTubeColumns() {
  if (db.mariaAvailable && db.sqlPool) {
    try {
      // Add member-only template columns if they don't exist
      await db.sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN member_only_upload_template TEXT NULL');
      await db.sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN member_only_live_template TEXT NULL');
      await db.sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN upload_announce_channel_id VARCHAR(32) NULL');
      await db.sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN live_announce_channel_id VARCHAR(32) NULL');
    } catch (e) {
      // Columns likely already exist
    }
  }
}

async function getGuildYouTubeConfig(guildId) {
  if (!guildId) return { ...defaultConfigs.guildYouTubeConfig };
  
  const cacheData = cache.getCache();
  if (cacheData.guildYouTubeConfigCache.has(guildId)) {
    return { ...cacheData.guildYouTubeConfigCache.get(guildId) };
  }
  
  // Ensure member-only template columns and separate announce channels exist
  await ensureYouTubeColumns();
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(`
        SELECT channels, announce_channel_id, upload_announce_channel_id, live_announce_channel_id,
               mention_target, enabled, interval_sec, upload_template, live_template,
               member_only_upload_template, member_only_live_template, embed_enabled,
               channel_messages, channel_names
        FROM guild_youtube_watch WHERE guild_id=?
      `, [guildId]);
      
      if (rows.length > 0) {
        const row = rows[0];
        const config = {
          channels: row.channels ? row.channels.split(',').filter(Boolean) : [],
          announceChannelId: row.announce_channel_id,
          uploadAnnounceChannelId: row.upload_announce_channel_id,
          liveAnnounceChannelId: row.live_announce_channel_id,
          mentionRoleId: null, // legacy field
          mentionTargets: row.mention_target ? row.mention_target.split(',').filter(Boolean) : [],
          enabled: !!row.enabled,
          intervalSec: row.interval_sec || 300,
          uploadTemplate: row.upload_template || defaultConfigs.guildYouTubeConfig.uploadTemplate,
          liveTemplate: row.live_template || defaultConfigs.guildYouTubeConfig.liveTemplate,
          memberOnlyUploadTemplate: row.member_only_upload_template || defaultConfigs.guildYouTubeConfig.memberOnlyUploadTemplate,
          memberOnlyLiveTemplate: row.member_only_live_template || defaultConfigs.guildYouTubeConfig.memberOnlyLiveTemplate,
          embedEnabled: row.embed_enabled !== 0,
          channelMessages: row.channel_messages ? JSON.parse(row.channel_messages) : {},
          channelNames: row.channel_names ? JSON.parse(row.channel_names) : {}
        };
        
        cacheData.guildYouTubeConfigCache.set(guildId, config);
        return { ...config };
      }
    } catch (e) {
      console.error('Error loading guild YouTube config:', e.message);
    }
  }
  
  return { ...defaultConfigs.guildYouTubeConfig }; // memory fallback (not persisted)
}

async function setGuildYouTubeConfig(guildId, partial) {
  if (!guildId) throw new Error('guildId required');
  
  const current = await getGuildYouTubeConfig(guildId);
  const next = { ...current };
  
  if (Array.isArray(partial.channels)) {
    next.channels = partial.channels.slice(0, 50); // reasonable cap
  }
  if (partial.announceChannelId !== undefined) next.announceChannelId = partial.announceChannelId;
  if (partial.uploadAnnounceChannelId !== undefined) next.uploadAnnounceChannelId = partial.uploadAnnounceChannelId;
  if (partial.liveAnnounceChannelId !== undefined) next.liveAnnounceChannelId = partial.liveAnnounceChannelId;
  
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
  if (partial.uploadTemplate !== undefined) next.uploadTemplate = partial.uploadTemplate;
  if (partial.liveTemplate !== undefined) next.liveTemplate = partial.liveTemplate;
  if (partial.memberOnlyUploadTemplate !== undefined) next.memberOnlyUploadTemplate = partial.memberOnlyUploadTemplate;
  if (partial.memberOnlyLiveTemplate !== undefined) next.memberOnlyLiveTemplate = partial.memberOnlyLiveTemplate;
  if (partial.embedEnabled !== undefined) next.embedEnabled = partial.embedEnabled;
  if (partial.channelMessages && typeof partial.channelMessages === 'object') {
    next.channelMessages = partial.channelMessages;
  }
  if (partial.channelNames && typeof partial.channelNames === 'object') {
    next.channelNames = partial.channelNames;
  }
  
  const cacheData = cache.getCache();
  cacheData.guildYouTubeConfigCache.set(guildId, next);
  
  if (db.mariaAvailable && db.sqlPool) {
    await ensureYouTubeColumns();
    await db.sqlPool.query(`
      REPLACE INTO guild_youtube_watch(
        guild_id, channels, announce_channel_id, upload_announce_channel_id, live_announce_channel_id,
        mention_target, enabled, interval_sec, upload_template, live_template,
        member_only_upload_template, member_only_live_template, embed_enabled,
        channel_messages, channel_names
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      guildId,
      next.channels.join(','),
      next.announceChannelId,
      next.uploadAnnounceChannelId,
      next.liveAnnounceChannelId,
      next.mentionTargets.join(','),
      next.enabled ? 1 : 0,
      next.intervalSec,
      next.uploadTemplate,
      next.liveTemplate,
      next.memberOnlyUploadTemplate,
      next.memberOnlyLiveTemplate,
      next.embedEnabled ? 1 : 0,
      JSON.stringify(next.channelMessages),
      JSON.stringify(next.channelNames)
    ]);
  }
  
  return { ...next };
}

module.exports = {
  getGuildYouTubeConfig,
  setGuildYouTubeConfig
};
