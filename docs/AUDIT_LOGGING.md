# Audit Logging System Documentation

The Audit Logging System tracks all moderation actions and server changes, providing comprehensive oversight and accountability for server management.

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [Log Types](#log-types)
4. [Channel Setup](#channel-setup)
5. [Log Formatting](#log-formatting)
6. [API Reference](#api-reference)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

## Overview

### Features
- **Message Logs**: Track message edits, deletions, and bulk operations
- **Member Logs**: Monitor joins, leaves, bans, kicks, and timeouts
- **Channel Logs**: Record channel/category creations, modifications, deletions
- **Role Logs**: Track role changes, assignments, and permissions
- **Moderation Actions**: Log all bot moderation activities
- **Server Changes**: Monitor server setting modifications
- **Invite Tracking**: Track invite usage and creation
- **Voice Activity**: Log voice channel joins/leaves

### Use Cases
- Accountability for moderation actions
- Investigation of rule violations
- Tracking server changes
- Member activity monitoring
- Security breach detection
- Compliance and record keeping
- Staff oversight and training

## Configuration

### Basic Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `enabled` | Boolean | Enable/disable audit logging | `false` |
| `logAllEvents` | Boolean | Log all available events | `true` |
| `retentionDays` | Number | Days to keep logs | `90` |
| `embedFormat` | Boolean | Use embed format for logs | `true` |
| `includeAttachments` | Boolean | Log message attachments | `true` |
| `timezone` | String | Timezone for timestamps | `"UTC"` |

### Channel Configuration

| Log Type | Setting | Description |
|----------|---------|-------------|
| Messages | `messageLogChannelId` | Message edit/delete logs |
| Members | `memberLogChannelId` | Join/leave/ban logs |
| Moderation | `moderationLogChannelId` | Bot moderation actions |
| Server | `serverLogChannelId` | Server setting changes |
| Voice | `voiceLogChannelId` | Voice activity logs |
| Invites | `inviteLogChannelId` | Invite creation/usage |

### Event Filtering

```javascript
{
  eventFilters: {
    messages: {
      enabled: true,
      logEdits: true,
      logDeletes: true,
      logBulkDeletes: true,
      excludeBots: true,
      excludeChannels: [
        "123456789012345678", // #bot-commands
        "987654321098765432"  // #spam
      ],
      minContentLength: 5 // Don't log very short messages
    },
    
    members: {
      enabled: true,
      logJoins: true,
      logLeaves: true,
      logBans: true,
      logKicks: true,
      logTimeouts: true,
      logNickChanges: true,
      logRoleChanges: true
    },
    
    channels: {
      enabled: true,
      logCreates: true,
      logDeletes: true,
      logUpdates: true,
      logPermissionChanges: true
    },
    
    roles: {
      enabled: true,
      logCreates: true,
      logDeletes: true,
      logUpdates: true,
      logAssignments: true
    },
    
    server: {
      enabled: true,
      logSettings: true,
      logBoosts: true,
      logEmojis: true,
      logWebhooks: true
    }
  }
}
```

### Dashboard Configuration

```javascript
{
  enabled: true,
  logAllEvents: true,
  retentionDays: 90,
  embedFormat: true,
  timezone: "America/New_York",
  
  // Channel assignments
  channels: {
    messageLogChannelId: "111222333444555666",
    memberLogChannelId: "222333444555666777", 
    moderationLogChannelId: "333444555666777888",
    serverLogChannelId: "444555666777888999",
    voiceLogChannelId: "555666777888999000",
    inviteLogChannelId: "666777888999000111"
  },
  
  // Event configuration
  events: {
    messages: {
      enabled: true,
      excludeBots: true,
      excludeChannels: ["777888999000111222"]
    },
    members: {
      enabled: true,
      includeInviteSource: true
    },
    moderation: {
      enabled: true,
      includeReasons: true,
      includeDuration: true
    }
  }
}
```

## Log Types

### Message Logs

#### Message Edits
```javascript
{
  type: "MESSAGE_EDIT",
  messageId: "123456789012345678",
  channelId: "987654321098765432",
  userId: "456789123456789123",
  timestamp: "2024-01-15T10:30:00Z",
  
  before: {
    content: "Original message content",
    attachments: [],
    embeds: []
  },
  
  after: {
    content: "Edited message content", 
    attachments: [],
    embeds: []
  },
  
  metadata: {
    editCount: 1,
    timeSinceCreation: 120000 // 2 minutes
  }
}
```

#### Message Deletions
```javascript
{
  type: "MESSAGE_DELETE",
  messageId: "123456789012345678",
  channelId: "987654321098765432", 
  userId: "456789123456789123",
  timestamp: "2024-01-15T10:30:00Z",
  
  content: {
    text: "Deleted message content",
    attachments: [
      {
        name: "image.png",
        url: "https://cdn.discordapp.com/attachments/...",
        size: 1024576
      }
    ],
    embeds: [],
    reactions: ["👍", "❤️"]
  },
  
  deletedBy: {
    userId: "789123456789123456", // Moderator who deleted
    isBot: true,
    reason: "Spam content"
  }
}
```

#### Bulk Deletions
```javascript
{
  type: "BULK_DELETE",
  channelId: "987654321098765432",
  deletedBy: "789123456789123456",
  timestamp: "2024-01-15T10:30:00Z",
  
  messages: [
    {
      messageId: "111111111111111111",
      userId: "222222222222222222",
      content: "Message 1 content",
      createdAt: "2024-01-15T10:25:00Z"
    },
    {
      messageId: "333333333333333333", 
      userId: "444444444444444444",
      content: "Message 2 content",
      createdAt: "2024-01-15T10:26:00Z"
    }
  ],
  
  metadata: {
    totalDeleted: 50,
    reason: "Raid cleanup",
    method: "bot_command"
  }
}
```

### Member Logs

#### Member Joins
```javascript
{
  type: "MEMBER_JOIN",
  userId: "123456789012345678",
  timestamp: "2024-01-15T10:30:00Z",
  
  user: {
    username: "NewUser",
    discriminator: "1234",
    avatarUrl: "https://cdn.discordapp.com/avatars/...",
    accountCreated: "2024-01-01T00:00:00Z",
    isBot: false
  },
  
  invite: {
    code: "abc123",
    inviterId: "987654321098765432",
    inviterName: "ModeratorName",
    uses: 5
  },
  
  metadata: {
    memberNumber: 1234,
    accountAge: 14, // days
    joinMethod: "invite_link"
  }
}
```

#### Member Leaves
```javascript
{
  type: "MEMBER_LEAVE",
  userId: "123456789012345678", 
  timestamp: "2024-01-15T10:30:00Z",
  
  user: {
    username: "FormerUser",
    discriminator: "1234",
    displayName: "Display Name",
    avatarUrl: "https://cdn.discordapp.com/avatars/..."
  },
  
  membership: {
    joinedAt: "2024-01-01T00:00:00Z",
    timeInServer: 1209600000, // 14 days in ms
    roles: [
      {
        roleId: "111222333444555666",
        roleName: "Member"
      }
    ],
    lastActive: "2024-01-14T15:30:00Z"
  },
  
  reason: "voluntary_leave" // or "kick", "ban"
}
```

#### Moderation Actions
```javascript
{
  type: "MEMBER_BAN",
  targetUserId: "123456789012345678",
  moderatorId: "987654321098765432",
  timestamp: "2024-01-15T10:30:00Z",
  
  action: {
    type: "ban",
    reason: "Violation of server rules",
    duration: null, // Permanent
    deleteMessageDays: 7
  },
  
  target: {
    username: "ViolatingUser",
    discriminator: "1234",
    displayName: "Display Name"
  },
  
  moderator: {
    username: "ModeratorName",
    discriminator: "5678",
    isBot: true
  }
}
```

### Server Logs

#### Channel Changes
```javascript
{
  type: "CHANNEL_UPDATE",
  channelId: "123456789012345678",
  moderatorId: "987654321098765432",
  timestamp: "2024-01-15T10:30:00Z",
  
  changes: [
    {
      field: "name",
      before: "old-channel-name",
      after: "new-channel-name"
    },
    {
      field: "topic", 
      before: "Old topic",
      after: "New topic"
    },
    {
      field: "slowmode",
      before: 0,
      after: 5
    }
  ]
}
```

#### Role Changes
```javascript
{
  type: "ROLE_UPDATE",
  roleId: "123456789012345678",
  moderatorId: "987654321098765432", 
  timestamp: "2024-01-15T10:30:00Z",
  
  changes: [
    {
      field: "name",
      before: "Old Role Name",
      after: "New Role Name"
    },
    {
      field: "permissions",
      before: ["SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
      after: ["SEND_MESSAGES", "READ_MESSAGE_HISTORY", "EMBED_LINKS"]
    },
    {
      field: "color",
      before: "#000000",
      after: "#FF0000"
    }
  ]
}
```

### Voice Logs

#### Voice Activity
```javascript
{
  type: "VOICE_STATE_UPDATE",
  userId: "123456789012345678",
  timestamp: "2024-01-15T10:30:00Z",
  
  before: {
    channelId: null,
    muted: false,
    deafened: false,
    streaming: false
  },
  
  after: {
    channelId: "987654321098765432",
    muted: false, 
    deafened: false,
    streaming: false
  },
  
  action: "join", // "join", "leave", "move", "mute", "unmute"
  metadata: {
    sessionDuration: null, // For leaves
    channelName: "General Voice"
  }
}
```

## Channel Setup

### Recommended Channel Structure

```
📋 Server Logs
├── 📝 #message-logs
├── 👥 #member-logs  
├── 🛡️ #moderation-logs
├── ⚙️ #server-logs
├── 🔊 #voice-logs
└── 📨 #invite-logs
```

### Channel Permissions

Each log channel should have:

```javascript
{
  permissions: [
    {
      id: "botRoleId",
      type: "role",
      allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "EMBED_LINKS", "ATTACH_FILES"]
    },
    {
      id: "moderatorRoleId", 
      type: "role",
      allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"]
    },
    {
      id: "@everyone",
      type: "role",
      deny: ["VIEW_CHANNEL"]
    }
  ]
}
```

### Channel Topics

Set descriptive topics for organization:

```javascript
{
  channels: {
    messageLogChannelId: {
      topic: "📝 Message edits, deletions, and bulk operations"
    },
    memberLogChannelId: {
      topic: "👥 Member joins, leaves, bans, kicks, and role changes"
    },
    moderationLogChannelId: {
      topic: "🛡️ Bot moderation actions and punishments"
    },
    serverLogChannelId: {
      topic: "⚙️ Server settings, channel/role changes, and configuration updates"
    },
    voiceLogChannelId: {
      topic: "🔊 Voice channel activity and state changes"
    },
    inviteLogChannelId: {
      topic: "📨 Invite creation, usage, and tracking"
    }
  }
}
```

## Log Formatting

### Embed Format
Rich embed logs with color coding:

```javascript
{
  messageEdit: {
    color: "#FFA500", // Orange
    title: "📝 Message Edited",
    fields: [
      {
        name: "User",
        value: "{user} ({userId})",
        inline: true
      },
      {
        name: "Channel", 
        value: "{channel}",
        inline: true
      },
      {
        name: "Before",
        value: "```{beforeContent}```",
        inline: false
      },
      {
        name: "After",
        value: "```{afterContent}```", 
        inline: false
      }
    ],
    footer: {
      text: "Message ID: {messageId}"
    },
    timestamp: true
  }
}
```

### Color Coding System

| Event Type | Color | Hex Code |
|------------|-------|----------|
| Message Edit | Orange | `#FFA500` |
| Message Delete | Red | `#FF0000` |
| Member Join | Green | `#00FF00` |
| Member Leave | Yellow | `#FFFF00` |
| Member Ban | Dark Red | `#800000` |
| Channel Create | Blue | `#0000FF` |
| Channel Delete | Purple | `#800080` |
| Role Update | Cyan | `#00FFFF` |
| Server Update | Gold | `#FFD700` |
| Voice Activity | Light Blue | `#87CEEB` |

### Text Format
Simple text logs for high-volume events:

```javascript
{
  messageDelete: {
    format: "[{timestamp}] 🗑️ Message deleted in {channel} by {user}: {content}"
  },
  memberJoin: {
    format: "[{timestamp}] ➕ {user} joined the server (Member #{memberNumber})"
  },
  memberLeave: {
    format: "[{timestamp}] ➖ {user} left the server (Joined {joinDate})"
  }
}
```

## API Reference

### Get Audit Log Configuration
```http
GET /api/moderation/audit/config
Headers:
  x-guild-id: {guildId}
```

### Update Audit Settings
```http
PUT /api/moderation/audit/config
Headers:
  x-guild-id: {guildId}
  Content-Type: application/json

Body:
{
  "enabled": true,
  "logAllEvents": true,
  "retentionDays": 90,
  "channels": {
    "messageLogChannelId": "123456789012345678",
    "memberLogChannelId": "987654321098765432"
  }
}
```

### Query Audit Logs
```http
# Get recent logs
GET /api/moderation/audit/logs?type=message&limit=50

# Search logs by user
GET /api/moderation/audit/logs?userId=123456789012345678&days=7

# Search logs by event type
GET /api/moderation/audit/logs?eventType=MEMBER_BAN&startDate=2024-01-01

# Get log statistics
GET /api/moderation/audit/stats?period=week
```

### Export Logs
```http
# Export logs as JSON
GET /api/moderation/audit/export?format=json&startDate=2024-01-01&endDate=2024-01-31

# Export logs as CSV
GET /api/moderation/audit/export?format=csv&type=moderation&days=30
```

## Examples

### Gaming Server Setup
```javascript
{
  enabled: true,
  logAllEvents: true,
  retentionDays: 60, // Shorter retention for active server
  
  channels: {
    messageLogChannelId: "111222333444555666",
    memberLogChannelId: "222333444555666777",
    moderationLogChannelId: "333444555666777888",
    voiceLogChannelId: "444555666777888999" // Important for gaming
  },
  
  events: {
    messages: {
      enabled: true,
      excludeChannels: [
        "555666777888999000", // #game-chat (too active)
        "666777888999000111"  // #memes
      ],
      minContentLength: 10
    },
    
    voice: {
      enabled: true,
      logJoins: true,
      logLeaves: true,
      logMoves: true,
      excludeChannels: [
        "777888999000111222" // AFK channel
      ]
    },
    
    members: {
      enabled: true,
      includeInviteSource: true,
      trackMemberNumber: true
    }
  }
}
```

### Business/Professional Server
```javascript
{
  enabled: true,
  logAllEvents: true,
  retentionDays: 365, // Long retention for compliance
  
  channels: {
    messageLogChannelId: "111222333444555666",
    memberLogChannelId: "222333444555666777", 
    moderationLogChannelId: "333444555666777888",
    serverLogChannelId: "444555666777888999",
    inviteLogChannelId: "555666777888999000"
  },
  
  events: {
    messages: {
      enabled: true,
      logEdits: true,
      logDeletes: true,
      excludeBots: false, // Log bot messages for compliance
      minContentLength: 1  // Log all content
    },
    
    server: {
      enabled: true,
      logSettings: true,
      logChannelChanges: true,
      logRoleChanges: true,
      logPermissionChanges: true
    },
    
    members: {
      enabled: true,
      logNickChanges: true,
      logRoleAssignments: true,
      includeInviteSource: true
    }
  }
}
```

### Educational Server
```javascript
{
  enabled: true,
  logAllEvents: false, // Selective logging
  retentionDays: 180,  // Academic year retention
  
  channels: {
    memberLogChannelId: "111222333444555666",
    moderationLogChannelId: "222333444555666777"
  },
  
  events: {
    messages: {
      enabled: false // Don't log student messages for privacy
    },
    
    members: {
      enabled: true,
      logJoins: true,
      logLeaves: true,
      logRoleChanges: true // Track class enrollment
    },
    
    moderation: {
      enabled: true,
      includeReasons: true,
      logWarnings: true,
      logTimeouts: true
    },
    
    server: {
      enabled: true,
      logChannelChanges: true, // Track class channel changes
      logRoleChanges: true     // Track permission changes
    }
  }
}
```

## Troubleshooting

### Common Issues

#### Logs Not Appearing
1. **Channel Permissions**: Bot needs "Send Messages" and "Embed Links"
2. **Channel Configuration**: Verify log channels are set correctly
3. **Event Filtering**: Check if events are enabled and not filtered out
4. **Bot Status**: Ensure bot is online and responsive

#### Missing Log Data
1. **Event Scope**: Some events require specific Discord permissions
2. **Cache Issues**: Bot may miss events during downtime
3. **Rate Limiting**: High-activity servers may hit Discord limits
4. **Filter Settings**: Events may be excluded by configuration

#### Performance Issues
1. **Database Size**: Large log tables can slow queries
2. **Retention Settings**: Shorter retention improves performance
3. **Index Optimization**: Ensure proper database indexing
4. **Log Volume**: High-activity servers need optimization

### Debug Information

Enable audit logging debugging:
```bash
DEBUG_AUDIT=true
```

Common log entries:
```
[AUDIT] Processing MESSAGE_DELETE event for message 123456789012345678
[AUDIT] Formatting log entry for channel 987654321098765432
[AUDIT] Sending audit log to channel 111222333444555666
[AUDIT] Log entry sent successfully
```

### Database Optimization

#### Indexing Strategy
```sql
-- Optimize audit log queries
CREATE INDEX idx_audit_logs_guild_type_date ON audit_logs (guild_id, event_type, created_at DESC);
CREATE INDEX idx_audit_logs_user_date ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_channel_date ON audit_logs (channel_id, created_at DESC);

-- Partition large tables by date for performance
ALTER TABLE audit_logs PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
  PARTITION p_2024_01 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
  PARTITION p_2024_02 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
  -- Continue for each month
);
```

#### Cleanup Procedures
```sql
-- Automated cleanup for retention policy
CREATE EVENT cleanup_audit_logs
ON SCHEDULE EVERY 1 DAY
DO
  DELETE FROM audit_logs 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Archive old logs instead of deleting
CREATE TABLE audit_logs_archive LIKE audit_logs;

INSERT INTO audit_logs_archive 
SELECT * FROM audit_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

DELETE FROM audit_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

### Best Practices

#### Security and Privacy
1. **Access Control**: Limit log channel access to authorized staff
2. **Data Retention**: Follow local privacy laws and regulations
3. **Sensitive Content**: Be careful with logging personal information
4. **Export Security**: Secure log exports and backups

#### Performance
1. **Selective Logging**: Don't log everything if not needed
2. **Regular Cleanup**: Implement log rotation and archival
3. **Database Optimization**: Maintain proper indexes
4. **Monitor Resource Usage**: Track bot performance impact

#### Organization
1. **Clear Channel Structure**: Use descriptive names and topics
2. **Consistent Formatting**: Maintain uniform log formats
3. **Regular Reviews**: Periodically review log configuration
4. **Staff Training**: Ensure moderators understand log system

---

**Next Steps:**
- Set up log channels with proper permissions
- Configure event filtering for your needs
- Test logging functionality
- Establish log review procedures
- Train staff on log interpretation

For more information, see the [Moderation Overview](MODERATION_OVERVIEW.md).
