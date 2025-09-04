# XP & Leveling System Documentation

The XP & Leveling System rewards active members with experience points and level progression, creating engagement and recognizing valuable community members.

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [XP Calculation](#xp-calculation)
4. [Level Progression](#level-progression)
5. [Rewards System](#rewards-system)
6. [Leaderboard](#leaderboard)
7. [API Reference](#api-reference)
8. [Examples](#examples)
9. [Troubleshooting](#troubleshooting)

## Overview

### Features
- **Message-based XP**: Earn XP from sending messages
- **Voice Channel XP**: Gain XP for time spent in voice channels
- **Level-up Notifications**: Celebrate member achievements
- **Role-based Multipliers**: Bonus XP for special roles
- **Channel Exclusions**: Disable XP in specific channels
- **Customizable Rewards**: Automatic role assignment at levels
- **Leaderboard System**: Track top members
- **Decay Prevention**: Optional XP decay for inactive members

### Use Cases
- Encourage server activity
- Reward long-term members
- Create progression systems
- Gamify community participation
- Recognize valuable contributors
- Build member engagement

## Configuration

### Basic Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `enabled` | Boolean | Enable/disable XP system | `false` |
| `messageXp` | Number | XP per message | `15` |
| `voiceXp` | Number | XP per minute in voice | `2` |
| `cooldownSeconds` | Number | Cooldown between XP gains | `60` |
| `levelUpChannelId` | String | Channel for level-up notifications | `null` |
| `enableLevelUpDm` | Boolean | Send level-up DMs | `false` |
| `leaderboardChannelId` | String | Channel for leaderboard | `null` |

### Advanced Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `xpRange` | Object | Random XP range | `{min: 10, max: 20}` |
| `stackMultipliers` | Boolean | Stack role multipliers | `false` |
| `resetOnLeave` | Boolean | Reset XP when member leaves | `false` |
| `decayEnabled` | Boolean | Enable XP decay for inactivity | `false` |
| `decayRate` | Number | Daily decay percentage | `1` |
| `decayAfterDays` | Number | Days before decay starts | `30` |

### Dashboard Configuration

```javascript
{
  enabled: true,
  messageXp: 15,
  voiceXp: 2,
  cooldownSeconds: 60,
  levelUpChannelId: "123456789012345678",
  enableLevelUpDm: true,
  leaderboardChannelId: "987654321098765432",
  
  // XP Range for randomization
  xpRange: {
    min: 10,
    max: 25
  },
  
  // Multipliers
  stackMultipliers: false,
  roleMultipliers: [
    {
      roleId: "111222333444555666",
      multiplier: 1.5,
      description: "VIP Members"
    },
    {
      roleId: "222333444555666777", 
      multiplier: 2.0,
      description: "Boosters"
    }
  ],
  
  // Exclusions
  excludedChannels: [
    "333444555666777888", // #bot-commands
    "444555666777888999"  // #spam
  ],
  excludedRoles: [
    "555666777888999000"  // Muted role
  ],
  
  // Decay settings
  decayEnabled: true,
  decayRate: 0.5,        // 0.5% per day
  decayAfterDays: 30
}
```

## XP Calculation

### Message XP
Base XP calculation for messages:

```javascript
function calculateMessageXp(userId, guildId, channelId) {
  const baseXp = getRandomXp(config.xpRange.min, config.xpRange.max);
  const multiplier = getUserMultiplier(userId, guildId);
  const finalXp = Math.floor(baseXp * multiplier);
  
  return {
    baseXp: baseXp,
    multiplier: multiplier,
    finalXp: finalXp,
    timestamp: Date.now()
  };
}
```

### Voice XP
XP calculation for voice channel activity:

```javascript
function calculateVoiceXp(userId, guildId, minutesSpent) {
  const baseXp = minutesSpent * config.voiceXp;
  const multiplier = getUserMultiplier(userId, guildId);
  const finalXp = Math.floor(baseXp * multiplier);
  
  return {
    baseXp: baseXp,
    multiplier: multiplier,
    finalXp: finalXp,
    minutesSpent: minutesSpent
  };
}
```

### Multiplier System
Role-based XP multipliers:

```javascript
{
  roleMultipliers: [
    {
      roleId: "123456789012345678",
      multiplier: 1.2,          // 20% bonus
      description: "Active Member",
      stackable: true
    },
    {
      roleId: "987654321098765432",
      multiplier: 1.5,          // 50% bonus
      description: "Server Booster", 
      stackable: true
    },
    {
      roleId: "456789123456789123",
      multiplier: 2.0,          // 100% bonus
      description: "VIP Member",
      stackable: false
    }
  ],
  
  // How multipliers combine
  stackingMethod: "additive", // or "multiplicative"
  maxMultiplier: 3.0         // Cap at 300%
}
```

### Cooldown Management
Prevent XP farming with cooldowns:

```javascript
{
  cooldowns: {
    message: 60,      // 60 seconds between message XP
    voice: 300,       // 5 minutes between voice XP
    bonus: 3600       // 1 hour between bonus XP
  },
  
  // Anti-spam measures
  antiSpam: {
    maxMessagesPerMinute: 10,
    duplicateMessagePenalty: 0.5,
    shortMessagePenalty: 0.8    // Messages under 5 chars
  }
}
```

## Level Progression

### Level Calculation
Standard leveling formula:

```javascript
function calculateLevel(totalXp) {
  // Formula: level = floor(sqrt(xp / 100))
  return Math.floor(Math.sqrt(totalXp / 100));
}

function calculateXpForLevel(level) {
  // XP required for specific level
  return level * level * 100;
}

function calculateXpToNextLevel(currentXp) {
  const currentLevel = calculateLevel(currentXp);
  const nextLevelXp = calculateXpForLevel(currentLevel + 1);
  return nextLevelXp - currentXp;
}
```

### Custom Level Curves
Alternative progression systems:

```javascript
{
  levelCurves: {
    linear: {
      formula: "level * 1000",
      description: "1000 XP per level"
    },
    exponential: {
      formula: "100 * (1.2 ^ level)", 
      description: "Exponential growth"
    },
    custom: {
      levels: [
        { level: 1, xpRequired: 100 },
        { level: 2, xpRequired: 300 },
        { level: 3, xpRequired: 600 },
        { level: 4, xpRequired: 1000 },
        { level: 5, xpRequired: 1500 }
        // ... continue for higher levels
      ]
    }
  }
}
```

### Level-up Notifications
Configurable celebration messages:

```javascript
{
  levelUpNotifications: {
    enabled: true,
    channelId: "123456789012345678",
    dmUser: true,
    
    // Message templates
    templates: [
      "🎉 {user} just reached level {level}! Way to go!",
      "⭐ Congratulations {user}! You're now level {level}!",
      "🚀 {user} leveled up to level {level}! Keep it up!"
    ],
    
    // Embed configuration
    embed: {
      enabled: true,
      color: "#FFD700",
      thumbnail: "user_avatar",
      fields: [
        {
          name: "New Level",
          value: "{level}",
          inline: true
        },
        {
          name: "Total XP", 
          value: "{totalXp:,}",
          inline: true
        },
        {
          name: "Next Level",
          value: "{xpToNext} XP remaining",
          inline: true
        }
      ]
    }
  }
}
```

## Rewards System

### Role Rewards
Automatic role assignment at specific levels:

```javascript
{
  levelRewards: [
    {
      level: 5,
      type: "role",
      roleId: "123456789012345678",
      roleName: "Active Member",
      removeOnDemotion: true,
      announcement: "{user} earned the Active Member role!"
    },
    {
      level: 10,
      type: "role", 
      roleId: "987654321098765432",
      roleName: "Veteran",
      removeOnDemotion: false,
      announcement: "{user} is now a server Veteran!"
    },
    {
      level: 25,
      type: "role",
      roleId: "456789123456789123", 
      roleName: "Elite Member",
      removeOnDemotion: true,
      announcement: "🌟 {user} achieved Elite Member status!"
    }
  ]
}
```

### Custom Rewards
Beyond roles - custom reward types:

```javascript
{
  customRewards: [
    {
      level: 15,
      type: "channel_access",
      channelId: "111222333444555666",
      description: "Access to VIP lounge",
      announcement: "{user} unlocked the VIP lounge!"
    },
    {
      level: 20,
      type: "permission",
      permission: "CREATE_INSTANT_INVITE",
      description: "Can create server invites",
      announcement: "{user} can now create server invites!"
    },
    {
      level: 30,
      type: "badge",
      badgeId: "legendary_member",
      description: "Legendary Member badge",
      announcement: "🏆 {user} earned the Legendary Member badge!"
    }
  ]
}
```

### Milestone Rewards
Special rewards for major milestones:

```javascript
{
  milestoneRewards: [
    {
      level: 50,
      type: "special",
      reward: "custom_color_role",
      description: "Choose your own color role",
      announcement: "🎨 {user} can now choose a custom color!"
    },
    {
      level: 100,
      type: "special", 
      reward: "hall_of_fame",
      description: "Added to Hall of Fame",
      announcement: "🏛️ {user} joined the Hall of Fame!"
    }
  ]
}
```

## Leaderboard

### Leaderboard Types
Different ways to rank members:

```javascript
{
  leaderboards: {
    totalXp: {
      name: "📊 Total XP Leaderboard",
      sortBy: "total_xp",
      limit: 20,
      updateInterval: 3600 // Update hourly
    },
    level: {
      name: "🏆 Level Leaderboard", 
      sortBy: "level",
      limit: 15,
      updateInterval: 3600
    },
    weeklyXp: {
      name: "📈 Weekly XP Leaderboard",
      sortBy: "weekly_xp", 
      limit: 10,
      updateInterval: 86400, // Update daily
      resetInterval: 604800  // Reset weekly
    },
    monthlyXp: {
      name: "📅 Monthly XP Leaderboard",
      sortBy: "monthly_xp",
      limit: 10,
      updateInterval: 86400,
      resetInterval: 2592000 // Reset monthly
    }
  }
}
```

### Leaderboard Display
Automated leaderboard posting:

```javascript
{
  leaderboardDisplay: {
    enabled: true,
    channelId: "123456789012345678",
    updateSchedule: "0 0 * * *", // Daily at midnight
    
    // Embed configuration
    embed: {
      title: "🏆 Server Leaderboard",
      color: "#FFD700",
      description: "Top members by total XP",
      thumbnail: "server_icon",
      
      // Field format for each entry
      entryFormat: "`#{rank}` {user} - Level {level} ({totalXp:,} XP)",
      
      // Special formatting for top positions
      specialPositions: {
        1: "🥇 `#{rank}` {user} - Level {level} ({totalXp:,} XP)",
        2: "🥈 `#{rank}` {user} - Level {level} ({totalXp:,} XP)", 
        3: "🥉 `#{rank}` {user} - Level {level} ({totalXp:,} XP)"
      }
    }
  }
}
```

## API Reference

### Get XP Configuration
```http
GET /api/moderation/xp/config
Headers:
  x-guild-id: {guildId}
```

### Update XP Settings
```http
PUT /api/moderation/xp/config
Headers:
  x-guild-id: {guildId}
  Content-Type: application/json

Body:
{
  "enabled": true,
  "messageXp": 15,
  "voiceXp": 2,
  "cooldownSeconds": 60,
  "levelUpChannelId": "123456789012345678"
}
```

### User XP Management
```http
# Get user XP data
GET /api/moderation/xp/user/{userId}
Headers:
  x-guild-id: {guildId}

# Add XP to user
POST /api/moderation/xp/user/{userId}/add
{
  "amount": 100,
  "reason": "Event participation"
}

# Set user XP
PUT /api/moderation/xp/user/{userId}
{
  "totalXp": 5000,
  "reason": "Manual adjustment"
}

# Reset user XP
DELETE /api/moderation/xp/user/{userId}
```

### Leaderboard API
```http
# Get leaderboard
GET /api/moderation/xp/leaderboard?type=total&limit=20

# Get user rank
GET /api/moderation/xp/rank/{userId}

# Get XP statistics
GET /api/moderation/xp/stats
```

### Level Rewards API
```http
# Get level rewards
GET /api/moderation/xp/rewards

# Add level reward
POST /api/moderation/xp/rewards
{
  "level": 10,
  "type": "role",
  "roleId": "123456789012345678",
  "announcement": "User earned veteran role!"
}

# Update level reward
PUT /api/moderation/xp/rewards/{rewardId}
```

## Examples

### Gaming Community Setup
```javascript
{
  enabled: true,
  messageXp: 20,        // Higher XP for active chat
  voiceXp: 3,           // Reward voice participation
  cooldownSeconds: 45,   // Shorter cooldown
  
  // Gaming-focused multipliers
  roleMultipliers: [
    {
      roleId: "123456789012345678",
      multiplier: 1.3,
      description: "Game Night Participants"
    },
    {
      roleId: "987654321098765432", 
      multiplier: 1.5,
      description: "Tournament Winners"
    },
    {
      roleId: "456789123456789123",
      multiplier: 2.0,
      description: "Server Boosters"
    }
  ],
  
  // Exclude bot/spam channels
  excludedChannels: [
    "111222333444555666", // #bot-commands
    "222333444555666777"  // #music-bots
  ],
  
  // Gaming-themed level rewards
  levelRewards: [
    { level: 5, roleId: "333444555666777888", name: "Rookie" },
    { level: 15, roleId: "444555666777888999", name: "Pro Gamer" },
    { level: 30, roleId: "555666777888999000", name: "Elite Player" },
    { level: 50, roleId: "666777888999000111", name: "Gaming Legend" }
  ]
}
```

### Study/Educational Server
```javascript
{
  enabled: true,
  messageXp: 12,        // Moderate XP for discussions
  voiceXp: 4,           // Reward study sessions
  cooldownSeconds: 120, // Longer cooldown to prevent spam
  
  // Education-focused multipliers
  roleMultipliers: [
    {
      roleId: "123456789012345678",
      multiplier: 1.2,
      description: "Study Group Members"
    },
    {
      roleId: "987654321098765432",
      multiplier: 1.4, 
      description: "Tutors"
    },
    {
      roleId: "456789123456789123",
      multiplier: 1.8,
      description: "Honor Students"
    }
  ],
  
  // Only gain XP in study channels
  allowedChannels: [
    "111222333444555666", // #general-study
    "222333444555666777", // #math-help
    "333444555666777888", // #science-discussion
    "444555666777888999"  // #study-voice
  ],
  
  // Academic achievement rewards
  levelRewards: [
    { level: 10, roleId: "555666777888999000", name: "Dedicated Student" },
    { level: 25, roleId: "666777888999000111", name: "Scholar" },
    { level: 50, roleId: "777888999000111222", name: "Academic Elite" }
  ]
}
```

### Community/Social Server
```javascript
{
  enabled: true,
  messageXp: 10,        // Standard XP
  voiceXp: 2,           // Light voice XP
  cooldownSeconds: 90,   // Standard cooldown
  
  // Community engagement multipliers
  roleMultipliers: [
    {
      roleId: "123456789012345678",
      multiplier: 1.1,
      description: "Active Members"
    },
    {
      roleId: "987654321098765432",
      multiplier: 1.3,
      description: "Event Participants"
    },
    {
      roleId: "456789123456789123", 
      multiplier: 1.6,
      description: "Community Helpers"
    }
  ],
  
  // Exclude spam channels
  excludedChannels: [
    "111222333444555666", // #bot-spam
    "222333444555666777"  // #memes
  ],
  
  // Community milestone rewards
  levelRewards: [
    { level: 5, roleId: "333444555666777888", name: "Regular" },
    { level: 15, roleId: "444555666777888999", name: "Familiar Face" },
    { level: 30, roleId: "555666777888999000", name: "Community Pillar" },
    { level: 60, roleId: "666777888999000111", name: "Legend" }
  ],
  
  // Weekly leaderboard competition
  weeklyLeaderboard: {
    enabled: true,
    channelId: "777888999000111222",
    resetDay: "monday",
    rewards: [
      { position: 1, roleId: "888999000111222333", name: "Weekly Champion" },
      { position: 2, roleId: "999000111222333444", name: "Weekly Runner-up" },
      { position: 3, roleId: "000111222333444555", name: "Weekly Bronze" }
    ]
  }
}
```

## Troubleshooting

### Common Issues

#### XP Not Being Awarded
1. **Check Channel Exclusions**: Verify channel isn't excluded
2. **Role Restrictions**: Ensure user doesn't have excluded role
3. **Cooldown Active**: Check if user is on XP cooldown
4. **System Disabled**: Verify XP system is enabled

#### Level-up Notifications Not Working
1. **Channel Permissions**: Bot needs "Send Messages" permission
2. **Channel Existence**: Verify notification channel exists
3. **Embed Permissions**: Bot needs "Embed Links" permission
4. **Template Variables**: Check message template syntax

#### Performance Issues
1. **Database Optimization**: Add proper indexes
2. **Batch Processing**: Process XP gains in batches
3. **Cache Frequently Used Data**: Cache user levels and multipliers
4. **Optimize Queries**: Use efficient SQL queries

### Debug Information

Enable XP system debugging:
```bash
DEBUG_XP=true
```

Common log entries:
```
[XP] User 123456789012345678 gained 15 XP (base: 12, multiplier: 1.25)
[XP] User leveled up: 123456789012345678 reached level 5
[XP] Awarding level reward: Active Member role to user 123456789012345678
[XP] Cooldown active for user 123456789012345678, skipping XP award
```

### Performance Optimization

#### Database Optimization
```sql
-- Optimize XP queries
CREATE INDEX idx_user_xp_guild_total ON user_xp (guild_id, total_xp DESC);
CREATE INDEX idx_user_xp_guild_level ON user_xp (guild_id, level DESC);
CREATE INDEX idx_xp_gains_recent ON xp_gains (guild_id, user_id, created_at DESC);

-- Partition large tables by date
ALTER TABLE xp_gains PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
  PARTITION p_2024_01 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
  PARTITION p_2024_02 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
  -- Continue for each month
);
```

#### Caching Strategy
```javascript
// Cache user levels and multipliers
const userCache = new Map();

function getCachedUserData(userId, guildId) {
  const key = `${guildId}:${userId}`;
  if (userCache.has(key)) {
    return userCache.get(key);
  }
  
  const userData = fetchUserDataFromDB(userId, guildId);
  userCache.set(key, userData);
  
  // Auto-expire cache after 5 minutes
  setTimeout(() => userCache.delete(key), 300000);
  
  return userData;
}
```

### Best Practices

#### System Design
1. **Balanced Progression**: Ensure levels feel achievable but meaningful
2. **Fair Multipliers**: Don't create overwhelming advantages
3. **Meaningful Rewards**: Make level rewards worthwhile
4. **Anti-Gaming Measures**: Prevent XP farming and abuse

#### User Experience
1. **Clear Communication**: Explain how XP system works
2. **Visual Feedback**: Show progress clearly
3. **Celebration**: Make level-ups feel special
4. **Transparency**: Allow users to check their stats

#### Performance
1. **Efficient Storage**: Use appropriate data types
2. **Smart Caching**: Cache frequently accessed data
3. **Batch Operations**: Process multiple actions together
4. **Monitor Resource Usage**: Track system performance

---

**Next Steps:**
- Configure basic XP settings
- Set up level rewards
- Test with active users
- Monitor for balance issues
- Adjust based on community feedback

For more information, see the [Moderation Overview](MODERATION_OVERVIEW.md).
