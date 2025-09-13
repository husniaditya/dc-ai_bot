const axios = require('axios');

/**
 * Clash of Clans API service for fetching clan and player data
 * Handles API authentication, rate limiting, and data processing
 */
class ClashOfClansAPI {
    constructor() {
        this.baseURL = 'https://api.clashofclans.com/v1';
        this.apiKey = process.env.COC_API_KEY;
        this.requestCache = new Map();
        this.rateLimitDelay = 1000; // 1 second between requests
        this.lastRequestTime = 0;
    }

    /**
     * Makes authenticated request to CoC API with rate limiting
     * @param {string} endpoint - API endpoint
     * @returns {Object} API response data
     */
    async makeRequest(endpoint) {
        try {
            // Check cache first
            const cacheKey = endpoint;
            const cached = this.requestCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
                return cached.data;
            }

            // Rate limiting
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.rateLimitDelay) {
                await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
            }

            const response = await axios.get(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            this.lastRequestTime = Date.now();

            // Cache the response
            this.requestCache.set(cacheKey, {
                data: response.data,
                timestamp: Date.now()
            });

            return response.data;

        } catch (error) {
            console.error(`CoC API request failed for ${endpoint}:`, error.message);
            
            if (error.response?.status === 404) {
                throw new Error('Clan not found');
            } else if (error.response?.status === 403) {
                throw new Error('API key invalid or insufficient permissions');
            } else if (error.response?.status === 429) {
                throw new Error('API rate limit exceeded');
            } else {
                throw new Error(`API request failed: ${error.message}`);
            }
        }
    }

    /**
     * Gets clan information by clan tag
     * @param {string} clanTag - Clan tag (with or without #)
     * @returns {Object} Clan data
     */
    async getClan(clanTag) {
        const tag = this.formatClanTag(clanTag);
        const endpoint = `/clans/${encodeURIComponent(tag)}`;
        return await this.makeRequest(endpoint);
    }

    /**
     * Gets clan members with donation data
     * @param {string} clanTag - Clan tag
     * @returns {Object} Clan members data
     */
    async getClanMembers(clanTag) {
        const tag = this.formatClanTag(clanTag);
        const endpoint = `/clans/${encodeURIComponent(tag)}/members`;
        return await this.makeRequest(endpoint);
    }

    /**
     * Gets aggregated donation data for multiple clans
     * @param {string|Array} clans - Clan tag(s) - can be comma-separated string or array
     * @param {string} timeRange - Time range filter
     * @returns {Object} Formatted donation leaderboard data
     */
    async getClanDonationData(clans, timeRange = 'current_season') {
        try {
            // Parse clans input
            const clanTags = Array.isArray(clans) ? clans : (clans || '').split(',').map(tag => tag.trim()).filter(Boolean);
            
            if (clanTags.length === 0) {
                throw new Error('No clan tags provided');
            }

            console.log(`Fetching donation data for ${clanTags.length} clan(s): ${clanTags.join(', ')}`);

            const allPlayers = [];
            let primaryClanName = '';

            // Fetch data for each clan
            for (const clanTag of clanTags) {
                try {
                    const [clanInfo, clanMembers] = await Promise.all([
                        this.getClan(clanTag),
                        this.getClanMembers(clanTag)
                    ]);

                    // Use first clan name as primary
                    if (!primaryClanName) {
                        primaryClanName = clanInfo.name;
                    }

                    // Process each member
                    for (const member of clanMembers.items) {
                        const playerData = {
                            tag: member.tag,
                            name: member.name,
                            role: member.role,
                            donations: member.donations || 0,
                            donationsReceived: member.donationsReceived || 0,
                            clanTag: clanTag,
                            clanName: clanInfo.name,
                            expLevel: member.expLevel || 1,
                            trophies: member.trophies || 0,
                            versusTrophies: member.versusTrophies || 0,
                            clanRank: member.clanRank || 0,
                            previousClanRank: member.previousClanRank || 0
                        };

                        allPlayers.push(playerData);
                    }

                } catch (error) {
                    console.error(`Failed to fetch data for clan ${clanTag}:`, error.message);
                    // Continue with other clans even if one fails
                }
            }

            if (allPlayers.length === 0) {
                throw new Error('No player data could be retrieved from any clan');
            }

            // Apply time range filtering (for future implementation)
            const filteredPlayers = this.filterPlayersByTimeRange(allPlayers, timeRange);

            // Sort players by donations (descending)
            const sortedPlayers = filteredPlayers.sort((a, b) => b.donations - a.donations);

            // Add ranking
            sortedPlayers.forEach((player, index) => {
                player.rank = index + 1;
            });

            console.log(`Successfully processed ${sortedPlayers.length} players from ${clanTags.length} clan(s)`);

            return {
                players: sortedPlayers,
                clanName: clanTags.length === 1 ? primaryClanName : `${primaryClanName} (+${clanTags.length - 1} more)`,
                totalClans: clanTags.length,
                timeRange,
                lastUpdated: new Date().toISOString(),
                seasonInfo: this.getCurrentSeasonInfo()
            };

        } catch (error) {
            console.error('Error fetching clan donation data:', error);
            throw error;
        }
    }

    /**
     * Filters players based on time range (placeholder for future implementation)
     * @param {Array} players - Player data array
     * @param {string} timeRange - Time range filter
     * @returns {Array} Filtered players
     */
    filterPlayersByTimeRange(players, timeRange) {
        // For now, return all players since CoC API doesn't provide historical data
        // In a real implementation, you'd need to store historical data in your database
        
        switch (timeRange) {
            case 'current_season':
                // Current season data (this is what CoC API provides by default)
                return players;
            case 'last_7_days':
            case 'last_30_days':
            case 'all_time':
                // These would require historical data tracking
                console.warn(`Time range '${timeRange}' not fully implemented - using current season data`);
                return players;
            default:
                return players;
        }
    }

    /**
     * Gets current season information
     * @returns {Object} Season info
     */
    getCurrentSeasonInfo() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 0-based to 1-based
        
        return {
            current_season: `${year}-${month.toString().padStart(2, '0')}`,
            season_start: new Date(year, now.getMonth(), 1).toISOString(),
            season_end: new Date(year, now.getMonth() + 1, 0).toISOString()
        };
    }

    /**
     * Formats clan tag to ensure it starts with #
     * @param {string} tag - Clan tag
     * @returns {string} Formatted tag
     */
    formatClanTag(tag) {
        if (!tag) return '';
        return tag.startsWith('#') ? tag : `#${tag}`;
    }

    /**
     * Validates clan tag format
     * @param {string} tag - Clan tag to validate
     * @returns {boolean} Whether tag is valid
     */
    isValidClanTag(tag) {
        if (!tag) return false;
        const cleanTag = tag.replace('#', '');
        return /^[0289PYLQGRJCUV]{3,9}$/.test(cleanTag.toUpperCase());
    }

    /**
     * Gets player information by player tag
     * @param {string} playerTag - Player tag
     * @returns {Object} Player data
     */
    async getPlayer(playerTag) {
        const tag = this.formatClanTag(playerTag); // Same format as clan tags
        const endpoint = `/players/${encodeURIComponent(tag)}`;
        return await this.makeRequest(endpoint);
    }

    /**
     * Clears request cache (useful for forced refreshes)
     */
    clearCache() {
        this.requestCache.clear();
        console.log('CoC API cache cleared');
    }
}

module.exports = new ClashOfClansAPI();