// CWL Clan Management Integration - Advanced roster and performance management
class CWLClanManagement {
  constructor(sqlPool) {
    this.sqlPool = sqlPool;
  }

  /**
   * Get lineup recommendations based on performance
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} rosterSize - Size of CWL roster (15, 30, or 50)
   * @returns {Object} Lineup recommendations
   */
  async getLineupRecommendations(guildId, clanTag, season, rosterSize = 15) {
    try {
      // Get current season performance
      const [current] = await this.sqlPool.query(
        `SELECT 
          player_tag,
          player_name,
          SUM(stars_earned) as total_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(three_star) as three_stars,
          SUM(attacks_used) as attacks_used,
          SUM(attacks_remaining) as attacks_missed,
          COUNT(DISTINCT round_number) as rounds_participated
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         GROUP BY player_tag, player_name
         ORDER BY total_stars DESC, avg_destruction DESC`,
        [guildId, clanTag, season]
      );

      // Calculate performance scores
      const scoredPlayers = current.map(player => {
        const participationRate = player.attacks_used / (player.attacks_used + player.attacks_missed);
        const starEfficiency = player.attacks_used > 0 ? player.total_stars / player.attacks_used : 0;
        const threeStarRate = player.attacks_used > 0 ? player.three_stars / player.attacks_used : 0;

        // Performance score (weighted)
        const score = 
          (player.total_stars * 10) +                    // Raw stars (weight: 10)
          (player.avg_destruction * 5) +                 // Destruction (weight: 5)
          (threeStarRate * 100) +                        // Three-star rate (weight: 100)
          (participationRate * 50) +                     // Participation (weight: 50)
          (player.rounds_participated * 20);             // Rounds played (weight: 20)

        return {
          ...player,
          participation_rate: participationRate,
          star_efficiency: starEfficiency,
          three_star_rate: threeStarRate,
          performance_score: score
        };
      });

      // Sort by performance score
      scoredPlayers.sort((a, b) => b.performance_score - a.performance_score);

      return {
        recommended: scoredPlayers.slice(0, rosterSize),
        benched: scoredPlayers.slice(rosterSize),
        total_evaluated: scoredPlayers.length
      };
    } catch (error) {
      console.error('[CWL Management] Error getting lineup recommendations:', error.message);
      return null;
    }
  }

  /**
   * Detect inactive or underperforming players
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {Object} thresholds - Detection thresholds
   * @returns {Object} Inactive/underperforming players
   */
  async detectProblematicPlayers(guildId, clanTag, season, thresholds = {}) {
    const {
      minParticipationRate = 0.8,      // 80% attack completion
      minStarEfficiency = 1.5,         // 1.5 stars per attack
      minDestructionPercent = 50,      // 50% average destruction
      maxMissedAttacks = 2             // Max 2 missed attacks
    } = thresholds;

    try {
      const [players] = await this.sqlPool.query(
        `SELECT 
          player_tag,
          player_name,
          SUM(stars_earned) as total_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(attacks_used) as attacks_used,
          SUM(attacks_remaining) as attacks_missed,
          COUNT(DISTINCT round_number) as rounds_participated
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         GROUP BY player_tag, player_name`,
        [guildId, clanTag, season]
      );

      const inactive = [];
      const underperforming = [];
      const warnings = [];

      for (const player of players) {
        const participationRate = player.attacks_used / (player.attacks_used + player.attacks_missed);
        const starEfficiency = player.attacks_used > 0 ? player.total_stars / player.attacks_used : 0;

        const issues = [];

        // Check participation
        if (player.attacks_missed > maxMissedAttacks) {
          issues.push(`Missed ${player.attacks_missed} attacks`);
        }

        if (participationRate < minParticipationRate) {
          issues.push(`Low participation: ${(participationRate * 100).toFixed(1)}%`);
        }

        // Check performance
        if (starEfficiency < minStarEfficiency && player.attacks_used >= 3) {
          issues.push(`Low stars: ${starEfficiency.toFixed(2)}/attack`);
        }

        if (player.avg_destruction < minDestructionPercent && player.attacks_used >= 3) {
          issues.push(`Low destruction: ${(parseFloat(player.avg_destruction) || 0).toFixed(1)}%`);
        }

        // Categorize
        if (player.attacks_missed >= 3) {
          inactive.push({ ...player, issues });
        } else if (issues.length >= 2) {
          underperforming.push({ ...player, issues });
        } else if (issues.length === 1) {
          warnings.push({ ...player, issues });
        }
      }

      return {
        inactive,
        underperforming,
        warnings
      };
    } catch (error) {
      console.error('[CWL Management] Error detecting problematic players:', error.message);
      return null;
    }
  }

