// Enhanced analytics service with command logs integration
// Provides real-time analytics data for dashboard from command logs table

const { getCommandLogger } = require('./commandLogger');

class AnalyticsService {
    constructor(database) {
        this.db = database;
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
    }

    /**
     * Get comprehensive analytics data for dashboard
     */
    async getAnalytics(guildId) {
        try {
            const cacheKey = `analytics_${guildId}`;
            const cached = this.cache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }

            const analytics = await this.fetchAnalyticsData(guildId);
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: analytics,
                timestamp: Date.now()
            });

            return analytics;
        } catch (error) {
            console.error('Error fetching analytics:', error);
            return this.getDefaultAnalytics();
        }
    }

    /**
     * Fetch comprehensive analytics from database
     */
    async fetchAnalyticsData(guildId) {
        if (!this.db || !this.db.sqlPool) {
            return this.getDefaultAnalytics();
        }

        try {
            // Get real-time command statistics
            const commandStats = await this.getCommandStatistics(guildId);
            
            // Get activity trends
            const activityTrends = await this.getActivityTrends(guildId);
            
            // Get recent activity
            const recentActivity = await this.getRecentActivity(guildId);
            
            // Get top commands
            const topCommands = await this.getTopCommands(guildId);
            
            // Get feature usage from guild_moderation_features
            const features = await this.getFeatureUsage(guildId);
            
            // Get guild information
            const guildInfo = await this.getGuildInfo(guildId);

            return {
                totals: {
                    guildName: guildInfo.name || 'Discord Server',
                    members: guildInfo.memberCount || 0,
                    commands: commandStats.totalCommands,
                    commandsEnabled: commandStats.activeCommands,
                    commandsDisabled: commandStats.totalCommands - commandStats.activeCommands,
                    autos: commandStats.automationCommands,
                    autosEnabled: commandStats.activeAutomationCommands
                },
                commands: {
                    today: commandStats.todayCommands,
                    weeklyTrend: activityTrends.weekly,
                    top: topCommands,
                    successRate: commandStats.successRate,
                    avgResponseTime: commandStats.avgResponseTime
                },
                activity: {
                    recent: recentActivity
                },
                features: features,
                guild: {
                    onlineMembers: guildInfo.onlineMembers,
                    newMembersToday: guildInfo.newMembersToday,
                    totalRoles: guildInfo.totalRoles
                },
                performance: {
                    commandsPerHour: commandStats.commandsPerHour,
                    errorRate: commandStats.errorRate,
                    peakHours: commandStats.peakHours
                }
            };
        } catch (error) {
            console.error('Error in fetchAnalyticsData:', error);
            return this.getDefaultAnalytics();
        }
    }

    /**
     * Get command statistics from command logs
     */
    async getCommandStatistics(guildId) {
        try {
            // Total commands in last 24 hours
            const [todayStats] = await this.db.sqlPool.query(`
                SELECT 
                    COUNT(*) as total_commands,
                    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_commands,
                    AVG(response_time_ms) as avg_response_time,
                    COUNT(DISTINCT command_name) as unique_commands
                FROM guild_command_logs 
                WHERE guild_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `, [guildId]);

            // Commands per hour (last 24h)
            const [hourlyStats] = await this.db.sqlPool.query(`
                SELECT 
                    HOUR(executed_at) as hour,
                    COUNT(*) as command_count
                FROM guild_command_logs 
                WHERE guild_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                GROUP BY HOUR(executed_at)
                ORDER BY command_count DESC
                LIMIT 1
            `, [guildId]);

            // Automation commands count
            const [autoStats] = await this.db.sqlPool.query(`
                SELECT 
                    COUNT(DISTINCT command_name) as automation_commands,
                    COUNT(CASE WHEN executed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as active_automation
                FROM guild_command_logs 
                WHERE guild_id = ? AND command_category IN ('automation', 'moderation')
            `, [guildId]);

            const todayData = todayStats[0] || {};
            const autoData = autoStats[0] || {};
            
            return {
                todayCommands: todayData.total_commands || 0,
                totalCommands: todayData.unique_commands || 0,
                activeCommands: todayData.unique_commands || 0,
                automationCommands: autoData.automation_commands || 0,
                activeAutomationCommands: autoData.active_automation || 0,
                successRate: todayData.total_commands > 0 ? 
                    Math.round((todayData.successful_commands / todayData.total_commands) * 100) : 100,
                avgResponseTime: Math.round(todayData.avg_response_time || 0),
                commandsPerHour: Math.round((todayData.total_commands || 0) / 24),
                errorRate: todayData.total_commands > 0 ? 
                    Math.round(((todayData.total_commands - todayData.successful_commands) / todayData.total_commands) * 100) : 0,
                peakHours: hourlyStats[0]?.hour || new Date().getHours()
            };
        } catch (error) {
            console.error('Error getting command statistics:', error);
            return {
                todayCommands: 0,
                totalCommands: 0,
                activeCommands: 0,
                automationCommands: 0,
                activeAutomationCommands: 0,
                successRate: 100,
                avgResponseTime: 0,
                commandsPerHour: 0,
                errorRate: 0,
                peakHours: new Date().getHours()
            };
        }
    }

    /**
     * Get activity trends for charts
     */
    async getActivityTrends(guildId) {
        try {
            const [weeklyData] = await this.db.sqlPool.query(`
                SELECT 
                    DAYNAME(executed_at) as day_name,
                    DATE(executed_at) as date,
                    COUNT(*) as command_count
                FROM guild_command_logs 
                WHERE guild_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY DATE(executed_at), DAYNAME(executed_at)
                ORDER BY date ASC
            `, [guildId]);

            // Format for chart (last 7 days)
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const weekly = days.map(day => {
                const dayData = weeklyData.find(d => d.day_name === day);
                return dayData ? dayData.command_count : 0;
            });

            return { weekly };
        } catch (error) {
            console.error('Error getting activity trends:', error);
            return { weekly: [45, 52, 38, 63, 71, 59, 48] }; // Default data
        }
    }

    /**
     * Get recent activity for activity stream
     */
    async getRecentActivity(guildId, limit = 10) {
        try {
            const commandLogger = getCommandLogger();
            if (commandLogger) {
                return await commandLogger.getRecentActivity(guildId, limit);
            }
            return [];
        } catch (error) {
            console.error('Error getting recent activity:', error);
            return [];
        }
    }

    /**
     * Get top commands for leaderboard
     */
    async getTopCommands(guildId, limit = 5) {
        try {
            const [topCommands] = await this.db.sqlPool.query(`
                SELECT 
                    command_name as name,
                    COUNT(*) as count,
                    AVG(response_time_ms) as avg_response_time
                FROM guild_command_logs 
                WHERE guild_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                GROUP BY command_name
                ORDER BY count DESC
                LIMIT ?
            `, [guildId, limit]);

            return topCommands.map(cmd => ({
                name: cmd.name,
                count: cmd.count,
                avgResponseTime: Math.round(cmd.avg_response_time || 0)
            }));
        } catch (error) {
            console.error('Error getting top commands:', error);
            return [];
        }
    }

    /**
     * Get feature usage from guild_moderation_features table
     */
    async getFeatureUsage(guildId) {
        try {
            const [features] = await this.db.sqlPool.query(`
                SELECT * FROM guild_moderation_features WHERE guild_id = ?
            `, [guildId]);

            return features[0] || {};
        } catch (error) {
            console.error('Error getting feature usage:', error);
            return {};
        }
    }

    /**
     * Get guild information (mock data for now - integrate with Discord API later)
     */
    async getGuildInfo(guildId) {
        // This would integrate with Discord API to get real guild data
        // For now, return mock data
        return {
            name: 'Discord Server',
            memberCount: 195,
            onlineMembers: 127,
            newMembersToday: Math.floor(Math.random() * 20) + 5,
            totalRoles: 12
        };
    }

    /**
     * Get default analytics when database is unavailable
     */
    getDefaultAnalytics() {
        return {
            totals: {
                guildName: 'Discord Server',
                members: 195,
                commands: 25,
                commandsEnabled: 23,
                commandsDisabled: 2,
                autos: 12,
                autosEnabled: 10
            },
            commands: {
                today: 0,
                weeklyTrend: [0, 0, 0, 0, 0, 0, 0],
                top: [],
                successRate: 100,
                avgResponseTime: 0
            },
            activity: {
                recent: []
            },
            features: {},
            guild: {
                onlineMembers: 127,
                newMembersToday: 8,
                totalRoles: 12
            },
            performance: {
                commandsPerHour: 12,
                errorRate: 4,
                peakHours: 15
            }
        };
    }

    /**
     * Clear analytics cache
     */
    clearCache(guildId = null) {
        if (guildId) {
            this.cache.delete(`analytics_${guildId}`);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Get analytics with forced refresh
     */
    async getAnalyticsRefresh(guildId) {
        this.clearCache(guildId);
        return await this.getAnalytics(guildId);
    }
}

// Create singleton instance
let analyticsService = null;

function createAnalyticsService(database) {
    if (!analyticsService) {
        analyticsService = new AnalyticsService(database);
    }
    return analyticsService;
}

function getAnalyticsService() {
    return analyticsService;
}

module.exports = {
    AnalyticsService,
    createAnalyticsService,
    getAnalyticsService
};
