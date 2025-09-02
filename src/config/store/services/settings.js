// Settings service - handles global and guild-specific settings
const db = require('../database/connection');
const cache = require('../cache/manager');
const { defaultConfigs } = require('../models/defaults');

async function saveSettings(settings) {
  if (db.mongooseAvailable && db.SettingModel) {
    await db.SettingModel.findByIdAndUpdate('singleton', settings, { upsert: true });
  } else if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'REPLACE INTO settings(id, auto_reply_enabled, auto_reply_cooldown_ms) VALUES (1,?,?)',
      [settings.autoReplyEnabled ? 1 : 0, settings.autoReplyCooldownMs]
    );
  }
}

async function saveGuildSettings(guildId, data) {
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'REPLACE INTO guild_settings(guild_id, auto_reply_enabled, auto_reply_cooldown_ms, language, timezone, hour_format, embed_color, prefix, slash_enabled) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        guildId,
        data.autoReplyEnabled ? 1 : 0,
        data.autoReplyCooldownMs,
        data.language || 'en',
        data.timezone || 'UTC',
        data.hourFormat === 12 ? 12 : 24,
        data.embedColor || '#5865F2',
        data.prefix || '!',
        data.slashCommandsEnabled === false ? 0 : 1
      ]
    );
  }
}

async function getSettings() {
  const cacheData = cache.getCache();
  return { ...cacheData.settings };
}

async function setSettings(partial) {
  const cacheData = cache.getCache();
  
  if (partial.autoReplyEnabled !== undefined) {
    cacheData.settings.autoReplyEnabled = !!partial.autoReplyEnabled;
  }
  if (partial.autoReplyCooldownMs !== undefined) {
    cacheData.settings.autoReplyCooldownMs = parseInt(partial.autoReplyCooldownMs, 10) || cacheData.settings.autoReplyCooldownMs;
  }
  
  await saveSettings(cacheData.settings);
  return { ...cacheData.settings };
}

async function getGuildSettings(guildId) {
  const defaults = { ...defaultConfigs.guildSettings };
  if (!guildId) return { ...defaults };
  
  const cacheData = cache.getCache();
  if (cacheData.guildSettingsCache.has(guildId)) {
    return { ...cacheData.guildSettingsCache.get(guildId) };
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(
        'SELECT auto_reply_enabled, auto_reply_cooldown_ms, language, timezone, hour_format, embed_color, prefix, slash_enabled FROM guild_settings WHERE guild_id=?',
        [guildId]
      );
      
      if (rows.length > 0) {
        const row = rows[0];
        const settings = {
          autoReplyEnabled: !!row.auto_reply_enabled,
          autoReplyCooldownMs: row.auto_reply_cooldown_ms,
          language: row.language || 'en',
          timezone: row.timezone || 'UTC',
          hourFormat: row.hour_format || 24,
          embedColor: row.embed_color || '#5865F2',
          prefix: row.prefix || '!',
          slashCommandsEnabled: row.slash_enabled !== 0
        };
        cacheData.guildSettingsCache.set(guildId, settings);
        return { ...settings };
      }
    } catch (e) {
      console.error('Error loading guild settings:', e.message);
    }
  }
  
  return { ...defaults };
}

async function setGuildSettings(guildId, partial) {
  if (!guildId) throw new Error('guildId required');
  
  const current = await getGuildSettings(guildId);
  
  if (partial.autoReplyEnabled !== undefined) current.autoReplyEnabled = !!partial.autoReplyEnabled;
  if (partial.autoReplyCooldownMs !== undefined) current.autoReplyCooldownMs = parseInt(partial.autoReplyCooldownMs, 10) || current.autoReplyCooldownMs;
  if (partial.language !== undefined) current.language = partial.language;
  if (partial.timezone !== undefined) current.timezone = partial.timezone;
  if (partial.hourFormat !== undefined) current.hourFormat = partial.hourFormat;
  if (partial.embedColor !== undefined) current.embedColor = partial.embedColor;
  if (partial.prefix !== undefined) current.prefix = partial.prefix;
  if (partial.slashCommandsEnabled !== undefined) current.slashCommandsEnabled = partial.slashCommandsEnabled;
  
  const cacheData = cache.getCache();
  cacheData.guildSettingsCache.set(guildId, current);
  await saveGuildSettings(guildId, current);
  return { ...current };
}

module.exports = {
  getSettings,
  setSettings,
  getGuildSettings,
  setGuildSettings
};
