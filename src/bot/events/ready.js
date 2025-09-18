const { ActivityType } = require('discord.js');

// Services
const { startYouTubeWatcher } = require('../services/youtube');
const { startTwitchWatcher } = require('../services/twitch');
const { startCOCWatcher } = require('../watchers/clashofclans');

// Initialize leaderboard events (relocated to handlers directory)
const LeaderboardEvents = require('../handlers/LeaderboardEvents');

function setupReadyHandler(client, store, startTimestamp, commandMap) {
  client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    // Add some initial analytics data for demo purposes
    try {
      store.trackCommandUsage('ping', null);
      store.trackCommandUsage('help', null);
      store.trackAutoResponse(null, 'welcome');
      console.log('[Analytics] Seeded initial demo data');
    } catch(e) {
      console.warn('[Analytics] Failed to seed demo data:', e.message);
    }
    
    // On startup apply personalization (nicknames per guild + latest global status/activity/avatar)
    async function applyStartupPersonalizations() {
      try {
        console.log('[StartupPersonalization] Applying per-guild nicknames…');
        for (const g of client.guilds.cache.values()) {
          await applyGuildPersonalization(g.id, client, store);
        }
        await applyGlobalPersonalization(client, store);
      } catch(e) { 
        console.warn('[StartupPersonalization] Failed', e.message); 
      }
    }
    
    applyStartupPersonalizations();
    
    // Re-apply after delays to overcome any initial gateway race conditions
    setTimeout(() => applyGlobalPersonalization(client, store).catch(() => {}), 5000);
    setTimeout(() => applyGlobalPersonalization(client, store).catch(() => {}), 15000);
    
    // Start YouTube watcher (announces new uploads & live streams if env configured)
    try {
      startYouTubeWatcher(client);
      
      // Initialize WebSub service if enabled
      const enableWebSub = process.env.YT_ENABLE_WEBSUB === '1';
      if (enableWebSub) {
        try {
          const websubService = require('../services/youtube-websub');
          const websubInitialized = websubService.initializeWebSub(client);
          
          if (websubInitialized) {
            if (process.env.DEBUG_PERSONALIZATION === '1') {
                console.log('YouTube WebSub service initialized - real-time notifications enabled');
            }
          } else {
            console.warn('WebSub service failed to initialize - check WEBSUB_CALLBACK_BASE configuration');
          }
        } catch (error) {
          console.warn('Failed to initialize WebSub service:', error.message);
        }
      } else {
        console.log('YouTube WebSub disabled - using polling mode only');
      }
      
    } catch(e) { 
      console.warn('YouTube watcher failed to start', e.message); 
    }
    
    // Start Twitch watcher (announces live streams if env configured)
    try {
      startTwitchWatcher(client);
    } catch(e) { 
      console.warn('Twitch watcher failed to start', e.message); 
    }
    
    // Start COC watcher (announces clan activities if env configured)
    try {
      startCOCWatcher(client);
    } catch(e) { 
      console.warn('COC watcher failed to start', e.message); 
    }

    // Initialize leaderboard button interactions
    try {
      const leaderboardEvents = new LeaderboardEvents(client, store.sqlPool);
      // Attach to client so interactionCreate.js can access it
      client.leaderboardEvents = leaderboardEvents;
      console.log('✅ Leaderboard button interactions initialized');
    } catch(e) { 
      console.warn('Leaderboard events failed to initialize', e.message); 
    }
    
    // Set up daily stats reset (every 24 hours at midnight UTC)
    const scheduleStatsReset = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setUTCHours(24, 0, 0, 0); // Next midnight UTC
      
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      
      setTimeout(() => {
        store.resetDailyStats();
        // Schedule next reset
        setInterval(() => {
          store.resetDailyStats();
        }, 24 * 60 * 60 * 1000); // Every 24 hours
      }, msUntilMidnight);
      
      console.log(`[Analytics] Daily stats reset scheduled for ${nextMidnight.toISOString()}`);
    };
    
    scheduleStatsReset();
  });
}

// Personalization helpers
const personalizationRuntime = {
  lastAvatarHash: null,
  lastAvatarUpdateTs: 0,
  activityApplied: null
};

function hashString(str) {
  let h = 0, i, chr;
  if (!str) return 0;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    h = ((h << 5) - h) + chr;
    h |= 0;
  }
  return h;
}

