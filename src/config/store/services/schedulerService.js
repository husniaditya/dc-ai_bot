// Scheduler Service: manages timed sending of scheduled messages.
// Formats handled:
//  once: yyyy-MM-ddTHH:mm (local, interpreted as local time)
//  daily: HH:MM (24h)
//  weekly: D|HH:MM (0=Sun)
//  monthly: DD|HH:MM (01-31; overflow -> last day of month)
//  cron: raw cron expression
// Enhancements: immediate reschedule on CRUD operations, embed support, timezone awareness (future),
// graceful error handling, optional caching of next run.

const cronParser = require('cron-parser');
const db = require('../database/connection');
const cache = require('../cache/manager');

const jobs = new Map(); // key: guildId:id -> { timeout, data }

function log(...args){ if (process.env.DEBUG_SCHEDULER === '1') console.log('[Scheduler]', ...args); }

function parseCanonicalNext(scheduleType, scheduleValue, fromDate = new Date()) {
  const base = new Date(fromDate.getTime());
  switch (scheduleType) {
    case 'once': {
      const dt = new Date(scheduleValue);
      return dt > base ? dt : null;
    }
    case 'daily': {
      const [hh, mm] = scheduleValue.split(':').map(n=>parseInt(n,10));
      const next = new Date(base.getTime());
      next.setSeconds(0,0); next.setHours(hh, mm, 0, 0);
      if (next <= base) next.setDate(next.getDate()+1);
      return next;
    }
    case 'weekly': {
      const [dPart, timePart] = scheduleValue.split('|');
      const targetDow = parseInt(dPart,10);
      const [hh, mm] = timePart.split(':').map(n=>parseInt(n,10));
      const next = new Date(base.getTime());
      next.setSeconds(0,0); next.setHours(hh, mm, 0, 0);
      const currentDow = next.getDay();
      let diff = targetDow - currentDow;
      if (diff < 0 || (diff === 0 && next <= base)) diff += 7;
      if (diff) next.setDate(next.getDate()+diff);
      if (next <= base) next.setDate(next.getDate()+7);
      return next;
    }
    case 'monthly': {
      const [dPart, timePart] = scheduleValue.split('|');
      const day = parseInt(dPart,10);
      const [hh, mm] = timePart.split(':').map(n=>parseInt(n,10));
      const attempt = new Date(base.getFullYear(), base.getMonth(), day, hh, mm, 0, 0);
      if (attempt.getDate() !== day) {
        // overflow -> last day of current month
        const last = new Date(base.getFullYear(), base.getMonth()+1, 0, hh, mm, 0, 0);
        if (last <= base) {
          return new Date(base.getFullYear(), base.getMonth()+2, 0, hh, mm, 0, 0);
        }
        return last;
      }
      if (attempt <= base) {
        const nextMonth = new Date(base.getFullYear(), base.getMonth()+1, day, hh, mm, 0, 0);
        if (nextMonth.getDate() !== day) return new Date(base.getFullYear(), base.getMonth()+2, 0, hh, mm, 0, 0);
        return nextMonth;
      }
      return attempt;
    }
    case 'cron': {
      try {
        const interval = cronParser.parseExpression(scheduleValue, { currentDate: base });
        return interval.next().toDate();
      } catch (e) { log('Cron parse error', e.message); return null; }
    }
    default: return null;
  }
}

async function persistNextRun(guildId, id, nextDate){
  if (!nextDate) return;
  if (db.mariaAvailable && db.sqlPool){
    try { 
      await db.sqlPool.query('UPDATE guild_scheduled_messages SET next_run=? WHERE id=? AND guild_id=?',[nextDate, id, guildId]);
      
      // Clear cache to ensure UI reflects the change
      const cacheData = cache.getCache();
      if (cacheData.guildScheduledMessagesCache) {
        cacheData.guildScheduledMessagesCache.delete(guildId);
      }
    }
    catch(e){ log('Persist next_run fail', e.message); }
  }
}

async function markLastRun(guildId, id){
  if (db.mariaAvailable && db.sqlPool){
    try { 
      await db.sqlPool.query('UPDATE guild_scheduled_messages SET last_run=NOW() WHERE id=? AND guild_id=?',[id, guildId]);
      
      // Clear cache to ensure UI reflects the change
      const cacheData = cache.getCache();
      if (cacheData.guildScheduledMessagesCache) {
        cacheData.guildScheduledMessagesCache.delete(guildId);
      }
    }
    catch(e){ log('Persist last_run fail', e.message); }
  }
}

async function disableOneOff(guildId, id){
  if (db.mariaAvailable && db.sqlPool){
    try { 
      await db.sqlPool.query('UPDATE guild_scheduled_messages SET enabled=0 WHERE id=? AND guild_id=?',[id, guildId]);
      
      // Clear cache to ensure UI reflects the change
      const cacheData = cache.getCache();
      if (cacheData.guildScheduledMessagesCache) {
        cacheData.guildScheduledMessagesCache.delete(guildId);
      }
    }
    catch(e){ log('Disable once fail', e.message); }
  }
}

