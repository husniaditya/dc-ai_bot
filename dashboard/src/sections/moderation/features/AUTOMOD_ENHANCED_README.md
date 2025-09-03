# Auto Moderation System - Enhanced Configuration

## Overview

The Auto Moderation system has been enhanced with a comprehensive rule-based configuration interface that allows server administrators to create, manage, and customize automated content filtering rules based on the database table structure.

## Features

### 🛡️ Rule-Based Auto Moderation
- **Custom Rules**: Create multiple auto moderation rules with specific triggers and actions
- **Flexible Triggers**: Support for spam, caps, links, invite links, profanity, and mention spam detection
- **Multiple Actions**: Configurable actions including delete, warn, mute, kick, and ban
- **Threshold Configuration**: Set violation thresholds before actions are taken
- **Duration Control**: Specify duration for temporary actions (mute, temporary ban)

### 🎯 Advanced Targeting
- **Channel Whitelisting**: Exclude specific channels from rule enforcement
- **Role Whitelisting**: Exempt specific roles from individual rules
- **Global Bypass Roles**: Set roles that bypass all auto moderation rules
- **Individual Rule Bypass**: Configure role bypasses per rule

### 📊 Logging & Monitoring
- **Global Log Channel**: Set a default logging channel for all auto mod actions
- **Per-Rule Logging**: Override global logging with rule-specific channels
- **Action Tracking**: Log all moderation actions with detailed information
- **Rule Status Monitoring**: Track enabled/disabled rules and their performance

## Database Schema

The system uses the `guild_automod_rules` table with the following structure:

```sql
CREATE TABLE guild_automod_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    trigger_type ENUM('spam', 'caps', 'links', 'invite_links', 'profanity', 'mention_spam') NOT NULL,
    action_type ENUM('delete', 'warn', 'mute', 'kick', 'ban') NOT NULL,
    threshold_value INT DEFAULT 5,
    duration INT NULL,
    enabled BOOLEAN DEFAULT 1,
    whitelist_channels TEXT NULL,
    whitelist_roles TEXT NULL,
    bypass_roles TEXT NULL,
    log_channel_id VARCHAR(32) NULL,
    auto_delete BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_guild_enabled (guild_id, enabled)
);
```

## UI Components

### 1. Rule Management Interface
- **Rule Table**: Display all configured rules with status, actions, and controls
- **Quick Actions**: Enable/disable rules, edit configurations, delete rules
- **Rule Creation**: Modal form for creating new auto moderation rules
- **Rule Editing**: Full configuration editing with all available options

### 2. Configuration Options

#### Trigger Types
| Type | Description | Threshold Meaning |
|------|-------------|-------------------|
| `spam` | Repeated messages and spam patterns | Messages within time window |
| `caps` | Excessive capital letters | Percentage of caps in message |
| `links` | Unauthorized links and URLs | Number of links allowed |
| `invite_links` | Discord server invites | Invite links tolerance |
| `profanity` | Inappropriate language | Severity level (1-10) |
| `mention_spam` | Excessive user/role mentions | Number of mentions allowed |

#### Action Types
| Action | Description | Duration Required |
|--------|-------------|-------------------|
| `delete` | Remove the violating message | No |
| `warn` | Send a warning to the user | No |
| `mute` | Temporarily mute the user | Optional |
| `kick` | Remove user from server | No |
| `ban` | Permanently ban the user | Optional (temp ban) |

### 3. Global Configuration
- **Global Log Channel**: Default channel for all auto mod logs
- **Global Bypass Roles**: Roles that bypass all rules
- **Legacy Toggles**: Backward compatibility with simple on/off toggles

## API Endpoints

### Rule Management
```javascript
// Get all auto mod rules
GET /api/moderation/automod/rules

// Create new rule
POST /api/moderation/automod/rules
{
  "name": "Spam Protection",
  "triggerType": "spam",
  "actionType": "warn",
  "thresholdValue": 5,
  "enabled": true,
  "whitelistChannels": ["channel_id_1"],
  "bypassRoles": ["role_id_1"],
  "logChannelId": "log_channel_id",
  "autoDelete": false
}

// Update existing rule
PUT /api/moderation/automod/rules/:ruleId

// Delete rule
DELETE /api/moderation/automod/rules/:ruleId

// Toggle rule status
POST /api/moderation/automod/rules/:ruleId/toggle
{ "enabled": true }
```

## Implementation Details

### Frontend Components

#### AutomodConfigForm.jsx
- **Enhanced Configuration**: Full rule management interface
- **Modal Forms**: Create and edit rules with comprehensive options
- **Real-time Updates**: Immediate reflection of changes
- **Validation**: Client-side validation for required fields