  /**
   * Generate roster management report
   */
  async generateRosterReportEmbed(guildId, clanTag, season, rosterSize = 15) {
    const lineup = await this.getLineupRecommendations(guildId, clanTag, season, rosterSize);
    if (!lineup) return null;

    const topPlayers = lineup.recommended.slice(0, 10)
      .map((p, i) => 
        `${i + 1}. **${p.player_name}**: ${p.total_stars}⭐ | ${(parseFloat(p.avg_destruction) || 0).toFixed(1)}% | Score: ${(parseFloat(p.performance_score) || 0).toFixed(0)}`
      )
      .join('\n') || 'No data';

    const benchWarnings = lineup.benched.length > 0 ? 
      `⚠️ ${lineup.benched.length} players below roster cutoff` : 
      '✅ All active players performing well';

    return {
      title: '📋 Roster Management Report',
      description: `Season ${season} - Recommended ${rosterSize}-player lineup`,
      color: 0x3498db,
      fields: [
        {
          name: '🏆 Top Performers',
          value: topPlayers,
          inline: false
        },
        {
          name: '📊 Roster Status',
          value: `**Evaluated:** ${lineup.total_evaluated} players\n` +
                 `**Recommended:** ${lineup.recommended.length}\n` +
                 `**Benched:** ${lineup.benched.length}\n\n` +
                 benchWarnings,
          inline: false
        }
      ],
      timestamp: new Date()
    };
  }

  /**
   * Generate performance alerts embed
   */
  async generatePerformanceAlertsEmbed(guildId, clanTag, season, thresholds) {
    const issues = await this.detectProblematicPlayers(guildId, clanTag, season, thresholds);
    if (!issues) return null;

    const { inactive, underperforming, warnings } = issues;

    if (inactive.length === 0 && underperforming.length === 0 && warnings.length === 0) {
      return {
        title: '✅ No Performance Issues',
        description: 'All players are performing well!',
        color: 0x2ecc71
      };
    }

    const fields = [];

    if (inactive.length > 0) {
      const inactiveList = inactive
        .slice(0, 10)
        .map(p => `**${p.player_name}**: ${p.issues.join(', ')}`)
        .join('\n');
      
      fields.push({
        name: '🚨 Inactive Players',
        value: inactiveList,
        inline: false
      });
    }

    if (underperforming.length > 0) {
      const underperformingList = underperforming
        .slice(0, 10)
        .map(p => `**${p.player_name}**: ${p.issues.join(', ')}`)
        .join('\n');
      
      fields.push({
        name: '⚠️ Underperforming',
        value: underperformingList,
        inline: false
      });
    }

    if (warnings.length > 0) {
      fields.push({
        name: '💡 Minor Issues',
        value: `${warnings.length} players with minor performance concerns`,
        inline: false
      });
    }

    return {
      title: '📊 Performance Alerts',
      description: `Season ${season} - Player Performance Analysis`,
      color: 0xe67e22,
      fields,
      timestamp: new Date()
    };
  }

