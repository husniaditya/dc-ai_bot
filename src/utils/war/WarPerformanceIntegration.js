const WarPerformanceService = require('../../services/clashofclans/WarPerformanceService');

/**
 * Enhanced WarStateManager with war performance tracking
 * Extends existing WarStateManager to automatically store attack data and calculate statistics
 */
class WarPerformanceIntegration {
    constructor(warStateManager) {
        this.warStateManager = warStateManager;
        this.warPerformanceService = new WarPerformanceService();
        
        // Cache for war IDs to avoid regenerating
        this.warIdCache = new Map();
    }

    /**
     * Enhanced war state processing with performance tracking
     * @param {string} guildId - Discord guild ID
     * @param {string} clanTag - Clan tag
     * @param {Object} newWarData - Fresh war data from Clash of Clans API
     * @param {Object} currentState - Current war state from database
     */
    async processWarWithPerformanceTracking(guildId, clanTag, newWarData, currentState) {
        try {
            // First, handle the normal war state transition
            const stateChanged = await this.warStateManager.handleStateTransition(guildId, clanTag, newWarData, currentState);
            
            // If there's war data, process performance tracking
            if (newWarData && newWarData.state !== 'notInWar') {
                await this.processWarPerformance(guildId, newWarData);
            }

            return stateChanged;
            
        } catch (error) {
            console.error('[WarPerformanceIntegration] Error processing war with performance tracking:', error);
            throw error;
        }
    }

    /**
     * Process war performance data - FEATURE 1: Store attack data when wars are monitored
     * @param {string} guildId - Discord guild ID
     * @param {Object} warData - War data from API
     */
    async processWarPerformance(guildId, warData) {
        try {
            const warId = this.generateWarId(warData);
            
            // console.log(`[WarPerformance] Processing performance data for war ${warId}, state: ${warData.state}`);

            // Store performance data for clan members
            if (warData.clan && warData.clan.members) {
                for (const member of warData.clan.members) {
                    await this.warPerformanceService.storePlayerWarPerformance(
                        guildId,
                        warId,
                        warData,
                        member
                    );
                }
                
                console.log(`[WarPerformance] Stored attack data for ${warData.clan.members.length} members`);
            }

            // FEATURE 2: Calculate statistics when wars end
            if (warData.state === 'warEnded') {
                await this.handleWarEnded(guildId, warId, warData);
            }

        } catch (error) {
            console.error('[WarPerformance] Error processing war performance:', error);
            // Don't throw - we don't want performance tracking to break war monitoring
        }
    }

    /**
     * Handle war ended - calculate final statistics
     * @param {string} guildId - Discord guild ID
     * @param {string} warId - War ID
     * @param {Object} warData - War data
     */
    async handleWarEnded(guildId, warId, warData) {
        try {
            console.log(`[WarPerformance] War ended - calculating final statistics for war ${warId}`);

            // Determine war result
            const result = this.determineWarResult(warData);
            
            // Update war result for all participants
            await this.warPerformanceService.updateWarResult(warId, result);
            
            // Update aggregated statistics for each participant
            if (warData.clan && warData.clan.members) {
                for (const member of warData.clan.members) {
                    await this.warPerformanceService.updatePlayerStatistics(guildId, member.tag);
                }
            }

            console.log(`[WarPerformance] ✅ War statistics updated - Result: ${result}, Players: ${warData.clan?.members?.length || 0}`);
            
        } catch (error) {
            console.error('[WarPerformance] Error handling war end:', error);
        }
    }

