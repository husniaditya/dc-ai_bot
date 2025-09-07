// Command logging service for real-time analytics and dashboard data
// This service captures all command executions with detailed metrics

const { v4: uuidv4 } = require('uuid');

class CommandLoggingService {
    constructor(database) {
        this.db = database;
        this.sessionCache = new Map(); // Track user sessions
        this.commandCategories = {
            // Moderation commands
            'ban': 'moderation',
            'kick': 'moderation', 
            'timeout': 'moderation',
            'warn': 'moderation',
            'purge': 'moderation',
            'mute': 'moderation',
            'unmute': 'moderation',
            
            // Utility commands
            'ping': 'utility',
            'help': 'utility',
            'info': 'utility',
            'stats': 'utility',
            'userinfo': 'utility',
            'serverinfo': 'utility',
            
            // Fun commands
            'poll': 'fun',
            'roll': 'fun',
            'joke': 'fun',
            'meme': 'fun',
            
            // XP/Leveling
            'level': 'leveling',
            'rank': 'leveling',
            'leaderboard': 'leveling',
            'xp': 'leveling',
            
            // Auto systems
            'automod': 'automation',
            'scheduler': 'automation',
            'autorole': 'automation',
            'welcome': 'automation',
            
            // Configuration
            'config': 'configuration',
            'settings': 'configuration',
            'setup': 'configuration',
            
            // AI Integration
            'ai': 'ai',
            'gemini': 'ai',
            'chat': 'ai'
        };
    }

    /**
     * Log a command execution with full analytics data
     */
    async logCommand({
        guildId,
        userId,
        channelId,
        commandName,
        commandType = 'slash',
        fullCommand = null,
        userTag = null,
        userRoles = [],
        status = 'success',
        errorMessage = null,
        responseTimeMs = null,
        botLatencyMs = null,
        databaseQueryTimeMs = null,
        apiCallsMade = 0,
        metadata = {}
    }) {
        try {
            const executedAt = new Date();
            const sessionId = this.getOrCreateSession(userId);
            const isFirstTimeUser = await this.isFirstTimeCommandUser(guildId, userId, commandName);
            const commandCategory = this.getCommandCategory(commandName);

            const logData = {
                guild_id: guildId,
                user_id: userId,
                channel_id: channelId,
                command_name: commandName,
                command_type: commandType,
                full_command: fullCommand,
                executed_at: executedAt,
                response_time_ms: responseTimeMs,
                status: status,
                error_message: errorMessage,
                user_tag: userTag,
                user_roles: JSON.stringify(userRoles),
                session_id: sessionId,
                is_first_time_user: isFirstTimeUser,
                command_category: commandCategory,
                bot_latency_ms: botLatencyMs,
                database_query_time_ms: databaseQueryTimeMs,
                api_calls_made: apiCallsMade,
                metadata: JSON.stringify(metadata)
            };

            // Insert into database
            await this.insertCommandLog(logData);

            // Update real-time analytics cache if available
            this.updateAnalyticsCache(logData);

            return true;
        } catch (error) {
            console.error('Failed to log command:', error);
            return false;
        }
    }

    /**
     * Get or create a session ID for grouping related commands
     */
    getOrCreateSession(userId) {
        const sessionTimeout = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();

        if (this.sessionCache.has(userId)) {
            const session = this.sessionCache.get(userId);
            if (now - session.lastActivity < sessionTimeout) {
                session.lastActivity = now;
                return session.id;
            }
        }

        // Create new session
        const sessionId = uuidv4();
        this.sessionCache.set(userId, {
            id: sessionId,
            lastActivity: now
        });

        return sessionId;
    }

    /**
     * Check if this is the user's first time using this command
     */
    async isFirstTimeCommandUser(guildId, userId, commandName) {
        try {
            if (!this.db || !this.db.sqlPool) return false;

            const [rows] = await this.db.sqlPool.query(
                'SELECT COUNT(*) as count FROM guild_command_logs WHERE guild_id = ? AND user_id = ? AND command_name = ?',
                [guildId, userId, commandName]
            );

            return rows[0].count === 0;
        } catch (error) {
            console.error('Error checking first time user:', error);
            return false;
        }
    }

    /**
     * Get command category for analytics grouping
     */
    getCommandCategory(commandName) {
        const cleanName = commandName.toLowerCase().replace(/[^a-z]/g, '');
        return this.commandCategories[cleanName] || 'other';
    }

    /**
     * Insert command log into database
     */
    async insertCommandLog(logData) {
        try {
            if (!this.db || !this.db.sqlPool) {
                console.warn('Database not available for command logging');
                return;
            }

            await this.db.sqlPool.query(
                `INSERT INTO guild_command_logs SET ?`,
                [logData]
            );
        } catch (error) {
            console.error('Database insert failed for command log:', error);
            throw error;
        }
    }

