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
            clanTag = '', // NEW: Support clan-specific buttons
            view = 'page', // 'page' | 'summary'
            dataView = 'donations', // 'donations' | 'war'
            showToggle = false // NEW: Control whether to show the view toggle button
        } = options;

        const buttons = [];

        // Create clan-specific button ID suffix if clan tag is provided
        const clanSuffix = clanTag ? `_${this.encodeClanTag(clanTag)}` : '';

        // Refresh button - always available
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`leaderboard_refresh_${dataView}_${guildId}${clanSuffix}`)
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
                    .setCustomId(`leaderboard_toggle_view_${currentPage}_${dataView}_${guildId}${clanSuffix}`)
                    .setLabel(toggleLabel)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(toggleEmoji)
            );
        }

        // Edit button - admin only
        if (isAdmin) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_edit_${dataView}_${guildId}${clanSuffix}`)
                    .setLabel('Edit')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✏️')
            );
        }

        if (view === 'page') {
            // Previous page button - disabled state version when needed to keep button positions consistent
            if (totalPages > 1) {
                const prevButton = new ButtonBuilder()
                    .setCustomId(`leaderboard_prev_${currentPage}_${dataView}_${guildId}${clanSuffix}`)
                    .setLabel('Prev')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('◀️');
                if (currentPage <= 1) prevButton.setDisabled(true);
                buttons.push(prevButton);

                const nextButton = new ButtonBuilder()
                    .setCustomId(`leaderboard_next_${currentPage}_${dataView}_${guildId}${clanSuffix}`)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('▶️');
                if (currentPage >= totalPages) nextButton.setDisabled(true);
                buttons.push(nextButton);
            }

            // Summary button (always available on page view)
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_summary_${currentPage}_${dataView}_${guildId}${clanSuffix}`)
                    .setLabel('Summary')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📈')
            );
        } else if (view === 'summary') {
            // Back button to return to page view
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`leaderboard_back_${currentPage}_${dataView}_${guildId}${clanSuffix}`)
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
        const originalParts = customId.split('_');
        if (originalParts[0] !== 'leaderboard') return null;
        
        let parts = [...originalParts]; // Create a copy
        const action = parts[1];
        let currentPage, view, guildId, clanTag;

        // Check if this is a clan-specific button (has 'clan' as second-to-last part)
        const hasClanTag = parts.length >= 2 && parts[parts.length - 2] === 'clan';
        if (hasClanTag) {
            // The clan tag is the last part, reconstruct it with #
            clanTag = `#${parts[parts.length - 1]}`;
            parts = parts.slice(0, -2); // Remove 'clan' and the clan tag parts
        }

        if (action === 'toggle' && parts[2] === 'view') {
            // Format: leaderboard_toggle_view_<page>_<dataView>_<guildId>[_<encodedClanTag>]
            currentPage = parseInt(parts[3], 10);
            view = parts[4]; // current data view (donations/war)
            guildId = parts.slice(5).join('_');
            return { action: 'toggle_view', guildId, currentPage, view, clanTag };
        } else if (['prev','next','summary','back'].includes(action)) {
            // Format: leaderboard_<action>_<page>_<dataView>_<guildId>[_<encodedClanTag>]
            currentPage = parseInt(parts[2], 10);
            view = parts[3]; // current data view (donations/war)
            guildId = parts.slice(4).join('_');
            return { action, guildId, currentPage, view, clanTag };
        } else {
            // Format: leaderboard_<action>_<dataView>_<guildId>[_<encodedClanTag>] (refresh, edit)
            view = parts[2]; // current data view (donations/war)
            guildId = parts.slice(3).join('_');
            return { action, guildId, view, clanTag };
        }
    }

    /**
     * Encode clan tag for use in button IDs (remove # and special characters)
     * @param {string} clanTag - Original clan tag (e.g., "#ABC123")
     * @returns {string} Encoded clan tag (e.g., "clan_ABC123")
     */
    static encodeClanTag(clanTag) {
        if (!clanTag) return '';
        return `clan_${clanTag.replace('#', '').replace(/[^A-Z0-9]/gi, '')}`;
    }

    /**
     * Decode clan tag from button ID back to original format
     * @param {string} encodedClanTag - Encoded clan tag (e.g., "clan_ABC123")
     * @returns {string} Original clan tag (e.g., "#ABC123")
     */
    static decodeClanTag(encodedClanTag) {
        if (!encodedClanTag || !encodedClanTag.startsWith('clan_')) return null;
        return `#${encodedClanTag.substring(5)}`;
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
     * @param {string} clanTag - Optional clan tag for clan-specific buttons
     * @returns {ActionRowBuilder} Error state button row
     */
    static createErrorButtonRow(guildId, dataView = 'donations', clanTag = '') {
        const actionRow = new ActionRowBuilder();
        const clanSuffix = clanTag ? `_${this.encodeClanTag(clanTag)}` : '';
        
        // Disabled refresh button
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`leaderboard_refresh_${dataView}_${guildId}${clanSuffix}`)
                .setLabel('Refresh')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄')
                .setDisabled(true)
        );

        return actionRow;
    }

    /**
     * Create a loading state button row
     * @param {string} guildId - Guild ID
     * @param {string} dataView - Current data view (donations/war)
     * @param {string} clanTag - Optional clan tag for clan-specific buttons
     */
    static createLoadingButtonRow(guildId, dataView = 'donations', clanTag = '') {
        const actionRow = new ActionRowBuilder();
        const clanSuffix = clanTag ? `_${this.encodeClanTag(clanTag)}` : '';
        
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`leaderboard_loading_${dataView}_${guildId}${clanSuffix}`)
                .setLabel('Loading...')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏳')
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
}

module.exports = LeaderboardButtons;