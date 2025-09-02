// In-memory cache management for all guild and global data

// Global caches
let settings = {};
let autoResponses = [];
let commandToggles = {}; // name -> meta

// Guild scoped caches
const guildSettingsCache = new Map(); // guildId -> settings
const guildAutoResponsesCache = new Map(); // guildId -> auto responses
const guildPersonalizationCache = new Map(); // guildId -> personalization
const guildWelcomeCache = new Map(); // guildId -> welcome config
const guildYouTubeConfigCache = new Map(); // guildId -> youtube config
const guildTwitchConfigCache = new Map(); // guildId -> twitch config
const guildCommandToggles = new Map(); // guildId -> { name -> meta }

// Moderation caches
const guildModerationFeaturesCache = new Map(); // guildId -> feature states
const guildAutoModRulesCache = new Map(); // guildId -> automod rules array
const guildReactionRolesCache = new Map(); // guildId -> reaction roles array
const guildXpSettingsCache = new Map(); // guildId -> xp settings
const guildScheduledMessagesCache = new Map(); // guildId -> scheduled messages array
const guildAntiRaidSettingsCache = new Map(); // guildId -> anti-raid settings

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

// Lazy detection flags
let youtubeHasConfigJsonColumn = null;
let twitchHasConfigJsonColumn = null;

// Cache management functions
function getCache() {
  return {
    // Global caches
    settings,
    autoResponses,
    commandToggles,
    
    // Guild caches
    guildSettingsCache,
    guildAutoResponsesCache,
    guildPersonalizationCache,
    guildWelcomeCache,
    guildYouTubeConfigCache,
    guildTwitchConfigCache,
    guildCommandToggles,
    
    // Moderation caches
    guildModerationFeaturesCache,
    guildAutoModRulesCache,
    guildReactionRolesCache,
    guildXpSettingsCache,
    guildScheduledMessagesCache,
    guildAntiRaidSettingsCache,
    
    // Analytics
    commandUsageStats,
    activityLog,
    errorLog,
    systemStats,
    cachedSystemMetrics,
    lastMetricsUpdate,
    
    // Flags
    youtubeHasConfigJsonColumn,
    twitchHasConfigJsonColumn
  };
}

function setSettings(newSettings) {
  settings = newSettings;
}

function setAutoResponses(newAutoResponses) {
  autoResponses = newAutoResponses;
}

function setCommandToggles(newCommandToggles) {
  commandToggles = newCommandToggles;
}

function setYoutubeConfigFlag(flag) {
  youtubeHasConfigJsonColumn = flag;
}

function setTwitchConfigFlag(flag) {
  twitchHasConfigJsonColumn = flag;
}

function setCachedSystemMetrics(metrics) {
  cachedSystemMetrics = metrics;
  lastMetricsUpdate = Date.now();
}

function resetDailyStats() {
  systemStats.commandsToday = 0;
  commandUsageStats.clear();
  console.log('Daily stats reset');
}

// Cache invalidation functions
function invalidateGuildCache(guildId) {
  guildSettingsCache.delete(guildId);
  guildAutoResponsesCache.delete(guildId);
  guildPersonalizationCache.delete(guildId);
  guildWelcomeCache.delete(guildId);
  guildYouTubeConfigCache.delete(guildId);
  guildTwitchConfigCache.delete(guildId);
  guildCommandToggles.delete(guildId);
  guildModerationFeaturesCache.delete(guildId);
  guildAutoModRulesCache.delete(guildId);
  guildReactionRolesCache.delete(guildId);
  guildXpSettingsCache.delete(guildId);
  guildScheduledMessagesCache.delete(guildId);
  guildAntiRaidSettingsCache.delete(guildId);
}

function invalidateGuildPersonalization(guildId) {
  if (guildId) guildPersonalizationCache.delete(guildId);
}

function invalidateGuildYouTubeConfig(guildId) {
  guildYouTubeConfigCache.delete(guildId);
}

function invalidateGuildTwitchConfig(guildId) {
  guildTwitchConfigCache.delete(guildId);
}

module.exports = {
  getCache,
  setSettings,
  setAutoResponses,
  setCommandToggles,
  setYoutubeConfigFlag,
  setTwitchConfigFlag,
  setCachedSystemMetrics,
  resetDailyStats,
  invalidateGuildCache,
  invalidateGuildPersonalization,
  invalidateGuildYouTubeConfig,
  invalidateGuildTwitchConfig
};
