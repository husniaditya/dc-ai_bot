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
            
            console.log('Button interaction received:', {
                customId: interaction.customId,
                guildId: interaction.guildId,
                userId: interaction.user.id
            });

            const parsedData = LeaderboardButtons.parseButtonInteraction(interaction.customId);
            console.log('Parsed button data:', parsedData);

            const { action, guildId, currentPage, view } = parsedData || {};
            
            if (!action || guildId !== interaction.guildId) {
                console.error('Invalid button interaction:', { action, guildId, interactionGuildId: interaction.guildId });
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
                    await this.handleRefresh(interaction, config, view);
                    break;
                case 'edit':
                    await this.handleEdit(interaction, config);
                    break;
                case 'prev':
                    await this.handlePagination(interaction, config, Math.max(1, (currentPage || config.donation_leaderboard_current_page || 1) - 1), view);
                    break;
                case 'next':
                    await this.handlePagination(interaction, config, (currentPage || config.donation_leaderboard_current_page || 1) + 1, view);
                    break;
                case 'summary':
                    await this.handleSummary(interaction, config, currentPage || config.donation_leaderboard_current_page || 1, view);
                    break;
                case 'back':
                    await this.handleBackToPage(interaction, config, currentPage || config.donation_leaderboard_current_page || 1, view);
                    break;
                case 'toggle_view':
                    await this.handleToggleView(interaction, config, currentPage || config.donation_leaderboard_current_page || 1, view);
                    break;
                default:
                    await this.sendError(interaction, 'Unknown action');
            }

        } catch (error) {
            console.error('Error handling leaderboard button interaction:', {
                error: error.message,
                customId: interaction.customId,
                guildId: interaction.guildId,
                stack: error.stack
            });
            try {
                await this.sendError(interaction, 'An error occurred while processing your request');
            } catch (sendErrorErr) {
                console.error('Failed to send error message:', sendErrorErr);
            }
        }
    }

    /**
     * Handles refresh button - re-fetch data and regenerate current page
     * @param {ButtonInteraction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {string} view - Current view (donations or war)
     */
    async handleRefresh(interaction, config, view = 'donations') {
        try {
            // Show loading state
            await this.updateMessageWithLoading(interaction, `Refreshing ${view} data...`, view);

            // Clear cached data to force fresh fetch
            await this.clearCachedData(config.guild_id, view);

            // Regenerate current page
            const currentPage = config.donation_leaderboard_current_page || 1;
            await this.generateLeaderboardPage(interaction, config, currentPage, true, view);

            console.log(`${view} leaderboard refreshed for guild ${config.guild_id} by ${interaction.user.tag}`);

        } catch (error) {
            console.error(`Error refreshing ${view} leaderboard:`, error);
            await this.sendError(interaction, `Failed to refresh ${view} data`, view);
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
     * @param {string} view - Current view (donations or war)
     */
    async handlePagination(interaction, config, targetPage, view = 'donations') {
        try {
            const totalPages = config.donation_leaderboard_total_pages || 1;
            
            // Validate page bounds
            if (targetPage < 1 || targetPage > totalPages) {
                return await this.sendError(interaction, 'Invalid page number');
            }

            // Show loading state
            await this.updateMessageWithLoading(interaction, `Loading page ${targetPage}...`, view);

            // Generate the requested page
            await this.generateLeaderboardPage(interaction, config, targetPage, false, view);

            console.log(`${view} leaderboard page changed to ${targetPage} for guild ${config.guild_id} by ${interaction.user.tag}`);

        } catch (error) {
            console.error('Error handling pagination:', error);
            await this.sendError(interaction, 'Failed to load requested page', view);
        }
    }

    /**
     * Handle toggling between donations and war statistics view
     * @param {ButtonInteraction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} currentPage - Current page number
     * @param {string} currentView - Current view (donations or war)
     */
    async handleToggleView(interaction, config, currentPage, currentView = 'donations') {
        // Toggle functionality has been disabled - each leaderboard type is now separate
        await this.sendError(interaction, 'Toggle functionality has been disabled. Donation and war leaderboards are now separate.');
    }

    /**
     * Generates and displays a leaderboard page
     * @param {Interaction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Page number to generate
     * @param {boolean} forceRefresh - Whether to force data refresh
     * @param {string} view - View type (donations or war)
     */
    async generateLeaderboardPage(interaction, config, page, forceRefresh = false, view = 'donations') {
        try {
            // Get data based on view type
            const leaderboardData = view === 'war' 
                ? await this.getWarData(config, forceRefresh)
                : await this.getDonationData(config, forceRefresh);
            
            if (!leaderboardData || leaderboardData.players.length === 0) {
                return await this.sendError(interaction, `No ${view} data available`);
            }

            // Pagination logic
            const playersPerPage = config.donation_leaderboard_players_per_page || 20;
            const totalPages = Math.max(1, Math.ceil(leaderboardData.players.length / playersPerPage));
            if (page > totalPages) page = totalPages;
            if (page < 1) page = 1;
            const startIndex = (page - 1) * playersPerPage;
            const endIndex = startIndex + playersPerPage;
            const pageData = leaderboardData.players.slice(startIndex, endIndex);

            // Update database with current page state
            await this.updatePageState(config.guild_id, page, totalPages);

            // Generate canvas image
            const canvas = new LeaderboardCanvas();
            const canvasBuffer = view === 'war'
                ? await canvas.generateWarLeaderboard(pageData, config, page, totalPages, leaderboardData)
                : await canvas.generateLeaderboard(pageData, config, page, totalPages);

            // Create buttons
            const isAdmin = LeaderboardButtons.hasAdminPermission(interaction.member);
            const buttonRow = LeaderboardButtons.createButtonRow({
                currentPage: page,
                totalPages,
                isAdmin,
                guildId: config.guild_id,
                view: 'page',
                dataView: view
            });

            // Create embed with page info
            const viewTitle = view === 'war' ? 'War Statistics' : 'Donation Leaderboard';
            const viewEmoji = view === 'war' ? '⚔️' : '📊';
            
            const embed = new EmbedBuilder()
                .setTitle(`${viewEmoji} ${leaderboardData.clanName || 'Clan'} ${viewTitle}`)
                .setDescription(LeaderboardButtons.createPageIndicator(page, totalPages, leaderboardData.players.length))
                .setImage('attachment://leaderboard.png')
                .setColor(view === 'war' ? '#e74c3c' : '#f39c12')
                .setTimestamp()
                .setFooter({ 
                    text: `${(config.donation_leaderboard_time_range || 'current_season').replace('_', ' ')} • Updated` 
                });

            // Update the message with buttons always enabled
            const updateData = {
                embeds: [embed],
                files: [{ attachment: canvasBuffer, name: 'leaderboard.png' }],
                components: [buttonRow]
            };

            // Only add content if template exists and is not empty
            if (config.donation_leaderboard_template && config.donation_leaderboard_template.trim()) {
                updateData.content = config.donation_leaderboard_template;
            }

            await interaction.editReply(updateData);

        } catch (error) {
            console.error(`Error generating ${view} leaderboard page:`, error);
            console.error('Full error details:', {
                message: error.message,
                code: error.code,
                status: error.status,
                stack: error.stack
            });
            await this.sendError(interaction, `Failed to generate ${view} leaderboard`);
        }
    }

    /**
     * Show summary statistics view
     */
    async handleSummary(interaction, config, returnPage, view = 'donations') {
        try {
            const leaderboardData = view === 'war' 
                ? await this.getWarData(config, false)
                : await this.getDonationData(config, false);
                
            if (!leaderboardData || leaderboardData.players.length === 0) {
                return await this.sendError(interaction, `No ${view} data available for summary`);
            }

            const players = leaderboardData.players;
            const totalPlayers = players.length;
            
            let embed;
            if (view === 'war') {
                // War statistics summary
                const totalWars = players.reduce((sum, p) => sum + (p.warsParticipated || 0), 0);
                const totalStars = players.reduce((sum, p) => sum + (p.totalStars || 0), 0);
                const totalAttacks = players.reduce((sum, p) => sum + (p.totalAttacks || 0), 0);
                const avgStars = totalAttacks > 0 ? (totalStars / totalAttacks) : 0;
                const topWarriors = [...players].sort((a,b) => parseFloat(b.averageStars||0) - parseFloat(a.averageStars||0)).slice(0,3);
                const topParticipants = [...players].sort((a,b) => (b.warsParticipated||0) - (a.warsParticipated||0)).slice(0,3);

                embed = new EmbedBuilder()
                    .setTitle('⚔️ War Statistics Summary')
                    .setColor('#e74c3c')
                    .setDescription(`War overview for ${leaderboardData.clanName || 'Clan'}`)
                    .addFields([
                        { name: '👥 Warriors Tracked', value: String(totalPlayers), inline: true },
                        { name: '⚔️ Total Wars', value: String(Math.max(...players.map(p => p.warsParticipated || 0))), inline: true },
                        { name: '⭐ Total Stars', value: String(totalStars), inline: true },
                        { name: '🎯 Total Attacks', value: String(totalAttacks), inline: true },
                        { name: '📊 Avg Stars/Attack', value: avgStars.toFixed(2), inline: true },
                        { name: '🏆 Top Warriors (Avg Stars)', value: topWarriors.map((p,i)=>`**${i+1}.** ${p.name} - ${p.averageStars}⭐`).join('\n') || 'N/A', inline: false },
                        { name: '🛡️ Most Active Warriors', value: topParticipants.map((p,i)=>`**${i+1}.** ${p.name} - ${p.warsParticipated} wars`).join('\n') || 'N/A', inline: false }
                    ])
                    .setTimestamp();
            } else {
                // Donation statistics summary  
                const totalDonations = players.reduce((sum, p) => sum + (p.donations || 0), 0);
                const totalReceived = players.reduce((sum, p) => sum + (p.received || 0), 0);
                const avgDonation = totalPlayers ? (totalDonations / totalPlayers) : 0;
                const avgReceived = totalPlayers ? (totalReceived / totalPlayers) : 0;
                const topDonors = [...players].sort((a,b) => (b.donations||0) - (a.donations||0)).slice(0,3);
                const topReceivers = [...players].sort((a,b) => (b.received||0) - (a.received||0)).slice(0,3);

                embed = new EmbedBuilder()
                    .setTitle('📈 Donation Leaderboard Summary')
                    .setColor('#2ecc71')
                    .setDescription(`Overview for ${leaderboardData.clanName || 'Clan'} (${config.donation_leaderboard_time_range.replace('_',' ')})`)
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
            }

            const isAdmin = LeaderboardButtons.hasAdminPermission(interaction.member);
            const buttonRow = LeaderboardButtons.createButtonRow({
                currentPage: returnPage,
                totalPages: config.donation_leaderboard_total_pages || 1,
                isAdmin,
                guildId: config.guild_id,
                view: 'summary',
                dataView: view
            });

            await interaction.editReply({
                content: null,
                embeds: [embed],
                files: [],
                components: [buttonRow]
            });
        } catch (error) {
            console.error(`Error generating ${view} summary view:`, error);
            await this.sendError(interaction, `Failed to generate ${view} summary`);
        }
    }

    /**
     * Return to page view from summary
     */
    async handleBackToPage(interaction, config, page, view = 'donations') {
        await this.generateLeaderboardPage(interaction, config, page, false, view);
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

    async clearCachedData(guildId, view = 'donations') {
        const column = view === 'war' ? 'war_leaderboard_cached_data' : 'donation_leaderboard_cached_data';
        await this.db.execute(
            `UPDATE guild_clashofclans_watch SET ${column} = NULL WHERE guild_id = ?`,
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

    async getWarData(config, forceRefresh = false) {
        // Check cache first (unless force refresh)
        if (!forceRefresh && config.war_leaderboard_cached_data) {
            try {
                const cached = JSON.parse(config.war_leaderboard_cached_data);
                const cacheAge = Date.now() - new Date(cached.last_fetched).getTime();
                
                // Use cache if less than 30 minutes old
                if (cacheAge < 30 * 60 * 1000) {
                    return cached;
                }
            } catch (error) {
                console.warn('Failed to parse cached war data:', error);
            }
        }

        // Fetch fresh data from CoC API
        try {
            const cocApi = ClashOfClansAPI;
            const freshData = await cocApi.getClanWarStats(config.clans);

            // Cache the fresh data
            if (freshData) {
                await this.db.execute(
                    'UPDATE guild_clashofclans_watch SET war_leaderboard_cached_data = ?, donation_leaderboard_last_update = CURRENT_TIMESTAMP WHERE guild_id = ?',
                    [JSON.stringify({ ...freshData, last_fetched: new Date().toISOString() }), config.guild_id]
                );
            }

            return freshData;
        } catch (error) {
            console.error('Error fetching war data:', error);
            
            // If API fails, try to use cached data even if old
            if (config.war_leaderboard_cached_data) {
                try {
                    const cached = JSON.parse(config.war_leaderboard_cached_data);
                    console.log('Using stale cached war data due to API failure');
                    return cached;
                } catch (cacheError) {
                    console.warn('Failed to parse cached war data:', cacheError);
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
                throw new Error(`❌ Failed to fetch war data: ${error.message}`);
            }
        }
    }

    async updateMessageWithLoading(interaction, message, view = 'donations') {
        const loadingButtons = LeaderboardButtons.createLoadingButtonRow(interaction.guildId, view);
        
        await interaction.editReply({
            content: `⏳ ${message}`,
            embeds: [],
            files: [],
            components: [loadingButtons]
        });
    }

    async sendError(interaction, message, view = 'donations') {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(message)
            .setColor('#e74c3c');

        const errorButtons = LeaderboardButtons.createErrorButtonRow(interaction.guildId, view);

        await interaction.editReply({
            content: null,
            embeds: [errorEmbed],
            files: [],
            components: [errorButtons]
        });
    }
}

module.exports = LeaderboardInteractionHandler;