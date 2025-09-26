/**
 * Manages war state transitions and message tracking for war leaderboards
 * Handles the lifecycle: preparing -> active -> ended
 */
class WarStateManager {
    constructor(database) {
        this.db = database;
        
        // War states
        this.STATES = {
            PREPARING: 'preparation',    // Clan API state: 'preparation'
            ACTIVE: 'inWar',            // Clan API state: 'inWar' 
            ENDED: 'warEnded',          // Clan API state: 'warEnded'
            NOT_IN_WAR: 'notInWar'      // Clan API state: 'notInWar'
        };
        
        // Message types for different war states
        this.MESSAGE_TYPES = {
            PREPARING: 'preparing_war',
            ACTIVE: 'active_war', 
            ENDED: 'ended_war'
        };
    }

    /**
     * Convert JavaScript Date to MySQL-compatible datetime string
     * @param {Date} date - Date object to convert
     * @returns {string} MySQL-compatible datetime string
     */
    formatDateForMySQL(date = new Date()) {
        return date.toISOString().slice(0, 19).replace('T', ' ');
    }

    /**
     * Determines the normalized war state from API war data
     * @param {Object} warData - War data from Clash of Clans API
     * @returns {string} Normalized war state
     */
    getWarState(warData) {
        if (!warData || warData.state === 'notInWar') {
            return this.STATES.NOT_IN_WAR;
        }
        
        switch (warData.state) {
            case 'preparation':
                return this.STATES.PREPARING;
            case 'inWar':
                return this.STATES.ACTIVE;
            case 'warEnded':
                return this.STATES.ENDED;
            default:
                console.warn(`[WarStateManager] Unknown war state: ${warData.state}`);
                return this.STATES.NOT_IN_WAR;
        }
    }

    /**
     * Gets the current war state for a clan from database tracking
     * @param {string} guildId - Guild ID
     * @param {string} clanTag - Clan tag
     * @returns {Object} Current war state tracking data
     */
    async getCurrentWarState(guildId, clanTag) {
        try {
            // Validate parameters to prevent undefined values in SQL queries
            if (!guildId || !clanTag) {
                // console.warn('[WarStateManager] getCurrentWarState called with invalid parameters:', { guildId, clanTag });
                return null;
            }

            const [rows] = await this.db.execute(`
                SELECT war_current_state, war_preparing_message_id, 
                       war_active_message_id, war_last_state_change, war_state_data
                FROM guild_clashofclans_watch 
                WHERE guild_id = ? AND clan_tag = ?
            `, [guildId, clanTag]);

            if (rows.length === 0) {
                return null;
            }

            const row = rows[0];
            let stateData = null;
            if (row.war_state_data) {
                try {
                    // Check for the specific "[object Object]" corruption before parsing
                    const dataStr = typeof row.war_state_data === 'string' ? row.war_state_data : String(row.war_state_data);
                    
                    if (dataStr === '[object Object]' || dataStr.includes('[object Object]')) {
                        // console.warn('[WarStateManager] Detected corrupted "[object Object]" in war_state_data, cleaning up...');
                        
                        // Clean up the corrupted data in the database
                        try {
                            await this.db.execute(`
                                UPDATE guild_clashofclans_watch 
                                SET war_state_data = NULL 
                                WHERE guild_id = ? AND clan_tag = ?
                            `, [guildId, clanTag]);
                            // console.log('[WarStateManager] Cleaned up corrupted war_state_data');
                        } catch (cleanupError) {
                            console.error('[WarStateManager] Error cleaning up corrupted war_state_data:', cleanupError.message);
                        }
                        
                        stateData = {};
                    } else {
                        // Handle case where war_state_data might already be an object
                        if (typeof row.war_state_data === 'object') {
                            stateData = row.war_state_data;
                        } else {
                            stateData = JSON.parse(dataStr);
                        }
                    }
                } catch (e) {
                    console.warn('[WarStateManager] Invalid JSON in war_state_data:', e.message);
                    
                    // Clean up any invalid JSON in the database
                    try {
                        await this.db.execute(`
                            UPDATE guild_clashofclans_watch 
                            SET war_state_data = NULL 
                            WHERE guild_id = ? AND clan_tag = ?
                        `, [guildId, clanTag]);
                        // console.log('[WarStateManager] Cleaned up invalid war_state_data');
                    } catch (cleanupError) {
                        console.error('[WarStateManager] Error cleaning up invalid war_state_data:', cleanupError.message);
                    }
                    
                    stateData = {};
                }
            }

            return {
                currentState: row.war_current_state || this.STATES.NOT_IN_WAR,
                preparingMessageId: row.war_preparing_message_id,
                activeMessageId: row.war_active_message_id,
                lastStateChange: row.war_last_state_change,
                stateData: stateData || {},
                // Legacy compatibility
                messageId: row.war_preparing_message_id || row.war_active_message_id
            };
        } catch (error) {
            console.error('[WarStateManager] Error getting current war state:', error);
            return null;
        }
    }

