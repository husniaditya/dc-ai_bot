# Scheduled Messages System Documentation

The Scheduled Messages System automates announcements, reminders, and recurring messages to keep your community informed and engaged.

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [Scheduling Syntax](#scheduling-syntax)
4. [Message Types](#message-types)
5. [Variables](#variables)
6. [API Reference](#api-reference)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

## Overview

### Features
- **Cron-based Scheduling**: Flexible timing with cron expressions
- **Multiple Message Types**: Text, embeds, and rich content
- **Channel Targeting**: Send to specific channels
- **Variable Support**: Dynamic content with placeholders
- **Enable/Disable Toggles**: Control individual messages
- **Time Zone Support**: Schedule in different time zones
- **Recurring Messages**: Daily, weekly, monthly patterns
- **One-time Messages**: Schedule future announcements

### Use Cases
- Daily/weekly announcements
- Event reminders
- Community challenges
- Server statistics updates
- Motivational messages
- Rule reminders
- Maintenance notifications
- Special occasion greetings

## Configuration

### Basic Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `enabled` | Boolean | Enable/disable scheduler | `false` |
| `timezone` | String | Server timezone (e.g., "America/New_York") | `"UTC"` |
| `maxMessages` | Number | Maximum scheduled messages | `50` |
| `logChannelId` | String | Channel for scheduler logs | `null` |
| `failureRetries` | Number | Retry attempts for failed sends | `3` |
| `retryDelay` | Number | Delay between retries (seconds) | `60` |

### Message Structure

```javascript
{
  id: "unique_message_id",
  name: "Daily Announcement",
  description: "Daily server announcement",
  enabled: true,
  channelId: "123456789012345678",
  cronExpression: "0 9 * * *", // Daily at 9 AM
  timezone: "America/New_York",
  
  // Message content
  content: {
    type: "embed", // "text", "embed", or "rich"
    text: "Good morning, {server}!",
    embed: {
      title: "📅 Daily Announcement",
      description: "Welcome to a new day in {server}!",
      color: "#5865F2",
      fields: [
        {
          name: "📊 Stats",
          value: "Members: {memberCount}\nOnline: {onlineCount}",
          inline: true
        }
      ],
      footer: {
        text: "Generated at {timestamp}"
      }
    }
  },
  
  // Scheduling options
  scheduling: {
    startDate: "2024-01-01T00:00:00Z",
    endDate: null, // Never expires
    maxExecutions: null, // Unlimited
    executionCount: 0
  },
  
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z"
}
```

### Dashboard Configuration

```javascript
{
  enabled: true,
  timezone: "America/New_York",
  maxMessages: 50,
  logChannelId: "123456789012345678",
  
  messages: [
    {
      id: "daily_announcement",
      name: "Daily Good Morning",
      enabled: true,
      channelId: "987654321098765432",
      cronExpression: "0 9 * * *",
      content: {
        type: "embed",
        embed: {
          title: "🌅 Good Morning!",
          description: "Welcome to a new day in {server}!",
          color: "#FFD700"
        }
      }
    },
    {
      id: "weekly_reminder",
      name: "Weekly Event Reminder",
      enabled: true,
      channelId: "456789123456789123",
      cronExpression: "0 18 * * 5", // Friday 6 PM
      content: {
        type: "text",
        text: "🎉 Don't forget about our weekly event tomorrow at 8 PM! See you there!"
      }
    }
  ]
}
```

## Scheduling Syntax

### Cron Expression Format
```
* * * * * *
| | | | | |
| | | | | +-- Year (optional)
| | | | +---- Day of Week (0-7, 0 and 7 are Sunday)
| | | +------ Month (1-12)
| | +-------- Day of Month (1-31)
| +---------- Hour (0-23)
+------------ Minute (0-59)
```

### Common Patterns

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Every minute | `* * * * *` | Testing purposes only |
| Every hour | `0 * * * *` | At the start of each hour |
| Daily at 9 AM | `0 9 * * *` | Every day at 9:00 AM |
| Weekly on Monday 9 AM | `0 9 * * 1` | Every Monday at 9:00 AM |
| Monthly on 1st at noon | `0 12 1 * *` | 1st of each month at noon |
| Weekdays at 5 PM | `0 17 * * 1-5` | Monday-Friday at 5:00 PM |
| Every 15 minutes | `*/15 * * * *` | Every 15 minutes |
| Twice daily | `0 9,21 * * *` | At 9 AM and 9 PM |

### Advanced Expressions

```javascript
{
  // Every 30 minutes during business hours (9 AM - 5 PM), weekdays only
  cronExpression: "*/30 9-17 * * 1-5",
  
  // Every 2 hours on weekends
  cronExpression: "0 */2 * * 0,6",
  
  // First Monday of each month at 10 AM
  cronExpression: "0 10 1-7 * 1",
  
  // Last day of each month at midnight
  cronExpression: "0 0 28-31 * *", // Needs additional logic
  
  // Every quarter (Jan, Apr, Jul, Oct) on the 1st at noon
  cronExpression: "0 12 1 1,4,7,10 *"
}
```

### Time Zone Handling

```javascript
{
  // Global server timezone
  timezone: "America/New_York",
  
  // Individual message timezone override
  messages: [
    {
      id: "eu_announcement",
      cronExpression: "0 9 * * *",
      timezone: "Europe/London", // Override global timezone
      content: { /* ... */ }
    },
    {
      id: "asia_announcement", 
      cronExpression: "0 9 * * *",
      timezone: "Asia/Tokyo",
      content: { /* ... */ }
    }
  ]
}
```

## Message Types

### Text Messages
Simple text announcements:

```javascript
{
  content: {
    type: "text",
    text: "🎮 Game night starts in 1 hour! Join us in voice chat!"
  }
}
```

### Embed Messages
Rich formatted content:

```javascript
{
  content: {
    type: "embed",
    embed: {
      title: "📊 Daily Server Stats",
      description: "Here are today's statistics for {server}",
      color: "#5865F2",
      thumbnail: {
        url: "{serverIcon}"
      },
      fields: [
        {
          name: "👥 Members",
          value: "{memberCount}",
          inline: true
        },
        {
          name: "🟢 Online",
          value: "{onlineCount}",
          inline: true
        },
        {
          name: "📈 Growth",
          value: "+{newMembersToday} today",
          inline: true
        }
      ],
      footer: {
        text: "Updated {timestamp}",
        icon_url: "{botAvatar}"
      },
      timestamp: true
    }
  }
}
```

### Rich Messages
Complex messages with multiple embeds and components:

```javascript
{
  content: {
    type: "rich",
    text: "📅 **Weekly Server Update**",
    embeds: [
      {
        title: "📊 Statistics",
        fields: [
          { name: "Members", value: "{memberCount}", inline: true },
          { name: "Online", value: "{onlineCount}", inline: true }
        ],
        color: "#00FF00"
      },
      {
        title: "📰 News",
        description: "This week's highlights and announcements",
        color: "#FF6B35"
      }
    ],
    components: [
      {
        type: "ACTION_ROW",
        components: [
          {
            type: "BUTTON",
            style: "LINK",
            label: "Server Rules",
            url: "https://your-website.com/rules"
          },
          {
            type: "BUTTON", 
            style: "LINK",
            label: "Discord Server",
            url: "https://discord.gg/your-invite"
          }
        ]
      }
    ]
  }
}
```

### Conditional Content
Messages that change based on conditions:

```javascript
{
  content: {
    type: "conditional",
    conditions: [
      {
        condition: "memberCount > 1000",
        content: {
          type: "embed",
          embed: {
            title: "🎉 Over 1,000 Members!",
            description: "Our community is growing strong!",
            color: "#FFD700"
          }
        }
      },
      {
        condition: "dayOfWeek === 'friday'",
        content: {
          type: "text", 
          text: "🎉 It's Friday! Have a great weekend everyone!"
        }
      }
    ],
    default: {
      type: "text",
      text: "Good day, {server}! 👋"
    }
  }
}
```

## Variables

### Server Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `{server}` | Server name | `My Awesome Server` |
| `{serverIcon}` | Server icon URL | `https://cdn.discordapp.com/icons/...` |
| `{memberCount}` | Total member count | `1,234` |
| `{onlineCount}` | Online member count | `567` |
| `{boostLevel}` | Server boost level | `2` |
| `{boostCount}` | Number of boosts | `14` |

### Date/Time Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `{timestamp}` | Current timestamp | `January 15, 2024 at 10:30 AM` |
| `{date}` | Current date | `January 15, 2024` |
| `{time}` | Current time | `10:30 AM` |
| `{dayOfWeek}` | Day of the week | `Monday` |
| `{month}` | Current month | `January` |
| `{year}` | Current year | `2024` |

### Channel Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `{general}` | General channel mention | `<#123456789012345678>` |
| `{rules}` | Rules channel mention | `<#987654321098765432>` |
| `{announcements}` | Announcements channel | `<#456789123456789123>` |

### Statistics Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `{newMembersToday}` | New members today | `5` |
| `{newMembersWeek}` | New members this week | `23` |
| `{messagesWeek}` | Messages this week | `1,456` |
| `{activeUsers}` | Active users (7 days) | `234` |

### Custom Variables
Define server-specific variables:

```javascript
{
  customVariables: {
    "eventTime": "8:00 PM EST",
    "website": "https://your-website.com",
    "discordInvite": "https://discord.gg/your-invite",
    "nextEvent": "Community Game Night",
    "eventDate": "Saturday, January 20th"
  }
}
```

## API Reference

### Get Scheduler Configuration
```http
GET /api/moderation/scheduler/config
Headers:
  x-guild-id: {guildId}
```

### Update Scheduler Settings
```http
PUT /api/moderation/scheduler/config
Headers:
  x-guild-id: {guildId}
  Content-Type: application/json

Body:
{
  "enabled": true,
  "timezone": "America/New_York",
  "maxMessages": 50,
  "logChannelId": "123456789012345678"
}
```

### Scheduled Message Management
```http
# Get all scheduled messages
GET /api/moderation/scheduler/messages

# Create scheduled message
POST /api/moderation/scheduler/messages
{
  "name": "Daily Announcement",
  "channelId": "123456789012345678",
  "cronExpression": "0 9 * * *",
  "content": {
    "type": "text",
    "text": "Good morning, {server}!"
  }
}

# Update scheduled message
PUT /api/moderation/scheduler/messages/{messageId}
{
  "enabled": false,
  "cronExpression": "0 10 * * *"
}

# Delete scheduled message
DELETE /api/moderation/scheduler/messages/{messageId}

# Test scheduled message
POST /api/moderation/scheduler/messages/{messageId}/test
```

### Execution History
```http
# Get execution history
GET /api/moderation/scheduler/history?limit=50

# Get message execution history
GET /api/moderation/scheduler/messages/{messageId}/history

# Get execution statistics
GET /api/moderation/scheduler/stats
```

## Examples

### Daily Community Updates
```javascript
{
  id: "daily_update",
  name: "Daily Community Update",
  enabled: true,
  channelId: "123456789012345678",
  cronExpression: "0 9 * * *", // 9 AM daily
  content: {
    type: "embed",
    embed: {
      title: "📅 Daily Update - {date}",
      description: "Good morning, {server}! Here's what's happening today.",
      color: "#5865F2",
      thumbnail: {
        url: "{serverIcon}"
      },
      fields: [
        {
          name: "📊 Community Stats",
          value: "Members: {memberCount}\nOnline: {onlineCount}\nNew Today: {newMembersToday}",
          inline: true
        },
        {
          name: "🎯 Today's Focus",
          value: "Share your projects in {general}!\nCheck out our {rules} if you're new!",
          inline: true
        }
      ],
      footer: {
        text: "Have a great day! • {timestamp}"
      }
    }
  }
}
```

### Weekly Event Reminders
```javascript
{
  id: "event_reminder",
  name: "Weekly Game Night Reminder",
  enabled: true,
  channelId: "987654321098765432",
  cronExpression: "0 18 * * 5", // Friday 6 PM
  content: {
    type: "rich",
    text: "@everyone",
    embeds: [
      {
        title: "🎮 Game Night Tomorrow!",
        description: "Join us for our weekly community game night!",
        color: "#FF6B35",
        fields: [
          {
            name: "📅 When",
            value: "Saturday at {eventTime}",
            inline: true
          },
          {
            name: "🎯 What",
            value: "{nextEvent}",
            inline: true
          },
          {
            name: "📍 Where", 
            value: "Community Voice Channels",
            inline: true
          }
        ],
        image: {
          url: "https://your-website.com/game-night-banner.png"
        }
      }
    ],
    components: [
      {
        type: "ACTION_ROW",
        components: [
          {
            type: "BUTTON",
            style: "SUCCESS",
            label: "Join Event",
            emoji: "🎮",
            custom_id: "join_game_night"
          }
        ]
      }
    ]
  }
}
```

### Monthly Server Statistics
```javascript
{
  id: "monthly_stats",
  name: "Monthly Statistics Report", 
  enabled: true,
  channelId: "456789123456789123",
  cronExpression: "0 12 1 * *", // 1st of month at noon
  content: {
    type: "embed",
    embed: {
      title: "📊 Monthly Server Report - {month} {year}",
      description: "Here's how our community performed this month!",
      color: "#FFD700",
      fields: [
        {
          name: "👥 Growth",
          value: "New Members: {newMembersMonth}\nTotal Members: {memberCount}",
          inline: true
        },
        {
          name: "💬 Activity",
          value: "Messages: {messagesMonth}\nActive Users: {activeUsersMonth}",
          inline: true
        },
        {
          name: "🎉 Highlights",
          value: "Level Ups: {levelUpsMonth}\nEvents Held: {eventsMonth}",
          inline: true
        }
      ],
      footer: {
        text: "Thank you for making our community amazing!"
      }
    }
  }
}
```

### Maintenance Notifications
```javascript
{
  id: "maintenance_notice", 
  name: "Maintenance Window Notification",
  enabled: false, // Manually enabled when needed
  channelId: "111222333444555666",
  cronExpression: "0 20 * * *", // 8 PM
  scheduling: {
    startDate: "2024-01-15T00:00:00Z",
    endDate: "2024-01-15T23:59:59Z", // One day only
    maxExecutions: 1
  },
  content: {
    type: "embed",
    embed: {
      title: "🔧 Scheduled Maintenance",
      description: "The bot will undergo maintenance tonight.",
      color: "#FFA500",
      fields: [
        {
          name: "⏰ When",
          value: "Tonight at 11 PM - 12 AM EST",
          inline: false
        },
        {
          name: "📋 What",
          value: "• Database optimization\n• Security updates\n• Feature improvements",
          inline: false
        },
        {
          name: "⚠️ Impact",
          value: "Some bot features may be temporarily unavailable",
          inline: false
        }
      ],
      footer: {
        text: "We apologize for any inconvenience"
      }
    }
  }
}
```

### Motivational Messages
```javascript
{
  id: "motivation_monday",
  name: "Motivational Monday",
  enabled: true,
  channelId: "222333444555666777",
  cronExpression: "0 8 * * 1", // Monday 8 AM
  content: {
    type: "text",
    messages: [ // Random selection
      "💪 It's Monday! Time to crush your goals this week!",
      "🌟 New week, new opportunities! What will you achieve?",
      "🚀 Monday motivation: You've got this, {server}!",
      "⭐ Start your week strong! We believe in you!",
      "🎯 Monday mindset: Progress over perfection!"
    ]
  }
}
```

## Troubleshooting

### Common Issues

#### Messages Not Sending
1. **Cron Expression**: Verify syntax is correct
2. **Channel Permissions**: Bot needs "Send Messages" permission
3. **Channel Existence**: Ensure target channel exists
4. **Time Zone**: Check timezone configuration
5. **Message Enabled**: Verify message is enabled

#### Incorrect Timing
1. **Server Time Zone**: Check bot server timezone
2. **Cron Syntax**: Validate cron expression
3. **Daylight Saving**: Account for DST changes
4. **Multiple Time Zones**: Use message-specific timezones

#### Variable Substitution Errors
1. **Variable Spelling**: Check variable names are correct
2. **Missing Data**: Ensure required data is available
3. **Permission Access**: Bot needs access to fetch data
4. **Custom Variables**: Verify custom variables are defined

### Debug Information

Enable scheduler debugging:
```bash
DEBUG_SCHEDULER=true
```

Common log entries:
```
[SCHEDULER] Evaluating cron: "0 9 * * *" for message daily_update
[SCHEDULER] Executing scheduled message: daily_update
[SCHEDULER] Substituting variables in message content
[SCHEDULER] Sending message to channel 123456789012345678
[SCHEDULER] Message sent successfully, execution logged
```

### Performance Considerations

#### Database Optimization
```sql
-- Index for efficient cron job queries
CREATE INDEX idx_scheduled_messages_next_run ON scheduled_messages (next_run_at, enabled);
CREATE INDEX idx_message_executions_date ON message_executions (executed_at DESC);

-- Cleanup old execution logs
DELETE FROM message_executions 
WHERE executed_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

#### Memory Management
```javascript
// Efficient cron job scheduling
function scheduleMessages() {
  // Load only active messages
  const activeMessages = getActiveScheduledMessages();
  
  // Clear old schedules
  clearExistingSchedules();
  
  // Schedule each message
  activeMessages.forEach(message => {
    scheduleMessage(message);
  });
}

// Cleanup completed one-time messages
function cleanupCompletedMessages() {
  const completed = getCompletedOneTimeMessages();
  completed.forEach(message => {
    if (message.maxExecutions && message.executionCount >= message.maxExecutions) {
      disableMessage(message.id);
    }
  });
}
```

### Best Practices

#### Message Design
1. **Clear Purpose**: Each message should have a specific purpose
2. **Appropriate Timing**: Schedule at optimal times for your community
3. **Consistent Formatting**: Use similar styles for related messages
4. **Value-Added Content**: Ensure messages provide value to users

#### Scheduling Strategy
1. **Avoid Spam**: Don't over-schedule messages
2. **Time Zone Awareness**: Consider your community's time zones
3. **Seasonal Adjustments**: Adjust for holidays and events
4. **Testing**: Test messages before enabling them

#### Performance
1. **Limit Active Messages**: Keep reasonable number of active schedules
2. **Efficient Variables**: Minimize expensive variable calculations
3. **Database Cleanup**: Regularly clean execution logs
4. **Monitor Resources**: Track scheduler performance

---

**Next Steps:**
- Configure basic scheduling settings
- Create your first scheduled message
- Test timing and content
- Monitor execution logs
- Expand with additional messages

For more information, see the [Moderation Overview](MODERATION_OVERVIEW.md).
