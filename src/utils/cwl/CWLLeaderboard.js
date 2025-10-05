// CWL Leaderboard Manager - Track and display live CWL standings
class CWLLeaderboard {
  constructor(sqlPool) {
    this.sqlPool = sqlPool;
  }

  /**
   * Update standings for a specific round
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag (cleaned, without #)
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Round number
   * @param {Object} leagueGroup - League group data from API
   */
  async updateRoundStandings(guildId, clanTag, season, roundNumber, leagueGroup) {
    try {
      // Clean tag helper
      const cleanTag = (tag) => {
        if (!tag) return null;
        return tag.replace(/^#/, '').toUpperCase();
      };
      
      const ourClanTag = cleanTag(clanTag);
      
      // Find our clan in the league group (compare cleaned tags)
      const ourClan = leagueGroup.clans.find(c => cleanTag(c.tag) === ourClanTag);
      
      if (!ourClan) {
        console.warn('[CWL Leaderboard] Could not find our clan in league group');
        console.warn(`[CWL Leaderboard] Looking for: ${ourClanTag}, Available: ${leagueGroup.clans.map(c => cleanTag(c.tag)).join(', ')}`);
        return;
      }

      // Sort clans by stars and destruction to get positions
      const sortedClans = [...leagueGroup.clans].sort((a, b) => {
        // First by stars
        if (b.stars !== a.stars) return b.stars - a.stars;
        // Then by destruction percentage
        return b.destructionPercentage - a.destructionPercentage;
      });

      const position = sortedClans.findIndex(c => cleanTag(c.tag) === ourClanTag) + 1;

      // Calculate wins/losses from rounds
      let wins = 0;
      let losses = 0;

      if (leagueGroup.rounds && roundNumber > 0) {
        for (let i = 0; i < Math.min(roundNumber, leagueGroup.rounds.length); i++) {
          const round = leagueGroup.rounds[i];
          const warTag = round.warTags.find(wt => wt.includes(clanTag.replace('#', '')));
          
          // We'll need to fetch individual war to know win/loss
          // For now, estimate from stars
        }
      }

      await this.sqlPool.query(
        `INSERT INTO guild_clashofclans_cwl_round_standings (
          guild_id, clan_tag, season, round_number,
          position, stars_earned, destruction_percentage,
          wins, losses, league_name, total_clans
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          position = VALUES(position),
          stars_earned = VALUES(stars_earned),
          destruction_percentage = VALUES(destruction_percentage),
          wins = VALUES(wins),
          losses = VALUES(losses),
          updated_at = CURRENT_TIMESTAMP`,
        [
          guildId,
          clanTag,
          season,
          roundNumber,
          position,
          ourClan.stars || 0,
          ourClan.destructionPercentage || 0,
          wins,
          losses,
          leagueGroup.league?.name || 'Unknown',
          leagueGroup.clans.length
        ]
      );

      // Also update the main CWL state table with aggregate stats
      await this.sqlPool.query(
        `UPDATE guild_clashofclans_cwl_state
         SET total_stars = ?, total_destruction = ?, predicted_position = ?
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [
          ourClan.stars || 0,
          ourClan.destructionPercentage || 0,
          position,
          guildId,
          clanTag,
          season
        ]
      );

      console.log(`[CWL Leaderboard] Updated standings: Round ${roundNumber}, Position ${position}/${leagueGroup.clans.length}`);
    } catch (error) {
      console.error('[CWL Leaderboard] Error updating round standings:', error.message);
    }
  }

  /**
   * Get current standings for display
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Array} Current standings
   */
  async getCurrentStandings(guildId, clanTag, season) {
    try {
      const [rows] = await this.sqlPool.query(
        `SELECT *
         FROM guild_clashofclans_cwl_round_standings
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         ORDER BY round_number DESC
         LIMIT 1`,
        [guildId, clanTag, season]
      );

      return rows[0] || null;
    } catch (error) {
      console.error('[CWL Leaderboard] Error getting current standings:', error.message);
      return null;
    }
  }

  /**
   * Get standings history for all rounds
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Array} Standings history
   */
  async getStandingsHistory(guildId, clanTag, season) {
    try {
      const [rows] = await this.sqlPool.query(
        `SELECT *
         FROM guild_clashofclans_cwl_round_standings
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         ORDER BY round_number ASC`,
        [guildId, clanTag, season]
      );

      return rows;
    } catch (error) {
      console.error('[CWL Leaderboard] Error getting standings history:', error.message);
      return [];
    }
  }

  /**
   * Generate leaderboard embed data
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} Embed data
   */
  async generateLeaderboardEmbed(guildId, clanTag, season) {
    try {
      const current = await this.getCurrentStandings(guildId, clanTag, season);
      
      if (!current) {
        return null;
      }

      const history = await this.getStandingsHistory(guildId, clanTag, season);
      
      // Calculate position trend
      let trend = '➡️'; // Stable
      if (history.length >= 2) {
        const previous = history[history.length - 2];
        if (current.position < previous.position) {
          trend = '📈'; // Improved
        } else if (current.position > previous.position) {
          trend = '📉'; // Declined
        }
      }

      return {
        title: `🏆 CWL Leaderboard - Round ${current.round_number}`,
        description: `${current.league_name} League`,
        fields: [
          {
            name: 'Position',
            value: `${trend} **${current.position}** / ${current.total_clans}`,
            inline: true
          },
          {
            name: 'Total Stars',
            value: `⭐ ${current.stars_earned}`,
            inline: true
          },
          {
            name: 'Destruction',
            value: `💥 ${current.destruction_percentage.toFixed(2)}%`,
            inline: true
          },
          {
            name: 'Record',
            value: `${current.wins}W - ${current.losses}L`,
            inline: true
          }
        ],
        color: current.position <= 3 ? 0x00FF00 : (current.position <= 5 ? 0xFFFF00 : 0xFF0000),
        timestamp: new Date(),
        footer: {
          text: `Season ${season} • Updated`
        }
      };
    } catch (error) {
      console.error('[CWL Leaderboard] Error generating leaderboard embed:', error.message);
      return null;
    }
  }

  /**
   * Store or update leaderboard message ID
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Round number
   * @param {string} messageId - Discord message ID
   */
  async updateLeaderboardMessageId(guildId, clanTag, season, roundNumber, messageId) {
    try {
      await this.sqlPool.query(
        `UPDATE guild_clashofclans_cwl_round_standings
         SET leaderboard_message_id = ?
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?`,
        [messageId, guildId, clanTag, season, roundNumber]
      );
    } catch (error) {
      console.error('[CWL Leaderboard] Error updating message ID:', error.message);
    }
  }
}

module.exports = CWLLeaderboard;
