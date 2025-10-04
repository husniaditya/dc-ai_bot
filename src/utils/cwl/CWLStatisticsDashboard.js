// CWL Statistics Dashboard - Comprehensive analytics and insights
class CWLStatisticsDashboard {
  constructor(sqlPool) {
    this.sqlPool = sqlPool;
  }

  /**
   * Get complete dashboard statistics
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} Dashboard data
   */
  async getDashboardStats(guildId, clanTag, season) {
    try {
      const stats = {
        overview: await this.getOverviewStats(guildId, clanTag, season),
        topPerformers: await this.getTopPerformers(guildId, clanTag, season),
        attackEfficiency: await this.getAttackEfficiency(guildId, clanTag, season),
        participation: await this.getParticipation(guildId, clanTag, season),
        matchupAnalysis: await this.getMatchupAnalysis(guildId, clanTag, season),
        trends: await this.getTrends(guildId, clanTag, season)
      };

      return stats;
    } catch (error) {
      console.error('[CWL Dashboard] Error getting stats:', error.message);
      return null;
    }
  }

  /**
   * Get overview statistics
   */
  async getOverviewStats(guildId, clanTag, season) {
    const [overview] = await this.sqlPool.query(
      `SELECT 
        COUNT(DISTINCT player_tag) as total_players,
        SUM(attacks_used) as total_attacks,
        SUM(attacks_remaining) as missed_attacks,
        SUM(stars_earned) as total_stars,
        AVG(destruction_percentage) as avg_destruction,
        SUM(three_star) as three_stars,
        SUM(CASE WHEN stars_earned >= 2 THEN 1 ELSE 0 END) as two_star_plus
       FROM guild_clashofclans_cwl_player_performance
       WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
      [guildId, clanTag, season]
    );

    const [rounds] = await this.sqlPool.query(
      `SELECT COUNT(DISTINCT round_number) as rounds_completed
       FROM guild_clashofclans_cwl_round_standings
       WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
      [guildId, clanTag, season]
    );

    return {
      ...overview[0],
      rounds_completed: rounds[0]?.rounds_completed || 0,
      attack_completion_rate: overview[0].total_attacks / (overview[0].total_attacks + overview[0].missed_attacks) * 100,
      stars_per_attack: overview[0].total_attacks > 0 ? overview[0].total_stars / overview[0].total_attacks : 0
    };
  }

  /**
   * Get top performers
   */
  async getTopPerformers(guildId, clanTag, season, limit = 10) {
    const [performers] = await this.sqlPool.query(
      `SELECT 
        player_tag,
        player_name,
        COUNT(DISTINCT round_number) as rounds,
        SUM(stars_earned) as total_stars,
        AVG(destruction_percentage) as avg_destruction,
        SUM(three_star) as three_stars,
        SUM(attacks_used) as attacks,
        (SUM(stars_earned) / SUM(attacks_used)) as stars_per_attack
       FROM guild_clashofclans_cwl_player_performance
       WHERE guild_id = ? AND clan_tag = ? AND season = ?
       AND attacks_used > 0
       GROUP BY player_tag, player_name
       HAVING attacks >= 3
       ORDER BY total_stars DESC, avg_destruction DESC
       LIMIT ?`,
      [guildId, clanTag, season, limit]
    );

    return performers;
  }

  /**
   * Get attack efficiency metrics
   */
  async getAttackEfficiency(guildId, clanTag, season) {
    const [efficiency] = await this.sqlPool.query(
      `SELECT 
        SUM(CASE WHEN stars_earned = 3 THEN 1 ELSE 0 END) as three_star_attacks,
        SUM(CASE WHEN stars_earned = 2 THEN 1 ELSE 0 END) as two_star_attacks,
        SUM(CASE WHEN stars_earned = 1 THEN 1 ELSE 0 END) as one_star_attacks,
        SUM(CASE WHEN stars_earned = 0 THEN 1 ELSE 0 END) as zero_star_attacks,
        AVG(CASE WHEN stars_earned > 0 THEN destruction_percentage ELSE NULL END) as avg_destruction_on_star,
        AVG(CASE WHEN stars_earned = 0 THEN destruction_percentage ELSE NULL END) as avg_destruction_no_star
       FROM guild_clashofclans_cwl_player_performance
       WHERE guild_id = ? AND clan_tag = ? AND season = ?
       AND attacks_used > 0`,
      [guildId, clanTag, season]
    );

    const data = efficiency[0];
    const totalAttacks = data.three_star_attacks + data.two_star_attacks + data.one_star_attacks + data.zero_star_attacks;

    return {
      ...data,
      three_star_rate: totalAttacks > 0 ? (data.three_star_attacks / totalAttacks * 100) : 0,
      two_star_rate: totalAttacks > 0 ? (data.two_star_attacks / totalAttacks * 100) : 0,
      one_star_rate: totalAttacks > 0 ? (data.one_star_attacks / totalAttacks * 100) : 0,
      zero_star_rate: totalAttacks > 0 ? (data.zero_star_attacks / totalAttacks * 100) : 0,
      star_success_rate: totalAttacks > 0 ? ((totalAttacks - data.zero_star_attacks) / totalAttacks * 100) : 0
    };
  }

