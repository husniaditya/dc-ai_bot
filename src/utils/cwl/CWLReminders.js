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
   * @returns {number} Number of reminders sent
   */
  async sendAttackReminders(guildId, clanTag, season, roundNumber, warData) {
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
        console.log(`[CWL Reminders] Swapped clan/opponent for correct perspective`);
      }
      
      // Check if war is still active
      if (warData.state !== 'inWar') {
        console.log('[CWL Reminders] War not active, skipping reminders');
        return 0;
      }

      // Calculate time remaining (handle multiple date formats)
      const now = new Date();
      let endTime;
      
      // Try parsing the endTime in different formats
      if (warData.endTime) {
        endTime = new Date(warData.endTime);
      } else if (warData.endTimeUtc) {
        endTime = new Date(warData.endTimeUtc);
      } else if (warData.preparationStartTime) {
        // Fallback: estimate from preparation start (24h prep + 24h war)
        const prepStart = new Date(warData.preparationStartTime);
        endTime = new Date(prepStart.getTime() + 48 * 60 * 60 * 1000);
      }
      
      // Validate endTime
      if (!endTime || isNaN(endTime.getTime())) {
        console.error('[CWL Reminders] Invalid endTime in warData:', warData.endTime);
        return 0;
      }
      
      const hoursRemaining = (endTime - now) / (1000 * 60 * 60);

      // Only send reminders in final 4 hours
      if (hoursRemaining > 4) {
        console.log('[CWL Reminders] More than 4 hours remaining, skipping reminders');
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

      // Get players without attacks
      const [players] = await this.sqlPool.query(
        `SELECT player_tag, player_name, attacks_remaining
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?
         AND attacks_remaining > 0`,
        [guildId, clanTag, season, roundNumber]
      );

      if (players.length === 0) {
        console.log('[CWL Reminders] All players have attacked');
        // Mark as sent even if no one needed reminder
        remindersSent.push(roundNumber);
        await this._updateRemindersSent(guildId, clanTag, season, remindersSent);
        return 0;
      }

      // Get CWL announcement channel
      const [config] = await this.sqlPool.query(
        `SELECT cwl_announce_channel_id FROM guild_clashofclans_cwl_state
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );

      if (config.length === 0 || !config[0].cwl_announce_channel_id) {
        console.log('[CWL Reminders] No CWL announcement channel configured');
        return 0;
      }

      const channelId = config[0].cwl_announce_channel_id;
      const channel = await this.client.channels.fetch(channelId);

      if (!channel) {
        console.log('[CWL Reminders] Could not fetch announcement channel');
        return 0;
      }

      // Build reminder message
      const hours = Math.floor(hoursRemaining);
      const minutes = Math.floor((hoursRemaining % 1) * 60);
      const timeText = hours > 0 
        ? `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}` 
        : `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      
      const playerList = players
        .map(p => `• ${p.player_name} (${p.attacks_remaining} attack${p.attacks_remaining > 1 ? 's' : ''} remaining)`)
        .join('\n');

      const embed = {
        title: '⚠️ CWL Attack Reminder',
        description: `**${warData.clan.name}** vs **${warData.opponent.name}**\n**Round ${roundNumber}** - ${timeText} remaining`,
        fields: [
          {
            name: `${players.length} Player${players.length > 1 ? 's' : ''} Haven't Attacked`,
            value: playerList
          }
        ],
        color: 0xFF6B6B,
        timestamp: new Date(),
        footer: {
          text: 'Make sure to use all attacks!'
        }
      };

      await channel.send({ embeds: [embed] });

      // Mark reminder as sent
      remindersSent.push(roundNumber);
      await this._updateRemindersSent(guildId, clanTag, season, remindersSent);

      console.log(`[CWL Reminders] Sent reminder for ${players.length} players in round ${roundNumber} for ${warData.clan.name}`);
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
