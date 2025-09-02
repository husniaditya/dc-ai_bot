// Auto responses service - handles global and guild-specific auto responses
const db = require('../database/connection');
const cache = require('../cache/manager');
const { loadSeedAutoResponses, compileAutoResponses, compileGuildAutoResponses } = require('../models/defaults');

async function saveAutoResponse(ar) {
  if (db.mongooseAvailable && db.AutoResponseModel) {
    await db.AutoResponseModel.findOneAndUpdate({ key: ar.key }, ar, { upsert: true });
  } else if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'REPLACE INTO auto_responses(`key`, pattern, flags, replies, enabled) VALUES (?,?,?,?,?)',
      [ar.key, ar.pattern, ar.flags, JSON.stringify(ar.replies || []), ar.enabled !== false ? 1 : 0]
    );
  }
}

async function saveGuildAutoResponse(guildId, ar) {
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'REPLACE INTO guild_auto_responses(guild_id, `key`, pattern, flags, replies, enabled) VALUES (?,?,?,?,?,?)',
      [guildId, ar.key, ar.pattern, ar.flags, JSON.stringify(ar.replies || []), ar.enabled !== false ? 1 : 0]
    );
  }
}

async function deleteAutoResponse(key) {
  if (db.mongooseAvailable && db.AutoResponseModel) {
    await db.AutoResponseModel.deleteOne({ key });
  } else if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query('DELETE FROM auto_responses WHERE `key`=?', [key]);
  }
}

async function deleteGuildAutoResponse(guildId, key) {
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query('DELETE FROM guild_auto_responses WHERE guild_id=? AND `key`=?', [guildId, key]);
  }
}

function getAutoResponses() {
  const cacheData = cache.getCache();
  return cacheData.autoResponses.map(r => ({ ...r }));
}

function getCompiledAutoResponses() {
  const cacheData = cache.getCache();
  return compileAutoResponses(cacheData.autoResponses);
}

async function getGuildAutoResponses(guildId) {
  if (!guildId) return getAutoResponses();
  
  const cacheData = cache.getCache();
  if (cacheData.guildAutoResponsesCache.has(guildId)) {
    return cacheData.guildAutoResponsesCache.get(guildId).map(r => ({ ...r }));
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const [rows] = await db.sqlPool.query(
        'SELECT `key`, pattern, flags, replies, enabled FROM guild_auto_responses WHERE guild_id=?',
        [guildId]
      );
      
      const responses = rows.map(r => ({
        key: r.key,
        pattern: r.pattern,
        flags: r.flags,
        replies: JSON.parse(r.replies || '[]'),
        enabled: r.enabled !== 0
      }));
      
      cacheData.guildAutoResponsesCache.set(guildId, responses);
      return responses.map(r => ({ ...r }));
    } catch (e) {
      console.error('Error loading guild auto responses:', e.message);
    }
  }
  
  return getAutoResponses();
}

async function getCompiledGuildAutoResponses(guildId) {
  const list = await getGuildAutoResponses(guildId);
  return compileGuildAutoResponses(list);
}

async function upsertAutoResponse(entry) {
  const cacheData = cache.getCache();
  const idx = cacheData.autoResponses.findIndex(r => r.key === entry.key);
  const cleaned = {
    key: entry.key,
    pattern: entry.pattern,
    flags: entry.flags || 'i',
    replies: entry.replies || [],
    enabled: entry.enabled !== false
  };
  
  if (idx >= 0) {
    cacheData.autoResponses[idx] = cleaned;
  } else {
    cacheData.autoResponses.push(cleaned);
  }
  
  await saveAutoResponse(cleaned);
  return cleaned;
}

async function upsertGuildAutoResponse(guildId, entry) {
  if (!guildId) throw new Error('guildId required');
  
  const cleaned = {
    key: entry.key,
    pattern: entry.pattern,
    flags: entry.flags || 'i',
    replies: entry.replies || [],
    enabled: entry.enabled !== false
  };
  
  const cacheData = cache.getCache();
  const cacheList = cacheData.guildAutoResponsesCache.get(guildId) || await getGuildAutoResponses(guildId);
  const idx = cacheList.findIndex(r => r.key === cleaned.key);
  
  if (idx >= 0) {
    cacheList[idx] = cleaned;
  } else {
    cacheList.push(cleaned);
  }
  
  cacheData.guildAutoResponsesCache.set(guildId, cacheList);
  await saveGuildAutoResponse(guildId, cleaned);
  return cleaned;
}

async function removeAutoResponse(key) {
  const cacheData = cache.getCache();
  const idx = cacheData.autoResponses.findIndex(r => r.key === key);
  if (idx >= 0) {
    cacheData.autoResponses.splice(idx, 1);
  }
  await deleteAutoResponse(key);
}

async function removeGuildAutoResponse(guildId, key) {
  const cacheData = cache.getCache();
  const list = cacheData.guildAutoResponsesCache.get(guildId) || [];
  const idx = list.findIndex(r => r.key === key);
  if (idx >= 0) {
    list.splice(idx, 1);
  }
  cacheData.guildAutoResponsesCache.set(guildId, list);
  await deleteGuildAutoResponse(guildId, key);
}

// Initialize auto responses on module load
function initializeAutoResponses() {
  const seedResponses = loadSeedAutoResponses();
  cache.setAutoResponses(seedResponses);
}

module.exports = {
  getAutoResponses,
  getCompiledAutoResponses,
  getGuildAutoResponses,
  getCompiledGuildAutoResponses,
  upsertAutoResponse,
  upsertGuildAutoResponse,
  removeAutoResponse,
  removeGuildAutoResponse,
  initializeAutoResponses
};