async function dispatch(client, guildId, message){
  try {
    const channel = await client.channels.fetch(message.channelId).catch(()=>null);
    if (!channel || !channel.send) return log('Channel fetch/send failed', message.channelId);
    if (message.embedData){
      // Simple embed support with proper color conversion
      let embedArray = Array.isArray(message.embedData) ? message.embedData : [message.embedData];
      
      // Convert string colors to integers and fix embed structure
      embedArray = embedArray.map(embed => {
        const processedEmbed = { ...embed };
        
        // Convert color from hex string to integer
        if (processedEmbed.color && typeof processedEmbed.color === 'string') {
          const hexColor = processedEmbed.color.replace('#', '');
          processedEmbed.color = parseInt(hexColor, 16);
        }
        
        // Ensure footer, thumbnail, and image are proper objects or removed if empty
        if (processedEmbed.footer && typeof processedEmbed.footer === 'string') {
          if (processedEmbed.footer.trim()) {
            processedEmbed.footer = { text: processedEmbed.footer };
          } else {
            delete processedEmbed.footer;
          }
        }
        
        if (processedEmbed.thumbnail && typeof processedEmbed.thumbnail === 'string') {
          if (processedEmbed.thumbnail.trim()) {
            processedEmbed.thumbnail = { url: processedEmbed.thumbnail };
          } else {
            delete processedEmbed.thumbnail;
          }
        }
        
        if (processedEmbed.image && typeof processedEmbed.image === 'string') {
          if (processedEmbed.image.trim()) {
            processedEmbed.image = { url: processedEmbed.image };
          } else {
            delete processedEmbed.image;
          }
        }
        
        return processedEmbed;
      });
      
      await channel.send({ content: message.messageContent || undefined, embeds: embedArray });
    } else {
      await channel.send({ content: message.messageContent });
    }
    await markLastRun(guildId, message.id);
  } catch (e) { 
    log('Dispatch error', e.message);
    console.error('Full dispatch error:', e);
  }
}

function scheduleJob(client, guildId, message){
  const key = guildId+':'+message.id;
  // Clear existing
  if (jobs.has(key)) { clearTimeout(jobs.get(key).timeout); jobs.delete(key); }
  if (!message.enabled) return;
  const next = parseCanonicalNext(message.scheduleType, message.scheduleValue);
  if (!next) return;
  const delay = next.getTime() - Date.now();
  if (delay <= 0) return; // skip immediate past
  if (delay > 2147483647) return; // > ~24.8 days - rely on periodic reload
  persistNextRun(guildId, message.id, next);
  const timeout = setTimeout(async () => {
    await dispatch(client, guildId, message);
    const recurring = message.scheduleType !== 'once';
    if (recurring){
      scheduleJob(client, guildId, message); // compute again fresh
    } else {
      disableOneOff(guildId, message.id);
    }
  }, delay);
  jobs.set(key, { timeout, data: message });
  log('Scheduled', key, 'run in', Math.round(delay/1000),'s');
}

async function loadAllAndSchedule(client){
  if (!db.mariaAvailable || !db.sqlPool) return;
  try {
    const [rows] = await db.sqlPool.query(`SELECT guild_id, id, title, channel_id as channelId, message_content as messageContent, embed_data as embedDataRaw, schedule_type as scheduleType, schedule_value as scheduleValue, enabled FROM guild_scheduled_messages WHERE enabled=1`);
    for (const row of rows){
      const embedData = row.embedDataRaw ? safeJsonParse(row.embedDataRaw) : null;
      scheduleJob(client, row.guild_id, { ...row, embedData });
    }
    log('Loaded jobs:', rows.length);
  } catch (e) { log('Load error', e.message); }
}

function safeJsonParse(str){ try { return JSON.parse(str); } catch { return null; } }

function initScheduler(client){
  if (process.env.DISABLE_SCHEDULER === '1') { log('Disabled by env'); return; }
  client.once('ready', () => {
    loadAllAndSchedule(client);
    setInterval(()=>loadAllAndSchedule(client), 10*60*1000); // refresh every 10 min
  });
}

// Hooks to be called after CRUD operations (wired manually in service exports usage)
function schedulerNotifyCreateOrUpdate(client, guildId, message){ scheduleJob(client, guildId, message); }
function schedulerNotifyDelete(guildId, id){
  const key = guildId+':'+id;
  if (jobs.has(key)) { clearTimeout(jobs.get(key).timeout); jobs.delete(key); log('Unschedule', key); }
}

module.exports = { initScheduler, scheduleJob, schedulerNotifyCreateOrUpdate, schedulerNotifyDelete, parseCanonicalNext };
