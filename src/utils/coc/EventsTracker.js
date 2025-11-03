/**
 * Clash of Clans Events Tracker
 * Tracks and calculates timers for:
 * - Trader Shop Refresh (Weekly: Monday 8:00 AM UTC)
 * - Raid Weekend (Friday 7:00 AM - Monday 7:00 AM UTC)
 * - Clan Games (Monthly: ~6 days, typically last week)
 * - Season Challenges (Monthly: Last Monday 5:00 AM UTC)
 */

class EventsTracker {
  constructor() {
    // Known event schedules
    this.TRADER_REFRESH_DAY = 1; // Monday
    this.TRADER_REFRESH_HOUR = 8;
    
    this.RAID_START_DAY = 5; // Friday
    this.RAID_START_HOUR = 7;
    this.RAID_END_DAY = 1; // Monday
    this.RAID_END_HOUR = 7;
    
    this.SEASON_RESET_HOUR = 5; // 5:00 AM UTC
  }

  /**
   * Get all current event states
   * @returns {Object} Event states with countdowns
   */
  getEventStates() {
    const now = new Date();
    
    return {
      trader: this.getTraderState(now),
      raid: this.getRaidWeekendState(now),
      clanGames: this.getClanGamesState(now),
      season: this.getSeasonState(now),
      lastUpdated: now.toISOString()
    };
  }

  /**
   * Get Trader Shop refresh state
   * @param {Date} now Current time
   * @returns {Object} Trader state
   */
  getTraderState(now) {
    const nextRefresh = this.getNextTraderRefresh(now);
    const msRemaining = nextRefresh.getTime() - now.getTime();
    const daysLeft = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return {
      nextRefresh: nextRefresh.toISOString(),
      daysLeft,
      hoursLeft,
      timeLeft: this.formatTimeLeft(msRemaining),
      emoji: '🛒'
    };
  }

  /**
   * Get next Trader Shop refresh time (Every Monday 8:00 AM UTC)
   * @param {Date} now Current time
   * @returns {Date} Next refresh time
   */
  getNextTraderRefresh(now) {
    const currentDay = now.getUTCDay();
    const currentHour = now.getUTCHours();
    
    let daysUntilMonday = (this.TRADER_REFRESH_DAY - currentDay + 7) % 7;
    
    // If it's Monday but before 8 AM, refresh is today
    if (daysUntilMonday === 0 && currentHour < this.TRADER_REFRESH_HOUR) {
      daysUntilMonday = 0;
    }
    // If it's Monday after 8 AM, next refresh is next Monday
    else if (daysUntilMonday === 0) {
      daysUntilMonday = 7;
    }
    
    const nextRefresh = new Date(now);
    nextRefresh.setUTCDate(now.getUTCDate() + daysUntilMonday);
    nextRefresh.setUTCHours(this.TRADER_REFRESH_HOUR, 0, 0, 0);
    
    return nextRefresh;
  }

  /**
   * Get Raid Weekend state
   * @param {Date} now Current time
   * @returns {Object} Raid weekend state
   */
  getRaidWeekendState(now) {
    const isActive = this.isRaidWeekendActive(now);
    
    if (isActive) {
      const endTime = this.getRaidWeekendEnd(now);
      const msRemaining = endTime.getTime() - now.getTime();
      const daysLeft = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      return {
        active: true,
        endTime: endTime.toISOString(),
        daysLeft,
        hoursLeft,
        timeLeft: this.formatTimeLeft(msRemaining),
        emoji: '⚔️'
      };
    } else {
      const startTime = this.getNextRaidWeekendStart(now);
      const msRemaining = startTime.getTime() - now.getTime();
      const daysLeft = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      return {
        active: false,
        startTime: startTime.toISOString(),
        daysLeft,
        hoursLeft,
        timeLeft: this.formatTimeLeft(msRemaining),
        emoji: '⚔️'
      };
    }
  }

  /**
   * Check if Raid Weekend is currently active
   * @param {Date} now Current time
   * @returns {boolean} Whether raid weekend is active
   */
  isRaidWeekendActive(now) {
    const dayOfWeek = now.getUTCDay();
    const hour = now.getUTCHours();
    
    // Friday 7 AM - Monday 7 AM UTC
    if (dayOfWeek === 5 && hour >= this.RAID_START_HOUR) return true; // Friday after 7 AM
    if (dayOfWeek === 6 || dayOfWeek === 0) return true; // Saturday or Sunday (all day)
    if (dayOfWeek === 1 && hour < this.RAID_END_HOUR) return true; // Monday before 7 AM
    
    return false;
  }

  /**
   * Get next Raid Weekend start time
   * @param {Date} now Current time
   * @returns {Date} Next raid weekend start
   */
  getNextRaidWeekendStart(now) {
    const currentDay = now.getUTCDay();
    let daysUntilFriday = (this.RAID_START_DAY - currentDay + 7) % 7;
    
    if (daysUntilFriday === 0 && now.getUTCHours() >= this.RAID_START_HOUR) {
      daysUntilFriday = 7; // Next week
    }
    
    const nextStart = new Date(now);
    nextStart.setUTCDate(now.getUTCDate() + daysUntilFriday);
    nextStart.setUTCHours(this.RAID_START_HOUR, 0, 0, 0);
    
    return nextStart;
  }

  /**
   * Get current Raid Weekend end time
   * @param {Date} now Current time
   * @returns {Date} Raid weekend end time
   */
  getRaidWeekendEnd(now) {
    const currentDay = now.getUTCDay();
    let daysUntilMonday;
    
    if (currentDay === 1 && now.getUTCHours() < this.RAID_END_HOUR) {
      // It's Monday before 7 AM - end is today
      daysUntilMonday = 0;
    } else {
      // Calculate days until next Monday
      daysUntilMonday = (this.RAID_END_DAY - currentDay + 7) % 7;
      if (daysUntilMonday === 0) daysUntilMonday = 7;
    }
    
    const endTime = new Date(now);
    endTime.setUTCDate(now.getUTCDate() + daysUntilMonday);
    endTime.setUTCHours(this.RAID_END_HOUR, 0, 0, 0);
    
    return endTime;
  }

