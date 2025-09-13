const { createCanvas, loadImage } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

class LeaderboardCanvas {
    constructor() {
        this.width = 1400; // Increased from 1200 to accommodate last online column
        this.minHeight = 700; // Increased from 600 to 700
        this.backgroundColor = '#2c2f33';
        this.primaryColor = '#7289da';
        this.secondaryColor = '#99aab5';
        this.textColor = '#ffffff';
        this.accentColor = '#43b581';
        
        // Layout constants - updated for wider canvas
        this.padding = 40;
        this.headerHeight = 120;
        this.playerRowHeight = 70; // Increased from 65 to 70
        this.avatarSize = 50;
        this.rankWidth = 90; // Increased from 80
        this.nameWidth = 280; // Increased from 250
        this.donationWidth = 120; // Increased from 100
        this.receivedWidth = 120; // Increased from 100
        this.ratioWidth = 100; // Increased from 80
        this.roleWidth = 140; // Increased from 120
        this.lastOnlineWidth = 150; // New column for last online
        this.footerHeight = 80;
        
        // Font settings - increased sizes
        this.titleFont = 'bold 32px Arial';
        this.headerFont = 'bold 20px Arial'; // Increased from 18px
        this.playerFont = '18px Arial'; // Increased from 16px
        this.donationFont = 'bold 18px Arial'; // Increased from 16px
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
            const tableHeaderHeight = 35;
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
     * @returns {Buffer} Canvas image buffer
     */
    async generateWarLeaderboard(players, config, page = 1, totalPages = 1, warData = {}) {
        try {
            // Calculate dynamic height based on player count
            const tableHeaderHeight = 35;
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
            
            // Draw header (war themed)
            await this.drawWarHeader(ctx, config, page, totalPages, warData);
            
            // Draw war player list
            await this.drawWarPlayerList(ctx, players, config);
            
            // Draw footer with pagination info
            await this.drawFooter(ctx, page, totalPages, canvasHeight);

            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error('Error generating war leaderboard canvas:', error);
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
        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, this.width, height);
        gradient.addColorStop(0, this.backgroundColor);
        gradient.addColorStop(0.5, this.lightenColor(this.backgroundColor, 10));
        gradient.addColorStop(1, this.backgroundColor);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, height);

        // Add subtle pattern overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        for (let x = 0; x < this.width; x += 20) {
            for (let y = 0; y < height; y += 20) {
                if ((x + y) % 40 === 0) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
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
        const titleY = headerY + 45;
        ctx.fillText(title, this.width / 2, titleY);

        // Draw time range subtitle
        ctx.font = this.headerFont;
        const timeRangeText = this.getTimeRangeText(config.time_range);
        const subtitleY = titleY + 30;
        ctx.fillText(timeRangeText, this.width / 2, subtitleY);

        // Draw page indicator
        if (totalPages > 1) {
            ctx.font = '14px Arial';
            ctx.textAlign = 'right';
            const pageText = `Page ${page} of ${totalPages}`;
            ctx.fillText(pageText, this.width - this.padding - 10, subtitleY);
        }

        // Draw clan tag if available
        if (config.clan_tag) {
            ctx.font = '12px Arial';
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
        
        // Draw players
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const playerY = tableHeaderY + 40 + (i * this.playerRowHeight);
            await this.drawPlayerRow(ctx, player, playerY, i);
        }
    }

    /**
     * Draw table headers
     */
    async drawTableHeaders(ctx, y) {
        // Header background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
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
        currentX += this.nameWidth + this.avatarSize + 30;
        
        // Role header
        ctx.textAlign = 'center';
        ctx.fillText('Role', currentX + (this.roleWidth / 2), y + 22);
        currentX += this.roleWidth;
        
        // Donations header
        ctx.fillText('Donated', currentX + (this.donationWidth / 2), y + 22);
        currentX += this.donationWidth;
        
        // Received header
        ctx.fillText('Received', currentX + (this.receivedWidth / 2), y + 22);
        currentX += this.receivedWidth;
        
        // Ratio header
        ctx.fillText('Ratio', currentX + (this.ratioWidth / 2), y + 22);
        currentX += this.ratioWidth;
        
        // Last Online header
        ctx.fillText('Last Online', currentX + (this.lastOnlineWidth / 2), y + 22);
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

        // Rank
        ctx.fillStyle = this.getRankColor(player.rank);
        ctx.font = this.donationFont;
        ctx.textAlign = 'center';
        
        const rankText = this.getRankDisplay(player.rank);
        ctx.fillText(rankText, currentX + (this.rankWidth / 2), y + 35);
        currentX += this.rankWidth;

        // Player avatar
        const avatarX = currentX + 10;
        const avatarY = y + 7;
        await this.drawPlayerAvatar(ctx, player, avatarX, avatarY);

        // Player name
        ctx.fillStyle = this.textColor;
        ctx.font = this.playerFont;
        ctx.textAlign = 'left';
        
        const nameX = avatarX + this.avatarSize + 15;
        const nameY = y + 35; // Adjusted for larger text
        
        // Truncate name if too long
        let displayName = player.name || 'Unknown Player';
        if (displayName.length > 18) {
            displayName = displayName.substring(0, 15) + '...';
        }
        
        ctx.fillText(displayName, nameX, nameY);
        currentX += this.nameWidth + this.avatarSize + 30;

        // Player role
        ctx.fillStyle = this.getRoleColor(player.role);
        ctx.font = this.playerFont; // Increased font size
        ctx.textAlign = 'center';
        
        const roleText = this.formatRole(player.role);
        ctx.fillText(roleText, currentX + (this.roleWidth / 2), y + 35);
        currentX += this.roleWidth;

        // Donation count
        ctx.fillStyle = this.accentColor;
        ctx.font = this.donationFont;
        ctx.textAlign = 'center';
        
        const donationCount = this.formatDonationCount(player.donations || 0);
        ctx.fillText(donationCount, currentX + (this.donationWidth / 2), y + 35);
        currentX += this.donationWidth;

        // Received count
        ctx.fillStyle = '#f39c12'; // Orange color for received
        const receivedCount = this.formatDonationCount(player.donationsReceived || 0);
        ctx.fillText(receivedCount, currentX + (this.receivedWidth / 2), y + 35);
        currentX += this.receivedWidth;

        // Ratio
        ctx.fillStyle = this.secondaryColor;
        ctx.font = this.playerFont; // Increased font size
        const ratio = this.calculateRatio(player.donations || 0, player.donationsReceived || 0);
        ctx.fillText(ratio, currentX + (this.ratioWidth / 2), y + 35);
        currentX += this.ratioWidth;

        // Last Online
        ctx.fillStyle = '#95a5a6'; // Gray color for last online
        ctx.font = this.playerFont;
        ctx.textAlign = 'center';
        const lastOnlineText = this.formatLastOnline(player.lastSeen);
        ctx.fillText(lastOnlineText, currentX + (this.lastOnlineWidth / 2), y + 35);
    }

    /**
     * Draw player avatar
     */
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

    /**
     * Draw avatar placeholder
     */
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

    /**
     * Draw footer with additional info
     */
    async drawFooter(ctx, page, totalPages, canvasHeight) {
        const footerY = canvasHeight - 50;
        
        // Footer text
        ctx.fillStyle = this.secondaryColor;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        const updateTime = new Date().toLocaleString();
        ctx.fillText(`Last updated: ${updateTime}`, this.width / 2, footerY);
        
        // Navigation hint (only show if there are actually multiple pages)
        if (totalPages > 1) {
            ctx.fillText('Use buttons below to navigate pages', this.width / 2, footerY + 20);
        }
    }

    /**
     * Helper methods
     */
    
    formatLastOnline(lastSeen) {
        if (!lastSeen) return 'Unknown';
        
        const now = new Date();
        const lastSeenDate = new Date(lastSeen);
        const diffMs = now - lastSeenDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffDays > 30) {
            return '30+ days';
        } else if (diffDays >= 1) {
            return `${diffDays}d ago`;
        } else if (diffHours >= 1) {
            return `${diffHours}h ago`;
        } else if (diffMinutes >= 1) {
            return `${diffMinutes}m ago`;
        } else {
            return 'Just now';
        }
    }

