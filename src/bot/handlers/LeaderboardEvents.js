const { Events } = require('discord.js');
const LeaderboardInteractionHandler = require('../handlers/LeaderboardInteractionHandler');

/**
 * Bot event handler for leaderboard button interactions
 * Integrates with the main Discord bot to handle button clicks
 */
class LeaderboardEvents {
    constructor(client, database) {
        this.client = client;
        this.interactionHandler = new LeaderboardInteractionHandler(database);
        this.setupEventListeners();
    }

    /**
     * Sets up Discord.js event listeners for leaderboard interactions
     */
    setupEventListeners() {
        // Handle button interactions
        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isButton()) return;

            // Check if this is a leaderboard button
            if (interaction.customId.startsWith('leaderboard_')) {
                await this.interactionHandler.handleButtonInteraction(interaction);
            }
        });

        console.log('🎮 Leaderboard button interactions registered');
    }

    /**
     * Manual method to post or update a leaderboard message
     * Called by scheduled jobs or admin commands
     * @param {string} guildId - Guild ID
     * @param {string} channelId - Channel ID to post in
     * @param {string|null} messageId - Existing message ID to update (null for new)
     * @param {string} type - Leaderboard type ('donations' or 'war')
     * @param {string|null} clanTag - Specific clan tag (for war leaderboards only)
     * @returns {Object} Posted message information
     */
    async postLeaderboard(guildId, channelId, messageId = null, type = 'donations', clanTag = null) {
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
                                console.log(`[COC] Message ${messageId} not found, creating new ${type} leaderboard message`);
                                const newMessage = await channel.send(options);
                                
                                // Update database with new message ID - use clan_tag to identify specific row for multi-clan setups
                                const messageIdField = type === 'war' ? 'war_leaderboard_message_id' : 'donation_message_id';
                                
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
                                    // For donations, update all clan rows since they share the leaderboard
                                    await this.interactionHandler.db.execute(
                                        `UPDATE guild_clashofclans_watch SET ${messageIdField} = ? WHERE guild_id = ?`,
                                        [newMessage.id, guildId]
                                    );
                                }
                                
                                return newMessage;
                            }
                            throw error; // Re-throw other errors
                        }
                    } else {
                        // Post new message
                        const newMessage = await channel.send(options);
                        
                        // Update database with new message ID - handle multi-clan setups properly
                        const messageIdField = type === 'war' ? 'war_leaderboard_message_id' : 'donation_message_id';
                        
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
                            // For donations, all clan rows share the same leaderboard message
                            await this.interactionHandler.db.execute(
                                `UPDATE guild_clashofclans_watch SET ${messageIdField} = ? WHERE guild_id = ?`,
                                [newMessage.id, guildId]
                            );
                        }
                        
                        return newMessage;
                    }
                },
                followUp: async (options) => {
                    return await channel.send(options);
                }
            };

            // Generate page 1 of the leaderboard
            await this.interactionHandler.generateLeaderboardPage(mockInteraction, config, 1, true, type);

            console.log(`📊 ${type} leaderboard posted/updated for guild ${guildId}`);
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

            const [guilds] = await this.interactionHandler.db.execute(`
                SELECT guild_id, 
                       ${channelField} as channel_id, 
                       ${messageField} as message_id 
                FROM guild_clashofclans_watch 
                WHERE ${trackField} = 1 
                AND ${scheduleField} = ?
                AND ${channelField} IS NOT NULL
            `, [scheduleType]);

            if (guilds.length === 0) {
                console.log(`No guilds found for ${scheduleType} ${type} schedule`);
                return { updated: 0, errors: 0, type };
            }

            let updated = 0;
            let errors = 0;

            // Process each guild
            for (const guild of guilds) {
                try {
                    await this.postLeaderboard(
                        guild.guild_id,
                        guild.channel_id,
                        guild.message_id,
                        type
                    );
                    updated++;
                    
                    // Add small delay to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`Failed to update ${type} leaderboard for guild ${guild.guild_id}:`, error);
                    errors++;
                }
            }

            console.log(`✅ Scheduled ${type} update complete: ${updated} updated, ${errors} errors`);
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