  /**
   * Get Clan Games state
   * Note: Clan Games timing is approximate and may need manual adjustment
   * @param {Date} now Current time
   * @returns {Object} Clan games state
   */
  getClanGamesState(now) {
    // Approximate: Clan Games typically start around the 22nd-25th of each month
    // This is a best-guess implementation - may need manual configuration
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    
    // Estimate start: 23rd of current month at 8:00 AM UTC
    const estimatedStart = new Date(Date.UTC(year, month, 23, 8, 0, 0));
    const estimatedEnd = new Date(estimatedStart.getTime() + (6 * 24 * 60 * 60 * 1000)); // +6 days
    
    // Check if currently in clan games
    const isActive = now >= estimatedStart && now < estimatedEnd;
    
    if (isActive) {
      const msRemaining = estimatedEnd.getTime() - now.getTime();
      const daysLeft = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      return {
        active: true,
        endTime: estimatedEnd.toISOString(),
        daysLeft,
        hoursLeft,
        timeLeft: this.formatTimeLeft(msRemaining),
        emoji: '🎮',
        note: 'Estimated timing - may vary by 1-2 days'
      };
    } else {
      // If we're past this month's games, estimate next month
      let nextStart = estimatedStart;
      if (now > estimatedEnd) {
        nextStart = new Date(Date.UTC(year, month + 1, 23, 8, 0, 0));
      }
      
      const msRemaining = nextStart.getTime() - now.getTime();
      const daysLeft = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      return {
        active: false,
        startTime: nextStart.toISOString(),
        daysLeft,
        hoursLeft,
        timeLeft: this.formatTimeLeft(msRemaining),
        emoji: '🎮',
        note: 'Estimated timing - may vary by 1-2 days'
      };
    }
  }

  /**
   * Get Season Challenges state (Gold Pass)
   * @param {Date} now Current time
   * @returns {Object} Season state
   */
  getSeasonState(now) {
    const seasonEnd = this.getSeasonEnd(now);
    const msRemaining = seasonEnd.getTime() - now.getTime();
    const daysLeft = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return {
      endTime: seasonEnd.toISOString(),
      daysLeft,
      hoursLeft,
      timeLeft: this.formatTimeLeft(msRemaining),
      emoji: '🏆'
    };
  }

  /**
   * Get current season end time (Last Monday of next month at 5:00 AM UTC)
   * @param {Date} now Current time
   * @returns {Date} Season end time
   */
  getSeasonEnd(now) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    
    // Get last day of next month
    const lastDayOfNextMonth = new Date(Date.UTC(year, month + 2, 0));
    
    // Find the last Monday of that month
    const lastDay = lastDayOfNextMonth.getUTCDate();
    const lastDayOfWeek = lastDayOfNextMonth.getUTCDay();
    
    // Calculate days to subtract to get to Monday
    const daysToMonday = lastDayOfWeek === 0 ? 6 : lastDayOfWeek - 1;
    const lastMonday = lastDay - daysToMonday;
    
    const seasonEnd = new Date(Date.UTC(year, month + 1, lastMonday, this.SEASON_RESET_HOUR, 0, 0));
    
    // If season end is in the past, calculate for the month after
    if (seasonEnd < now) {
      const nextLastDayOfMonth = new Date(Date.UTC(year, month + 3, 0));
      const nextLastDay = nextLastDayOfMonth.getUTCDate();
      const nextLastDayOfWeek = nextLastDayOfMonth.getUTCDay();
      const nextDaysToMonday = nextLastDayOfWeek === 0 ? 6 : nextLastDayOfWeek - 1;
      const nextLastMonday = nextLastDay - nextDaysToMonday;
      
      return new Date(Date.UTC(year, month + 2, nextLastMonday, this.SEASON_RESET_HOUR, 0, 0));
    }
    
    return seasonEnd;
  }

  /**
   * Format milliseconds to human-readable time left
   * @param {number} ms Milliseconds remaining
   * @returns {string} Formatted time string
   */
  formatTimeLeft(ms) {
    if (ms <= 0) return '0d 0h';
    
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else {
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Generate Discord embed description for all events
   * @returns {string} Formatted embed description
   */
  generateEmbedDescription() {
    const events = this.getEventStates();
    const lines = [];
    
    // Trader Shop
    lines.push(`${events.trader.emoji} **Trader Shop:** ${events.trader.timeLeft} left`);
    
    // Raid Weekend
    if (events.raid.active) {
      lines.push(`${events.raid.emoji} **Raid Weekend:** Ongoing (${events.raid.timeLeft} left)`);
    } else {
      lines.push(`${events.raid.emoji} **Raid Weekend:** ${events.raid.timeLeft} left`);
    }
    
    // Clan Games
    if (events.clanGames.active) {
      lines.push(`${events.clanGames.emoji} **Clan Games:** Ongoing (${events.clanGames.timeLeft} left)`);
    } else {
      lines.push(`${events.clanGames.emoji} **Clan Games:** ${events.clanGames.timeLeft} left${events.clanGames.note ? ' *' : ''}`);
    }
    
    // Season Challenges
    lines.push(`${events.season.emoji} **Season Challenges:** ${events.season.timeLeft} left`);
    
    if (events.clanGames.note) {
      lines.push('\n*Clan Games timing is estimated and may vary');
    }
    
    return lines.join('\n');
  }
}

module.exports = EventsTracker;
