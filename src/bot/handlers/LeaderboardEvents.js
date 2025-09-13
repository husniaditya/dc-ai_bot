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
     * @returns {Object} Posted message information
     */
    async postLeaderboard(guildId, channelId, messageId = null) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                throw new Error(`Channel ${channelId} not found`);
            }

            // Get leaderboard configuration
            const config = await this.interactionHandler.getLeaderboardConfig(guildId);
            if (!config || !config.track_donation_leaderboard) {
                throw new Error('Leaderboard not enabled for this guild');
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
                                console.log(`[COC] Message ${messageId} not found, creating new leaderboard message`);
                                const newMessage = await channel.send(options);
                                
                                // Update database with new message ID
                                await this.interactionHandler.db.execute(
                                    'UPDATE guild_clashofclans_watch SET donation_message_id = ? WHERE guild_id = ?',
                                    [newMessage.id, guildId]
                                );
                                
                                return newMessage;
                            }
                            throw error; // Re-throw other errors
                        }
                    } else {
                        // Post new message
                        const newMessage = await channel.send(options);
                        
                        // Update database with new message ID
                        await this.interactionHandler.db.execute(
                            'UPDATE guild_clashofclans_watch SET donation_message_id = ? WHERE guild_id = ?',
                            [newMessage.id, guildId]
                        );
                        
                        return newMessage;
                    }
                },
                followUp: async (options) => {
                    return await channel.send(options);
                }
            };

            // Generate page 1 of the leaderboard
            await this.interactionHandler.generateLeaderboardPage(mockInteraction, config, 1, true);

            console.log(`📊 Leaderboard posted/updated for guild ${guildId}`);
            return { success: true, guildId, channelId };

        } catch (error) {
            console.error(`Failed to post leaderboard for guild ${guildId}:`, error);
            return { success: false, error: error.message, guildId, channelId };
        }
    }

    /**
     * Scheduled job handler - updates all active leaderboards
     * Call this method from your scheduler (cron jobs, etc.)
     * @param {string} scheduleType - Type of schedule (hourly, daily, weekly, monthly)
     */
    async runScheduledUpdate(scheduleType) {
        try {
            console.log(`🕐 Starting scheduled leaderboard update: ${scheduleType}`);

            // Get all guilds with matching schedule
            const [guilds] = await this.interactionHandler.db.execute(`
                SELECT guild_id, donation_leaderboard_channel_id, donation_message_id 
                FROM guild_clashofclans_watch 
                WHERE track_donation_leaderboard = 1 
                AND donation_leaderboard_schedule = ?
                AND donation_leaderboard_channel_id IS NOT NULL
            `, [scheduleType]);

            if (guilds.length === 0) {
                console.log(`No guilds found for ${scheduleType} schedule`);
                return { updated: 0, errors: 0 };
            }

            let updated = 0;
            let errors = 0;

            // Process each guild
            for (const guild of guilds) {
                try {
                    await this.postLeaderboard(
                        guild.guild_id,
                        guild.donation_leaderboard_channel_id,
                        guild.donation_message_id
                    );
                    updated++;
                    
                    // Add small delay to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`Failed to update leaderboard for guild ${guild.guild_id}:`, error);
                    errors++;
                }
            }

            console.log(`✅ Scheduled update complete: ${updated} updated, ${errors} errors`);
            return { updated, errors, scheduleType };

        } catch (error) {
            console.error('Error in scheduled leaderboard update:', error);
            return { updated: 0, errors: 1, error: error.message };
        }
    }

    /**
     * Admin command to manually trigger leaderboard update
     * @param {CommandInteraction} interaction - Discord slash command interaction
     */
    async handleAdminCommand(interaction) {
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
                interaction.channelId
            );

            if (result.success) {
                await interaction.editReply('✅ Leaderboard updated successfully!');
            } else {
                await interaction.editReply(`❌ Failed to update leaderboard: ${result.error}`);
            }

        } catch (error) {
            console.error('Error in admin leaderboard command:', error);
            await interaction.editReply('❌ An error occurred while updating the leaderboard.');
        }
    }
}

module.exports = LeaderboardEvents;