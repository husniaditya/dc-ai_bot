const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Creates and manages Discord button components for leaderboard interactions
 */
class LeaderboardButtons {
    /**
     * Create a button row for leaderboard interactions
     * @param {Object} options - Button configuration options
     * @returns {ActionRowBuilder} Discord action row with buttons
     */
    static createButtonRow(options = {}) {
        const {
            currentPage = 1,
            totalPages = 1,
            isAdmin = false,
            guildId = '',
            view = 'page', // 'page' | 'summary'
            dataView = 'donations', // 'donations' | 'war'
            showToggle = false // NEW: Control whether to show the view toggle button
        } = options;

        const buttons = [];

        // Refresh button - always available
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`leaderboard_refresh_${dataView}_${guildId}`)
                .setLabel('Refresh')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄')
        );

        // View toggle button - switch between donations and war (only if enabled)
        if (showToggle) {
            const toggleView = dataView === 'donations' ? 'war' : 'donations';
            const toggleEmoji = dataView === 'donations' ? '⚔️' : '📊';
            const toggleLabel = dataView === 'donations' ? 'War Stats' : 'Donations';
            
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_toggle_view_${currentPage}_${dataView}_${guildId}`)
                    .setLabel(toggleLabel)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(toggleEmoji)
            );
        }

        // Edit button - admin only
        if (isAdmin) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_edit_${dataView}_${guildId}`)
                    .setLabel('Edit')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✏️')
            );
        }

        if (view === 'page') {
            // Previous page button - disabled state version when needed to keep button positions consistent
            if (totalPages > 1) {
                const prevButton = new ButtonBuilder()
                    .setCustomId(`leaderboard_prev_${currentPage}_${dataView}_${guildId}`)
                    .setLabel('Prev')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('◀️');
                if (currentPage <= 1) prevButton.setDisabled(true);
                buttons.push(prevButton);

                const nextButton = new ButtonBuilder()
                    .setCustomId(`leaderboard_next_${currentPage}_${dataView}_${guildId}`)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('▶️');
                if (currentPage >= totalPages) nextButton.setDisabled(true);
                buttons.push(nextButton);
            }

            // Summary button (always available on page view)
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_summary_${currentPage}_${dataView}_${guildId}`)
                    .setLabel('Summary')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📈')
            );
        } else if (view === 'summary') {
            // Back button to return to page view
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_back_${currentPage}_${dataView}_${guildId}`)
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔙')
            );
        }

        // Create action row
        const actionRow = new ActionRowBuilder();
        buttons.forEach(button => actionRow.addComponents(button));
        return actionRow;
    }

    /**
     * Create page indicator text for embed description
     * @param {number} currentPage - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {number} totalPlayers - Total number of players
     * @returns {string} Page indicator text
     */
    static createPageIndicator(currentPage, totalPages, totalPlayers) {
        if (totalPages <= 1) {
            return `📊 Showing all ${totalPlayers} players`;
        }
        return `📄 Page ${currentPage} of ${totalPages} • ${totalPlayers} total players`;
    }

    /**
     * Parse button interaction custom ID
     * @param {string} customId - Button custom ID
     * @returns {Object} Parsed interaction data
     */
    static parseButtonId(customId) {
        const parts = customId.split('_');
        if (parts[0] !== 'leaderboard') return null;
        
        const action = parts[1];
        let currentPage, view, guildId;

        if (action === 'toggle' && parts[2] === 'view') {
            // Format: leaderboard_toggle_view_<page>_<dataView>_<guildId>
            currentPage = parseInt(parts[3], 10);
            view = parts[4]; // current data view (donations/war)
            guildId = parts.slice(5).join('_');
            return { action: 'toggle_view', guildId, currentPage, view };
        } else if (['prev','next','summary','back'].includes(action)) {
            // Format: leaderboard_<action>_<page>_<dataView>_<guildId>
            currentPage = parseInt(parts[2], 10);
            view = parts[3]; // current data view (donations/war)
            guildId = parts.slice(4).join('_');
            return { action, guildId, currentPage, view };
        } else {
            // Format: leaderboard_<action>_<dataView>_<guildId> (refresh, edit)
            view = parts[2]; // current data view (donations/war)
            guildId = parts.slice(3).join('_');
            return { action, guildId, view };
        }
    }

    /**
     * Extended parser used by interaction handler (alias for parseButtonId for clarity)
     */
    static parseButtonInteraction(customId) {
        return this.parseButtonId(customId);
    }

    /**
     * Check if user has admin permissions for leaderboard management
     * @param {GuildMember} member - Discord guild member
     * @returns {boolean} Whether user has admin permissions
     */
    static hasAdminPermission(member) {
        if (!member) return false;
        
        // Check for administrator permission
        if (member.permissions.has('Administrator')) {
            return true;
        }

        // Check for manage server permission
        if (member.permissions.has('ManageGuild')) {
            return true;
        }

        // Check for manage messages permission (for message management)
        if (member.permissions.has('ManageMessages')) {
            return true;
        }

        return false;
    }

    /**
     * Validate button interaction
     * @param {ButtonInteraction} interaction - Discord button interaction
     * @returns {Object} Validation result
     */
    static validateInteraction(interaction) {
        if (!interaction.isButton()) {
            return { valid: false, error: 'Not a button interaction' };
        }

        const parsedId = this.parseButtonId(interaction.customId);
        if (!parsedId) {
            return { valid: false, error: 'Invalid button ID format' };
        }

        if (parsedId.guildId !== interaction.guildId) {
            return { valid: false, error: 'Guild ID mismatch' };
        }

        // For admin actions, check permissions
        if (parsedId.action === 'edit' && !this.hasAdminPermission(interaction.member)) {
            return { valid: false, error: 'Insufficient permissions' };
        }

        return { valid: true, data: parsedId };
    }

    /**
     * Create error button row (disabled buttons)
     * @param {string} guildId - Guild ID
     * @param {string} dataView - Current data view (donations/war)
     * @returns {ActionRowBuilder} Error state button row
     */
    static createErrorButtonRow(guildId, dataView = 'donations') {
        const actionRow = new ActionRowBuilder();
        
        // Disabled refresh button
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`leaderboard_refresh_${dataView}_${guildId}`)
                .setLabel('Refresh')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄')
                .setDisabled(true)
        );

        return actionRow;
    }

    /**
     * Get button emoji for action type
     * @param {string} action - Button action
     * @returns {string} Emoji character
     */
    static getButtonEmoji(action) {
        const emojis = {
            refresh: '🔄',
            edit: '✏️',
            prev: '◀️',
            next: '▶️',
            summary: '📈',
            back: '🔙'
        };
        return emojis[action] || '❓';
    }

    /**
     * Get button style for action type
     * @param {string} action - Button action
     * @returns {ButtonStyle} Discord button style
     */
    static getButtonStyle(action) {
        const styles = {
            refresh: ButtonStyle.Secondary,
            edit: ButtonStyle.Primary,
            prev: ButtonStyle.Secondary,
            next: ButtonStyle.Secondary,
            summary: ButtonStyle.Secondary,
            back: ButtonStyle.Secondary
        };
        return styles[action] || ButtonStyle.Secondary;
    }

    /**
     * Create a loading state button row
     * @param {string} guildId - Guild ID
     * @param {string} dataView - Current data view (donations/war)
     */
    static createLoadingButtonRow(guildId, dataView = 'donations') {
        const actionRow = new ActionRowBuilder();
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`leaderboard_loading_${dataView}_${guildId}`)
                .setLabel('Loading...')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏳')
                .setDisabled(true)
        );
        return actionRow;
    }
}

module.exports = LeaderboardButtons;