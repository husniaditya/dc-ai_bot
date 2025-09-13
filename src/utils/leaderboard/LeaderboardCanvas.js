const { createCanvas, loadImage } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

class LeaderboardCanvas {
    constructor() {
        this.width = 800;
        this.height = 1000;
        this.backgroundColor = '#2c2f33';
        this.primaryColor = '#7289da';
        this.secondaryColor = '#99aab5';
        this.textColor = '#ffffff';
        this.accentColor = '#43b581';
        
        // Layout constants
        this.padding = 40;
        this.headerHeight = 120;
        this.playerRowHeight = 65;
        this.avatarSize = 50;
        this.rankWidth = 60;
        this.nameWidth = 300;
        this.donationWidth = 120;
        
        // Font settings
        this.titleFont = 'bold 32px Arial';
        this.headerFont = 'bold 18px Arial';
        this.playerFont = '16px Arial';
        this.donationFont = 'bold 16px Arial';
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
            // Create canvas
            const canvas = createCanvas(this.width, this.height);
            const ctx = canvas.getContext('2d');

            // Generate random background gradient colors if specified
            if (config.canvas_generate_random_color) {
                this.generateRandomColors();
            }

            // Draw background
            await this.drawBackground(ctx);
            
            // Draw header
            await this.drawHeader(ctx, config, page, totalPages);
            
            // Draw player list
            await this.drawPlayerList(ctx, players, config);
            
            // Draw footer with pagination info
            await this.drawFooter(ctx, page, totalPages);

            return canvas.toBuffer('image/png');
        } catch (error) {
            console.error('Error generating leaderboard canvas:', error);
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
    async drawBackground(ctx) {
        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, this.backgroundColor);
        gradient.addColorStop(0.5, this.lightenColor(this.backgroundColor, 10));
        gradient.addColorStop(1, this.backgroundColor);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);

        // Add subtle pattern overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        for (let x = 0; x < this.width; x += 20) {
            for (let y = 0; y < this.height; y += 20) {
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

        // Rank header
        ctx.fillText('#', this.padding + (this.rankWidth / 2), y + 22);
        
        // Player header
        ctx.textAlign = 'left';
        ctx.fillText('Player', this.padding + this.rankWidth + 20, y + 22);
        
        // Donations header
        ctx.textAlign = 'center';
        const donationX = this.width - this.padding - (this.donationWidth / 2);
        ctx.fillText('Donations', donationX, y + 22);
    }

    /**
     * Draw individual player row
     */
    async drawPlayerRow(ctx, player, y, index) {
        const isEven = index % 2 === 0;
        
        // Row background
        ctx.fillStyle = isEven ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(this.padding, y, this.width - (this.padding * 2), this.playerRowHeight);

        // Rank
        ctx.fillStyle = this.getRankColor(player.rank);
        ctx.font = this.donationFont;
        ctx.textAlign = 'center';
        
        const rankText = this.getRankDisplay(player.rank);
        ctx.fillText(rankText, this.padding + (this.rankWidth / 2), y + 35);

        // Player avatar (placeholder circle for now)
        const avatarX = this.padding + this.rankWidth + 10;
        const avatarY = y + 7;
        await this.drawPlayerAvatar(ctx, player, avatarX, avatarY);

        // Player name
        ctx.fillStyle = this.textColor;
        ctx.font = this.playerFont;
        ctx.textAlign = 'left';
        
        const nameX = avatarX + this.avatarSize + 15;
        const nameY = y + 25;
        
        // Truncate name if too long
        let displayName = player.name || 'Unknown Player';
        if (displayName.length > 20) {
            displayName = displayName.substring(0, 17) + '...';
        }
        
        ctx.fillText(displayName, nameX, nameY);

        // Player role/level if available
        if (player.role || player.expLevel) {
            ctx.fillStyle = this.secondaryColor;
            ctx.font = '12px Arial';
            const roleText = player.role ? `${player.role}` : `Lvl ${player.expLevel}`;
            ctx.fillText(roleText, nameX, nameY + 18);
        }

        // Donation count
        ctx.fillStyle = this.accentColor;
        ctx.font = this.donationFont;
        ctx.textAlign = 'center';
        
        const donationX = this.width - this.padding - (this.donationWidth / 2);
        const donationText = this.formatDonationCount(player.donations);
        ctx.fillText(donationText, donationX, y + 35);

        // Progress bar for donations (optional visual enhancement)
        if (player.maxDonations && player.maxDonations > 0) {
            const progressWidth = 100;
            const progressHeight = 4;
            const progressX = donationX - (progressWidth / 2);
            const progressY = y + 45;
            
            // Background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(progressX, progressY, progressWidth, progressHeight);
            
            // Progress
            const progress = Math.min(player.donations / player.maxDonations, 1);
            ctx.fillStyle = this.accentColor;
            ctx.fillRect(progressX, progressY, progressWidth * progress, progressHeight);
        }
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
    async drawFooter(ctx, page, totalPages) {
        const footerY = this.height - 50;
        
        // Footer text
        ctx.fillStyle = this.secondaryColor;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        const updateTime = new Date().toLocaleString();
        ctx.fillText(`Last updated: ${updateTime}`, this.width / 2, footerY);
        
        // Navigation hint
        if (totalPages > 1) {
            ctx.fillText('Use buttons below to navigate pages', this.width / 2, footerY + 20);
        }
    }

    /**
     * Helper methods
     */
    
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

    getTimeRangeText(timeRange) {
        const ranges = {
            'current_season': '🗓️ Current Season',
            'current_week': '📅 This Week',
            'current_month': '📊 This Month',
            'last_week': '📅 Last Week',
            'last_month': '📊 Last Month',
            'all_time': '⏰ All Time'
        };
        return ranges[timeRange] || '📊 Current Season';
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