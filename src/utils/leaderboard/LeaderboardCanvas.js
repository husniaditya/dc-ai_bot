const { createCanvas, loadImage } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

class LeaderboardCanvas {
    constructor() {
        // Canvas dimensions
        this.width = 1800; // Significantly increased from 1400 for bigger table
        this.minHeight = 900; // Increased from 700 for larger tables
        
        // Color theme
        this.backgroundColor = '#2c2f33';
        this.primaryColor = '#7289da';
        this.secondaryColor = '#99aab5';
        this.textColor = '#ffffff';
        this.accentColor = '#43b581';
        
        // Layout constants - optimized to fill full canvas width
        this.padding = 40; // Reduced padding for more table space
        this.headerHeight = 160; // Increased from 140 for larger fonts
        this.playerRowHeight = 95; // Increased from 85 for larger fonts
        // this.avatarSize = 60; // Removed - no longer using avatars
        this.townHallSize = 57; // Size for town hall images - increased from 24
        this.rankWidth = 140; // Expanded rank column
        
        // Donation leaderboard specific layout constants
        this.donationNameWidth = 450; // Player name column for donation leaderboard
        this.donationRoleWidth = 200; // Role column for donation leaderboard
        this.donationWidth = 200; // Expanded donated column
        this.receivedWidth = 200; // Expanded received column
        this.ratioWidth = 180; // Expanded ratio column
        this.lastOnlineWidth = 300; // Significantly expanded last online column
        this.footerHeight = 100; // Increased from 80
        
        // War leaderboard specific layout constants
        this.warNameWidth = 450; // Player name column for war leaderboard - expanded for better readability
        this.warRoleWidth = 220; // Role column for war leaderboard - expanded for better readability
        this.warAttackWidth = 380; // Width for war attack details column - increased for better star spacing
        this.warAvgStarsWidth = 140; // Width for average stars column - more compact
        this.warWinRateWidth = 100; // Width for win rate column - more compact for percentage
        this.warParticipationWidth = 180; // Width for wars participated column - more compact for numbers
        
        // Legacy compatibility (will be deprecated)
        this.nameWidth = this.donationNameWidth; // Default to donation leaderboard sizing
        this.roleWidth = this.donationRoleWidth; // Default to donation leaderboard sizing
        
        // Font settings - significantly increased for maximum readability
        this.titleFont = 'bold 48px Arial'; // Increased from 40px
        this.headerFont = 'bold 38px Arial'; // Increased from 32px
        this.playerFont = '34px Arial'; // Increased from 28px
        this.donationFont = 'bold 34px Arial'; // Increased from 28px
        
        // Town hall images cache
        this.townHallImages = new Map();
        
        // Medal images cache for donation leaderboard
        this.medalImages = new Map();
        
        // Star images cache for war leaderboard
        this.starImages = new Map();
    }

    /**
     * Convert Clash of Clans API time format to JavaScript Date
     * @param {string} cocTimeString - Time string in format "20250921T092450.000Z"
     * @returns {Date} Parsed Date object
     */
    parseClashTime(cocTimeString) {
        if (!cocTimeString) return null;
        
        // Convert CoC format "20250921T092450.000Z" to ISO format "2025-09-21T09:24:50.000Z"
        const formattedTimeString = cocTimeString.replace(
            /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/,
            '$1-$2-$3T$4:$5:$6.$7Z'
        );
        
        return new Date(formattedTimeString);
    }

    /**
     * Generate leaderboard canvas image
     * @param {Array} players - Array of player data
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Current page number
     * @param {number} totalPages - Total number of pages
     * @returns {Buffer} Canvas image buffer
     */
    async generateLeaderboard(players, config, page = 1, totalPages = 1) {
        try {
            // Calculate dynamic height based on player count
            const tableHeaderHeight = 40; // Updated to match drawTableHeaders height
            const spacingHeight = 30;
            const dynamicHeight = this.padding * 2 + // Top and bottom padding
                                 this.headerHeight + // Header section
                                 spacingHeight + // Space after header
                                 tableHeaderHeight + // Table header
                                 (players.length * this.playerRowHeight) + // Player rows
                                 this.footerHeight; // Footer

            const canvasHeight = Math.max(this.minHeight, dynamicHeight);
            
            // Create canvas with dynamic height
            const canvas = createCanvas(this.width, canvasHeight);
            const ctx = canvas.getContext('2d');

            // Generate random background gradient colors if specified
            if (config.canvas_generate_random_color) {
                this.generateRandomColors();
            }

            // Draw background
            await this.drawBackground(ctx, canvasHeight);
            
            // Draw header
            await this.drawHeader(ctx, config, page, totalPages);
            
            // Draw player list
            await this.drawPlayerList(ctx, players, config);
            
            // Draw footer with pagination info
            await this.drawFooter(ctx, page, totalPages, canvasHeight);

            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error('Error generating leaderboard canvas:', error);
            throw error;
        }
    }

    /**
     * Generate war statistics leaderboard canvas image
     * @param {Array} players - Array of player war statistics data
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {Object} warData - Additional war data (current war, clan info)
     * @param {string} warState - War state (preparation, inWar, ended)
     * @returns {Buffer} Canvas image buffer
     */
    async generateWarLeaderboard(players, config, page = 1, totalPages = 1, warData = {}, warState = 'ended') {
        try {
            // Determine which canvas type to generate based on war state
            switch (warState) {
                case 'preparation':
                    return await this.generatePreparingWarCanvas(players, config, page, totalPages, warData);
                case 'inWar':
                    return await this.generateActiveWarCanvas(players, config, page, totalPages, warData);
                case 'ended':
                case 'warEnded':
                case 'notInWar':
                default:
                    return await this.generateHistoricalWarCanvas(players, config, page, totalPages, warData);
            }
        } catch (error) {
            console.error('Error generating war leaderboard canvas:', error);
            throw error;
        }
    }

    /**
     * Generate preparing war canvas (war in preparation state)
     * @param {Array} players - Array of player war statistics data
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {Object} warData - War data including current war info
     * @returns {Buffer} Canvas image buffer
     */
    async generatePreparingWarCanvas(players, config, page = 1, totalPages = 1, warData = {}) {
        try {
            // Sort players by current war position only (lowest to highest - war map order)
            const sortedPlayers = [...players].sort((a, b) => {
                const warPosA = parseInt(a.currentWarPosition) || Number.MAX_SAFE_INTEGER;
                const warPosB = parseInt(b.currentWarPosition) || Number.MAX_SAFE_INTEGER;
                
                return warPosA - warPosB;
            });

            // Update ranks based on new sorting order and pagination
            const playersPerPage = config.donation_leaderboard_players_per_page || 25;
            sortedPlayers.forEach((player, index) => {
                player.rank = (page - 1) * playersPerPage + index + 1;
            });

            // Calculate required height - use sorted players
            const playersToShow = sortedPlayers; // Show sorted players
            const requiredHeight = this.padding + this.headerHeight + 100 + (playersToShow.length * this.playerRowHeight) + this.footerHeight + this.padding;
            const canvasHeight = Math.max(this.minHeight, requiredHeight);

            // Create canvas
            const canvas = createCanvas(this.width, canvasHeight);
            const ctx = canvas.getContext('2d');

            // Generate random background gradient colors if specified
            if (config.canvas_generate_random_color) {
                this.generateRandomColors();
            }

            // Draw background
            await this.drawBackground(ctx, canvasHeight);

            // Draw preparing war header
            await this.drawPreparingWarHeader(ctx, config, page, totalPages, warData);

            // Draw preparation war info section
            const infoSectionY = this.padding + this.headerHeight + 20;
            await this.drawPreparationWarInfo(ctx, warData, infoSectionY);

            // Draw table headers
            const tableStartY = this.padding + this.headerHeight + 100;
            await this.drawWarTableHeaders(ctx, tableStartY);

            // Draw war player list (preparing state)
            await this.drawPreparingWarPlayerList(ctx, playersToShow, config, tableStartY);

            // Draw footer
            await this.drawFooter(ctx, page, totalPages, canvasHeight);

            return canvas.toBuffer('image/png');

        } catch (error) {
            console.error('Error generating preparing war canvas:', error);
            throw error;
        }
    }

    /**
     * Generate active war canvas (war currently in progress)
     * @param {Array} players - Array of player war statistics data
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {Object} warData - War data including current war info
     * @returns {Buffer} Canvas image buffer
     */
    async generateActiveWarCanvas(players, config, page = 1, totalPages = 1, warData = {}) {
        try {
            // Sort players by current war position only (lowest to highest - war map order)
            const sortedPlayers = [...players].sort((a, b) => {
                const warPosA = parseInt(a.currentWarPosition) || Number.MAX_SAFE_INTEGER;
                const warPosB = parseInt(b.currentWarPosition) || Number.MAX_SAFE_INTEGER;
                
                return warPosA - warPosB;
            });

            // Update ranks based on new sorting order and pagination
            const playersPerPage = config.donation_leaderboard_players_per_page || 25;
            sortedPlayers.forEach((player, index) => {
                player.rank = (page - 1) * playersPerPage + index + 1;
            });

            // Calculate required height - use sorted players
            const playersToShow = sortedPlayers; // Show sorted players
            const requiredHeight = this.padding + this.headerHeight + 100 + (playersToShow.length * this.playerRowHeight) + this.footerHeight + this.padding;
            const canvasHeight = Math.max(this.minHeight, requiredHeight);

            // Create canvas
            const canvas = createCanvas(this.width, canvasHeight);
            const ctx = canvas.getContext('2d');

            // Generate random background gradient colors if specified
            if (config.canvas_generate_random_color) {
                this.generateRandomColors();
            }

            // Draw background
            await this.drawBackground(ctx, canvasHeight);

            // Draw active war header
            await this.drawActiveWarHeader(ctx, config, page, totalPages, warData);

            // Draw active war info section (scores, remaining time, etc.)
            const infoSectionY = this.padding + this.headerHeight + 20;
            await this.drawActiveWarInfo(ctx, warData, infoSectionY);

            // Draw table headers
            const tableStartY = this.padding + this.headerHeight + 100;
            await this.drawWarTableHeaders(ctx, tableStartY);

            // Draw war player list (active state with current attacks)
            await this.drawActiveWarPlayerList(ctx, playersToShow, config, tableStartY);

            // Draw footer
            await this.drawFooter(ctx, page, totalPages, canvasHeight);

            return canvas.toBuffer('image/png');

        } catch (error) {
            console.error('Error generating active war canvas:', error);
            throw error;
        }
    }

