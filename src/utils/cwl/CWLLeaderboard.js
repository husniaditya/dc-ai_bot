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
   * @param {Object} warData - War data from API (contains this round's results)
   */
  async updateRoundStandings(guildId, clanTag, season, roundNumber, leagueGroup, warData) {
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
        // console.warn('[CWL Leaderboard] Could not find our clan in league group');
        // console.warn(`[CWL Leaderboard] Looking for: ${ourClanTag}, Available: ${leagueGroup.clans.map(c => cleanTag(c.tag)).join(', ')}`);
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
      
      // console.log(`[CWL Leaderboard] Position calculation for round ${roundNumber}:`);
      // console.log(`[CWL Leaderboard] Our clan stars: ${ourClan.stars}, Our position: ${position}/${sortedClans.length}`);
      // console.log(`[CWL Leaderboard] Top 3: ${sortedClans.slice(0, 3).map((c, i) => `${i+1}. ${c.name} (${c.stars}⭐)`).join(', ')}`);

      // Get round-specific war result data
      let roundStars = 0;
      let roundDestruction = 0;
      let isWin = false;
      let isLoss = false;

      if (warData && warData.clan) {
        // Use the specific war data for this round
        roundStars = warData.clan.stars || 0;
        roundDestruction = warData.clan.destructionPercentage || 0;
        
        // Determine win/loss from war result
        if (warData.state === 'warEnded') {
          const ourStars = warData.clan.stars || 0;
          const theirStars = warData.opponent?.stars || 0;
          
          if (ourStars > theirStars) {
            isWin = true;
          } else if (ourStars < theirStars) {
            isLoss = true;
          } else {
            // Tie on stars, check destruction
            const ourDestruction = warData.clan.destructionPercentage || 0;
            const theirDestruction = warData.opponent?.destructionPercentage || 0;
            if (ourDestruction > theirDestruction) {
              isWin = true;
            } else if (ourDestruction < theirDestruction) {
              isLoss = true;
            }
          }
        }
      }

      // Calculate cumulative wins/losses
      // Get the most recent round's cumulative values (not SUM, as each round already stores cumulative)
      const [previousRounds] = await this.sqlPool.query(
        `SELECT wins as total_wins, losses as total_losses
         FROM guild_clashofclans_cwl_round_standings
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number < ?
         ORDER BY round_number DESC
         LIMIT 1`,
        [guildId, clanTag, season, roundNumber]
      );
      
      const cumulativeWins = (previousRounds[0]?.total_wins || 0) + (isWin ? 1 : 0);
      const cumulativeLosses = (previousRounds[0]?.total_losses || 0) + (isLoss ? 1 : 0);
      
      // console.log(`[CWL Leaderboard] Win/Loss calculation for round ${roundNumber}:`);
      // console.log(`[CWL Leaderboard] Previous: ${previousRounds[0]?.total_wins || 0}W-${previousRounds[0]?.total_losses || 0}L, This round: ${isWin ? 'WIN' : (isLoss ? 'LOSS' : 'TIE')}, New total: ${cumulativeWins}W-${cumulativeLosses}L`);

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
          roundStars,
          roundDestruction,
          cumulativeWins,
          cumulativeLosses,
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

      // console.log(`[CWL Leaderboard] Updated standings: Round ${roundNumber}, Position ${position}/${leagueGroup.clans.length}`);
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
