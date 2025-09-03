// Database connection management for MongoDB and MariaDB
let mongooseAvailable = false;
let SettingModel = null;
let AutoResponseModel = null;

// MariaDB / MySQL support
let mariaAvailable = false;
let sqlPool = null; // mysql2/promise pool

async function initMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  
  try {
    const mongoose = require('mongoose');
    await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
    mongooseAvailable = true;
    
    const settingSchema = new mongoose.Schema({ 
      _id: { type: String, default: 'singleton' }, 
      autoReplyEnabled: Boolean, 
      autoReplyCooldownMs: Number 
    });
    SettingModel = mongoose.model('Setting', settingSchema);
    
    const autoResponseSchema = new mongoose.Schema({ 
      key: { type: String, unique: true }, 
      pattern: String, 
      flags: String, 
      replies: [mongoose.Schema.Types.Mixed] 
    });
    AutoResponseModel = mongoose.model('AutoResponse', autoResponseSchema);
    
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
      port: process.env.MARIADB_PORT ? parseInt(process.env.MARIADB_PORT, 10) : 3306,
      waitForConnections: true,
      connectionLimit: 5,
      namedPlaceholders: true
    });
    
    // Initialize all database tables
    await initializeTables();
    
    mariaAvailable = true;
    console.log('Config store: MariaDB initialized');
    return true;
  } catch (e) {
    console.error('MariaDB init failed, falling back to in-memory/seed:', e.message);
    mariaAvailable = false;
    return false;
  }
}

