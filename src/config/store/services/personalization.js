// Personalization service - handles guild bot personalization and welcome messages
const db = require('../database/connection');
const cache = require('../cache/manager');
const { defaultConfigs } = require('../models/defaults');

async function getGuildPersonalization(guildId) {
  if (!guildId) return { ...defaultConfigs.guildPersonalization };
  
  const cacheData = cache.getCache();
  if (cacheData.guildPersonalizationCache.has(guildId)) {
    const cached = cacheData.guildPersonalizationCache.get(guildId);
    // Check if it's an empty result with TTL
    if (cached.__emptyTs && (Date.now() - cached.__emptyTs) < 300000) { // 5 min TTL
      return { ...defaultConfigs.guildPersonalization };
    }
    return { ...cached };
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(
        'SELECT nickname, activity_type, activity_text, avatar_base64, status FROM guild_personalization WHERE guild_id=?',
        [guildId]
      );
      
      if (rows.length > 0) {
        const row = rows[0];
        const personalization = {
          nickname: row.nickname,
          activityType: row.activity_type,
          activityText: row.activity_text,
          avatarBase64: row.avatar_base64,
          status: row.status
        };
        
        if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.log('DB result for guild', guildId, ':', personalization);
        }
        
        cacheData.guildPersonalizationCache.set(guildId, personalization);
        return { ...personalization };
      }
    } catch (e) {
      console.error('Error loading guild personalization:', e.message);
    }
  }
  
  const empty = { ...defaultConfigs.guildPersonalization };
  if (process.env.DEBUG_PERSONALIZATION === '1') {
    console.log('No personalization found for guild', guildId, 'returning empty');
  }
  
  // Mark empty with timestamp so we can re-query after TTL
  cacheData.guildPersonalizationCache.set(guildId, { ...empty, __emptyTs: Date.now() });
  return { ...empty };
}

async function getGuildPersonalizationFresh(guildId) {
  if (!guildId) return null;
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(
        'SELECT nickname, activity_type, activity_text, avatar_base64, status FROM guild_personalization WHERE guild_id=?',
        [guildId]
      );
      
      if (rows.length > 0) {
        const row = rows[0];
        return {
          nickname: row.nickname,
          activityType: row.activity_type,
          activityText: row.activity_text,
          avatarBase64: row.avatar_base64,
          status: row.status
        };
      }
    } catch (e) {
      console.error('Error loading fresh guild personalization:', e.message);
    }
  }
  
  return null;
}

async function getAllGuildPersonalizations() {
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(
        'SELECT guild_id, nickname, activity_type, activity_text, avatar_base64, status FROM guild_personalization'
      );
      
      const result = {};
      for (const row of rows) {
        result[row.guild_id] = {
          nickname: row.nickname,
          activityType: row.activity_type,
          activityText: row.activity_text,
          avatarBase64: row.avatar_base64,
          status: row.status
        };
      }
      return result;
    } catch (e) {
      console.error('Error loading all guild personalizations:', e.message);
    }
  }
  
  return {};
}

async function setGuildPersonalization(guildId, data) {
  if (!guildId) throw new Error('guildId required');
  
  const current = await getGuildPersonalization(guildId);
  const next = { ...current };
  
  if (data.nickname !== undefined) next.nickname = data.nickname;
  if (data.activityType !== undefined) next.activityType = data.activityType;
  if (data.activityText !== undefined) next.activityText = data.activityText;
  if (data.avatarBase64 !== undefined) next.avatarBase64 = data.avatarBase64;
  if (data.status !== undefined) next.status = data.status;
  
  const cacheData = cache.getCache();
  cacheData.guildPersonalizationCache.set(guildId, next);
  
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'REPLACE INTO guild_personalization(guild_id, nickname, activity_type, activity_text, avatar_base64, status) VALUES (?,?,?,?,?,?)',
      [guildId, next.nickname, next.activityType, next.activityText, next.avatarBase64, next.status]
    );
  }
  
  return { ...next };
}

async function getGuildWelcome(guildId) {
  if (!guildId) return { ...defaultConfigs.guildWelcome };
  
  const cacheData = cache.getCache();
  if (cacheData.guildWelcomeCache.has(guildId)) {
    return { ...cacheData.guildWelcomeCache.get(guildId) };
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(
        'SELECT enabled, channel_id, message_type, message_text, card_enabled, role_id, dm_enabled, dm_message FROM guild_welcome_messages WHERE guild_id=?',
        [guildId]
      );
      
      if (rows.length > 0) {
        const row = rows[0];
        const welcome = {
          enabled: !!row.enabled,
          channelId: row.channel_id,
          messageType: row.message_type || 'text',
          messageText: row.message_text || '',
          cardEnabled: !!row.card_enabled,
          roleId: row.role_id,
          dmEnabled: !!row.dm_enabled,
          dmMessage: row.dm_message || ''
        };
        cacheData.guildWelcomeCache.set(guildId, welcome);
        return { ...welcome };
      }
    } catch (e) {
      console.error('Error loading guild welcome config:', e.message);
    }
  }
  
  const empty = { ...defaultConfigs.guildWelcome };
  cacheData.guildWelcomeCache.set(guildId, empty);
  return { ...empty };
}

async function setGuildWelcome(guildId, data) {
  if (!guildId) throw new Error('guildId required');
  
  const current = await getGuildWelcome(guildId);
  const next = { ...current };
  
  if (data.channelId !== undefined) next.channelId = data.channelId;
  if (data.messageType !== undefined) next.messageType = data.messageType;
  if (data.messageText !== undefined) next.messageText = data.messageText;
  if (data.cardEnabled !== undefined) next.cardEnabled = data.cardEnabled;
  if (data.enabled !== undefined) next.enabled = data.enabled;
  if (data.roleId !== undefined) next.roleId = data.roleId;
  if (data.dmEnabled !== undefined) next.dmEnabled = data.dmEnabled;
  if (data.dmMessage !== undefined) next.dmMessage = data.dmMessage;
  
  const cacheData = cache.getCache();
  cacheData.guildWelcomeCache.set(guildId, next);
  
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'REPLACE INTO guild_welcome_messages(guild_id, enabled, channel_id, message_type, message_text, card_enabled, role_id, dm_enabled, dm_message) VALUES (?,?,?,?,?,?,?,?,?)',
      [guildId, next.enabled ? 1 : 0, next.channelId, next.messageType, next.messageText, next.cardEnabled ? 1 : 0, next.roleId, next.dmEnabled ? 1 : 0, next.dmMessage]
    );
  }
  
  return { ...next };
}

module.exports = {
  getGuildPersonalization,
  getGuildPersonalizationFresh,
  getAllGuildPersonalizations,
  setGuildPersonalization,
  getGuildWelcome,
  setGuildWelcome
};
