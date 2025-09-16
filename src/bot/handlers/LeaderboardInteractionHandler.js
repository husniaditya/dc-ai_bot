const { EmbedBuilder } = require('discord.js');
const LeaderboardButtons = require('../../components/leaderboard/LeaderboardButtons');
const LeaderboardCanvas = require('../../utils/leaderboard/LeaderboardCanvas');
const ClashOfClansAPI = require('../services/ClashOfClansAPI');
const clashOfClansService = require('../../config/store/services/clashofclans-updated');

/**
 * Handles all leaderboard button interactions
 * Processes refresh, edit, pagination, and admin actions
 */
class LeaderboardInteractionHandler {
    constructor(database) {
        this.db = database;
        this.lastInteraction = new Map(); // Track last interaction time per user to prevent spam
    }

    /**
     * Main handler for all leaderboard button interactions
     * @param {ButtonInteraction} interaction - Discord button interaction
     */
    async handleButtonInteraction(interaction) {
        try {
            // Rate limiting: prevent rapid button clicking (minimum 500ms between interactions)
            const userId = interaction.user.id;
            const now = Date.now();
            const lastTime = this.lastInteraction.get(userId) || 0;
            
            if (now - lastTime < 500) {
                console.log(`Rate limited interaction from user ${userId}, ignoring`);
                return; // Silently ignore rapid clicks
            }
            
            this.lastInteraction.set(userId, now);
            
            // Check if interaction is still valid before trying to defer
            if (!interaction.isButton() || !interaction.guildId) {
                console.error('Invalid interaction type or missing guild:', {
                    isButton: interaction.isButton(),
                    guildId: interaction.guildId,
                    customId: interaction.customId
                });
                return;
            }

            // Try to defer the interaction with error handling
            try {
                await interaction.deferUpdate();
            } catch (deferError) {
                console.error('Failed to defer interaction (likely expired):', {
                    error: deferError.message,
                    code: deferError.code,
                    customId: interaction.customId,
                    guildId: interaction.guildId
                });
                // If we can't defer, the interaction is likely expired - just return
                return;
            }
            
            console.log('Button interaction received:', {
                customId: interaction.customId,
                guildId: interaction.guildId,
                userId: interaction.user.id
            });

            const parsedData = LeaderboardButtons.parseButtonInteraction(interaction.customId);
            console.log('Parsed button data:', parsedData);

            const { action, guildId, currentPage, view, clanTag } = parsedData || {};
            
            if (!action || guildId !== interaction.guildId) {
                console.error('Invalid button interaction:', { action, guildId, interactionGuildId: interaction.guildId });
                return await this.sendError(interaction, 'Invalid button interaction');
            }

            // Get current leaderboard configuration
            const config = await this.getLeaderboardConfig(guildId);
            if (!config || !config.trackDonationLeaderboard) {
                return await this.sendError(interaction, 'Donation leaderboard is not enabled for this server');
            }

            // Check permissions for admin actions
            if (action === 'edit' && !LeaderboardButtons.hasAdminPermission(interaction.member)) {
                return await this.sendError(interaction, 'You need admin permissions to edit the leaderboard');
            }

            // Route to appropriate handler
            switch (action) {
                case 'refresh':
                    await this.handleRefresh(interaction, config, view, clanTag);
                    break;
                case 'edit':
                    await this.handleEdit(interaction, config, clanTag);
                    break;
                case 'prev':
                    await this.handlePagination(interaction, config, Math.max(1, (currentPage || config.donation_leaderboard_current_page || 1) - 1), view, clanTag);
                    break;
                case 'next':
                    await this.handlePagination(interaction, config, (currentPage || config.donation_leaderboard_current_page || 1) + 1, view, clanTag);
                    break;
                case 'summary':
                    await this.handleSummary(interaction, config, currentPage || config.donation_leaderboard_current_page || 1, view, clanTag);
                    break;
                case 'back':
                    await this.handleBackToPage(interaction, config, currentPage || config.donation_leaderboard_current_page || 1, view, clanTag);
                    break;
                case 'toggle_view':
                    await this.handleToggleView(interaction, config, currentPage || config.donation_leaderboard_current_page || 1, view, clanTag);
                    break;
                default:
                    await this.sendError(interaction, 'Unknown action');
            }

        } catch (error) {
            console.error('Error handling leaderboard button interaction:', {
                error: error.message,
                code: error.code,
                customId: interaction.customId,
                guildId: interaction.guildId,
                stack: error.stack
            });
            
            // Don't try to send error messages for expired/unknown interactions
            if (error.code === 10062 || error.code === 40060 || error.message.includes('Unknown interaction') || error.message.includes('already been acknowledged')) {
                console.log('Interaction expired or invalid, skipping error message');
                return;
            }
            
            // Only try to send error message if interaction is still valid
            if (interaction.deferred || interaction.replied) {
                try {
                    await this.sendError(interaction, 'An error occurred while processing your request');
                } catch (sendErrorErr) {
                    console.error('Failed to send error message:', sendErrorErr);
                }
            }
        }
    }

