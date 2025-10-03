const { Events } = require('discord.js');
const LeaderboardInteractionHandler = require('../handlers/LeaderboardInteractionHandler');
const WarStateManager = require('../../utils/war/WarStateManager');

/**
 * Bot event handler for leaderboard button interactions
 * Integrates with the main Discord bot to handle button clicks
 */
class LeaderboardEvents {
    constructor(client, database) {
        this.client = client;
        this.interactionHandler = new LeaderboardInteractionHandler(database);
        this.warStateManager = new WarStateManager(database);
        // Remove the automatic event listener setup
        console.log('🎮 Leaderboard Events initialized (manual handler mode)');
    }

    /**
     * Manual method to post or update a leaderboard message with war state management
     * Called by scheduled jobs or admin commands
     * @param {string} guildId - Guild ID
     * @param {string} channelId - Channel ID to post in
     * @param {string|null} messageId - Existing message ID to update (null for new)
     * @param {string} type - Leaderboard type ('donations' or 'war')
     * @param {string|null} clanTag - Specific clan tag (for war leaderboards only)
     * @param {boolean} skipTransitions - Whether to skip transition handling (false for dashboard, true for watcher)
     * @returns {Object} Posted message information
     */
    async postLeaderboard(guildId, channelId, messageId = null, type = 'donations', clanTag = null, skipTransitions = false) {
        try {
            // For war leaderboards, use the new state-aware method
            if (type === 'war') {
                // If no clanTag provided, get the first clan from database
                let effectiveClanTag = clanTag;
                if (!effectiveClanTag) {
                    try {
                        const [clanRows] = await this.interactionHandler.db.execute(
                            'SELECT clan_tag FROM guild_clashofclans_watch WHERE guild_id = ? AND war_leaderboard_channel_id IS NOT NULL LIMIT 1',
                            [guildId]
                        );
                        if (clanRows.length > 0) {
                            effectiveClanTag = clanRows[0].clan_tag;
                        }
                    } catch (clanErr) {
                        console.warn(`[LeaderboardEvents] Could not determine clan tag for war leaderboard:`, clanErr.message);
                    }
                }
                
                if (effectiveClanTag) {
                    return await this.postWarLeaderboardWithStateManagement(guildId, channelId, effectiveClanTag, skipTransitions);
                } else {
                    throw new Error('No clan tag available for war leaderboard');
                }
            }

            // Original logic for donation leaderboards only
            return await this.postOriginalLeaderboard(guildId, channelId, messageId, type, clanTag);

        } catch (error) {
            console.error(`Failed to post ${type} leaderboard for guild ${guildId}:`, error);
            return { success: false, error: error.message, guildId, channelId, type };
        }
    }