    /**
     * Update analytics cache for real-time dashboard updates
     */
    updateAnalyticsCache(logData) {
        try {
            // This would integrate with your existing analytics service
            const analyticsService = require('./analytics');
            if (analyticsService && analyticsService.trackCommandUsage) {
                analyticsService.trackCommandUsage(logData.command_name, logData.guild_id);
            }
        } catch (error) {
            // Don't fail command logging if analytics update fails
            console.warn('Failed to update analytics cache:', error.message);
        }
    }

    /**
     * Get recent command activity for dashboard
     */
    async getRecentActivity(guildId, limit = 50) {
        try {
            if (!this.db || !this.db.sqlPool) return [];

            const [rows] = await this.db.sqlPool.query(`
                SELECT 
                    command_name,
                    command_category,
                    user_tag,
                    status,
                    executed_at,
                    response_time_ms
                FROM guild_command_logs 
                WHERE guild_id = ?
                ORDER BY executed_at DESC 
                LIMIT ?
            `, [guildId, limit]);

            return rows.map(row => ({
                action: `/${row.command_name} ${row.status === 'success' ? 'executed' : 'failed'}`,
                type: 'command',
                category: row.command_category,
                user: row.user_tag,
                timestamp: row.executed_at.toISOString(),
                responseTime: row.response_time_ms
            }));
        } catch (error) {
            console.error('Error fetching recent activity:', error);
            return [];
        }
    }

    /**
     * Get command analytics for dashboard
     */
    async getCommandAnalytics(guildId, timeframe = '7d') {
        try {
            if (!this.db || !this.db.sqlPool) return null;

            const timeCondition = this.getTimeCondition(timeframe);
            
            const [stats] = await this.db.sqlPool.query(`
                SELECT 
                    command_name,
                    command_category,
                    COUNT(*) as total_uses,
                    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_uses,
                    COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_uses,
                    AVG(response_time_ms) as avg_response_time,
                    COUNT(DISTINCT user_id) as unique_users,
                    MAX(executed_at) as last_used
                FROM guild_command_logs 
                WHERE guild_id = ? AND executed_at >= ${timeCondition}
                GROUP BY command_name, command_category
                ORDER BY total_uses DESC
            `, [guildId]);

            const [trends] = await this.db.sqlPool.query(`
                SELECT 
                    DATE(executed_at) as date,
                    COUNT(*) as total_commands,
                    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_commands,
                    AVG(response_time_ms) as avg_response_time
                FROM guild_command_logs 
                WHERE guild_id = ? AND executed_at >= ${timeCondition}
                GROUP BY DATE(executed_at)
                ORDER BY date ASC
            `, [guildId]);

            return {
                commands: stats,
                trends: trends,
                summary: {
                    totalCommands: stats.reduce((sum, cmd) => sum + cmd.total_uses, 0),
                    successRate: stats.length > 0 ? 
                        (stats.reduce((sum, cmd) => sum + cmd.successful_uses, 0) / 
                         stats.reduce((sum, cmd) => sum + cmd.total_uses, 0) * 100).toFixed(1) : 0,
                    avgResponseTime: stats.length > 0 ? 
                        Math.round(stats.reduce((sum, cmd) => sum + (cmd.avg_response_time || 0), 0) / stats.length) : 0,
                    uniqueUsers: new Set(stats.map(cmd => cmd.unique_users)).size
                }
            };
        } catch (error) {
            console.error('Error fetching command analytics:', error);
            return null;
        }
    }

    /**
     * Get SQL time condition based on timeframe
     */
    getTimeCondition(timeframe) {
        const conditions = {
            '1h': 'DATE_SUB(NOW(), INTERVAL 1 HOUR)',
            '24h': 'DATE_SUB(NOW(), INTERVAL 24 HOUR)',
            '7d': 'DATE_SUB(NOW(), INTERVAL 7 DAY)',
            '30d': 'DATE_SUB(NOW(), INTERVAL 30 DAY)',
            '90d': 'DATE_SUB(NOW(), INTERVAL 90 DAY)'
        };
        return conditions[timeframe] || conditions['7d'];
    }

    /**
     * Clean up old sessions from cache
     */
    cleanupSessions() {
        const sessionTimeout = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();

        for (const [userId, session] of this.sessionCache.entries()) {
            if (now - session.lastActivity > sessionTimeout) {
                this.sessionCache.delete(userId);
            }
        }
    }
}

// Create singleton instance
let commandLogger = null;

function createCommandLogger(database) {
    if (!commandLogger) {
        commandLogger = new CommandLoggingService(database);
        
        // Setup session cleanup interval
        setInterval(() => {
            commandLogger.cleanupSessions();
        }, 10 * 60 * 1000); // Clean every 10 minutes
    }
    return commandLogger;
}

module.exports = {
    CommandLoggingService,
    createCommandLogger,
    getCommandLogger: () => commandLogger
};
