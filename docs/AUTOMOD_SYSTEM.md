# Auto Moderation System Documentation

The Auto Moderation System automatically detects and handles spam, inappropriate content, and rule violations to maintain a healthy server environment.

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [Spam Detection](#spam-detection)
4. [Content Filtering](#content-filtering)
5. [Profanity Filter](#profanity-filter)
6. [Link Filtering](#link-filtering)
7. [Warning System](#warning-system)
8. [API Reference](#api-reference)
9. [Examples](#examples)
10. [Troubleshooting](#troubleshooting)

## Overview

### Features
- **Spam Detection**: Prevent message flooding and repetitive content
- **Caps Lock Filtering**: Control excessive uppercase messages
- **Link Filtering**: Block malicious or unwanted links
- **Profanity Filter**: Custom word and pattern filtering
- **Mass Mention Protection**: Prevent @everyone/@here abuse
- **Invite Link Control**: Manage Discord invite sharing
- **Warning System**: Progressive punishment system
- **Bypass Roles**: Exclude trusted users from filtering

### Detection Methods
- Real-time message analysis
- Pattern matching algorithms
- Behavioral analysis
- Machine learning classification
- Community-reported content
- External threat intelligence

## Configuration

### Basic Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `enabled` | Boolean | Enable/disable auto moderation | `false` |
| `logChannelId` | String | Channel for moderation logs | `null` |
| `spamDetection` | Boolean | Enable spam detection | `true` |
| `capsFilter` | Boolean | Enable caps lock filtering | `true` |
| `linkFilter` | Boolean | Enable link filtering | `false` |
| `profanityFilter` | Boolean | Enable profanity filtering | `false` |
| `inviteFilter` | Boolean | Block Discord invites | `false` |
| `mentionSpamFilter` | Boolean | Prevent mass mentions | `true` |
| `bypassRoles` | Array | Role IDs exempt from filtering | `[]` |

### Action Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `autoDelete` | Boolean | Auto-delete violating messages | `true` |
| `warnUser` | Boolean | Send warning to user | `true` |
| `timeoutDuration` | Number | Timeout duration (minutes) | `5` |
| `maxWarnings` | Number | Warnings before escalation | `3` |
| `escalationAction` | String | Action after max warnings | `"timeout"` |

### Dashboard Configuration

```javascript
{
  enabled: true,
  logChannelId: "123456789012345678",
  spamDetection: true,
  capsFilter: true,
  linkFilter: true,
  profanityFilter: true,
  inviteFilter: true,
  mentionSpamFilter: true,
  bypassRoles: [
    "987654321098765432", // Moderator role
    "456789123456789123"  // VIP role
  ],
  autoDelete: true,
  warnUser: true,
  timeoutDuration: 10,
  maxWarnings: 3,
  escalationAction: "kick"
}
```

## Spam Detection

### Message Spam
Detects repetitive or flooding messages based on:

| Parameter | Description | Default | Range |
|-----------|-------------|---------|-------|
| `messageLimit` | Messages per time window | `5` | 1-20 |
| `timeWindow` | Time window (seconds) | `10` | 5-60 |
| `duplicateThreshold` | Identical message threshold | `3` | 1-10 |
| `similarityThreshold` | Message similarity percentage | `80%` | 50-100% |

```javascript
{
  spamDetection: {
    enabled: true,
    messageLimit: 5,
    timeWindow: 10,
    duplicateThreshold: 3,
    similarityThreshold: 0.8,
    action: "timeout",
    duration: 300 // 5 minutes
  }
}
```

### Character Spam
Prevents excessive character repetition:

```javascript
{
  characterSpam: {
    enabled: true,
    maxRepeated: 5, // Maximum repeated characters
    threshold: 0.6  // 60% of message can be repeated chars
  }
}
```

### Emoji Spam
Controls excessive emoji usage:

```javascript
{
  emojiSpam: {
    enabled: true,
    maxEmojis: 10,    // Maximum emojis per message
    maxRepeated: 3    // Maximum repeated emojis
  }
}
```

## Content Filtering

### Caps Lock Filter
Controls excessive uppercase text:

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `capsEnabled` | Boolean | Enable caps filtering | `true` |
| `capsThreshold` | Number | Uppercase percentage threshold | `70` |
| `capsMinLength` | Number | Minimum message length to check | `10` |
| `capsAction` | String | Action for caps violations | `"warn"` |

```javascript
{
  capsFilter: {
    enabled: true,
    threshold: 70,        // 70% caps triggers filter
    minLength: 10,        // Only check messages 10+ chars
    action: "delete",     // Delete caps messages
    warningMessage: "Please don't use excessive caps lock."
  }
}
```

### Mass Mention Filter
Prevents @everyone/@here abuse and mass user mentions:

```javascript
{
  mentionSpamFilter: {
    enabled: true,
    maxUserMentions: 5,     // Max user mentions per message
    blockEveryone: true,    // Block @everyone
    blockHere: true,        // Block @here
    maxRoleMentions: 3,     // Max role mentions
    action: "delete",
    timeoutDuration: 600    // 10 minute timeout
  }
}
```

## Profanity Filter

### Custom Words
Add server-specific blocked words:

```javascript
{
  profanityFilter: {
    enabled: true,
    customWords: [
      "badword1",
      "badword2",
      "inappropriate-term"
    ],
    action: "delete",
    warnUser: true,
    logViolation: true
  }
}
```

### Pattern Matching
Use regex patterns for advanced filtering:

```javascript
{
  profanityPatterns: [
    {
      pattern: "\\b(spam|advertisement)\\b",
      flags: "gi",
      description: "Spam/Advertisement detection",
      action: "delete"
    },
    {
      pattern: "discord\\.gg/[a-zA-Z0-9]+",
      flags: "gi", 
      description: "Discord invite links",
      action: "warn"
    }
  ]
}
```

## Link Filtering

### URL Detection
Automatically detects and filters links:

```javascript
{
  linkFilter: {
    enabled: true,
    blockAll: false,          // Block all links
    allowWhitelisted: true,   // Allow whitelisted domains
    blockShorteners: true,    // Block URL shorteners
    blockSuspicious: true,    // Block suspicious domains
    action: "delete"
  }
}
```

### External Security Services

#### VirusTotal Integration
Check URLs against VirusTotal's threat intelligence:

```javascript
{
  virusTotal: {
    enabled: true,
    apiKey: "your_virustotal_api_key",
    checkThreshold: 2,        // Min detections to block
    checkTimeout: 5000,       // 5 second timeout
    cacheResults: true,       // Cache scan results
    cacheDuration: 3600,      // 1 hour cache
    
    // Actions based on detection count
    actions: {
      suspicious: "warn",     // 1-2 detections
      malicious: "delete",    // 3-5 detections  
      dangerous: "ban"        // 6+ detections
    },
    
    // Custom thresholds
    thresholds: {
      suspicious: 1,
      malicious: 3,
      dangerous: 6
    }
  }
}
```

#### Google Safe Browsing
Leverage Google's Safe Browsing API for real-time protection:

```javascript
{
  googleSafeBrowsing: {
    enabled: true,
    apiKey: "your_google_api_key",
    checkTypes: [
      "MALWARE",
      "SOCIAL_ENGINEERING", 
      "UNWANTED_SOFTWARE",
      "POTENTIALLY_HARMFUL_APPLICATION"
    ],
    
    // Action per threat type
    threatActions: {
      "MALWARE": "ban",
      "SOCIAL_ENGINEERING": "delete",
      "UNWANTED_SOFTWARE": "warn",
      "POTENTIALLY_HARMFUL_APPLICATION": "warn"
    },
    
    checkTimeout: 3000,       // 3 second timeout
    cacheResults: true,
    cacheDuration: 1800       // 30 minute cache
  }
}
```

#### Combined Security Check
Integrated scanning with multiple services:

```javascript
{
  urlSecurity: {
    enabled: true,
    
    // Check order (fail-fast approach)
    checkOrder: [
      "blacklist",           // Local blacklist (fastest)
      "googleSafeBrowsing",  // Google API (fast)
      "virusTotal"           // VirusTotal (slower)
    ],
    
    // Aggregated scoring
    scoring: {
      enabled: true,
      weights: {
        blacklist: 10,       // Local blacklist weight
        googleSafeBrowsing: 8, // Google weight
        virusTotal: 6        // VirusTotal weight
      },
      thresholds: {
        warn: 5,
        delete: 10,
        ban: 15
      }
    },
    
    // Fallback if all services fail
    fallbackAction: "warn",
    
    // Rate limiting to avoid API quota issues
    rateLimiting: {
      virusTotal: {
        requestsPerMinute: 4,
        requestsPerDay: 500
      },
      googleSafeBrowsing: {
        requestsPerMinute: 10000,
        requestsPerDay: 100000
      }
    }
  }
}
```

### Phishing Protection
Integration with phishing databases:

```javascript
{
  phishingProtection: {
    enabled: true,
    checkDatabases: [
      "phishtank",
      "openphish", 
      "community-reports",
      "virustotal",         // VirusTotal integration
      "googleSafeBrowsing"  // Google Safe Browsing
    ],
    blockSuspicious: true,
    action: "delete",
    
    // Enhanced detection with external services
    enhancedDetection: {
      enabled: true,
      checkShorteners: true,    // Expand shortened URLs
      checkRedirects: true,     // Follow redirect chains
      deepScan: true,           // Scan embedded content
      maxRedirects: 5           // Limit redirect following
    }
  }
}
```

## Warning System

### Progressive Punishment
Escalating consequences for repeat offenders:

```javascript
{
  warningSystem: {
    enabled: true,
    maxWarnings: 3,
    escalationActions: [
      { warnings: 1, action: "warn" },
      { warnings: 2, action: "timeout", duration: 300 },
      { warnings: 3, action: "timeout", duration: 3600 },
      { warnings: 4, action: "kick" },
      { warnings: 5, action: "ban" }
    ],
    warningExpiry: 604800 // 7 days
  }
}
```

## API Reference

### Get Auto Moderation Configuration
```http
GET /api/moderation/automod/config
Headers:
  x-guild-id: {guildId}
```

### Update Auto Moderation Settings
```http
PUT /api/moderation/automod/config
Headers:
  x-guild-id: {guildId}
  Content-Type: application/json

Body:
{
  "enabled": true,
  "spamDetection": true,
  "capsFilter": true,
  "linkFilter": true,
  "profanityFilter": true,
  "logChannelId": "123456789012345678"
}
```

### Manage Profanity Words
```http
# Get profanity words
GET /api/moderation/automod/profanity/words

# Add profanity word
POST /api/moderation/automod/profanity/words
{
  "word": "badword",
  "severity": "high",
  "action": "delete"
}

# Delete profanity word
DELETE /api/moderation/automod/profanity/words/{wordId}
```

### Manage Profanity Patterns
```http
# Get profanity patterns
GET /api/moderation/automod/profanity/patterns

# Add profanity pattern
POST /api/moderation/automod/profanity/patterns
{
  "pattern": "\\b(spam|advertisement)\\b",
  "flags": "gi",
  "description": "Spam detection",
  "severity": "medium",
  "action": "warn"
}
```

### Warning Management
```http
# Get user warnings
GET /api/moderation/warnings/{userId}

# Add warning
POST /api/moderation/warnings
{
  "userId": "123456789012345678",
  "reason": "Spam violation",
  "violationType": "spam"
}

# Clear user warnings
DELETE /api/moderation/warnings/{userId}
```

### Security Services Management
```http
# Get security service configuration
GET /api/moderation/automod/security/config

# Update security services settings
PUT /api/moderation/automod/security/config
{
  "virusTotal": {
    "enabled": true,
    "checkThreshold": 2
  },
  "googleSafeBrowsing": {
    "enabled": true,
    "checkTypes": ["MALWARE", "SOCIAL_ENGINEERING"]
  }
}

# Check URL manually
POST /api/moderation/automod/security/check
{
  "url": "https://suspicious-domain.com",
  "services": ["virusTotal", "googleSafeBrowsing"]
}

# Get security scan history
GET /api/moderation/automod/security/history?limit=50

# Get security statistics
GET /api/moderation/automod/security/stats?period=week
```

### Blacklist Management
```http
# Get blacklisted domains
GET /api/moderation/automod/blacklist/domains

# Add domain to blacklist
POST /api/moderation/automod/blacklist/domains
{
  "domain": "malicious-site.com",
  "reason": "Malware distribution",
  "severity": "high",
  "action": "ban"
}

# Remove domain from blacklist
DELETE /api/moderation/automod/blacklist/domains/{domainId}

# Bulk import blacklist
POST /api/moderation/automod/blacklist/domains/bulk
{
  "domains": [
    {
      "domain": "spam1.com",
      "reason": "Spam",
      "severity": "medium"
    },
    {
      "domain": "phish2.net", 
      "reason": "Phishing",
      "severity": "high"
    }
  ]
}
```

## Examples

### Basic Server Setup
```javascript
{
  enabled: true,
  logChannelId: "123456789012345678",
  spamDetection: true,
  capsFilter: true,
  profanityFilter: true,
  inviteFilter: true,
  bypassRoles: ["987654321098765432"], // Moderator role
  autoDelete: true,
  warnUser: true,
  maxWarnings: 3,
  escalationAction: "timeout"
}
```

### Gaming Server Configuration
```javascript
{
  enabled: true,
  logChannelId: "123456789012345678",
  
  // More lenient for gaming communities
  spamDetection: {
    enabled: true,
    messageLimit: 8,      // Allow more messages
    timeWindow: 15,       // Longer time window
    action: "warn"        // Warn before timeout
  },
  
  capsFilter: {
    enabled: true,
    threshold: 80,        // Higher caps threshold
    action: "warn"
  },
  
  linkFilter: {
    enabled: true,
    blockAll: false,
    allowWhitelisted: true,
    whitelist: [
      "twitch.tv",
      "youtube.com", 
      "steamcommunity.com",
      "discord.gg"        // Allow game invites
    ],
    
    // Security services for gaming community
    virusTotal: {
      enabled: true,
      checkThreshold: 3,  // Higher threshold for gaming links
      actions: {
        suspicious: "warn",
        malicious: "delete",
        dangerous: "timeout"
      }
    },
    
    googleSafeBrowsing: {
      enabled: true,
      checkTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
      threatActions: {
        "MALWARE": "delete",
        "SOCIAL_ENGINEERING": "warn"
      }
    }
  },
  
  profanityFilter: {
    enabled: true,
    severity: "medium"    // Moderate filtering
  }
}
```

### Strict Business Server
```javascript
{
  enabled: true,
  logChannelId: "123456789012345678",
  
  // Strict settings for professional environment
  spamDetection: {
    enabled: true,
    messageLimit: 3,      // Low message limit
    timeWindow: 10,
    action: "timeout"
  },
  
  capsFilter: {
    enabled: true,
    threshold: 50,        // Low caps threshold
    action: "delete"
  },
  
  linkFilter: {
    enabled: true,
    blockAll: true,       // Block all links
    allowWhitelisted: true,
    whitelist: [
      "company-website.com",
      "approved-tool.com"
    ],
    
    // Maximum security for business environment
    virusTotal: {
      enabled: true,
      checkThreshold: 1,  // Very strict - any detection blocks
      actions: {
        suspicious: "delete",
        malicious: "ban",
        dangerous: "ban"
      }
    },
    
    googleSafeBrowsing: {
      enabled: true,
      checkTypes: [
        "MALWARE",
        "SOCIAL_ENGINEERING", 
        "UNWANTED_SOFTWARE",
        "POTENTIALLY_HARMFUL_APPLICATION"
      ],
      threatActions: {
        "MALWARE": "ban",
        "SOCIAL_ENGINEERING": "ban",
        "UNWANTED_SOFTWARE": "delete",
        "POTENTIALLY_HARMFUL_APPLICATION": "delete"
      }
    },
    
    // Enhanced security scoring
    urlSecurity: {
      enabled: true,
      scoring: {
        enabled: true,
        thresholds: {
          warn: 3,    // Very low threshold
          delete: 5,
          ban: 8
        }
      }
    }
  },
  
  profanityFilter: {
    enabled: true,
    severity: "high",     // Strict filtering
    action: "kick"        // Immediate kick for profanity
  },
  
  inviteFilter: true,     // No Discord invites
  mentionSpamFilter: {
    enabled: true,
    maxUserMentions: 2,   // Very limited mentions
    blockEveryone: true,
    blockHere: true
  }
}
```

## Troubleshooting

### Common Issues

#### False Positives
1. **Review Thresholds**: Adjust sensitivity settings
2. **Check Bypass Roles**: Ensure trusted users are exempt
3. **Whitelist Content**: Add legitimate words/links to whitelist
4. **Test Patterns**: Validate regex patterns thoroughly

#### Performance Issues
1. **Database Optimization**: Index frequently queried tables
2. **Cache Frequently Used Data**: Store patterns and words in memory
3. **Limit Pattern Complexity**: Avoid expensive regex operations
4. **Batch Operations**: Process multiple violations together

#### Integration Problems
1. **Permission Check**: Ensure bot has required permissions
2. **Channel Validation**: Verify log channel exists and is accessible
3. **Role Hierarchy**: Bot role must be above moderated roles
4. **API Rate Limits**: Monitor Discord API usage

#### Security Service Issues
1. **API Key Validation**: Ensure VirusTotal and Google Safe Browsing API keys are valid
2. **Rate Limiting**: Monitor API quotas and usage
   - VirusTotal: 4 requests/minute, 500/day (free tier)
   - Google Safe Browsing: 10,000 requests/minute, 100,000/day
3. **Service Timeouts**: Adjust timeout values for network conditions
4. **Cache Performance**: Monitor cache hit rates for optimal performance
5. **False Positives**: Review and whitelist legitimate domains flagged by services

### Security Service Troubleshooting

#### VirusTotal Issues
```javascript
// Common VirusTotal error handling
{
  virusTotal: {
    errorHandling: {
      "QUOTA_EXCEEDED": {
        action: "disable_temporarily",
        retryAfter: 3600 // 1 hour
      },
      "INVALID_API_KEY": {
        action: "log_error",
        fallback: "googleSafeBrowsing"
      },
      "TIMEOUT": {
        action: "cache_negative",
        cacheDuration: 300 // 5 minutes
      }
    }
  }
}
```

#### Google Safe Browsing Issues
```javascript
// Common Google Safe Browsing error handling
{
  googleSafeBrowsing: {
    errorHandling: {
      "API_KEY_INVALID": {
        action: "log_error",
        fallback: "virusTotal"
      },
      "QUOTA_EXCEEDED": {
        action: "disable_temporarily",
        retryAfter: 86400 // 24 hours
      },
      "NETWORK_ERROR": {
        action: "retry",
        maxRetries: 3,
        retryDelay: 1000
      }
    }
  }
}
```

### Debug Information

Enable automod debugging:
```bash
DEBUG_AUTOMOD=true
```

### Performance Metrics

Monitor these metrics for optimal performance:

```javascript
{
  "metrics": {
    "messagesProcessed": 15432,
    "violationsDetected": 234,
    "averageResponseTime": "12ms",
    "falsePositiveRate": "2.1%",
    "cacheHitRate": "94.5%"
  },
  
  "securityServices": {
    "virusTotal": {
      "requestsToday": 423,
      "quotaRemaining": 77,
      "averageResponseTime": "850ms",
      "cacheHitRate": "76.3%",
      "threatsDetected": 12,
      "falsePositives": 2
    },
    
    "googleSafeBrowsing": {
      "requestsToday": 1247,
      "quotaRemaining": 98753,
      "averageResponseTime": "180ms", 
      "cacheHitRate": "85.2%",
      "threatsDetected": 8,
      "falsePositives": 1
    },
    
    "combined": {
      "urlsScanned": 1583,
      "threatsBlocked": 18,
      "accuracyRate": "98.1%",
      "averageScanTime": "245ms"
    }
  }
}
```

### Best Practices

#### Configuration
1. **Start Conservative**: Begin with lenient settings
2. **Monitor Logs**: Review false positives regularly
3. **Community Feedback**: Listen to user complaints
4. **Regular Updates**: Adjust settings as server grows

#### Content Management
1. **Regular Pattern Review**: Update regex patterns
2. **Word List Maintenance**: Add/remove profanity words
3. **Whitelist Updates**: Keep approved domains current
4. **False Positive Tracking**: Document and fix issues

#### User Communication
1. **Clear Rules**: Document what's not allowed
2. **Appeal Process**: Provide way to contest actions
3. **Transparency**: Explain automated moderation
4. **Education**: Help users understand guidelines

---

**Next Steps:**
- Configure basic spam protection
- Set up logging channel
- Test with moderator accounts
- Monitor for false positives
- Adjust settings based on server culture

For more information, see the [Moderation Overview](MODERATION_OVERVIEW.md).