    /**
     * Post war leaderboard with state management support
     * @param {string} guildId - Guild ID
     * @param {string} channelId - Channel ID to post in
     * @param {string} clanTag - Specific clan tag
     * @param {boolean} skipTransitions - Whether to skip transition handling (false for dashboard, true for watcher)
     * @returns {Object} Posted message information
     */
    async postWarLeaderboardWithStateManagement(guildId, channelId, clanTag, skipTransitions = false) {
        try {
            // console.log(`[LeaderboardEvents] postWarLeaderboardWithStateManagement called for ${clanTag}, skipTransitions: ${skipTransitions}`);
            
            // Validate parameters
            if (!guildId || !channelId || !clanTag) {
                throw new Error(`Invalid parameters for war leaderboard: guildId=${guildId}, channelId=${channelId}, clanTag=${clanTag}`);
            }

            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                throw new Error(`Channel ${channelId} not found`);
            }

            // Get leaderboard configuration
            const config = await this.interactionHandler.getLeaderboardConfig(guildId);
            if (!config || !config.trackWarLeaderboard) {
                throw new Error('War leaderboard not enabled for this guild');
            }

            // Get current war state
            const currentStateData = await this.warStateManager.getCurrentWarState(guildId, clanTag);
            // console.log(`[LeaderboardEvents] Current state data for ${clanTag}:`, JSON.stringify(currentStateData, null, 2));
            
            // Get current war data
            const clanData = await this.interactionHandler.getIndividualWarData(config, clanTag, true);
            // console.log(`[LeaderboardEvents] Clan war state for ${clanTag}: ${clanData.warState}`);
            
            // Check for transitions but DO NOT handle them - let main watcher handle transitions
            const transitionAction = this.warStateManager.getTransitionAction(currentStateData, clanData.currentWar);
            // console.log(`[LeaderboardEvents] Transition action for ${clanTag}:`, JSON.stringify(transitionAction, null, 2));

            // If there's a state transition and we should skip them, let main watcher handle it
            if (transitionAction.action === 'transition' && skipTransitions) {
                // console.log(`[LeaderboardEvents] Skipping transition handling for ${clanTag} - main watcher will handle`);
                return { success: true, guildId, channelId, type: 'war', action: 'skipped_transition' };
            }

            let targetMessageId = null;
            let shouldCreateNew = false;
            let shouldUpdate = false;

            // Handle transitions or refreshes based on the action
            // console.log(`[LeaderboardEvents] Processing action '${transitionAction.action}' for ${clanTag}`);
            switch (transitionAction.action) {
                case 'transition':
                    if (!skipTransitions) {
                        // Dashboard call - handle the transition
                        // console.log(`[LeaderboardEvents] Handling transition for ${clanTag}: ${transitionAction.from} → ${transitionAction.to}`);
                        
                        // Update the war state in database first
                        const updateSuccess = await this.warStateManager.updateWarState(
                            guildId, 
                            clanTag, 
                            transitionAction.to, 
                            clanData.currentWar,
                            transitionAction.messageId
                        );
                        
                        if (!updateSuccess) {
                            throw new Error('Failed to update war state in database');
                        }
                        
                        // Handle message actions based on the specific transition
                        switch (transitionAction.messageAction) {
                            case 'create_preparing':
                            case 'create_active':
                                // Create new message for new wars or missed preparation phase
                                shouldCreateNew = true;
                                targetMessageId = null;
                                break;
                            case 'update_to_active':
                            case 'update_to_ended':
                            case 'update_current':
                                // Update existing message for state transitions
                                targetMessageId = transitionAction.messageId;
                                shouldUpdate = !!targetMessageId;
                                shouldCreateNew = !targetMessageId; // Fallback to create if no message ID
                                break;
                            case 'delete_and_create_historical':
                                // Delete active war message and create new historical message
                                if (transitionAction.messageId) {
                                    try {
                                        // Delete the active war message
                                        const messageToDelete = await channel.messages.fetch(transitionAction.messageId);
                                        if (messageToDelete) {
                                            await messageToDelete.delete();
                                            console.log(`[LeaderboardEvents] Deleted active war message ${transitionAction.messageId} for ${clanTag}`);
                                        }
                                    } catch (deleteError) {
                                        console.warn(`[LeaderboardEvents] Could not delete active war message ${transitionAction.messageId}:`, deleteError.message);
                                    }
                                    
                                    // Clear the active message ID from database
                                    await this.warStateManager.clearActiveMessageId(guildId, clanTag);
                                }
                                // Create new historical message
                                shouldCreateNew = true;
                                targetMessageId = null;
                                break;
                            case 'delete_preparation_and_create_active':
                                // Delete preparation war message and create new active message
                                if (transitionAction.messageId) {
                                    try {
                                        // Delete the preparation war message
                                        const messageToDelete = await channel.messages.fetch(transitionAction.messageId);
                                        if (messageToDelete) {
                                            await messageToDelete.delete();
                                            console.log(`[LeaderboardEvents] Deleted preparation war message ${transitionAction.messageId} for ${clanTag}`);
                                        }
                                    } catch (deleteError) {
                                        console.warn(`[LeaderboardEvents] Could not delete preparation war message ${transitionAction.messageId}:`, deleteError.message);
                                    }
                                    
                                    // Clear the preparing message ID from database
                                    await this.warStateManager.clearPreparingMessageId(guildId, clanTag);
                                }
                                // Create new active war message
                                shouldCreateNew = true;
                                targetMessageId = null;
                                break;
                            case 'finalize_ended_war':
                                // No message action needed - just finalize the war state transition
                                console.log(`[LeaderboardEvents] Finalizing ended war for ${clanTag} (warEnded -> notInWar)`);
                                await this.warStateManager.finalizeEndedWar(guildId, clanTag);
                                return { success: true, guildId, channelId, type: 'war', action: 'finalized_ended_war' };
                            case 'none':
                                // No message action needed - just transition state
                                console.log(`[LeaderboardEvents] No message action needed for ${clanTag} (action: ${transitionAction.messageAction})`);
                                return { success: true, guildId, channelId, type: 'war', action: 'no_message_action' };
                            default:
                                // Default behavior - create new message
                                shouldCreateNew = true;
                                targetMessageId = null;
                        }
                    } else {
                        // Watcher call - skip and let main watcher handle
                        return { success: true, guildId, channelId, type: 'war', action: 'skipped_transition' };
                    }
                    break;
                    
                case 'refresh':
                    // Same state, just refresh the message
                    targetMessageId = transitionAction.messageId;
                    shouldUpdate = !!targetMessageId;
                    shouldCreateNew = !targetMessageId;
                    break;

                case 'none':
                default:
                    // Check DATABASE state, not API state, to prevent spam after war finalization
                    const dbWarState = currentStateData ? currentStateData.currentState : null;
                    
                    // If database state is notInWar, don't create any messages
                    if (dbWarState === 'notInWar') {
                        console.log(`[LeaderboardEvents] War already finalized in database (${dbWarState}), skipping message creation for ${clanTag}`);
                        return { success: true, guildId, channelId, type: 'war', action: 'skipped_finalized_war' };
                    }
                    
                    // Even if no transition is needed, we might still want to post/update the leaderboard
                    if (dbWarState === 'warEnded') {
                        // For warEnded state, do not create or update any messages
                        // Historical messages are only created during inWar->warEnded transition
                        console.log(`[LeaderboardEvents] War in warEnded state, no message action needed for ${clanTag}`);
                        return { success: true, guildId, channelId, type: 'war', action: 'warEnded_no_action' };
                    } else if (dbWarState === 'inWar' || clanData.warState === 'inWar') {
                        // For active wars, check if we have an active message
                        targetMessageId = currentStateData?.activeMessageId;
                        shouldCreateNew = !targetMessageId; // Create new if no existing message
                        shouldUpdate = !!targetMessageId; // Update existing if available
                        
                        if (!targetMessageId) {
                            console.log(`[LeaderboardEvents] No active message found for inWar state, creating new message for ${clanTag}`);
                        }
                        break;
                    } else if (dbWarState === 'preparation' || clanData.warState === 'preparation') {
                        // For preparation wars, check if we have a preparing message
                        targetMessageId = currentStateData?.preparingMessageId;
                        shouldCreateNew = !targetMessageId; // Create new if no existing message
                        shouldUpdate = !!targetMessageId; // Update existing if available
                        
                        if (!targetMessageId) {
                            console.log(`[LeaderboardEvents] No preparing message found for preparation state, creating new message for ${clanTag}`);
                        }
                        break;
                    }
                    // For other states with no action, just return
                    console.log(`[LeaderboardEvents] No action needed for war state ${dbWarState} (API: ${clanData.warState}) for ${clanTag}`);
                    return { success: true, guildId, channelId, type: 'war', action: 'none' };
            }

            let createdMessageId = null;

            // Create mock interaction for leaderboard generation
            const mockInteraction = {
                guildId,
                guild: channel.guild,
                member: null,
                deferred: true,
                replied: false,
                customId: `war_state_${clanData.warState}_update`,
                editReply: async (options) => {
                    // console.log(`[LeaderboardEvents] Mock editReply called for ${clanTag}, shouldCreateNew: ${shouldCreateNew}, shouldUpdate: ${shouldUpdate}, targetMessageId: ${targetMessageId}`);
                    let resultMessage = null;

                    if (shouldCreateNew) {
                        // Create new message

                        
                    } else if (shouldUpdate && targetMessageId) {
                        try {
                            // Update existing message
                            const existingMessage = await channel.messages.fetch(targetMessageId);
                            resultMessage = await existingMessage.edit(options);
                            // console.log(`[LeaderboardEvents] Updated war message for ${clanTag} (state: ${clanData.warState}) - Message ID: ${targetMessageId}`);
                            
                        } catch (error) {
                            if (error.code === 10008 || error.message.includes('Unknown Message')) {
                                // Message was deleted, create new one
                                resultMessage = await channel.send(options);
                                createdMessageId = resultMessage.id;
                                console.log(`[LeaderboardEvents] Recreated war message for ${clanTag} (original deleted) - Message ID: ${createdMessageId}`);
                            } else {
                                throw error;
                            }
                        }
                    }

                    return resultMessage;
                },
                followUp: async (options) => {
                    return await channel.send(options);
                }
            };

            // Generate the leaderboard
            if (shouldCreateNew || shouldUpdate) {
                // console.log(`[LeaderboardEvents] About to call generateLeaderboardPage for ${clanTag}, state: ${clanData.warState}, shouldCreateNew: ${shouldCreateNew}, shouldUpdate: ${shouldUpdate}`);
                try {
                    await this.interactionHandler.generateLeaderboardPage(mockInteraction, config, 1, true, 'war', clanTag);
                    // console.log(`[LeaderboardEvents] Successfully called generateLeaderboardPage for ${clanTag}`);
                    
                    // After successful message update for ended wars, clear the war_active_message_id
                    if (clanData.warState === 'warEnded' && shouldUpdate && targetMessageId) {
                        await this.warStateManager.db.execute(
                            `UPDATE guild_clashofclans_watch SET war_active_message_id = NULL WHERE guild_id = ? AND clan_tag = ?`,
                            [guildId, clanTag]
                        );
                        // console.log(`[LeaderboardEvents] Cleared war_active_message_id for ended war (clan ${clanTag})`);
                    }
                } catch (generateError) {
                    console.error(`[LeaderboardEvents] Error in generateLeaderboardPage for ${clanTag}:`, {
                        error: generateError.message,
                        code: generateError.code,
                        status: generateError.status,
                        method: generateError.method,
                        url: generateError.url,
                        requestData: generateError.requestData,
                        stack: generateError.stack
                    });
                    throw generateError;
                }
            }

            // Update database with message ID if a new message was created OR if a message was recreated after deletion
            if (createdMessageId) {
                let messageField = null;
                
                // Determine the correct message field based on war state
                switch (clanData.warState) {
                    case 'preparation':
                        messageField = 'war_preparing_message_id';
                        break;
                    case 'inWar':
                        messageField = 'war_active_message_id';
                        break;
                    default:
                        // For ended wars, we don't store a separate message ID
                        // The message is ephemeral and shows historical results
                        messageField = null;
                        break;
                }
                
                // Update the database - for both new messages and recreated messages after deletion
                if (messageField) {
                    await this.warStateManager.db.execute(
                        `UPDATE guild_clashofclans_watch SET ${messageField} = ? WHERE guild_id = ? AND clan_tag = ?`,
                        [createdMessageId, guildId, clanTag]
                    );
                    const actionType = shouldCreateNew ? 'new' : 'recreated (after deletion)';
                    console.log(`[LeaderboardEvents] Updated ${messageField} to ${createdMessageId} for ${actionType} war leaderboard (clan ${clanTag})`);
                }
                
                // If this was a historical message creation (warEnded state), finalize the war
                // This applies to both new messages and recreated messages
                if (clanData.warState === 'warEnded' && createdMessageId) {
                    // Handle delete_and_create_historical action only (finalize_ended_war no longer creates messages)
                    if (transitionAction.action === 'transition' && transitionAction.messageAction === 'delete_and_create_historical') {
                        console.log(`[LeaderboardEvents] Historical message created for ${clanTag}, finalizing ended war (action: ${transitionAction.messageAction})`);
                        
                        // Update war_ended_message_id with the historical message ID
                        try {
                            await this.interactionHandler.db.execute(`
                                UPDATE guild_clashofclans_watch 
                                SET war_ended_message_id = ?
                                WHERE guild_id = ? AND clan_tag = ?
                            `, [createdMessageId, guildId, clanTag]);
                            console.log(`[LeaderboardEvents] Updated war_ended_message_id to ${createdMessageId} for ${clanTag}`);
                        } catch (updateError) {
                            console.error(`[LeaderboardEvents] Failed to update war_ended_message_id for ${clanTag}:`, updateError.message);
                        }
                        
                        // Finalize the war (transition to notInWar)
                        await this.warStateManager.finalizeEndedWar(guildId, clanTag);
                    }
                }
            }

            return { 
                success: true, 
                guildId, 
                channelId, 
                type: 'war', 
                clanTag,
                action: transitionAction.action,
                warState: clanData.warState,
                messageId: createdMessageId || targetMessageId // Return the relevant message ID
            };

        } catch (error) {
            console.error(`Failed to post war leaderboard with state management for clan ${clanTag}:`, {
                error: error.message,
                code: error.code,
                status: error.status,
                method: error.method,
                url: error.url,
                requestData: error.requestData
            });
            return { 
                success: false, 
                error: error.message, 
                guildId, 
                channelId, 
                type: 'war', 
                clanTag 
            };
        }
    }

    /**
     * Create a new war leaderboard message after the main watcher has updated the state
     * This is called by the main watcher after it handles state transitions
     * @param {string} guildId - Guild ID
     * @param {string} channelId - Channel ID to post in
     * @param {string} clanTag - Specific clan tag
     * @returns {Object} Posted message information
     */
    async createWarLeaderboardAfterStateUpdate(guildId, channelId, clanTag) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                throw new Error(`Channel ${channelId} not found`);
            }

            // Get leaderboard configuration
            const config = await this.interactionHandler.getLeaderboardConfig(guildId);
            if (!config || !config.trackWarLeaderboard) {
                throw new Error('War leaderboard not enabled for this guild');
            }

            // Get current war data (state should already be updated by main watcher)
            const clanData = await this.interactionHandler.getIndividualWarData(config, clanTag, true);

            let createdMessageId = null;

            // Create mock interaction for leaderboard generation
            const mockInteraction = {
                guildId,
                guild: channel.guild,
                member: null,
                deferred: true,
                replied: false,
                customId: `war_leaderboard_post_${clanData.warState}`,
                editReply: async (options) => {
                    // Always create new message since this is called after state transitions
                    const resultMessage = await channel.send(options);
                    createdMessageId = resultMessage.id; // Capture the message ID
                    // console.log(`[LeaderboardEvents] Created war leaderboard for ${clanTag} (state: ${clanData.warState}) after main watcher state update - Message ID: ${createdMessageId}`);
                    return resultMessage;
                },
                followUp: async (options) => {
                    return await channel.send(options);
                }
            };

            // Generate leaderboard using the interaction handler
            await this.interactionHandler.generateLeaderboardPage(mockInteraction, config, 1, true, 'war', clanTag);
            
            // Update the database with the correct message ID field based on war state
            if (createdMessageId) {
                let messageField = null;
                
                // Determine the correct message field based on war state
                switch (clanData.warState) {
                    case 'preparation':
                        messageField = 'war_preparing_message_id';
                        break;
                    case 'inWar':
                        messageField = 'war_active_message_id';
                        break;
                    case 'warEnded':
                    default:
                        // For ended wars, don't store message ID as it's ephemeral
                        messageField = null;
                        break;
                }
                
                // Update the database
                if (clanData.warState === 'warEnded') {
                    // For ended wars, just clear the active message ID so new wars create fresh messages
                    // We don't store the ended war message ID as it's ephemeral
                    await this.warStateManager.db.execute(
                        `UPDATE guild_clashofclans_watch SET war_active_message_id = NULL WHERE guild_id = ? AND clan_tag = ?`,
                        [guildId, clanTag]
                    );
                    console.log(`[LeaderboardEvents] Cleared war_active_message_id for historical war leaderboard (clan ${clanTag})`);
                } else if (messageField) {
                    await this.warStateManager.db.execute(
                        `UPDATE guild_clashofclans_watch SET ${messageField} = ? WHERE guild_id = ? AND clan_tag = ?`,
                        [createdMessageId, guildId, clanTag]
                    );
                    // console.log(`[LeaderboardEvents] Updated ${messageField} to ${createdMessageId} for clan ${clanTag}`);
                }
            }
            
            return {
                success: true,
                guildId,
                channelId,
                type: 'war',
                clanTag,
                warState: clanData.warState,
                messageId: createdMessageId
            };

        } catch (error) {
            console.error(`Failed to create war leaderboard after state update for ${clanTag}:`, error);
            return { success: false, error: error.message, guildId, channelId, clanTag };
        }
    }

    /**
     * Original leaderboard posting method (for donations and legacy support)
     * @param {string} guildId - Guild ID
     * @param {string} channelId - Channel ID to post in
     * @param {string|null} messageId - Existing message ID to update (null for new)
     * @param {string} type - Leaderboard type ('donations' or 'war')
     * @param {string|null} clanTag - Specific clan tag
     * @returns {Object} Posted message information
     */
    async postOriginalLeaderboard(guildId, channelId, messageId = null, type = 'donations', clanTag = null) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                throw new Error(`Channel ${channelId} not found`);
            }

            // Get leaderboard configuration
            const config = await this.interactionHandler.getLeaderboardConfig(guildId);
            const isEnabled = type === 'war' ? config.trackWarLeaderboard : config.trackDonationLeaderboard;
            if (!config || !isEnabled) {
                throw new Error(`${type} leaderboard not enabled for this guild`);
            }

            // Create a mock interaction for posting
            const mockInteraction = {
                guildId,
                guild: channel.guild,
                member: null, // No specific member for scheduled posts
                deferred: true, // Mark as deferred to pass validation
                replied: false, // Not replied yet
                customId: 'scheduled_leaderboard_post', // Add customId for logging
                editReply: async (options) => {
                    if (messageId) {
                        try {
                            // Try to update existing message
                            const existingMessage = await channel.messages.fetch(messageId);
                            return await existingMessage.edit(options);
                        } catch (error) {
                            // If message not found (deleted), create new one and update DB
                            if (error.code === 10008 || error.message.includes('Unknown Message')) {
                                const newMessage = await channel.send(options);
                                
                                // Update database with new message ID - use clan_tag to identify specific row for multi-clan setups
                                // For war leaderboards, we need to check war state to determine the correct field
                                let messageIdField;
                                if (type === 'war') {
                                    // War leaderboards use state-specific fields, but for generic lookups we check both
                                    messageIdField = 'war_preparing_message_id'; // Default to preparing as fallback
                                } else {
                                    messageIdField = 'donation_message_id';
                                }
                                
                                if (type === 'war' && clanTag) {
                                    // Update specific clan row when clan tag is provided
                                    await this.interactionHandler.db.execute(
                                        `UPDATE guild_clashofclans_watch SET ${messageIdField} = ? WHERE guild_id = ? AND clan_tag = ?`,
                                        [newMessage.id, guildId, clanTag]
                                    );
                                } else if (type === 'war') {
                                    // Fallback: Update first clan row if no clan tag provided
                                    const [configRows] = await this.interactionHandler.db.execute(
                                        'SELECT clan_tag FROM guild_clashofclans_watch WHERE guild_id = ? AND war_leaderboard_channel_id IS NOT NULL LIMIT 1',
                                        [guildId]
                                    );
                                    if (configRows.length > 0) {
                                        await this.interactionHandler.db.execute(
                                            `UPDATE guild_clashofclans_watch SET ${messageIdField} = ? WHERE guild_id = ? AND clan_tag = ?`,
                                            [newMessage.id, guildId, configRows[0].clan_tag]
                                        );
                                    }
                                } else {
                                    // For donations, update specific clan row if clan tag provided, otherwise update first clan row
                                    if (clanTag) {
                                        await this.interactionHandler.db.execute(
                                            `UPDATE guild_clashofclans_watch SET ${messageIdField} = ? WHERE guild_id = ? AND clan_tag = ?`,
                                            [newMessage.id, guildId, clanTag]
                                        );
                                    } else {
                                        // Fallback: Update first clan row if no clan tag provided
                                        const [configRows] = await this.interactionHandler.db.execute(
                                            'SELECT clan_tag FROM guild_clashofclans_watch WHERE guild_id = ? AND donation_leaderboard_channel_id IS NOT NULL LIMIT 1',
                                            [guildId]
                                        );
                                        if (configRows.length > 0) {
                                            await this.interactionHandler.db.execute(
                                                `UPDATE guild_clashofclans_watch SET ${messageIdField} = ? WHERE guild_id = ? AND clan_tag = ?`,
                                                [newMessage.id, guildId, configRows[0].clan_tag]
                                            );
                                        }
                                    }
                                }
                                
                                return newMessage;
                            }
                            throw error; // Re-throw other errors
                        }
                    } else {
                        // Post new message
                        const newMessage = await channel.send(options);
                        
                        // Update database with new message ID - handle multi-clan setups properly
                        // For war leaderboards, we use state-specific fields
                        let messageIdField;
                        if (type === 'war') {
                            messageIdField = 'war_preparing_message_id'; // Default to preparing as fallback
                        } else {
                            messageIdField = 'donation_message_id';
                        }
                        
                        if (type === 'war' && clanTag) {
                            // Update specific clan row when clan tag is provided
                            await this.interactionHandler.db.execute(
                                `UPDATE guild_clashofclans_watch SET ${messageIdField} = ? WHERE guild_id = ? AND clan_tag = ?`,
                                [newMessage.id, guildId, clanTag]
                            );
                        } else if (type === 'war') {
                            // Fallback: Update first clan row if no clan tag provided
                            const [configRows] = await this.interactionHandler.db.execute(
                                'SELECT clan_tag FROM guild_clashofclans_watch WHERE guild_id = ? AND war_leaderboard_channel_id IS NOT NULL LIMIT 1',
                                [guildId]
                            );
                            if (configRows.length > 0) {
                                await this.interactionHandler.db.execute(
                                    `UPDATE guild_clashofclans_watch SET ${messageIdField} = ? WHERE guild_id = ? AND clan_tag = ?`,
                                    [newMessage.id, guildId, configRows[0].clan_tag]
                                );
                            }
                        } else {
                            // For donations, update specific clan row if clan tag provided, otherwise update first clan row
                            if (clanTag) {
                                await this.interactionHandler.db.execute(
                                    `UPDATE guild_clashofclans_watch SET ${messageIdField} = ? WHERE guild_id = ? AND clan_tag = ?`,
                                    [newMessage.id, guildId, clanTag]
                                );
                            } else {
                                // Fallback: Update first clan row if no clan tag provided
                                const [configRows] = await this.interactionHandler.db.execute(
                                    'SELECT clan_tag FROM guild_clashofclans_watch WHERE guild_id = ? AND donation_leaderboard_channel_id IS NOT NULL LIMIT 1',
                                    [guildId]
                                );
                                if (configRows.length > 0) {
                                    await this.interactionHandler.db.execute(
                                        `UPDATE guild_clashofclans_watch SET ${messageIdField} = ? WHERE guild_id = ? AND clan_tag = ?`,
                                        [newMessage.id, guildId, configRows[0].clan_tag]
                                    );
                                }
                            }
                        }
                        
                        return newMessage;
                    }
                },
                followUp: async (options) => {
                    return await channel.send(options);
                }
            };

            // Generate page 1 of the leaderboard
            await this.interactionHandler.generateLeaderboardPage(mockInteraction, config, 1, true, type, clanTag);

            return { success: true, guildId, channelId, type };

        } catch (error) {
            console.error(`Failed to post ${type} leaderboard for guild ${guildId}:`, error);
            return { success: false, error: error.message, guildId, channelId, type };
        }
    }

    /**
     * Scheduled job handler - updates all active leaderboards
     * Call this method from your scheduler (cron jobs, etc.)
     * @param {string} scheduleType - Type of schedule (hourly, daily, weekly, monthly)
     * @param {string} type - Leaderboard type ('donations' only - war uses continuous 5min updates)
     */
    async runScheduledUpdate(scheduleType, type = 'donations') {
        try {
            // War leaderboards use continuous 5-minute updates via the watcher, not scheduled updates
            if (type === 'war') {
                console.log('⚠️ War leaderboards use continuous 5-minute updates, not scheduled updates');
                return { updated: 0, errors: 0, type, note: 'War leaderboards use continuous updates' };
            }

            console.log(`🕐 Starting scheduled ${type} leaderboard update: ${scheduleType}`);

            // Only for donation leaderboards - war leaderboards handled by watcher
            const trackField = 'track_donation_leaderboard';
            const channelField = 'donation_leaderboard_channel_id';
            const messageField = 'donation_message_id';
            const scheduleField = 'donation_leaderboard_schedule';

            const [clans] = await this.interactionHandler.db.execute(`
                SELECT guild_id, 
                       clan_tag,
                       ${channelField} as channel_id, 
                       ${messageField} as message_id 
                FROM guild_clashofclans_watch 
                WHERE ${trackField} = 1 
                AND ${scheduleField} = ?
                AND ${channelField} IS NOT NULL
            `, [scheduleType]);

            if (clans.length === 0) {
                return { updated: 0, errors: 0, type };
            }

            let updated = 0;
            let errors = 0;

            // Process each clan
            for (const clan of clans) {
                try {
                    await this.postLeaderboard(
                        clan.guild_id,
                        clan.channel_id,
                        clan.message_id,
                        type,
                        clan.clan_tag  // Pass clan_tag for per-clan leaderboards
                    );
                    updated++;
                    
                    // Add small delay to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`Failed to update ${type} leaderboard for clan ${clan.clan_tag} in guild ${clan.guild_id}:`, error);
                    errors++;
                }
            }

            return { updated, errors, scheduleType, type };

        } catch (error) {
            console.error(`Error in scheduled ${type} leaderboard update:`, error);
            return { updated: 0, errors: 1, error: error.message, type };
        }
    }

    /**
     * Admin command to manually trigger leaderboard update
     * @param {CommandInteraction} interaction - Discord slash command interaction
     * @param {string} type - Leaderboard type ('donations' or 'war')
     */
    async handleAdminCommand(interaction, type = 'donations') {
        try {
            if (!interaction.member.permissions.has('ManageGuild')) {
                return await interaction.reply({
                    content: '❌ You need Manage Server permissions to use this command.',
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            const result = await this.postLeaderboard(
                interaction.guildId,
                interaction.channelId,
                null,
                type
            );

            if (result.success) {
                await interaction.editReply(`✅ ${type} leaderboard updated successfully!`);
            } else {
                await interaction.editReply(`❌ Failed to update ${type} leaderboard: ${result.error}`);
            }

        } catch (error) {
            console.error(`Error in admin ${type} leaderboard command:`, error);
            await interaction.editReply(`❌ An error occurred while updating the ${type} leaderboard.`);
        }
    }
}

module.exports = LeaderboardEvents;