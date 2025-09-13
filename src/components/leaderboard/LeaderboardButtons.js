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
            guildId = ''
        } = options;

        const buttons = [];

        // Refresh button - always available
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`leaderboard_refresh_${guildId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄')
        );

        // Edit button - admin only
        if (isAdmin) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_edit_${guildId}`)
                    .setLabel('✏️ Edit')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️')
            );
        }

        // Previous page button - only if not on first page and multiple pages
        if (currentPage > 1 && totalPages > 1) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_prev_${guildId}`)
                    .setLabel('◀️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('◀️')
            );
        }

        // Next page button - only if not on last page and multiple pages
        if (currentPage < totalPages && totalPages > 1) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_next_${guildId}`)
                    .setLabel('▶️ Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('▶️')
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
        if (parts.length < 3 || parts[0] !== 'leaderboard') {
            return null;
        }

        return {
            action: parts[1], // refresh, edit, prev, next
            guildId: parts.slice(2).join('_') // Rejoin in case guild ID contains underscores
        };
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
     * @returns {ActionRowBuilder} Error state button row
     */
    static createErrorButtonRow(guildId) {
        const actionRow = new ActionRowBuilder();
        
        // Disabled refresh button
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`leaderboard_refresh_${guildId}`)
                .setLabel('🔄 Refresh')
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
            next: '▶️'
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
            next: ButtonStyle.Secondary
        };
        return styles[action] || ButtonStyle.Secondary;
    }
}

module.exports = LeaderboardButtons;