  /**
   * Get attack timing recommendations
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Current round
   * @returns {Object} Attack timing recommendations
   */
  async getAttackTimingRecommendations(guildId, clanTag, season, roundNumber) {
    try {
      // Get players who haven't attacked yet
      const [pending] = await this.sqlPool.query(
        `SELECT 
          player_tag,
          player_name,
          attacks_remaining
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?
         AND attacks_remaining > 0
         ORDER BY attacks_remaining DESC`,
        [guildId, clanTag, season, roundNumber]
      );

      // Get historical performance to prioritize
      const prioritized = [];
      for (const player of pending) {
        const [history] = await this.sqlPool.query(
          `SELECT 
            AVG(stars_earned) as avg_stars,
            AVG(destruction_percentage) as avg_destruction
           FROM guild_clashofclans_cwl_player_performance
           WHERE guild_id = ? AND clan_tag = ? AND player_tag = ?
           AND season = ? AND round_number < ? AND attacks_used > 0`,
          [guildId, clanTag, player.player_tag, season, roundNumber]
        );

        const stats = history[0] || { avg_stars: 0, avg_destruction: 0 };
        prioritized.push({
          ...player,
          avg_stars: stats.avg_stars,
          avg_destruction: stats.avg_destruction,
          priority_score: (stats.avg_stars * 50) + (stats.avg_destruction * 0.5)
        });
      }

      // Sort by priority (best performers should attack strategically)
      prioritized.sort((a, b) => b.priority_score - a.priority_score);

      return {
        high_priority: prioritized.filter(p => p.priority_score > 150).slice(0, 5),
        medium_priority: prioritized.filter(p => p.priority_score > 100 && p.priority_score <= 150),
        low_priority: prioritized.filter(p => p.priority_score <= 100),
        total_pending: pending.length
      };
    } catch (error) {
      console.error('[CWL Management] Error getting attack timing:', error.message);
      return null;
    }
  }

  /**
   * Generate attack coordination embed
   */
  async generateAttackCoordinationEmbed(guildId, clanTag, season, roundNumber) {
    const timing = await this.getAttackTimingRecommendations(guildId, clanTag, season, roundNumber);
    if (!timing) return null;

    const highPriority = timing.high_priority
      .map(p => `**${p.player_name}**: ${p.attacks_remaining} attacks (⭐${p.avg_stars.toFixed(1)} avg)`)
      .join('\n') || 'None';

    const embed = {
      title: '⚔️ Attack Coordination',
      description: `Round ${roundNumber} - Strategic Attack Order`,
      color: 0xe74c3c,
      fields: [
        {
          name: '📊 Status',
          value: `**Pending Attacks:** ${timing.total_pending}\n` +
                 `**High Priority:** ${timing.high_priority.length}\n` +
                 `**Medium Priority:** ${timing.medium_priority.length}\n` +
                 `**Low Priority:** ${timing.low_priority.length}`,
          inline: false
        },
        {
          name: '🎯 Priority Attackers',
          value: highPriority,
          inline: false
        },
        {
          name: '💡 Strategy Tip',
          value: 'High-priority players should wait for opponent clan to attack first for better target selection.',
          inline: false
        }
      ],
      timestamp: new Date()
    };

    return embed;
  }

  /**
   * Get clan roster from external source (placeholder for integration)
   * @param {string} clanTag - Clan tag
   * @returns {Array} Clan roster
   */
  async getClanRosterFromAPI(clanTag) {
    // This would integrate with Clash of Clans API or clan management tools
    // Placeholder for now
    console.log('[CWL Management] External roster fetch not yet implemented');
    return [];
  }

  /**
   * Compare CWL roster with clan roster
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} Roster comparison
   */
  async compareRosters(guildId, clanTag, season) {
    try {
      // Get CWL participants
      const [cwlPlayers] = await this.sqlPool.query(
        `SELECT DISTINCT player_tag, player_name
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );

      // Get full clan roster (would integrate with API)
      const clanRoster = await this.getClanRosterFromAPI(clanTag);

      // Find players not in CWL
      const notInCWL = clanRoster.filter(
        member => !cwlPlayers.some(p => p.player_tag === member.tag)
      );

      return {
        cwl_participants: cwlPlayers.length,
        clan_total: clanRoster.length,
        not_in_cwl: notInCWL
      };
    } catch (error) {
      console.error('[CWL Management] Error comparing rosters:', error.message);
      return null;
    }
  }
}

module.exports = CWLClanManagement;
