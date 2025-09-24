// Main store module - coordinates all services and maintains backward compatibility
const db = require('./database/connection');
const cache = require('./cache/manager');
const { defaultConfigs, seedSettings } = require('./models/defaults');

// Import all services
const settingsService = require('./services/settings');
const autoResponsesService = require('./services/autoResponses');
const analyticsService = require('./services/analytics');
const usersService = require('./services/users');
const commandsService = require('./services/commands');

// Additional services that need to be created for full compatibility
const personalizationService = require('./services/personalization');
const youtubeService = require('./services/youtube');
const twitchService = require('./services/twitch');
const clashofclansService = require('./services/clashofclans-updated');
const genshinService = require('./services/genshin');
const moderationService = require('./services/moderation');

async function initPersistence() {
  const result = await db.initPersistence();
  
  // Initialize data after database connection
  if (result === 'mariadb' || result === 'mongo') {
    await loadInitialData();
  } else {
    // Memory fallback - initialize with defaults
    cache.setSettings({ ...seedSettings });
    autoResponsesService.initializeAutoResponses();
  }
  
  return result;
}

async function initializeGuildSettings(guildId) {
  try {
    if (!guildId) return;
    
    if (db.mariaAvailable && db.sqlPool) {
      // Initialize guild_settings if not exists
      await db.sqlPool.query(`
        INSERT IGNORE INTO guild_settings (guild_id) VALUES (?)
      `, [guildId]);
      
      // Initialize guild_xp_settings if not exists
      await db.sqlPool.query(`
        INSERT IGNORE INTO guild_xp_settings (guild_id, enabled, xp_per_message, xp_per_voice_minute, cooldown_seconds, level_up_messages) 
        VALUES (?, 0, 15, 5, 60, 1)
      `, [guildId]);
      
      console.log(`Initialized settings for guild: ${guildId}`);
    }
  } catch (error) {
    console.error(`Failed to initialize guild settings for ${guildId}:`, error);
  }
}

async function loadInitialData() {
  try {
    // Load global settings
    if (db.mongooseAvailable && db.SettingModel) {
      let doc = await db.SettingModel.findById('singleton');
      if (!doc) {
        doc = await new db.SettingModel(seedSettings).save();
      }
      cache.setSettings({
        autoReplyEnabled: !!doc.autoReplyEnabled,
        autoReplyCooldownMs: doc.autoReplyCooldownMs
      });
    } else if (db.mariaAvailable && db.sqlPool) {
      const [rows] = await db.sqlPool.query('SELECT auto_reply_enabled, auto_reply_cooldown_ms FROM settings WHERE id=1');
      if (rows.length === 0) {
        await db.sqlPool.query(
          'INSERT INTO settings(id, auto_reply_enabled, auto_reply_cooldown_ms) VALUES (1,?,?)',
          [seedSettings.autoReplyEnabled ? 1 : 0, seedSettings.autoReplyCooldownMs]
        );
        cache.setSettings({ ...seedSettings });
      } else {
        cache.setSettings({
          autoReplyEnabled: !!rows[0].auto_reply_enabled,
          autoReplyCooldownMs: rows[0].auto_reply_cooldown_ms
        });
      }
    }
    
    // Load auto responses
    if (db.mongooseAvailable && db.AutoResponseModel) {
      const count = await db.AutoResponseModel.countDocuments();
      if (count === 0) {
        autoResponsesService.initializeAutoResponses();
        const responses = autoResponsesService.getAutoResponses();
        if (responses.length) {
          await db.AutoResponseModel.insertMany(responses);
        }
      } else {
        const docs = await db.AutoResponseModel.find();
        const responses = docs.map(d => ({
          key: d.key,
          pattern: d.pattern,
          flags: d.flags,
          replies: d.replies
        }));
        cache.setAutoResponses(responses);
      }
    } else if (db.mariaAvailable && db.sqlPool) {
      const [arCountRows] = await db.sqlPool.query('SELECT COUNT(*) as c FROM auto_responses');
      if (arCountRows[0].c === 0) {
        autoResponsesService.initializeAutoResponses();
        const responses = autoResponsesService.getAutoResponses();
        if (responses.length) {
          for (const ar of responses) {
            await db.sqlPool.query(
              'INSERT INTO auto_responses(`key`, pattern, flags, replies, enabled) VALUES (?,?,?,?,?)',
              [ar.key, ar.pattern, ar.flags, JSON.stringify(ar.replies || []), ar.enabled !== false ? 1 : 0]
            );
          }
        }
      } else {
        const [arRows] = await db.sqlPool.query('SELECT `key`, pattern, flags, replies, enabled FROM auto_responses');
        const responses = arRows.map(r => ({
          key: r.key,
          pattern: r.pattern,
          flags: r.flags,
          replies: JSON.parse(r.replies || '[]'),
          enabled: r.enabled !== 0
        }));
        cache.setAutoResponses(responses);
      }
    }
    
    // Load command toggles
    await commandsService.loadCommandToggles();
    
  } catch (e) {
    console.error('Error loading initial data:', e.message);
    // Fallback to defaults
    cache.setSettings({ ...seedSettings });
    autoResponsesService.initializeAutoResponses();
  }
}

