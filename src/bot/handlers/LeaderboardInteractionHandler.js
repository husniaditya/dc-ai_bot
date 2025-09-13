const { EmbedBuilder } = require('discord.js');
const LeaderboardButtons = require('../../components/leaderboard/LeaderboardButtons');
const LeaderboardCanvas = require('../../utils/leaderboard/LeaderboardCanvas');
const ClashOfClansAPI = require('../services/ClashOfClansAPI');

/**
 * Handles all leaderboard button interactions
 * Processes refresh, edit, pagination, and admin actions
 */
class LeaderboardInteractionHandler {
    constructor(database) {
        this.db = database;
    }

    /**
     * Main handler for all leaderboard button interactions
     * @param {ButtonInteraction} interaction - Discord button interaction
     */
    async handleButtonInteraction(interaction) {
        try {
            await interaction.deferUpdate(); // Acknowledge the interaction
            
            const { action, guildId, currentPage } = LeaderboardButtons.parseButtonInteraction(interaction.customId) || {};
            
            if (!action || guildId !== interaction.guildId) {
                return await this.sendError(interaction, 'Invalid button interaction');
            }

            // Get current leaderboard configuration
            const config = await this.getLeaderboardConfig(guildId);
            if (!config || !config.track_donation_leaderboard) {
                return await this.sendError(interaction, 'Donation leaderboard is not enabled for this server');
            }

            // Check permissions for admin actions
            if (action === 'edit' && !LeaderboardButtons.hasAdminPermission(interaction.member)) {
                return await this.sendError(interaction, 'You need admin permissions to edit the leaderboard');
            }

            // Route to appropriate handler
            switch (action) {
                case 'refresh':
                    await this.handleRefresh(interaction, config);
                    break;
                case 'edit':
                    await this.handleEdit(interaction, config);
                    break;
                case 'prev':
                    await this.handlePagination(interaction, config, Math.max(1, (currentPage || config.donation_leaderboard_current_page || 1) - 1));
                    break;
                case 'next':
                    await this.handlePagination(interaction, config, (currentPage || config.donation_leaderboard_current_page || 1) + 1);
                    break;
                case 'summary':
                    await this.handleSummary(interaction, config, currentPage || config.donation_leaderboard_current_page || 1);
                    break;
                case 'back':
                    await this.handleBackToPage(interaction, config, currentPage || config.donation_leaderboard_current_page || 1);
                    break;
                default:
                    await this.sendError(interaction, 'Unknown action');
            }

        } catch (error) {
            console.error('Error handling leaderboard button interaction:', error);
            await this.sendError(interaction, 'An error occurred while processing your request');
        }
    }

    /**
     * Handles refresh button - re-fetch data and regenerate current page
     * @param {ButtonInteraction} interaction 
     * @param {Object} config - Leaderboard configuration
     */
    async handleRefresh(interaction, config) {
        try {
            // Show loading state
            await this.updateMessageWithLoading(interaction, 'Refreshing leaderboard data...');

            // Clear cached data to force fresh fetch
            await this.clearCachedData(config.guild_id);

            // Regenerate current page
            const currentPage = config.donation_leaderboard_current_page || 1;
            await this.generateLeaderboardPage(interaction, config, currentPage, true);

            console.log(`Leaderboard refreshed for guild ${config.guild_id} by ${interaction.user.tag}`);

        } catch (error) {
            console.error('Error refreshing leaderboard:', error);
            await this.sendError(interaction, 'Failed to refresh leaderboard data');
        }
    }

    /**
     * Handles edit button - show leaderboard settings (admin only)
     * @param {ButtonInteraction} interaction 
     * @param {Object} config - Leaderboard configuration
     */
    async handleEdit(interaction, config) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🛠️ Leaderboard Settings')
                .setDescription('Current leaderboard configuration:')
                .addFields([
                    {
                        name: '📊 Display Settings',
                        value: `**Players per page:** ${config.donation_leaderboard_players_per_page || 20}\n**Time range:** ${config.donation_leaderboard_time_range || 'current_season'}`,
                        inline: true
                    },
                    {
                        name: '🎨 Canvas Settings',
                        value: `**Background:** ${config.donation_leaderboard_background_type || 'random'}\n**Interactive:** ${config.donation_leaderboard_interactive ? 'Enabled' : 'Disabled'}`,
                        inline: true
                    },
                    {
                        name: '⏰ Schedule',
                        value: `**Frequency:** ${config.donation_leaderboard_schedule || 'manual'}\n**Last update:** ${config.donation_leaderboard_last_update ? new Date(config.donation_leaderboard_last_update).toLocaleString() : 'Never'}`,
                        inline: true
                    }
                ])
                .setColor('#3498db')
                .setFooter({ text: 'To modify settings, use the dashboard or contact an administrator' });

