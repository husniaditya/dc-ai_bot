// Application Constants
const APP_CONFIG = {
  DASHBOARD_PORT: process.env.DASHBOARD_PORT || 3001,
  JWT_SECRET: process.env.DASHBOARD_JWT_SECRET || 'changeme_dev_secret',
  
  // Admin credentials (legacy)
  ADMIN_USER: process.env.DASHBOARD_ADMIN_USER || 'admin',
  ADMIN_PASS: process.env.DASHBOARD_ADMIN_PASS || 'password',
  
  // Rate limiting
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.DASHBOARD_RATE_WINDOW_MS || '60000', 10),
    MAX_REQUESTS: parseInt(process.env.DASHBOARD_RATE_MAX || '120', 10)
  },
  
  // CORS settings
  CORS: {
    ORIGINS: process.env.DASHBOARD_CORS_ORIGINS || '',
    ALLOW_ALL: process.env.DASHBOARD_CORS_ALLOW_ALL === '1'
  }
};

// Discord OAuth Configuration
const OAUTH_CONFIG = {
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  REDIRECT_URI: process.env.DASHBOARD_OAUTH_REDIRECT,
  SCOPES: ['identify', 'guilds']
};

// External API Configuration
const API_CONFIG = {
  YOUTUBE: {
    API_KEY: process.env.YOUTUBE_API_KEY,
    DEBUG: process.env.YT_DEBUG === '1'
  },
  
  TWITCH: {
    CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET
  },
  
  GEMINI: {
    API_KEY: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
  }
};

// Feature flags
const FEATURES = {
  AUTOREPLY_ENABLED: process.env.AUTOREPLY_ENABLED === '1',
  ENABLE_MESSAGE_CONTENT: process.env.ENABLE_MESSAGE_CONTENT !== '0',
  ENABLE_GUILD_MEMBERS: process.env.ENABLE_GUILD_MEMBERS === '1',
  ENABLE_WELCOME: process.env.ENABLE_WELCOME === '1',
  DISABLE_LEGACY_LOGIN: process.env.DISABLE_LEGACY_LOGIN === '1',
  SUMMARY_NUMBER_SECTIONS: process.env.SUMMARY_NUMBER_SECTIONS === '1'
};

module.exports = {
  APP_CONFIG,
  OAUTH_CONFIG,
  API_CONFIG,
  FEATURES
};
