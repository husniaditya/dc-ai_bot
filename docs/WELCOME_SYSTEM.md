# Welcome System Documentation

The Welcome System greets new members with customizable messages, welcome cards, and automatic role assignment when they join your Discord server.

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [Welcome Cards](#welcome-cards)
4. [Variables](#variables)
5. [API Reference](#api-reference)
6. [Examples](#examples)
7. [Troubleshooting](#troubleshooting)

## Overview

### Features
- **Custom Welcome Messages**: Personalized greetings with variables
- **Generated Welcome Cards**: Beautiful avatar-based cards
- **Auto Role Assignment**: Automatically assign roles to new members
- **Direct Messages**: Send welcome messages privately
- **Channel Announcements**: Public welcome announcements

### Use Cases
- Greet new members warmly
- Provide server orientation information
- Automatically assign basic roles
- Direct users to important channels
- Create welcoming community atmosphere

## Configuration

### Basic Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `enabled` | Boolean | Enable/disable welcome system | `false` |
| `channelId` | String | Channel ID for welcome messages | `null` |
| `messageText` | String | Custom welcome message | `"Welcome to {server}, {user}!"` |
| `dmEnabled` | Boolean | Send DM to new members | `false` |
| `dmText` | String | Direct message content | `""` |
| `cardEnabled` | Boolean | Generate welcome cards | `true` |
| `autoRoles` | Array | Role IDs to auto-assign | `[]` |

### Advanced Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `mentionUser` | Boolean | Mention user in message | `true` |
| `mentionRoles` | Array | Additional roles to mention | `[]` |
| `deleteAfter` | Number | Auto-delete after seconds (0 = never) | `0` |
| `embedColor` | String | Embed color (hex) | `"#5865F2"` |
| `customFields` | Array | Additional embed fields | `[]` |

### Dashboard Configuration

```javascript
// Example configuration object
{
  enabled: true,
  channelId: "123456789012345678",
  messageText: "Welcome to **{server}**, {user}! 🎉\n\nPlease check out {rules} and introduce yourself in {general}!",
  dmEnabled: true,
  dmText: "Welcome to {server}! Check out our rules and have fun!",
  cardEnabled: true,
  autoRoles: [
    "987654321098765432", // Member role
    "456789123456789123"  // Notifications role
  ],
  mentionUser: true,
  embedColor: "#00FF7F",
  deleteAfter: 0
}
```

## Welcome Cards

### Card Features
- **User Avatar**: Automatically fetched from Discord
- **Username Display**: Shows user's display name and tag
- **Server Branding**: Includes server name and icon
- **Member Count**: Shows current member count
- **Join Date**: Displays when user joined
- **Custom Styling**: Configurable colors and fonts

### Card Generation
Cards are generated server-side using Canvas API and include:

```javascript
// Card data structure
{
  userId: "123456789012345678",
  username: "JohnDoe",
  discriminator: "1234",
  avatarUrl: "https://cdn.discordapp.com/avatars/...",
  serverName: "My Server",
  serverIcon: "https://cdn.discordapp.com/icons/...",
  memberCount: 1234,
  joinDate: "2024-01-15T10:30:00Z"
}
```

### Card Customization

| Setting | Type | Description | Options |
|---------|------|-------------|---------|
| `cardTheme` | String | Visual theme | `default`, `dark`, `light`, `colorful` |
| `cardBackground` | String | Background image URL | Any valid image URL |
| `cardTextColor` | String | Text color (hex) | `#FFFFFF` |
| `cardAccentColor` | String | Accent color (hex) | `#5865F2` |

## Variables

### User Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `{user}` | User mention | `<@123456789012345678>` |
| `{username}` | Display name | `JohnDoe` |
| `{usertag}` | Username with discriminator | `JohnDoe#1234` |
| `{userid}` | User ID | `123456789012345678` |

### Server Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `{server}` | Server name | `My Awesome Server` |
| `{memberCount}` | Current member count | `1,234 members` |
| `{memberNumber}` | New member's position | `You're member #1,234!` |

### Channel Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `{rules}` | Rules channel mention | `<#987654321098765432>` |
| `{general}` | General channel mention | `<#123456789987654321>` |
| `{announcements}` | Announcements channel | `<#456789123789456123>` |

### Date/Time Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `{date}` | Current date | `January 15, 2024` |
| `{time}` | Current time | `10:30 AM` |
| `{timestamp}` | Unix timestamp | `<t:1705312200:F>` |

## API Reference

### Get Welcome Configuration
```http
GET /api/moderation/welcome/config
Headers:
  x-guild-id: {guildId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "channelId": "123456789012345678",
    "messageText": "Welcome to {server}, {user}!",
    "dmEnabled": false,
    "dmText": "",
    "cardEnabled": true,
    "autoRoles": ["987654321098765432"],
    "mentionUser": true,
    "embedColor": "#5865F2"
  }
}
```

### Update Welcome Configuration
```http
PUT /api/moderation/welcome/config
Headers:
  x-guild-id: {guildId}
  Content-Type: application/json

Body:
{
  "enabled": true,
  "channelId": "123456789012345678",
  "messageText": "Welcome to **{server}**, {user}! 🎉",
  "cardEnabled": true,
  "autoRoles": ["987654321098765432", "456789123456789123"]
}
```

### Test Welcome Message
```http
POST /api/moderation/welcome/test
Headers:
  x-guild-id: {guildId}
  Content-Type: application/json

Body:
{
  "userId": "123456789012345678"
}
```

## Examples

### Basic Welcome Setup
```javascript
{
  enabled: true,
  channelId: "123456789012345678",
  messageText: "Welcome to {server}, {user}! Please read our rules and enjoy your stay!",
  cardEnabled: true,
  autoRoles: ["987654321098765432"] // Basic member role
}
```

### Advanced Welcome with DM
```javascript
{
  enabled: true,
  channelId: "123456789012345678",
  messageText: "🎉 Welcome to **{server}**, {user}!\n\n📋 Please check {rules}\n💬 Chat in {general}\n📢 Stay updated in {announcements}",
  dmEnabled: true,
  dmText: "Hi {username}! Welcome to {server}. If you have any questions, feel free to ask our moderators!",
  cardEnabled: true,
  autoRoles: [
    "987654321098765432", // Member role
    "456789123456789123"  // Notifications role
  ],
  embedColor: "#00FF7F",
  mentionRoles: ["111222333444555666"] // Mention welcome committee
}
```

### Gaming Server Welcome
```javascript
{
  enabled: true,
  channelId: "123456789012345678",
  messageText: "🎮 **{user} joined the game!**\n\nWelcome to {server}, player #{memberNumber}!\n\n🕹️ Check out {rules} to get started\n🏆 Join voice channels to play with others\n📊 Use `/stats` to see your progress",
  cardEnabled: true,
  cardTheme: "colorful",
  autoRoles: [
    "987654321098765432", // Gamer role
    "456789123456789123", // LFG notifications
    "789123456789123456"  // Event notifications
  ],
  embedColor: "#FF6B35"
}
```

### Community Server Welcome
```javascript
{
  enabled: true,
  channelId: "123456789012345678",
  messageText: "✨ Welcome to our community, {user}!\n\n👋 Introduce yourself in <#intro-channel>\n📖 Read our {rules}\n🎯 Pick your interests in <#role-selection>\n💬 Start chatting in {general}",
  dmEnabled: true,
  dmText: "Welcome to {server}! We're excited to have you here. Don't forget to introduce yourself and pick your roles!",
  cardEnabled: true,
  autoRoles: ["987654321098765432"], // Basic member role
  customFields: [
    {
      name: "🎯 Get Started",
      value: "1. Read the rules\n2. Introduce yourself\n3. Pick your roles\n4. Start chatting!",
      inline: false
    }
  ]
}
```

## Troubleshooting

### Common Issues

#### Welcome Messages Not Sending
1. **Check Channel Permissions**: Bot needs "Send Messages" and "Embed Links"
2. **Verify Channel ID**: Ensure channel exists and ID is correct
3. **Check Bot Status**: Ensure bot is online and responsive
4. **Review Message Content**: Check for invalid variables or formatting

#### Auto Roles Not Assigning
1. **Role Hierarchy**: Bot role must be above roles it assigns
2. **Bot Permissions**: Needs "Manage Roles" permission
3. **Role IDs**: Verify role IDs are correct and roles exist
4. **Rate Limits**: Discord limits role assignment speed

#### Welcome Cards Not Generating
1. **Canvas Dependencies**: Ensure server has Canvas library installed
2. **Avatar Access**: Check if user avatar is accessible
3. **File Permissions**: Bot needs write access for temporary files
4. **Memory Usage**: Large cards may require more memory

### Debug Information

Enable welcome debugging:
```bash
DEBUG_WELCOME=true
```

Common log entries:
```
[WELCOME] Processing join for user 123456789012345678
[WELCOME] Generating welcome card for JohnDoe#1234
[WELCOME] Sending welcome message to channel 123456789012345678
[WELCOME] Assigning auto roles: 987654321098765432
[WELCOME] Welcome process completed successfully
```

### Performance Optimization

#### Card Generation
- Cache user avatars when possible
- Use smaller image sizes for large servers
- Implement queue for high-traffic servers
- Consider disabling cards during heavy load

#### Role Assignment
- Batch role assignments when possible
- Implement delays for large role lists
- Monitor Discord rate limits
- Use role hierarchy efficiently

### Best Practices

#### Message Design
1. **Keep It Concise**: Avoid overwhelming new users
2. **Include Essentials**: Rules, general chat, important channels
3. **Use Formatting**: Make messages visually appealing
4. **Test Variables**: Ensure all variables work correctly

#### Role Management
1. **Essential Roles Only**: Don't auto-assign too many roles
2. **Permission Audit**: Review auto-assigned role permissions
3. **Hierarchy Planning**: Plan role structure carefully
4. **Regular Review**: Remove unused auto roles

#### User Experience
1. **Quick Orientation**: Help users get started quickly
2. **Clear Next Steps**: Guide users on what to do
3. **Friendly Tone**: Make users feel welcome
4. **Community Focus**: Encourage participation

### Migration from Other Bots

#### Carl-bot Migration
```javascript
// Carl-bot automod format
"Welcome {user} to {server}! Make sure to read #rules"

// Convert to our format
"Welcome {user} to {server}! Make sure to read {rules}"
```

#### MEE6 Migration
```javascript
// MEE6 format
"Welcome {user.mention} to {server.name}! You are member #{server.member_count}"

// Convert to our format
"Welcome {user} to {server}! You are member {memberNumber}"
```

#### Dyno Migration
```javascript
// Dyno format
"Welcome $user to $server! Please read $channel(rules)"

// Convert to our format
"Welcome {user} to {server}! Please read {rules}"
```

---

**Next Steps:**
- Configure your welcome channel
- Test with a small user group
- Monitor for any issues
- Adjust settings based on feedback

For more information, see the [Moderation Overview](MODERATION_OVERVIEW.md).
