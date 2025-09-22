// Example integration with existing WarStateManager

const WarPerformanceService = require('./WarPerformanceService');
const warPerformanceService = new WarPerformanceService();

/**
 * Enhanced war state manager with performance tracking
 */
class EnhancedWarStateManager {
    constructor(warStateManager) {
        this.warStateManager = warStateManager;
    }

    /**
     * Process war data and store performance metrics
     * @param {string} guildId - Discord guild ID
     * @param {Object} warData - Complete war data from Clash of Clans API
     */
    async processWarPerformanceData(guildId, warData) {
        try {
            // Generate unique war ID
            const warId = this.generateWarId(warData);
            
            console.log(`Processing war performance data for war ${warId}`);

            // Process clan members
            if (warData.clan && warData.clan.members) {
                for (const member of warData.clan.members) {
                    await warPerformanceService.storePlayerWarPerformance(
                        guildId,
                        warId,
                        warData,
                        member
                    );
                }
            }

            // If war is ended, update result and recalculate statistics
            if (warData.state === 'warEnded') {
                const result = this.determineWarResult(warData);
                await warPerformanceService.updateWarResult(warId, result);

                // Update statistics for all participants
                if (warData.clan && warData.clan.members) {
                    for (const member of warData.clan.members) {
                        await warPerformanceService.updatePlayerStatistics(guildId, member.tag);
                    }
                }
            }

            console.log(`✅ War performance data processed successfully for war ${warId}`);
            
        } catch (error) {
            console.error('❌ Error processing war performance data:', error);
            throw error;
        }
    }

    /**
     * Generate unique war ID from war data
     * @param {Object} warData - War data
     * @returns {string} Unique war identifier
     */
    generateWarId(warData) {
        // Create unique ID using clan tags and start time
        const clanTag = warData.clan?.tag?.replace('#', '') || 'unknown';
        const opponentTag = warData.opponent?.tag?.replace('#', '') || 'unknown';
        const startTime = warData.preparationStartTime || warData.startTime || Date.now();
        
        // Parse time if it's in CoC format
        let timestamp;
        if (typeof startTime === 'string' && startTime.includes('T')) {
            // Convert CoC time format to timestamp
            const formattedTime = startTime.replace(
                /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/,
                '$1-$2-$3T$4:$5:$6.$7Z'
            );
            timestamp = new Date(formattedTime).getTime();
        } else {
            timestamp = new Date(startTime).getTime();
        }
        
        return `${clanTag}_vs_${opponentTag}_${timestamp}`;
    }

    /**
     * Determine war result based on stars
     * @param {Object} warData - War data
     * @returns {string} 'win', 'loss', or 'tie'
     */
    determineWarResult(warData) {
        const clanStars = warData.clan?.stars || 0;
        const opponentStars = warData.opponent?.stars || 0;
        
        if (clanStars > opponentStars) return 'win';
        if (clanStars < opponentStars) return 'loss';
        return 'win'; // Treat ties as wins
    }

    /**
     * Get enhanced leaderboard data with war performance
     * @param {string} guildId - Discord guild ID
     * @returns {Array} Enhanced player data for leaderboard
     */
    async getEnhancedLeaderboardData(guildId) {
        try {
            // Get war statistics
            const warStats = await warPerformanceService.getWarLeaderboardData(guildId);
            
            // You can merge this with existing clan member data
            // to include current clan status, donations, etc.
            
            return warStats.map(player => ({
                ...player,
                // Format for canvas display
                name: player.player_name,
                tag: player.player_tag,
                warsParticipated: player.warsParticipated,
                winRate: player.winRate.toFixed(1),
                averageStars: player.averageStars.toFixed(2),
                // Add placeholder for current war attack details
                currentWarAttackDetails: [] // This would be populated if there's an active war
            }));
            
        } catch (error) {
            console.error('❌ Error getting enhanced leaderboard data:', error);
            throw error;
        }
    }

    /**
     * Example of how to integrate with your existing war monitoring
     * Call this when war state changes are detected
     */
    async onWarStateChange(guildId, newWarData) {
        try {
            // Your existing war state logic
            await this.warStateManager.handleWarStateChange(guildId, newWarData);
            
            // Add performance tracking
            await this.processWarPerformanceData(guildId, newWarData);
            
            // If war ended, trigger leaderboard update
            if (newWarData.state === 'warEnded') {
                console.log('War ended - updating historical leaderboard');
                // Trigger your existing leaderboard posting logic here
            }
            
        } catch (error) {
            console.error('❌ Error handling war state change:', error);
        }
    }
}

module.exports = EnhancedWarStateManager;