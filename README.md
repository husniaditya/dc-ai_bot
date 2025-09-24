<div align="center">

# 🤖 Discord AI Bot & Modern Dashboard

A comprehensive Discord bot powered by Google's Gemini AI with an elegant React dashboard. Features intelligent conversations, image analysis, content moderation, and advanced server management tools.

[![Discord.js](https://img.shields.io/badge/discord.js-v14.21.0-blue.svg)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/node.js-16.9.0+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.3.1-blue.svg)](https://reactjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Website](https://img.shields.io/badge/website-chocomaid.xyz-ff69b4.svg)](https://chocomaid.xyz)

</div>

## 🚀 Quick Start

### Bot Invitation
Add the bot to your Discord server using this OAuth2 URL (requires "Manage Server" permission):

```
https://discord.com/oauth2/authorize?client_id=951335667756072981&scope=bot%20applications.commands
```

### Bot Web Dashboard
Manage the bot through the dashboard:

```
https://chocomaid.xyz
```

## ✨ Features Overview

### 🤖 AI-Powered Bot
- **Smart Conversations**: Advanced Q&A with context retention using Gemini 2.0 Flash
- **Multi-Image Analysis**: Analyze up to 3 images simultaneously with detailed explanations
- **Content Processing**: Automatic summarization, translation, and content moderation
- **Interactive Commands**: 30+ slash commands for utilities, entertainment, and productivity
- **Context Menu Integration**: Right-click actions for quick AI operations

### 📊 Modern Dashboard

<div align="center">
  <img src="https://chocomaid.xyz/images/dashboard/dashboard_statistics.png" alt="Dashboard Statistics" width="48%">
  <img src="https://chocomaid.xyz/images/dashboard/dashboard_activity.png" alt="Dashboard Activity" width="48%">
</div>

<div align="center">
  <img src="https://chocomaid.xyz/images/dashboard/dashboard_automod.png" alt="Dashboard Auto Moderation" width="48%">
  <img src="https://chocomaid.xyz/images/dashboard/dashboard_security.png" alt="Dashboard Security" width="48%">
</div>

<p align="center">
  <em>Dashboard overview showing statistics, activity monitoring, auto-moderation settings, and security features</em>
</p>

- **OAuth2 Integration**: Secure Discord login with guild management
- **Real-time Management**: Live auto-response configuration and testing
- **Intuitive UI**: Glass-morphism design with dark/light theme support
- **Advanced Tools**: Regex tester, bulk operations, and analytics dashboard
- **Comprehensive Moderation**: Full suite of moderation tools and configuration

### 🛡️ Advanced Moderation System

<div align="center">
  <img src="https://chocomaid.xyz/images/dashboard/moderation.png" alt="Moderation Dashboard" width="70%">
</div>

<p align="center">
  <em>Comprehensive moderation dashboard with real-time controls and configuration options</em>
</p>

- **🚪 Welcome System**: Customizable welcome messages, cards, and auto-role assignment
- **🤖 Auto Moderation**: Spam detection, content filtering, link security with VirusTotal/SafeBrowsing integration
- **👥 Role Management**: Reaction roles, self-assignable roles, and permission management
- **📊 XP & Leveling**: Message-based progression system with rewards and leaderboards
- **📅 Scheduled Messages**: Automated announcements with cron-based scheduling
- **📋 Audit Logging**: Comprehensive activity tracking and moderation logs
- **🛡️ Anti-Raid Protection**: Real-time raid detection and automated response system

### 🛠️ Core Capabilities
- **Modular Architecture**: Clean, maintainable codebase with proper separation of concerns
- **Rate Limiting**: Built-in protection against spam and abuse
- **Error Handling**: Comprehensive error tracking and graceful failure recovery
- **Real-time Updates**: Live configuration changes without bot restart

## 🌐 Multi-Language Support (i18n)

The bot dashboard features comprehensive internationalization support with **7 languages** available:

### 🗣️ Supported Languages
- **English (en)** - Default language
- **Indonesian (id)** - Bahasa Indonesia  
- **Spanish (es)** - Español
- **French (fr)** - Français
- **German (de)** - Deutsch
- **Japanese (ja)** - 日本語
- **Chinese Traditional (cn)** - 繁體中文

### 🎯 Language Features
- **Instant Switching**: Real-time language changes without page reload
- **Persistent Preference**: Language choice saved across browser sessions
- **Auto-Detection**: Automatically detects browser language on first visit
- **Fallback System**: Graceful fallback to English for missing translations
- **Complete Coverage**: All UI elements, buttons, forms, and messages translated

### 🔧 Dashboard Localization
The dashboard provides full translation coverage for:

| Feature Category | Translation Coverage |
|------------------|---------------------|
| **Navigation & Menus** | Complete interface navigation and menu items |
| **Settings Panels** | All configuration options and descriptions |
| **Moderation Tools** | Auto-mod rules, anti-raid settings, audit logs |
| **XP & Leveling** | Experience system and leaderboard interface |
| **Role Management** | Reaction roles and permission configuration |
| **Scheduled Messages** | Automation and scheduling interface |
| **Error Messages** | User-friendly error descriptions and tooltips |
| **Forms & Validation** | Input labels, placeholders, and validation messages |

### 🎨 Language Selector
<div align="center">
  <img src="https://chocomaid.xyz/images/dashboard/language_selector.png" alt="Language Selector" width="40%">
</div>

<p align="center">
  <em>Language selector dropdown available in the dashboard navbar for instant switching</em>
</p>

### 🚀 Advanced Translation Features

#### Smart Interpolation
Support for dynamic content with variable substitution:
```javascript
// Example: "Welcome back, {{username}}!"
t('welcome', { username: 'John' })
// Result: "Welcome back, John!" (English)
// Result: "Selamat datang kembali, John!" (Indonesian)
```

#### Contextual Translations
Separate translations for different contexts:
```json
{
  "buttons": {
    "save": "Save"
  },
  "messages": {
    "save": "Your changes have been saved"
  }
}
```

#### Date & Time Localization
Automatic formatting for dates and timestamps based on selected language:
- **Time Format**: 24-hour vs 12-hour (AM/PM) based on locale
- **Date Format**: DD/MM/YYYY vs MM/DD/YYYY based on region
- **Relative Time**: "2 hours ago" properly localized

### 🔄 Language Detection Priority
1. **User Preference** - Previously saved language choice
2. **Browser Language** - Automatic detection from navigator.language
3. **Default Fallback** - English as the default language

### 📊 Translation Statistics
- **7 languages** fully supported
- **500+ translation keys** covering all interface elements
- **99% coverage** across all dashboard features
- **Real-time switching** with no performance impact

## ⚙️ Technology Stack

### Backend
- **Runtime**: Node.js 16.9.0+
- **Framework**: Discord.js v14.21.0
- **AI Engine**: Google Generative AI (Gemini 2.0 Flash)
- **Database**: MongoDB 6.x / MySQL 8.x support
- **API**: Express.js 5.x with CORS and rate limiting

### Frontend
- **Framework**: React 18.3.1 with modern hooks
- **Build Tool**: Vite 5.x for fast development
- **Styling**: Bootstrap 5.3.3 + Custom CSS
- **Charts**: Highcharts for analytics visualization
- **Tables**: DataTables.net for advanced data management

### Development & Deployment
- **Package Manager**: npm with workspace support
- **Version Control**: Git with conventional commits
- **Environment**: dotenv for configuration management
- **Security**: JWT authentication with auto-rotation

## 📋 Available Commands

### 🎯 Core Commands

<div align="center">
  <img src="https://chocomaid.xyz/images/dashboard/commands_list.png" alt="Commands List" width="60%">
</div>

<p align="center">
  <em>Interactive commands interface showing all available bot commands and their usage</em>
</p>

| Command | Description | Usage |
|---------|-------------|--------|
| `/ping` | Check bot responsiveness | `/ping` |
| `/help` | Interactive help system | `/help [category]` |
| `/whoami` | Display user information | `/whoami` |
| `/uptime` | Show bot uptime statistics | `/uptime` |
| `/user info` | Get detailed user information | `/user info [target:<@user>]` |
| `/echo` | Echo back text | `/echo text:<message>` |

### 🤖 AI & Intelligence
| Command | Description | Usage |
|---------|-------------|--------|
| `/ask` | Ask Gemini AI anything with caching | `/ask prompt:<your question>` |
| `/askfollow` | Continue conversation with context | `/askfollow prompt:<follow-up>` |
| `/explain_image` | Analyze 1-3 images with AI | `/explain_image image:<file> [prompt]` |
| `/summarize` | Summarize recent chat messages | `/summarize [count:30]` |
| `/translate` | Translate text to any language | `/translate text:<text> target:<language>` |

### 🗳️ Interactive Features
| Command | Description | Usage |
|---------|-------------|--------|
| `/poll create` | Create interactive button polls | `/poll create question:<q> options:<a,b,c>` |
| `/poll results` | View detailed poll results | `/poll results id:<pollId>` |
| `/remind` | Set personal reminders | `/remind minutes:<n> text:<message>` |
| `/autoreply` | Manage auto-responses | `/autoreply [enable/disable]` |

### 🛡️ Moderation & Management
| Command | Description | Usage |
|---------|-------------|--------|
| `/antiraid status` | View anti-raid protection status | `/antiraid status` |
| `/antiraid toggle` | Enable/disable anti-raid protection | `/antiraid toggle enabled:<true/false>` |
| `/automod list` | List all automod rules | `/automod list` |
| `/automod info` | Get detailed rule information | `/automod info id:<rule_id>` |
| `/automod toggle` | Enable/disable automod rule | `/automod toggle id:<rule_id> enabled:<true/false>` |
| `/audit` | View audit logging information | `/audit [settings]` |
| `/welcome preview` | Preview welcome message settings | `/welcome preview` |
| `/welcome toggle` | Enable/disable welcome system | `/welcome toggle enabled:<true/false>` |
| `/scheduler list` | List all scheduled messages | `/scheduler list` |
| `/scheduler info` | Get scheduled message details | `/scheduler info id:<message_id>` |
| `/scheduler enable` | Enable scheduled message | `/scheduler enable id:<message_id>` |
| `/scheduler disable` | Disable scheduled message | `/scheduler disable id:<message_id>` |
| `/scheduler run` | Manually run scheduled message | `/scheduler run id:<message_id>` |
| `/role` | Manage self-assignable roles | `/role add/remove/list/info <role_name>` |

### 📊 XP & Leveling System
| Command | Description | Usage |
|---------|-------------|--------|
| `/xp check` | Check your or another user's XP and level | `/xp check [user:<@user>]` |
| `/xp leaderboard` | Show the server XP leaderboard | `/xp leaderboard [limit:<1-25>]` |
| `/level` | Alternative level check command | `/level [user:<@user>]` |
| `/rank` | Show user's rank in the server | `/rank [user:<@user>]` |
| `/leaderboard` | Show top users by XP | `/leaderboard [limit:<number>]` |
| `/xp-admin` | Admin commands for XP management | `/xp-admin [add/remove/set] [user] [amount]` |

### 🧮 Utilities & Tools
| Command | Description | Usage |
|---------|-------------|--------|
| `/math` | Perform mathematical calculations | `/math add/sub/mul/div a:<n> b:<n>` |
| `/meme` | Generate or fetch memes | `/meme [category]` |

### 📺 Media Integration
| Command | Description | Usage |
|---------|-------------|--------|
| `/twitchstats` | Get Twitch channel statistics | `/twitchstats [channel]` |
| `/twitchdebug` | Debug Twitch integration | `/twitchdebug` |
| `/ytstats` | YouTube channel statistics | `/ytstats [channel]` |
| `/ytwatch` | YouTube monitoring tools | `/ytwatch [action]` |
| `/ytdebug` | Debug YouTube integration | `/ytdebug` |

## 📺 Platform Integrations

This project includes first-class integrations for YouTube, Twitch, and Clash of Clans. Below is a quick overview of what each integration does, how to enable it, and the most useful commands and environment options.

### YouTube Integration

What it does:
- Watches one or more YouTube channels per guild and announces new uploads and live streams
- Supports member-only content detection and templated announcements
- Multiple strategies to detect lives (API, optional scraping, optional RSS/WebSub fallback)
- Quota-aware with automatic cool-down and multi-key support

Helpful commands:
- `/ytstats` – Show watcher cache/quota stats and env intervals
- `/ytwatch` – Manage/watch controls (per-guild)
- `/ytdebug` – Show recent debug events (opt-in via env)

Announcement templates (placeholders available):
- `{roleMention}` `{channelTitle}` `{title}` `{url}` `{thumbnail}` `{memberBadge}` `{memberText}` `{publishedAt}` `{publishedAtRelative}`
- Member-only variants are supported via dedicated templates.

### Twitch Integration

What it does:
- Watches configured Twitch streamers per guild and announces when they go live
- Templated live announcements with optional embeds and role mentions

Helpful commands:
- `/twitchstats` – Watcher statistics and current intervals
- `/twitchdebug` – Recent debug events (if enabled)

Announcement template placeholders:
- `{streamerName}` `{title}` `{url}` `{roleMention}`

### Clash of Clans Integration

What it does:
- Tracks multiple clans per guild: donations, wars, and member changes
- Auto-generates and maintains donation and war leaderboards with interactive buttons

Helpful commands:
- `/coc` – Quick info and actions
- `/cocdebug` – Debug events and configuration overview

Leaderboard features:
- Multi-clan support with per-clan pagination and caching
- War state transitions handled automatically (preparation → in war → ended)
- Donation leaderboard can be scheduled and refreshed; supports message discovery/persistence

### 🖱️ Context Menu Actions
Right-click on messages to access:
- **Explain Image** - Analyze images in the message with AI
- **Summarize** - Summarize conversation context
- **Translate** - Auto-detect and translate content

### Required Permissions
The bot requires the following Discord permissions:
- `Send Messages`
- `Use Slash Commands`
- `Embed Links`
- `Attach Files`
- `Read Message History`
- `Add Reactions`
- `Manage Messages` (for polls and moderation)

## 📚 Documentation

### 🛡️ Moderation System Documentation
The bot includes a comprehensive moderation system with detailed documentation for each feature:

| Feature | Documentation | Description |
|---------|---------------|-------------|
| **🚪 Welcome System** | [docs/WELCOME_SYSTEM.md](docs/WELCOME_SYSTEM.md) | Customizable welcome messages, cards, and auto-role assignment |
| **🤖 Auto Moderation** | [docs/AUTOMOD_SYSTEM.md](docs/AUTOMOD_SYSTEM.md) | Spam detection, content filtering, and security integration |
| **👥 Role Management** | [docs/ROLE_MANAGEMENT.md](docs/ROLE_MANAGEMENT.md) | Reaction roles, self-assignable roles, and permission management |
| **📊 XP & Leveling** | [docs/XP_LEVELING.md](docs/XP_LEVELING.md) | Experience points system with rewards and progression |
| **📅 Scheduled Messages** | [docs/SCHEDULER.md](docs/SCHEDULER.md) | Automated announcements with cron-based scheduling |
| **📋 Audit Logging** | [docs/AUDIT_LOGGING.md](docs/AUDIT_LOGGING.md) | Comprehensive activity tracking and moderation logs |
| **🛡️ Anti-Raid Protection** | [docs/ANTI_RAID_SYSTEM.md](docs/ANTI_RAID_SYSTEM.md) | Real-time raid detection and automated response |
| **📖 Moderation Overview** | [docs/MODERATION_OVERVIEW.md](docs/MODERATION_OVERVIEW.md) | Complete overview of all moderation features |

### 🔧 Key Features
- **Dashboard Configuration**: All features configurable via web dashboard
- **Real-time Updates**: Configuration changes apply immediately
- **Security Integration**: VirusTotal and Google Safe Browsing API integration
- **Performance Optimized**: Efficient caching and database optimization
- **Comprehensive Logging**: Full audit trail for all moderation actions


## 🖼️ AI Image Analysis

### Context Menu (Recommended)
Right-click (mobile: long press) on any message containing images → Apps → **Explain Image**. This method guarantees accurate image capture and analysis.

### Slash Command Method
Use `/explain_image` with up to 3 image attachments:

1. **Single Image**: `/explain_image image:<file>` 
2. **Multiple Images**: `/explain_image image:<file1> image2:<file2> image3:<file3>`
3. **With Custom Prompt**: `/explain_image image:<file> prompt:<specific question>`

### Features
- **Multi-Image Support**: Analyze up to 3 images simultaneously
- **Smart Re-upload**: Automatically handles large images (skips >8MB)
- **Detailed Analysis**: Comprehensive explanations with context
- **Embed Integration**: Clean presentation with image previews

## 🤖 AI Integration

### Gemini 2.0 Flash Integration
- **Model**: Latest Gemini 2.0 Flash for optimal performance
- **Context Retention**: Maintains conversation history for follow-up questions
- **Error Handling**: Exponential backoff with up to 3 retry attempts
- **Memory Management**: Intelligent prompt caching (3-minute duration)
- **Safety Features**: Content filtering and response validation

### Conversation Features
- **Contextual Follow-ups**: Use `/askfollow` to continue conversations
- **Smart Chunking**: Automatically splits long responses for readability
- **Multi-modal Input**: Combine text and images in single queries
- **Language Support**: Automatic language detection and translation

### Performance Optimizations
- **Caching**: In-memory prompt cache for faster responses
- **Rate Limiting**: Built-in protection against API abuse
- **Async Processing**: Non-blocking operations for better responsiveness

## 🛡️ Moderation Dashboard Features

### Advanced Moderation Tools
- **Real-time Configuration**: All moderation features configurable via dashboard
- **Anti-Raid Protection**: Automated raid detection with configurable thresholds
- **Auto Moderation**: Content filtering with VirusTotal and Google Safe Browsing integration
- **Welcome System**: Customizable welcome messages with card generation
- **Role Management**: Reaction roles and self-assignable role systems
- **XP & Leveling**: Comprehensive progression system with rewards
- **Scheduled Messages**: Cron-based automated announcements
- **Audit Logging**: Full activity tracking and moderation logs

### Security Features
- **Link Scanning**: Real-time URL security scanning with external APIs
- **Phishing Protection**: Advanced phishing detection and prevention
- **Spam Detection**: Multi-layered spam detection algorithms
- **Content Filtering**: Custom word and pattern filtering
- **Account Analysis**: New member screening and risk assessment

## 🛠️ Comprehensive Moderation System

### Core Moderation Features

#### 🚪 Welcome System
- Customizable welcome messages with variable support
- Automatic welcome card generation with user avatars
- Auto-role assignment for new members
- Direct message welcoming capabilities
- Channel-specific announcement configuration

#### 🤖 Auto Moderation
- **Spam Detection**: Message frequency and content analysis
- **Content Filtering**: Custom word and pattern filtering with regex support
- **Link Security**: Real-time URL scanning with VirusTotal and Google Safe Browsing
- **Caps Lock Control**: Configurable uppercase text limits
- **Mention Protection**: Prevent @everyone/@here abuse and mass mentions
- **Invite Link Filtering**: Block unauthorized Discord invites

#### 🛡️ Anti-Raid Protection
- **Real-time Monitoring**: Join rate and account age analysis
- **Automated Response**: Configurable actions (kick, ban, timeout, lockdown)
- **Suspicious Account Detection**: Multi-factor risk assessment
- **Grace Period Monitoring**: New member behavior tracking
- **Bypass Roles**: Exempt trusted users from protection

#### 📊 XP & Leveling System
- **Message-based XP**: Earn experience points from chat activity
- **Voice Channel XP**: Gain XP for time spent in voice channels
- **Level Progression**: Customizable leveling curves and requirements
- **Role Rewards**: Automatic role assignment at specific levels
- **Leaderboards**: Server-wide and time-based rankings
- **Anti-Gaming**: Cooldowns and duplicate message prevention

#### 👥 Role Management
- **Reaction Roles**: Assign roles via emoji reactions
- **Self-Assignable Roles**: `/role` command for user role management
- **Role Categories**: Organize roles by type (color, interest, access)
- **Permission Sync**: Automatic permission management
- **Role Menus**: Interactive dropdown and button interfaces

#### 📅 Scheduled Messages
- **Cron-based Scheduling**: Flexible timing with cron expressions
- **Multiple Formats**: Text, embed, and rich content support
- **Variable Support**: Dynamic content with server and user variables
- **Time Zone Handling**: Global and per-message timezone configuration
- **Manual Execution**: Test and run messages on demand

#### 📋 Audit Logging
- **Comprehensive Tracking**: Message, member, and server changes
- **Multiple Log Channels**: Separate channels for different event types
- **Customizable Formats**: Embed or text-based log formatting
- **Retention Settings**: Configurable log retention periods
- **Export Capabilities**: Data export for compliance and analysis

## 🔒 Security & Safety

### Bot Security
- **Permission Validation**: Strict checking of user and bot permissions
- **Rate Limiting**: Built-in protection against command spam and API abuse
- **Input Sanitization**: Comprehensive validation of all user inputs
- **Error Handling**: Graceful error management without exposing sensitive data

### API Security
- **JWT Authentication**: Secure token-based authentication with auto-rotation
- **CORS Configuration**: Properly configured cross-origin resource sharing
- **Request Validation**: Schema validation for all API endpoints
- **Audit Logging**: Comprehensive logging of all administrative actions

### Content Safety
- **AI Content Filtering**: Automatic filtering of inappropriate AI responses
- **Image Analysis Safety**: Content validation for image explanation features
- **Link Security**: Real-time URL scanning with VirusTotal and Google Safe Browsing
- **Phishing Protection**: Advanced phishing detection and prevention
- **Abuse Prevention**: Multiple layers of protection against malicious usage

### Data Protection
- **Minimal Data Collection**: Only stores necessary operational data
- **Secure Storage**: Encrypted storage for sensitive configuration data
- **Data Retention**: Automatic cleanup of temporary data and old logs
- **Privacy Compliance**: GDPR-friendly data handling practices

## 🗓️ Development Roadmap

### Current Features ✅
- **AI Integration**: Gemini 2.0 Flash with image analysis and conversation context
- **Dashboard Interface**: Modern web interface for all configurations
- **Comprehensive Moderation**: Full suite including anti-raid, auto-mod, welcome system
- **XP & Leveling**: Complete progression system with rewards and leaderboards
- **Role Management**: Reaction roles and self-assignable systems
- **Scheduled Messages**: Cron-based automation with variable support
- **Security Integration**: VirusTotal and Google Safe Browsing APIs
- **🌐 Multi-language Support**: Complete internationalization with 7 languages
- **📊 Enhanced Analytics**: Detailed usage statistics and performance metrics

### Planned Features 🚧
- **🎮 Game Integration**: Enhanced gaming features and social platform connections
- **📱 Mobile Dashboard**: Responsive mobile interface improvements
- **🎨 Custom Themes**: Theme builder and community theme sharing

### Technical Improvements 🛠️
- **🧪 Testing Suite**: Comprehensive unit and integration testing
- **🚀 CI/CD Pipeline**: Automated testing, building, and deployment
- **📈 Performance Monitoring**: Real-time performance tracking and alerting
- **🔄 Database Migrations**: Automated schema versioning and migrations
- **🏗️ Microservices**: Modular architecture for better scalability

### Quality of Life ✨
- **♿ Accessibility**: Full WCAG compliance and screen reader support
- **📚 Interactive Documentation**: API documentation and video tutorials
- **💾 Backup System**: Automated backup and restore functionality
- **🔍 Advanced Search**: Full-text search across all bot data and logs

## 💬 Support & Community

### Getting Help
- **📚 Documentation**: Check our comprehensive guides and API documentation
- **🐛 Issues**: Report bugs or request features on [GitHub Issues](https://github.com/husniaditya/dc-ai_bot/issues)
- **💬 Discussions**: Join community discussions on [GitHub Discussions](https://github.com/husniaditya/dc-ai_bot/discussions)
- **📧 Contact**: Reach out to maintainers for security issues or private concerns

### Community Guidelines
Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in the community. We're committed to providing a welcoming and inclusive environment for all contributors.

### Security
If you discover a security vulnerability, please follow our [Security Policy](SECURITY.md) for responsible disclosure.

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

### Third-Party Licenses
- Discord.js - Apache 2.0 License
- React - MIT License
- Bootstrap - MIT License
- Google Generative AI - Google AI Terms of Service

---

<div align="center">

**Built with ❤️ for the Discord community**

[⭐ Star this repo](https://github.com/husniaditya/dc-ai_bot) • [🐛 Report Bug](https://github.com/husniaditya/dc-ai_bot/issues) • [✨ Request Feature](https://github.com/husniaditya/dc-ai_bot/issues)

</div>
