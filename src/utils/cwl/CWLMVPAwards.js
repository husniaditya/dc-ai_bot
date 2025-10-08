// CWL MVP Awards - Identify and announce best performers per round
const { EmbedBuilder } = require('discord.js');

class CWLMVPAwards {
  constructor(sqlPool) {
    this.sqlPool = sqlPool;
  }

  /**
   * Calculate MVP for a specific round
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Round number
   * @returns {Object} MVP data
   */
  async calculateRoundMVP(guildId, clanTag, season, roundNumber) {
    try {
      const [performances] = await this.sqlPool.query(
        `SELECT 
          player_tag,
          player_name,
          SUM(stars_earned) as total_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(three_star) as three_star_count,
          COUNT(*) as attacks_made
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?
         AND attacks_used > 0
         GROUP BY player_tag, player_name
         ORDER BY total_stars DESC, avg_destruction DESC
         LIMIT 1`,
        [guildId, clanTag, season, roundNumber]
      );

      if (performances.length === 0) {
        return null;
      }

      return performances[0];
    } catch (error) {
      console.error('[CWL MVP] Error calculating round MVP:', error.message);
      return null;
    }
  }

  /**
   * Calculate season-long MVP
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} Season MVP data
   */
  async calculateSeasonMVP(guildId, clanTag, season) {
    try {
      const [performances] = await this.sqlPool.query(
        `SELECT 
          player_tag,
          player_name,
          SUM(stars_earned) as total_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(three_star) as three_star_count,
          COUNT(DISTINCT round_number) as rounds_participated,
          COUNT(*) as total_attacks
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         AND attacks_used > 0
         GROUP BY player_tag, player_name
         HAVING rounds_participated >= 3
         ORDER BY total_stars DESC, avg_destruction DESC
         LIMIT 1`,
        [guildId, clanTag, season]
      );

      if (performances.length === 0) {
        return null;
      }

      return performances[0];
    } catch (error) {
      console.error('[CWL MVP] Error calculating season MVP:', error.message);
      return null;
    }
  }

  /**
   * Get multiple award categories for a round
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Round number
   * @returns {Object} Award categories
   */
  async getRoundAwards(guildId, clanTag, season, roundNumber) {
    try {
      // Most Stars
      const [mostStars] = await this.sqlPool.query(
        `SELECT player_name, SUM(stars_earned) as total_stars
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?
         AND attacks_used > 0
         GROUP BY player_tag, player_name
         ORDER BY total_stars DESC LIMIT 1`,
        [guildId, clanTag, season, roundNumber]
      );

      // Most Destruction
      const [mostDestruction] = await this.sqlPool.query(
        `SELECT player_name, AVG(destruction_percentage) as avg_destruction
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?
         AND attacks_used > 0
         GROUP BY player_tag, player_name
         ORDER BY avg_destruction DESC LIMIT 1`,
        [guildId, clanTag, season, roundNumber]
      );

      // Three Star Master
      const [threeStarMaster] = await this.sqlPool.query(
        `SELECT player_name, SUM(three_star) as three_star_count
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?
         AND three_star = 1
         GROUP BY player_tag, player_name
         ORDER BY three_star_count DESC LIMIT 1`,
        [guildId, clanTag, season, roundNumber]
      );

      return {
        mostStars: mostStars.length > 0 ? mostStars[0] : null,
        mostDestruction: mostDestruction.length > 0 ? mostDestruction[0] : null,
        threeStarMaster: threeStarMaster.length > 0 ? threeStarMaster[0] : null
      };
    } catch (error) {
      console.error('[CWL MVP] Error getting round awards:', error.message);
      return {
        mostStars: null,
        mostDestruction: null,
        threeStarMaster: null
      };
    }
  }