    getRankColor(rank) {
        if (rank === 1) return '#ffd700'; // Gold
        if (rank === 2) return '#c0c0c0'; // Silver
        if (rank === 3) return '#cd7f32'; // Bronze
        return this.textColor;
    }

    getRankDisplay(rank) {
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
        const gradient = ctx.createLinearGradient(0, headerY, 0, headerY + this.headerHeight);
        gradient.addColorStop(0, 'rgba(231, 76, 60, 0.8)'); // Red war theme
        gradient.addColorStop(1, 'rgba(192, 57, 43, 0.6)');
        ctx.fillStyle = gradient;
        ctx.fillRect(this.padding, headerY, this.width - (this.padding * 2), this.headerHeight);

        // Title
        ctx.fillStyle = this.textColor;
        ctx.font = this.titleFont;
        ctx.textAlign = 'center';
        
        const centerX = this.width / 2;
        const titleY = headerY + 40;
        
        const clanName = config.clan_name || (warData.clanName || 'Clan');
        ctx.fillText(`⚔️ ${clanName} War Statistics`, centerX, titleY);

        // War status and current war info
        ctx.font = '16px Arial';
        ctx.fillStyle = this.secondaryColor;
        
        let warStatus = 'Historical War Performance';
        if (warData.currentWar) {
            const war = warData.currentWar;
            if (war.state === 'inWar') {
                warStatus = `🔥 Currently in War vs ${war.opponent?.name || 'Unknown Clan'}`;
            } else if (war.state === 'preparation') {
                warStatus = `⏳ Preparing for War vs ${war.opponent?.name || 'Unknown Clan'}`;
            }
        }
        
        ctx.fillText(warStatus, centerX, titleY + 25);

        // Page indicator for war stats
        if (totalPages > 1) {
            ctx.font = '14px Arial';
            ctx.fillText(`Page ${page} of ${totalPages}`, centerX, titleY + 45);
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
        ctx.fillStyle = 'rgba(231, 76, 60, 0.2)'; // War red theme
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
        currentX += this.nameWidth + this.avatarSize + 30;
        
        // Role header
        ctx.textAlign = 'center';
        ctx.fillText('Role', currentX + (this.roleWidth / 2), y + 22);
        currentX += this.roleWidth;
        
        // Current War Attacks header (wider to show attack details)
        ctx.fillText('Current War Attacks', currentX + (this.donationWidth * 1.5 / 2), y + 22);
        currentX += this.donationWidth * 1.5;
        
        // Average Stars header
        ctx.fillText('Avg Stars', currentX + (this.receivedWidth / 2), y + 22);
        currentX += this.receivedWidth;
        
        // Win Rate header
        ctx.fillText('Win Rate', currentX + (this.ratioWidth / 2), y + 22);
        currentX += this.ratioWidth;
        
        // War Participation header
        ctx.fillText('Wars', currentX + (this.lastOnlineWidth / 2), y + 22);
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

        // Rank
        ctx.fillStyle = this.getRankColor(player.rank || index + 1);
        ctx.font = this.donationFont;
        ctx.textAlign = 'center';
        
        const rankText = this.getRankDisplay(player.rank || index + 1);
        ctx.fillText(rankText, currentX + (this.rankWidth / 2), y + 35);
        currentX += this.rankWidth;

        // Player avatar
        const avatarX = currentX + 10;
        const avatarY = y + 7;
        await this.drawPlayerAvatar(ctx, player, avatarX, avatarY);

        // Player name
        ctx.fillStyle = this.textColor;
        ctx.font = this.playerFont;
        ctx.textAlign = 'left';
        
        const nameX = avatarX + this.avatarSize + 15;
        const nameY = y + 35;
        
        // Truncate name if too long
        let displayName = player.name || 'Unknown Player';
        if (displayName.length > 18) {
            displayName = displayName.substring(0, 15) + '...';
        }
        
        ctx.fillText(displayName, nameX, nameY);
        currentX += this.nameWidth + this.avatarSize + 30;

        // Player role
        ctx.fillStyle = this.getRoleColor(player.role);
        ctx.font = this.playerFont;
        ctx.textAlign = 'center';
        
        const roleText = this.formatRole(player.role);
        ctx.fillText(roleText, currentX + (this.roleWidth / 2), y + 35);
        currentX += this.roleWidth;

        // Current War Attack Details (like your image example)
        await this.drawCurrentWarAttacks(ctx, player, currentX, y);
        currentX += this.donationWidth * 1.5;

        // Average Stars (historical)
        ctx.fillStyle = '#f1c40f'; // Gold color for stars
        ctx.font = this.donationFont;
        ctx.textAlign = 'center';
        
        const avgStars = player.averageStars || '0.00';
        ctx.fillText(`${avgStars}⭐`, currentX + (this.receivedWidth / 2), y + 35);
        currentX += this.receivedWidth;

        // Win Rate
        ctx.fillStyle = this.secondaryColor;
        ctx.font = this.playerFont;
        const winRate = player.winRate || '0.0';
        ctx.fillText(`${winRate}%`, currentX + (this.ratioWidth / 2), y + 35);
        currentX += this.ratioWidth;

        // Wars Participated
        ctx.fillStyle = '#9b59b6'; // Purple for participation
        ctx.font = this.playerFont;
        ctx.textAlign = 'center';
        const participation = player.warsParticipated || 0;
        ctx.fillText(participation.toString(), currentX + (this.lastOnlineWidth / 2), y + 35);
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
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No attacks', x + (this.donationWidth * 1.5 / 2), y + 35);
            return;
        }

        // Draw each attack (similar to your image: 10 ⚔️ / 1 ⭐⭐⭐100%)
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        
        const attackAreaWidth = this.donationWidth * 1.5;
        const attackSpacing = 20; // Space between attacks
        
        for (let i = 0; i < Math.min(attackDetails.length, 2); i++) {
            const attack = attackDetails[i];
            const attackX = x + 10;
            const attackY = y + 20 + (i * 20); // Stack attacks vertically
            
            // Position and attack number (like "10 ⚔️")
            ctx.fillStyle = '#e74c3c'; // Red for position
            ctx.fillText(`${attack.defenderPosition || '?'}`, attackX, attackY);
            
            // Sword emoji
            ctx.fillStyle = '#95a5a6';
            ctx.fillText('⚔️', attackX + 25, attackY);
            
            // Attack number
            ctx.fillStyle = '#3498db'; // Blue for attack number
            ctx.fillText(`/${attack.attackNumber}`, attackX + 40, attackY);
            
            // Stars (⭐⭐⭐)
            ctx.fillStyle = '#f1c40f'; // Gold for stars
            let starsText = '';
            for (let s = 0; s < 3; s++) {
                starsText += s < attack.stars ? '⭐' : '☆';
            }
            ctx.fillText(starsText, attackX + 65, attackY);
            
            // Destruction percentage
            ctx.fillStyle = '#e67e22'; // Orange for destruction
            ctx.fillText(`${attack.destructionPercentage.toFixed(0)}%`, attackX + 120, attackY);
        }
        
        // If more than 2 attacks, show count
        if (attackDetails.length > 2) {
            ctx.fillStyle = '#95a5a6';
            ctx.font = '12px Arial';
            ctx.fillText(`+${attackDetails.length - 2} more`, x + 10, y + 60);
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
}

module.exports = LeaderboardCanvas;