    /**
     * Updates the war state in database
     * @param {string} guildId - Guild ID
     * @param {string} clanTag - Clan tag
     * @param {string} newState - New war state
     * @param {Object} warData - Current war data from API
     * @param {string} messageId - Message ID for this state
     */
    async updateWarState(guildId, clanTag, newState, warData = null, messageId = null) {
        try {
            // Validate parameters to prevent undefined values in SQL queries
            if (!guildId || !clanTag || !newState) {
                // console.warn('[WarStateManager] updateWarState called with invalid parameters:', { guildId, clanTag, newState });
                return false;
            }

            const updateData = {
                war_current_state: newState,
                war_last_state_change: this.formatDateForMySQL()
            };

            // Set the appropriate message ID field based on state
            if (messageId) {
                switch (newState) {
                    case this.STATES.PREPARING:
                        updateData.war_preparing_message_id = messageId;
                        break;
                    case this.STATES.ACTIVE:
                        updateData.war_active_message_id = messageId;
                        break;
                    case this.STATES.ENDED:
                        // For ended state, keep existing message IDs but update state
                        break;
                }
            }

            // Update war state data with additional information
            if (warData) {
                const stateDataObj = {
                    startTime: warData.startTime,
                    endTime: warData.endTime,
                    opponent: warData.opponent?.name || null,
                    lastUpdated: new Date().toISOString()
                };
                
                // Ensure we properly stringify the object and validate it
                try {
                    const jsonString = JSON.stringify(stateDataObj);
                    // Validate that it's not the problematic "[object Object]" string
                    if (jsonString && jsonString !== '[object Object]') {
                        updateData.war_state_data = jsonString;
                    } else {
                        console.warn('[WarStateManager] Detected potential object corruption, setting war_state_data to null');
                        updateData.war_state_data = null;
                    }
                } catch (stringifyError) {
                    console.error('[WarStateManager] Error stringifying war state data:', stringifyError.message);
                    updateData.war_state_data = null;
                }
            }

            // Handle message ID transitions when transitioning to active
            if (newState === this.STATES.ACTIVE) {
                // For delete_preparation_and_create_active, we don't reuse the preparing message
                // The active message ID will be set separately when the new message is created
                // Just clear the preparing message ID
                updateData.war_preparing_message_id = null;
            }

            // Clear previous message IDs when new war starts (preparing state)
            if (newState === this.STATES.PREPARING) {
                updateData.war_active_message_id = null;
            }

            // Note: For ended state, we'll clear war_active_message_id after the message is updated
            // This is handled separately in LeaderboardEvents after the message update is complete

            const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
            const values = Object.values(updateData).concat([guildId, clanTag]);

            await this.db.execute(`
                UPDATE guild_clashofclans_watch 
                SET ${setClause}
                WHERE guild_id = ? AND clan_tag = ?
            `, values);
            
            return true;

        } catch (error) {
            console.error('[WarStateManager] Error updating war state:', error);
            return false;
        }
    }