  /**
   * Generate MVP announcement embed for a round
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Round number
   * @returns {Object} Discord embed
   */
  async generateRoundMVPEmbed(guildId, clanTag, season, roundNumber) {
    try {
      const awards = await this.getRoundAwards(guildId, clanTag, season, roundNumber);

      if (!awards.mostStars && !awards.mostDestruction && !awards.threeStarMaster) {
        return null;
      }

      const fields = [];

      if (awards.mostStars) {
        fields.push({
          name: '⭐ Most Stars',
          value: `**${awards.mostStars.player_name}**\n${awards.mostStars.total_stars} stars`,
          inline: true
        });
      }

      if (awards.mostDestruction) {
        fields.push({
          name: '💥 Best Destruction',
          value: `**${awards.mostDestruction.player_name}**\n${(parseFloat(awards.mostDestruction.avg_destruction) || 0).toFixed(2)}%`,
          inline: true
        });
      }

      if (awards.threeStarMaster) {
        fields.push({
          name: '🌟 Three Star Master',
          value: `**${awards.threeStarMaster.player_name}**\n${awards.threeStarMaster.three_star_count} perfect attacks`,
          inline: true
        });
      }

      return {
        title: `🏆 CWL Round ${roundNumber} MVP Awards`,
        description: 'Outstanding performances this round!',
        color: 0xFFD700, // Gold
        fields: fields,
        timestamp: new Date(),
        footer: {
          text: `Season ${season}`
        }
      };
    } catch (error) {
      console.error('[CWL MVP] Error generating round MVP embed:', error.message);
      return null;
    }
  }

  /**
   * Generate season MVP announcement
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} Discord embed
   */
  async generateSeasonMVPEmbed(guildId, clanTag, season) {
    try {
      const mvp = await this.calculateSeasonMVP(guildId, clanTag, season);

      if (!mvp) {
        return null;
      }

      // Get top 5 performers
      const [top5] = await this.sqlPool.query(
        `SELECT 
          player_name,
          SUM(stars_earned) as total_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(three_star) as three_star_count
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         AND attacks_used > 0
         GROUP BY player_tag, player_name
         HAVING COUNT(DISTINCT round_number) >= 3
         ORDER BY total_stars DESC, avg_destruction DESC
         LIMIT 5`,
        [guildId, clanTag, season]
      );

      const leaderboard = top5.map((p, idx) => 
        `${idx + 1}. **${p.player_name}** - ${p.total_stars}⭐ (${(parseFloat(p.avg_destruction) || 0).toFixed(1)}%)`
      ).join('\n');

      return {
        title: '👑 CWL Season MVP',
        description: `**${mvp.player_name}** is the CWL MVP!`,
        color: 0xFFD700, // Gold
        thumbnail: {
          url: 'https://cdn.discordapp.com/emojis/1234567890.png' // Add trophy emoji
        },
        fields: [
          {
            name: '⭐ Total Stars',
            value: `${mvp.total_stars}`,
            inline: true
          },
          {
            name: '💥 Avg Destruction',
            value: `${(parseFloat(mvp.avg_destruction) || 0).toFixed(2)}%`,
            inline: true
          },
          {
            name: '🌟 Three Stars',
            value: `${mvp.three_star_count}`,
            inline: true
          },
          {
            name: '🎯 Rounds Participated',
            value: `${mvp.rounds_participated}/7`,
            inline: true
          },
          {
            name: '⚔️ Total Attacks',
            value: `${mvp.total_attacks}`,
            inline: true
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true
          },
          {
            name: '🏅 Top 5 Performers',
            value: leaderboard || 'No data',
            inline: false
          }
        ],
        timestamp: new Date(),
        footer: {
          text: `Season ${season} • Congratulations!`
        }
      };
    } catch (error) {
      console.error('[CWL MVP] Error generating season MVP embed:', error.message);
      return null;
    }
  }

  /**
   * Store MVP data in database for history
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Round number (null for season MVP)
   * @param {Object} mvpData - MVP data
   */
  async storeMVPRecord(guildId, clanTag, season, roundNumber, mvpData) {
    try {
      // Could create a separate MVP history table if needed
      // For now, MVP data is calculated on-demand from performance data
      console.log(`[CWL MVP] MVP for ${clanTag} Round ${roundNumber || 'Season'}: ${mvpData.player_name}`);
    } catch (error) {
      console.error('[CWL MVP] Error storing MVP record:', error.message);
    }
  }
}

module.exports = CWLMVPAwards;
