// Moderation features with their configurations
export const MODERATION_FEATURES = [
  {
    key: 'welcome',
    label: 'Welcome Messages',
    labelKey: 'moderation.cards.welcome.label',
    icon: 'fa-door-open',
    color: '#10b981',
    desc: 'Greet new members with customizable welcome messages and cards.',
    descKey: 'moderation.cards.welcome.desc',
    features: ['Custom Messages', 'Welcome Cards', 'Role Assignment', 'Channel Selection'],
    featuresKeys: [
      'moderation.cards.welcome.features.customMessages',
      'moderation.cards.welcome.features.welcomeCards',
      'moderation.cards.welcome.features.roleAssignment',
      'moderation.cards.welcome.features.channelSelection'
    ]
  },
  {
    key: 'automod',
    label: 'Auto Moderation',
    labelKey: 'moderation.cards.automod.label',
    icon: 'fa-robot',
    color: '#dc2626',
    desc: 'Automatically detect and handle spam, excessive caps, and inappropriate content.',
    descKey: 'moderation.cards.automod.desc',
    features: ['Spam Detection', 'Caps Lock Filter', 'Link Filtering', 'Profanity Filter'],
    featuresKeys: [
      'moderation.cards.automod.features.spamDetection',
      'moderation.cards.automod.features.capsLockFilter',
      'moderation.cards.automod.features.linkFiltering',
      'moderation.cards.automod.features.profanityFilter'
    ]
  },
  {
    key: 'roles',
    label: 'Role Management',
    labelKey: 'moderation.cards.roles.label',
    icon: 'fa-users-gear',
    color: '#8b5cf6',
    desc: 'Manage roles with reaction roles and role menus.',
    descKey: 'moderation.cards.roles.desc',
    features: ['Reaction Roles', 'Role Menus', 'Permission Sync', 'Custom Messages'],
    featuresKeys: [
      'moderation.cards.roles.features.reactionRoles',
      'moderation.cards.roles.features.roleMenus',
      'moderation.cards.roles.features.permissionSync',
      'moderation.cards.roles.features.customMessages'
    ]
  },
  {
    key: 'xp',
    label: 'XP & Leveling',
    labelKey: 'moderation.cards.xp.label',
    icon: 'fa-chart-line',
    color: '#06b6d4',
    desc: 'Reward active members with XP points and level progression.',
    descKey: 'moderation.cards.xp.desc',
    features: ['XP Tracking', 'Level Rewards', 'Leaderboards', 'Custom Multipliers'],
    featuresKeys: [
      'moderation.cards.xp.features.xpTracking',
      'moderation.cards.xp.features.levelRewards',
      'moderation.cards.xp.features.leaderboards',
      'moderation.cards.xp.features.customMultipliers'
    ]
  },
  {
    key: 'scheduler',
    label: 'Scheduled Messages',
    labelKey: 'moderation.cards.scheduler.label',
    icon: 'fa-calendar-days',
    color: '#3b82f6',
    desc: 'Schedule announcements and recurring messages for your server.',
    descKey: 'moderation.cards.scheduler.desc',
    features: ['Scheduled Posts', 'Recurring Messages', 'Event Reminders', 'Auto Announcements'],
    featuresKeys: [
      'moderation.cards.scheduler.features.scheduledPosts',
      'moderation.cards.scheduler.features.recurringMessages',
      'moderation.cards.scheduler.features.eventReminders',
      'moderation.cards.scheduler.features.autoAnnouncements'
    ]
  },
  {
    key: 'logging',
    label: 'Audit Logging',
    labelKey: 'moderation.cards.logging.label',
    icon: 'fa-clipboard-list',
    color: '#f97316',
    desc: 'Track all moderation actions and server changes.',
    descKey: 'moderation.cards.logging.desc',
    features: ['Message Logs', 'Member Logs', 'Channel Logs', 'Role Logs'],
    featuresKeys: [
      'moderation.cards.logging.features.messageLogs',
      'moderation.cards.logging.features.memberLogs',
      'moderation.cards.logging.features.channelLogs',
      'moderation.cards.logging.features.roleLogs'
    ]
  },
  {
    key: 'antiraid',
    label: 'Anti-Raid Protection',
    labelKey: 'moderation.cards.antiraid.label',
    icon: 'fa-shield',
    color: '#ef4444',
    desc: 'Protect your server from raids and mass join attacks.',
    descKey: 'moderation.cards.antiraid.desc',
    features: ['Join Rate Limiting', 'Account Age Filter', 'Auto Lockdown', 'Verification System'],
    featuresKeys: [
      'moderation.cards.antiraid.features.joinRateLimiting',
      'moderation.cards.antiraid.features.accountAgeFilter',
      'moderation.cards.antiraid.features.autoLockdown',
      'moderation.cards.antiraid.features.verificationSystem'
    ]
  }
];

// Feature configuration defaults
export const FEATURE_DEFAULTS = {
  welcome: {
    enabled: false,
    channelId: '',
    messageType: 'text',
    messageText: 'Welcome to {server}, {user}!',
    cardEnabled: false,
    roleId: '',
    dmEnabled: false,
    dmMessage: 'Welcome to {server}! Thanks for joining us.'
  },
  automod: {
    enabled: false,
    logChannelId: '',
    bypassRoles: [],
    // Legacy simple toggles for backward compatibility
    spamDetection: false,
    capsFilter: false,
    linkFilter: false,
    profanityFilter: false,
    autoDelete: false
  },
  roles: {
    enabled: false,
    reactionRoles: [],
    slashCommands: true
  },
  xp: {
    enabled: false,
    baseXp: 15,
    maxXp: 25,
    cooldown: 60,
    levelUpMessage: true,
    levelUpChannel: '',
    excludedChannels: [],
    multiplierRoles: []
  },
  scheduler: {
    enabled: false,
    messages: []
  },
  logging: {
    enabled: false,
    messageChannel: '',
    memberChannel: '',
    channelChannel: '',
    roleChannel: ''
  },
  antiraid: {
    enabled: false,
    joinRate: 5,
    joinWindow: 10,
    accountAge: 7,
    autoLockdown: true,
    verificationLevel: 'medium'
  }
};
