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
  // Auto Responses Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS auto_responses (
    \`key\` VARCHAR(100) NOT NULL,
    pattern TEXT NOT NULL,
    flags VARCHAR(8) NOT NULL DEFAULT 'i',
    replies TEXT NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    raw_text TEXT DEFAULT NULL,
    match_type VARCHAR(20) DEFAULT 'contains',
    PRIMARY KEY (\`key\`),
    KEY auto_responses_match_type (match_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Command Toggles Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS command_toggles (
    command_name VARCHAR(64) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    created_by VARCHAR(64) DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    updated_by VARCHAR(64) DEFAULT NULL,
    PRIMARY KEY (command_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Global Profanity Dictionary Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS global_profanity_dictionary (
    id INT(11) NOT NULL AUTO_INCREMENT,
    word VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL,
    category VARCHAR(50) DEFAULT NULL,
    severity ENUM('low','medium','high','extreme') DEFAULT 'medium',
    alternatives TEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_word_lang (word, language),
    KEY idx_language (language),
    KEY idx_category (category),
    KEY idx_severity (severity)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Anti-Raid Logs Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_antiraid_logs (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    event_type ENUM('raid_detected','suspicious_member','legitimate_join','raid_action_taken') NOT NULL,
    user_id VARCHAR(32) DEFAULT NULL,
    user_tag VARCHAR(100) DEFAULT NULL,
    account_age_days INT(11) DEFAULT NULL,
    join_timestamp TIMESTAMP NULL DEFAULT NULL,
    raid_id VARCHAR(36) DEFAULT NULL,
    joins_in_window INT(11) DEFAULT NULL,
    young_account_ratio DECIMAL(3,2) DEFAULT NULL,
    action_type ENUM('kick','ban','mute','lockdown','alert_only','none','monitor') DEFAULT NULL,
    action_duration INT(11) DEFAULT NULL,
    moderator_id VARCHAR(32) DEFAULT NULL,
    join_source VARCHAR(50) DEFAULT NULL,
    verification_level_at_join TINYINT(4) DEFAULT NULL,
    member_count_at_join INT(11) DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    KEY idx_guild_event_type (guild_id, event_type),
    KEY idx_guild_created_at (guild_id, created_at),
    KEY idx_raid_id (raid_id),
    KEY idx_user_guild (user_id, guild_id),
    KEY idx_event_date (event_type, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Anti-Raid Settings Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_antiraid_settings (
    guild_id VARCHAR(32) NOT NULL,
    enabled TINYINT(1) DEFAULT 0,
    join_rate_limit INT(11) DEFAULT 5,
    join_rate_window INT(11) DEFAULT 60,
    account_age_limit INT(11) DEFAULT 7,
    auto_lockdown TINYINT(1) DEFAULT 0,
    auto_kick TINYINT(1) DEFAULT 0,
    lockdown_duration INT(11) DEFAULT 300,
    alert_channel_id VARCHAR(32) DEFAULT NULL,
    raid_action ENUM('mute','kick','ban','lockdown','none') DEFAULT 'mute',
    raid_action_duration INT(11) DEFAULT 5,
    raid_active TINYINT(1) DEFAULT 0,
    raid_started_at TIMESTAMP NULL DEFAULT NULL,
    delete_spam_invites TINYINT(1) DEFAULT 0,
    new_member_period INT(11) DEFAULT 30,
    whitelist_roles TEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Audit Logs Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_audit_logs (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    action_type ENUM('messageDelete','messageUpdate','messageBulkDelete','guildMemberAdd','guildMemberRemove','guildMemberUpdate','guildBanAdd','guildBanRemove','channelCreate','channelDelete','channelUpdate','roleCreate','roleDelete','roleUpdate','voiceStateUpdate','guildUpdate','emojiCreate','emojiDelete','emojiUpdate','webhookUpdate','guildIntegrationsUpdate','warn','kick','ban','mute','unmute') NOT NULL,
    user_id VARCHAR(32) DEFAULT NULL,
    moderator_id VARCHAR(32) DEFAULT NULL,
    target_id VARCHAR(32) DEFAULT NULL,
    channel_id VARCHAR(32) DEFAULT NULL,
    message_id VARCHAR(32) DEFAULT NULL,
    role_id VARCHAR(32) DEFAULT NULL,
    emoji_id VARCHAR(32) DEFAULT NULL,
    before_data TEXT DEFAULT NULL,
    after_data TEXT DEFAULT NULL,
    reason TEXT DEFAULT NULL,
    metadata LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    KEY idx_guild_type (guild_id, action_type),
    KEY idx_created (created_at),
    KEY idx_user (user_id),
    KEY idx_moderator (moderator_id),
    KEY idx_channel (channel_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Audit Logs Config Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_audit_logs_config (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    global_channel VARCHAR(32) DEFAULT NULL,
    message_channel VARCHAR(32) DEFAULT NULL,
    member_channel VARCHAR(32) DEFAULT NULL,
    channel_channel VARCHAR(32) DEFAULT NULL,
    role_channel VARCHAR(32) DEFAULT NULL,
    server_channel VARCHAR(32) DEFAULT NULL,
    voice_channel VARCHAR(32) DEFAULT NULL,
    include_bots TINYINT(1) DEFAULT 1,
    enhanced_details TINYINT(1) DEFAULT 1,
    enabled TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY guild_id (guild_id),
    KEY idx_guild_enabled (guild_id, enabled)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Automod Rules Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_automod_rules (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    trigger_type ENUM('spam','caps','links','invite_links','profanity','mention_spam') NOT NULL,
    action_type ENUM('delete','warn','mute','kick','ban') NOT NULL,
    message_action ENUM('keep','delete') DEFAULT 'keep',
    threshold_value INT(11) DEFAULT 5,
    duration INT(11) DEFAULT NULL,
    enabled TINYINT(1) DEFAULT 1,
    whitelist_channels TEXT DEFAULT NULL,
    whitelist_roles TEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    log_channel_id VARCHAR(32) DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_guild_enabled (guild_id, enabled)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Auto Responses Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_auto_responses (
    guild_id VARCHAR(32) NOT NULL,
    \`key\` VARCHAR(100) NOT NULL,
    pattern TEXT NOT NULL,
    flags VARCHAR(8) NOT NULL DEFAULT 'i',
    replies TEXT NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    raw_text TEXT NOT NULL,
    match_type VARCHAR(20) NOT NULL DEFAULT 'contains',
    PRIMARY KEY (guild_id, \`key\`),
    KEY guild_auto_responses_match_type (match_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Clash of Clans CWL Player Performance Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_clashofclans_cwl_player_performance (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    clan_tag VARCHAR(20) NOT NULL,
    season VARCHAR(7) NOT NULL,
    round_number INT(11) NOT NULL,
    player_tag VARCHAR(20) NOT NULL,
    player_name VARCHAR(255) DEFAULT NULL,
    townhall_level INT(11) DEFAULT NULL,
    map_position INT(11) DEFAULT NULL,
    attacks_used INT(11) DEFAULT 0,
    attacks_remaining INT(11) DEFAULT 0,
    stars_earned INT(11) DEFAULT 0,
    destruction_percentage DECIMAL(5,2) DEFAULT 0.00,
    target_position INT(11) DEFAULT NULL,
    target_tag VARCHAR(20) DEFAULT NULL,
    target_townhall_level INT(11) DEFAULT NULL,
    attack_order INT(11) DEFAULT NULL,
    is_best_attack TINYINT(1) DEFAULT 0,
    three_star TINYINT(1) DEFAULT 0,
    attack_time DATETIME DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_player_round (guild_id, clan_tag, season, round_number, player_tag),
    UNIQUE KEY unique_attack (guild_id, clan_tag, season, round_number, player_tag, attack_order),
    KEY idx_guild_clan_season (guild_id, clan_tag, season),
    KEY idx_player_performance (player_tag, season),
    KEY idx_round (season, round_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Clash of Clans CWL Round Standings Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_clashofclans_cwl_round_standings (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    clan_tag VARCHAR(20) NOT NULL,
    season VARCHAR(7) NOT NULL,
    round_number INT(11) NOT NULL,
    position INT(11) NOT NULL,
    stars_earned INT(11) DEFAULT 0,
    destruction_percentage DECIMAL(5,2) DEFAULT 0.00,
    wins INT(11) DEFAULT 0,
    losses INT(11) DEFAULT 0,
    ties INT(11) DEFAULT 0,
    opponent_tag VARCHAR(20) DEFAULT NULL,
    opponent_name VARCHAR(255) DEFAULT NULL,
    war_finalized TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_round (guild_id, clan_tag, season, round_number),
    KEY idx_guild_clan_season (guild_id, clan_tag, season),
    KEY idx_war_finalized (guild_id, clan_tag, season, round_number, war_finalized)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Clash of Clans CWL State Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_clashofclans_cwl_state (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    clan_tag VARCHAR(20) NOT NULL,
    season VARCHAR(7) NOT NULL,
    current_round INT(11) DEFAULT 0,
    total_rounds INT(11) DEFAULT 7,
    state ENUM('not_in_war','preparation','in_war','war_ended','season_ended') DEFAULT 'not_in_war',
    league_group_tag VARCHAR(50) DEFAULT NULL,
    last_updated TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    finalized_rounds JSON DEFAULT NULL,
    attack_reminders_sent JSON DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_cwl_state (guild_id, clan_tag, season),
    KEY idx_guild_clan (guild_id, clan_tag),
    KEY idx_state (state)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // Guild Clash of Clans Watch Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_clashofclans_watch (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    clan_tag VARCHAR(20) NOT NULL,
    clan_name VARCHAR(255) DEFAULT NULL,
    channel_id VARCHAR(32) NOT NULL,
    war_channel_id VARCHAR(32) DEFAULT NULL,
    cwl_channel_id VARCHAR(32) DEFAULT NULL,
    donation_channel_id VARCHAR(32) DEFAULT NULL,
    donation_leaderboard_channel_id VARCHAR(32) DEFAULT NULL,
    donation_leaderboard_message_id VARCHAR(32) DEFAULT NULL,
    donation_leaderboard_enabled TINYINT(1) DEFAULT 0,
    donation_leaderboard_last_reset TIMESTAMP NULL DEFAULT NULL,
    donation_leaderboard_reset_day TINYINT(4) DEFAULT 1,
    war_leaderboard_channel_id VARCHAR(32) DEFAULT NULL,
    war_leaderboard_schedule VARCHAR(20) DEFAULT 'weekly',
    track_donations TINYINT(1) DEFAULT 1,
    track_wars TINYINT(1) DEFAULT 1,
    track_cwl TINYINT(1) DEFAULT 1,
    track_achievements TINYINT(1) DEFAULT 0,
    last_war_check TIMESTAMP NULL DEFAULT NULL,
    last_cwl_check TIMESTAMP NULL DEFAULT NULL,
    war_current_state VARCHAR(20) DEFAULT NULL,
    war_opponent VARCHAR(255) DEFAULT NULL,
    war_start_time TIMESTAMP NULL DEFAULT NULL,
    war_end_time TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_guild_clan (guild_id, clan_tag),
    KEY idx_guild (guild_id),
    KEY idx_clan_tag (clan_tag),
    KEY idx_war_state (guild_id, clan_tag, war_current_state)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild CoC War Performance Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_coc_war_performance (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    clan_tag VARCHAR(20) NOT NULL,
    player_tag VARCHAR(20) NOT NULL,
    player_name VARCHAR(255) DEFAULT NULL,
    war_type ENUM('regular','cwl','friendly') DEFAULT 'regular',
    war_start_time TIMESTAMP NULL DEFAULT NULL,
    opponent_clan_tag VARCHAR(20) DEFAULT NULL,
    townhall_level INT(11) DEFAULT NULL,
    map_position INT(11) DEFAULT NULL,
    attacks_used INT(11) DEFAULT 0,
    stars_earned INT(11) DEFAULT 0,
    destruction_percentage DECIMAL(5,2) DEFAULT 0.00,
    defenses_faced INT(11) DEFAULT 0,
    stars_lost INT(11) DEFAULT 0,
    defense_destruction DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_war_player (guild_id, clan_tag, player_tag, war_start_time),
    KEY idx_guild_clan (guild_id, clan_tag),
    KEY idx_player (player_tag),
    KEY idx_war_type (war_type),
    KEY idx_war_start (war_start_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild CoC War Statistics Summary Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_coc_war_statistics_summary (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    clan_tag VARCHAR(20) NOT NULL,
    player_tag VARCHAR(20) NOT NULL,
    player_name VARCHAR(255) DEFAULT NULL,
    total_wars_participated INT(11) DEFAULT 0,
    total_attacks INT(11) DEFAULT 0,
    total_stars INT(11) DEFAULT 0,
    total_destruction DECIMAL(10,2) DEFAULT 0.00,
    average_stars DECIMAL(3,2) DEFAULT 0.00,
    average_destruction DECIMAL(5,2) DEFAULT 0.00,
    three_star_count INT(11) DEFAULT 0,
    last_updated TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_player_summary (guild_id, clan_tag, player_tag),
    KEY idx_guild_clan (guild_id, clan_tag),
    KEY idx_total_wars (total_wars_participated)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Command Logs Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_command_logs (
    id BIGINT(20) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) DEFAULT NULL,
    command_name VARCHAR(100) NOT NULL,
    command_category VARCHAR(50) DEFAULT NULL,
    command_type ENUM('slash','message','context') DEFAULT 'slash',
    options JSON DEFAULT NULL,
    status ENUM('success','error','cancelled') DEFAULT 'success',
    error_message TEXT DEFAULT NULL,
    response_time_ms INT(11) DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    executed_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    KEY idx_guild (guild_id),
    KEY idx_user (user_id),
    KEY idx_command (command_name),
    KEY idx_executed (executed_at),
    KEY idx_guild_command (guild_id, command_name),
    KEY idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // Guild Command Toggles Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_command_toggles (
    guild_id VARCHAR(32) NOT NULL,
    command_name VARCHAR(64) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id, command_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild AI Chat History Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_ai_chat_history (
    id BIGINT(20) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    role ENUM('user','assistant','system') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    KEY idx_guild_user (guild_id, user_id),
    KEY idx_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Genshin Watch Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_genshin_watch (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    uid VARCHAR(20) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    nickname VARCHAR(255) DEFAULT NULL,
    track_resin TINYINT(1) DEFAULT 1,
    track_dailies TINYINT(1) DEFAULT 1,
    track_events TINYINT(1) DEFAULT 1,
    resin_threshold INT(11) DEFAULT 140,
    last_check TIMESTAMP NULL DEFAULT NULL,
    player_data JSON DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_guild_user (guild_id, user_id),
    KEY idx_guild (guild_id),
    KEY idx_uid (uid)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Level Rewards Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_level_rewards (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    level INT(11) NOT NULL,
    role_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    KEY idx_guild_level (guild_id, level)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Moderation Features Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_moderation_features (
    guild_id VARCHAR(32) NOT NULL,
    feature_name VARCHAR(64) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id, feature_name),
    KEY idx_guild_enabled (guild_id, enabled)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Personalization Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_personalization (
    guild_id VARCHAR(32) NOT NULL,
    prefix VARCHAR(10) DEFAULT '!',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Profanity Patterns Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_profanity_patterns (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    pattern TEXT NOT NULL,
    flags VARCHAR(8) DEFAULT 'gi',
    severity ENUM('low','medium','high','extreme') DEFAULT 'medium',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    KEY idx_guild (guild_id),
    KEY idx_guild_severity (guild_id, severity)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Profanity Words Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_profanity_words (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    word VARCHAR(255) NOT NULL,
    severity ENUM('low','medium','high','extreme') DEFAULT 'medium',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_guild_word (guild_id, word),
    KEY idx_guild (guild_id),
    KEY idx_guild_severity (guild_id, severity)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Reaction Roles Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_reaction_roles (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    message_id VARCHAR(32) NOT NULL,
    emoji VARCHAR(100) NOT NULL,
    role_id VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    KEY idx_message (message_id),
    KEY idx_guild (guild_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Scheduled Messages Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_scheduled_messages (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    message TEXT NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    enabled TINYINT(1) DEFAULT 1,
    next_run TIMESTAMP NULL DEFAULT NULL,
    last_run TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    KEY idx_guild (guild_id),
    KEY idx_next_run (next_run)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Self Assignable Roles Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_self_assignable_roles (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    role_id VARCHAR(32) NOT NULL,
    category VARCHAR(100) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    allowed_roles JSON DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_guild_role (guild_id, role_id),
    KEY idx_guild (guild_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Settings Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id VARCHAR(32) NOT NULL,
    setting_key VARCHAR(64) NOT NULL,
    setting_value TEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Twitch Watch Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_twitch_watch (
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    twitch_username VARCHAR(100) NOT NULL,
    notification_message TEXT DEFAULT NULL,
    last_stream_id VARCHAR(100) DEFAULT NULL,
    is_live TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild User Levels Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_user_levels (
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    level INT(11) NOT NULL DEFAULT 1,
    xp INT(11) NOT NULL DEFAULT 0,
    last_message_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (guild_id, user_id),
    KEY idx_level (guild_id, level DESC)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild User Violations Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_user_violations (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    violation_type VARCHAR(50) NOT NULL,
    severity ENUM('low','medium','high','extreme') DEFAULT 'medium',
    rule_id INT(11) DEFAULT NULL,
    message_content TEXT DEFAULT NULL,
    channel_id VARCHAR(32) DEFAULT NULL,
    action_taken VARCHAR(50) DEFAULT NULL,
    moderator_id VARCHAR(32) DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    KEY idx_guild_user (guild_id, user_id),
    KEY idx_guild_type (guild_id, violation_type),
    KEY idx_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild User Warning Counts Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_user_warning_counts (
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    warning_count INT(11) NOT NULL DEFAULT 0,
    last_warning_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id, user_id),
    KEY idx_warning_count (warning_count DESC)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild User XP Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_user_xp (
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    total_xp INT(11) NOT NULL DEFAULT 0,
    message_count INT(11) NOT NULL DEFAULT 0,
    last_xp_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id, user_id),
    KEY idx_guild_xp (guild_id, total_xp DESC)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Valorant Watch Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_valorant_watch (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    riot_id VARCHAR(100) NOT NULL,
    riot_tag VARCHAR(10) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    track_matches TINYINT(1) DEFAULT 1,
    track_rank TINYINT(1) DEFAULT 1,
    track_achievements TINYINT(1) DEFAULT 0,
    last_match_id VARCHAR(100) DEFAULT NULL,
    last_rank VARCHAR(50) DEFAULT NULL,
    last_match_check TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_guild_user (guild_id, user_id),
    KEY idx_guild (guild_id),
    KEY idx_riot_id (riot_id, riot_tag),
    KEY idx_last_check (last_match_check)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // Guild Violation Appeals Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_violation_appeals (
    id INT(11) NOT NULL AUTO_INCREMENT,
    violation_id INT(11) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    appeal_reason TEXT NOT NULL,
    status ENUM('pending','approved','denied') DEFAULT 'pending',
    reviewed_by VARCHAR(32) DEFAULT NULL,
    reviewed_at TIMESTAMP NULL DEFAULT NULL,
    review_notes TEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    KEY idx_violation (violation_id),
    KEY idx_guild_status (guild_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Welcome Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_welcome (
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) DEFAULT NULL,
    enabled TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild Welcome Messages Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_welcome_messages (
    guild_id VARCHAR(32) NOT NULL,
    message TEXT DEFAULT NULL,
    embed_enabled TINYINT(1) DEFAULT 0,
    embed_color VARCHAR(10) DEFAULT NULL,
    embed_title VARCHAR(256) DEFAULT NULL,
    embed_description TEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild XP Level Rewards Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_xp_level_rewards (
    id INT(11) NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(32) NOT NULL,
    level INT(11) NOT NULL,
    role_id VARCHAR(32) NOT NULL,
    enabled TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_guild_level (guild_id, level),
    KEY idx_guild_rewards (guild_id, enabled)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild XP Settings Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_xp_settings (
    guild_id VARCHAR(32) NOT NULL,
    enabled TINYINT(1) DEFAULT 1,
    xp_per_message INT(11) DEFAULT 15,
    xp_cooldown INT(11) DEFAULT 60,
    level_up_channel VARCHAR(32) DEFAULT NULL,
    level_up_message TEXT DEFAULT NULL,
    role_multipliers JSON DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Guild YouTube Watch Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS guild_youtube_watch (
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    youtube_channel_id VARCHAR(100) NOT NULL,
    notification_message TEXT DEFAULT NULL,
    last_video_id VARCHAR(100) DEFAULT NULL,
    last_check TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (guild_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Master Profanity Patterns Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS m_profanity_patterns (
    id INT(11) NOT NULL AUTO_INCREMENT,
    pattern TEXT NOT NULL,
    flags VARCHAR(8) DEFAULT 'gi',
    severity ENUM('low','medium','high','extreme') DEFAULT 'medium',
    description TEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    KEY idx_severity (severity),
    KEY idx_flags (flags)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Master Profanity Words Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS m_profanity_words (
    id INT(11) NOT NULL AUTO_INCREMENT,
    word VARCHAR(255) NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    severity ENUM('low','medium','high','extreme') DEFAULT 'medium',
    category VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (id),
    UNIQUE KEY unique_word (word),
    KEY idx_severity (severity),
    KEY idx_word (word)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Master User Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS m_user (
    user_id VARCHAR(32) NOT NULL,
    username VARCHAR(100) DEFAULT NULL,
    discriminator VARCHAR(10) DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
    PRIMARY KEY (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // OAuth States Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS oauth_states (
    state VARCHAR(200) NOT NULL,
    user_id VARCHAR(32) DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(),
    expires_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (state),
    KEY idx_expires (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Settings Table
  await sqlPool.query(`CREATE TABLE IF NOT EXISTS settings (
    id TINYINT(4) NOT NULL DEFAULT 1,
    maintenance_mode TINYINT(1) DEFAULT 0,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

  // Command Analytics View
  await sqlPool.query(`CREATE OR REPLACE VIEW v_command_analytics AS
    SELECT 
      guild_id,
      command_name,
      command_category,
      COUNT(*) AS total_executions,
      COUNT(CASE WHEN status = 'success' THEN 1 END) AS successful_executions,
      COUNT(CASE WHEN status = 'error' THEN 1 END) AS failed_executions,
      AVG(response_time_ms) AS avg_response_time,
      MAX(executed_at) AS last_executed,
      COUNT(DISTINCT user_id) AS unique_users,
      CAST(executed_at AS DATE) AS execution_date
    FROM guild_command_logs
    WHERE executed_at >= CURRENT_TIMESTAMP() - INTERVAL 30 DAY
    GROUP BY guild_id, command_name, command_category, CAST(executed_at AS DATE)`);

  // CleanupCommandLogs Stored Procedure
  await sqlPool.query(`
    DROP PROCEDURE IF EXISTS CleanupCommandLogs;
  `);
  
  await sqlPool.query(`
    CREATE PROCEDURE CleanupCommandLogs()
    BEGIN
      CREATE TABLE IF NOT EXISTS guild_command_logs_archive LIKE guild_command_logs;
      
      INSERT INTO guild_command_logs_archive 
      SELECT * FROM guild_command_logs 
      WHERE executed_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
      
      DELETE FROM guild_command_logs 
      WHERE executed_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
      
      OPTIMIZE TABLE guild_command_logs;
    END
  `);
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