async function initializeTables() {
  // Create core tables
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS settings (
    id TINYINT PRIMARY KEY DEFAULT 1,
    auto_reply_enabled BOOLEAN NOT NULL DEFAULT 0,
    auto_reply_cooldown_ms INT NOT NULL DEFAULT 30000
  ) ENGINE=InnoDB`);

  await sqlPool.query(`CREATE TABLE IF NOT EXISTS auto_responses (
    \`key\` VARCHAR(100) PRIMARY KEY,
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

  // YouTube and Twitch watcher tables
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

  // User and OAuth tables
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS m_user (
    user_id VARCHAR(32) PRIMARY KEY,
    username VARCHAR(100),
    global_name VARCHAR(100),
    avatar VARCHAR(100),
    selected_guild_id VARCHAR(32) NULL,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);

  await sqlPool.query(`CREATE TABLE IF NOT EXISTS oauth_states (
    state VARCHAR(64) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    active BOOLEAN NOT NULL DEFAULT 1,
    INDEX idx_expires (expires_at),
    INDEX idx_active (active)
  ) ENGINE=InnoDB`);

  // Initialize moderation tables
  await initializeModerationTables();
}

async function initializeModerationTables() {
  // Welcome Messages
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_welcome_messages (
    guild_id VARCHAR(32) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT 0,
    channel_id VARCHAR(32) NULL,
    message_type ENUM('text', 'embed') NOT NULL DEFAULT 'text',
    message_text TEXT NULL,
    card_enabled BOOLEAN NOT NULL DEFAULT 0,
    role_id VARCHAR(32) NULL,
    dm_enabled BOOLEAN NOT NULL DEFAULT 0,
    dm_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);

  // Auto Moderation Rules
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_automod_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    trigger_type ENUM('spam', 'caps', 'links', 'invite_links', 'profanity', 'mention_spam') NOT NULL,
    action_type ENUM('delete', 'warn', 'mute', 'kick', 'ban') NOT NULL,
    threshold_value INT DEFAULT 5,
    duration INT NULL,
    enabled BOOLEAN DEFAULT 1,
    whitelist_channels TEXT NULL,
    whitelist_roles TEXT NULL,
    bypass_roles TEXT NULL,
    log_channel_id VARCHAR(32) NULL,
    auto_delete BOOLEAN DEFAULT 0,
    message_action ENUM('keep', 'delete') DEFAULT 'keep',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_guild_enabled (guild_id, enabled),
    INDEX idx_guild_message_action (guild_id, message_action)
  ) ENGINE=InnoDB`);

  // Reaction Roles
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_reaction_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    message_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    emoji VARCHAR(100) NOT NULL,
    role_id VARCHAR(32) NOT NULL,
    type ENUM('toggle', 'add_only', 'remove_only') DEFAULT 'toggle',
    custom_message TEXT NULL,
    title VARCHAR(255) NULL,
    status TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_message (message_id),
    INDEX idx_guild (guild_id)
  ) ENGINE=InnoDB`);

  // XP System tables
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_user_levels (
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    xp BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    messages_sent INT DEFAULT 0,
    voice_minutes INT DEFAULT 0,
    last_xp_gain TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id),
    INDEX idx_xp (guild_id, xp DESC),
    INDEX idx_level (guild_id, level DESC)
  ) ENGINE=InnoDB`);

  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_level_rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    level INT NOT NULL,
    reward_type ENUM('role', 'currency', 'badge') NOT NULL,
    reward_value VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_guild_level (guild_id, level)
  ) ENGINE=InnoDB`);

  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_xp_settings (
    guild_id VARCHAR(32) PRIMARY KEY,
    enabled BOOLEAN DEFAULT 0,
    xp_per_message INT DEFAULT 15,
    xp_per_voice_minute INT DEFAULT 5,
    cooldown_seconds INT DEFAULT 60,
    ignored_channels TEXT NULL,
    ignored_roles TEXT NULL,
    level_up_messages BOOLEAN DEFAULT 1,
    level_up_channel VARCHAR(32) NULL,
    double_xp_events TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);

  // Scheduled Messages
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_scheduled_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    name VARCHAR(200) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    message_content TEXT NOT NULL,
    embed_data TEXT NULL,
    schedule_type ENUM('once', 'daily', 'weekly', 'monthly', 'cron') NOT NULL,
    schedule_value VARCHAR(100) NOT NULL,
    next_run TIMESTAMP NULL,
    last_run TIMESTAMP NULL,
    enabled BOOLEAN DEFAULT 1,
    created_by VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_guild_enabled (guild_id, enabled),
    INDEX idx_next_run (next_run)
  ) ENGINE=InnoDB`);

  // Audit Logging
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    action_type ENUM('message_delete', 'message_edit', 'member_join', 'member_leave', 'role_update', 'channel_update', 'ban', 'kick', 'warn') NOT NULL,
    user_id VARCHAR(32) NULL,
    moderator_id VARCHAR(32) NULL,
    target_id VARCHAR(32) NULL,
    channel_id VARCHAR(32) NULL,
    reason TEXT NULL,
    metadata TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_guild_type (guild_id, action_type),
    INDEX idx_created (created_at)
  ) ENGINE=InnoDB`);

  // Anti-Raid Settings
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_antiraid_settings (
    guild_id VARCHAR(32) PRIMARY KEY,
    enabled BOOLEAN DEFAULT 0,
    join_rate_limit INT DEFAULT 5,
    join_rate_window INT DEFAULT 60,
    account_age_limit INT DEFAULT 7,
    auto_lockdown BOOLEAN DEFAULT 0,
    lockdown_duration INT DEFAULT 300,
    alert_channel_id VARCHAR(32) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);

  // Moderation Features Toggle
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_moderation_features (
    guild_id VARCHAR(32) NOT NULL,
    feature_key VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT 0,
    config TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, feature_key),
    INDEX idx_guild_enabled (guild_id, enabled)
  ) ENGINE=InnoDB`);

  // Self-Assignable Roles
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_self_assignable_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    command_name VARCHAR(64) NOT NULL,
    description TEXT NULL,
    channel_id VARCHAR(32) NULL,
    role_id VARCHAR(32) NOT NULL,
    role_type ENUM('toggle', 'add_only', 'remove_only') DEFAULT 'toggle',
    require_permission BOOLEAN DEFAULT 0,
    allowed_roles TEXT NULL,
    status TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(32) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(32) NULL,
    INDEX idx_guild_command (guild_id, command_name),
    INDEX idx_guild_status (guild_id, status)
  ) ENGINE=InnoDB`);

  // Profanity Detection Tables
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_profanity_words (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    word VARCHAR(255) NOT NULL,
    severity ENUM('low', 'medium', 'high', 'extreme') DEFAULT 'medium',
    language VARCHAR(10) DEFAULT 'en',
    case_sensitive BOOLEAN DEFAULT FALSE,
    whole_word_only BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(32) NULL,
    INDEX idx_guild_enabled (guild_id, enabled),
    INDEX idx_guild_severity (guild_id, severity),
    UNIQUE KEY unique_guild_word (guild_id, word)
  ) ENGINE=InnoDB`);

  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_profanity_patterns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    pattern TEXT NOT NULL,
    description VARCHAR(255) NULL,
    severity ENUM('low', 'medium', 'high', 'extreme') DEFAULT 'medium',
    flags VARCHAR(10) DEFAULT 'gi',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(32) NULL,
    INDEX idx_guild_enabled (guild_id, enabled),
    INDEX idx_guild_severity (guild_id, severity)
  ) ENGINE=InnoDB`);

  await sqlPool.query(`CREATE TABLE IF NOT EXISTS global_profanity_dictionary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    word VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL,
    category VARCHAR(50) NULL,
    severity ENUM('low', 'medium', 'high', 'extreme') DEFAULT 'medium',
    alternatives TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_language (language),
    INDEX idx_category (category),
    INDEX idx_severity (severity),
    UNIQUE KEY unique_word_lang (word, language)
  ) ENGINE=InnoDB`);

  // User Violations and Warning System Tables
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_user_violations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    rule_id INT NULL,
    rule_type ENUM('spam', 'caps', 'links', 'invite_links', 'profanity', 'mention_spam') NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    violation_reason TEXT NOT NULL,
    message_content TEXT NULL,
    channel_id VARCHAR(32) NOT NULL,
    message_id VARCHAR(32) NULL,
    action_taken ENUM('warn', 'mute', 'kick', 'ban', 'delete') NOT NULL,
    warning_increment INT DEFAULT 1,
    total_warnings_at_time INT DEFAULT 1,
    threshold_at_time INT DEFAULT 3,
    moderator_id VARCHAR(32) NULL,
    is_auto_mod BOOLEAN DEFAULT 1,
    severity ENUM('low', 'medium', 'high', 'extreme') DEFAULT 'medium',
    metadata JSON NULL,
    expires_at TIMESTAMP NULL,
    status ENUM('active', 'expired', 'pardoned', 'appealed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_guild_user (guild_id, user_id),
    INDEX idx_guild_rule_type (guild_id, rule_type),
    INDEX idx_user_rule_type (user_id, rule_type),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status),
    INDEX idx_auto_mod (is_auto_mod),
    INDEX idx_expires (expires_at)
  ) ENGINE=InnoDB`);

  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_user_warning_counts (
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    rule_type ENUM('spam', 'caps', 'links', 'invite_links', 'profanity', 'mention_spam') NOT NULL,
    warning_count INT DEFAULT 0,
    last_violation_at TIMESTAMP NULL,
    last_reset_at TIMESTAMP NULL,
    total_violations INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id, rule_type),
    INDEX idx_guild_user (guild_id, user_id),
    INDEX idx_last_violation (last_violation_at),
    INDEX idx_warning_count (warning_count DESC)
  ) ENGINE=InnoDB`);

  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_violation_appeals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    violation_id INT NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    appeal_reason TEXT NOT NULL,
    appeal_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reviewed_by VARCHAR(32) NULL,
    reviewer_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_guild_user (guild_id, user_id),
    INDEX idx_status (appeal_status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (violation_id) REFERENCES guild_user_violations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
}

async function initPersistence() {
  // Prefer MariaDB if configured, else Mongo, else in-memory
  if (process.env.MARIADB_HOST) {
    const ok = await initMaria();
    if (ok) return 'mariadb';
  }
  if (process.env.MONGODB_URI) {
    const ok = await initMongo();
    if (ok) return 'mongo';
  }
  return 'memory';
}

module.exports = {
  initMongo,
  initMaria,
  initPersistence,
  get mongooseAvailable() { return mongooseAvailable; },
  get SettingModel() { return SettingModel; },
  get AutoResponseModel() { return AutoResponseModel; },
  get mariaAvailable() { return mariaAvailable; },
  get sqlPool() { return sqlPool; }
};
