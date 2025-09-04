# Discord Anti-Raid Protection System

This document describes the comprehensive anti-raid protection system implemented in the Discord bot.

## Overview

The anti-raid system monitors member joins and message patterns to detect and respond to coordinated attacks automatically. It integrates with the dashboard configuration and provides real-time protection for Discord servers.

## Features

### 1. Join Rate Monitoring
- **Real-time tracking**: Monitors member join patterns in configurable time windows
- **Rate limiting**: Triggers when too many members join within the specified timeframe
- **Account age analysis**: Factors in account creation dates to detect suspicious patterns
- **Heuristic detection**: Uses multiple factors to identify potential raids

### 2. Account Analysis
- **Age verification**: Flags accounts younger than the configured threshold
- **Profile analysis**: Checks for default avatars and suspicious usernames
- **Pattern recognition**: Identifies common bot/raid account characteristics
- **Multi-factor scoring**: Combines multiple suspicious indicators

### 3. Automated Responses
- **Configurable actions**: Multiple response types for detected raids
- **Individual responses**: Separate handling for suspicious individual accounts
- **Grace period monitoring**: Tracks new member behavior for a configurable period
- **Content filtering**: Monitors new member messages for spam/abuse

### 4. Response Actions

#### Raid Detection Actions
- **Lockdown**: Temporarily raises server verification level
- **Kick**: Removes recent joiners from the server
- **Ban**: Bans recent joiners (with optional duration)
- **Mute**: Times out recent joiners
- **None**: Alert only, no automated action

#### Individual Account Actions
- **Auto-kick**: Automatically kicks suspicious accounts
- **Content monitoring**: Monitors new member messages
- **Invite spam detection**: Automatically deletes Discord invites from new members
- **Mass mention protection**: Prevents mass ping spam

## Configuration

### Dashboard Settings

The anti-raid system is configured through the dashboard's Moderation > Anti-Raid section:

```javascript
{
  enabled: true,                    // Enable/disable the system
  joinRate: 5,                     // Max joins per time window
  joinWindow: 10,                  // Time window in seconds
  accountAge: 7,                   // Minimum account age in days
  autoLockdown: true,              // Auto-lockdown on raid detection
  autoKick: false,                 // Auto-kick suspicious accounts
  verificationLevel: 'medium',     // Lockdown verification level
  alertChannel: 'channel_id',      // Alert notification channel
  raidAction: 'lockdown',          // Action to take on raid
  raidActionDuration: 5,           // Action duration in minutes
  deleteInviteSpam: true,          // Delete invite links from new members
  gracePeriod: 30,                 // New member monitoring period (minutes)
  bypassRoles: ['role_id']         // Roles that bypass protection
}
```

## System Architecture

### Core Components

1. **Anti-Raid Service** (`src/bot/services/anti-raid.js`)
   - Main logic for raid detection and response
   - Account analysis and pattern recognition
   - Automated action execution

2. **Event Integration**
   - **guildMemberAdd**: Monitors member joins for raid patterns
   - **messageCreate**: Monitors new member messages during grace period

3. **Data Tracking**
   - **Join tracking**: In-memory tracking of recent joins per guild
   - **New member monitoring**: Grace period tracking for content filtering
   - **Automatic cleanup**: Prevents memory leaks with periodic data cleanup

### Detection Algorithm

```javascript
// Raid detection logic
function checkForRaid(recentJoins, config) {
  const joinLimit = config.joinRate || 5;
  
  if (recentJoins.length < joinLimit) {
    return false;
  }
  
  // Calculate young account ratio
  const youngAccounts = recentJoins.filter(join => 
    join.accountAgeDays < (config.accountAge || 7)
  ).length;
  
  const youngAccountRatio = youngAccounts / recentJoins.length;
  
  // Trigger if >60% are young accounts OR rate limit exceeded
  return youngAccountRatio > 0.6 || recentJoins.length >= joinLimit;
}
```

### Suspicious Account Detection

```javascript
function checkSuspiciousAccount(member, config, accountAgeDays) {
  const factors = [];
  
  // Account age check
  if (accountAgeDays < (config.accountAge || 7)) {
    factors.push('young_account');
  }
  
  // No custom avatar
  if (!member.user.avatar) {
    factors.push('no_avatar');
  }
  
  // Suspicious username patterns
  const username = member.user.username.toLowerCase();
  if (/\d{4,}$/.test(username) || /^user\d+/.test(username)) {
    factors.push('suspicious_username');
  }
  
  // Require multiple factors for action
  return factors.length >= 2;
}
```

## Integration Points

### Dashboard Integration
- Real-time configuration updates
- Status monitoring and alerts
- Historical data and analytics

