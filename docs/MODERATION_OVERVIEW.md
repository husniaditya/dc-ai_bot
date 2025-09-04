# Discord Bot Moderation Features Documentation

This documentation provides comprehensive information about all moderation features available in the Discord bot, including configuration, usage, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Feature List](#feature-list)
3. [Quick Start Guide](#quick-start-guide)
4. [Common Configuration](#common-configuration)
5. [Troubleshooting](#troubleshooting)
6. [API Reference](#api-reference)

## Overview

The moderation system provides comprehensive server management tools accessible through a web dashboard. Each feature can be independently enabled/disabled and configured to match your server's specific needs.

### Architecture

- **Dashboard Interface**: User-friendly web interface for configuration
- **Real-time API**: Instant configuration updates without bot restart
- **Database Persistence**: All settings are stored in MariaDB/MySQL
- **Event-driven**: Responds to Discord events in real-time
- **Caching**: Efficient in-memory caching for optimal performance

### Permission Requirements

The bot requires specific Discord permissions for each feature:

| Feature | Required Permissions |
|---------|---------------------|
| Welcome Messages | Send Messages, Embed Links, Attach Files |
| Auto Moderation | Manage Messages, Kick Members, Ban Members, Moderate Members |
| Role Management | Manage Roles, Add Reactions |
| XP & Leveling | Send Messages, Embed Links |
| Scheduled Messages | Send Messages, Embed Links |
| Audit Logging | View Audit Log, Send Messages |
| Anti-Raid Protection | Kick Members, Ban Members, Manage Channels, Moderate Members |

## Feature List

### 🚪 [Welcome Messages](WELCOME_SYSTEM.md)
Greet new members with customizable messages, cards, and automatic role assignment.

**Key Features:**
- Custom welcome messages with variables
- Generated welcome cards with avatars
- Auto role assignment
- Direct message welcoming
- Channel-specific announcements

### 🤖 [Auto Moderation](AUTOMOD_SYSTEM.md)  
Automatically detect and handle spam, inappropriate content, and rule violations.

**Key Features:**
- Spam detection and prevention
- Caps lock filtering
- Link filtering with whitelist
- Profanity filter with custom words/patterns
- Configurable bypass roles
- Auto-delete violations

### 👥 [Role Management](ROLE_MANAGEMENT.md)
Manage roles through reaction roles and self-assignable commands.

**Key Features:**
- Reaction roles on messages
- Self-assignable role commands
- Role menus and categories
- Permission synchronization
- Custom response messages

### 📊 [XP & Leveling](XP_LEVELING.md)
Reward active members with experience points and level progression.

**Key Features:**
- Configurable XP rewards
- Level-up messages and notifications
- Role-based XP multipliers
- Channel/role exclusions
- Leaderboard tracking

### 📅 [Scheduled Messages](SCHEDULER.md)
Automate announcements and recurring messages.

**Key Features:**
- Cron-based scheduling
- Multiple message types
- Channel targeting
- Enable/disable toggles
- Event reminders

### 📋 [Audit Logging](AUDIT_LOGGING.md)
Track all moderation actions and server changes.

**Key Features:**
- Message logs (edits, deletes)
- Member logs (joins, leaves, bans)
- Channel/role modification logs
- Moderation action logs
- Customizable log channels

### 🛡️ [Anti-Raid Protection](ANTI_RAID_SYSTEM.md)
Protect your server from coordinated attacks and suspicious activities.

**Key Features:**
- Join rate monitoring
- Account age verification
- Automated responses (kick, ban, mute, lockdown)
- Suspicious account detection
- New member monitoring
- Bypass roles for trusted users

## Quick Start Guide

### 1. Initial Setup
1. Invite the bot to your server with required permissions
2. Access the dashboard at `your-domain.com/dashboard`
3. Select your server from the server list
4. Navigate to **Moderation** section

### 2. Enable Basic Protection
For most servers, start with these features:

```javascript
// Recommended starter configuration
{
  welcome: { 
    enabled: true,
    channelId: "#welcome",
    messageText: "Welcome to {server}, {user}! Please read our rules."
  },
  automod: {
    enabled: true,
    spamDetection: true,
    capsFilter: true,
    logChannelId: "#mod-logs"
  },
  antiraid: {
    enabled: true,
    joinRate: 5,
    accountAge: 7,
    alertChannel: "#mod-alerts"
  }
}
```

### 3. Advanced Configuration
After basic setup, configure additional features:

- **Role Management**: Set up reaction roles for common server roles
- **XP System**: Enable if you want to gamify server activity
- **Scheduled Messages**: Automate recurring announcements
- **Audit Logging**: Essential for larger servers

## Common Configuration

### Channel Requirements

Most features require specific channels:

| Channel Type | Purpose | Features |
|--------------|---------|----------|
| Welcome Channel | New member greetings | Welcome Messages |
| Mod Log Channel | Automated logging | Auto Moderation, Audit Logging |
| Alert Channel | Security notifications | Anti-Raid Protection |
| Announcement Channel | Scheduled posts | Scheduled Messages |

### Variable Substitution

Many features support dynamic variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `{user}` | Mentions the user | `<@123456789>` |
| `{username}` | User's display name | `JohnDoe` |
| `{server}` | Server name | `My Awesome Server` |
| `{memberCount}` | Current member count | `1,234` |
| `{rules}` | Auto-detected rules channel | `<#987654321>` |
| `{general}` | Auto-detected general channel | `<#123789456>` |

### Bypass Roles

Most moderation features support bypass roles:

```javascript
{
  bypassRoles: [
    "123456789012345678", // Moderator role ID
    "987654321098765432", // Admin role ID
    "456789123456789123"  // VIP role ID
  ]
}
```

## Troubleshooting

### Common Issues

#### 1. Features Not Working
- **Check Permissions**: Ensure bot has required Discord permissions
- **Verify Configuration**: Review dashboard settings for errors
- **Check Channels**: Ensure target channels exist and bot can access them
- **Role Hierarchy**: Bot role must be above roles it needs to manage

#### 2. Performance Issues
- **Database Connection**: Check MariaDB/MySQL connectivity
- **Cache Issues**: Restart bot to clear cache if needed
- **Rate Limits**: Reduce action frequency if hitting Discord limits

#### 3. Dashboard Issues
- **Authentication**: Ensure proper Discord OAuth setup
- **Guild Access**: Verify bot is in the server you're trying to configure
- **Browser Cache**: Clear browser cache if settings don't update

### Debug Information

Enable debug logging by setting environment variables:

```bash
DEBUG_MODERATION=true
DEBUG_ANTIRAID=true
DEBUG_AUTOMOD=true
```

### Support Resources

- **Bot Logs**: Check console output for error messages
- **Dashboard Logs**: Browser developer tools for frontend issues
- **Database Logs**: MariaDB/MySQL logs for database issues
- **Discord API**: Monitor Discord API status for service issues

## API Reference

### Base URL
```
/api/moderation
```

### Authentication
All endpoints require:
- `x-guild-id` header with Discord guild ID
- Valid user session with server access

### Core Endpoints

#### Feature Management
```
GET    /features                    # Get all feature states
POST   /features/:feature/toggle    # Enable/disable feature
GET    /features/:feature/config    # Get feature configuration
PUT    /features/:feature/config    # Update feature configuration
```

#### Feature-Specific Endpoints
```
# Auto Moderation
GET    /automod/rules              # Get automod rules
POST   /automod/rules              # Create/update rule

# XP System
GET    /xp/config                  # Get XP configuration
PUT    /xp/config                  # Update XP settings
GET    /xp/leaderboard             # Get XP leaderboard

# Anti-Raid
GET    /antiraid/config            # Get anti-raid settings
PUT    /antiraid/config            # Update anti-raid settings

# Scheduler
GET    /scheduler/messages         # Get scheduled messages
POST   /scheduler/messages         # Create scheduled message

# Logging
GET    /logging/config             # Get audit log settings
PUT    /logging/config             # Update audit log settings
```

### Response Format
All endpoints return JSON responses:

```javascript
// Success Response
{
  "success": true,
  "data": { /* response data */ }
}

// Error Response
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Rate Limiting
- **Dashboard API**: 120 requests per minute per IP
- **Bot Commands**: Built-in Discord rate limiting
- **Database Operations**: Automatic query optimization

## Best Practices

### Security
1. **Regular Audits**: Review moderation logs regularly
2. **Permission Principle**: Grant minimum required permissions
3. **Backup Configuration**: Export settings before major changes
4. **Monitor Alerts**: Set up proper notification channels

### Performance
1. **Optimize Settings**: Adjust thresholds based on server size
2. **Cache Warmup**: Allow time for cache population after changes
3. **Database Maintenance**: Regular database optimization
4. **Resource Monitoring**: Monitor bot resource usage

### User Experience
1. **Clear Communication**: Inform users about moderation policies
2. **Gradual Rollout**: Enable features incrementally
3. **Feedback Collection**: Gather user feedback on moderation actions
4. **Regular Updates**: Keep settings current with server growth

## Migration Guide

### From Other Bots
When migrating from other moderation bots:

1. **Export Existing Settings**: Document current configuration
2. **Plan Migration**: Schedule during low-activity periods
3. **Test Configuration**: Use test server for validation
4. **Gradual Transition**: Enable features one by one
5. **Monitor Impact**: Watch for issues after migration

### Backup and Restore
```bash
# Backup configuration
curl -H "x-guild-id: YOUR_GUILD_ID" \
     "https://your-domain.com/api/moderation/export" > backup.json

# Restore configuration
curl -X POST \
     -H "x-guild-id: YOUR_GUILD_ID" \
     -H "Content-Type: application/json" \
     -d @backup.json \
     "https://your-domain.com/api/moderation/import"
```

## Contributing

### Documentation Updates
- Keep feature documentation up-to-date
- Include examples for common use cases
- Document breaking changes clearly

### Feature Requests
- Use GitHub issues for feature requests
- Provide detailed use cases and requirements
- Consider backward compatibility

### Bug Reports
- Include full error messages
- Provide reproduction steps
- Include relevant configuration details

---

For detailed information about specific features, see the individual feature documentation linked above.
