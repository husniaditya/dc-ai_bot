// CWL Leaderboard Manager - Track and display live CWL standings
const { fetchCWLWar } = require('../../bot/services/clashofclans');

class CWLLeaderboard {
  constructor(sqlPool) {
    this.sqlPool = sqlPool;
    // lightweight in-memory cache to avoid fetching all wars too often
    this._standingsCache = new Map(); // key: cacheKey -> { at:number, totals: Map<tag,{stars,destruction,name}> }
    this._cacheTtlMs = 60 * 1000; // 60s
  }

  _makeCacheKey(leagueGroup, roundNumber) {
    // Use season + number of rounds considered + first clan tag to scope cache
    const season = leagueGroup?.season || 'unknown';
    const firstTag = (leagueGroup?.clans?.[0]?.tag || 'na').toUpperCase();
    return `${season}:${roundNumber}:${firstTag}`;
  }

  async _computeTotalsFromLeague(leagueGroup, upToRoundNumber) {
    const cacheKey = this._makeCacheKey(leagueGroup, upToRoundNumber);
    const now = Date.now();
    const cached = this._standingsCache.get(cacheKey);
    if (cached && now - cached.at < this._cacheTtlMs) {
      return cached.totals;
    }

    const totals = new Map(); // tag -> { stars, destruction, name }
    const norm = (tag) => (tag || '').replace(/^#/, '').toUpperCase();

    // seed with clans from group so absent wars still produce entries
    if (Array.isArray(leagueGroup?.clans)) {
      for (const c of leagueGroup.clans) {
        const tag = norm(c.tag);
        if (!totals.has(tag)) {
          totals.set(tag, { stars: 0, destruction: 0, name: c.name || tag });
        }
      }
    }

    const rounds = Array.isArray(leagueGroup?.rounds) ? leagueGroup.rounds : [];
    for (let i = 0; i < rounds.length && i < upToRoundNumber; i++) {
      const round = rounds[i];
      const warTags = Array.isArray(round.warTags) ? round.warTags : [];
      for (const wtag of warTags) {
        if (!wtag || wtag === '#0') continue;
        try {
          const war = await fetchCWLWar(wtag);
          if (!war || !war.clan || !war.opponent) continue;
          const clanTag = norm(war.clan.tag);
          const oppTag = norm(war.opponent.tag);
          const clanName = war.clan.name || clanTag;
          const oppName = war.opponent.name || oppTag;
          if (!totals.has(clanTag)) totals.set(clanTag, { stars: 0, destruction: 0, name: clanName });
          if (!totals.has(oppTag)) totals.set(oppTag, { stars: 0, destruction: 0, name: oppName });
          const t1 = totals.get(clanTag);
          const t2 = totals.get(oppTag);
          t1.stars += (war.clan.stars || 0);
          t1.destruction += (war.clan.destructionPercentage || 0);
          t2.stars += (war.opponent.stars || 0);
          t2.destruction += (war.opponent.destructionPercentage || 0);
        } catch (e) {
          // swallow individual war fetch failures
        }
      }
    }

    this._standingsCache.set(cacheKey, { at: now, totals });
    return totals;
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
      
      // Check if this round is already finalized - if so, skip updates
      const [existingRound] = await this.sqlPool.query(
        `SELECT war_finalized FROM guild_clashofclans_cwl_round_standings
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?`,
        [guildId, clanTag, season, roundNumber]
      );
      
      if (existingRound && existingRound[0]?.war_finalized) {
        if (process.env.COC_DEBUG === '1') {
          console.log(`[CWL Leaderboard] Round ${roundNumber} already finalized, skipping update`);
        }
        return;
      }
      
      // Prefer official leagueGroup standings when available; fallback to derived totals from wars
      let position = 0;
      let positionSource = 'official';
      const norm = (tag) => (tag || '').replace(/^#/, '').toUpperCase();
      let oursOfficialStars = 0;
      let oursOfficialDestr = 0;
      if (Array.isArray(leagueGroup?.clans) && leagueGroup.clans.length > 0) {
        const sortedOfficial = [...leagueGroup.clans].sort((a, b) => {
          if ((b.stars || 0) !== (a.stars || 0)) return (b.stars || 0) - (a.stars || 0);
          return (b.destructionPercentage || 0) - (a.destructionPercentage || 0);
        });
        position = Math.max(1, sortedOfficial.findIndex(c => norm(c.tag) === ourClanTag) + 1);
        const oursOff = sortedOfficial.find(c => norm(c.tag) === ourClanTag);
        if (oursOff) {
          oursOfficialStars = oursOff.stars || 0;
          oursOfficialDestr = oursOff.destructionPercentage || 0;
        }
      }

      // If official says nothing (position 0) or zeroed stats, compute from wars and use that
      let totals = null;
      if (!position || (!oursOfficialStars && !oursOfficialDestr)) {
        positionSource = 'derived';
        totals = await this._computeTotalsFromLeague(leagueGroup, roundNumber);
        if (!totals || totals.size === 0) return;
        const sorted = Array.from(totals.entries()).sort(([, A], [, B]) => {
          if (B.stars !== A.stars) return B.stars - A.stars;
          return B.destruction - A.destruction;
        });
        position = Math.max(1, sorted.findIndex(([tag]) => tag === ourClanTag) + 1);
      }

      if (process.env.COC_DEBUG === '1') {
        console.log(`[CWL Leaderboard] Round ${roundNumber} position=${position} source=${positionSource} (guild=${guildId}, clan=${clanTag})`);
      }
      
      // console.log(`[CWL Leaderboard] Position calculation for round ${roundNumber}:`);
      // console.log(`[CWL Leaderboard] Our clan stars: ${ourClan.stars}, Our position: ${position}/${sortedClans.length}`);
      // console.log(`[CWL Leaderboard] Top 3: ${sortedClans.slice(0, 3).map((c, i) => `${i+1}. ${c.name} (${c.stars}⭐)`).join(', ')}`);

      // Get round-specific war result data
      // Keep per-round stars/destruction for round standings
      let roundStars = 0;
      let roundDestruction = 0;
      let isWin = false;
      let isLoss = false;

      if (warData && warData.clan) {
        // IMPORTANT: Ensure our clan is in warData.clan (API can return clans in any order)
        const clan1Tag = cleanTag(warData.clan?.tag);
        const clan2Tag = cleanTag(warData.opponent?.tag);
        
        if (clan2Tag === ourClanTag && clan1Tag !== ourClanTag) {
          // Swap so our clan is always in warData.clan
          const temp = warData.clan;
          warData.clan = warData.opponent;
          warData.opponent = temp;
          console.log(`[CWL Leaderboard] Swapped clan/opponent for correct perspective (clan ${clanTag}, round ${roundNumber})`);
        }
        
        // Use this round's war stats for the round standings row
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

      // Don't auto-set war_finalized here - let updateCWLFinalRoundCanvas handle it after updating the canvas
      // This prevents premature finalization before the canvas is updated with final results

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
          (leagueGroup.clans || []).length
        ]
      );

      // Also update the main CWL state table with aggregate stats (cumulative to date)
      let aggStars = oursOfficialStars;
      let aggDestr = oursOfficialDestr;
      if (positionSource === 'derived') {
        const oursTotals = (totals && totals.get(ourClanTag)) || { stars: 0, destruction: 0 };
        aggStars = oursTotals.stars || 0;
        aggDestr = oursTotals.destruction || 0;
      }
      await this.sqlPool.query(
        `UPDATE guild_clashofclans_cwl_state
         SET total_stars = ?, total_destruction = ?, predicted_position = ?
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [
          aggStars,
          aggDestr,
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

  /**
   * Mark a round as finalized (war ended and final canvas posted)
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Round number
   */
  async markRoundFinalized(guildId, clanTag, season, roundNumber) {
    try {
      await this.sqlPool.query(
        `UPDATE guild_clashofclans_cwl_round_standings
         SET war_finalized = 1
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?`,
        [guildId, clanTag, season, roundNumber]
      );
      
      if (process.env.COC_DEBUG === '1') {
        console.log(`[CWL Leaderboard] Marked round ${roundNumber} as finalized`);
      }
    } catch (error) {
      console.error('[CWL Leaderboard] Error marking round finalized:', error.message);
    }
  }
}

module.exports = CWLLeaderboard;