### Discord Bot Integration
- Seamless integration with existing event handlers
- Non-intrusive welcome message processing
- Coordinated with other moderation features

### Permission Requirements
- **Kick Members**: Required for auto-kick functionality
- **Ban Members**: Required for ban actions
- **Manage Channels**: Required for lockdown (verification level changes)
- **Manage Messages**: Required for content deletion
- **Moderate Members**: Required for timeout actions

## Usage Examples

### Basic Setup
1. Enable anti-raid protection in the dashboard
2. Configure join rate limit (e.g., 5 members per 10 seconds)
3. Set minimum account age (e.g., 7 days)
4. Choose alert channel for notifications
5. Select appropriate raid action (lockdown, kick, ban, etc.)

### Advanced Configuration
```javascript
// High-security server setup
{
  enabled: true,
  joinRate: 3,                     // Stricter join rate
  joinWindow: 15,                  // Longer monitoring window
  accountAge: 14,                  // Require older accounts
  autoKick: true,                  // Auto-kick suspicious accounts
  raidAction: 'ban',               // Ban raiders
  raidActionDuration: 60,          // 1-hour bans
  deleteInviteSpam: true,          // Delete invite spam
  gracePeriod: 60,                 // Monitor new members for 1 hour
  bypassRoles: ['trusted', 'vip']  // Trusted roles bypass checks
}
```

## Monitoring and Alerts

### Alert Types
- **Raid Detection**: Real-time notifications when raids are detected
- **Suspicious Accounts**: Notifications for individual suspicious accounts
- **Action Confirmations**: Confirmation when automated actions are taken
- **System Status**: Configuration changes and system status updates

### Alert Format
```javascript
{
  title: '🚨 RAID DETECTED',
  description: 'Server: Example Guild\nRecent Joins: 8\nYoung Accounts: 6\nTime Window: Last 60 seconds',
  color: 0xff0000,
  timestamp: '2024-01-15T10:30:00Z',
  fields: [
    {
      name: 'Recent Joiners',
      value: '@User1 (2.1d old)\n@User2 (0.5d old)\n@User3 (1.2d old)...'
    }
  ]
}
```

## Best Practices

### Configuration Guidelines
1. **Start Conservative**: Begin with moderate settings and adjust based on server activity
2. **Monitor Alerts**: Regularly check alert channels for false positives
3. **Test Settings**: Use test accounts to verify configuration works as expected
4. **Regular Reviews**: Periodically review and adjust settings based on server growth

### Security Considerations
1. **Bypass Roles**: Carefully configure bypass roles to prevent abuse
2. **Alert Channels**: Ensure alert channels are secure and monitored
3. **Action Logging**: Keep logs of automated actions for review
4. **Manual Override**: Always have manual controls available for emergencies

### Performance Optimization
1. **Memory Management**: Automatic cleanup prevents memory leaks
2. **Rate Limiting**: Built-in delays prevent Discord API rate limits
3. **Efficient Queries**: Optimized database queries for real-time performance
4. **Caching**: In-memory caching reduces database load

## Troubleshooting

### Common Issues

1. **False Positives**
   - Increase account age threshold
   - Reduce join rate sensitivity
   - Add bypass roles for legitimate users

2. **Missed Raids**
   - Decrease join rate threshold
   - Reduce time window
   - Enable auto-kick for suspicious accounts

3. **Permission Errors**
   - Verify bot has required permissions
   - Check role hierarchy for kick/ban actions
   - Ensure bot role is above target roles

### Debug Information
The system provides console logging for debugging:
```
[AntiRaid] RAID DETECTED in guild 123456789 - 8 recent joins
[AntiRaid] Auto-kicked suspicious account: User#1234
[AntiRaid] Server Example Guild locked down (verification level 4)
```

## API Reference

### Core Functions

#### `handleMemberJoin(member, store, client)`
Main entry point for processing member joins.

#### `handleNewMemberMessage(message, config, store, client)`
Processes messages from new members during grace period.

#### `checkForRaid(recentJoins, config)`
Determines if current join pattern indicates a raid.

#### `checkSuspiciousAccount(member, config, accountAgeDays)`
Analyzes individual accounts for suspicious characteristics.

### Configuration API

The system integrates with the existing moderation API:
- `GET /api/moderation/antiraid/config` - Retrieve configuration
- `PUT /api/moderation/antiraid/config` - Update configuration

### Events

The system listens for and responds to:
- `guildMemberAdd` - New member monitoring
- `messageCreate` - New member message monitoring

This comprehensive anti-raid system provides robust protection against coordinated attacks while maintaining flexibility for different server needs and configurations.
