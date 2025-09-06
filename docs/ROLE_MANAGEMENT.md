# Role Management System Documentation

The Role Management System provides reaction roles and self-assignable role commands to help users get the roles they need in your Discord server.

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [Reaction Roles](#reaction-roles)
4. [Self-Assignable Roles](#self-assignable-roles)
5. [Role Menus](#role-menus)
6. [Permission Management](#permission-management)
7. [API Reference](#api-reference)
8. [Examples](#examples)
9. [Troubleshooting](#troubleshooting)

## Overview

### Features
- **Reaction Roles**: Assign roles by adding emoji reactions
- **Self-Assignable Commands**: `/role` command for role management
- **Role Menus**: Interactive dropdown menus for role selection
- **Role Categories**: Organize roles by type (color, hobby, notification, etc.)
- **Exclusive Roles**: Mutually exclusive role groups
- **Permission Sync**: Automatic permission synchronization
- **Custom Messages**: Configurable response messages

### Use Cases
- Color roles for personalization
- Notification preferences (announcements, events)
- Interest-based roles (gaming, hobbies)
- Access roles for specific channels
- Regional/timezone roles
- Pronoun roles

## Configuration

### Basic Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `enabled` | Boolean | Enable/disable role management | `false` |
| `reactionRolesEnabled` | Boolean | Enable reaction roles | `true` |
| `selfAssignableEnabled` | Boolean | Enable self-assignable commands | `true` |
| `logChannelId` | String | Channel for role change logs | `null` |
| `maxRolesPerUser` | Number | Maximum roles per user | `10` |
| `cooldownSeconds` | Number | Cooldown between role changes | `5` |

### Advanced Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `requireVerification` | Boolean | Require account verification | `false` |
| `minAccountAge` | Number | Minimum account age (days) | `0` |
| `allowedChannels` | Array | Channels where commands work | `[]` |
| `bypassRoles` | Array | Roles that bypass restrictions | `[]` |
| `autoRemoveReactions` | Boolean | Remove reactions after role assignment | `true` |

### Dashboard Configuration

```javascript
{
  enabled: true,
  reactionRolesEnabled: true,
  selfAssignableEnabled: true,
  logChannelId: "123456789012345678",
  maxRolesPerUser: 15,
  cooldownSeconds: 3,
  requireVerification: true,
  minAccountAge: 7,
  allowedChannels: [
    "987654321098765432", // #role-selection
    "456789123456789123"  // #commands
  ],
  autoRemoveReactions: false
}
```

## Reaction Roles

### Message Setup
Create reaction role messages with specific embed format:

```javascript
{
  messageId: "123456789012345678",
  channelId: "987654321098765432", 
  title: "🎨 Color Roles",
  description: "React to get your favorite color role!",
  color: "#5865F2",
  roles: [
    {
      emoji: "🔴",
      roleId: "111222333444555666",
      roleName: "Red",
      description: "Vibrant red color"
    },
    {
      emoji: "🔵", 
      roleId: "222333444555666777",
      roleName: "Blue",
      description: "Cool blue color"
    },
    {
      emoji: "🟢",
      roleId: "333444555666777888",
      roleName: "Green", 
      description: "Fresh green color"
    }
  ],
  exclusive: true, // Only one role from this group
  removeOnUnreact: true
}
```

### Emoji Types
Support for various emoji formats:

| Type | Format | Example |
|------|--------|---------|
| Unicode | Direct unicode | `🎮` |
| Custom | `<:name:id>` | `<:gaming:123456789012345678>` |
| Animated | `<a:name:id>` | `<a:sparkle:987654321098765432>` |

### Group Management
Organize reaction roles into exclusive groups:

```javascript
{
  exclusiveGroups: {
    "colors": {
      description: "Color roles - choose one",
      maxRoles: 1,
      roles: ["red", "blue", "green", "yellow"]
    },
    "notifications": {
      description: "Notification preferences",
      maxRoles: 5,
      roles: ["announcements", "events", "updates", "news"]
    },
    "regions": {
      description: "Regional roles - choose one", 
      maxRoles: 1,
      roles: ["na-east", "na-west", "eu", "asia"]
    }
  }
}
```

## Self-Assignable Roles

### Command Configuration
Set up roles that users can assign themselves:

```javascript
{
  selfAssignableRoles: [
    {
      roleId: "123456789012345678",
      roleName: "Gamer",
      category: "interests",
      description: "For gaming enthusiasts",
      aliases: ["gaming", "games"],
      requiresRole: null, // No requirement
      conflictsWith: [], // No conflicts
      cooldown: 0 // No cooldown
    },
    {
      roleId: "987654321098765432", 
      roleName: "Event Notifications",
      category: "notifications",
      description: "Get notified about server events",
      aliases: ["events", "notify"],
      requiresRole: "456789123456789123", // Requires member role
      conflictsWith: ["no-notifications"],
      cooldown: 300 // 5 minute cooldown
    }
  ]
}
```

### Command Usage
Users interact with roles via slash commands:

```
/role add gaming          # Add gaming role
/role remove events       # Remove events role  
/role list               # List available roles
/role info gaming        # Get info about gaming role
/role mine               # Show user's current roles
```

### Category System
Organize roles by categories:

```javascript
{
  categories: {
    "colors": {
      name: "🎨 Color Roles",
      description: "Personalize your name color",
      maxRoles: 1,
      exclusive: true
    },
    "interests": {
      name: "🎯 Interest Roles", 
      description: "Show your hobbies and interests",
      maxRoles: 5,
      exclusive: false
    },
    "notifications": {
      name: "🔔 Notification Roles",
      description: "Control what you get notified about", 
      maxRoles: 10,
      exclusive: false
    },
    "access": {
      name: "🔑 Access Roles",
      description: "Special channel access",
      maxRoles: 3,
      requiresRole: "member"
    }
  }
}
```

## Role Menus

### Dropdown Menus
Interactive role selection with Discord's select menus:

```javascript
{
  roleMenus: [
    {
      messageId: "123456789012345678",
      channelId: "987654321098765432",
      title: "🎮 Gaming Roles",
      description: "Select your favorite games",
      placeholder: "Choose your games...",
      minValues: 0,
      maxValues: 5,
      options: [
        {
          label: "Minecraft",
          value: "minecraft",
          description: "Block building game",
          emoji: "⛏️",
          roleId: "111222333444555666"
        },
        {
          label: "Valorant", 
          value: "valorant",
          description: "Tactical FPS game",
          emoji: "🎯",
          roleId: "222333444555666777"
        },
        {
          label: "Among Us",
          value: "amongus", 
          description: "Social deduction game",
          emoji: "🔍",
          roleId: "333444555666777888"
        }
      ]
    }
  ]
}
```

### Button Roles
Simple button-based role assignment:

```javascript
{
  buttonRoles: [
    {
      messageId: "456789123456789123",
      channelId: "987654321098765432",
      title: "🔔 Quick Notifications",
      description: "Toggle notification roles",
      buttons: [
        {
          label: "📢 Announcements",
          style: "PRIMARY", // Blue button
          roleId: "111222333444555666",
          toggle: true // Can add/remove
        },
        {
          label: "🎉 Events",
          style: "SUCCESS", // Green button  
          roleId: "222333444555666777",
          toggle: true
        },
        {
          label: "📰 News",
          style: "SECONDARY", // Gray button
          roleId: "333444555666777888", 
          toggle: true
        }
      ]
    }
  ]
}
```

## Permission Management

### Role Hierarchy
Ensure proper role hierarchy for bot functionality:

```javascript
{
  roleHierarchy: {
    botRole: "987654321098765432",      // Bot's role
    manageableRoles: [                  // Roles bot can assign
      "111222333444555666",  // Color roles
      "222333444555666777",  // Interest roles  
      "333444555666777888"   // Notification roles
    ],
    protectedRoles: [                   // Roles bot cannot assign
      "456789123456789123",  // Admin role
      "789123456789123456"   // Moderator role
    ]
  }
}
```

### Permission Checks
Automated permission validation:

```javascript
function validateRolePermissions(guildId, roleId) {
  return {
    canAssign: checkHierarchy(roleId),
    isProtected: isProtectedRole(roleId),
    hasPermissions: botHasManageRoles(),
    warnings: [
      "Role is higher than bot role",
      "Missing Manage Roles permission"
    ]
  };
}
```

### Auto-Sync Permissions
Automatically sync role permissions when needed:

```javascript
{
  permissionSync: {
    enabled: true,
    syncOnRoleUpdate: true,
    syncChannels: [
      "123456789012345678", // Category channel
      "987654321098765432"  // Text channel
    ],
    syncPermissions: [
      "VIEW_CHANNEL",
      "SEND_MESSAGES",
      "READ_MESSAGE_HISTORY"
    ]
  }
}
```

## API Reference

### Get Role Configuration
```http
GET /api/moderation/roles/config
Headers:
  x-guild-id: {guildId}
```

### Update Role Settings
```http
PUT /api/moderation/roles/config
Headers:
  x-guild-id: {guildId}
  Content-Type: application/json

Body:
{
  "enabled": true,
  "reactionRolesEnabled": true,
  "selfAssignableEnabled": true,
  "maxRolesPerUser": 10,
  "cooldownSeconds": 5
}
```

### Reaction Role Management
```http
# Get reaction roles for a message
GET /api/moderation/roles/reaction/{messageId}

# Add reaction role
POST /api/moderation/roles/reaction
{
  "messageId": "123456789012345678",
  "channelId": "987654321098765432",
  "emoji": "🎮",
  "roleId": "111222333444555666",
  "exclusiveGroup": "gaming"
}

# Remove reaction role
DELETE /api/moderation/roles/reaction/{messageId}/{emoji}
```

### Self-Assignable Role Management
```http
# Get self-assignable roles
GET /api/moderation/roles/selfassignable

# Add self-assignable role
POST /api/moderation/roles/selfassignable
{
  "roleId": "123456789012345678",
  "category": "interests",
  "description": "Gaming enthusiast role",
  "aliases": ["gaming", "gamer"]
}

# Update self-assignable role
PUT /api/moderation/roles/selfassignable/{roleId}
{
  "description": "Updated description",
  "cooldown": 300
}
```

### Role Menu Management
```http
# Create role menu
POST /api/moderation/roles/menu
{
  "channelId": "987654321098765432",
  "type": "dropdown",
  "title": "Gaming Roles",
  "options": [
    {
      "label": "Minecraft",
      "roleId": "111222333444555666",
      "emoji": "⛏️"
    }
  ]
}

# Update role menu
PUT /api/moderation/roles/menu/{messageId}
```

## Examples

### Gaming Server Setup
```javascript
{
  enabled: true,
  reactionRolesEnabled: true,
  selfAssignableEnabled: true,
  
  // Gaming-focused configuration
  reactionRoles: [
    {
      messageId: "123456789012345678",
      title: "🎮 Gaming Roles",
      description: "React to get roles for your favorite games!",
      roles: [
        { emoji: "⛏️", roleId: "111222333444555666", name: "Minecraft" },
        { emoji: "🎯", roleId: "222333444555666777", name: "Valorant" },
        { emoji: "🚗", roleId: "333444555666777888", name: "Rocket League" },
        { emoji: "👑", roleId: "444555666777888999", name: "League of Legends" }
      ],
      exclusive: false
    },
    {
      messageId: "987654321098765432", 
      title: "🔔 Notification Roles",
      description: "Choose what you want to be notified about",
      roles: [
        { emoji: "📢", roleId: "555666777888999000", name: "Announcements" },
        { emoji: "🎉", roleId: "666777888999000111", name: "Events" },
        { emoji: "🏆", roleId: "777888999000111222", name: "Tournaments" }
      ],
      exclusive: false
    }
  ],
  
  selfAssignableRoles: [
    {
      roleId: "888999000111222333",
      name: "LFG",
      category: "gaming",
      description: "Looking for group - find teammates!",
      aliases: ["lfg", "lookingforgroup"]
    }
  ]
}
```

### Community Server Setup
```javascript
{
  enabled: true,
  reactionRolesEnabled: true,
  selfAssignableEnabled: true,
  
  // Community-focused configuration
  categories: {
    "colors": {
      name: "🎨 Color Roles",
      maxRoles: 1,
      exclusive: true
    },
    "interests": {
      name: "🎯 Interest Roles", 
      maxRoles: 5,
      exclusive: false
    },
    "pronouns": {
      name: "✨ Pronoun Roles",
      maxRoles: 3,
      exclusive: false
    }
  },
  
  reactionRoles: [
    {
      messageId: "123456789012345678",
      title: "🎨 Pick Your Color",
      exclusiveGroup: "colors",
      roles: [
        { emoji: "🔴", roleId: "111111111111111111", name: "Red" },
        { emoji: "🔵", roleId: "222222222222222222", name: "Blue" },
        { emoji: "🟢", roleId: "333333333333333333", name: "Green" },
        { emoji: "🟡", roleId: "444444444444444444", name: "Yellow" },
        { emoji: "🟣", roleId: "555555555555555555", name: "Purple" }
      ]
    }
  ],
  
  selfAssignableRoles: [
    {
      roleId: "666666666666666666",
      name: "Artist",
      category: "interests",
      description: "Creative community member"
    },
    {
      roleId: "777777777777777777", 
      name: "They/Them",
      category: "pronouns",
      description: "They/them pronouns"
    }
  ]
}
```

### Educational Server Setup
```javascript
{
  enabled: true,
  reactionRolesEnabled: true,
  selfAssignableEnabled: true,
  requireVerification: true,
  minAccountAge: 30, // 30 days for new accounts
  
  // Education-focused configuration
  reactionRoles: [
    {
      messageId: "123456789012345678",
      title: "📚 Subject Roles",
      description: "Get access to subject-specific channels",
      roles: [
        { emoji: "🧮", roleId: "111111111111111111", name: "Mathematics" },
        { emoji: "🔬", roleId: "222222222222222222", name: "Science" },
        { emoji: "📖", roleId: "333333333333333333", name: "Literature" },
        { emoji: "🌍", roleId: "444444444444444444", name: "History" },
        { emoji: "💻", roleId: "555555555555555555", name: "Computer Science" }
      ]
    },
    {
      messageId: "987654321098765432",
      title: "🎓 Grade Level",
      description: "Select your current grade level",
      exclusiveGroup: "grade",
      roles: [
        { emoji: "9️⃣", roleId: "666666666666666666", name: "Grade 9" },
        { emoji: "🔟", roleId: "777777777777777777", name: "Grade 10" },
        { emoji: "1️⃣1️⃣", roleId: "888888888888888888", name: "Grade 11" },
        { emoji: "1️⃣2️⃣", roleId: "999999999999999999", name: "Grade 12" }
      ]
    }
  ]
}
```

## Troubleshooting

### Common Issues

#### Reaction Roles Not Working
1. **Bot Permissions**: Ensure bot has "Manage Roles" permission
2. **Role Hierarchy**: Bot role must be above assignable roles
3. **Message Access**: Bot needs "Read Message History" in channel
4. **Emoji Format**: Verify custom emoji format is correct

#### Self-Assignable Commands Failing
1. **Slash Command Registration**: Ensure commands are registered
2. **Permission Scope**: Check if commands work in allowed channels only
3. **Cooldown Issues**: Verify user isn't on cooldown
4. **Role Conflicts**: Check for conflicting roles

#### Performance Issues
1. **Database Optimization**: Index message_id and role_id columns
2. **Cache Management**: Cache frequently accessed role data
3. **Rate Limiting**: Implement proper rate limiting for role changes
4. **Batch Operations**: Process multiple role changes together

### Debug Information

Enable role management debugging:
```bash
DEBUG_ROLES=true
```

Common log entries:
```
[ROLES] Processing reaction add: 🎮 for user 123456789012345678
[ROLES] Assigning role Gaming (111222333444555666) to user
[ROLES] Removing conflicting role Red (222222222222222222)
[ROLES] Role assignment completed successfully
```

### Best Practices

#### Role Organization
1. **Clear Categories**: Group similar roles together
2. **Logical Hierarchy**: Order roles by importance
3. **Descriptive Names**: Use clear, descriptive role names
4. **Color Coding**: Use colors to distinguish role types

#### User Experience
1. **Simple Instructions**: Clear guidance for users
2. **Visual Feedback**: Confirm role assignments
3. **Error Handling**: Graceful error messages
4. **Help Commands**: Provide role help information

#### Performance
1. **Efficient Queries**: Optimize database queries
2. **Smart Caching**: Cache role configurations
3. **Batch Processing**: Group role operations
4. **Monitor Usage**: Track role assignment patterns

---

**Next Steps:**
- Set up basic reaction roles
- Configure self-assignable roles
- Test role hierarchy
- Monitor for permission issues
- Gather user feedback

For more information, see the [Moderation Overview](MODERATION_OVERVIEW.md).
