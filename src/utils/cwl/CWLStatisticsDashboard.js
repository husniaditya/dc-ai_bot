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
        trends: await this.getTrends(guildId, clanTag, season),
        leagueStandings: await this.getLeagueStandings(guildId, clanTag, season)
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
        SUM(CASE WHEN attacks_used > 0 THEN attacks_used ELSE 0 END) as total_attacks,
        SUM(CASE WHEN attacks_remaining > 0 THEN attacks_remaining ELSE 0 END) as missed_attacks,
        SUM(stars_earned) as total_stars,
        AVG(CASE WHEN attacks_used > 0 THEN destruction_percentage ELSE NULL END) as avg_destruction,
        SUM(three_star) as three_stars,
        SUM(CASE WHEN stars_earned >= 2 AND attacks_used > 0 THEN 1 ELSE 0 END) as two_star_plus,
        COUNT(DISTINCT round_number) as rounds_completed
       FROM guild_clashofclans_cwl_player_performance
       WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
      [guildId, clanTag, season]
    );

    const totalPossibleAttacks = (overview[0].total_attacks || 0) + (overview[0].missed_attacks || 0);
    const attackCompletionRate = totalPossibleAttacks > 0 
      ? ((overview[0].total_attacks || 0) / totalPossibleAttacks * 100) 
      : 0;

    return {
      ...overview[0],
      attack_completion_rate: attackCompletionRate,
      stars_per_attack: (overview[0].total_attacks || 0) > 0 
        ? (overview[0].total_stars || 0) / overview[0].total_attacks 
        : 0
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
        (SUM(stars_earned) / NULLIF(SUM(attacks_used), 0)) as stars_per_attack
       FROM guild_clashofclans_cwl_player_performance
       WHERE guild_id = ? AND clan_tag = ? AND season = ?
       AND attacks_used > 0
       GROUP BY player_tag, player_name
       HAVING attacks >= 1
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
    // Note: The table stores aggregate data per player per round, not individual attacks
    // We need to calculate efficiency based on the three_star field and total attacks
    const [efficiency] = await this.sqlPool.query(
      `SELECT 
        SUM(three_star) as three_star_attacks,
        SUM(attacks_used) as total_attacks,
        SUM(stars_earned) as total_stars,
        AVG(destruction_percentage) as avg_destruction
       FROM guild_clashofclans_cwl_player_performance
       WHERE guild_id = ? AND clan_tag = ? AND season = ?
       AND attacks_used > 0`,
      [guildId, clanTag, season]
    );

    const data = efficiency[0];
    const totalAttacks = data.total_attacks || 0;
    const threeStars = data.three_star_attacks || 0;
    const totalStars = data.total_stars || 0;

    // Calculate approximate two-star attacks
    // Since we don't track individual attacks, we estimate based on average stars
    const avgStarsPerAttack = totalAttacks > 0 ? totalStars / totalAttacks : 0;
    
    // Rough estimation: if avg stars is > 2.5, assume more 3-stars, otherwise more 2-stars
    const estimatedTwoStars = Math.max(0, Math.round((totalStars - (threeStars * 3)) / 2));

    return {
      three_star_attacks: threeStars,
      two_star_attacks: estimatedTwoStars,
      total_attacks: totalAttacks,
      three_star_rate: totalAttacks > 0 ? (threeStars / totalAttacks * 100) : 0,
      two_star_rate: totalAttacks > 0 ? (estimatedTwoStars / totalAttacks * 100) : 0,
      star_success_rate: totalAttacks > 0 ? ((totalStars / totalAttacks) / 3 * 100) : 0,
      avg_destruction: data.avg_destruction || 0
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
       ORDER BY attacks_missed ASC, rounds_participated DESC`,
      [guildId, clanTag, season]
    );

    const totalRounds = 7;
    const activeThreshold = 3; // Consider active if participated in 3+ rounds

    // Perfect attendance: players who have participated and never missed an attack
    // Note: Some players might not have participated yet (rounds_participated = 0)
    const perfectAttendance = participation.filter(p => 
      p.rounds_participated > 0 && (p.attacks_missed === 0 || p.attacks_missed === null)
    ).length;

    return {
      players: participation,
      active_players: participation.filter(p => p.rounds_participated >= activeThreshold).length,
      inactive_players: participation.filter(p => p.attacks_missed > 0).length,
      perfect_attendance: perfectAttendance
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
   * Get league-wide standings (all clans in the league)
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag (our clan)
   * @param {string} season - Season (YYYY-MM)
   * @returns {Array} League standings
   */
  async getLeagueStandings(guildId, clanTag, season) {
    try {
      // Get league name from database first
      const [cwlState] = await this.sqlPool.query(
        `SELECT league_name FROM guild_clashofclans_cwl_state
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );
      
      const leagueName = cwlState && cwlState.length > 0 ? cwlState[0].league_name : null;
      
      // Import fetchCWLLeagueGroup here to avoid circular dependency
      const { fetchCWLLeagueGroup } = require('../../bot/services/clashofclans');
      
      // Fetch league group data from API
      const leagueData = await fetchCWLLeagueGroup(clanTag);
      if (!leagueData || !leagueData.clans) return null;

      // Calculate total stars and destruction for each clan
      const clanStats = new Map();
      
      // Initialize with clan data from league group (has current stars!)
      for (const clan of leagueData.clans) {
        const cleanTag = clan.tag.replace(/^#/, '').toUpperCase();
        clanStats.set(cleanTag, {
          name: clan.name,
          tag: clan.tag,
          stars: 0,
          destruction: 0,
          wins: 0,
          losses: 0
        });
      }

      // Process ALL wars (including in-progress) to get current star totals
      if (leagueData.rounds && Array.isArray(leagueData.rounds)) {
        const { fetchCWLWar } = require('../../bot/services/clashofclans');
        
        for (const round of leagueData.rounds) {
          if (!round.warTags) continue;
          
          for (const warTag of round.warTags) {
            if (!warTag || warTag === '#0') continue;
            
            try {
              const war = await fetchCWLWar(warTag);
              if (!war || !war.clan || !war.opponent) continue;
              
              const clanTag1 = war.clan.tag.replace(/^#/, '').toUpperCase();
              const clanTag2 = war.opponent.tag.replace(/^#/, '').toUpperCase();
              
              const clan1Stats = clanStats.get(clanTag1);
              const clan2Stats = clanStats.get(clanTag2);
              
              // Add stars from this war (regardless of state)
              if (clan1Stats) {
                clan1Stats.stars += war.clan.stars || 0;
                clan1Stats.destruction += war.clan.destructionPercentage || 0;
                
                // Only count W/L for finished wars
                if (war.state === 'warEnded') {
                  if ((war.clan.stars || 0) > (war.opponent.stars || 0)) {
                    clan1Stats.wins++;
                  } else if ((war.clan.stars || 0) < (war.opponent.stars || 0)) {
                    clan1Stats.losses++;
                  } else {
                    // Tie - check destruction
                    if ((war.clan.destructionPercentage || 0) > (war.opponent.destructionPercentage || 0)) {
                      clan1Stats.wins++;
                    } else if ((war.clan.destructionPercentage || 0) < (war.opponent.destructionPercentage || 0)) {
                      clan1Stats.losses++;
                    }
                  }
                }
              }
              
              if (clan2Stats) {
                clan2Stats.stars += war.opponent.stars || 0;
                clan2Stats.destruction += war.opponent.destructionPercentage || 0;
                
                // Only count W/L for finished wars
                if (war.state === 'warEnded') {
                  if ((war.opponent.stars || 0) > (war.clan.stars || 0)) {
                    clan2Stats.wins++;
                  } else if ((war.opponent.stars || 0) < (war.clan.stars || 0)) {
                    clan2Stats.losses++;
                  } else {
                    // Tie - check destruction
                    if ((war.opponent.destructionPercentage || 0) > (war.clan.destructionPercentage || 0)) {
                      clan2Stats.wins++;
                    } else if ((war.opponent.destructionPercentage || 0) < (war.clan.destructionPercentage || 0)) {
                      clan2Stats.losses++;
                    }
                  }
                }
              }
            } catch (warError) {
              console.error('[CWL Dashboard] Error fetching war:', warError.message);
              // Continue with next war
            }
          }
        }
      }

      // Convert to array and sort by stars, then destruction
      const standings = Array.from(clanStats.values())
        .sort((a, b) => {
          if (b.stars !== a.stars) return b.stars - a.stars;
          return b.destruction - a.destruction;
        })
        .map((clan, index) => ({
          position: index + 1,
          name: clan.name,
          tag: clan.tag,
          stars: clan.stars,
          destruction: clan.destruction,
          wins: clan.wins,
          losses: clan.losses,
          isOurClan: clan.tag.replace(/^#/, '').toUpperCase() === clanTag.toUpperCase()
        }));

      return {
        league: leagueName || leagueData.season || 'Unknown',
        season: leagueData.season,
        standings: standings
      };
    } catch (error) {
      console.error('[CWL Dashboard] Error getting league standings:', error.message);
      return null;
    }
  }

  /**
   * Get performance trends
   */
  async getTrends(guildId, clanTag, season) {
    // Get round-by-round totals from standings table (more accurate)
    const [trends] = await this.sqlPool.query(
      `SELECT 
        round_number,
        stars_earned as round_stars,
        destruction_percentage as round_destruction
       FROM guild_clashofclans_cwl_round_standings
       WHERE guild_id = ? AND clan_tag = ? AND season = ?
       ORDER BY round_number`,
      [guildId, clanTag, season]
    );

    // Calculate trend direction
    if (trends.length < 2) {
      return { rounds: trends, trend: 'insufficient_data' };
    }

    // Recent rounds: last 3 rounds (or available rounds)
    const recentRounds = trends.slice(-3);
    const avgRecentStars = recentRounds.reduce((sum, r) => sum + parseFloat(r.round_stars || 0), 0) / recentRounds.length;
    
    // Earlier rounds: everything before the recent rounds
    const earlierRounds = trends.slice(0, Math.max(1, trends.length - 3));
    const avgEarlierStars = earlierRounds.reduce((sum, r) => sum + parseFloat(r.round_stars || 0), 0) / earlierRounds.length;

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

    const { overview, topPerformers, attackEfficiency, participation, matchupAnalysis, trends, leagueStandings } = stats;

    // Check if we have any data at all
    if (!overview || overview.total_players === 0) {
      return {
        title: '📊 CWL Statistics Dashboard',
        description: `**Season ${season}** - No data available yet.\n\nData will appear once players start attacking in CWL rounds.`,
        color: 0x95a5a6,
        timestamp: new Date()
      };
    }

    // Top 5 performers
    const top5 = topPerformers && topPerformers.length > 0
      ? topPerformers.slice(0, 5)
          .map((p, i) => `${i + 1}. **${p.player_name}**: ${p.total_stars}⭐ (${(parseFloat(p.avg_destruction) || 0).toFixed(1)}%)`)
          .join('\n')
      : 'No data';

    // Trend emoji
    const trendEmoji = trends?.trend === 'improving' ? '📈' : 
                       trends?.trend === 'declining' ? '📉' : '➡️';

    const embed = {
      title: '📊 CWL Statistics Dashboard',
      description: `**Season ${season}** - Complete Analytics`,
      color: 0x3498db,
      fields: [
        {
          name: '📋 Overview',
          value: `**Players:** ${overview.total_players || 0}\n` +
                 `**Rounds:** ${overview.rounds_completed || 0}/7\n` +
                 `**Total Stars:** ${overview.total_stars || 0}⭐\n` +
                 `**Avg Destruction:** ${(parseFloat(overview.avg_destruction) || 0).toFixed(2)}%`,
          inline: true
        },
        {
          name: '⚔️ Attack Stats',
          value: `**Total:** ${overview.total_attacks || 0}\n` +
                 `**Missed:** ${overview.missed_attacks || 0}\n` +
                 `**Completion:** ${(parseFloat(overview.attack_completion_rate) || 0).toFixed(1)}%\n` +
                 `**Stars/Attack:** ${(parseFloat(overview.stars_per_attack) || 0).toFixed(2)}`,
          inline: true
        },
        {
          name: '🎯 Efficiency',
          value: `**Three Stars:** ${(parseFloat(attackEfficiency?.three_star_rate) || 0).toFixed(1)}%\n` +
                 `**Two Stars:** ${(parseFloat(attackEfficiency?.two_star_rate) || 0).toFixed(1)}%\n` +
                 `**Success Rate:** ${(parseFloat(attackEfficiency?.star_success_rate) || 0).toFixed(1)}%\n` +
                 `**Perfect:** ${overview.three_stars || 0}`,
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
    if (matchupAnalysis && matchupAnalysis.current_position) {
      embed.fields.push({
        name: '📊 Standings',
        value: `**Position:** ${matchupAnalysis.current_position}/${matchupAnalysis.total_clans}\n` +
               `**Change:** ${matchupAnalysis.position_change > 0 ? '+' : ''}${matchupAnalysis.position_change || 0}\n` +
               `**Record:** ${matchupAnalysis.total_wins || 0}W-${matchupAnalysis.total_losses || 0}L\n` +
               `**Win Rate:** ${(parseFloat(matchupAnalysis.win_rate) || 0).toFixed(1)}%`,
        inline: true
      });
    }

    // Add participation
    if (participation) {
      embed.fields.push({
        name: '👥 Participation',
        value: `**Active:** ${participation.active_players || 0}\n` +
               `**Inactive:** ${participation.inactive_players || 0}\n` +
               `**Perfect:** ${participation.perfect_attendance || 0}`,
        inline: true
      });
    }

    // Add trend
    if (trends && trends.trend) {
      embed.fields.push({
        name: `${trendEmoji} Performance Trend`,
        value: `**Status:** ${(trends.trend || 'INSUFFICIENT_DATA').toUpperCase()}\n` +
               `**Recent Avg:** ${(parseFloat(trends.avg_recent_stars) || 0).toFixed(1)}⭐\n` +
               `**Earlier Avg:** ${(parseFloat(trends.avg_earlier_stars) || 0).toFixed(1)}⭐`,
        inline: true
      });
    }

    // Add league standings
    if (leagueStandings && leagueStandings.standings && leagueStandings.standings.length > 0) {
      const topClans = leagueStandings.standings
        .slice(0, 8) // Show top 8 clans
        .map(clan => {
          const positionEmoji = clan.position === 1 ? '🥇' : clan.position === 2 ? '🥈' : clan.position === 3 ? '🥉' : `${clan.position}.`;
          const clanIndicator = clan.isOurClan ? '**' : '';
          const record = clan.wins || clan.losses ? ` (${clan.wins}W-${clan.losses}L)` : '';
          return `${positionEmoji} ${clanIndicator}${clan.name}${clanIndicator}: ${clan.stars}⭐${record}`;
        })
        .join('\n');

      embed.fields.push({
        name: `🏅 League Standings (${leagueStandings.league})`,
        value: topClans || 'No data',
        inline: false
      });
    }

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
               `**Destruction:** ${(parseFloat(p.avg_destruction) || 0).toFixed(1)}%\n` +
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