async function applyGuildPersonalization(guildId, client, store) {
  try {
    const p = await store.getGuildPersonalization(guildId);
    const guild = client.guilds.cache.get(guildId);
    if (!guild || !p) return;

    // Nickname (guild specific)
    if (p.nickname !== undefined && p.nickname !== null) {
      try {
        if (guild.members.me && guild.members.me.nickname !== p.nickname) {
          await guild.members.me.setNickname(p.nickname).catch(() => {});
        }
      } catch {}
    }

    // Activity (global) – we just apply last saved one encountered
    if (p.activityType && p.activityText) {
      const typeMap = {
        PLAYING: ActivityType.Playing,
        LISTENING: ActivityType.Listening,
        WATCHING: ActivityType.Watching,
        COMPETING: ActivityType.Competing,
        STREAMING: ActivityType.Streaming
      };
      const mappedType = typeMap[p.activityType.toUpperCase()] ?? ActivityType.Playing;
      const key = `${mappedType}:${p.activityText}`;
      
      if (personalizationRuntime.activityApplied !== key) {
        try {
          await client.user.setActivity(p.activityText, { type: mappedType });
          personalizationRuntime.activityApplied = key;
        } catch(e) {
          console.warn('Set activity failed', e.message);
        }
      }
    }

    // Status (online/dnd/idle/invisible)
    if (p.status) {
      const valid = ['online', 'dnd', 'idle', 'invisible'];
      if (valid.includes(p.status)) {
        try {
          await client.user.setStatus(p.status);
        } catch(e) {
          console.warn('Set status failed', e.message);
        }
      }
    }

    // Avatar (global) – apply only if changed & not rate limited
    if (p.avatarBase64) {
      const b64 = p.avatarBase64.includes(',') ? 
        p.avatarBase64.split(',').pop() : p.avatarBase64;
      
      if (b64 && b64.length < 15_000_000) { // ~11MB raw -> 15MB b64
        const h = hashString(b64);
        const now = Date.now();
        const intervalMs = 10 * 60 * 1000; // 10 minutes
        
        if (h !== personalizationRuntime.lastAvatarHash && 
            (now - personalizationRuntime.lastAvatarUpdateTs) > intervalMs) {
          try {
            const buf = Buffer.from(b64, 'base64');
            if (buf.length <= 8_000_000) { // Discord hard limit 8MB
              await client.user.setAvatar(buf);
              personalizationRuntime.lastAvatarHash = h;
              personalizationRuntime.lastAvatarUpdateTs = now;
            } else {
              console.warn('Avatar too large, skipping apply');
            }
          } catch(e) {
            console.warn('Set avatar failed', e.message);
          }
        }
      }
    }
  } catch(e) { /* silent */ }
}

// Apply the most recent global personalization (activity/status/avatar) across all guilds
async function applyGlobalPersonalization(client, store) {
  if (!store.getAllGuildPersonalizations) return;
  
  try {
    const all = await store.getAllGuildPersonalizations();
    let latest = null;
    let latestTs = 0;
    
    for (const [gid, rec] of Object.entries(all)) {
      const hasGlobal = (rec.activityType && rec.activityText) || rec.status || rec.avatarBase64;
      if (!hasGlobal) continue;
      
      const ts = rec.updatedAt ? new Date(rec.updatedAt).getTime() : 0;
      if (ts >= latestTs) { 
        latestTs = ts; 
        latest = { guildId: gid, ...rec }; 
      }
    }
    
    if (!latest) {
      if (process.env.DEBUG_PERSONALIZATION === '1') {
          console.log('[GlobalPersonalization] No global fields found to apply');
      }
      return;
    }
    
    const p = latest;
    
    // Activity + status together for better reliability
    try {
      if (p.activityType && p.activityText) {
        const typeMap = { 
          PLAYING: ActivityType.Playing, 
          LISTENING: ActivityType.Listening, 
          WATCHING: ActivityType.Watching, 
          COMPETING: ActivityType.Competing, 
          STREAMING: ActivityType.Streaming 
        };
        const mappedType = typeMap[p.activityType.toUpperCase()] ?? ActivityType.Playing;
        client.user.setPresence({ 
          activities: [{ name: p.activityText, type: mappedType }], 
          status: p.status || 'online' 
        });
        personalizationRuntime.activityApplied = mappedType + ':' + p.activityText;
      } else if (p.status) {
        await client.user.setStatus(p.status);
      }
    } catch(e) { 
      console.warn('[GlobalPersonalization] presence/status failed', e.message); 
    }
    
    // Avatar (rate-limited) reuse existing logic
    if (p.avatarBase64) {
      try {
        const b64 = p.avatarBase64.includes(',') ? 
          p.avatarBase64.split(',').pop() : p.avatarBase64;
        
        if (b64) {
          const h = hashString(b64);
          const now = Date.now();
          const intervalMs = 10 * 60 * 1000;
          
          if (h !== personalizationRuntime.lastAvatarHash && 
              (now - personalizationRuntime.lastAvatarUpdateTs) > intervalMs) {
            const buf = Buffer.from(b64, 'base64');
            if (buf.length <= 8_000_000) {
              await client.user.setAvatar(buf);
              personalizationRuntime.lastAvatarHash = h;
              personalizationRuntime.lastAvatarUpdateTs = now;
            }
          }
        }
      } catch(e) { 
        console.warn('[GlobalPersonalization] avatar failed', e.message); 
      }
    }
  } catch(e) { 
    console.warn('[GlobalPersonalization] Failed to gather/apply', e.message); 
  }
}

module.exports = setupReadyHandler;