  /**
   * Get participation metrics
   */
  async getParticipation(guildId, clanTag, season) {
    const [participation] = await this.sqlPool.query(
      `SELECT 
        player_tag,
        player_name,
        COUNT(DISTINCT round_number) as rounds_participated,
        SUM(attacks_used) as attacks_used,
        SUM(attacks_remaining) as attacks_missed
       FROM guild_clashofclans_cwl_player_performance
       WHERE guild_id = ? AND clan_tag = ? AND season = ?
       GROUP BY player_tag, player_name
       ORDER BY attacks_missed DESC, rounds_participated DESC`,
      [guildId, clanTag, season]
    );

    const totalRounds = 7;
    const activeThreshold = 3;

    return {
      players: participation,
      active_players: participation.filter(p => p.rounds_participated >= activeThreshold).length,
      inactive_players: participation.filter(p => p.attacks_missed > 0).length,
      perfect_attendance: participation.filter(p => p.attacks_missed === 0 && p.rounds_participated > 0).length
    };
  }

  /**
   * Get matchup analysis
   */
  async getMatchupAnalysis(guildId, clanTag, season) {
    const [standings] = await this.sqlPool.query(
      `SELECT 
        round_number,
        position,
        total_clans,
        stars_earned,
        destruction_percentage,
        wins,
        losses
       FROM guild_clashofclans_cwl_round_standings
       WHERE guild_id = ? AND clan_tag = ? AND season = ?
       ORDER BY round_number`,
      [guildId, clanTag, season]
    );

    if (standings.length === 0) return null;

    const latest = standings[standings.length - 1];
    const firstRound = standings[0];
    
    const positionChange = firstRound.position - latest.position;
    const totalWins = latest.wins;
    const totalLosses = latest.losses;
    const winRate = totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses) * 100) : 0;

    return {
      current_position: latest.position,
      total_clans: latest.total_clans,
      position_change: positionChange,
      total_wins: totalWins,
      total_losses: totalLosses,
      win_rate: winRate,
      rounds: standings
    };
  }

  /**
   * Get performance trends
   */
  async getTrends(guildId, clanTag, season) {
    const [trends] = await this.sqlPool.query(
      `SELECT 
        round_number,
        SUM(stars_earned) as round_stars,
        AVG(destruction_percentage) as round_destruction,
        SUM(three_star) as round_three_stars,
        COUNT(*) as round_attacks
       FROM guild_clashofclans_cwl_player_performance
       WHERE guild_id = ? AND clan_tag = ? AND season = ?
       AND attacks_used > 0
       GROUP BY round_number
       ORDER BY round_number`,
      [guildId, clanTag, season]
    );

    // Calculate trend direction
    if (trends.length < 2) {
      return { rounds: trends, trend: 'insufficient_data' };
    }

    const recentRounds = trends.slice(-3);
    const avgRecentStars = recentRounds.reduce((sum, r) => sum + r.round_stars, 0) / recentRounds.length;
    const earlierRounds = trends.slice(0, Math.max(1, trends.length - 3));
    const avgEarlierStars = earlierRounds.reduce((sum, r) => sum + r.round_stars, 0) / earlierRounds.length;

    const trend = avgRecentStars > avgEarlierStars * 1.1 ? 'improving' : 
                  avgRecentStars < avgEarlierStars * 0.9 ? 'declining' : 'stable';

    return {
      rounds: trends,
      trend,
      avg_recent_stars: avgRecentStars,
      avg_earlier_stars: avgEarlierStars
    };
  }

  /**
   * Generate comprehensive dashboard embed
   */
  async generateDashboardEmbed(guildId, clanTag, season) {
    const stats = await this.getDashboardStats(guildId, clanTag, season);
    if (!stats) return null;

    const { overview, topPerformers, attackEfficiency, participation, matchupAnalysis, trends } = stats;

    // Top 5 performers
    const top5 = topPerformers.slice(0, 5)
      .map((p, i) => `${i + 1}. **${p.player_name}**: ${p.total_stars}⭐ (${p.avg_destruction.toFixed(1)}%)`)
      .join('\n') || 'No data';

    // Trend emoji
    const trendEmoji = trends.trend === 'improving' ? '📈' : 
                       trends.trend === 'declining' ? '📉' : '➡️';

    const embed = {
      title: '📊 CWL Statistics Dashboard',
      description: `**Season ${season}** - Complete Analytics`,
      color: 0x3498db,
      fields: [
        {
          name: '📋 Overview',
          value: `**Players:** ${overview.total_players}\n` +
                 `**Rounds:** ${overview.rounds_completed}/7\n` +
                 `**Total Stars:** ${overview.total_stars}⭐\n` +
                 `**Avg Destruction:** ${overview.avg_destruction?.toFixed(2) || 0}%`,
          inline: true
        },
        {
          name: '⚔️ Attack Stats',
          value: `**Total:** ${overview.total_attacks}\n` +
                 `**Missed:** ${overview.missed_attacks}\n` +
                 `**Completion:** ${overview.attack_completion_rate?.toFixed(1) || 0}%\n` +
                 `**Stars/Attack:** ${overview.stars_per_attack?.toFixed(2) || 0}`,
          inline: true
        },
        {
          name: '🎯 Efficiency',
          value: `**Three Stars:** ${attackEfficiency.three_star_rate?.toFixed(1) || 0}%\n` +
                 `**Two Stars:** ${attackEfficiency.two_star_rate?.toFixed(1) || 0}%\n` +
                 `**Success Rate:** ${attackEfficiency.star_success_rate?.toFixed(1) || 0}%\n` +
                 `**Perfect:** ${overview.three_stars}`,
          inline: true
        },
        {
          name: '🏆 Top Performers',
          value: top5,
          inline: false
        }
      ],
      timestamp: new Date()
    };

    // Add matchup analysis if available
    if (matchupAnalysis) {
      embed.fields.push({
        name: '📊 Standings',
        value: `**Position:** ${matchupAnalysis.current_position}/${matchupAnalysis.total_clans}\n` +
               `**Change:** ${matchupAnalysis.position_change > 0 ? '+' : ''}${matchupAnalysis.position_change}\n` +
               `**Record:** ${matchupAnalysis.total_wins}W-${matchupAnalysis.total_losses}L\n` +
               `**Win Rate:** ${matchupAnalysis.win_rate.toFixed(1)}%`,
        inline: true
      });
    }

    // Add participation
    embed.fields.push({
      name: '👥 Participation',
      value: `**Active:** ${participation.active_players}\n` +
             `**Inactive:** ${participation.inactive_players}\n` +
             `**Perfect:** ${participation.perfect_attendance}`,
      inline: true
    });

    // Add trend
    embed.fields.push({
      name: `${trendEmoji} Performance Trend`,
      value: `**Status:** ${trends.trend.toUpperCase()}\n` +
             `**Recent Avg:** ${trends.avg_recent_stars?.toFixed(1) || 0}⭐\n` +
             `**Earlier Avg:** ${trends.avg_earlier_stars?.toFixed(1) || 0}⭐`,
      inline: true
    });

    return embed;
  }

  /**
   * Generate detailed player comparison embed
   */
  async generatePlayerComparisonEmbed(guildId, clanTag, season, playerTags) {
    if (playerTags.length < 2 || playerTags.length > 5) {
      return null; // Support 2-5 players
    }

    const players = [];
    for (const playerTag of playerTags) {
      const [stats] = await this.sqlPool.query(
        `SELECT 
          player_tag,
          player_name,
          SUM(stars_earned) as total_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(three_star) as three_stars,
          SUM(attacks_used) as attacks,
          COUNT(DISTINCT round_number) as rounds
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND player_tag = ?
         AND attacks_used > 0
         GROUP BY player_tag, player_name`,
        [guildId, clanTag, season, playerTag]
      );

      if (stats.length > 0) {
        players.push(stats[0]);
      }
    }

    if (players.length === 0) return null;

    const embed = {
      title: '⚔️ Player Comparison',
      description: `Season ${season}`,
      color: 0xe74c3c,
      fields: players.map(p => ({
        name: `${p.player_name}`,
        value: `**Stars:** ${p.total_stars}⭐\n` +
               `**Destruction:** ${p.avg_destruction.toFixed(1)}%\n` +
               `**Three Stars:** ${p.three_stars}\n` +
               `**Attacks:** ${p.attacks} (${p.rounds} rounds)`,
        inline: true
      })),
      timestamp: new Date()
    };

    return embed;
  }

  /**
   * Get inactive players report
   */
  async getInactivePlayers(guildId, clanTag, season) {
    const [inactive] = await this.sqlPool.query(
      `SELECT 
        player_tag,
        player_name,
        SUM(attacks_remaining) as total_missed,
        COUNT(DISTINCT round_number) as rounds_with_missed,
        MAX(round_number) as last_active_round
       FROM guild_clashofclans_cwl_player_performance
       WHERE guild_id = ? AND clan_tag = ? AND season = ?
       AND attacks_remaining > 0
       GROUP BY player_tag, player_name
       ORDER BY total_missed DESC`,
      [guildId, clanTag, season]
    );

    return inactive;
  }

  /**
   * Generate inactive players embed
   */
  async generateInactivePlayersEmbed(guildId, clanTag, season) {
    const inactive = await this.getInactivePlayers(guildId, clanTag, season);
    
    if (inactive.length === 0) {
      return {
        title: '✅ No Inactive Players',
        description: 'Everyone is participating! Great job!',
        color: 0x2ecc71
      };
    }

    const playersList = inactive
      .slice(0, 15)
      .map(p => `**${p.player_name}**: ${p.total_missed} missed attacks (Last: Round ${p.last_active_round})`)
      .join('\n');

    return {
      title: '⚠️ Inactive Players Report',
      description: `Season ${season} - ${inactive.length} players with missed attacks`,
      color: 0xe67e22,
      fields: [
        {
          name: 'Players',
          value: playersList,
          inline: false
        }
      ],
      timestamp: new Date()
    };
  }
}

module.exports = CWLStatisticsDashboard;
