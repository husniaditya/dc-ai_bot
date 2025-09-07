# Command Logging Integration Guide

This guide shows how to integrate the new command logging system for real-time analytics and dashboard data.

## Table of Contents
1. [Setup Database](#setup-database)
2. [Initialize Services](#initialize-services)  
3. [Integrate Command Logging](#integrate-command-logging)
4. [Update Dashboard](#update-dashboard)
5. [Usage Examples](#usage-examples)

## Setup Database

### Step 1: Create the Command Logs Table

Run the SQL script to create the table:

```bash
# Navigate to scripts directory
cd scripts

# Run the table creation script
mysql -u your_user -p your_database < create-command-logs-table.sql
```

Or execute the SQL directly in your database:

```sql
-- See scripts/create-command-logs-table.sql for full table definition
CREATE TABLE IF NOT EXISTS guild_command_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    command_name VARCHAR(100) NOT NULL,
    -- ... other columns
);
```

### Step 2: Verify Table Creation

```javascript
// Test database connection and table
const db = require('./src/config/store/database/connection');

async function testTable() {
    const [rows] = await db.sqlPool.query('DESCRIBE guild_command_logs');
    console.log('Table structure:', rows);
}
```

## Initialize Services

### Step 1: Initialize Command Logger

In your main bot file or initialization script:

```javascript
const { createCommandLogger } = require('./src/config/store/services/commandLogger');
const { createAnalyticsService } = require('./src/config/store/services/enhancedAnalytics');
const db = require('./src/config/store/database/connection');

// Initialize services after database connection
async function initializeServices() {
    // Wait for database connection
    await db.ensureConnection();
    
    // Initialize command logger
    const commandLogger = createCommandLogger(db);
    console.log('✅ Command logger initialized');
    
    // Initialize analytics service
    const analyticsService = createAnalyticsService(db);
    console.log('✅ Analytics service initialized');
}

// Call during bot startup
initializeServices().catch(console.error);
```

## Integrate Command Logging

### Method 1: Wrapper Function (Recommended)

Wrap your existing command handlers:

```javascript
const { withCommandLogging } = require('./src/config/store/middleware/commandLogging');

// Original command handler
async function pingCommand(interaction) {
    await interaction.reply(`Pong! Latency: ${interaction.client.ws.ping}ms`);
}

// Wrapped with logging
const loggedPingCommand = withCommandLogging(pingCommand, { name: 'ping' });

// Use in your command registration
client.commands.set('ping', loggedPingCommand);
```

### Method 2: Manual Logging

For custom integrations:

```javascript
const { logCommand } = require('./src/config/store/middleware/commandLogging');

async function customCommandHandler(message) {
    const startTime = Date.now();
    let status = 'success';
    let errorMessage = null;
    
    try {
        // Your command logic here
        await message.reply('Command executed!');
    } catch (error) {
        status = 'error';
        errorMessage = error.message;
        throw error;
    } finally {
        // Log the command execution
        await logCommand({
            guildId: message.guildId,
            userId: message.author.id,
            channelId: message.channelId,
            commandName: 'custom',
            commandType: 'message',
            fullCommand: message.content,
            userTag: `${message.author.username}#${message.author.discriminator}`,
            status: status,
            errorMessage: errorMessage,
            responseTimeMs: Date.now() - startTime,
            metadata: {
                messageId: message.id,
                isBot: message.author.bot
            }
        });
    }
}
```

### Method 3: Decorator Pattern

For class-based commands:

```javascript
const { CommandLogged } = require('./src/config/store/middleware/commandLogging');

class Commands {
    @CommandLogged({ name: 'help', category: 'utility' })
    async help(interaction) {
        // Command logic automatically logged
        await interaction.reply('Help menu...');
    }
    
    @CommandLogged({ name: 'ban', category: 'moderation' })
    async ban(interaction) {
        // Moderation command automatically logged
        const user = interaction.options.getUser('user');
        await interaction.guild.members.ban(user);
        await interaction.reply(`Banned ${user.tag}`);
    }
}
```

## Update Dashboard

### Step 1: Update Analytics Service

Replace your existing analytics calls with the enhanced service:

```javascript
// In your dashboard API or component
const { getAnalyticsService } = require('./src/config/store/services/enhancedAnalytics');

async function getDashboardData(guildId) {
    const analyticsService = getAnalyticsService();
    
    if (!analyticsService) {
        console.warn('Analytics service not initialized');
        return getDefaultAnalytics();
    }
    
    // Get comprehensive analytics from command logs
    const analytics = await analyticsService.getAnalytics(guildId);
    
    return analytics;
}
```

### Step 2: Update Dashboard Component

Your OverviewSection.jsx will now receive real-time data:

```javascript
// The analytics prop will now include:
// - Real command execution counts
// - Actual response times
// - Recent activity from command logs
// - Top commands with real usage statistics
// - Success rates and error tracking

export default function OverviewSection({ analytics, ... }) {
    // analytics.commands.today = actual commands executed today
    // analytics.activity.recent = real command executions
    // analytics.commands.top = actual top commands with real counts
    // analytics.performance = real performance metrics
    
    return (
        // Your existing JSX - no changes needed!
        // Data is now real instead of mock
    );
}
```

## Usage Examples

### Example 1: Slash Command Integration

```javascript
const { SlashCommandBuilder } = require('discord.js');
const { withCommandLogging } = require('./src/config/store/middleware/commandLogging');

const pingCommand = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency'),
    
    execute: withCommandLogging(async (interaction) => {
        const ping = interaction.client.ws.ping;
        await interaction.reply(`🏓 Pong! Latency: ${ping}ms`);
    }, { name: 'ping', category: 'utility' })
};