    /**
     * Generate historical war canvas (completed wars)
     * @param {Array} players - Array of player war statistics data
     * @param {Object} config - Leaderboard configuration
     * @param {number} page - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {Object} warData - War data including historical data
     * @returns {Buffer} Canvas image buffer
     */
    async generateHistoricalWarCanvas(players, config, page = 1, totalPages = 1, warData = {}) {
        try {
            // Sort players by current war position only (lowest to highest - war map order)
            const sortedPlayers = [...players].sort((a, b) => {
                const warPosA = parseInt(a.currentWarPosition) || Number.MAX_SAFE_INTEGER;
                const warPosB = parseInt(b.currentWarPosition) || Number.MAX_SAFE_INTEGER;
                
                return warPosA - warPosB;
            });

            // Update ranks based on new sorting order and pagination
            const playersPerPage = config.donation_leaderboard_players_per_page || 25;
            sortedPlayers.forEach((player, index) => {
                player.rank = (page - 1) * playersPerPage + index + 1;
            });

            // Calculate dynamic height based on player count
            const tableHeaderHeight = 40; // Updated to match drawTableHeaders height
            const spacingHeight = 30;
            const dynamicHeight = this.padding * 2 + // Top and bottom padding
                                 this.headerHeight + // Header section
                                 spacingHeight + // Space after header
                                 tableHeaderHeight + // Table header
                                 (sortedPlayers.length * this.playerRowHeight) + // Player rows
                                 this.footerHeight; // Footer

            const canvasHeight = Math.max(this.minHeight, dynamicHeight);
            
            // Create canvas with dynamic height
            const canvas = createCanvas(this.width, canvasHeight);
            const ctx = canvas.getContext('2d');

            // Generate random background gradient colors if specified
            if (config.canvas_generate_random_color) {
                this.generateRandomColors();
            }

            // Draw background
            await this.drawBackground(ctx, canvasHeight);
            
            // Draw header (war themed)
            await this.drawHistoricalWarHeader(ctx, config, page, totalPages, warData);
            
            // Draw war player list with sorted players
            await this.drawWarPlayerList(ctx, sortedPlayers, config);
            
            // Draw footer with pagination info
            await this.drawFooter(ctx, page, totalPages, canvasHeight);

            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error('Error generating historical war canvas:', error);
            throw error;
        }
    }

    /**
     * Generate random colors for the canvas
     */
    generateRandomColors() {
        const colors = [
            ['#667eea', '#764ba2'], // Purple gradient
            ['#f093fb', '#f5576c'], // Pink gradient
            ['#4facfe', '#00f2fe'], // Blue gradient
            ['#43e97b', '#38f9d7'], // Green gradient
            ['#fa709a', '#fee140'], // Sunset gradient
            ['#a8edea', '#fed6e3'], // Soft gradient
            ['#ff9a9e', '#fecfef'], // Rose gradient
            ['#667eea', '#764ba2'], // Violet gradient
        ];

        const selectedGradient = colors[Math.floor(Math.random() * colors.length)];
        this.primaryColor = selectedGradient[0];
        this.accentColor = selectedGradient[1];
    }

    /**
     * Draw the background with gradient
     */
    async drawBackground(ctx, height) {
        // Use solid background instead of gradient to prevent any interference
        ctx.fillStyle = this.backgroundColor; // Solid color instead of gradient
        ctx.fillRect(0, 0, this.width, height);
    }

    /**
     * Draw the header section
     */
    async drawHeader(ctx, config, page, totalPages) {
        const headerY = this.padding;
        
        // Draw header background
        const headerGradient = ctx.createLinearGradient(0, headerY, this.width, headerY + this.headerHeight);
        headerGradient.addColorStop(0, this.primaryColor);
        headerGradient.addColorStop(1, this.accentColor);
        
        ctx.fillStyle = headerGradient;
        ctx.fillRect(this.padding, headerY, this.width - (this.padding * 2), this.headerHeight);

        // Add rounded corners effect
        ctx.beginPath();
        ctx.roundRect(this.padding, headerY, this.width - (this.padding * 2), this.headerHeight, 15);
        ctx.fill();

        // Draw title
        ctx.fillStyle = this.textColor;
        ctx.font = this.titleFont;
        ctx.textAlign = 'center';
        
        const title = `🏆 ${config.clan_name || 'Clan'} Donation Leaderboard`;
        const titleY = headerY + 70; // Moved back to original position
        ctx.fillText(title, this.width / 2, titleY);

        // Draw time range subtitle with much more gap
        ctx.font = this.headerFont;
        const timeRangeText = this.getTimeRangeText(config.time_range);
        const subtitleY = titleY + 60; // Increased from 45 to 60 for much bigger gap
        ctx.fillText(timeRangeText, this.width / 2, subtitleY);

        // Draw page indicator with much bigger font
        if (totalPages > 1) {
            ctx.font = 'bold 24px Arial'; // Increased from 18px to 24px and made bold
            ctx.textAlign = 'right';
            const pageText = `Page ${page} of ${totalPages}`;
            ctx.fillText(pageText, this.width - this.padding - 10, subtitleY);
        }

        // Draw clan tag if available with bigger font
        if (config.clan_tag) {
            ctx.font = '18px Arial'; // Increased from 14px to 18px
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(config.clan_tag, this.padding + 10, subtitleY);
        }
    }

