// CWL Reminders Manager - Send attack reminders for players who haven't attacked
class CWLReminders {
  constructor(sqlPool, discordClient) {
    this.sqlPool = sqlPool;
    this.client = discordClient;
  }

  /**
   * Check and send attack reminders for a clan
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Current round number
   * @param {Object} warData - War data from API
   * @param {Object} cfg - Guild Clash of Clans config
   * @returns {number} Number of reminders sent
   */
  async sendAttackReminders(guildId, clanTag, season, roundNumber, warData, cfg) {
    try {
      // CRITICAL: Ensure warData.clan is OUR clan
      const cleanTag = (tag) => {
        if (!tag) return null;
        return tag.replace(/^#/, '').toUpperCase();
      };
      
      const ourClanTag = cleanTag(clanTag);
      const clan1Tag = cleanTag(warData.clan?.tag);
      const clan2Tag = cleanTag(warData.opponent?.tag);
      
      if (clan2Tag === ourClanTag && clan1Tag !== ourClanTag) {
        // Swap so our clan is always in warData.clan
        const temp = warData.clan;
        warData.clan = warData.opponent;
        warData.opponent = temp;
        // console.log(`[CWL Reminders] Swapped clan/opponent for correct perspective`);
      }
      
      // Check if war is still active
      if (warData.state !== 'inWar') {
        // console.log('[CWL Reminders] War not active, skipping reminders');
        return 0;
      }
      
      // console.log(`[CWL Reminders] Checking reminders for round ${roundNumber}, war state: ${warData.state}`);

      // Calculate time remaining (handle multiple date formats)
      const now = new Date();
      let endTime;
      
      // Helper function to parse COC API date format (YYYYMMDDTHHmmss.sssZ)
      const parseCOCDate = (dateStr) => {
        if (!dateStr) return null;
        
        // Check if it's already a valid ISO format
        if (dateStr.includes('-')) {
          return new Date(dateStr);
        }
        
        // Parse COC format: 20251007T212352.000Z -> 2025-10-07T21:23:52.000Z
        const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/);
        if (match) {
          const [, year, month, day, hour, minute, second, ms] = match;
          const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`;
          return new Date(isoDate);
        }
        
        // Fallback: try parsing as-is
        return new Date(dateStr);
      };
      
      // Try parsing the endTime in different formats
      if (warData.endTime) {
        endTime = parseCOCDate(warData.endTime);
      } else if (warData.endTimeUtc) {
        endTime = parseCOCDate(warData.endTimeUtc);
      } else if (warData.preparationStartTime) {
        // Fallback: estimate from preparation start (24h prep + 24h war)
        const prepStart = parseCOCDate(warData.preparationStartTime);
        if (prepStart && !isNaN(prepStart.getTime())) {
          endTime = new Date(prepStart.getTime() + 48 * 60 * 60 * 1000);
        }
      }
      
      // Validate endTime
      if (!endTime || isNaN(endTime.getTime())) {
        console.error('[CWL Reminders] Invalid endTime in warData:', warData.endTime);
        console.error('[CWL Reminders] Available time fields:', {
          endTime: warData.endTime,
          endTimeUtc: warData.endTimeUtc,
          preparationStartTime: warData.preparationStartTime
        });
        return 0;
      }
      
      // console.log(`[CWL Reminders] War end time: ${endTime.toISOString()} (parsed from: ${warData.endTime || warData.endTimeUtc})`);
      
      const hoursRemaining = (endTime - now) / (1000 * 60 * 60);

      console.log(`[CWL Reminders] Time check: ${hoursRemaining.toFixed(2)} hours remaining (threshold: 4 hours)`);

      // Only send reminders in final 4 hours
      if (hoursRemaining > 4) {
        // console.log('[CWL Reminders] More than 4 hours remaining, skipping reminders');
        return 0;
      }

      // Check if we've already sent reminders for this round
      const [reminderCheck] = await this.sqlPool.query(
        `SELECT attack_reminders_sent FROM guild_clashofclans_cwl_state
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );

      if (reminderCheck.length === 0) {
        return 0;
      }

      const remindersSent = reminderCheck[0].attack_reminders_sent 
        ? JSON.parse(reminderCheck[0].attack_reminders_sent) 
        : [];

      // Check if we already sent reminder for this round
      if (remindersSent.includes(roundNumber)) {
        console.log(`[CWL Reminders] Already sent reminders for round ${roundNumber}`);
        return 0;
      }

      // Get players without attacks (CWL = 1 attack per player per round)
      const [players] = await this.sqlPool.query(
        `SELECT player_tag, player_name, attacks_used,
         (1 - attacks_used) as attacks_remaining
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?
         AND attacks_used < 1`,
        [guildId, clanTag, season, roundNumber]
      );

      if (players.length === 0) {
        console.log('[CWL Reminders] All players have attacked');
        // Mark as sent even if no one needed reminder
        remindersSent.push(roundNumber);
        await this._updateRemindersSent(guildId, clanTag, season, remindersSent);
        return 0;
      }

      // Get CWL announcement channel from clan config
      const clanConfigs = cfg.clanConfigs || {};
      const clanConfig = clanConfigs[clanTag] || {};
      const channelId = clanConfig.cwlAnnounceChannelId;

      if (!channelId) {
        // console.log('[CWL Reminders] No CWL announcement channel configured for clan', clanTag);
        return 0;
      }
      const channel = await this.client.channels.fetch(channelId);

      if (!channel) {
        // console.log('[CWL Reminders] Could not fetch announcement channel');
        return 0;
      }

      // Build reminder message
      const hours = Math.floor(hoursRemaining);
      const minutes = Math.floor((hoursRemaining % 1) * 60);
      const timeText = hours > 0 
        ? `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}` 
        : `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      
      // Split players into chunks to avoid embed size limits
      // Each field can have max 1024 chars, and total embed must be under 6000
      const maxPlayersPerField = 20; // Conservative limit to stay under 1024 chars per field
      const playerChunks = [];
      
      for (let i = 0; i < players.length; i += maxPlayersPerField) {
        const chunk = players.slice(i, i + maxPlayersPerField);
        const playerList = chunk
          .map(p => `• ${p.player_name} (${p.attacks_remaining} attack${p.attacks_remaining > 1 ? 's' : ''} remaining)`)
          .join('\n');
        playerChunks.push(playerList);
      }

      // Create embed with proper field handling
      const embed = {
        title: '⚠️ CWL Attack Reminder',
        description: `**${warData.clan.name}** vs **${warData.opponent.name}**\n**Round ${roundNumber}** - ${timeText} remaining`,
        fields: [],
        color: 0xFF6B6B,
        timestamp: new Date(),
        footer: {
          text: 'Make sure to use all attacks!'
        }
      };

      // Add player chunks as fields (max 25 fields per embed)
      const maxFields = 25;
      for (let i = 0; i < Math.min(playerChunks.length, maxFields); i++) {
        const startIdx = i * maxPlayersPerField + 1;
        const endIdx = Math.min((i + 1) * maxPlayersPerField, players.length);
        const fieldName = playerChunks.length === 1 
          ? `${players.length} Player${players.length > 1 ? 's' : ''} Haven't Attacked`
          : `Players ${startIdx}-${endIdx} (${players.length} total)`;
        
        embed.fields.push({
          name: fieldName,
          value: playerChunks[i]
        });
      }

      // If we still have too many players, send a warning
      if (playerChunks.length > maxFields) {
        embed.fields[maxFields - 1].value += `\n\n*...and ${players.length - (maxFields * maxPlayersPerField)} more players*`;
      }

      await channel.send({ embeds: [embed] });

      // Mark reminder as sent
      remindersSent.push(roundNumber);
      await this._updateRemindersSent(guildId, clanTag, season, remindersSent);

      // console.log(`[CWL Reminders] Sent reminder for ${players.length} players in round ${roundNumber} for ${warData.clan.name}`);
      return players.length;
    } catch (error) {
      console.error('[CWL Reminders] Error sending attack reminders:', error.message);
      return 0;
    }
  }