    /**
     * Determines if a state transition should occur and what action to take
     * @param {Object} currentStateData - Current state from database
     * @param {Object} warData - Current war data from API
     * @returns {Object} Transition action to take
     */
    getTransitionAction(currentStateData, warData) {
        const currentState = currentStateData ? currentStateData.currentState : this.STATES.NOT_IN_WAR;
        const newState = this.getWarState(warData);

        // No war data available
        if (newState === this.STATES.NOT_IN_WAR) {
            if (currentState === this.STATES.ACTIVE) {
                // War just ended - transition to ENDED state first
                return {
                    action: 'transition',
                    from: currentState,
                    to: this.STATES.ENDED,
                    messageAction: 'update_to_ended',
                    messageId: currentStateData.activeMessageId
                };
            }
            if (currentState === this.STATES.PREPARING) {
                // War cancelled during preparation
                return {
                    action: 'transition',
                    from: currentState,
                    to: this.STATES.ENDED,
                    messageAction: 'update_to_ended',
                    messageId: currentStateData.preparingMessageId
                };
            }
            // Already in NOT_IN_WAR or ENDED state
            return { action: 'none' };
        }

        // State transitions
        switch (currentState) {
            case this.STATES.NOT_IN_WAR:
                if (newState === this.STATES.PREPARING) {
                    return {
                        action: 'transition',
                        from: currentState,
                        to: newState,
                        messageAction: 'create_preparing',
                        messageId: null
                    };
                }
                if (newState === this.STATES.ACTIVE) {
                    // War started directly to active (missed preparation phase)
                    return {
                        action: 'transition',
                        from: currentState,
                        to: newState,
                        messageAction: 'create_active',
                        messageId: null
                    };
                }
                break;

            case this.STATES.PREPARING:
                if (newState === this.STATES.ACTIVE) {
                    return {
                        action: 'transition',
                        from: currentState,
                        to: newState,
                        messageAction: 'delete_preparation_and_create_active',
                        messageId: currentStateData.preparingMessageId
                    };
                }
                if (newState === this.STATES.NOT_IN_WAR) {
                    // War cancelled during preparation
                    return {
                        action: 'transition',
                        from: currentState,
                        to: this.STATES.ENDED,
                        messageAction: 'update_to_ended',
                        messageId: currentStateData.preparingMessageId
                    };
                }
                break;

            case this.STATES.ACTIVE:
                if (newState === this.STATES.NOT_IN_WAR) {
                    return {
                        action: 'transition',
                        from: currentState,
                        to: this.STATES.ENDED,
                        messageAction: 'delete_and_create_historical',
                        messageId: currentStateData.activeMessageId
                    };
                }
                if (newState === this.STATES.ENDED) {
                    // War ended naturally (inWar → warEnded)
                    return {
                        action: 'transition',
                        from: currentState,
                        to: newState,
                        messageAction: 'delete_and_create_historical',
                        messageId: currentStateData.activeMessageId
                    };
                }
                if (newState === this.STATES.PREPARING) {
                    // War ended and new war started immediately (direct transition)
                    return {
                        action: 'transition',
                        from: currentState,
                        to: newState,
                        messageAction: 'create_preparing',
                        messageId: null
                    };
                }
                break;

            case this.STATES.ENDED:
            case 'warEnd': // Handle legacy 'warEnd' state as alias for 'warEnded'
                if (newState === this.STATES.NOT_IN_WAR) {
                    // War ended and no longer in war - transition to notInWar to stop spam
                    return {
                        action: 'transition',
                        from: currentState,
                        to: newState,
                        messageAction: 'finalize_ended_war',
                        messageId: null
                    };
                }
                if (newState === this.STATES.PREPARING) {
                    // New war starting
                    return {
                        action: 'transition',
                        from: currentState,
                        to: newState,
                        messageAction: 'create_preparing',
                        messageId: null
                    };
                }
                if (newState === this.STATES.ACTIVE) {
                    // War started directly to active (missed preparation phase)
                    return {
                        action: 'transition',
                        from: currentState,
                        to: newState,
                        messageAction: 'create_active',
                        messageId: null
                    };
                }
                break;
        }

        // Same state - check if we need to refresh
        if (currentState === newState && newState !== this.STATES.ENDED && newState !== this.STATES.NOT_IN_WAR) {
            return {
                action: 'refresh',
                state: currentState,
                messageAction: 'update_current',
                messageId: this.getMessageIdForState(currentStateData, currentState)
            };
        }

        // Skip processing when not in war to prevent spam
        if (newState === this.STATES.NOT_IN_WAR) {
            return { action: 'none' };
        }

        return { action: 'none' };
    }

    /**
     * Gets the message ID for a specific state
     * @param {Object} stateData - Current state data
     * @param {string} state - War state
     * @returns {string|null} Message ID for the state
     */
    getMessageIdForState(stateData, state) {
        if (!stateData) return null;
        
        switch (state) {
            case this.STATES.PREPARING:
                return stateData.preparingMessageId;
            case this.STATES.ACTIVE:
                return stateData.activeMessageId;
            case this.STATES.ENDED:
                // For ended state, use the last active message ID to update it
                // Note: after update, war_active_message_id will be cleared but we still need it for the transition
                return stateData.activeMessageId;
            default:
                return null;
        }
    }    /**
     * Gets the canvas type for a war state
     * @param {string} warState - War state
     * @returns {string} Canvas type identifier
     */
    getCanvasType(warState) {
        switch (warState) {
            case this.STATES.PREPARING:
                return 'war_preparing';
            case this.STATES.ACTIVE:
                return 'war_active';
            case this.STATES.ENDED:
                return 'war_ended';
            default:
                return 'war_ended';
        }
    }

