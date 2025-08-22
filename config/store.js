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
// Guild scoped caches
const guildSettingsCache = new Map(); // guildId -> settings
const guildAutoResponsesCache = new Map(); // guildId -> auto responses

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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_auto_responses (
      guild_id VARCHAR(32) NOT NULL,
      \`key\` VARCHAR(100) NOT NULL,
      pattern TEXT NOT NULL,
      flags VARCHAR(8) NOT NULL DEFAULT 'i',
      replies TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT 1,
      PRIMARY KEY (guild_id, \`key\`)
    ) ENGINE=InnoDB`);
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
    await sqlPool.query('REPLACE INTO guild_settings(guild_id, auto_reply_enabled, auto_reply_cooldown_ms) VALUES (?,?,?)', [
      guildId, data.autoReplyEnabled ? 1 : 0, data.autoReplyCooldownMs
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
    if (!guildId) return { ...seedSettings };
    if (guildSettingsCache.has(guildId)) return { ...guildSettingsCache.get(guildId) };
    if (mariaAvailable && sqlPool){
      const [rows] = await sqlPool.query('SELECT auto_reply_enabled, auto_reply_cooldown_ms FROM guild_settings WHERE guild_id=?', [guildId]);
      let gs;
      if (rows.length === 0){
        gs = { ...seedSettings };
        await saveGuildSettings(guildId, gs);
      } else {
        gs = { autoReplyEnabled: !!rows[0].auto_reply_enabled, autoReplyCooldownMs: rows[0].auto_reply_cooldown_ms };
      }
      guildSettingsCache.set(guildId, gs);
      return { ...gs };
    }
    return { ...seedSettings };
  },
  setGuildSettings: async (guildId, partial) => {
    if (!guildId) throw new Error('guildId required');
    const current = await module.exports.getGuildSettings(guildId);
    if (partial.autoReplyEnabled !== undefined) current.autoReplyEnabled = !!partial.autoReplyEnabled;
    if (partial.autoReplyCooldownMs !== undefined) current.autoReplyCooldownMs = parseInt(partial.autoReplyCooldownMs,10) || current.autoReplyCooldownMs;
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
  removeAutoResponse: async (key) => {
    const idx = autoResponses.findIndex(r => r.key === key);
    if (idx >= 0) autoResponses.splice(idx, 1);
    await deleteAutoResponse(key);
  }
};