            await interaction.followUp({
                embeds: [embed],
                ephemeral: true // Only visible to the user who clicked
            });

        } catch (error) {
            console.error('Error showing edit panel:', error);
            await this.sendError(interaction, 'Failed to load leaderboard settings');
        }
    }

    /**
     * Handles pagination - navigate to different pages
     * @param {ButtonInteraction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} targetPage - Page to navigate to
     */
    async handlePagination(interaction, config, targetPage) {
        try {
            const totalPages = config.donation_leaderboard_total_pages || 1;
            
            // Validate page bounds
            if (targetPage < 1 || targetPage > totalPages) {
                return await this.sendError(interaction, 'Invalid page number');
            }

            // Show loading state
            await this.updateMessageWithLoading(interaction, `Loading page ${targetPage}...`);

            // Generate the requested page
            await this.generateLeaderboardPage(interaction, config, targetPage);

            console.log(`Leaderboard page changed to ${targetPage} for guild ${config.guild_id} by ${interaction.user.tag}`);

        } catch (error) {
            console.error('Error handling pagination:', error);
            await this.sendError(interaction, 'Failed to load requested page');
        }
    }

    /**
     * Generates and displays a leaderboard page
     * @param {Interaction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Page number to generate
     * @param {boolean} forceRefresh - Whether to force data refresh
     */
    async generateLeaderboardPage(interaction, config, page, forceRefresh = false) {
        try {
            // Get or fetch donation data
            const donationData = await this.getDonationData(config, forceRefresh);
            
            if (!donationData || donationData.players.length === 0) {
                return await this.sendError(interaction, 'No donation data available');
            }

            // Pagination logic
            const playersPerPage = config.donation_leaderboard_players_per_page || 20;
            const totalPages = Math.max(1, Math.ceil(donationData.players.length / playersPerPage));
            if (page > totalPages) page = totalPages;
            if (page < 1) page = 1;
            const startIndex = (page - 1) * playersPerPage;
            const endIndex = startIndex + playersPerPage;
            const pageData = donationData.players.slice(startIndex, endIndex);

            // Update database with current page state
            await this.updatePageState(config.guild_id, page, totalPages);

            // Generate canvas image
            const canvas = new LeaderboardCanvas();
            const canvasBuffer = await canvas.generateLeaderboard(pageData, config, page, totalPages);

            // Create buttons
            const isAdmin = LeaderboardButtons.hasAdminPermission(interaction.member);
            const buttonRow = LeaderboardButtons.createButtonRow({
                currentPage: page,
                totalPages,
                isAdmin,
                guildId: config.guild_id,
                view: 'page'
            });

            // Create embed with page info
            const embed = new EmbedBuilder()
                .setTitle(`📊 ${donationData.clanName || 'Clan'} Donation Leaderboard`)
                .setDescription(LeaderboardButtons.createPageIndicator(page, totalPages, donationData.players.length))
                .setImage('attachment://leaderboard.png')
                .setColor('#f39c12')
                .setTimestamp()
                .setFooter({ text: `${config.donation_leaderboard_time_range.replace('_', ' ')} • Updated` });

            // Update the message with buttons always enabled
            await interaction.editReply({
                content: config.donation_leaderboard_template || null,
                embeds: [embed],
                files: [{ attachment: canvasBuffer, name: 'leaderboard.png' }],
                components: [buttonRow]
            });

        } catch (error) {
            console.error('Error generating leaderboard page:', error);
            await this.sendError(interaction, 'Failed to generate leaderboard');
        }
    }

    /**
     * Show summary statistics view
     */
    async handleSummary(interaction, config, returnPage) {
        try {
            const donationData = await this.getDonationData(config, false);
            if (!donationData || donationData.players.length === 0) {
                return await this.sendError(interaction, 'No data available for summary');
            }

            const players = donationData.players;
            const totalPlayers = players.length;
            const totalDonations = players.reduce((sum, p) => sum + (p.donations || 0), 0);
            const totalReceived = players.reduce((sum, p) => sum + (p.received || 0), 0);
            const avgDonation = totalPlayers ? (totalDonations / totalPlayers) : 0;
            const avgReceived = totalPlayers ? (totalReceived / totalPlayers) : 0;
            const topDonors = [...players].sort((a,b) => (b.donations||0) - (a.donations||0)).slice(0,3);
            const topReceivers = [...players].sort((a,b) => (b.received||0) - (a.received||0)).slice(0,3);

            const embed = new EmbedBuilder()
                .setTitle('📈 Donation Leaderboard Summary')
                .setColor('#2ecc71')
                .setDescription(`Overview for ${donationData.clanName || 'Clan'} (${config.donation_leaderboard_time_range.replace('_',' ')})`)
                .addFields([
                    { name: '👥 Players Tracked', value: String(totalPlayers), inline: true },
                    { name: '📦 Total Donations', value: String(totalDonations), inline: true },
                    { name: '📥 Total Received', value: String(totalReceived), inline: true },
                    { name: '📊 Avg Donations', value: avgDonation.toFixed(1), inline: true },
                    { name: '📊 Avg Received', value: avgReceived.toFixed(1), inline: true },
                    { name: '🏆 Top Donors', value: topDonors.map((p,i)=>`**${i+1}.** ${p.name} - ${p.donations}`).join('\n') || 'N/A', inline: false },
                    { name: '📥 Top Receivers', value: topReceivers.map((p,i)=>`**${i+1}.** ${p.name} - ${p.received}`).join('\n') || 'N/A', inline: false }
                ])
                .setTimestamp();

            const isAdmin = LeaderboardButtons.hasAdminPermission(interaction.member);
            const buttonRow = LeaderboardButtons.createButtonRow({
                currentPage: returnPage,
                totalPages: config.donation_leaderboard_total_pages || 1,
                isAdmin,
                guildId: config.guild_id,
                view: 'summary'
            });

            await interaction.editReply({
                content: null,
                embeds: [embed],
                files: [],
                components: [buttonRow]
            });
        } catch (error) {
            console.error('Error generating summary view:', error);
            await this.sendError(interaction, 'Failed to generate summary');
        }
    }

    /**
     * Return to page view from summary
     */
    async handleBackToPage(interaction, config, page) {
        await this.generateLeaderboardPage(interaction, config, page, false);
    }

    /**
     * Helper methods
     */

    async getLeaderboardConfig(guildId) {
        const [rows] = await this.db.execute(
            'SELECT * FROM guild_clashofclans_watch WHERE guild_id = ?',
            [guildId]
        );
        return rows[0] || null;
    }

    async updatePageState(guildId, currentPage, totalPages) {
        await this.db.execute(
            'UPDATE guild_clashofclans_watch SET donation_leaderboard_current_page = ?, donation_leaderboard_total_pages = ? WHERE guild_id = ?',
            [currentPage, totalPages, guildId]
        );
    }

    async clearCachedData(guildId) {
        await this.db.execute(
            'UPDATE guild_clashofclans_watch SET donation_leaderboard_cached_data = NULL WHERE guild_id = ?',
            [guildId]
        );
    }

    async getDonationData(config, forceRefresh = false) {
        // Check cache first (unless force refresh)
        if (!forceRefresh && config.donation_leaderboard_cached_data) {
            try {
                const cached = JSON.parse(config.donation_leaderboard_cached_data);
                const cacheAge = Date.now() - new Date(cached.last_fetched).getTime();
                
                // Use cache if less than 30 minutes old
                if (cacheAge < 30 * 60 * 1000) {
                    return cached;
                }
            } catch (error) {
                console.warn('Failed to parse cached data:', error);
            }
        }

        // Fetch fresh data from CoC API
        try {
            const freshData = await ClashOfClansAPI.getClanDonationData(
                config.clans,
                config.donation_leaderboard_time_range
            );

            // Cache the fresh data
            if (freshData) {
                await this.db.execute(
                    'UPDATE guild_clashofclans_watch SET donation_leaderboard_cached_data = ?, donation_leaderboard_last_update = CURRENT_TIMESTAMP WHERE guild_id = ?',
                    [JSON.stringify({ ...freshData, last_fetched: new Date().toISOString() }), config.guild_id]
                );
            }

            return freshData;
        } catch (error) {
            console.error('Error fetching donation data:', error);
            
            // If API fails, try to use cached data even if old
            if (config.donation_leaderboard_cached_data) {
                try {
                    const cached = JSON.parse(config.donation_leaderboard_cached_data);
                    console.log('Using stale cached data due to API failure');
                    return cached;
                } catch (cacheError) {
                    console.warn('Failed to parse cached data:', cacheError);
                }
            }
            
            // Throw more specific error based on the type
            if (error.message.includes('API key invalid')) {
                throw new Error('❌ Clash of Clans API key is invalid or expired. Please check your configuration.');
            } else if (error.message.includes('Clan not found')) {
                throw new Error('❌ Clan not found. Please verify the clan tag is correct.');
            } else if (error.message.includes('rate limit')) {
                throw new Error('❌ API rate limit exceeded. Please try again in a few minutes.');
            } else {
                throw new Error(`❌ Failed to fetch clan data: ${error.message}`);
            }
        }
    }

    async updateMessageWithLoading(interaction, message) {
        const loadingButtons = LeaderboardButtons.createLoadingButtonRow(interaction.guildId);
        
        await interaction.editReply({
            content: `⏳ ${message}`,
            embeds: [],
            files: [],
            components: [loadingButtons]
        });
    }

    async sendError(interaction, message) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(message)
            .setColor('#e74c3c');

        const errorButtons = LeaderboardButtons.createErrorButtonRow(interaction.guildId);

        await interaction.editReply({
            content: null,
            embeds: [errorEmbed],
            files: [],
            components: [errorButtons]
        });
    }
}

module.exports = LeaderboardInteractionHandler;