  /**
   * Update reminders sent in database
   * @private
   */
  async _updateRemindersSent(guildId, clanTag, season, remindersSent) {
    try {
      await this.sqlPool.query(
        `UPDATE guild_clashofclans_cwl_state
         SET attack_reminders_sent = ?
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [JSON.stringify(remindersSent), guildId, clanTag, season]
      );
    } catch (error) {
      console.error('[CWL Reminders] Error updating reminders sent:', error.message);
    }
  }

  /**
   * Get reminder statistics
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} Reminder stats
   */
  async getReminderStats(guildId, clanTag, season) {
    try {
      const [state] = await this.sqlPool.query(
        `SELECT attack_reminders_sent FROM guild_clashofclans_cwl_state
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );

      if (state.length === 0) {
        return {
          reminders_sent: 0,
          rounds_reminded: []
        };
      }

      const remindersSent = state[0].attack_reminders_sent 
        ? JSON.parse(state[0].attack_reminders_sent) 
        : [];

      return {
        reminders_sent: remindersSent.length,
        rounds_reminded: remindersSent
      };
    } catch (error) {
      console.error('[CWL Reminders] Error getting reminder stats:', error.message);
      return {
        reminders_sent: 0,
        rounds_reminded: []
      };
    }
  }
}

module.exports = CWLReminders;
