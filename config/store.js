// Central in-memory config & auto-response store with optional Mongo persistence.
// Falls back to JSON seed if Mongo unavailable.
const fs = require('fs');
const path = require('path');
let mongooseAvailable = false;
let SettingModel = null;
let AutoResponseModel = null;

// MariaDB / MySQL support
let mariaAvailable = false;
let sqlPool = null; // mysql2/promise pool

// Default / seed values
const seedSettings = { autoReplyEnabled: process.env.AUTOREPLY_ENABLED === '1', autoReplyCooldownMs: parseInt(process.env.AUTOREPLY_COOLDOWN_MS || '30000', 10) };
let settings = { ...seedSettings };
let autoResponses = [];
// Command enable/disable (global + per guild)
// Command toggles now store metadata: { enabled, created_at, created_by, updated_at, updated_by }
let commandToggles = {}; // name -> meta
const guildCommandToggles = new Map(); // guildId -> { name -> meta }
// Guild scoped caches
const guildSettingsCache = new Map(); // guildId -> settings
const guildAutoResponsesCache = new Map(); // guildId -> auto responses
// Guild personalization cache { nickname, activity_type, activity_text, avatar_base64 }
const guildPersonalizationCache = new Map();
// Guild welcome config cache { channelId, messageType, messageText, cardEnabled }
const guildWelcomeCache = new Map();
// Guild YouTube watcher configuration cache
// Shape: { channels:[], announceChannelId:null, mentionTargets:[], enabled:false, intervalSec:300, uploadTemplate:string, liveTemplate:string, embedEnabled:true, channelMessages:{}, channelNames:{} }
const guildYouTubeConfigCache = new Map();
let youtubeHasConfigJsonColumn = null; // lazy detection

// Guild Twitch watcher configuration cache
// Shape: { streamers:[], announceChannelId:null, mentionTargets:[], enabled:false, intervalSec:300, liveTemplate:string, embedEnabled:true, streamerMessages:{}, streamerNames:{} }
const guildTwitchConfigCache = new Map();
let twitchHasConfigJsonColumn = null; // lazy detection

// Analytics tracking
const commandUsageStats = new Map(); // command -> { daily: count, hourly: count, lastHour: timestamp }
const activityLog = []; // { type, action, guild, timestamp, userId }
const errorLog = []; // { timestamp, error, context }
const systemStats = {
  startTime: Date.now(),
  commandsToday: 0,
  errorsThisHour: 0,
  lastHourReset: Date.now(),
  responseTimeSum: 0,
  responseTimeCount: 0,
  successCount: 0,
  totalRequests: 0
};

// Cache for system metrics
let cachedSystemMetrics = null;
let lastMetricsUpdate = 0;

// Load seed auto responses from existing JS file and convert regex -> {pattern, flags}
function loadSeedAutoResponses() {
  try {
    const list = require('../auto-responses');
    autoResponses = list.map(r => ({
      key: r.key,
      pattern: r.pattern.source,
      flags: r.pattern.flags || 'i',
      replies: r.replies
    }));
  } catch (e) {
    console.error('Failed loading seed auto responses', e.message);
    autoResponses = [];
  }
}
loadSeedAutoResponses();

function compileAutoResponses() {
  return autoResponses.filter(r => r.enabled !== false).map(r => ({ ...r, pattern: new RegExp(r.pattern, r.flags) }));
}

function compileGuildAutoResponses(list){
  return list.filter(r => r.enabled !== false).map(r => ({ ...r, pattern: new RegExp(r.pattern, r.flags) }));
}

async function initMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  try {
    const mongoose = require('mongoose');
    await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
    mongooseAvailable = true;
    const settingSchema = new mongoose.Schema({ _id: { type: String, default: 'singleton' }, autoReplyEnabled: Boolean, autoReplyCooldownMs: Number });
    SettingModel = mongoose.model('Setting', settingSchema);
    const autoResponseSchema = new mongoose.Schema({ key: { type: String, unique: true }, pattern: String, flags: String, replies: [mongoose.Schema.Types.Mixed] });
    AutoResponseModel = mongoose.model('AutoResponse', autoResponseSchema);
    // Load or seed settings
    let doc = await SettingModel.findById('singleton');
    if (!doc) {
      doc = await SettingModel.create({ _id: 'singleton', ...settings });
    }
    settings = { autoReplyEnabled: !!doc.autoReplyEnabled, autoReplyCooldownMs: doc.autoReplyCooldownMs };
    // Load or seed autoresponses
    const count = await AutoResponseModel.countDocuments();
    if (count === 0 && autoResponses.length) {
      await AutoResponseModel.insertMany(autoResponses);
    }
    autoResponses = (await AutoResponseModel.find()).map(d => ({ key: d.key, pattern: d.pattern, flags: d.flags, replies: d.replies }));
    console.log('Config store: Mongo initialized');
    return true;
  } catch (e) {
    console.error('Mongo init failed, falling back to in-memory/seed:', e.message);
    mongooseAvailable = false;
    return false;
  }
}

