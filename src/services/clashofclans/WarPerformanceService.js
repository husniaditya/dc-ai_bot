const mysql = require('mysql2/promise');

class WarPerformanceService {
    constructor() {
        this.dbConfig = {
            host: process.env.MARIADB_HOST || process.env.DB_HOST,
            user: process.env.MARIADB_USER || process.env.DB_USER,
            password: process.env.MARIADB_PASS || process.env.DB_PASSWORD,
            database: process.env.MARIADB_DB || process.env.DB_NAME,
            port: process.env.MARIADB_PORT || process.env.DB_PORT
        };
    }

    /**
     * Convert various datetime formats to MySQL-compatible datetime string
     * Handles Clash of Clans API format and standard formats
     * @param {string|Date} dateValue - Date value to convert
     * @returns {string|null} MySQL-compatible datetime string or null
     */
    formatDateForMySQL(dateValue) {
        if (!dateValue) return null;
        
        try {
            let date;
            
            if (typeof dateValue === 'string') {
                // Handle Clash of Clans API format: 20250921T092450.000Z
                if (dateValue.match(/^\d{8}T\d{6}\.\d{3}Z$/)) {
                    const formattedTime = dateValue.replace(
                        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/,
                        '$1-$2-$3T$4:$5:$6.$7Z'
                    );
                    date = new Date(formattedTime);
                } else {
                    date = new Date(dateValue);
                }
            } else {
                date = new Date(dateValue);
            }
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                // console.warn('[WarPerformanceService] Invalid date value:', dateValue);
                return null;
            }
            
            // Convert to MySQL datetime format
            return date.toISOString().slice(0, 19).replace('T', ' ');
            
        } catch (error) {
            // console.warn('[WarPerformanceService] Error formatting date:', dateValue, error.message);
            return null;
        }
    }

    /**
     * Create database connection
     */
    async getConnection() {
        return await mysql.createConnection(this.dbConfig);
    }

    /**
     * Store war performance data for a player
     * @param {string} guildId - Discord guild ID
     * @param {string} warId - Unique war identifier  
     * @param {Object} warData - War data from Clash of Clans API
     * @param {Object} playerData - Player data from API response like your example
     */
    async storePlayerWarPerformance(guildId, warId, warData, playerData) {
        const connection = await this.getConnection();
        
        try {
            // Extract attack data
            const attacks = playerData.attacks || [];
            const attack1 = attacks[0] || null;
            const attack2 = attacks[1] || null;
            
            // Calculate totals
            const totalStars = attacks.reduce((sum, attack) => sum + (attack.stars || 0), 0);
            const totalDestruction = attacks.reduce((sum, attack) => sum + (attack.destructionPercentage || 0), 0);
            const avgDestruction = attacks.length > 0 ? totalDestruction / attacks.length : 0;

            const query = `
                INSERT INTO guild_coc_war_performance (
                    war_id, guild_id, war_start_time, war_end_time, war_state,
                    player_tag, player_name, townhall_level, map_position,
                    attacks_used, opponent_attacks_received,
                    attack_1_defender_tag, attack_1_stars, attack_1_destruction_percentage, 
                    attack_1_order, attack_1_duration,
                    attack_2_defender_tag, attack_2_stars, attack_2_destruction_percentage,
                    attack_2_order, attack_2_duration,
                    total_stars_earned, average_destruction
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    player_name = VALUES(player_name),
                    townhall_level = VALUES(townhall_level),
                    map_position = VALUES(map_position),
                    attacks_used = VALUES(attacks_used),
                    opponent_attacks_received = VALUES(opponent_attacks_received),
                    attack_1_defender_tag = VALUES(attack_1_defender_tag),
                    attack_1_stars = VALUES(attack_1_stars),
                    attack_1_destruction_percentage = VALUES(attack_1_destruction_percentage),
                    attack_1_order = VALUES(attack_1_order),
                    attack_1_duration = VALUES(attack_1_duration),
                    attack_2_defender_tag = VALUES(attack_2_defender_tag),
                    attack_2_stars = VALUES(attack_2_stars),
                    attack_2_destruction_percentage = VALUES(attack_2_destruction_percentage),
                    attack_2_order = VALUES(attack_2_order),
                    attack_2_duration = VALUES(attack_2_duration),
                    total_stars_earned = VALUES(total_stars_earned),
                    average_destruction = VALUES(average_destruction),
                    updated_at = CURRENT_TIMESTAMP
            `;

            // Ensure all values are properly defined and of correct type
            const values = [
                warId || null,                                           // 1: war_id
                guildId || null,                                        // 2: guild_id
                this.formatDateForMySQL(warData?.startTime) || null,    // 3: war_start_time
                this.formatDateForMySQL(warData?.endTime) || null,      // 4: war_end_time
                warData?.state || 'inWar',                             // 5: war_state
                playerData?.tag || null,                               // 6: player_tag
                playerData?.name || null,                              // 7: player_name
                playerData?.townhallLevel || null,                     // 8: townhall_level
                playerData?.mapPosition || null,                       // 9: map_position
                attacks.length || 0,                                   // 10: attacks_used
                playerData?.opponentAttacks || 0,                      // 11: opponent_attacks_received
                // Attack 1
                attack1?.defenderTag || null,                          // 12: attack_1_defender_tag
                attack1 ? (attack1.stars ?? null) : null,              // 13: attack_1_stars (handle 0 stars properly)
                attack1?.destructionPercentage || null,                // 14: attack_1_destruction_percentage
                attack1?.order || null,                                // 15: attack_1_order
                attack1?.duration || null,                             // 16: attack_1_duration
                // Attack 2
                attack2?.defenderTag || null,                          // 17: attack_2_defender_tag
                attack2 ? (attack2.stars ?? null) : null,              // 18: attack_2_stars (handle 0 stars properly)
                attack2?.destructionPercentage || null,                // 19: attack_2_destruction_percentage
                attack2?.order || null,                                // 20: attack_2_order
                attack2?.duration || null,                             // 21: attack_2_duration
                // Totals
                totalStars || 0,                                       // 22: total_stars_earned
                Math.round((avgDestruction || 0) * 100) / 100          // 23: average_destruction
            ];

            // Debug log to verify parameter count
            // console.log(`[WarPerformanceService] Storing performance for ${playerData?.name} with ${values.length} parameters`);
            
            await connection.execute(query, values);
            // console.log(`✅ Stored war performance for ${playerData?.name} (${playerData?.tag}) in war ${warId}`);
            
        } catch (error) {
            console.error('❌ Error storing war performance:', error);
            console.error('❌ Query parameters count:', error.message);
            console.error('❌ Player data:', JSON.stringify(playerData, null, 2));
            console.error('❌ War data:', JSON.stringify(warData, null, 2));
            throw error;
        } finally {
            await connection.end();
        }
    }

    /**
     * Update war result for all players in a war
     * @param {string} warId - War identifier
     * @param {string} result - 'win', 'loss', or 'tie'
     */
    async updateWarResult(warId, result) {
        const connection = await this.getConnection();
        
        try {
            await connection.execute(
                'UPDATE guild_coc_war_performance SET war_result = ?, war_state = ? WHERE war_id = ?',
                [result, 'warEnded', warId]
            );
            console.log(`✅ Updated war result to ${result} and state to warEnded for war ${warId}`);
        } catch (error) {
            console.error('❌ Error updating war result:', error);
            throw error;
        } finally {
            await connection.end();
        }
    }

    /**
     * Update aggregated war statistics for a player
     * @param {string} guildId - Discord guild ID
     * @param {string} playerTag - Player tag
     */
    async updatePlayerStatistics(guildId, playerTag) {
        const connection = await this.getConnection();
        
        try {
            // Calculate aggregated statistics
            const [stats] = await connection.execute(`
                SELECT 
                    player_name,
                    COUNT(*) as total_wars,
                    SUM(CASE WHEN war_result = 'win' THEN 1 ELSE 0 END) as wars_won,
                    SUM(CASE WHEN war_result = 'loss' THEN 1 ELSE 0 END) as wars_lost,
                    SUM(CASE WHEN war_result = 'tie' THEN 1 ELSE 0 END) as wars_tied,
                    SUM(attacks_used) as total_attacks,
                    SUM(total_stars_earned) as total_stars,
                    AVG(average_destruction) as avg_destruction,
                    MAX(war_start_time) as last_war_date
                FROM guild_coc_war_performance 
                WHERE guild_id = ? AND player_tag = ? AND war_state = 'warEnded'
                GROUP BY player_tag, player_name
            `, [guildId, playerTag]);

            if (stats.length === 0) {
                // Debug: Check if player has any records at all
                const [debugStats] = await connection.execute(`
                    SELECT war_state, war_result, COUNT(*) as count
                    FROM guild_coc_war_performance 
                    WHERE guild_id = ? AND player_tag = ?
                    GROUP BY war_state, war_result
                `, [guildId, playerTag]);
                
                if (debugStats.length > 0) {
                    // console.log(`[WarPerformanceService] Player ${playerTag} has records but no completed wars:`, 
                        // debugStats.map(d => `${d.war_state}/${d.war_result}: ${d.count}`).join(', '));
                } else {
                    // console.log(`[WarPerformanceService] No war records found at all for player ${playerTag}`);
                }
                return;
            }

            const stat = stats[0];
            const winRate = stat.total_wars > 0 ? (stat.wars_won / stat.total_wars) * 100 : 0;
            const avgStarsPerAttack = stat.total_attacks > 0 ? stat.total_stars / stat.total_attacks : 0;

            // Ensure all values are properly formatted for MySQL
            const values = [
                guildId || null,                                       // 1: guild_id
                playerTag || null,                                     // 2: player_tag
                stat.player_name || null,                             // 3: player_name
                parseInt(stat.total_wars) || 0,                       // 4: total_wars_participated
                parseInt(stat.wars_won) || 0,                         // 5: total_wars_won
                parseInt(stat.wars_lost) || 0,                        // 6: total_wars_lost
                parseInt(stat.wars_tied) || 0,                        // 7: total_wars_tied
                parseInt(stat.total_attacks) || 0,                    // 8: total_attacks_made
                parseInt(stat.total_stars) || 0,                      // 9: total_stars_earned
                Math.round((stat.avg_destruction || 0) * 100) / 100,  // 10: total_destruction
                Math.round(winRate * 100) / 100,                      // 11: win_rate
                Math.round(avgStarsPerAttack * 100) / 100,            // 12: average_stars_per_attack
                Math.round((stat.avg_destruction || 0) * 100) / 100,  // 13: average_destruction_per_attack
                this.formatDateForMySQL(stat.last_war_date) || null   // 14: last_war_date
            ];

            // Update or insert summary statistics
            await connection.execute(`
                INSERT INTO guild_coc_war_statistics_summary (
                    guild_id, player_tag, player_name,
                    total_wars_participated, total_wars_won, total_wars_lost, total_wars_tied,
                    total_attacks_made, total_stars_earned, total_destruction,
                    win_rate, average_stars_per_attack, average_destruction_per_attack,
                    last_war_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    player_name = VALUES(player_name),
                    total_wars_participated = VALUES(total_wars_participated),
                    total_wars_won = VALUES(total_wars_won),
                    total_wars_lost = VALUES(total_wars_lost),
                    total_wars_tied = VALUES(total_wars_tied),
                    total_attacks_made = VALUES(total_attacks_made),
                    total_stars_earned = VALUES(total_stars_earned),
                    total_destruction = VALUES(total_destruction),
                    win_rate = VALUES(win_rate),
                    average_stars_per_attack = VALUES(average_stars_per_attack),
                    average_destruction_per_attack = VALUES(average_destruction_per_attack),
                    last_war_date = VALUES(last_war_date),
                    updated_at = CURRENT_TIMESTAMP
            `, values);

            console.log(`✅ Updated statistics for ${stat.player_name} (${playerTag}) - ${stat.total_wars} wars, ${winRate.toFixed(1)}% win rate`);
            
        } catch (error) {
            console.error('❌ Error updating player statistics:', error);
            console.error('❌ Guild ID:', guildId);
            console.error('❌ Player Tag:', playerTag);
            throw error;
        } finally {
            await connection.end();
        }
    }

    /**
     * Get war statistics for leaderboard display with current war data
     * @param {string} guildId - Discord guild ID
     * @param {number} limit - Number of players to return
     * @param {string} currentWarId - Current war ID to join with (optional)
     * @returns {Array} Array of player statistics with current war data
     */
    async getWarLeaderboardDataWithCurrentWar(guildId, limit = 50, currentWarId = null) {
        const connection = await this.getConnection();
        
        try {
            // Validate and sanitize parameters
            const validGuildId = String(guildId || '').trim();
            const validLimit = Math.max(1, Math.min(parseInt(limit) || 50, 200));
            
            if (!validGuildId) {
                return [];
            }

            let query;
            let queryParams;

            if (currentWarId) {
                // JOIN with current war performance data to get town hall and position
                // Only show players who are actually in the current war
                query = `
                    SELECT DISTINCT
                        s.player_tag,
                        s.player_name,
                        s.total_wars_participated as warsParticipated,
                        s.win_rate as winRate,
                        s.average_stars_per_attack as averageStars,
                        s.total_stars_earned,
                        s.total_attacks_made,
                        s.last_war_date,
                        p.townhall_level,
                        p.map_position as currentWarPosition
                    FROM guild_coc_war_statistics_summary s
                    INNER JOIN guild_coc_war_performance p ON s.player_tag = p.player_tag 
                        AND p.guild_id = s.guild_id 
                        AND p.war_id = ?
                    WHERE s.guild_id = ?
                    ORDER BY 
                        p.map_position ASC,
                        s.total_wars_participated DESC, 
                        s.win_rate DESC, 
                        s.average_stars_per_attack DESC
                    LIMIT ${validLimit}
                `;
                queryParams = [currentWarId, validGuildId];
            } else {
                // Fallback to original query when no current war
                query = `
                    SELECT 
                        player_tag,
                        player_name,
                        total_wars_participated as warsParticipated,
                        win_rate as winRate,
                        average_stars_per_attack as averageStars,
                        total_stars_earned,
                        total_attacks_made,
                        last_war_date,
                        NULL as townhall_level,
                        NULL as currentWarPosition
                    FROM guild_coc_war_statistics_summary 
                    WHERE guild_id = ? 
                    ORDER BY total_wars_participated DESC, win_rate DESC, average_stars_per_attack DESC
                    LIMIT ${validLimit}
                `;
                queryParams = [validGuildId];
            }

            const [players] = await connection.execute(query, queryParams);

            // Add rank numbers
            const rankedPlayers = players.map((player, index) => ({
                ...player,
                rank: index + 1
            }));

            return rankedPlayers;
            
        } catch (error) {
            console.error('❌ Error getting war leaderboard data with current war:', error);
            console.error('❌ Error details:', {
                message: error.message,
                code: error.code,
                errno: error.errno,
                sqlState: error.sqlState
            });
            return [];
        } finally {
            await connection.end();
        }
    }

    /**
     * Get war statistics for leaderboard display
     * @param {string} guildId - Discord guild ID
     * @param {number} limit - Number of players to return
     * @returns {Array} Array of player statistics
     */
    async getWarLeaderboardData(guildId, limit = 50) {
        const connection = await this.getConnection();
        
        try {
            // Validate and sanitize parameters
            const validGuildId = String(guildId || '').trim();
            const validLimit = Math.max(1, Math.min(parseInt(limit) || 50, 200));
            
            if (!validGuildId) {
                // console.error('[WarPerformanceService] No valid guild ID provided');
                return [];
            }

            // console.log(`[WarPerformanceService] Getting leaderboard data for guild ${validGuildId}, limit ${validLimit}`);

            // Use string interpolation for LIMIT to avoid MySQL parameter type issues
            // Only guild_id uses parameter binding for security
            const query = `
                SELECT 
                    player_tag,
                    player_name,
                    total_wars_participated as warsParticipated,
                    win_rate as winRate,
                    average_stars_per_attack as averageStars,
                    total_stars_earned,
                    total_attacks_made,
                    last_war_date
                FROM guild_coc_war_statistics_summary 
                WHERE guild_id = ? 
                ORDER BY total_wars_participated DESC, win_rate DESC, average_stars_per_attack DESC
                LIMIT ${validLimit}
            `;

            // console.log('[WarPerformanceService] Executing query with guild_id parameter:', validGuildId);

            const [players] = await connection.execute(query, [validGuildId]);

            // console.log(`[WarPerformanceService] Found ${players.length} players in leaderboard`);

            // Add rank numbers
            const rankedPlayers = players.map((player, index) => ({
                ...player,
                rank: index + 1
            }));

            return rankedPlayers;
            
        } catch (error) {
            console.error('❌ Error getting war leaderboard data:', error);
            console.error('❌ Error details:', {
                message: error.message,
                code: error.code,
                errno: error.errno,
                sqlState: error.sqlState
            });
            console.error('❌ Guild ID:', guildId, typeof guildId);
            console.error('❌ Limit:', limit, typeof limit);
            
            // Return empty array instead of throwing to prevent cascading failures
            return [];
        } finally {
            await connection.end();
        }
    }

    /**
     * Get current war attack details for a player (for canvas display)
     * @param {string} warId - War identifier
     * @param {string} playerTag - Player tag
     * @returns {Array} Array of attack details
     */
    async getCurrentWarAttacks(warId, playerTag) {
        const connection = await this.getConnection();
        
        try {
            // Validate parameters
            const validWarId = warId || null;
            const validPlayerTag = playerTag || null;

            if (!validWarId || !validPlayerTag) {
                // console.log(`[WarPerformanceService] Missing required parameters: warId=${validWarId}, playerTag=${validPlayerTag}`);
                return [];
            }

            const [rows] = await connection.execute(`
                SELECT 
                    attack_1_defender_tag, attack_1_stars, attack_1_destruction_percentage, attack_1_order,
                    attack_2_defender_tag, attack_2_stars, attack_2_destruction_percentage, attack_2_order,
                    map_position
                FROM guild_coc_war_performance 
                WHERE war_id = ? AND player_tag = ?
            `, [validWarId, validPlayerTag]);

            if (rows.length === 0) {
                // console.log(`[WarPerformanceService] No attack data found for player ${validPlayerTag} in war ${validWarId}`);
                return [];
            }

            const data = rows[0];
            const attacks = [];

            // Attack 1
            if (data.attack_1_defender_tag) {
                attacks.push({
                    defenderPosition: '?', // You might need to map defender tags to positions
                    attackNumber: 1,
                    stars: data.attack_1_stars,
                    destructionPercentage: data.attack_1_destruction_percentage
                });
            }

            // Attack 2
            if (data.attack_2_defender_tag) {
                attacks.push({
                    defenderPosition: '?',
                    attackNumber: 2,
                    stars: data.attack_2_stars,
                    destructionPercentage: data.attack_2_destruction_percentage
                });
            }

            return attacks;
            
        } catch (error) {
            console.error('❌ Error getting current war attacks:', error);
            console.error('❌ War ID:', warId);
            console.error('❌ Player Tag:', playerTag);
            throw error;
        } finally {
            await connection.end();
        }
    }
}

module.exports = WarPerformanceService;