    /**
     * FEATURE 3: Provide real data for war leaderboard canvas
     * Get enhanced leaderboard data with real war performance statistics
     * @param {string} guildId - Discord guild ID
     * @param {Object} warData - Current war data (optional)
     * @returns {Array} Enhanced player data for leaderboard canvas
     */
    async getEnhancedLeaderboardData(guildId, warData = null) {
        try {
            console.log('[WarPerformance] Getting enhanced leaderboard data with real war statistics');
            console.log(`[WarPerformance] Guild ID: ${guildId}, War Data: ${warData ? 'present' : 'null'}`);

            // Validate guild ID
            if (!guildId) {
                console.error('[WarPerformance] No guild ID provided for enhanced leaderboard data');
                return [];
            }

            // Get aggregated war statistics
            console.log(`[WarPerformance] Calling getWarLeaderboardData with guildId: ${guildId}`);
            const warStats = await this.warPerformanceService.getWarLeaderboardData(guildId, 50);
            console.log(`[WarPerformance] Retrieved ${warStats.length} war statistics records`);
            
            // If there's a current war, add current war attack details
            if (warData && warData.state !== 'notInWar') {
                const warId = this.generateWarId(warData);
                console.log(`[WarPerformance] Getting current war attack details for war: ${warId}`);
                
                for (const player of warStats) {
                    try {
                        // Get current war attack details for canvas display
                        const currentWarAttacks = await this.warPerformanceService.getCurrentWarAttacks(warId, player.player_tag);
                        player.currentWarAttackDetails = currentWarAttacks;
                    } catch (attackError) {
                        console.warn(`[WarPerformance] Failed to get current war attacks for player ${player.player_tag}:`, attackError.message);
                        player.currentWarAttackDetails = [];
                    }
                }
            }

            // Format data for LeaderboardCanvas compatibility
            const enhancedData = warStats.map((player, index) => ({
                rank: index + 1,
                name: player.player_name,
                tag: player.player_tag,
                
                // War statistics for canvas display
                warsParticipated: player.warsParticipated || 0,
                winRate: (player.winRate || 0).toFixed(1),
                averageStars: (player.averageStars || 0).toFixed(2),
                
                // Current war attack details (if available)
                currentWarAttackDetails: player.currentWarAttackDetails || [],
                
                // Additional data that might be useful
                totalStarsEarned: player.total_stars_earned || 0,
                totalAttacksMade: player.total_attacks_made || 0,
                lastWarDate: player.last_war_date
            }));

            console.log(`[WarPerformance] ✅ Enhanced leaderboard data ready: ${enhancedData.length} players`);
            return enhancedData;
            
        } catch (error) {
            console.error('[WarPerformance] Error getting enhanced leaderboard data:', error);
            console.error('[WarPerformance] Error details:', {
                message: error.message,
                code: error.code,
                errno: error.errno,
                sqlState: error.sqlState,
                guildId: guildId
            });
            // Return empty array as fallback
            return [];
        }
    }

    /**
     * Generate unique war ID from war data
     * @param {Object} warData - War data
     * @returns {string} Unique war identifier
     */
    generateWarId(warData) {
        // Check cache first
        const cacheKey = JSON.stringify({
            clan: warData.clan?.tag,
            opponent: warData.opponent?.tag,
            start: warData.preparationStartTime || warData.startTime
        });
        
        if (this.warIdCache.has(cacheKey)) {
            return this.warIdCache.get(cacheKey);
        }

        // Generate new war ID
        const clanTag = warData.clan?.tag?.replace('#', '') || 'unknown';
        const opponentTag = warData.opponent?.tag?.replace('#', '') || 'unknown';
        const startTime = warData.preparationStartTime || warData.startTime || Date.now();
        
        // Parse Clash of Clans time format if needed
        let timestamp;
        if (typeof startTime === 'string' && startTime.includes('T')) {
            const formattedTime = startTime.replace(
                /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/,
                '$1-$2-$3T$4:$5:$6.$7Z'
            );
            timestamp = new Date(formattedTime).getTime();
        } else {
            timestamp = new Date(startTime).getTime();
        }
        
        const warId = `${clanTag}_vs_${opponentTag}_${timestamp}`;
        
        // Cache the result
        this.warIdCache.set(cacheKey, warId);
        
        return warId;
    }

    /**
     * Determine war result based on clan vs opponent stars
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
     * Integration point: Replace your existing war monitoring call with this
     * This maintains all existing functionality while adding performance tracking
     */
    async monitorWarWithPerformance(guildId, clanTag, warData) {
        try {
            // Get current state
            const currentState = await this.warStateManager.getCurrentWarState(guildId, clanTag);
            
            // Process with performance tracking
            return await this.processWarWithPerformanceTracking(guildId, clanTag, warData, currentState);
            
        } catch (error) {
            console.error('[WarPerformanceIntegration] Error in war monitoring:', error);
            throw error;
        }
    }

    /**
     * Get real war leaderboard data for canvas generation
     * Call this instead of using mock data in your leaderboard generation
     */
    async generateRealWarLeaderboard(guildId, config, warData = null, warState = 'ended') {
        try {
            // Get real performance data
            const realPlayerData = await this.getEnhancedLeaderboardData(guildId, warData);
            
            if (realPlayerData.length === 0) {
                console.warn('[WarPerformance] No war performance data available, using fallback');
                return null; // Your existing code can handle this
            }

            // Return data ready for LeaderboardCanvas
            return {
                players: realPlayerData,
                warData: warData || {},
                dataSource: 'real_performance_data'
            };
            
        } catch (error) {
            console.error('[WarPerformance] Error generating real war leaderboard:', error);
            return null;
        }
    }
}

module.exports = WarPerformanceIntegration;