module.exports = pingCommand;
```

### Example 2: Message Command Integration

```javascript
const { logCommand } = require('./src/config/store/middleware/commandLogging');

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('!') || message.author.bot) return;
    
    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    const startTime = Date.now();
    let status = 'success';
    let errorMessage = null;
    
    try {
        // Execute command
        await executeMessageCommand(commandName, message, args);
    } catch (error) {
        status = 'error';
        errorMessage = error.message;
    } finally {
        // Log execution
        await logCommand({
            guildId: message.guildId,
            userId: message.author.id,
            channelId: message.channelId,
            commandName: commandName,
            commandType: 'message',
            fullCommand: message.content,
            userTag: `${message.author.username}#${message.author.discriminator}`,
            status: status,
            errorMessage: errorMessage,
            responseTimeMs: Date.now() - startTime
        });
    }
});
```

### Example 3: Getting Analytics Data

```javascript
const { getAnalyticsService } = require('./src/config/store/services/enhancedAnalytics');

// In your dashboard API route
app.get('/api/analytics/:guildId', async (req, res) => {
    const { guildId } = req.params;
    
    try {
        const analyticsService = getAnalyticsService();
        const analytics = await analyticsService.getAnalytics(guildId);
        
        res.json({
            success: true,
            data: analytics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Force refresh analytics
app.post('/api/analytics/:guildId/refresh', async (req, res) => {
    const { guildId } = req.params;
    
    try {
        const analyticsService = getAnalyticsService();
        const analytics = await analyticsService.getAnalyticsRefresh(guildId);
        
        res.json({
            success: true,
            data: analytics,
            refreshed: true
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

### Example 4: Command Performance Monitoring

```javascript
const { trackPerformance } = require('./src/config/store/middleware/commandLogging');

// Wrap any async function for performance tracking
const optimizedDatabaseQuery = trackPerformance('heavy-query', async (params) => {
    return await db.query('SELECT * FROM heavy_table WHERE conditions = ?', [params]);
});

// Usage
const results = await optimizedDatabaseQuery(searchParams);
// Logs: [PERF] heavy-query: 1247ms
```

## Benefits

### Real-time Dashboard Data
- ✅ Actual command usage statistics
- ✅ Real response time metrics  
- ✅ Live activity streams
- ✅ Accurate success/error rates
- ✅ Performance monitoring

### Analytics Insights
- ✅ Peak usage hours
- ✅ Popular commands trending
- ✅ User engagement patterns
- ✅ Error rate monitoring
- ✅ Performance bottlenecks

### Debugging & Monitoring
- ✅ Command execution history
- ✅ Error tracking with context
- ✅ Performance regression detection
- ✅ User behavior analysis
- ✅ System health monitoring

## Best Practices

1. **Wrap all commands** with logging middleware
2. **Monitor error rates** and investigate spikes
3. **Set up alerts** for high error rates or slow responses
4. **Regular cleanup** of old command logs (90+ days)
5. **Index optimization** for large datasets
6. **Cache analytics** for frequently accessed data
7. **Async logging** to avoid blocking command execution

## Troubleshooting

### Common Issues

1. **Database connection errors**: Ensure database is connected before initializing services
2. **Missing command logs**: Verify commands are wrapped with logging middleware
3. **Slow dashboard loading**: Check database indexes and implement caching
4. **Memory usage**: Regular cleanup of old logs and cache management

### Debug Commands

```javascript
// Check command logging status
console.log('Command logger:', getCommandLogger() ? 'Initialized' : 'Not initialized');

// Check recent logs
const analyticsService = getAnalyticsService();
const recent = await analyticsService.getRecentActivity(guildId, 10);
console.log('Recent commands:', recent);

// Check database connection
const db = require('./src/config/store/database/connection');
console.log('Database connected:', db.sqlPool ? 'Yes' : 'No');
```
