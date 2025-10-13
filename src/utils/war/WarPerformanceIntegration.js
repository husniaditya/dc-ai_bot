const WarPerformanceService = require('../../services/clashofclans/WarPerformanceService');

/**
 * Enhanced WarStateManager with war performance tracking
 * Extends existing WarStateManager to automatically store attack data and calculate statistics
 */
class WarPerformanceIntegration {
    constructor(warStateManager, clashOfClansAPI = null) {
        this.warStateManager = warStateManager;
        this.warPerformanceService = new WarPerformanceService();
        this.clashOfClansAPI = clashOfClansAPI;
        
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
                
                // console.log(`[WarPerformance] Stored attack data for ${warData.clan.members.length} members`);
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
            // console.log(`[WarPerformance] War ended - calculating final statistics for war ${warId}`);

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

            // console.log(`[WarPerformance] ✅ War statistics updated - Result: ${result}, Players: ${warData.clan?.members?.length || 0}`);
            
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
            // console.log('[WarPerformance] Getting enhanced leaderboard data with real war statistics');
            // console.log(`[WarPerformance] Guild ID: ${guildId}, War Data: ${warData ? 'present' : 'null'}`);

            // Validate guild ID
            if (!guildId) {
                console.error('[WarPerformance] No guild ID provided for enhanced leaderboard data');
                return [];
            }

            // Generate war ID if we have current war data
            let currentWarId = null;
            if (warData && warData.state !== 'notInWar') {
                currentWarId = this.generateWarId(warData);
                // console.log(`[WarPerformance] Current war ID: ${currentWarId}`);
            }

            // Get aggregated war statistics with current war data joined
            // console.log(`[WarPerformance] Calling getWarLeaderboardDataWithCurrentWar with guildId: ${guildId}, warId: ${currentWarId}`);
            const warStats = await this.warPerformanceService.getWarLeaderboardDataWithCurrentWar(guildId, 50, currentWarId);
            // console.log(`[WarPerformance] Retrieved ${warStats.length} war statistics records for clan: ${warData?.clan?.tag || 'unknown'}`);
            if (warStats.length === 0) {
                // console.log(`[WarPerformance] No war statistics found for clan ${warData?.clan?.tag || 'unknown'} - this clan may not have historical data yet`);
                return [];
            }

            // Check if war members have role and townhall data
            const hasRoleData = warData && warData.clan && warData.clan.members && 
                               warData.clan.members.some(member => member.role !== undefined);
            const hasTownHallData = warData && warData.clan && warData.clan.members && 
                                   warData.clan.members.some(member => member.townHallLevel !== undefined);
            
            // console.log(`[WarPerformance] War data completeness check: hasRoleData=${hasRoleData}, hasTownHallData=${hasTownHallData}`);
            
            // If war data is missing role/TH info, we need to get clan data from API
            let clanData = null;
            if (!hasRoleData || !hasTownHallData) {
                // console.log('[WarPerformance] War data incomplete, attempting to get clan data for role/TH info');
                try {
                    // Get clan data to supplement missing role/townhall information
                    const clanTag = warData?.clan?.tag;
                    // console.log(`[WarPerformance] Clan tag from war data: ${clanTag}`);
                    // console.log(`[WarPerformance] ClashOfClansAPI available: ${!!this.clashOfClansAPI}`);
                    
                    if (clanTag && this.clashOfClansAPI) {
                        // console.log(`[WarPerformance] Fetching clan data for ${clanTag}`);
                        clanData = await this.clashOfClansAPI.getClanMembers(clanTag);
                    } else {
                        console.log(`[WarPerformance] Cannot fetch clan data: clanTag=${clanTag}, clashOfClansAPI=${!!this.clashOfClansAPI}`);
                    }
                } catch (error) {
                    console.warn('[WarPerformance] Failed to get clan data:', error.message);
                    console.warn('[WarPerformance] Error details:', error);
                }
            }

            // Create maps for current war data from API
            const currentWarRoles = new Map();
            const currentWarTownHalls = new Map();
            const currentWarPositions = new Map();
            
            // Extract data from war API first
            if (warData && warData.clan && warData.clan.members) {
                warData.clan.members.forEach(member => {
                    if (member.tag) {
                        if (member.role) {
                            currentWarRoles.set(member.tag, member.role);
                        }
                        if (member.townHallLevel) {
                            currentWarTownHalls.set(member.tag, member.townHallLevel);
                        }
                        if (member.mapPosition) {
                            currentWarPositions.set(member.tag, member.mapPosition);
                        }
                    }
                });
                // console.log(`[WarPerformance] From war API: ${currentWarRoles.size} roles, ${currentWarTownHalls.size} town halls, ${currentWarPositions.size} positions`);
            }
            
            // Extract additional data from clan API if available
            if (clanData && clanData.items) {
                let clanRolesAdded = 0;
                let clanTHAdded = 0;
                clanData.items.forEach(member => {
                    if (member.tag) {
                        // Add clan data (clan data is more reliable for roles/TH)
                        if (member.role) {
                            currentWarRoles.set(member.tag, member.role);
                            clanRolesAdded++;
                        }
                        if (member.townHallLevel) {
                            currentWarTownHalls.set(member.tag, member.townHallLevel);
                            clanTHAdded++;
                        }
                    }
                });
                // console.log(`[WarPerformance] From clan API: ${clanRolesAdded} roles, ${clanTHAdded} town halls added`);
            }
            
            // console.log(`[WarPerformance] Combined data: ${currentWarRoles.size} roles, ${currentWarTownHalls.size} town halls, ${currentWarPositions.size} positions`);
            
            // Always continue with database statistics even if role/TH data is incomplete
            // The API fallback will handle missing role/TH, but we want to preserve historical stats
            // console.log(`[WarPerformance] Proceeding with database statistics. Missing role/TH data will use defaults.`);
            
            // If no warData, we should use API fallback instead of database
            if (!warData || !warData.clan || !warData.clan.members || warData.clan.members.length === 0) {
                // console.log('[WarPerformance] No current war data available, letting system use API fallback instead of database');
                return [];
            }
            
            if (warData && warData.clan && warData.clan.members) {
                // Debug: Log first few members to see their structure
                if (warData.clan.members.length > 0) {
                }
                
                warData.clan.members.forEach(member => {
                    if (member.tag) {
                        if (member.role) {
                            currentWarRoles.set(member.tag, member.role);
                        }
                        if (member.townHallLevel) {
                            currentWarTownHalls.set(member.tag, member.townHallLevel);
                        }
                    }
                });
                // console.log(`[WarPerformance] Found ${currentWarRoles.size} roles, ${currentWarTownHalls.size} town halls from current war API data`);
                
                // Debug: Log a few role mappings
                let roleCount = 0;
                for (let [tag, role] of currentWarRoles) {
                    if (roleCount < 3) {
                        // console.log(`[WarPerformance] Role mapping: ${tag} -> ${role}`);
                        roleCount++;
                    }
                }
            } else {
                console.log(`[WarPerformance] No current war data available for role/TH extraction. warData: ${!!warData}, clan: ${!!(warData && warData.clan)}, members: ${!!(warData && warData.clan && warData.clan.members)}`);
            }
            
            // If there's a current war, add current war attack details
            if (currentWarId) {
                // Build defenderTag -> opponent mapPosition mapping once
                const defenderTagToPos = new Map();
                try {
                    const opponentMembers = warData?.opponent?.members || [];
                    for (const m of opponentMembers) {
                        if (m?.tag) defenderTagToPos.set(m.tag, m.mapPosition || 0);
                    }
                } catch {}
                for (const player of warStats) {
                    try {
                        // Get current war attack details for canvas display
                        const currentWarAttacks = await this.warPerformanceService.getCurrentWarAttacks(currentWarId, player.player_tag);
                        // Map defenderTag to actual position when possible
                        player.currentWarAttackDetails = (currentWarAttacks || []).map(a => ({
                            ...a,
                            defenderPosition: (a.defenderPosition && a.defenderPosition > 0)
                                ? a.defenderPosition
                                : (a.defenderTag ? (defenderTagToPos.get(a.defenderTag) || 0) : 0)
                        }));
                    } catch (attackError) {
                        console.warn(`[WarPerformance] Failed to get current war attacks for player ${player.player_tag}:`, attackError.message);
                        player.currentWarAttackDetails = [];
                    }
                }
            }

            // Format data for LeaderboardCanvas compatibility
            const enhancedData = warStats.map((player, index) => {
                // For role: Always use current war API data (roles can change between wars)
                const foundRole = currentWarRoles.get(player.player_tag);
                const finalRole = foundRole || 'member';
                // For town hall: Use database data first (from war performance), then current API data
                const finalTownHall = player.townhall_level || currentWarTownHalls.get(player.player_tag) || 1;
                
                return {
                    rank: index + 1,
                    name: player.player_name,
                    tag: player.player_tag,
                    
                    // Essential properties for canvas display
                    role: finalRole,
                    townHallLevel: finalTownHall,
                    
                    // War statistics for canvas display (always from database)
                    warsParticipated: player.warsParticipated || 0,
                    winRate: parseFloat(player.winRate || 0).toFixed(1),
                    averageStars: parseFloat(player.averageStars || 0).toFixed(2),
                    
                    // Current war position (from database JOIN or war API)
                    currentWarPosition: player.currentWarPosition || currentWarPositions.get(player.player_tag) || Number.MAX_SAFE_INTEGER,
                    
                    // Current war attack details (if available)
                    currentWarAttackDetails: player.currentWarAttackDetails || [],
                    
                    // Additional data that might be useful
                    totalStarsEarned: player.total_stars_earned || 0,
                    totalAttacksMade: player.total_attacks_made || 0,
                    lastWarDate: player.last_war_date
                };
            });

            // Sort by current war position (database already does this, but ensure it)
            enhancedData.sort((a, b) => {
                const aPos = a.currentWarPosition;
                const bPos = b.currentWarPosition;
                return aPos - bPos;
            });

            // Update ranks based on final sorting order
            enhancedData.forEach((player, index) => {
                player.rank = index + 1;
            });

            // console.log(`[WarPerformance] ✅ Enhanced leaderboard data ready: ${enhancedData.length} players, sorted by war position`);
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
                // console.warn('[WarPerformance] No war performance data available, using fallback');
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