    /**
     * Draw the player list
     */
    async drawPlayerList(ctx, players, config) {
        const startY = this.padding + this.headerHeight + 30;
        const tableHeaderY = startY;
        
        // Draw table headers
        await this.drawTableHeaders(ctx, tableHeaderY);
        
        // Draw players - adjusted spacing for taller header
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const playerY = tableHeaderY + 45 + (i * this.playerRowHeight); // Increased from 40 to 45
            await this.drawPlayerRow(ctx, player, playerY, i);
        }
    }

    /**
     * Draw table headers
     */
    async drawTableHeaders(ctx, y) {
        // Save the current canvas state
        ctx.save();
        
        // Clear any previous fill styles and start fresh
        ctx.fillStyle = '#000000'; // Reset to black first
        
        // Draw header background with completely solid color
        ctx.fillStyle = '#2c2c2c'; // Dark solid color for header
        ctx.fillRect(this.padding, y, this.width - (this.padding * 2), 40);

        // Reset canvas state to ensure clean text rendering
        ctx.restore();
        ctx.save();

        // Header text with fresh styling
        ctx.fillStyle = '#ffffff'; // Pure white text
        ctx.font = this.headerFont;
        ctx.textAlign = 'center';

        // Calculate column positions to match player row layout with better spacing
        let currentX = this.padding;
        
        // Rank header - centered
        ctx.fillText('#', currentX + (this.rankWidth / 2), y + 25); // Adjusted Y position
        currentX += this.rankWidth;
        
        // Player header - centered in the name area
        const playerHeaderX = currentX + (this.donationNameWidth / 2); // Use donation-specific name width
        ctx.fillText('Player', playerHeaderX, y + 25);
        currentX += this.donationNameWidth; // Use donation-specific name width
        
        // Role header - centered
        ctx.fillText('Role', currentX + (this.donationRoleWidth / 2), y + 25);
        currentX += this.donationRoleWidth;
        
        // Donations header
        ctx.fillText('Don', currentX + (this.donationWidth / 2), y + 25);
        currentX += this.donationWidth;
        
        // Received header
        ctx.fillText('Rec', currentX + (this.receivedWidth / 2), y + 25);
        currentX += this.receivedWidth;
        
        // Ratio header
        ctx.fillText('Ratio', currentX + (this.ratioWidth / 2), y + 25);
        currentX += this.ratioWidth;
        
        // Last Online header
        ctx.fillText('Last On', currentX + (this.lastOnlineWidth / 2), y + 25);
        
        // Restore canvas state
        ctx.restore();
    }

    /**
     * Draw individual player row
     */
    async drawPlayerRow(ctx, player, y, index) {
        const isEven = index % 2 === 0;
        
        // Row background
        ctx.fillStyle = isEven ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(this.padding, y, this.width - (this.padding * 2), this.playerRowHeight);

        let currentX = this.padding;

        // Rank - centered better with SVG medals for top 3
        await this.drawRankWithMedal(ctx, player.rank, currentX, y, false); // false = donation leaderboard
        currentX += this.rankWidth;

        // Player name with town hall level (no avatar)
        ctx.fillStyle = this.textColor;
        ctx.font = this.playerFont;
        ctx.textAlign = 'left'; // Change to left align for better layout with TH image
        
        const nameStartX = currentX + 15; // Start position for name area (removed avatar spacing)
        const nameY = y + 52; // Aligned with other elements
        
        // Draw town hall image first
        const thY = y + (this.playerRowHeight - this.townHallSize) / 2; // Center TH image vertically
        const thSpacing = await this.drawTownHallLevel(ctx, player.townHallLevel || 1, nameStartX, thY);
        
        // Draw player name after town hall image
        const nameX = nameStartX + thSpacing;
        
        // Truncate name if too long (account for space taken by TH image)
        let displayName = player.name || 'Unknown Player';
        const maxNameWidth = this.donationNameWidth - thSpacing - 20; // Use donation-specific name width
        ctx.font = this.playerFont;
        let nameWidth = ctx.measureText(displayName).width;
        
        if (nameWidth > maxNameWidth) {
            // Truncate until it fits
            while (nameWidth > maxNameWidth && displayName.length > 3) {
                displayName = displayName.substring(0, displayName.length - 4) + '...';
                nameWidth = ctx.measureText(displayName).width;
            }
        }
        
        ctx.fillText(displayName, nameX, nameY);
        currentX += this.donationNameWidth; // Use donation-specific name width

        // Player role
        ctx.fillStyle = this.getRoleColor(player.role);
        ctx.font = this.playerFont; // Increased font size
        ctx.textAlign = 'center';
        
        const roleText = this.formatRole(player.role);
        ctx.fillText(roleText, currentX + (this.donationRoleWidth / 2), y + 52); // Use donation-specific role width
        currentX += this.donationRoleWidth;

        // Donation count
        ctx.fillStyle = this.accentColor;
        ctx.font = this.donationFont;
        ctx.textAlign = 'center';
        
        const donationCount = this.formatDonationCount(player.donations || 0);
        ctx.fillText(donationCount, currentX + (this.donationWidth / 2), y + 52); // Adjusted from 45 to 52
        currentX += this.donationWidth;

        // Received count
        ctx.fillStyle = '#f39c12'; // Orange color for received
        const receivedCount = this.formatDonationCount(player.donationsReceived || 0);
        ctx.fillText(receivedCount, currentX + (this.receivedWidth / 2), y + 52); // Adjusted from 45 to 52
        currentX += this.receivedWidth;

        // Ratio
        ctx.fillStyle = this.secondaryColor;
        ctx.font = this.playerFont; // Increased font size
        const ratio = this.calculateRatio(player.donations || 0, player.donationsReceived || 0);
        ctx.fillText(ratio, currentX + (this.ratioWidth / 2), y + 52); // Adjusted from 45 to 52
        currentX += this.ratioWidth;

        // Last Online
        ctx.fillStyle = '#95a5a6'; // Gray color for last online
        ctx.font = this.playerFont;
        ctx.textAlign = 'center';
        const lastOnlineText = this.formatLastOnline(player.lastSeen);
        ctx.fillText(lastOnlineText, currentX + (this.lastOnlineWidth / 2), y + 52); // Adjusted from 45 to 52
    }

    /**
     * Draw rank with medal for donation leaderboard or number for war leaderboard
     */
    async drawRankWithMedal(ctx, rank, x, y, isWarLeaderboard = false) {
        const centerX = x + (this.rankWidth / 2);
        const centerY = y + 52; // Aligned with other elements
        
        if (isWarLeaderboard) {
            // War leaderboard: show numbers only
            ctx.fillStyle = this.getRankColor(rank);
            ctx.font = this.donationFont;
            ctx.textAlign = 'center';
            ctx.fillText(rank.toString(), centerX, centerY);
        } else {
            // Donation leaderboard: show SVG medals for top 3, numbers for others
            if (rank <= 3) {
                try {
                    const medalImage = await this.loadMedalImage(rank);
                    if (medalImage) {
                        // Draw SVG medal
                        const medalSize = 50; // Size of the medal
                        const medalX = centerX - medalSize / 2;
                        const medalY = y + (this.playerRowHeight - medalSize) / 2;
                        ctx.drawImage(medalImage, medalX, medalY, medalSize, medalSize);
                        return; // Exit early if medal was drawn successfully
                    }
                } catch (error) {
                    console.warn('Failed to draw medal image:', error);
                }
            }
            
            // Fallback: show text (emoji or number)
            ctx.fillStyle = this.getRankColor(rank);
            ctx.font = this.donationFont;
            ctx.textAlign = 'center';
            const rankText = this.getRankDisplay(rank, false);
            ctx.fillText(rankText, centerX, centerY);
        }
    }

    /**
     * Draw player avatar - COMMENTED OUT (avatars removed from leaderboards)
     */
    /*
    async drawPlayerAvatar(ctx, player, x, y) {
        try {
            // Try to load player avatar if URL provided
            if (player.avatarUrl) {
                const avatar = await loadImage(player.avatarUrl);
                
                // Create circular clipping path
                ctx.save();
                ctx.beginPath();
                ctx.arc(x + this.avatarSize/2, y + this.avatarSize/2, this.avatarSize/2, 0, Math.PI * 2);
                ctx.clip();
                
                // Draw avatar
                ctx.drawImage(avatar, x, y, this.avatarSize, this.avatarSize);
                ctx.restore();
            } else {
                // Fallback: draw placeholder circle with initials
                await this.drawAvatarPlaceholder(ctx, player, x, y);
            }
        } catch (error) {
            // Fallback on error
            await this.drawAvatarPlaceholder(ctx, player, x, y);
        }
    }
    */

    /**
     * Draw avatar placeholder - COMMENTED OUT (avatars removed from leaderboards)
     */
    /*
    async drawAvatarPlaceholder(ctx, player, x, y) {
        // Circle background
        const centerX = x + this.avatarSize / 2;
        const centerY = y + this.avatarSize / 2;
        
        ctx.fillStyle = this.generatePlayerColor(player.name || 'Unknown');
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Player initials
        ctx.fillStyle = this.textColor;
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        
        const name = player.name || 'U';
        const initials = name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
        ctx.fillText(initials, centerX, centerY + 6);
    }
    */

    /**
     * Load star SVG image (filled or empty)
     */
    async loadStarImage(isFilled = true) {
        const starType = isFilled ? 'filled' : 'empty';
        
        if (this.starImages.has(starType)) {
            return this.starImages.get(starType);
        }

        try {
            const starFileName = isFilled ? 'star_fill.svg' : 'star_empty.svg';
            const starPath = path.join(__dirname, '..', '..', 'assets', 'clashofclans', 'stars', starFileName);
            const starImage = await loadImage(starPath);
            this.starImages.set(starType, starImage);
            return starImage;
        } catch (error) {
            console.warn(`Failed to load star image (${starType}):`, error.message);
            return null;
        }
    }

    /**
     * Draw stars for war attacks using SVG images
     */
    async drawStars(ctx, starCount, maxStars, x, y, starSize = 90) {
        const starSpacing = starSize + 6; // Increased gap between stars for larger icons
        
        for (let i = 0; i < maxStars; i++) {
            const starX = x + (i * starSpacing);
            const isFilled = i < starCount;
            
            try {
                const starImage = await this.loadStarImage(isFilled);
                if (starImage) {
                    ctx.drawImage(starImage, starX, y, starSize, starSize);
                } else {
                    // Fallback to text stars if image loading fails
                    ctx.fillStyle = isFilled ? '#f1c40f' : '#555555';
                    ctx.font = `${starSize}px Arial`;
                    ctx.textAlign = 'left';
                    ctx.fillText(isFilled ? '★' : '☆', starX, y + starSize);
                }
            } catch (error) {
                // Fallback to text stars
                ctx.fillStyle = isFilled ? '#f1c40f' : '#555555';
                ctx.font = `${starSize}px Arial`;
                ctx.textAlign = 'left';
                ctx.fillText(isFilled ? '★' : '☆', starX, y + starSize);
            }
        }
        
        return maxStars * starSpacing; // Return total width used
    }

    /**
     * Load medal SVG image for a specific rank
     */
    async loadMedalImage(rank) {
        if (this.medalImages.has(rank)) {
            return this.medalImages.get(rank);
        }

        try {
            let medalFileName;
            if (rank === 1) medalFileName = 'gold_medal.svg';
            else if (rank === 2) medalFileName = 'silver_medal.svg';
            else if (rank === 3) medalFileName = 'bronze_medal.svg';
            else return null; // No medal for ranks > 3
            
            const medalPath = path.join(__dirname, '..', '..', 'assets', 'clashofclans', 'medals', medalFileName);
            const image = await loadImage(medalPath);
            this.medalImages.set(rank, image);
            return image;
        } catch (error) {
            console.warn(`Medal image not found for rank ${rank}, using fallback`);
            return null;
        }
    }

    /**
     * Load town hall image for a specific level
     */
    async loadTownHallImage(level) {
        if (this.townHallImages.has(level)) {
            return this.townHallImages.get(level);
        }

        try {
            const imagePath = path.join(__dirname, '..', '..', 'assets', 'clashofclans', 'townhalls', `th${level}.png`);
            const image = await loadImage(imagePath);
            this.townHallImages.set(level, image);
            return image;
        } catch (error) {
            // console.warn(`Town hall image not found for level ${level}, using fallback`);
            return null;
        }
    }

    /**
     * Draw town hall level image next to player name
     */
    async drawTownHallLevel(ctx, townHallLevel, x, y) {
        try {
            const thImage = await this.loadTownHallImage(townHallLevel);
            if (thImage) {
                ctx.drawImage(thImage, x, y, this.townHallSize, this.townHallSize);
                return this.townHallSize + 8; // Return width used including spacing - increased from 5
            }
        } catch (error) {
            console.warn('Failed to draw town hall image:', error);
        }
        
        // Fallback: draw TH level as text
        ctx.save();
        ctx.fillStyle = '#f39c12'; // Orange color for TH level
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        
        const thText = `TH${townHallLevel}`;
        
        // Draw background circle
        ctx.beginPath();
        ctx.arc(x + this.townHallSize/2, y + this.townHallSize/2, this.townHallSize/2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(243, 156, 18, 0.2)';
        ctx.fill();
        
        // Draw text
        ctx.fillStyle = '#f39c12';
        ctx.fillText(thText, x + this.townHallSize/2, y + this.townHallSize/2 + 5);
        ctx.restore();
        
        return this.townHallSize + 8; // Increased spacing to match image spacing
    }

    /**
     * Draw footer with additional info
     */
    async drawFooter(ctx, page, totalPages, canvasHeight) {
        const footerY = canvasHeight - 60; // Adjusted to accommodate bigger text
        
        // Footer text with much bigger font
        ctx.fillStyle = this.secondaryColor;
        ctx.font = '28px Arial'; // Increased from 16px to 20px
        ctx.textAlign = 'center';
        
        const updateTime = new Date().toLocaleString();
        ctx.fillText(`Last updated: ${updateTime}`, this.width / 2, footerY);
        
        // Navigation hint (only show if there are actually multiple pages) with much bigger font
        if (totalPages > 1) {
            ctx.font = '24px Arial'; // Increased from 14px to 18px
            ctx.fillText('Use buttons below to navigate pages', this.width / 2, footerY + 30); // Increased spacing from 25 to 30
        }
    }

    /**
     * Helper methods
     */
    
    formatLastOnline(lastSeen) {
        if (!lastSeen) {
            return 'Unknown';
        }
        
        try {
            const now = new Date();
            const lastSeenDate = new Date(lastSeen);
            
            // Check if the date is valid
            if (isNaN(lastSeenDate.getTime())) {
                return 'Unknown';
            }
            
            const diffMs = now - lastSeenDate;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            
            // If less than 5 minutes, consider them currently active
            if (diffMinutes < 5) {
                return 'Active';
            } else if (diffMinutes < 60) {
                return `${diffMinutes}m ago`;
            } else if (diffHours < 24) {
                return `${diffHours}h ago`;
            } else if (diffDays === 1) {
                return '1d ago';
            } else if (diffDays < 30) {
                return `${diffDays}d ago`;
            } else {
                return '30+ days ago';
            }
        } catch (error) {
            console.warn('Error formatting last online time:', error);
            return 'Unknown';
        }
    }

    getRankColor(rank) {
        if (rank === 1) return '#ffd700'; // Gold
        if (rank === 2) return '#c0c0c0'; // Silver
        if (rank === 3) return '#cd7f32'; // Bronze
        return this.textColor;
    }

    getRankDisplay(rank, isWarLeaderboard = false) {
        if (isWarLeaderboard) {
            // War leaderboard uses numbers only
            return rank.toString();
        }
        
        // Donation leaderboard uses medal emojis (will be replaced with SVG)
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return rank.toString();
    }

    formatDonationCount(count) {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        }
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
    }

    formatRole(role) {
        if (!role) return 'Member';
        
        // Handle different role variations and fix the elder/admin issue
        const roleMap = {
            'leader': 'Leader',
            'coleader': 'Co-Leader',
            'co-leader': 'Co-Leader',
            'elder': 'Elder',
            'member': 'Member',
            'admin': 'Elder' // Map admin back to Elder (this fixes the issue)
        };
        
        const normalizedRole = role.toLowerCase().replace(/[\s-_]/g, '');
        return roleMap[normalizedRole] || role;
    }

    getRoleColor(role) {
        const colors = {
            'Leader': '#ffd700',     // Gold
            'Co-Leader': '#ff6b35',  // Orange-red
            'Elder': '#9370db',      // Purple
            'Member': '#99aab5'      // Gray
        };
        
        const formattedRole = this.formatRole(role);
        return colors[formattedRole] || colors['Member'];
    }

    calculateRatio(donations, received) {
        if (received === 0) {
            return donations > 0 ? '∞' : '0.00';
        }
        return (donations / received).toFixed(2);
    }

    getTimeRangeText(timeRange) {
        const now = new Date();
        const currentMonth = now.toLocaleString('en', { month: 'long', year: 'numeric' });
        
        // Calculate current season dates (CoC seasons typically run monthly)
        const seasonStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const seasonEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const seasonText = `${seasonStart.getDate()}-${seasonEnd.getDate()} ${seasonStart.toLocaleString('en', { month: 'short' })} ${seasonStart.getFullYear()}`;
        
        const ranges = {
            'current_season': `🗓️ Current Season (${seasonText})`,
            'current_week': '📅 This Week',
            'current_month': `📊 ${currentMonth}`,
            'last_week': '📅 Last Week',
            'last_month': '📊 Last Month',
            'all_time': '⏰ All Time'
        };
        return ranges[timeRange] || `📊 Current Season (${seasonText})`;
    }

    generatePlayerColor(name) {
        // Generate consistent color based on player name
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 60%, 45%)`;
    }

    lightenColor(color, percent) {
        // Simple color lightening utility
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    /**
     * Draw war-themed header
     */
    async drawWarHeader(ctx, config, page, totalPages, warData = {}) {
        const headerY = this.padding;
        
        // Header background with war theme
        const headerGradient = ctx.createLinearGradient(0, headerY, this.width, headerY + this.headerHeight);
        headerGradient.addColorStop(0, 'rgba(231, 76, 60, 0.8)'); // Red war theme
        headerGradient.addColorStop(1, 'rgba(192, 57, 43, 0.6)');
        
        ctx.fillStyle = headerGradient;
        ctx.fillRect(this.padding, headerY, this.width - (this.padding * 2), this.headerHeight);

        // Add rounded corners effect
        ctx.beginPath();
        ctx.roundRect(this.padding, headerY, this.width - (this.padding * 2), this.headerHeight, 15);
        ctx.fill();

        // Draw title
        ctx.fillStyle = this.textColor;
        ctx.font = this.titleFont;
        ctx.textAlign = 'center';
        
        const clanName = config.clan_name || (warData.clanName || 'Clan');
        const title = `⚔️ ${clanName} War Statistics`;
        const titleY = headerY + 70; // Moved to match donation header position
        ctx.fillText(title, this.width / 2, titleY);

        // War status and current war info with much more gap
        ctx.font = this.headerFont; // Use headerFont (38px) instead of 16px
        let warStatus = 'Historical War Performance';
        if (warData.currentWar) {
            const war = warData.currentWar;
            if (war.state === 'inWar') {
                warStatus = `🔥 Currently in War vs ${war.opponent?.name || 'Unknown Clan'}`;
            } else if (war.state === 'preparation') {
                warStatus = `⏳ Preparing for War vs ${war.opponent?.name || 'Unknown Clan'}`;
            }
        }
        
        const subtitleY = titleY + 60; // Increased from 25 to 60 for much bigger gap
        ctx.fillText(warStatus, this.width / 2, subtitleY);

        // Draw page indicator with much bigger font
        if (totalPages > 1) {
            ctx.font = 'bold 24px Arial'; // Increased from 14px to 24px and made bold
            ctx.textAlign = 'right';
            const pageText = `Page ${page} of ${totalPages}`;
            ctx.fillText(pageText, this.width - this.padding - 10, subtitleY);
        }

        // Draw clan tag if available with bigger font
        if (config.clan_tag) {
            ctx.font = '18px Arial'; // Increased from 14px to 18px
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(config.clan_tag, this.padding + 10, subtitleY);
        }
    }

    /**
     * Draw war player list
     */
    async drawWarPlayerList(ctx, players, config) {
        const startY = this.padding + this.headerHeight + 30;
        const tableHeaderY = startY;
        
        // Draw war table headers
        await this.drawWarTableHeaders(ctx, tableHeaderY);
        
        // Draw war players
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const playerY = tableHeaderY + 40 + (i * this.playerRowHeight);
            await this.drawWarPlayerRow(ctx, player, playerY, i);
        }
    }

    /**
     * Draw war-specific table headers
     */
    async drawWarTableHeaders(ctx, y) {
        // Header background
        ctx.fillStyle = '#2c2c2c'; // War red theme
        ctx.fillRect(this.padding, y, this.width - (this.padding * 2), 35);

        // Header text
        ctx.fillStyle = this.secondaryColor;
        ctx.font = this.headerFont;
        ctx.textAlign = 'center';

        // Calculate column positions
        let currentX = this.padding;
        
        // Rank header
        ctx.fillText('#', currentX + (this.rankWidth / 2), y + 22);
        currentX += this.rankWidth;
        
        // Player header
        ctx.textAlign = 'left';
        ctx.fillText('Player', currentX + 20, y + 22);
        currentX += this.warNameWidth; // Use war-specific name width
        
        // Role header
        ctx.textAlign = 'center';
        ctx.fillText('Role', currentX + (this.warRoleWidth / 2), y + 22);
        currentX += this.warRoleWidth;
        
        // Current War Attacks header (wider to show attack details)
        ctx.fillText('War Atk', currentX + (this.warAttackWidth / 2), y + 22);
        currentX += this.warAttackWidth;
        
        // Average Stars header
        ctx.fillText('Avg', currentX + (this.warAvgStarsWidth / 2), y + 22);
        currentX += this.warAvgStarsWidth;
        
        // War Participation header
        ctx.fillText('Wars', currentX + (this.warParticipationWidth / 2), y + 22);
        currentX += this.warParticipationWidth;
        
        // Win Rate header
        ctx.fillText('WR', currentX + (this.warWinRateWidth / 2), y + 22);
    }

    /**
     * Draw individual war player row
     */
    async drawWarPlayerRow(ctx, player, y, index) {
        const isEven = index % 2 === 0;
        
        // Row background
        ctx.fillStyle = isEven ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(this.padding, y, this.width - (this.padding * 2), this.playerRowHeight);

        let currentX = this.padding;

        // Rank - numbers only for war leaderboard
        await this.drawRankWithMedal(ctx, player.rank || index + 1, currentX, y, true); // true = war leaderboard
        currentX += this.rankWidth;

        // Player name with town hall level (no avatar)
        ctx.fillStyle = this.textColor;
        ctx.font = this.playerFont;
        ctx.textAlign = 'left';
        
        const nameStartX = currentX + 15; // Start position for name area (removed avatar)
        const nameY = y + 52; // Adjusted from 45 to 52
        
        // Draw town hall image first
        const thY = y + (this.playerRowHeight - this.townHallSize) / 2; // Center TH image vertically
        const thSpacing = await this.drawTownHallLevel(ctx, player.townHallLevel || 1, nameStartX, thY);
        
        // Draw player name after town hall image
        const nameX = nameStartX + thSpacing;
        
        // Truncate name if too long (account for space taken by TH image)
        let displayName = player.name || 'Unknown Player';
        const maxNameWidth = this.warNameWidth - thSpacing - 30; // Use war-specific name width
        ctx.font = this.playerFont;
        let nameWidth = ctx.measureText(displayName).width;
        
        if (nameWidth > maxNameWidth) {
            // Truncate until it fits
            while (nameWidth > maxNameWidth && displayName.length > 3) {
                displayName = displayName.substring(0, displayName.length - 4) + '...';
                nameWidth = ctx.measureText(displayName).width;
            }
        }
        
        ctx.fillText(displayName, nameX, nameY);
        currentX += this.warNameWidth; // Use war-specific name width

        // Player role
        ctx.fillStyle = this.getRoleColor(player.role);
        ctx.font = this.playerFont;
        ctx.textAlign = 'center';
        
        const roleText = this.formatRole(player.role);
        ctx.fillText(roleText, currentX + (this.warRoleWidth / 2), y + 52); // Use war-specific role width
        currentX += this.warRoleWidth;

        // Current War Attack Details (like your image example)
        await this.drawCurrentWarAttacks(ctx, player, currentX, y);
        currentX += this.warAttackWidth;

        // Average Stars (historical) - with SVG star icon
        ctx.fillStyle = '#f1c40f'; // Gold color for text
        ctx.font = this.donationFont;
        ctx.textAlign = 'left';
        
        const avgStars = player.averageStars || '0.00';
        const avgStarsText = avgStars;
        
        // Calculate text width to position star icon after
        const textWidth = ctx.measureText(avgStarsText).width;
        const textStartX = currentX + (this.warAvgStarsWidth / 2) - (textWidth / 2) - 12; // Center the text+star combo
        
        // Draw average stars text
        ctx.fillText(avgStarsText, textStartX, y + 52);
        
        // Draw star icon after text
        const starX = textStartX + textWidth + 5; // Small gap after text
        const starY = y + 52 - 20; // Align with text baseline - adjusted for bigger star
        await this.drawStars(ctx, 1, 1, starX, starY, 32); // Single filled star - much bigger size
        
        currentX += this.warAvgStarsWidth;

        // Wars Participated
        ctx.fillStyle = '#9b59b6'; // Purple for participation
        ctx.font = this.playerFont;
        ctx.textAlign = 'center';
        const participation = player.warsParticipated || 0;
        ctx.fillText(participation.toString(), currentX + (this.warParticipationWidth / 2), y + 52); // Adjusted from 45 to 52
        currentX += this.warParticipationWidth;

        // Win Rate
        ctx.fillStyle = this.secondaryColor;
        ctx.font = this.playerFont;
        ctx.textAlign = 'center';
        const winRate = player.winRate || '0.0';
        ctx.fillText(`${winRate}%`, currentX + (this.warWinRateWidth / 2), y + 52); // Adjusted from 45 to 52
    }

    /**
     * Draw current war attack details (similar to your image)
     * Shows individual attacks with position, stars, and destruction percentage
     */
    async drawCurrentWarAttacks(ctx, player, x, y) {
        const attackDetails = player.currentWarAttackDetails || [];
        
        if (attackDetails.length === 0) {
            // No attacks yet
            ctx.fillStyle = '#95a5a6'; // Gray
            ctx.font = '27px Arial'; // Smaller font for "No attacks"
            ctx.textAlign = 'center';
            ctx.fillText('No attacks', x + (this.warAttackWidth / 2), y + 52);
            return;
        }

        // Use smaller, more compact font for war attacks
        ctx.font = '27px Arial'; // Compact font size for war attacks
        
        const attackAreaWidth = this.warAttackWidth;
        const centerX = x + (attackAreaWidth / 2); // Center point of the column
        const baseY = y + 35; // Start position
        const attackSpacing = 41; // Increased spacing between attacks for larger font
        
        for (let i = 0; i < Math.min(attackDetails.length, 2); i++) {
            const attack = attackDetails[i];
            const attackY = baseY + (i * attackSpacing);
            
            // Calculate total width of the attack display (text + stars + percentage)
            // Fix: Use proper null check instead of falsy || operator to handle position 0 correctly
            const defenderPos = (attack.defenderPosition !== null && attack.defenderPosition !== undefined && attack.defenderPosition > 0) 
                ? attack.defenderPosition 
                : '?';
            const attackText = `${defenderPos}/${attack.attackNumber} `;
            const percentText = ` ${attack.destructionPercentage}%`;
            
            ctx.font = '27px Arial';
            const textWidth = ctx.measureText(attackText).width;
            const percentWidth = ctx.measureText(percentText).width;
            const starsWidth = 3 * 28 + 2 * 6; // 3 stars * 28px each + 2 gaps * 6px
            const totalWidth = textWidth + starsWidth + percentWidth + 10; // 10px for spacing
            
            // Calculate starting position to center the entire attack display
            const startX = centerX - (totalWidth / 2);
            
            // Draw position/attack number part
            ctx.fillStyle = this.textColor;
            ctx.textAlign = 'left';
            ctx.fillText(attackText, startX, attackY);
            
            // Draw stars using SVG images
            const starStartX = startX + textWidth + 5; // Start stars after text with small gap
            const starY = attackY - 20; // Adjust Y to align stars with text baseline - adjusted for bigger stars
            await this.drawStars(ctx, attack.stars || 0, 3, starStartX, starY, 28);
            
            // Destruction percentage (right side)
            ctx.fillStyle = this.textColor;
            ctx.textAlign = 'left';
            const percentStartX = starStartX + starsWidth + 5; // Start percentage after stars with gap
            ctx.fillText(percentText, percentStartX, attackY);
        }
        
        // If more than 2 attacks, show count at bottom
        if (attackDetails.length > 2) {
            ctx.fillStyle = '#95a5a6';
            ctx.font = '11px Arial'; // Even smaller for "more" text
            ctx.textAlign = 'center';
            ctx.fillText(`+${attackDetails.length - 2} more`, centerX, y + 72);
        }
    }

    /**
     * Draw individual war player row
     */
    async drawWarPlayerRowOld(ctx, player, y, index) {
    }

    /**
     * Create a simple test image for debugging
     */
    async generateTestImage() {
        const testPlayers = [
            { rank: 1, name: 'PlayerOne', donations: 15420, role: 'Leader', avatarUrl: null },
            { rank: 2, name: 'PlayerTwo', donations: 12350, role: 'Co-Leader', avatarUrl: null },
            { rank: 3, name: 'PlayerThree', donations: 9876, role: 'Elder', avatarUrl: null },
            { rank: 4, name: 'LongPlayerNameExample', donations: 7654, role: 'Member', avatarUrl: null },
            { rank: 5, name: 'Player5', donations: 5432, role: 'Member', avatarUrl: null }
        ];

        const testConfig = {
            clan_name: 'Test Clan',
            clan_tag: '#TEST123',
            time_range: 'current_season',
            canvas_generate_random_color: true
        };

        return await this.generateLeaderboard(testPlayers, testConfig, 1, 3);
    }

    /**
     * Draw preparing war header
     */
    async drawPreparingWarHeader(ctx, config, page, totalPages, warData = {}) {
        const headerY = this.padding;
        
        // Header background with preparation theme (blue/orange)
        const headerGradient = ctx.createLinearGradient(0, headerY, this.width, headerY + this.headerHeight);
        headerGradient.addColorStop(0, 'rgba(52, 152, 219, 0.8)'); // Blue preparation theme
        headerGradient.addColorStop(1, 'rgba(230, 126, 34, 0.6)'); // Orange accent
        
        ctx.fillStyle = headerGradient;
        ctx.fillRect(this.padding, headerY, this.width - (this.padding * 2), this.headerHeight);

        // Add rounded corners effect
        ctx.beginPath();
        ctx.roundRect(this.padding, headerY, this.width - (this.padding * 2), this.headerHeight, 15);
        ctx.fill();

        // Draw title
        ctx.fillStyle = this.textColor;
        ctx.font = this.titleFont;
        ctx.textAlign = 'center';
        
        const clanName = config.clan_name || (warData.clanName || 'Clan');
        const title = `🛡️ ${clanName} - War Preparation`;
        const titleY = headerY + 70;
        ctx.fillText(title, this.width / 2, titleY);

        // War status
        ctx.font = this.headerFont;
        let warStatus = 'Preparing for War';
        if (warData.currentWar && warData.currentWar.opponent) {
            warStatus = `vs ${warData.currentWar.opponent.name}`;
        }
        
        const statusY = titleY + 50;
        ctx.fillText(warStatus, this.width / 2, statusY);
    }

    /**
     * Draw active war header
     */
    async drawActiveWarHeader(ctx, config, page, totalPages, warData = {}) {
        const headerY = this.padding;
        
        // Header background with active war theme (red/crimson)
        const headerGradient = ctx.createLinearGradient(0, headerY, this.width, headerY + this.headerHeight);
        headerGradient.addColorStop(0, 'rgba(231, 76, 60, 0.8)'); // Red war theme
        headerGradient.addColorStop(1, 'rgba(192, 57, 43, 0.6)');
        
        ctx.fillStyle = headerGradient;
        ctx.fillRect(this.padding, headerY, this.width - (this.padding * 2), this.headerHeight);

        // Add rounded corners effect
        ctx.beginPath();
        ctx.roundRect(this.padding, headerY, this.width - (this.padding * 2), this.headerHeight, 15);
        ctx.fill();

        // Draw title
        ctx.fillStyle = this.textColor;
        ctx.font = this.titleFont;
        ctx.textAlign = 'center';
        
        const clanName = config.clan_name || (warData.clanName || 'Clan');
        const title = `⚔️ ${clanName} - Active War`;
        const titleY = headerY + 70;
        ctx.fillText(title, this.width / 2, titleY);

        // War status and current war info
        ctx.font = this.headerFont;
        let warStatus = 'War in Progress';
        if (warData.currentWar && warData.currentWar.opponent) {
            warStatus = `vs ${warData.currentWar.opponent.name}`;
        }
        
        const statusY = titleY + 50;
        ctx.fillText(warStatus, this.width / 2, statusY);
    }

    /**
     * Draw historical war header - unified method for both single and dual page layouts
     */
    async drawHistoricalWarHeader(ctx, config, page, totalPages, warData = {}, customX = null, customWidth = null) {
        const headerY = this.padding;
        const x = customX !== null ? customX : this.padding;
        const width = customWidth !== null ? customWidth : (this.width - (this.padding * 2));
        
        // Header background with historical theme (purple/gray)
        const headerGradient = ctx.createLinearGradient(x, headerY, x + width, headerY + this.headerHeight);
        headerGradient.addColorStop(0, 'rgba(155, 89, 182, 0.8)'); // Purple historical theme
        headerGradient.addColorStop(1, 'rgba(127, 140, 141, 0.6)'); // Gray accent
        
        ctx.fillStyle = headerGradient;
        ctx.beginPath();
        ctx.roundRect(x, headerY, width, this.headerHeight, 15);
        ctx.fill();

        // Extract clan & opponent names and star results
        const clanName = config.clan_name || warData.clanName || warData.clan?.name || 'Clan';
        const opponentName = warData.opponentName ||
            warData.opponent?.name ||
            warData.historicalWar?.opponent?.name ||
            warData.lastWar?.opponent?.name ||
            warData.currentWar?.opponent?.name;

        const clanStars = (warData.historicalWar?.clan?.stars ?? warData.lastWar?.clan?.stars ?? warData.clanStars ?? warData.currentWar?.clan?.stars);
        const opponentStars = (warData.historicalWar?.opponent?.stars ?? warData.lastWar?.opponent?.stars ?? warData.opponentStars ?? warData.currentWar?.opponent?.stars);
        const hasStarResult = typeof clanStars === 'number' && typeof opponentStars === 'number';

        // Draw title
        ctx.fillStyle = this.textColor;
        ctx.font = this.titleFont;
        ctx.textAlign = 'center';
        
        let title;
        if (opponentName && customWidth !== null) {
            // Dual page layout - show opponent name
            title = `📜 ${clanName} vs ${opponentName}`;
        } else if (opponentName) {
            // Single page with opponent
            title = `🏆 ${clanName} vs ${opponentName} - War Statistics`;
        } else {
            // Fallback
            title = `🏆 ${clanName} War Statistics`;
        }
        
        const titleY = headerY + 70;
        ctx.fillText(title, x + width / 2, titleY);

        // Second line - war status or page info
        ctx.font = this.headerFont;
        let secondLine;
        if (hasStarResult && customWidth !== null) {
            // Dual page with star result
            secondLine = `⭐ ${clanStars} - ${opponentStars} ⭐  (Page ${page}/${totalPages})`;
        } else if (hasStarResult) {
            // Single page with star result
            secondLine = `⭐ Result: ${clanStars} - ${opponentStars} ⭐`;
        } else if (customWidth !== null) {
            // Dual page without star result
            secondLine = `Historical War (Page ${page}/${totalPages})`;
        } else {
            // Single page fallback
            secondLine = 'Historical War Performance';
        }
        
        const statusY = titleY + 50;
        ctx.fillText(secondLine, x + width / 2, statusY);

        // Clan tag (if provided)
        if (config.clan_tag) {
            ctx.font = '20px Arial';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(config.clan_tag, x + 15, statusY);
        }
    }

    /**
     * Draw preparation war info section
     */
    async drawPreparationWarInfo(ctx, warData, y) {
        if (!warData.currentWar) return;

        const war = warData.currentWar;
        const infoHeight = 60;
        
        // Background for info section
        ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
        ctx.fillRect(this.padding, y, this.width - (this.padding * 2), infoHeight);

        // War info text
        ctx.fillStyle = this.textColor;
        ctx.font = this.headerFont;
        ctx.textAlign = 'center';

        // Debug: Log war object structure
        // console.log('[LeaderboardCanvas] Preparation war object:', JSON.stringify(war, null, 2));

        let timeText = 'War preparation in progress';
        if (war.preparationStartTime || war.startTime) {
            // For preparation phase, use startTime (when war actually begins)
            const warStartTimeString = war.startTime || war.preparationStartTime;
            const warStartTime = this.parseClashTime(warStartTimeString);
            
            if (warStartTime) {
                const now = new Date();
                const timeRemaining = warStartTime.getTime() - now.getTime();
                
                console.log(`[LeaderboardCanvas] War start time: ${warStartTime}, Time remaining: ${timeRemaining}ms`);
                
                if (timeRemaining > 0) {
                    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
                    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                    timeText = `War starts in ${hours}h ${minutes}m`;
                } else {
                    timeText = 'War should have started';
                }
            }
        }

        ctx.fillText(timeText, this.width / 2, y + 40);
    }

    /**
     * Draw active war info section
     */
    async drawActiveWarInfo(ctx, warData, y) {
        if (!warData.currentWar) return;

        const war = warData.currentWar;
        const infoHeight = 60;
        
        // Background for info section
        ctx.fillStyle = '#2c2c2c';
        ctx.fillRect(this.padding, y, this.width - (this.padding * 2), infoHeight);

        // War score and time remaining
        ctx.fillStyle = this.textColor;
        ctx.font = this.headerFont;
        ctx.textAlign = 'center';

        // Debug: Log war object structure
        // console.log('[LeaderboardCanvas] Active war object:', JSON.stringify(war, null, 2));

        let scoreText = `★ ${war.clan?.stars || 0} - ${war.opponent?.stars || 0}`;
        let timeText = 'War in progress';
        
        if (war.endTime) {
            const endTime = this.parseClashTime(war.endTime);
            
            if (endTime) {
                const now = new Date();
                const timeRemaining = endTime.getTime() - now.getTime();
                
                console.log(`[LeaderboardCanvas] War end time: ${endTime}, Time remaining: ${timeRemaining}ms`);
                
                if (timeRemaining > 0) {
                    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
                    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                    timeText = `${hours}h ${minutes}m remaining`;
                } else {
                    timeText = 'War should have ended';
                }
            }
        }

        ctx.fillText(`${scoreText} | ${timeText}`, this.width / 2, y + 40);
    }

    /**
     * Draw preparing war player list
     */
    async drawPreparingWarPlayerList(ctx, players, config, startY) {
        const tableHeaderHeight = 40;
        let currentY = startY + tableHeaderHeight + 10;

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            await this.drawPreparingWarPlayerRow(ctx, player, currentY, i);
            currentY += this.playerRowHeight;
        }
    }

    /**
     * Draw active war player list
     */
    async drawActiveWarPlayerList(ctx, players, config, startY) {
        const tableHeaderHeight = 40;
        let currentY = startY + tableHeaderHeight + 10;

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            await this.drawActiveWarPlayerRow(ctx, player, currentY, i);
            currentY += this.playerRowHeight;
        }
    }

    /**
     * Draw historical war player list (uses existing method)
     */
    async drawHistoricalWarPlayerList(ctx, players, config, startY) {
        // Use existing war player list drawing method
        await this.drawWarPlayerList(ctx, players, config);
    }

    /**
     * Draw preparing war player row
     */
    async drawPreparingWarPlayerRow(ctx, player, y, index) {
        // Similar to existing but focused on preparation status
        const rank = player.rank || (index + 1); // Use player's rank if available, fallback to index + 1
        let currentX = this.padding + 20;

        // Row background
        ctx.fillStyle = index % 2 === 0 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(this.padding, y, this.width - (this.padding * 2), this.playerRowHeight);

        // Rank
        await this.drawRankWithMedal(ctx, rank, currentX, y + 20, true);
        currentX += this.rankWidth;

        // Town Hall and Player Name
        if (player.townHallLevel) {
            await this.drawTownHallLevel(ctx, player.townHallLevel, currentX, y + 20);
        }
        
        const nameX = currentX + 70;
        const nameY = y + 52;
        
        ctx.fillStyle = this.textColor;
        ctx.font = this.playerFont;
        ctx.textAlign = 'left';
        
        let displayName = player.name || 'Unknown Player';
        const maxNameWidth = this.warNameWidth - 70 - 30;
        let nameWidth = ctx.measureText(displayName).width;
        
        if (nameWidth > maxNameWidth) {
            while (nameWidth > maxNameWidth && displayName.length > 3) {
                displayName = displayName.substring(0, displayName.length - 4) + '...';
                nameWidth = ctx.measureText(displayName).width;
            }
        }
        
        ctx.fillText(displayName, nameX, nameY);
        currentX += this.warNameWidth;

        // Player role
        ctx.fillStyle = this.getRoleColor(player.role);
        ctx.font = this.playerFont;
        ctx.textAlign = 'center';
        
        const roleText = this.formatRole(player.role);
        ctx.fillText(roleText, currentX + (this.warRoleWidth / 2), y + 52);
        currentX += this.warRoleWidth;

        // Preparation status (ready/not ready indicator)
        ctx.fillStyle = this.accentColor;
        ctx.fillText('Ready for War', currentX + (this.warAttackWidth / 2), y + 52);
        currentX += this.warAttackWidth;

        // Historical stats preview - handle both string and number values for averageStars
        ctx.fillStyle = this.textColor;
        const avgStars = typeof player.averageStars === 'string' ? parseFloat(player.averageStars) || 0 : (player.averageStars || 0);
        ctx.fillText(avgStars.toFixed(1), currentX + (this.warAvgStarsWidth / 2), y + 52);
        currentX += this.warAvgStarsWidth;

        ctx.fillText(player.warsParticipated || 0, currentX + (this.warParticipationWidth / 2), y + 52);
        currentX += this.warParticipationWidth;

        // Win Rate
        ctx.fillStyle = this.secondaryColor;
        ctx.fillText(`${player.winRate || '0.0'}%`, currentX + (this.warWinRateWidth / 2), y + 52);
    }

    /**
     * Draw active war player row
     */
    async drawActiveWarPlayerRow(ctx, player, y, index) {
        // Use existing war player row method which handles current attacks
        await this.drawWarPlayerRow(ctx, player, y, index);
    }

    /**
     * Calculate canvas height for (historical) war leaderboard dual-column layout.
     * Test script calls this directly.
     * @param {number} playerCount
     * @param {number} perColumn Maximum players per column (default 25)
     * @returns {number} Calculated canvas height (>= minHeight)
     */
    calculateWarCanvasHeight(playerCount, perColumn = 25) {
        const rows = Math.min(playerCount, perColumn); // vertical rows shown
        const headerExtra = 30; // gap below header
        const tableHeaderHeight = 50; // column header bar
        const dynamicHeight = this.padding + // top padding
            this.headerHeight +
            headerExtra +
            tableHeaderHeight +
            (rows * this.playerRowHeight) +
            this.footerHeight +
            this.padding; // bottom padding
        return Math.max(dynamicHeight, this.minHeight);
    }

    /**
     * Public API for historical war leaderboard (dual-column: up to 50 players shown).
     * Matches usage in test/test-historical-war-leaderboard.js
     * @param {Array} players Full player list (expects rank, name, townHallLevel, averageStars, warsParticipated, winRate, totalStars)
     * @param {Object} config Config object { clan_name, clan_tag, canvas_generate_random_color }
     * @param {Object} warData Optional meta (clanName, clanTag, etc.)
     * @returns {Buffer} PNG buffer
     */
    async generateHistoricalWarLeaderboard(players = [], config = {}, warData = {}) {
        try {
            // Theme: enforce purple historical theme (as per test summary) unless overridden
            this.primaryColor = '#6b46c1'; // deep purple
            this.accentColor = '#9f7aea'; // lighter purple

            const perColumn = 25;
            const totalPlayers = players.length;
            const dual = totalPlayers > perColumn; // two side-by-side pages

            // Original war column total width
            const warTableInnerWidth = this.rankWidth + this.warNameWidth + this.warRoleWidth + this.warAttackWidth + this.warAvgStarsWidth + this.warParticipationWidth + this.warWinRateWidth;
            const gapBetweenTables = dual ? 60 : 0;
            const totalNeededWidth = this.padding * 2 + warTableInnerWidth * (dual ? 2 : 1) + gapBetweenTables;

            // Preserve original width for other usages
            const originalWidth = this.width;
            if (totalNeededWidth > this.width) {
                this.width = totalNeededWidth; // temporarily expand canvas width
            }

            // Height calculation: based only on max rows in a single table (since side-by-side)
            const rowsShown = Math.min(perColumn, totalPlayers - 0); // first table rows
            const secondRows = dual ? Math.min(perColumn, totalPlayers - perColumn) : 0;
            const tableHeaderHeight = 35;
            const gapBelowHeader = 30;
            const blockHeight = this.headerHeight + gapBelowHeader + tableHeaderHeight + (Math.max(rowsShown, secondRows) * this.playerRowHeight);
            const dynamicHeight = this.padding + blockHeight + this.footerHeight + this.padding;
            const canvasHeight = Math.max(dynamicHeight, this.minHeight);

            const canvas = createCanvas(this.width, canvasHeight);
            const ctx = canvas.getContext('2d');
            await this.drawBackground(ctx, canvasHeight);

            // Slice players
            const firstPlayers = players.slice(0, perColumn);
            const secondPlayers = dual ? players.slice(perColumn, perColumn * 2) : [];

            // Draw first header
            const firstX = this.padding;
            await this._drawHistoricalPageHeader(ctx, firstX, warTableInnerWidth, config, warData, 1, dual ? 2 : 1);
            const tableStartY = this.padding + this.headerHeight + gapBelowHeader; // y for table header bar
            await this._drawWarTableHeadersAt(ctx, firstX, tableStartY, warTableInnerWidth);
            let rowsYStart = tableStartY + tableHeaderHeight + 5; // some spacing

            for (let i = 0; i < firstPlayers.length; i++) {
                firstPlayers[i].rank = i + 1;
                await this._drawWarPlayerRowAt(ctx, firstPlayers[i], rowsYStart + i * this.playerRowHeight, i, firstX, warTableInnerWidth);
            }

            if (dual) {
                const secondX = firstX + warTableInnerWidth + gapBetweenTables;
                await this._drawHistoricalPageHeader(ctx, secondX, warTableInnerWidth, config, warData, 2, 2);
                await this._drawWarTableHeadersAt(ctx, secondX, tableStartY, warTableInnerWidth);
                for (let j = 0; j < secondPlayers.length; j++) {
                    secondPlayers[j].rank = perColumn + j + 1;
                    await this._drawWarPlayerRowAt(ctx, secondPlayers[j], rowsYStart + j * this.playerRowHeight, j, secondX, warTableInnerWidth);
                }
            }

            // Footer once centered across new width
            await this._drawHistoricalDualFooter(ctx, canvasHeight);

            const buffer = canvas.toBuffer('image/png');
            // Restore width
            this.width = originalWidth;
            return buffer;
        } catch (err) {
            console.error('[generateHistoricalWarLeaderboard] Failed:', err);
            throw err;
        }
    }

    /**
     * Internal: header for dual historical layout
     */
    async _drawHistoricalDualHeader(ctx, config, warData, dual) { 
        // Use the unified historical header method with custom positioning
        await this.drawHistoricalWarHeader(ctx, config, pageNumber, totalPages, warData, x, width);
    }

    /**
     * Draw a per-page (per-column) header box for dual historical layout.
     */
    async _drawHistoricalPageHeader(ctx, x, width, config, warData, pageNumber, totalPages) {
        const headerY = this.padding;
        const gradient = ctx.createLinearGradient(x, headerY, x + width, headerY + this.headerHeight);
        gradient.addColorStop(0, this.primaryColor);
        gradient.addColorStop(1, this.accentColor);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, headerY, width, this.headerHeight, 15);
        ctx.fill();
        // Extract clan & opponent names
        const clanName = config.clan_name || warData.clanName || warData.clan?.name || 'Clan';
        const opponentName = warData.opponentName ||
            warData.opponent?.name ||
            warData.historicalWar?.opponent?.name ||
            warData.lastWar?.opponent?.name ||
            warData.currentWar?.opponent?.name || 'Opponent';

        // Extract star results (prefer historical/ended war data)
        const clanStars = (warData.historicalWar?.clan?.stars ?? warData.lastWar?.clan?.stars ?? warData.clanStars ?? warData.currentWar?.clan?.stars);
        const opponentStars = (warData.historicalWar?.opponent?.stars ?? warData.lastWar?.opponent?.stars ?? warData.opponentStars ?? warData.currentWar?.opponent?.stars);
        const hasStarResult = typeof clanStars === 'number' && typeof opponentStars === 'number';

        ctx.fillStyle = this.textColor;
        ctx.font = this.titleFont;
        ctx.textAlign = 'center';
        ctx.fillText(`📜 ${clanName} vs ${opponentName}`.trim(), x + width / 2, headerY + 65);

        ctx.font = this.headerFont;
        let secondLine;
        if (hasStarResult) {
            secondLine = `⭐ ${clanStars} - ${opponentStars} ⭐  (Page ${pageNumber}/${totalPages})`;
        } else {
            secondLine = `Historical War (Page ${pageNumber}/${totalPages})`;
        }
        ctx.fillText(secondLine, x + width / 2, headerY + 120);

        if (config.clan_tag) {
            ctx.font = '20px Arial';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(config.clan_tag, x + 15, headerY + 120);
        }
    }

    /**
     * Internal: footer for dual historical layout (no navigation hint)
     */
    async _drawHistoricalDualFooter(ctx, canvasHeight) {
        const footerY = canvasHeight - 60;
        ctx.fillStyle = this.secondaryColor;
        ctx.font = '26px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Last updated: ${new Date().toLocaleString()}`, this.width / 2, footerY);
    }

    /**
     * War table headers drawn at specific x/width (duplicate of drawWarTableHeaders but column-scoped)
     */
    async _drawWarTableHeadersAt(ctx, x, y, width) {
        ctx.fillStyle = '#2c2c2c';
        ctx.fillRect(x, y, width, 35);
        ctx.fillStyle = this.secondaryColor;
        ctx.font = this.headerFont;
        ctx.textAlign = 'center';
        let currentX = x;
        // Using same widths as original war layout
        // Rank
        ctx.fillText('#', currentX + (this.rankWidth / 2), y + 22); currentX += this.rankWidth;
        // Player (left align for name header like original)
        ctx.textAlign = 'left'; ctx.fillText('Player', currentX + 20, y + 22); currentX += this.warNameWidth;
        // Role
        ctx.textAlign = 'center'; ctx.fillText('Role', currentX + (this.warRoleWidth / 2), y + 22); currentX += this.warRoleWidth;
        // War Attacks
        ctx.fillText('War Atk', currentX + (this.warAttackWidth / 2), y + 22); currentX += this.warAttackWidth;
        // Avg Stars
        ctx.fillText('Avg', currentX + (this.warAvgStarsWidth / 2), y + 22); currentX += this.warAvgStarsWidth;
        // Wars
        ctx.fillText('Wars', currentX + (this.warParticipationWidth / 2), y + 22); currentX += this.warParticipationWidth;
        // Win Rate
        ctx.fillText('WR', currentX + (this.warWinRateWidth / 2), y + 22);
    }

    /**
     * Draw war player row at column offset (adapted from drawWarPlayerRow)
     */
    async _drawWarPlayerRowAt(ctx, player, y, index, startX, width) {
        const isEven = index % 2 === 0;
        ctx.fillStyle = isEven ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)';
        ctx.fillRect(startX, y, width, this.playerRowHeight);

        let currentX = startX;
        await this.drawRankWithMedal(ctx, player.rank || index + 1, currentX, y, true);
        currentX += this.rankWidth;

        // Player name + TH
        ctx.fillStyle = this.textColor;
        ctx.font = this.playerFont;
        ctx.textAlign = 'left';
        const nameStartX = currentX + 15;
        const thY = y + (this.playerRowHeight - this.townHallSize)/2;
        const thSpacing = await this.drawTownHallLevel(ctx, player.townHallLevel || 1, nameStartX, thY);
        let displayName = player.name || 'Unknown Player';
        const maxNameWidth = this.warNameWidth - thSpacing - 30;
        while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
            displayName = displayName.substring(0, displayName.length - 4) + '...';
        }
        ctx.fillText(displayName, nameStartX + thSpacing, y + 52);
        currentX += this.warNameWidth;

        // Role
        ctx.fillStyle = this.getRoleColor(player.role);
        ctx.font = this.playerFont; ctx.textAlign = 'center';
        ctx.fillText(this.formatRole(player.role), currentX + (this.warRoleWidth / 2), y + 52);
        currentX += this.warRoleWidth;

        // War Attacks area
        await this.drawCurrentWarAttacks(ctx, player, currentX, y);
        currentX += this.warAttackWidth;

        // Avg Stars
        ctx.fillStyle = '#f1c40f'; ctx.font = this.donationFont; ctx.textAlign = 'left';
        const avgStars = player.averageStars || '0.00';
        const textWidth = ctx.measureText(avgStars).width;
        const textStartX = currentX + (this.warAvgStarsWidth / 2) - (textWidth / 2) - 12;
        ctx.fillText(avgStars, textStartX, y + 52);
        const starX = textStartX + textWidth + 5;
        const starY = y + 52 - 20;
        await this.drawStars(ctx, 1, 1, starX, starY, 32);
        currentX += this.warAvgStarsWidth;

        // Wars participated
        ctx.fillStyle = '#9b59b6'; ctx.font = this.playerFont; ctx.textAlign = 'center';
        ctx.fillText(String(player.warsParticipated || 0), currentX + (this.warParticipationWidth / 2), y + 52);
        currentX += this.warParticipationWidth;

        // Win Rate
        ctx.fillStyle = this.secondaryColor; ctx.fillText(`${player.winRate || '0.0'}%`, currentX + (this.warWinRateWidth / 2), y + 52);
    }

    /**
     * Internal: column headers (rank, player, avg, win%, wars, stars)
     */
    async _drawHistoricalColumnHeaders(ctx, x, y, columnWidth) {
        ctx.save();
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(x, y, columnWidth, 50);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        const cols = [70, 260, 100, 120, 120, 120]; // base widths
        const total = cols.reduce((a,b)=>a+b,0);
        let scale = 1;
        if (total > columnWidth) scale = columnWidth / total;
        const scaled = cols.map(c=>c*scale);
        let cx = x;
        const headers = ['#','Player','Avg','Win%','Wars','Stars'];
        for (let i=0;i<headers.length;i++) {
            const w = scaled[i];
            ctx.fillText(headers[i], cx + w/2, y + 34);
            cx += w;
        }
        ctx.restore();
    }

    /**
     * Internal: draw players for one historical column
     */
    async _drawHistoricalColumn(ctx, players, x, startY, columnWidth) {
        const cols = [70, 260, 100, 120, 120, 120];
        const total = cols.reduce((a,b)=>a+b,0);
        let scale = 1;
        if (total > columnWidth) scale = columnWidth / total;
        const scaled = cols.map(c=>c*scale);

        for (let i=0;i<players.length;i++) {
            const p = players[i];
            const rowY = startY + i * this.playerRowHeight;
            const isEven = i % 2 === 0;
            ctx.fillStyle = isEven ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.15)';
            ctx.fillRect(x, rowY, columnWidth, this.playerRowHeight);

            ctx.font = this.playerFont;
            ctx.textAlign = 'center';
            let cx = x;
            const centerY = rowY + (this.playerRowHeight / 2) + 12;

            // Rank
            const rank = p.rank || (i + 1);
            ctx.fillStyle = this.getRankColor(rank);
            ctx.fillText(this.getRankDisplay(rank, true), cx + scaled[0]/2, centerY);
            cx += scaled[0];

            // Player name + TH
            ctx.textAlign = 'left';
            ctx.fillStyle = this.textColor;
            const nameX = cx + 15;
            const thY = rowY + (this.playerRowHeight - this.townHallSize)/2;
            const thSpacing = await this.drawTownHallLevel(ctx, p.townHallLevel || 1, nameX, thY);
            const maxNameWidth = scaled[1] - thSpacing - 30;
            let displayName = p.name || 'Unknown';
            while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
                displayName = displayName.slice(0, -1);
            }
            ctx.fillText(displayName, nameX + thSpacing, centerY);
            cx += scaled[1];

            ctx.textAlign = 'center';
            // Avg
            ctx.fillStyle = this.accentColor;
            const avg = (typeof p.averageStars === 'string' ? parseFloat(p.averageStars) : (p.averageStars || 0)).toFixed(2);
            ctx.fillText(avg, cx + scaled[2]/2, centerY); cx += scaled[2];
            // Win%
            ctx.fillStyle = '#ffd54f';
            const win = (typeof p.winRate === 'string' ? parseFloat(p.winRate) : (p.winRate || 0)).toFixed(1) + '%';
            ctx.fillText(win, cx + scaled[3]/2, centerY); cx += scaled[3];
            // Wars
            ctx.fillStyle = '#4dd0e1';
            ctx.fillText(String(p.warsParticipated || 0), cx + scaled[4]/2, centerY); cx += scaled[4];
            // Stars (total historical)
            ctx.fillStyle = '#ffffff';
            ctx.fillText(String(p.totalStars || 0), cx + scaled[5]/2, centerY);
        }
    }
}

module.exports = LeaderboardCanvas;