// Export unified API that maintains backward compatibility
module.exports = {
  // Initialization
  initMongo: db.initMongo, // kept for backward compatibility
  initMaria: db.initMaria,
  initPersistence,
  initializeGuildSettings,
  
  // Settings API
  getSettings: settingsService.getSettings,
  setSettings: settingsService.setSettings,
  getGuildSettings: settingsService.getGuildSettings,
  setGuildSettings: settingsService.setGuildSettings,
  
  // Auto Responses API
  getAutoResponses: autoResponsesService.getAutoResponses,
  getCompiledAutoResponses: autoResponsesService.getCompiledAutoResponses,
  getGuildAutoResponses: autoResponsesService.getGuildAutoResponses,
  getCompiledGuildAutoResponses: autoResponsesService.getCompiledGuildAutoResponses,
  upsertAutoResponse: autoResponsesService.upsertAutoResponse,
  upsertGuildAutoResponse: autoResponsesService.upsertGuildAutoResponse,
  removeAutoResponse: autoResponsesService.removeAutoResponse,
  removeGuildAutoResponse: autoResponsesService.removeGuildAutoResponse,
  
  // User API
  upsertUser: usersService.upsertUser,
  setUserSelectedGuild: usersService.setUserSelectedGuild,
  getUser: usersService.getUser,
  
  // Command Toggles API
  getCommandToggles: commandsService.getCommandToggles,
  getAllCommandToggles: commandsService.getAllCommandToggles,
  setCommandToggle: commandsService.setCommandToggle,
  getGuildCommandToggles: commandsService.getGuildCommandToggles,
  getAllGuildCommandToggles: commandsService.getAllGuildCommandToggles,
  setGuildCommandToggle: commandsService.setGuildCommandToggle,
  
  // Analytics API
  trackCommandUsage: analyticsService.trackCommandUsage,
  trackAutoResponse: analyticsService.trackAutoResponse,
  trackError: analyticsService.trackError,
  trackApiResponse: analyticsService.trackApiResponse,
  getSystemMetrics: analyticsService.getSystemMetrics,
  getTopCommands: analyticsService.getTopCommands,
  getRecentActivity: analyticsService.getRecentActivity,
  getBotStats: analyticsService.getBotStats,
  resetDailyStats: analyticsService.resetDailyStats,
  
  // Personalization API
  getGuildPersonalization: personalizationService.getGuildPersonalization,
  getGuildPersonalizationFresh: personalizationService.getGuildPersonalizationFresh,
  getAllGuildPersonalizations: personalizationService.getAllGuildPersonalizations,
  invalidateGuildPersonalization: cache.invalidateGuildPersonalization,
  setGuildPersonalization: personalizationService.setGuildPersonalization,
  
  // Welcome API
  getGuildWelcome: personalizationService.getGuildWelcome,
  setGuildWelcome: personalizationService.setGuildWelcome,
  
  // YouTube API
  getGuildYouTubeConfig: youtubeService.getGuildYouTubeConfig,
  setGuildYouTubeConfig: youtubeService.setGuildYouTubeConfig,
  invalidateGuildYouTubeConfig: cache.invalidateGuildYouTubeConfig,
  
  // Twitch API
  getGuildTwitchConfig: twitchService.getGuildTwitchConfig,
  setGuildTwitchConfig: twitchService.setGuildTwitchConfig,
  invalidateGuildTwitchConfig: cache.invalidateGuildTwitchConfig,
  
  // Clash of Clans API
  getGuildClashOfClansConfig: clashofclansService.getGuildClashOfClansConfig,
  setGuildClashOfClansConfig: clashofclansService.setGuildClashOfClansConfig,
  
  // Genshin Impact API
  getGuildGenshinConfig: genshinService.getGuildGenshinConfig,
  updateGuildGenshinConfig: genshinService.updateGuildGenshinConfig,
  
  // Moderation API
  getModerationFeatures: moderationService.getModerationFeatures,
  toggleModerationFeature: moderationService.toggleModerationFeature,
  updateModerationFeatureConfig: moderationService.updateModerationFeatureConfig,
  getGuildAutoModRules: moderationService.getGuildAutoModRules,
  createGuildAutoModRule: moderationService.createGuildAutoModRule,
  updateGuildAutoModRule: moderationService.updateGuildAutoModRule,
  deleteGuildAutoModRule: moderationService.deleteGuildAutoModRule,
  toggleGuildAutoModRule: moderationService.toggleGuildAutoModRule,
  getGuildXpSettings: moderationService.getGuildXpSettings,
  updateGuildXpSettings: moderationService.updateGuildXpSettings,
  getGuildReactionRoles: moderationService.getGuildReactionRoles,
  addGuildReactionRole: moderationService.addGuildReactionRole,
  removeGuildReactionRolesByMessage: moderationService.removeGuildReactionRolesByMessage,
  updateGuildReactionRole: moderationService.updateGuildReactionRole,
  updateGuildReactionRoleStatus: moderationService.updateGuildReactionRoleStatus,
  deleteGuildReactionRole: moderationService.deleteGuildReactionRole,
  deleteGuildReactionRoleByMessageId: moderationService.deleteGuildReactionRoleByMessageId,
  getGuildAntiRaidSettings: moderationService.getGuildAntiRaidSettings,
  updateGuildAntiRaidSettings: moderationService.updateGuildAntiRaidSettings,
  getGuildScheduledMessages: moderationService.getGuildScheduledMessages,
  createGuildScheduledMessage: moderationService.createGuildScheduledMessage,
  updateGuildScheduledMessage: moderationService.updateGuildScheduledMessage,
  deleteGuildScheduledMessage: moderationService.deleteGuildScheduledMessage,
  
  // Audit Logging API
  getGuildAuditLogConfig: moderationService.getGuildAuditLogConfig,
  updateGuildAuditLogConfig: moderationService.updateGuildAuditLogConfig,
  getGuildAuditLogs: moderationService.getGuildAuditLogs,
  createAuditLogEntry: moderationService.createAuditLogEntry,
  deleteAuditLogEntry: moderationService.deleteAuditLogEntry,
  
  // Anti-Raid Logging API
  insertAntiRaidLog: moderationService.insertAntiRaidLog,
  
  // Self-Assignable Roles API
  getGuildSelfAssignableRoles: moderationService.getGuildSelfAssignableRoles,
  addGuildSelfAssignableRole: moderationService.addGuildSelfAssignableRole,
  updateGuildSelfAssignableRole: moderationService.updateGuildSelfAssignableRole,
  deleteGuildSelfAssignableRole: moderationService.deleteGuildSelfAssignableRole,
  toggleGuildSelfAssignableRoleStatus: moderationService.toggleGuildSelfAssignableRoleStatus,
  getGuildSelfAssignableRoleByCommand: moderationService.getGuildSelfAssignableRoleByCommand,
  
  // Profanity Management API
  getGuildProfanityWords: moderationService.getGuildProfanityWords,
  addGuildProfanityWord: moderationService.addGuildProfanityWord,
  updateGuildProfanityWord: moderationService.updateGuildProfanityWord,
  deleteGuildProfanityWord: moderationService.deleteGuildProfanityWord,
  getGuildProfanityPatterns: moderationService.getGuildProfanityPatterns,
  addGuildProfanityPattern: moderationService.addGuildProfanityPattern,
  updateGuildProfanityPattern: moderationService.updateGuildProfanityPattern,
  deleteGuildProfanityPattern: moderationService.deleteGuildProfanityPattern,
  
  // Violation Management API
  recordViolation: moderationService.recordViolation,
  getWarningCount: moderationService.getWarningCount,
  incrementWarningCount: moderationService.incrementWarningCount,
  resetWarningCount: moderationService.resetWarningCount,
  getUserViolations: moderationService.getUserViolations,
  getGuildViolations: moderationService.getGuildViolations,
  
  // XP Management API
  getUserXp: moderationService.getUserXp,
  addUserXp: moderationService.addUserXp,
  updateUserXp: moderationService.updateUserXp,
  setUserXp: moderationService.setUserXp,
  resetUserXp: moderationService.resetUserXp,
  getUserLeaderboard: moderationService.getGuildLeaderboard,
  getUserRank: moderationService.getUserRank,
  getUserLevel: moderationService.getUserLevel,
  getXpForLevel: moderationService.getXpForLevel,
  getGuildLevelRewards: moderationService.getGuildLevelRewards,
  addGuildLevelReward: moderationService.addGuildLevelReward,
  removeGuildLevelReward: moderationService.removeGuildLevelReward,
  
  // Direct database access for special cases
  get sqlPool() { return db.sqlPool; }
};