async function initMaria() {
  const host = process.env.MARIADB_HOST;
  const user = process.env.MARIADB_USER;
  const password = process.env.MARIADB_PASS;
  const database = process.env.MARIADB_DB;
  if (!host || !user || !database) return false;
  try {
    const mysql = require('mysql2/promise');
    sqlPool = await mysql.createPool({
      host,
      user,
      password,
      database,
      port: process.env.MARIADB_PORT ? parseInt(process.env.MARIADB_PORT,10) : 3306,
      waitForConnections: true,
      connectionLimit: 5,
      namedPlaceholders: true
    });
    // Create tables if not exist
    await sqlPool.query(`CREATE TABLE IF NOT EXISTS settings (
      id TINYINT PRIMARY KEY DEFAULT 1,
      auto_reply_enabled BOOLEAN NOT NULL DEFAULT 0,
      auto_reply_cooldown_ms INT NOT NULL DEFAULT 30000
    ) ENGINE=InnoDB`);
    await sqlPool.query(`CREATE TABLE IF NOT EXISTS auto_responses (
      ` +
      `\`key\` VARCHAR(100) PRIMARY KEY,
      pattern TEXT NOT NULL,
      flags VARCHAR(8) NOT NULL DEFAULT 'i',
  replies TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT 1
    ) ENGINE=InnoDB`);
    // Guild scoped tables
    await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id VARCHAR(32) PRIMARY KEY,
      auto_reply_enabled BOOLEAN NOT NULL DEFAULT 0,
      auto_reply_cooldown_ms INT NOT NULL DEFAULT 30000,
      language VARCHAR(8) NULL,
      timezone VARCHAR(64) NULL,
      hour_format TINYINT NULL,
      embed_color VARCHAR(9) NULL,
      prefix VARCHAR(16) NULL,
      slash_enabled BOOLEAN NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    // Attempt migrations for new settings columns if upgrading from older schema
    const guildSettingMigs = [
      'ALTER TABLE guild_settings ADD COLUMN language VARCHAR(8) NULL',
      'ALTER TABLE guild_settings ADD COLUMN timezone VARCHAR(64) NULL',
      'ALTER TABLE guild_settings ADD COLUMN hour_format TINYINT NULL',
      'ALTER TABLE guild_settings ADD COLUMN embed_color VARCHAR(9) NULL',
      'ALTER TABLE guild_settings ADD COLUMN prefix VARCHAR(16) NULL',
      'ALTER TABLE guild_settings ADD COLUMN slash_enabled BOOLEAN NULL'
    ];
    for (const sql of guildSettingMigs){ try { await sqlPool.query(sql); } catch(e){ /* ignore */ } }
    await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_auto_responses (
      guild_id VARCHAR(32) NOT NULL,
      \`key\` VARCHAR(100) NOT NULL,
      pattern TEXT NOT NULL,
      flags VARCHAR(8) NOT NULL DEFAULT 'i',
      replies TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT 1,
      PRIMARY KEY (guild_id, \`key\`)
    ) ENGINE=InnoDB`);
    await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_command_toggles (
      guild_id VARCHAR(32) NOT NULL,
      command_name VARCHAR(64) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(64) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by VARCHAR(64) NULL,
      PRIMARY KEY (guild_id, command_name)
    ) ENGINE=InnoDB`);
    await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_personalization (
      guild_id VARCHAR(32) PRIMARY KEY,
      nickname VARCHAR(100) NULL,
      activity_type VARCHAR(24) NULL,
      activity_text VARCHAR(128) NULL,
      avatar_base64 MEDIUMTEXT NULL,
      status VARCHAR(16) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    // Migration: add status column if upgrading
    try { await sqlPool.query('ALTER TABLE guild_personalization ADD COLUMN status VARCHAR(16) NULL'); } catch(e){ /* ignore if exists */ }
    // Welcome configuration table (with enabled flag)
    await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_welcome (
      guild_id VARCHAR(32) PRIMARY KEY,
      channel_id VARCHAR(32) NULL,
      message_type VARCHAR(10) NOT NULL DEFAULT 'text',
      message_text TEXT NULL,
      card_enabled BOOLEAN NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    // Migration: add enabled column if upgrading from older version
    try { await sqlPool.query('ALTER TABLE guild_welcome ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT 1'); } catch(e){ /* ignore if exists */ }
    // YouTube watcher per-guild configuration
    await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_youtube_watch (
      guild_id VARCHAR(32) PRIMARY KEY,
      channels TEXT NULL,
      announce_channel_id VARCHAR(32) NULL,
      mention_target VARCHAR(512) NULL,
      enabled BOOLEAN NOT NULL DEFAULT 0,
      interval_sec INT NOT NULL DEFAULT 300,
      upload_template TEXT NULL,
      live_template TEXT NULL,
      embed_enabled BOOLEAN NOT NULL DEFAULT 1,
      channel_messages MEDIUMTEXT NULL,
      channel_names MEDIUMTEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    
    // Twitch watcher per-guild configuration
    await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_twitch_watch (
      guild_id VARCHAR(32) PRIMARY KEY,
      streamers TEXT NULL,
      announce_channel_id VARCHAR(32) NULL,
      mention_target VARCHAR(512) NULL,
      enabled BOOLEAN NOT NULL DEFAULT 0,
      interval_sec INT NOT NULL DEFAULT 300,
      live_template TEXT NULL,
      embed_enabled BOOLEAN NOT NULL DEFAULT 1,
      streamer_messages MEDIUMTEXT NULL,
      streamer_names MEDIUMTEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    // Silent migrations expanding mention_target length / adding columns if older version
    try { await sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN mention_target VARCHAR(512) NULL'); } catch(e){ /* ignore */ }
    try { await sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN channel_messages MEDIUMTEXT NULL'); } catch(e){ /* ignore */ }
    try { await sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN channel_names MEDIUMTEXT NULL'); } catch(e){ /* ignore */ }
    try { await sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN embed_enabled BOOLEAN NOT NULL DEFAULT 1'); } catch(e){ /* ignore */ }
    try { await sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN upload_template TEXT NULL'); } catch(e){ /* ignore */ }
    try { await sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN live_template TEXT NULL'); } catch(e){ /* ignore */ }
    try { await sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN interval_sec INT NOT NULL DEFAULT 300'); } catch(e){ /* ignore */ }
    try { await sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT 0'); } catch(e){ /* ignore */ }
  // Ensure legacy tables missing channels / announce_channel_id get them
  try { await sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN channels TEXT NULL'); } catch(e){ /* ignore */ }
  try { await sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN announce_channel_id VARCHAR(32) NULL'); } catch(e){ /* ignore */ }
  try { await sqlPool.query('ALTER TABLE guild_youtube_watch ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'); } catch(e){ /* ignore */ }
    // Migrations (silent) to add metadata columns if upgrading
    const migCols = [
      ['command_toggles','created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['command_toggles','created_by VARCHAR(64) NULL'],
      ['command_toggles','updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
      ['command_toggles','updated_by VARCHAR(64) NULL'],
      ['guild_command_toggles','created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
      ['guild_command_toggles','created_by VARCHAR(64) NULL'],
      ['guild_command_toggles','updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
      ['guild_command_toggles','updated_by VARCHAR(64) NULL']
    ];
    for (const [tbl,col] of migCols){
      try { await sqlPool.query(`ALTER TABLE ${tbl} ADD COLUMN ${col}`); } catch(e){ /* ignore duplicate */ }
    }
  // Attempt migration (ignore errors if column exists) with logging
  try { await sqlPool.query('ALTER TABLE auto_responses ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT 1'); console.log('Migration: added enabled column to auto_responses'); } catch (e){ if(!/Duplicate column/i.test(e.message)) console.warn('Migration auto_responses.enabled skipped:', e.message); }
  try { await sqlPool.query('ALTER TABLE guild_auto_responses ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT 1'); console.log('Migration: added enabled column to guild_auto_responses'); } catch (e){ if(!/Duplicate column/i.test(e.message)) console.warn('Migration guild_auto_responses.enabled skipped:', e.message); }
    // Users table (Discord OAuth users)
    await sqlPool.query(`CREATE TABLE IF NOT EXISTS m_user (
      user_id VARCHAR(32) PRIMARY KEY,
      username VARCHAR(100),
      global_name VARCHAR(100),
      avatar VARCHAR(100),
      selected_guild_id VARCHAR(32) NULL,
      last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    // Seed settings
    const [rows] = await sqlPool.query('SELECT auto_reply_enabled, auto_reply_cooldown_ms FROM settings WHERE id=1');
    if (rows.length === 0) {
      await sqlPool.query('INSERT INTO settings(id, auto_reply_enabled, auto_reply_cooldown_ms) VALUES (1, ?, ?)', [
        seedSettings.autoReplyEnabled ? 1 : 0, seedSettings.autoReplyCooldownMs
      ]);
      settings = { ...seedSettings };
    } else {
      settings = { autoReplyEnabled: !!rows[0].auto_reply_enabled, autoReplyCooldownMs: rows[0].auto_reply_cooldown_ms };
    }
    // Seed auto responses if table empty
    const [arCountRows] = await sqlPool.query('SELECT COUNT(*) as c FROM auto_responses');
    if (arCountRows[0].c === 0 && autoResponses.length) {
      for (const ar of autoResponses) {
        await sqlPool.query('INSERT INTO auto_responses(`key`, pattern, flags, replies) VALUES (?, ?, ?, ?)', [ar.key, ar.pattern, ar.flags, JSON.stringify(ar.replies||[])]);
      }
    }
    // Load all
  const [arRows] = await sqlPool.query('SELECT `key`, pattern, flags, replies, enabled FROM auto_responses');
  autoResponses = arRows.map(r => ({ key: r.key, pattern: r.pattern, flags: r.flags, replies: JSON.parse(r.replies || '[]'), enabled: r.enabled !== 0 }));
    // Load command toggles
    try {
      const [ctRows] = await sqlPool.query('SELECT command_name, enabled, created_at, created_by, updated_at, updated_by FROM command_toggles');
      commandToggles = {};
      for (const r of ctRows) commandToggles[r.command_name] = {
        enabled: r.enabled !== 0,
        created_at: r.created_at,
        created_by: r.created_by,
        updated_at: r.updated_at,
        updated_by: r.updated_by
      };
      const [gctRows] = await sqlPool.query('SELECT guild_id, command_name, enabled, created_at, created_by, updated_at, updated_by FROM guild_command_toggles');
      for (const r of gctRows){
        if(!guildCommandToggles.has(r.guild_id)) guildCommandToggles.set(r.guild_id, {});
        guildCommandToggles.get(r.guild_id)[r.command_name] = {
          enabled: r.enabled !== 0,
          created_at: r.created_at,
          created_by: r.created_by,
          updated_at: r.updated_at,
          updated_by: r.updated_by
        };
      }
    } catch(e){ console.warn('Load command toggles failed', e.message); }
    mariaAvailable = true;
    console.log('Config store: MariaDB initialized');
    return true;
  } catch (e) {
    console.error('MariaDB init failed, falling back to in-memory/seed:', e.message);
    mariaAvailable = false;
    return false;
  }
}

async function saveSettings() {
  if (mongooseAvailable && SettingModel) {
    await SettingModel.findByIdAndUpdate('singleton', settings, { upsert: true });
  } else if (mariaAvailable && sqlPool) {
    await sqlPool.query('UPDATE settings SET auto_reply_enabled=?, auto_reply_cooldown_ms=? WHERE id=1', [
      settings.autoReplyEnabled ? 1 : 0,
      settings.autoReplyCooldownMs
    ]);
  }
}

async function saveAutoResponse(ar) {
  if (mongooseAvailable && AutoResponseModel) {
    await AutoResponseModel.findOneAndUpdate({ key: ar.key }, ar, { upsert: true });
  } else if (mariaAvailable && sqlPool) {
    await sqlPool.query('REPLACE INTO auto_responses(`key`, pattern, flags, replies, enabled) VALUES (?, ?, ?, ?, ?)', [
      ar.key, ar.pattern, ar.flags, JSON.stringify(ar.replies||[]), ar.enabled !== false ? 1 : 0
    ]);
  }
}

async function saveGuildSettings(guildId, data){
  if (mariaAvailable && sqlPool){
    await sqlPool.query('REPLACE INTO guild_settings(guild_id, auto_reply_enabled, auto_reply_cooldown_ms, language, timezone, hour_format, embed_color, prefix, slash_enabled) VALUES (?,?,?,?,?,?,?,?,?)', [
      guildId,
      data.autoReplyEnabled ? 1 : 0,
      data.autoReplyCooldownMs,
      data.language || 'en',
      data.timezone || 'UTC',
      data.hourFormat === 12 ? 12 : 24,
      data.embedColor || '#5865F2',
      data.prefix || '!',
      data.slashCommandsEnabled === false ? 0 : 1
    ]);
  }
}

async function saveGuildAutoResponse(guildId, ar){
  if (mariaAvailable && sqlPool){
    await sqlPool.query('REPLACE INTO guild_auto_responses(guild_id, `key`, pattern, flags, replies, enabled) VALUES (?,?,?,?,?,?)', [
      guildId, ar.key, ar.pattern, ar.flags, JSON.stringify(ar.replies||[]), ar.enabled !== false ? 1 : 0
    ]);
  }
}

async function deleteAutoResponse(key) {
  if (mongooseAvailable && AutoResponseModel) {
    await AutoResponseModel.deleteOne({ key });
  } else if (mariaAvailable && sqlPool) {
    await sqlPool.query('DELETE FROM auto_responses WHERE `key`=?', [key]);
  }
}

async function deleteGuildAutoResponse(guildId, key){
  if (mariaAvailable && sqlPool){
    await sqlPool.query('DELETE FROM guild_auto_responses WHERE guild_id=? AND `key`=?', [guildId, key]);
  }
}

module.exports = {
  initMongo, // kept for backward compatibility
  initMaria,
  initPersistence: async () => {
    // Prefer MariaDB if configured, else Mongo, else in-memory
    if (process.env.MARIADB_HOST) {
      const ok = await initMaria();
      if (ok) return 'maria';
    }
    if (process.env.MONGODB_URI) {
      const ok = await initMongo();
      if (ok) return 'mongo';
    }
    return 'memory';
  },
  getSettings: () => ({ ...settings }),
  setSettings: async (partial) => {
    if (partial.autoReplyEnabled !== undefined) settings.autoReplyEnabled = !!partial.autoReplyEnabled;
    if (partial.autoReplyCooldownMs !== undefined) settings.autoReplyCooldownMs = parseInt(partial.autoReplyCooldownMs, 10) || settings.autoReplyCooldownMs;
    await saveSettings();
    return { ...settings };
  },
  getAutoResponses: () => autoResponses.map(r => ({ ...r })),
  getCompiledAutoResponses: compileAutoResponses,
  // Guild-scoped API
  getGuildSettings: async (guildId) => {
    const defaults = { ...seedSettings, language:'en', timezone:'UTC', hourFormat:24, embedColor:'#5865F2', prefix:'!', slashCommandsEnabled:true };
    if (!guildId) return { ...defaults };
    if (guildSettingsCache.has(guildId)) return { ...guildSettingsCache.get(guildId) };
    if (mariaAvailable && sqlPool){
      const [rows] = await sqlPool.query('SELECT auto_reply_enabled, auto_reply_cooldown_ms, language, timezone, hour_format, embed_color, prefix, slash_enabled FROM guild_settings WHERE guild_id=?', [guildId]);
      let gs;
      if (rows.length === 0){
        gs = { ...defaults };
        await saveGuildSettings(guildId, gs);
      } else {
        const r = rows[0];
        gs = {
          autoReplyEnabled: !!r.auto_reply_enabled,
            autoReplyCooldownMs: r.auto_reply_cooldown_ms,
            language: r.language || 'en',
            timezone: r.timezone || 'UTC',
            hourFormat: r.hour_format === 12 ? 12 : 24,
            embedColor: r.embed_color || '#5865F2',
            prefix: r.prefix || '!',
            slashCommandsEnabled: r.slash_enabled === 0 ? false : true
        };
      }
      guildSettingsCache.set(guildId, gs);
      return { ...gs };
    }
    return { ...defaults };
  },
  setGuildSettings: async (guildId, partial) => {
    if (!guildId) throw new Error('guildId required');
    const current = await module.exports.getGuildSettings(guildId);
    if (partial.autoReplyEnabled !== undefined) current.autoReplyEnabled = !!partial.autoReplyEnabled;
    if (partial.autoReplyCooldownMs !== undefined) current.autoReplyCooldownMs = parseInt(partial.autoReplyCooldownMs,10) || current.autoReplyCooldownMs;
    if (partial.language !== undefined) current.language = (partial.language || 'en').slice(0,8);
    if (partial.timezone !== undefined) current.timezone = (partial.timezone || 'UTC').slice(0,64);
    if (partial.hourFormat !== undefined) current.hourFormat = (parseInt(partial.hourFormat,10) === 12) ? 12 : 24;
    if (partial.embedColor !== undefined) current.embedColor = (partial.embedColor || '#5865F2').slice(0,9);
    if (partial.prefix !== undefined) current.prefix = (partial.prefix || '!').slice(0,16);
    if (partial.slashCommandsEnabled !== undefined) current.slashCommandsEnabled = !!partial.slashCommandsEnabled;
    guildSettingsCache.set(guildId, current);
    await saveGuildSettings(guildId, current);
    return { ...current };
  },
  getGuildAutoResponses: async (guildId) => {
    if (!guildId) return autoResponses.map(r=>({...r}));
    if (guildAutoResponsesCache.has(guildId)) return guildAutoResponsesCache.get(guildId).map(r=>({...r}));
    if (mariaAvailable && sqlPool){
  const [rows] = await sqlPool.query('SELECT `key`, pattern, flags, replies, enabled FROM guild_auto_responses WHERE guild_id=?', [guildId]);
  let list = rows.map(r => ({ key:r.key, pattern:r.pattern, flags:r.flags, replies: JSON.parse(r.replies||'[]'), enabled: r.enabled !== 0 }));
      if (list.length === 0 && autoResponses.length){
        // seed from global defaults
        for (const ar of autoResponses){
          await sqlPool.query('INSERT INTO guild_auto_responses(guild_id, `key`, pattern, flags, replies) VALUES (?,?,?,?,?)', [guildId, ar.key, ar.pattern, ar.flags, JSON.stringify(ar.replies||[])]);
        }
        list = autoResponses.map(r=>({...r}));
      }
      guildAutoResponsesCache.set(guildId, list);
      return list.map(r=>({...r}));
    }
    return autoResponses.map(r=>({...r}));
  },
  getCompiledGuildAutoResponses: async (guildId) => {
    const list = await module.exports.getGuildAutoResponses(guildId);
    return compileGuildAutoResponses(list);
  },
  upsertGuildAutoResponse: async (guildId, entry) => {
    if (!guildId) throw new Error('guildId required');
    const cleaned = { key: entry.key, pattern: entry.pattern, flags: entry.flags || 'i', replies: entry.replies || [], enabled: entry.enabled !== false };
    const cacheList = guildAutoResponsesCache.get(guildId) || await module.exports.getGuildAutoResponses(guildId);
    const idx = cacheList.findIndex(r => r.key === cleaned.key);
    if (idx>=0) cacheList[idx] = cleaned; else cacheList.push(cleaned);
    guildAutoResponsesCache.set(guildId, cacheList);
    await saveGuildAutoResponse(guildId, cleaned);
    return cleaned;
  },
  removeGuildAutoResponse: async (guildId, key) => {
    const list = guildAutoResponsesCache.get(guildId) || [];
    const idx = list.findIndex(r=>r.key===key);
    if (idx>=0) list.splice(idx,1);
    guildAutoResponsesCache.set(guildId, list);
    await deleteGuildAutoResponse(guildId, key);
  },
  // User persistence helpers (MariaDB only; memory fallback minimal)
  upsertUser: async (user) => {
    if (mariaAvailable && sqlPool) {
      // Need two-step to avoid MySQL limitation of selecting from target table in REPLACE
      let existingSelected = null;
      try {
        const [rows] = await sqlPool.query('SELECT selected_guild_id FROM m_user WHERE user_id=?', [user.id]);
        if (rows.length) existingSelected = rows[0].selected_guild_id || null;
      } catch {}
      await sqlPool.query('REPLACE INTO m_user(user_id, username, global_name, avatar, selected_guild_id) VALUES (?, ?, ?, ?, ?)', [
        user.id, user.username, user.global_name || null, user.avatar || null, existingSelected
      ]);
    }
  },
  setUserSelectedGuild: async (userId, guildId) => {
    if (mariaAvailable && sqlPool) {
      await sqlPool.query('UPDATE m_user SET selected_guild_id=? WHERE user_id=?', [guildId, userId]);
    }
  },
  getUser: async (userId) => {
    if (mariaAvailable && sqlPool) {
      const [rows] = await sqlPool.query('SELECT user_id, username, global_name, avatar, selected_guild_id FROM m_user WHERE user_id=?', [userId]);
      return rows[0] || null;
    }
    return null;
  },
  upsertAutoResponse: async (entry) => {
    const idx = autoResponses.findIndex(r => r.key === entry.key);
    const cleaned = { key: entry.key, pattern: entry.pattern, flags: entry.flags || 'i', replies: entry.replies || [], enabled: entry.enabled !== false };
    if (idx >= 0) autoResponses[idx] = cleaned; else autoResponses.push(cleaned);
    await saveAutoResponse(cleaned);
    return cleaned;
  },
  // Guild personalization
  getGuildPersonalization: async (guildId) => {
    if(!guildId) return null;
    if (guildPersonalizationCache.has(guildId)) {
      if (process.env.DEBUG_PERSONALIZATION==='1') console.log('[PERSONALIZATION] cache hit', guildId);
      const cached = guildPersonalizationCache.get(guildId);
      // If this is an empty placeholder with TTL expired, force DB re-query
      if (cached && cached.__emptyTs) {
        const ttlMs = parseInt(process.env.PERSONALIZATION_EMPTY_TTL_MS || '30000',10); // 30s default
        if (Date.now() - cached.__emptyTs > ttlMs) {
          guildPersonalizationCache.delete(guildId);
        } else {
          return { ...cached };
        }
      } else {
        return { ...cached };
      }
    }
    if (mariaAvailable && sqlPool){
      const [rows] = await sqlPool.query('SELECT nickname, activity_type, activity_text, avatar_base64, status FROM guild_personalization WHERE guild_id=?', [guildId]);
      if(rows.length){
        const rec = { nickname: rows[0].nickname || null, activityType: rows[0].activity_type || null, activityText: rows[0].activity_text || null, avatarBase64: rows[0].avatar_base64 || null, status: rows[0].status || null };
        if (process.env.DEBUG_PERSONALIZATION==='1') console.log('[PERSONALIZATION] DB load', guildId, Object.keys(rec).filter(k=>rec[k]).join(','));
        guildPersonalizationCache.set(guildId, rec);
        return { ...rec };
      }
    }
    const empty = { nickname:null, activityType:null, activityText:null, avatarBase64:null, status:null };
    if (process.env.DEBUG_PERSONALIZATION==='1') console.log('[PERSONALIZATION] no row, seeding empty', guildId);
    // Mark empty with timestamp so we can re-query after TTL
    guildPersonalizationCache.set(guildId, { ...empty, __emptyTs: Date.now() });
    return { ...empty };
  },
  // Bypass cache for diagnostics – always hits DB if available
  getGuildPersonalizationFresh: async (guildId) => {
    if(!guildId) return null;
    if (mariaAvailable && sqlPool){
      try {
        const [rows] = await sqlPool.query('SELECT nickname, activity_type, activity_text, avatar_base64, status, updated_at FROM guild_personalization WHERE guild_id=?', [guildId]);
        if(rows.length){
          return { nickname: rows[0].nickname || null, activityType: rows[0].activity_type || null, activityText: rows[0].activity_text || null, avatarBase64: rows[0].avatar_base64 || null, status: rows[0].status || null, updatedAt: rows[0].updated_at };
        }
        return null;
      } catch { return null; }
    }
    return null;
  },
  // Return map of all guild personalizations (Maria only). Used at startup to re-apply last saved global avatar/activity.
  getAllGuildPersonalizations: async () => {
    if (mariaAvailable && sqlPool){
      try {
        const [rows] = await sqlPool.query('SELECT guild_id, nickname, activity_type, activity_text, avatar_base64, status, updated_at FROM guild_personalization');
        const out = {};
        for (const r of rows){
          out[r.guild_id] = { nickname:r.nickname||null, activityType:r.activity_type||null, activityText:r.activity_text||null, avatarBase64:r.avatar_base64||null, status:r.status||null, updatedAt: r.updated_at };
        }
        return out;
      } catch { return {}; }
    }
    return {};
  },
  invalidateGuildPersonalization: (guildId) => { if(guildId) guildPersonalizationCache.delete(guildId); },
  setGuildPersonalization: async (guildId, data) => {
    if(!guildId) throw new Error('guildId required');
    const current = await module.exports.getGuildPersonalization(guildId);
    const next = { ...current };
    if(data.nickname !== undefined) next.nickname = data.nickname || null;
    if(data.activityType !== undefined) next.activityType = data.activityType || null;
    if(data.activityText !== undefined) next.activityText = data.activityText || null;
    if(data.avatarBase64 !== undefined) next.avatarBase64 = data.avatarBase64 || null;
    if(data.status !== undefined) next.status = data.status || null;
    guildPersonalizationCache.set(guildId, next);
    if (mariaAvailable && sqlPool){
      await sqlPool.query('REPLACE INTO guild_personalization(guild_id, nickname, activity_type, activity_text, avatar_base64, status) VALUES (?,?,?,?,?,?)', [
        guildId, next.nickname, next.activityType, next.activityText, next.avatarBase64, next.status
      ]);
    }
    return { ...next };
  },
  // Guild welcome config
  getGuildWelcome: async (guildId) => {
    if(!guildId) return null;
    if (guildWelcomeCache.has(guildId)) return { ...guildWelcomeCache.get(guildId) };
    if (mariaAvailable && sqlPool){
      const [rows] = await sqlPool.query('SELECT channel_id, message_type, message_text, card_enabled, enabled FROM guild_welcome WHERE guild_id=?', [guildId]);
      if (rows.length){
        const rec = { channelId: rows[0].channel_id || null, messageType: rows[0].message_type || 'text', messageText: rows[0].message_text || '', cardEnabled: rows[0].card_enabled === 1, enabled: rows[0].enabled === undefined ? true : (rows[0].enabled === 1 || rows[0].enabled === true) };
        guildWelcomeCache.set(guildId, rec);
        return { ...rec };
      }
    }
    const empty = { channelId:null, messageType:'text', messageText:'', cardEnabled:false, enabled:true };
    guildWelcomeCache.set(guildId, empty);
    return { ...empty };
  },
  setGuildWelcome: async (guildId, data) => {
    if(!guildId) throw new Error('guildId required');
    const current = await module.exports.getGuildWelcome(guildId);
    const next = { ...current };
    if (data.channelId !== undefined) next.channelId = data.channelId || null;
    if (data.messageType !== undefined) next.messageType = (data.messageType === 'embed') ? 'embed' : 'text';
    if (data.messageText !== undefined) next.messageText = data.messageText || '';
    if (data.cardEnabled !== undefined) next.cardEnabled = !!data.cardEnabled;
    if (data.enabled !== undefined) next.enabled = !!data.enabled;
    guildWelcomeCache.set(guildId, next);
    if (mariaAvailable && sqlPool){
      await sqlPool.query('REPLACE INTO guild_welcome(guild_id, channel_id, message_type, message_text, card_enabled, enabled) VALUES (?,?,?,?,?,?)', [
        guildId, next.channelId, next.messageType, next.messageText, next.cardEnabled ? 1 : 0, next.enabled ? 1 : 0
      ]);
    }
    return { ...next };
  },
  // --- Guild YouTube Watcher Config ---
  getGuildYouTubeConfig: async (guildId) => {
    if(!guildId) throw new Error('guildId required');
    if (guildYouTubeConfigCache.has(guildId)) return { ...guildYouTubeConfigCache.get(guildId) };
    const defaults = {
      channels: [],
      announceChannelId: null,
      mentionRoleId: null, // legacy single value for backward compatibility
      mentionTargets: [], // new multi-select list, values: 'everyone','here', role IDs
      enabled: false,
      intervalSec: 300,
      uploadTemplate: '🎥 New upload from {channelTitle}: **{title}**\n{url} {roleMention}',
      liveTemplate: '🔴 LIVE {channelTitle} is now LIVE: **{title}**\n{url} {roleMention}',
      embedEnabled: true,
      channelMessages: {}, // per-channel override templates maybe
      channelNames: {}
    };
    if (mariaAvailable && sqlPool){
      try {
  const [rows] = await sqlPool.query('SELECT channels, announce_channel_id, mention_target, enabled, interval_sec, upload_template, live_template, embed_enabled, channel_messages, channel_names FROM guild_youtube_watch WHERE guild_id=?', [guildId]);
        if(rows.length){
          const r = rows[0];
            const cfg = { ...defaults };
            try { if(r.channels) cfg.channels = JSON.parse(r.channels); } catch { cfg.channels = []; }
            cfg.announceChannelId = r.announce_channel_id || null;
            const rawMention = (r.mention_target || '').trim();
            let mt = [];
            if(rawMention){
              // split by comma and sanitize allowed tokens
              mt = rawMention.split(',').map(s=>s.trim()).filter(Boolean).filter(x=> x==='everyone' || x==='here' || /^[0-9]{5,32}$/.test(x));
            }
            cfg.mentionTargets = mt;
            cfg.mentionRoleId = mt.length === 1 && /^[0-9]{5,32}$/.test(mt[0]) ? mt[0] : null;
            cfg.enabled = r.enabled === 1 || r.enabled === true;
            cfg.intervalSec = r.interval_sec || defaults.intervalSec;
            cfg.uploadTemplate = r.upload_template || defaults.uploadTemplate;
            cfg.liveTemplate = r.live_template || defaults.liveTemplate;
            cfg.embedEnabled = r.embed_enabled === 0 ? false : true;
            try { if(r.channel_messages) cfg.channelMessages = JSON.parse(r.channel_messages); } catch { cfg.channelMessages = {}; }
            try { if(r.channel_names) cfg.channelNames = JSON.parse(r.channel_names); } catch { cfg.channelNames = {}; }
            guildYouTubeConfigCache.set(guildId, cfg);
            return { ...cfg };
        }
        // No row -> insert defaults (disabled); handle legacy schema with config_json NOT NULL
        try {
          if (youtubeHasConfigJsonColumn === null){
            try { await sqlPool.query('SELECT config_json FROM guild_youtube_watch LIMIT 1'); youtubeHasConfigJsonColumn = true; } catch { youtubeHasConfigJsonColumn = false; }
          }
          if (youtubeHasConfigJsonColumn){
            await sqlPool.query('INSERT INTO guild_youtube_watch(guild_id, channels, enabled, config_json) VALUES (?,?,0,?)', [guildId, JSON.stringify([]), JSON.stringify(defaults)]);
          } else {
            await sqlPool.query('INSERT INTO guild_youtube_watch(guild_id, channels, enabled) VALUES (?,?,0)', [guildId, JSON.stringify([])]);
          }
          console.log('[YouTubeCfg] inserted default row for guild', guildId, 'legacyCfgJson=', youtubeHasConfigJsonColumn);
        } catch(e){ console.error('[YouTubeCfg] failed inserting default row', guildId, e.message); }
        guildYouTubeConfigCache.set(guildId, defaults);
        return { ...defaults };
      } catch(e){
        console.error('[YouTubeCfg] load error guild', guildId, e.message);
        return { ...defaults };
      }
    }
    return { ...defaults }; // memory fallback (not persisted)
  },
  setGuildYouTubeConfig: async (guildId, partial) => {
    if(!guildId) throw new Error('guildId required');
    const current = await module.exports.getGuildYouTubeConfig(guildId);
    const next = { ...current };
    if (Array.isArray(partial.channels)) next.channels = partial.channels.slice(0, 25); // reasonable cap
    if (partial.announceChannelId !== undefined) next.announceChannelId = partial.announceChannelId || null;
    // Multi-role logic: prefer mentionTargets if provided else fallback to mentionRoleId
    if (Array.isArray(partial.mentionTargets)) {
      const cleaned = partial.mentionTargets
        .map(s=> String(s||'').trim())
        .filter(Boolean)
        .filter((v,i,a)=> a.indexOf(v)===i)
        .filter(x=> x==='everyone' || x==='here' || /^[0-9]{5,32}$/.test(x))
        .slice(0, 10); // cap to avoid excessive pings
      next.mentionTargets = cleaned;
      next.mentionRoleId = cleaned.length === 1 && /^[0-9]{5,32}$/.test(cleaned[0]) ? cleaned[0] : null;
    } else if (partial.mentionRoleId !== undefined) {
      const mr = partial.mentionRoleId ? String(partial.mentionRoleId) : null;
      next.mentionRoleId = mr;
      next.mentionTargets = mr ? [mr] : [];
    }
    if (partial.enabled !== undefined) next.enabled = !!partial.enabled;
    if (partial.intervalSec !== undefined) {
      const iv = parseInt(partial.intervalSec,10);
      if(!isNaN(iv) && iv >= 60 && iv <= 3600) next.intervalSec = iv; // clamp 1min - 1h
    }
    if (partial.uploadTemplate !== undefined) next.uploadTemplate = (partial.uploadTemplate || '').slice(0, 4000) || current.uploadTemplate;
    if (partial.liveTemplate !== undefined) next.liveTemplate = (partial.liveTemplate || '').slice(0, 4000) || current.liveTemplate;
    if (partial.embedEnabled !== undefined) next.embedEnabled = !!partial.embedEnabled;
    if (partial.channelMessages && typeof partial.channelMessages === 'object') next.channelMessages = { ...partial.channelMessages };
    if (partial.channelNames && typeof partial.channelNames === 'object') next.channelNames = { ...partial.channelNames };
    guildYouTubeConfigCache.set(guildId, next);
    if (mariaAvailable && sqlPool){
      const row = {
        channels: JSON.stringify(next.channels||[]),
        announce_channel_id: next.announceChannelId,
        mention_target: next.mentionTargets.join(','),
        enabled: next.enabled ? 1 : 0,
        interval_sec: next.intervalSec,
        upload_template: next.uploadTemplate,
        live_template: next.liveTemplate,
        embed_enabled: next.embedEnabled ? 1:0,
        channel_messages: JSON.stringify(next.channelMessages||{}),
        channel_names: JSON.stringify(next.channelNames||{})
      };
      try {
        if (youtubeHasConfigJsonColumn === null){
          try { await sqlPool.query('SELECT config_json FROM guild_youtube_watch LIMIT 1'); youtubeHasConfigJsonColumn = true; } catch { youtubeHasConfigJsonColumn = false; }
        }
        if (youtubeHasConfigJsonColumn){
          await sqlPool.query(`INSERT INTO guild_youtube_watch (guild_id, channels, announce_channel_id, mention_target, enabled, interval_sec, upload_template, live_template, embed_enabled, channel_messages, channel_names, config_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE channels=VALUES(channels), announce_channel_id=VALUES(announce_channel_id), mention_target=VALUES(mention_target), enabled=VALUES(enabled), interval_sec=VALUES(interval_sec), upload_template=VALUES(upload_template), live_template=VALUES(live_template), embed_enabled=VALUES(embed_enabled), channel_messages=VALUES(channel_messages), channel_names=VALUES(channel_names), config_json=VALUES(config_json)`,
            [guildId, row.channels, row.announce_channel_id, row.mention_target, row.enabled, row.interval_sec, row.upload_template, row.live_template, row.embed_enabled, row.channel_messages, row.channel_names, JSON.stringify(next)]
          );
        } else {
          await sqlPool.query(`INSERT INTO guild_youtube_watch (guild_id, channels, announce_channel_id, mention_target, enabled, interval_sec, upload_template, live_template, embed_enabled, channel_messages, channel_names)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE channels=VALUES(channels), announce_channel_id=VALUES(announce_channel_id), mention_target=VALUES(mention_target), enabled=VALUES(enabled), interval_sec=VALUES(interval_sec), upload_template=VALUES(upload_template), live_template=VALUES(live_template), embed_enabled=VALUES(embed_enabled), channel_messages=VALUES(channel_messages), channel_names=VALUES(channel_names)`,
            [guildId, row.channels, row.announce_channel_id, row.mention_target, row.enabled, row.interval_sec, row.upload_template, row.live_template, row.embed_enabled, row.channel_messages, row.channel_names]
          );
        }
        console.log('[YouTubeCfg] saved guild', guildId, 'targets=', next.mentionTargets.length, 'channels=', next.channels.length, 'legacyCfgJson=', youtubeHasConfigJsonColumn);
      } catch(e){
        console.error('YouTube config save failed for guild', guildId, e.message);
        throw e; // let caller surface persist_failed
      }
    }
    return { ...next };
  },
  invalidateGuildYouTubeConfig: (guildId) => { guildYouTubeConfigCache.delete(guildId); },
  
  // --- Guild Twitch Watcher Config ---
  getGuildTwitchConfig: async (guildId) => {
    if(!guildId) throw new Error('guildId required');
    if (guildTwitchConfigCache.has(guildId)) return { ...guildTwitchConfigCache.get(guildId) };
    const defaults = {
      streamers: [],
      announceChannelId: null,
      mentionRoleId: null, // legacy single value for backward compatibility
      mentionTargets: [], // new multi-select list, values: 'everyone','here', role IDs
      enabled: false,
      intervalSec: 300,
      liveTemplate: '🔴 LIVE {streamerName} is now LIVE: **{title}**\n{url} {roleMention}',
      embedEnabled: true,
      streamerMessages: {}, // per-streamer override templates
      streamerNames: {}
    };
    if (mariaAvailable && sqlPool){
      try {
        const [rows] = await sqlPool.query('SELECT streamers, announce_channel_id, mention_target, enabled, interval_sec, live_template, embed_enabled, streamer_messages, streamer_names FROM guild_twitch_watch WHERE guild_id=?', [guildId]);
        if(rows.length){
          const r = rows[0];
          const cfg = { ...defaults };
          try { if(r.streamers) cfg.streamers = JSON.parse(r.streamers); } catch { cfg.streamers = []; }
          cfg.announceChannelId = r.announce_channel_id || null;
          const rawMention = (r.mention_target || '').trim();
          let mt = [];
          if(rawMention){
            // split by comma and sanitize allowed tokens
            mt = rawMention.split(',').map(s=>s.trim()).filter(Boolean).filter(x=> x==='everyone' || x==='here' || /^[0-9]{5,32}$/.test(x));
          }
          cfg.mentionTargets = mt;
          cfg.mentionRoleId = mt.length === 1 && /^[0-9]{5,32}$/.test(mt[0]) ? mt[0] : null;
          cfg.enabled = r.enabled === 1 || r.enabled === true;
          cfg.intervalSec = r.interval_sec || defaults.intervalSec;
          cfg.liveTemplate = r.live_template || defaults.liveTemplate;
          cfg.embedEnabled = r.embed_enabled === 0 ? false : true;
          try { if(r.streamer_messages) cfg.streamerMessages = JSON.parse(r.streamer_messages); } catch { cfg.streamerMessages = {}; }
          try { if(r.streamer_names) cfg.streamerNames = JSON.parse(r.streamer_names); } catch { cfg.streamerNames = {}; }
          guildTwitchConfigCache.set(guildId, cfg);
          return { ...cfg };
        }
        // No row -> insert defaults (disabled)
        try {
          await sqlPool.query('INSERT INTO guild_twitch_watch(guild_id, streamers, enabled) VALUES (?,?,0)', [guildId, JSON.stringify([])]);
          console.log('[TwitchCfg] inserted default row for guild', guildId);
        } catch(e){ console.error('[TwitchCfg] failed inserting default row', guildId, e.message); }
        guildTwitchConfigCache.set(guildId, defaults);
        return { ...defaults };
      } catch(e){
        console.error('[TwitchCfg] load error guild', guildId, e.message);
        return { ...defaults };
      }
    }
    return { ...defaults }; // memory fallback (not persisted)
  },
  setGuildTwitchConfig: async (guildId, partial) => {
    if(!guildId) throw new Error('guildId required');
    const current = await module.exports.getGuildTwitchConfig(guildId);
    const next = { ...current };
    if (Array.isArray(partial.streamers)) next.streamers = partial.streamers.slice(0, 25); // reasonable cap
    if (partial.announceChannelId !== undefined) next.announceChannelId = partial.announceChannelId || null;
    // Multi-role logic: prefer mentionTargets if provided else fallback to mentionRoleId
    if (Array.isArray(partial.mentionTargets)) {
      const cleaned = partial.mentionTargets
        .map(s=> String(s||'').trim())
        .filter(Boolean)
        .filter((v,i,a)=> a.indexOf(v)===i)
        .filter(x=> x==='everyone' || x==='here' || /^[0-9]{5,32}$/.test(x))
        .slice(0, 10); // cap to avoid excessive pings
      next.mentionTargets = cleaned;
      next.mentionRoleId = cleaned.length === 1 && /^[0-9]{5,32}$/.test(cleaned[0]) ? cleaned[0] : null;
    } else if (partial.mentionRoleId !== undefined) {
      const mr = partial.mentionRoleId ? String(partial.mentionRoleId) : null;
      next.mentionRoleId = mr;
      next.mentionTargets = mr ? [mr] : [];
    }
    if (partial.enabled !== undefined) next.enabled = !!partial.enabled;
    if (partial.intervalSec !== undefined) {
      const iv = parseInt(partial.intervalSec,10);
      if(!isNaN(iv) && iv >= 60 && iv <= 3600) next.intervalSec = iv; // clamp 1min - 1h
    }
    if (partial.liveTemplate !== undefined) next.liveTemplate = (partial.liveTemplate || '').slice(0, 4000) || current.liveTemplate;
    if (partial.embedEnabled !== undefined) next.embedEnabled = !!partial.embedEnabled;
    if (partial.streamerMessages && typeof partial.streamerMessages === 'object') next.streamerMessages = { ...partial.streamerMessages };
    if (partial.streamerNames && typeof partial.streamerNames === 'object') next.streamerNames = { ...partial.streamerNames };
    guildTwitchConfigCache.set(guildId, next);
    if (mariaAvailable && sqlPool){
      const row = {
        streamers: JSON.stringify(next.streamers||[]),
        announce_channel_id: next.announceChannelId,
        mention_target: next.mentionTargets.join(','),
        enabled: next.enabled ? 1 : 0,
        interval_sec: next.intervalSec,
        live_template: next.liveTemplate,
        embed_enabled: next.embedEnabled ? 1:0,
        streamer_messages: JSON.stringify(next.streamerMessages||{}),
        streamer_names: JSON.stringify(next.streamerNames||{})
      };
      try {
        await sqlPool.query(`INSERT INTO guild_twitch_watch (guild_id, streamers, announce_channel_id, mention_target, enabled, interval_sec, live_template, embed_enabled, streamer_messages, streamer_names)
          VALUES (?,?,?,?,?,?,?,?,?,?)
          ON DUPLICATE KEY UPDATE streamers=VALUES(streamers), announce_channel_id=VALUES(announce_channel_id), mention_target=VALUES(mention_target), enabled=VALUES(enabled), interval_sec=VALUES(interval_sec), live_template=VALUES(live_template), embed_enabled=VALUES(embed_enabled), streamer_messages=VALUES(streamer_messages), streamer_names=VALUES(streamer_names)`,
          [guildId, row.streamers, row.announce_channel_id, row.mention_target, row.enabled, row.interval_sec, row.live_template, row.embed_enabled, row.streamer_messages, row.streamer_names]
        );
        console.log('[TwitchCfg] saved guild', guildId, 'targets=', next.mentionTargets.length, 'streamers=', next.streamers.length);
      } catch(e){
        console.error('Twitch config save failed for guild', guildId, e.message);
        throw e; // let caller surface persist_failed
      }
    }
    return { ...next };
  },
  invalidateGuildTwitchConfig: (guildId) => { guildTwitchConfigCache.delete(guildId); },
  removeAutoResponse: async (key) => {
    const idx = autoResponses.findIndex(r => r.key === key);
    if (idx >= 0) autoResponses.splice(idx, 1);
    await deleteAutoResponse(key);
  },
  getCommandToggles: () => {
    // Return simple map name->enabled for legacy callers
    const out = {};
    for (const k of Object.keys(commandToggles)) out[k] = commandToggles[k].enabled !== false;
    return out;
  },
  getAllCommandToggles: () => {
    // Return full metadata structure
    const out = {};
    for (const k of Object.keys(commandToggles)) {
      const meta = commandToggles[k];
      out[k] = {
        enabled: meta.enabled !== false,
        createdAt: meta.created_at || null,
        createdBy: meta.created_by || null,
        updatedAt: meta.updated_at || null,
        updatedBy: meta.updated_by || null
      };
    }
    return out;
  },
  setCommandToggle: async (name, enabled, actor) => {
    const nowMeta = commandToggles[name];
    if (!nowMeta){
      commandToggles[name] = { enabled: !!enabled, created_at: new Date(), created_by: actor||null, updated_at: new Date(), updated_by: actor||null };
    } else {
      nowMeta.enabled = !!enabled; nowMeta.updated_at = new Date(); nowMeta.updated_by = actor||null;
    }
    if (mariaAvailable && sqlPool){
      await sqlPool.query('INSERT INTO command_toggles(command_name, enabled, created_by, updated_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), updated_by=VALUES(updated_by)', [name, enabled ? 1 : 0, actor||null, actor||null]);
    }
    return commandToggles[name].enabled;
  },
  getGuildCommandToggles: async (guildId) => {
    if(!guildId) return module.exports.getCommandToggles();
    const existing = guildCommandToggles.get(guildId) || {};
    const base = module.exports.getCommandToggles();
    // Merge overriding enabled flag only
    const merged = { ...base };
    for (const k of Object.keys(existing)) merged[k] = existing[k].enabled !== false;
    return merged;
  },
  getAllGuildCommandToggles: async (guildId) => {
    if(!guildId) return module.exports.getAllCommandToggles();
    const existing = guildCommandToggles.get(guildId) || {};
    const base = module.exports.getAllCommandToggles();
    const merged = { ...base };
    for (const k of Object.keys(existing)) {
      const meta = existing[k];
      merged[k] = {
        enabled: meta.enabled !== false,
        createdAt: meta.created_at || null,
        createdBy: meta.created_by || null,
        updatedAt: meta.updated_at || null,
        updatedBy: meta.updated_by || null
      };
    }
    return merged;
  },
  setGuildCommandToggle: async (guildId, name, enabled, actor) => {
    if(!guildId) throw new Error('guildId required');
    const existing = guildCommandToggles.get(guildId) || {};
    const meta = existing[name];
    if (!meta){
      existing[name] = { enabled: !!enabled, created_at: new Date(), created_by: actor||null, updated_at: new Date(), updated_by: actor||null };
    } else {
      meta.enabled = !!enabled; meta.updated_at = new Date(); meta.updated_by = actor||null;
    }
    guildCommandToggles.set(guildId, existing);
    if (mariaAvailable && sqlPool){
      await sqlPool.query('INSERT INTO guild_command_toggles(guild_id, command_name, enabled, created_by, updated_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), updated_by=VALUES(updated_by)', [guildId, name, enabled ? 1 : 0, actor||null, actor||null]);
    }
    return existing[name].enabled;
  },
  
  // Analytics & Monitoring Functions
  trackCommandUsage: (commandName, guildId) => {
    const now = Date.now();
    const key = commandName;
    
    // Update daily counter
    if (!commandUsageStats.has(key)) {
      commandUsageStats.set(key, { daily: 0, hourly: 0, lastHour: now });
    }
    
    const stats = commandUsageStats.get(key);
    stats.daily++;
    
    // Reset hourly counter if it's been an hour
    if (now - stats.lastHour > 3600000) { // 1 hour
      stats.hourly = 0;
      stats.lastHour = now;
    }
    stats.hourly++;
    
    // Update system stats
    systemStats.commandsToday++;
    
    // Add to activity log
    activityLog.push({
      type: 'command',
      action: `/${commandName} used`,
      guild: guildId || 'DM',
      timestamp: new Date().toISOString(),
      userId: null
    });
    
    // Keep activity log limited to last 100 entries
    if (activityLog.length > 100) {
      activityLog.splice(0, activityLog.length - 100);
    }
  },
  
  trackAutoResponse: (guildId, key) => {
    activityLog.push({
      type: 'auto',
      action: `Auto response: ${key}`,
      guild: guildId || 'Unknown',
      timestamp: new Date().toISOString(),
      userId: null
    });
    
    if (activityLog.length > 100) {
      activityLog.splice(0, activityLog.length - 100);
    }
  },
  
  trackError: (error, context = '') => {
    const now = Date.now();
    
    // Reset error counter if it's been an hour
    if (now - systemStats.lastHourReset > 3600000) {
      systemStats.errorsThisHour = 0;
      systemStats.lastHourReset = now;
    }
    
    systemStats.errorsThisHour++;
    errorLog.push({
      timestamp: new Date().toISOString(),
      error: error.message || String(error),
      context
    });
    
    // Keep error log limited
    if (errorLog.length > 50) {
      errorLog.splice(0, errorLog.length - 50);
    }
  },
  
  trackApiResponse: (responseTime, success = true) => {
    systemStats.responseTimeSum += responseTime;
    systemStats.responseTimeCount++;
    systemStats.totalRequests++;
    
    if (success) {
      systemStats.successCount++;
    }
  },
  
  getSystemMetrics: () => {
    const now = Date.now();
    
    // Cache metrics for 5 seconds to avoid excessive calculations
    if (cachedSystemMetrics && (now - lastMetricsUpdate) < 5000) {
      return cachedSystemMetrics;
    }
    
    const uptime = now - systemStats.startTime;
    const avgResponseTime = systemStats.responseTimeCount > 0 
      ? Math.round(systemStats.responseTimeSum / systemStats.responseTimeCount) 
      : 0;
    
    const successRate = systemStats.totalRequests > 0 
      ? (systemStats.successCount / systemStats.totalRequests) * 100 
      : 100;
    
    // Get memory usage
    const memUsage = process.memoryUsage();
    
    // Calculate CPU usage (simplified approach using process.hrtime)
    const cpuUsage = process.cpuUsage();
    const totalTime = (cpuUsage.user + cpuUsage.system) / 1000; // Convert to milliseconds
    const uptimeMs = uptime;
    let cpuPercent = 0;
    
    if (uptimeMs > 0) {
      // Calculate CPU percentage (this is an approximation)
      cpuPercent = Math.min(Math.round((totalTime / uptimeMs) * 100), 100);
    }
    
    cachedSystemMetrics = {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal
      },
      cpu: {
        usage: Math.max(0, cpuPercent)
      },
      responseTime: {
        avg: avgResponseTime
      },
      successRate: Math.round(successRate * 100) / 100,
      commands: {
        daily: systemStats.commandsToday
      },
      errors: {
        hourly: systemStats.errorsThisHour
      }
    };
    
    lastMetricsUpdate = now;
    return cachedSystemMetrics;
  },
  
  getTopCommands: (guildId = null) => {
    return Array.from(commandUsageStats.entries())
      .map(([name, stats]) => ({ name, count: stats.daily }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  },
  
  getRecentActivity: (guildId = null) => {
    let activities = activityLog.slice(-50); // Get more to filter from
    
    // Filter by guild if specified
    if (guildId) {
      activities = activities.filter(activity => 
        activity.guild === guildId || activity.guild === 'DM'
      );
    }
    
    return activities.slice(-20).reverse(); // Last 20 activities, newest first
  },
  
  getBotStats: (client) => {
    if (!client) return { guilds: 0, users: 0 };
    
    const guildCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0);
    
    return {
      guilds: guildCount,
      users: userCount
    };
  },
  
  // Reset daily stats (should be called once per day)
  resetDailyStats: () => {
    systemStats.commandsToday = 0;
    commandUsageStats.clear();
    console.log('Daily stats reset');
  }
};