#### Key Features:
- Rule table with sortable columns
- Quick toggle switches for enable/disable
- Inline editing capabilities
- Bulk operations support
- Search and filtering options

### Backend Services

#### Moderation Service Functions
```javascript
// Core CRUD operations
createGuildAutoModRule(guildId, ruleData)
getGuildAutoModRules(guildId)
updateGuildAutoModRule(guildId, ruleId, ruleData)
deleteGuildAutoModRule(guildId, ruleId)
toggleGuildAutoModRule(guildId, ruleId, enabled)
```

#### Caching Strategy
- **Memory Cache**: Rules cached per guild for fast access
- **Cache Invalidation**: Automatic cache clearing on updates
- **Fallback Handling**: Graceful degradation when database unavailable

## Usage Examples

### Creating a Comprehensive Spam Filter
```javascript
{
  "name": "Advanced Spam Protection",
  "triggerType": "spam",
  "actionType": "mute",
  "thresholdValue": 3,
  "duration": 10,
  "enabled": true,
  "whitelistChannels": ["general-chat", "off-topic"],
  "bypassRoles": ["moderator", "trusted"],
  "logChannelId": "mod-logs",
  "autoDelete": true
}
```

### Setting Up Profanity Filtering
```javascript
{
  "name": "Profanity Filter",
  "triggerType": "profanity",
  "actionType": "warn",
  "thresholdValue": 1,
  "enabled": true,
  "whitelistChannels": [],
  "bypassRoles": ["admin"],
  "logChannelId": "auto-mod-logs",
  "autoDelete": true
}
```

### Caps Lock Control
```javascript
{
  "name": "Excessive Caps Filter",
  "triggerType": "caps",
  "actionType": "delete",
  "thresholdValue": 70,
  "enabled": true,
  "whitelistChannels": ["announcements"],
  "bypassRoles": ["staff"],
  "logChannelId": "mod-logs",
  "autoDelete": true
}
```

## Migration & Compatibility

### Backward Compatibility
The system maintains backward compatibility with existing simple toggle configurations:
- `spamDetection`, `capsFilter`, `linkFilter`, `profanityFilter`
- These are preserved and can be migrated to rule-based system
- Global settings like `logChannelId` and `bypassRoles` are maintained

### Migration Path
1. **Existing Configurations**: Preserved during upgrade
2. **Rule Generation**: Option to convert simple toggles to rules
3. **Gradual Migration**: Can use both systems simultaneously
4. **Data Preservation**: No data loss during transition

## Testing

### Test Script
Run the test script to verify functionality:
```bash
node scripts/test-automod-form.js
```

### Test Coverage
- ✅ Rule CRUD operations
- ✅ Database persistence
- ✅ Cache management
- ✅ Error handling
- ✅ Validation logic
- ✅ API endpoints
- ✅ UI components

## Performance Considerations

### Optimizations
- **Indexed Queries**: Database queries optimized with proper indexes
- **Efficient Caching**: Memory-based caching for frequently accessed data
- **Bulk Operations**: Support for bulk rule management
- **Lazy Loading**: Rules loaded only when needed

### Scalability
- **Per-Guild Isolation**: Rules scoped to individual guilds
- **Efficient Storage**: JSON fields for complex data structures
- **Cache Partitioning**: Separate cache per guild for memory efficiency

## Security

### Data Validation
- **Input Sanitization**: All user inputs validated and sanitized
- **SQL Injection Prevention**: Parameterized queries used throughout
- **XSS Protection**: Output encoding for user-generated content
- **Rate Limiting**: API endpoints protected against abuse

### Access Control
- **Authentication Required**: All operations require valid auth token
- **Guild-Based Authorization**: Users can only modify their guild's rules
- **Role-Based Permissions**: Future support for granular permissions

## Future Enhancements

### Planned Features
- [ ] **Custom Trigger Patterns**: Regex-based custom triggers
- [ ] **Advanced Actions**: Custom webhook actions and integrations
- [ ] **Rule Templates**: Pre-defined rule sets for common scenarios
- [ ] **Analytics Dashboard**: Rule performance and violation statistics
- [ ] **Machine Learning**: AI-powered content analysis
- [ ] **Integration Hub**: Connect with external moderation services

### Community Features
- [ ] **Rule Sharing**: Share rule configurations between servers
- [ ] **Community Templates**: Crowdsourced rule templates
- [ ] **Best Practices**: Automated suggestions for rule optimization