    /**
     * Determines if buttons should be enabled for a war state
     * @param {string} warState - War state
     * @returns {boolean} Whether interactive buttons should be enabled
     */
    shouldEnableButtons(warState) {
        return warState !== this.STATES.ENDED;
    }

    /**
     * Gets appropriate update frequency for a war state
     * @param {string} warState - War state
     * @returns {number} Update frequency in milliseconds
     */
    getUpdateFrequency(warState) {
        switch (warState) {
            case this.STATES.PREPARING:
                return 5 * 60 * 1000; // 5 minutes
            case this.STATES.ACTIVE:
                return 5 * 60 * 1000; // 5 minutes
            case this.STATES.ENDED:
                return 60 * 60 * 1000; // 1 hour (minimal updates)
            default:
                return 10 * 60 * 1000; // 10 minutes
        }
    }

    /**
     * Clear the active message ID when war ends (for delete_and_create_historical action)
     * @param {string} guildId - Guild ID
     * @param {string} clanTag - Clan tag
     */
    async clearActiveMessageId(guildId, clanTag) {
        try {
            if (!guildId || !clanTag) {
                return false;
            }

            await this.db.execute(`
                UPDATE guild_clashofclans_watch 
                SET war_active_message_id = NULL
                WHERE guild_id = ? AND clan_tag = ?
            `, [guildId, clanTag]);
            
            return true;

        } catch (error) {
            console.error('[WarStateManager] Error clearing active message ID:', error);
            return false;
        }
    }

    /**
     * Clear the preparing message ID when transitioning to active (for delete_preparation_and_create_active action)
     * @param {string} guildId - Guild ID
     * @param {string} clanTag - Clan tag
     */
    async clearPreparingMessageId(guildId, clanTag) {
        try {
            if (!guildId || !clanTag) {
                return false;
            }

            await this.db.execute(`
                UPDATE guild_clashofclans_watch 
                SET war_preparing_message_id = NULL
                WHERE guild_id = ? AND clan_tag = ?
            `, [guildId, clanTag]);
            
            return true;

        } catch (error) {
            console.error('[WarStateManager] Error clearing preparing message ID:', error);
            return false;
        }
    }

    /**
     * Transition war state from ENDED to NOT_IN_WAR after historical message is created
     * This prevents spam of historical messages
     * @param {string} guildId - Guild ID
     * @param {string} clanTag - Clan tag
     */
    async finalizeEndedWar(guildId, clanTag) {
        try {
            if (!guildId || !clanTag) {
                return false;
            }

            await this.db.execute(`
                UPDATE guild_clashofclans_watch 
                SET war_current_state = ?, war_last_state_change = ?
                WHERE guild_id = ? AND clan_tag = ?
            `, [this.STATES.NOT_IN_WAR, this.formatDateForMySQL(), guildId, clanTag]);
            
            console.log(`[WarStateManager] Finalized ended war for ${clanTag}: ${this.STATES.ENDED} → ${this.STATES.NOT_IN_WAR}`);
            return true;

        } catch (error) {
            console.error('[WarStateManager] Error finalizing ended war:', error);
            return false;
        }
    }

    /**
     * Add required database columns if they don't exist
     */
    async ensureWarStateColumns() {
        try {
            // Add war state tracking columns if they don't exist
            const columns = [
                'war_current_state VARCHAR(20) DEFAULT "notInWar"',
                'war_preparing_message_id VARCHAR(20)',
                'war_active_message_id VARCHAR(20)', 
                'war_last_state_change TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
                'war_state_data JSON',
                'war_last_updated DATETIME',
                'war_start_time DATETIME',
                'war_end_time DATETIME',
                'war_opponent_name VARCHAR(255)'
            ];

            for (const column of columns) {
                const columnName = column.split(' ')[0];
                try {
                    await this.db.execute(`
                        ALTER TABLE guild_clashofclans_watch 
                        ADD COLUMN ${column}
                    `);
                    // console.log(`[WarStateManager] Added column: ${columnName}`);
                } catch (error) {
                    // Column likely already exists
                    if (!error.message.includes('Duplicate column name')) {
                        // console.warn(`[WarStateManager] Error adding column ${columnName}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.error('[WarStateManager] Error ensuring war state columns:', error);
        }
    }
}

module.exports = WarStateManager;