    /**
     * Handles refresh button - re-fetch data and regenerate current page
     * @param {ButtonInteraction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {string} view - Current view (donations or war)
     * @param {string} clanTag - Specific clan tag for clan-specific refresh
     */
    async handleRefresh(interaction, config, view = 'donations', clanTag = null) {
        try {
            // Clear cached data to force fresh fetch
            await this.clearCachedData(interaction.guildId, view, clanTag);

            // Regenerate current page directly (no loading state to avoid double acknowledgment)
            const currentPage = config.donation_leaderboard_current_page || 1;
            await this.generateLeaderboardPage(interaction, config, currentPage, true, view, clanTag);

            console.log(`${view} leaderboard refreshed for guild ${interaction.guildId} by ${interaction.user.tag}${clanTag ? ` (clan: ${clanTag})` : ''}`);

        } catch (error) {
            console.error(`Error refreshing ${view} leaderboard:`, error);
            await this.sendError(interaction, `Failed to refresh ${view} data`, view, clanTag);
        }
    }

    /**
     * Handles edit button - show leaderboard settings (admin only)
     * @param {ButtonInteraction} interaction 
     * @param {Object} config - Leaderboard configuration
     */
    async handleEdit(interaction, config, clanTag = null) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🛠️ Leaderboard Settings')
                .setDescription(`Current leaderboard configuration${clanTag ? ` for ${clanTag}` : ''}:`)
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
            await this.sendError(interaction, 'Failed to load leaderboard settings', 'donations', clanTag);
        }
    }

    /**
     * Handles pagination - navigate to different pages
     * @param {ButtonInteraction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} targetPage - Page to navigate to
     * @param {string} view - Current view (donations or war)
     * @param {string} clanTag - Specific clan tag for clan-specific pagination
     */
    async handlePagination(interaction, config, targetPage, view = 'donations', clanTag = null) {
        try {
            // For clan-specific pagination, we need to get the actual data to determine total pages
            let totalPages;
            if (clanTag) {
                // Get individual clan data to determine correct total pages
                const clanData = view === 'war' 
                    ? await this.getIndividualWarData(config, clanTag, false)
                    : await this.getIndividualDonationData(config, clanTag, false);
                
                if (!clanData || clanData.players.length === 0) {
                    return await this.sendError(interaction, `No ${view} data available for pagination`, view, clanTag);
                }
                
                const playersPerPage = config.donation_leaderboard_players_per_page || 20;
                totalPages = Math.max(1, Math.ceil(clanData.players.length / playersPerPage));
            } else {
                // Use config total pages for combined leaderboard
                totalPages = config.donation_leaderboard_total_pages || 1;
            }
            
            // Validate page bounds
            if (targetPage < 1 || targetPage > totalPages) {
                return await this.sendError(interaction, `Invalid page number. Available pages: 1-${totalPages}`, view, clanTag);
            }

            // Generate the requested page directly (no loading state to avoid double acknowledgment)
            await this.generateLeaderboardPage(interaction, config, targetPage, false, view, clanTag);

            console.log(`${view} leaderboard page changed to ${targetPage} for guild ${interaction.guildId} by ${interaction.user.tag}${clanTag ? ` (clan: ${clanTag})` : ''}`);

        } catch (error) {
            console.error('Error handling pagination:', error);
            await this.sendError(interaction, 'Failed to load requested page', view, clanTag);
        }
    }

    /**
     * Handle toggling between donations and war statistics view
     * @param {ButtonInteraction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} currentPage - Current page number
     * @param {string} currentView - Current view (donations or war)
     * @param {string} clanTag - Optional specific clan tag
     */
    async handleToggleView(interaction, config, currentPage, currentView = 'donations', clanTag = null) {
        // Toggle functionality has been disabled - each leaderboard type is now separate
        await this.sendError(interaction, 'Toggle functionality has been disabled. Donation and war leaderboards are now separate.', currentView, clanTag);
    }

    /**
     * Generates and displays a leaderboard page (handles both individual and combined clan data)
     * @param {Interaction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Page number to generate
     * @param {boolean} forceRefresh - Whether to force data refresh
     * @param {string} view - View type (donations or war)
     * @param {string} clanTag - Optional specific clan tag for individual clan display
     */
    async generateLeaderboardPage(interaction, config, page, forceRefresh = false, view = 'donations', clanTag = null) {
        try {
            // If clanTag is specified, generate individual clan leaderboard
            if (clanTag) {
                return await this.generateIndividualClanLeaderboard(interaction, config, page, forceRefresh, view, clanTag);
            }

            // Check if multiple clans are configured using the new config structure
            const clans = config.clans || [];
            
            if (clans.length > 1) {
                // Multiple clans - generate separate messages for each clan
                // config.clans is an array of clan tag strings
                const clanTags = clans; 
                return await this.generateMultipleClanLeaderboards(interaction, config, page, forceRefresh, view, clanTags);
            }

            // Single clan or legacy behavior - use original combined method
            return await this.generateOriginalLeaderboardPage(interaction, config, page, forceRefresh, view);

        } catch (error) {
            console.error(`Error generating ${view} leaderboard page:`, error);
            await this.sendError(interaction, `Failed to generate ${view} leaderboard`, view, clanTag);
        }
    }

    /**
     * Generate individual clan leaderboard for a specific clan
     * @param {Interaction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Page number to generate
     * @param {boolean} forceRefresh - Whether to force data refresh
     * @param {string} view - View type (donations or war)
     * @param {string} clanTag - Specific clan tag
     */
    async generateIndividualClanLeaderboard(interaction, config, page, forceRefresh = false, view = 'donations', clanTag) {
        try {
            // Get data for the specific clan
            const clanData = view === 'war' 
                ? await this.getIndividualWarData(config, clanTag, forceRefresh)
                : await this.getIndividualDonationData(config, clanTag, forceRefresh);
            
            if (!clanData || clanData.players.length === 0) {
                return await this.sendError(interaction, `No ${view} data available for clan ${clanTag}`, view, clanTag);
            }

            // Pagination logic
            const playersPerPage = config.donation_leaderboard_players_per_page || 20;
            const totalPages = Math.max(1, Math.ceil(clanData.players.length / playersPerPage));
            if (page > totalPages) page = totalPages;
            if (page < 1) page = 1;
            const startIndex = (page - 1) * playersPerPage;
            const endIndex = startIndex + playersPerPage;
            const pageData = clanData.players.slice(startIndex, endIndex);

            // Update database with current page state
            await this.updatePageState(interaction.guildId, page, totalPages, clanTag);

            // Generate canvas image
            const canvas = new LeaderboardCanvas();
            const canvasBuffer = view === 'war'
                ? await canvas.generateWarLeaderboard(pageData, {...config, clan_name: clanData.clanName, clan_tag: clanTag}, page, totalPages, clanData)
                : await canvas.generateLeaderboard(pageData, {...config, clan_name: clanData.clanName, clan_tag: clanTag}, page, totalPages);

            // Create buttons with clan tag
            const isAdmin = LeaderboardButtons.hasAdminPermission(interaction.member);
            const buttonRow = LeaderboardButtons.createButtonRow({
                currentPage: page,
                totalPages,
                isAdmin,
                guildId: interaction.guildId,
                clanTag: clanTag,
                view: 'page',
                dataView: view
            });

            // Create embed with page info
            const viewTitle = view === 'war' ? 'War Statistics' : 'Donation Leaderboard';
            const viewEmoji = view === 'war' ? '⚔️' : '📊';
            
            const embed = new EmbedBuilder()
                .setTitle(`${viewEmoji} ${clanData.clanName} ${viewTitle}`)
                .setDescription(LeaderboardButtons.createPageIndicator(page, totalPages, clanData.players.length))
                .setImage('attachment://leaderboard.png')
                .setColor(view === 'war' ? '#e74c3c' : '#f39c12')
                .setTimestamp()
                .setFooter({ 
                    text: `${clanTag} • ${(config.donation_leaderboard_time_range || 'current_season').replace('_', ' ')} • Updated` 
                });

            // Update the message
            const updateData = {
                embeds: [embed],
                files: [{ attachment: canvasBuffer, name: 'leaderboard.png' }],
                components: [buttonRow]
            };

            // Only add content if template exists and is not empty
            if (config.donation_leaderboard_template && config.donation_leaderboard_template.trim()) {
                updateData.content = config.donation_leaderboard_template;
            }

            // Update the interaction reply
            if (interaction.deferred || interaction.replied) {
                try {
                    await interaction.editReply(updateData);
                } catch (editError) {
                    console.error('Failed to edit reply (interaction may be expired):', {
                        error: editError.message,
                        code: editError.code,
                        customId: interaction.customId
                    });
                    return;
                }
            } else {
                console.error('Interaction not properly deferred, cannot edit reply');
                return;
            }

        } catch (error) {
            console.error(`Error generating individual ${view} leaderboard for clan ${clanTag}:`, error);
            await this.sendError(interaction, `Failed to generate ${view} leaderboard for ${clanTag}`, view, clanTag);
        }
    }

    /**
     * Generate separate leaderboard messages for multiple clans
     * @param {Interaction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Page number to generate
     * @param {boolean} forceRefresh - Whether to force data refresh
     * @param {string} view - View type (donations or war)
     * @param {Array} clanTags - Array of clan tags
     */
    async generateMultipleClanLeaderboards(interaction, config, page, forceRefresh = false, view = 'donations', clanTags) {
        try {
            // Get individual data for each clan
            const clanDataArray = view === 'war' 
                ? await ClashOfClansAPI.getIndividualClanWarStats(clanTags)
                : await ClashOfClansAPI.getIndividualClanDonationData(clanTags, config.donation_leaderboard_time_range);
            
            if (!clanDataArray || clanDataArray.length === 0) {
                return await this.sendError(interaction, `No ${view} data available for any clan`, view);
            }

            // For the first clan, update the original interaction reply
            const firstClanData = clanDataArray[0];
            await this.generateClanLeaderboardForData(interaction, config, page, firstClanData, view, true);

            // For additional clans, send follow-up messages
            for (let i = 1; i < clanDataArray.length; i++) {
                const clanData = clanDataArray[i];
                try {
                    await this.generateClanLeaderboardForData(interaction, config, page, clanData, view, false);
                } catch (followUpError) {
                    console.error(`Failed to send follow-up for clan ${clanData.clanTag}:`, followUpError);
                }
            }

            console.log(`Generated ${view} leaderboards for ${clanDataArray.length} clans`);

        } catch (error) {
            console.error(`Error generating multiple ${view} leaderboards:`, error);
            await this.sendError(interaction, `Failed to generate ${view} leaderboards`, view);
        }
    }

    /**
     * Generate leaderboard for specific clan data (helper method)
     * @param {Interaction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Page number
     * @param {Object} clanData - Individual clan data
     * @param {string} view - View type (donations or war)
     * @param {boolean} isOriginalReply - Whether this is the original reply or a follow-up
     */
    async generateClanLeaderboardForData(interaction, config, page, clanData, view, isOriginalReply = false) {
        try {
            // Pagination logic
            const playersPerPage = config.donation_leaderboard_players_per_page || 20;
            const totalPages = Math.max(1, Math.ceil(clanData.players.length / playersPerPage));
            if (page > totalPages) page = totalPages;
            if (page < 1) page = 1;
            const startIndex = (page - 1) * playersPerPage;
            const endIndex = startIndex + playersPerPage;
            const pageData = clanData.players.slice(startIndex, endIndex);

            // Generate canvas image
            const canvas = new LeaderboardCanvas();
            const canvasBuffer = view === 'war'
                ? await canvas.generateWarLeaderboard(pageData, {...config, clan_name: clanData.clanName, clan_tag: clanData.clanTag}, page, totalPages, clanData)
                : await canvas.generateLeaderboard(pageData, {...config, clan_name: clanData.clanName, clan_tag: clanData.clanTag}, page, totalPages);

            // Create buttons with clan tag
            const isAdmin = LeaderboardButtons.hasAdminPermission(interaction.member);
            const buttonRow = LeaderboardButtons.createButtonRow({
                currentPage: page,
                totalPages,
                isAdmin,
                guildId: interaction.guildId,
                clanTag: clanData.clanTag,
                view: 'page',
                dataView: view
            });

            // Create embed with page info
            const viewTitle = view === 'war' ? 'War Statistics' : 'Donation Leaderboard';
            const viewEmoji = view === 'war' ? '⚔️' : '📊';
            
            const embed = new EmbedBuilder()
                .setTitle(`${viewEmoji} ${clanData.clanName} ${viewTitle}`)
                .setDescription(LeaderboardButtons.createPageIndicator(page, totalPages, clanData.players.length))
                .setImage('attachment://leaderboard.png')
                .setColor(view === 'war' ? '#e74c3c' : '#f39c12')
                .setTimestamp()
                .setFooter({ 
                    text: `${clanData.clanTag} • ${(config.donation_leaderboard_time_range || 'current_season').replace('_', ' ')} • Updated` 
                });

            // Prepare message data
            const messageData = {
                embeds: [embed],
                files: [{ attachment: canvasBuffer, name: 'leaderboard.png' }],
                components: [buttonRow]
            };

            // Only add content if template exists and is not empty (only for original reply)
            if (isOriginalReply && config.donation_leaderboard_template && config.donation_leaderboard_template.trim()) {
                messageData.content = config.donation_leaderboard_template;
            }

            // Send message
            if (isOriginalReply) {
                // Update the original interaction reply
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(messageData);
                } else {
                    console.error('Interaction not properly deferred, cannot edit reply');
                }
            } else {
                // Send as follow-up message
                await interaction.followUp(messageData);
            }

        } catch (error) {
            console.error(`Error generating leaderboard for clan ${clanData.clanTag}:`, error);
            throw error;
        }
    }

    /**
     * Show summary statistics view
     * @param {ButtonInteraction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} returnPage - Page to return to
     * @param {string} view - Current view (donations or war)
     * @param {string} clanTag - Optional specific clan tag
     */
    async handleSummary(interaction, config, returnPage, view = 'donations', clanTag = null) {
        try {
            let leaderboardData;
            
            if (clanTag) {
                // Get data for specific clan
                leaderboardData = view === 'war' 
                    ? await this.getIndividualWarData(config, clanTag, false)
                    : await this.getIndividualDonationData(config, clanTag, false);
            } else {
                // Get combined data (original behavior)
                leaderboardData = view === 'war' 
                    ? await this.getWarData(config, false)
                    : await this.getDonationData(config, false);
            }
                
            if (!leaderboardData || leaderboardData.players.length === 0) {
                return await this.sendError(interaction, `No ${view} data available for summary`, view, clanTag);
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
                    .setTitle(`⚔️ War Statistics Summary${clanTag ? ` - ${clanTag}` : ''}`)
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
                    .setTitle(`📈 Donation Leaderboard Summary${clanTag ? ` - ${clanTag}` : ''}`)
                    .setColor('#2ecc71')
                    .setDescription(`Overview for ${leaderboardData.clanName || 'Clan'} (${(config.donation_leaderboard_time_range || 'current_season').replace('_',' ')})`)
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
            
            // Calculate correct total pages based on actual player data
            const playersPerPage = config.donation_leaderboard_players_per_page || 20;
            const totalPages = Math.max(1, Math.ceil(players.length / playersPerPage));
            
            const buttonRow = LeaderboardButtons.createButtonRow({
                currentPage: returnPage,
                totalPages,
                isAdmin,
                guildId: interaction.guildId,
                clanTag: clanTag,
                view: 'summary',
                dataView: view
            });

            // Check if interaction is still valid before editing
            if (interaction.deferred || interaction.replied) {
                try {
                    await interaction.editReply({
                        content: null,
                        embeds: [embed],
                        files: [],
                        components: [buttonRow]
                    });
                } catch (editError) {
                    console.error('Failed to edit reply in summary (interaction may be expired):', {
                        error: editError.message,
                        code: editError.code,
                        customId: interaction.customId
                    });
                    return;
                }
            } else {
                console.error('Interaction not properly deferred, cannot edit reply in summary');
                return;
            }
        } catch (error) {
            console.error(`Error generating ${view} summary view:`, error);
            await this.sendError(interaction, `Failed to generate ${view} summary`, view, clanTag);
        }
    }

    /**
     * Return to page view from summary
     * @param {ButtonInteraction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Page number to return to
     * @param {string} view - Current view (donations or war)
     * @param {string} clanTag - Optional specific clan tag
     */
    async handleBackToPage(interaction, config, page, view = 'donations', clanTag = null) {
        await this.generateLeaderboardPage(interaction, config, page, false, view, clanTag);
    }

    /**
     * Helper methods
     */

    async getLeaderboardConfig(guildId) {
        // Use the new multi-row service to get all clan configurations for this guild
        const config = await clashOfClansService.getGuildClashOfClansConfig(guildId);
        
        // Return the config object which now contains all clans as an array
        return config;
    }

    /**
     * Get individual clan donation data
     * @param {Object} config - Leaderboard configuration
     * @param {string} clanTag - Specific clan tag
     * @param {boolean} forceRefresh - Whether to force data refresh
     * @returns {Object} Individual clan donation data
     */
    async getIndividualDonationData(config, clanTag, forceRefresh = false) {
        // For individual clan, we can use the new API method
        const clanDataArray = await ClashOfClansAPI.getIndividualClanDonationData([clanTag], config.donation_leaderboard_time_range);
        
        if (!clanDataArray || clanDataArray.length === 0) {
            throw new Error(`No donation data available for clan ${clanTag}`);
        }

        const clanData = clanDataArray[0];
        
        // Enhance with activity tracking if we have previous data
        if (clanData.players && clanData.players.length > 0) {
            let previousPlayers = [];
            const cacheKey = `${config.guild_id}_${clanTag}_donations`;
            
            if (config.donation_leaderboard_cached_data) {
                try {
                    const cachedData = JSON.parse(config.donation_leaderboard_cached_data);
                    if (cachedData[cacheKey]) {
                        previousPlayers = cachedData[cacheKey].players || [];
                    }
                } catch (error) {
                    console.warn('Failed to parse previous clan data:', error);
                }
            }
            
            clanData.players = await ClashOfClansAPI.enhancePlayersWithActivity(clanData.players, previousPlayers);
        }

        return clanData;
    }

    /**
     * Get individual clan war data
     * @param {Object} config - Leaderboard configuration
     * @param {string} clanTag - Specific clan tag
     * @param {boolean} forceRefresh - Whether to force data refresh
     * @returns {Object} Individual clan war data
     */
    async getIndividualWarData(config, clanTag, forceRefresh = false) {
        // For individual clan, we can use the new API method
        const clanDataArray = await ClashOfClansAPI.getIndividualClanWarStats([clanTag]);
        
        if (!clanDataArray || clanDataArray.length === 0) {
            throw new Error(`No war data available for clan ${clanTag}`);
        }

        const clanData = clanDataArray[0];
        
        // Enhance with activity tracking if we have previous data
        if (clanData.players && clanData.players.length > 0) {
            let previousPlayers = [];
            const cacheKey = `${config.guild_id}_${clanTag}_war`;
            
            if (config.war_leaderboard_cached_data) {
                try {
                    const cachedData = JSON.parse(config.war_leaderboard_cached_data);
                    if (cachedData[cacheKey]) {
                        previousPlayers = cachedData[cacheKey].players || [];
                    }
                } catch (error) {
                    console.warn('Failed to parse previous clan war data:', error);
                }
            }
            
            clanData.players = await ClashOfClansAPI.enhancePlayersWithActivity(clanData.players, previousPlayers);
        }

        return clanData;
    }

    /**
     * Original leaderboard page generation (for backward compatibility)
     * @param {Interaction} interaction 
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Page number to generate
     * @param {boolean} forceRefresh - Whether to force data refresh
     * @param {string} view - View type (donations or war)
     */
    async generateOriginalLeaderboardPage(interaction, config, page, forceRefresh = false, view = 'donations') {
        try {
            // Get data based on view type (original combined method)
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
            await this.updatePageState(interaction.guildId, page, totalPages);

            // Generate canvas image
            const canvas = new LeaderboardCanvas();
            const canvasBuffer = view === 'war'
                ? await canvas.generateWarLeaderboard(pageData, config, page, totalPages, leaderboardData)
                : await canvas.generateLeaderboard(pageData, config, page, totalPages);

            // Create buttons (without clan tag for combined view)
            const isAdmin = LeaderboardButtons.hasAdminPermission(interaction.member);
            const buttonRow = LeaderboardButtons.createButtonRow({
                currentPage: page,
                totalPages,
                isAdmin,
                guildId: interaction.guildId,
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

            // Check if interaction is still valid before editing
            if (interaction.deferred || interaction.replied) {
                try {
                    await interaction.editReply(updateData);
                } catch (editError) {
                    console.error('Failed to edit reply (interaction may be expired):', {
                        error: editError.message,
                        code: editError.code,
                        customId: interaction.customId
                    });
                    return;
                }
            } else {
                console.error('Interaction not properly deferred, cannot edit reply');
                return;
            }

        } catch (error) {
            console.error(`Error generating original ${view} leaderboard page:`, error);
            await this.sendError(interaction, `Failed to generate ${view} leaderboard`);
        }
    }

    async updatePageState(guildId, currentPage, totalPages, clanTag = null) {
        if (clanTag) {
            // Update page state for specific clan
            await this.db.execute(
                'UPDATE guild_clashofclans_watch SET donation_leaderboard_current_page = ?, donation_leaderboard_total_pages = ? WHERE guild_id = ? AND clan_tag = ?',
                [currentPage, totalPages, guildId, clanTag]
            );
        } else {
            // Update page state for all clans in guild (legacy behavior)
            await this.db.execute(
                'UPDATE guild_clashofclans_watch SET donation_leaderboard_current_page = ?, donation_leaderboard_total_pages = ? WHERE guild_id = ?',
                [currentPage, totalPages, guildId]
            );
        }
    }

    async clearCachedData(guildId, view = 'donations', clanTag = null) {
        const column = view === 'war' ? 'war_leaderboard_cached_data' : 'donation_leaderboard_cached_data';
        if (clanTag) {
            // Clear cache for specific clan
            await this.db.execute(
                `UPDATE guild_clashofclans_watch SET ${column} = NULL WHERE guild_id = ? AND clan_tag = ?`,
                [guildId, clanTag]
            );
        } else {
            // Clear cache for all clans in guild (legacy behavior)
            await this.db.execute(
                `UPDATE guild_clashofclans_watch SET ${column} = NULL WHERE guild_id = ?`,
                [guildId]
            );
        }
    }

    async getDonationData(config, forceRefresh = false) {
        // Check cache first (unless force refresh)
        if (!forceRefresh && config.donation_leaderboard_cached_data) {
            try {
                const cached = JSON.parse(config.donation_leaderboard_cached_data);
                const cacheAge = Date.now() - new Date(cached.last_fetched).getTime();
                
                // Use cache if less than 30 minutes old
                if (cacheAge < 30 * 60 * 1000) {
                    // Even for cached data, enhance with activity tracking to ensure lastSeen is populated
                    if (cached.players && cached.players.length > 0) {
                        
                        // Always enhance cached data to ensure lastSeen is populated
                        // Use empty array to force generation of lastSeen for all players
                        cached.players = await ClashOfClansAPI.enhancePlayersWithActivity(
                            cached.players, 
                            [] // Empty array forces generation of lastSeen values
                        );
                        
                    }
                    return cached;
                }
            } catch (error) {
                console.warn('Failed to parse cached data:', error);
            }
        }

        // Fetch fresh data from CoC API
        try {
            const freshData = await ClashOfClansAPI.getClanDonationData(
                config.clashofclans_clans || config.clans,
                config.donation_leaderboard_time_range
            );

            // Enhance top players with real last seen data (limited to top 10 to avoid rate limits)
            if (freshData && freshData.players && freshData.players.length > 0) {
                
                // Get previous player data for comparison
                let previousPlayers = [];
                if (config.donation_leaderboard_cached_data) {
                    try {
                        const cachedData = JSON.parse(config.donation_leaderboard_cached_data);
                        previousPlayers = cachedData.players || [];
                    } catch (error) {
                        console.warn('Failed to parse previous player data:', error);
                    }
                }
                
                freshData.players = await ClashOfClansAPI.enhancePlayersWithActivity(
                    freshData.players, 
                    previousPlayers
                );
            }

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
                    // Even for cached data, enhance with activity tracking to ensure lastSeen is populated
                    if (cached.players && cached.players.length > 0) {
                        
                        // Always enhance cached data to ensure lastSeen is populated
                        // Use empty array to force generation of lastSeen for all players
                        cached.players = await ClashOfClansAPI.enhancePlayersWithActivity(
                            cached.players, 
                            [] // Empty array forces generation of lastSeen values
                        );
                        
                    }
                    return cached;
                }
            } catch (error) {
                console.warn('Failed to parse cached war data:', error);
            }
        }

        // Fetch fresh data from CoC API
        try {
            const cocApi = ClashOfClansAPI;
            const freshData = await cocApi.getClanWarStats(config.clashofclans_clans || config.clans);

            // Enhance top players with real last seen data (limited to top 10 to avoid rate limits)
            if (freshData && freshData.players && freshData.players.length > 0) {
                
                // Get previous player data for comparison
                let previousPlayers = [];
                if (config.war_leaderboard_cached_data) {
                    try {
                        const cachedData = JSON.parse(config.war_leaderboard_cached_data);
                        previousPlayers = cachedData.players || [];
                    } catch (error) {
                        console.warn('Failed to parse previous war player data:', error);
                    }
                }
                
                freshData.players = await ClashOfClansAPI.enhancePlayersWithActivity(
                    freshData.players, 
                    previousPlayers
                );
            }

            // Cache the fresh data
            if (freshData) {
                await this.db.execute(
                    'UPDATE guild_clashofclans_watch SET war_leaderboard_cached_data = ?, war_leaderboard_last_update = CURRENT_TIMESTAMP WHERE guild_id = ?',
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
        // Check if interaction is still valid before editing
        if (!interaction.deferred && !interaction.replied) {
            console.error('Cannot update with loading: interaction not properly deferred');
            return;
        }

        const loadingButtons = LeaderboardButtons.createLoadingButtonRow(interaction.guildId, view);
        
        try {
            await interaction.editReply({
                content: `⏳ ${message}`,
                embeds: [],
                files: [],
                components: [loadingButtons]
            });
        } catch (editError) {
            console.error('Failed to update with loading message (interaction may be expired):', {
                error: editError.message,
                code: editError.code,
                customId: interaction.customId
            });
        }
    }

    async sendError(interaction, message, view = 'donations', clanTag = null) {
        // Check if interaction is still valid before trying to send error
        if (!interaction.deferred && !interaction.replied) {
            console.error('Cannot send error: interaction not properly deferred');
            return;
        }

        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(message)
            .setColor('#e74c3c');

        const errorButtons = LeaderboardButtons.createErrorButtonRow(interaction.guildId, view, clanTag);

        try {
            await interaction.editReply({
                content: null,
                embeds: [errorEmbed],
                files: [],
                components: [errorButtons]
            });
        } catch (editError) {
            console.error('Failed to send error message (interaction may be expired):', {
                error: editError.message,
                code: editError.code,
                customId: interaction.customId
            });
            // Don't throw - just log the error since we can't recover
        }
    }
}

module.exports = LeaderboardInteractionHandler;