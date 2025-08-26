<div align="center">

# 🤖 Discord AI Bot & Modern Dashboard

A comprehensive Discord bot powered by Google's Gemini AI with an elegant React dashboard. Features intelligent conversations, image analysis, content moderation, and advanced server management tools.

[![Discord.js](https://img.shields.io/badge/discord.js-v14.21.0-blue.svg)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/node.js-16.9.0+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.3.1-blue.svg)](https://reactjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

## 🚀 Quick Start

### Bot Invitation
Add the bot to your Discord server using this OAuth2 URL (requires "Manage Server" permission):

```
https://discord.com/oauth2/authorize?client_id=951335667756072981&scope=bot%20applications.commands
```

### Prerequisites
- Node.js 16.9.0 or higher
- Discord Bot Token
- Google AI API Key (for Gemini)
- MongoDB or MySQL database

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/husniaditya/dc-ai_bot.git
   cd dc-ai_bot
   ```

2. Install dependencies:
   ```bash
   npm install
   cd dashboard && npm install
   ```

3. Configure environment variables (see [Configuration](#configuration))

4. Register slash commands:
   ```bash
   npm run register-commands
   ```

5. Start the bot:
   ```bash
   npm start
   ```


## ✨ Features Overview

### 🤖 AI-Powered Bot
- **Smart Conversations**: Advanced Q&A with context retention using Gemini 2.0 Flash
- **Multi-Image Analysis**: Analyze up to 3 images simultaneously with detailed explanations
- **Content Processing**: Automatic summarization, translation, and content moderation
- **Interactive Commands**: 20+ slash commands for utilities, entertainment, and productivity

### 📊 Modern Dashboard
- **OAuth2 Integration**: Secure Discord login with guild management
- **Real-time Management**: Live auto-response configuration and testing
- **Intuitive UI**: Glass-morphism design with dark/light theme support
- **Advanced Tools**: Regex tester, bulk operations, and analytics dashboard

### 🛠️ Core Capabilities
- **Modular Architecture**: Clean, maintainable codebase with proper separation of concerns
- **Database Persistence**: Support for both MongoDB and MySQL with automatic migrations
- **Rate Limiting**: Built-in protection against spam and abuse
- **Error Handling**: Comprehensive error tracking and graceful failure recovery

## �️ Technology Stack

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
| Command | Description | Usage |
|---------|-------------|--------|
| `/ping` | Check bot responsiveness | `/ping` |
| `/help` | Interactive help system | `/help [category]` |
| `/whoami` | Display user information | `/whoami` |
| `/uptime` | Show bot uptime statistics | `/uptime` |

### 🤖 AI & Intelligence
| Command | Description | Usage |
|---------|-------------|--------|
| `/ask` | Ask Gemini AI anything | `/ask prompt:<your question>` |
| `/askfollow` | Continue conversation with context | `/askfollow prompt:<follow-up>` |
| `/explain_image` | Analyze 1-3 images with AI | `/explain_image image:<file> [prompt]` |
| `/summarize` | Summarize recent chat messages | `/summarize [count:30]` |
| `/translate` | Translate text to any language | `/translate text:<text> target:<language>` |

### 🗳️ Interactive Features
| Command | Description | Usage |
|---------|-------------|--------|
| `/poll create` | Create interactive polls | `/poll create question:<q> options:<a,b,c>` |
| `/poll results` | View poll results | `/poll results id:<pollId>` |
| `/remind` | Set personal reminders | `/remind minutes:<n> text:<message>` |
| `/autoreply` | Manage auto-responses | `/autoreply [enable/disable]` |

### 🧮 Utilities
| Command | Description | Usage |
|---------|-------------|--------|
| `/math` | Perform calculations | `/math add/sub/mul/div a:<n> b:<n>` |
| `/user info` | Get user details | `/user info [target:<@user>]` |
| `/echo` | Echo back text | `/echo text:<message>` |

### 🎮 Entertainment & Social
| Command | Description | Usage |
|---------|-------------|--------|
| `/meme` | Generate or fetch memes | `/meme [category]` |
| `/twitchstats` | Twitch integration stats | `/twitchstats [channel]` |
| `/ytstats` | YouTube channel statistics | `/ytstats [channel]` |
| `/ytwatch` | YouTube monitoring tools | `/ytwatch [action]` |

### 🖱️ Context Menu Actions
Right-click on messages to access:
- **Explain Image** - Analyze images in the message
- **Summarize** - Summarize conversation context
- **Translate** - Auto-detect and translate content

## ⚙️ Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# Google AI Configuration
GOOGLE_AI_API_KEY=your_google_ai_api_key

# Database Configuration (choose one)
# MongoDB
MONGODB_URI=mongodb://localhost:27017/discord_bot

# MySQL
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=discord_bot

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
API_PORT=3001
NODE_ENV=production

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Required Permissions
The bot requires the following Discord permissions:
- `Send Messages`
- `Use Slash Commands`
- `Embed Links`
- `Attach Files`
- `Read Message History`
- `Add Reactions`
- `Manage Messages` (for polls and moderation)
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


## � AI Integration

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

## 🎛️ Dashboard Features

### Authentication & Security
- **Discord OAuth2**: Secure login with guild scope permissions
- **JWT Tokens**: Auto-rotating tokens with configurable expiration
- **CSRF Protection**: State validation for all authentication flows
- **Session Management**: Persistent login with secure token storage

### Guild Management
- **Server Selection**: Visual guild picker with search functionality
- **Permission Checking**: Automatic verification of management permissions
- **Multi-Server Support**: Switch between servers seamlessly
- **Real-time Sync**: Live updates from Discord API

### Auto-Response System
- **Regex Patterns**: Advanced pattern matching with flag support
- **Live Testing**: Built-in regex tester with sample text validation
- **Bulk Operations**: Enable/disable/delete multiple responses at once
- **Cooldown Management**: Per-user cooldown settings (milliseconds)
- **Response Randomization**: Multiple responses per pattern with random selection

### User Interface
- **Glass Morphism**: Modern, translucent design elements
- **Dark/Light Themes**: Automatic theme switching with user preference
- **Responsive Design**: Mobile-first approach with Bootstrap 5
- **Animated Feedback**: Toast notifications and smooth transitions
- **Data Tables**: Advanced sorting, filtering, and pagination
## 🚦 Auto-Response Configuration

The auto-response system allows servers to create custom automated replies based on message patterns.

### Dashboard Configuration
1. **Navigate**: Dashboard → Auto Responses
2. **Add Pattern**: Click "Add New" and enter regex pattern with flags
3. **Set Responses**: Provide multiple responses (one per line) for variety
4. **Configure Settings**: Enable/disable and set user cooldowns
5. **Test Patterns**: Use the built-in regex tester before saving

### Pattern Examples
```regex
# Greetings (case insensitive)
^(hi|hello|hey)\b.*
Flags: i

# Questions about bot
.*\b(what|who|how).*bot.*
Flags: i

# Custom server-specific patterns
.*welcome.*new.*member.*
Flags: i
```

### Features
- **Random Responses**: Bot randomly selects from multiple configured responses
- **User Cooldowns**: Prevents spam with configurable per-user delays
- **Guild-Specific**: Each server has independent auto-response configuration
- **Enable/Disable**: Toggle responses without deleting patterns
- **Bulk Actions**: Manage multiple responses efficiently

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
- **Conversation Monitoring**: Context-aware safety checks for ongoing conversations
- **Abuse Prevention**: Multiple layers of protection against malicious usage

### Data Protection
- **Minimal Data Collection**: Only stores necessary operational data
- **Secure Storage**: Encrypted storage for sensitive configuration data
- **Data Retention**: Automatic cleanup of temporary data and old logs
- **Privacy Compliance**: GDPR-friendly data handling practices

## �️ Development Roadmap

### Planned Features
- **🔧 Advanced Moderation**: Automated content moderation with customizable rules
- **📊 Analytics Dashboard**: Detailed usage statistics and performance metrics
- **🌐 Multi-language**: Complete internationalization support
- **🎮 Game Integration**: Enhanced gaming features and social platform connections
- **📱 Mobile App**: Companion mobile application for dashboard access

### Technical Improvements
- **🧪 Testing Suite**: Comprehensive unit and integration testing
- **🚀 CI/CD Pipeline**: Automated testing, building, and deployment
- **📈 Performance Monitoring**: Real-time performance tracking and alerting
- **🔄 Database Migrations**: Automated schema versioning and migrations
- **🏗️ Microservices**: Modular architecture for better scalability

### Quality of Life
- **♿ Accessibility**: Full WCAG compliance and screen reader support
- **📚 Documentation**: Interactive API documentation and video tutorials
- **🎨 Themes**: Custom theme builder and community theme sharing
- **💾 Backup System**: Automated backup and restore functionality
- **🔍 Advanced Search**: Full-text search across all bot data and logs

## � Contributing

We welcome contributions from the community! Here's how you can help:

### Getting Started
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit with conventional commits: `git commit -m "feat: add amazing feature"`
5. Push to your branch: `git push origin feature/amazing-feature`
6. Create a Pull Request

### Development Setup
```bash
# Clone your fork
git clone https://github.com/yourusername/dc-ai_bot.git
cd dc-ai_bot

# Install dependencies
npm install
cd dashboard && npm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development servers
npm run dev
```

### Guidelines
- Follow the existing code style and conventions
- Write clear, descriptive commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

For detailed contributing guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

## � Support & Community

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
