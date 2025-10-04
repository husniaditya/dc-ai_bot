// CWL Watcher - Polls clans for CWL participation and announces CWL events
const store = require('../../config/store');
const CWLStateManager = require('../../utils/cwl/CWLStateManager');
const CWLPlayerPerformance = require('../../utils/cwl/CWLPlayerPerformance');
const CWLLeaderboard = require('../../utils/cwl/CWLLeaderboard');
const CWLPredictions = require('../../utils/cwl/CWLPredictions');
const CWLReminders = require('../../utils/cwl/CWLReminders');
const CWLMVPAwards = require('../../utils/cwl/CWLMVPAwards');
const CWLDataExport = require('../../utils/cwl/CWLDataExport');
const CWLInteractiveLeaderboard = require('../../utils/cwl/CWLInteractiveLeaderboard');
const CWLStatisticsDashboard = require('../../utils/cwl/CWLStatisticsDashboard');
const CWLClanManagement = require('../../utils/cwl/CWLClanManagement');
const { 
  fetchClanInfo, 
  fetchCWLLeagueGroup,
  fetchCWLWar,
  announce,
  cleanClanTag,
  formatClanTag
} = require('../services/clashofclans');

let cwlStateManager = null;
let cwlPlayerPerformance = null;
let cwlLeaderboard = null;
let cwlPredictions = null;
let cwlReminders = null;
let cwlMVPAwards = null;
let cwlDataExport = null;
let cwlInteractiveLeaderboard = null;
let cwlStatisticsDashboard = null;
let cwlClanManagement = null;

function getCWLStateManager() {
  if (!cwlStateManager) {
    cwlStateManager = new CWLStateManager(store.sqlPool);
  }
  return cwlStateManager;
}

function getCWLPlayerPerformance() {
  if (!cwlPlayerPerformance) {
    cwlPlayerPerformance = new CWLPlayerPerformance(store.sqlPool);
  }
  return cwlPlayerPerformance;
}

function getCWLLeaderboard() {
  if (!cwlLeaderboard) {
    cwlLeaderboard = new CWLLeaderboard(store.sqlPool);
  }
  return cwlLeaderboard;
}

function getCWLPredictions() {
  if (!cwlPredictions) {
    cwlPredictions = new CWLPredictions(store.sqlPool);
  }
  return cwlPredictions;
}

function getCWLReminders(client) {
  if (!cwlReminders) {
    cwlReminders = new CWLReminders(store.sqlPool, client);
  }
  return cwlReminders;
}

function getCWLMVPAwards() {
  if (!cwlMVPAwards) {
    cwlMVPAwards = new CWLMVPAwards(store.sqlPool);
  }
  return cwlMVPAwards;
}

function getCWLDataExport() {
  if (!cwlDataExport) {
    cwlDataExport = new CWLDataExport(store.sqlPool);
  }
  return cwlDataExport;
}

function getCWLInteractiveLeaderboard() {
  if (!cwlInteractiveLeaderboard) {
    cwlInteractiveLeaderboard = new CWLInteractiveLeaderboard(store.sqlPool);
  }
  return cwlInteractiveLeaderboard;
}

function getCWLStatisticsDashboard() {
  if (!cwlStatisticsDashboard) {
    cwlStatisticsDashboard = new CWLStatisticsDashboard(store.sqlPool);
  }
  return cwlStatisticsDashboard;
}

function getCWLClanManagement() {
  if (!cwlClanManagement) {
    cwlClanManagement = new CWLClanManagement(store.sqlPool);
  }
  return cwlClanManagement;
}

/**
 * Poll guild for CWL updates
 */
async function pollGuildCWL(guild) {
  let cfg;
  try {
    cfg = await store.getGuildClashOfClansConfig(guild.id);
  } catch {
    return;
  }

  if (!cfg.enabled) return;
  if (!cfg.trackCWL) return; // New toggle for CWL tracking
  if (!Array.isArray(cfg.clans) || !cfg.clans.length) return;

  const debug = process.env.COC_DEBUG === '1';
  if (debug) console.log('[CWL] Polling guild', guild.id, 'for CWL updates');

  for (const clanTag of cfg.clans) {
    try {
      const cleanTag = cleanClanTag(clanTag);
      if (!cleanTag) continue;

      const clanInfo = await fetchClanInfo(cleanTag);
      if (!clanInfo) continue;

      await checkCWLStatus(guild, cfg, cleanTag, clanInfo);
    } catch (error) {
      console.error(`[CWL] Error polling clan ${clanTag}:`, error.message);
    }
  }
}

/**
 * Check CWL status for a clan
 */
async function checkCWLStatus(guild, cfg, clanTag, clanInfo) {
  const stateManager = getCWLStateManager();
  
  // Fetch CWL league group data
  const leagueData = await fetchCWLLeagueGroup(clanTag);
  
  // Get current CWL state from database
  const currentState = await stateManager.getCurrentCWLState(guild.id, clanTag);
  
  // Determine if state transition is needed
  const transitionAction = stateManager.getTransitionAction(currentState, leagueData);

  if (process.env.COC_DEBUG === '1') {
    console.log(`[CWL] Transition check for clan ${clanTag}:`, JSON.stringify(transitionAction, null, 2));
  }

  // Handle state transitions
  if (transitionAction.action === 'transition') {
    await handleCWLTransition(guild, cfg, clanTag, clanInfo, transitionAction, leagueData, currentState);
  } else if (leagueData && currentState.cwl_state === stateManager.STATES.ACTIVE) {
    // Check for new rounds to announce
    await checkCWLRounds(guild, cfg, clanTag, clanInfo, leagueData, currentState);
  }
}

/**
 * Handle CWL state transitions
 */
async function handleCWLTransition(guild, cfg, clanTag, clanInfo, transitionAction, leagueData, currentState) {
  const stateManager = getCWLStateManager();

  console.log(`[CWL] State transition: ${transitionAction.from} → ${transitionAction.to} for clan ${clanTag}`);

  // Handle CWL Started (Preparation)
  if (transitionAction.to === stateManager.STATES.PREPARATION) {
    await announceCWLStarted(guild, cfg, clanTag, clanInfo, leagueData);
    await stateManager.updateCWLState(guild.id, clanTag, stateManager.STATES.PREPARATION, leagueData, {
      cwl_start_time: new Date()
    });
  }

  // Handle CWL Wars Active
  if (transitionAction.to === stateManager.STATES.ACTIVE) {
    await announceCWLWarsStarted(guild, cfg, clanTag, clanInfo, leagueData);
    await stateManager.updateCWLState(guild.id, clanTag, stateManager.STATES.ACTIVE, leagueData);
  }

  // Handle CWL Ended
  if (transitionAction.to === stateManager.STATES.ENDED) {
    await announceCWLEnded(guild, cfg, clanTag, clanInfo, leagueData, currentState);
    await stateManager.updateCWLState(guild.id, clanTag, stateManager.STATES.ENDED, leagueData, {
      cwl_end_time: new Date()
    });
  }
}

/**
 * Check and announce CWL rounds
 */
async function checkCWLRounds(guild, cfg, clanTag, clanInfo, leagueData, currentState) {
  if (!leagueData.rounds || !Array.isArray(leagueData.rounds)) return;

  const stateManager = getCWLStateManager();
  const announcedRounds = currentState.announced_rounds || [];
  
  // Find clan in league data
  const ourClan = leagueData.clans?.find(c => cleanClanTag(c.tag) === clanTag);
  if (!ourClan) return;

  // Check each round
  for (let roundIndex = 0; roundIndex < leagueData.rounds.length; roundIndex++) {
    const round = leagueData.rounds[roundIndex];
    const roundNumber = roundIndex + 1;

    // Skip if already announced
    if (announcedRounds.includes(roundNumber)) continue;

    // Find our war in this round
    const ourWarTag = round.warTags.find(tag => tag && tag !== '#0');
    if (!ourWarTag) continue;

    // Fetch the war details
    const warData = await fetchCWLWar(ourWarTag);
    if (!warData) continue;

    // Only announce if war is in progress or ended
    if (warData.state === 'inWar' || warData.state === 'warEnded') {
      await announceCWLRound(guild, cfg, clanTag, clanInfo, warData, roundNumber, leagueData);
      await stateManager.markRoundAnnounced(guild.id, clanTag, roundNumber);
    }
  }
}

/**
 * Announce CWL Started
 */
async function announceCWLStarted(guild, cfg, clanTag, clanInfo, leagueData) {
  try {
    // Get CWL announce channel from per-clan config or fallback to war channel
    const clanConfigs = cfg.clanConfigs || {};
    const clanConfig = clanConfigs[clanTag] || {};
    const channelId = clanConfig.cwlAnnounceChannelId || clanConfig.warAnnounceChannelId || cfg.warAnnounceChannelId;

    if (!channelId) {
      console.warn(`[CWL] No announce channel configured for clan ${clanTag}`);
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const numClans = leagueData.clans?.length || 0;
    const numRounds = leagueData.rounds?.length || 0;

    const embed = {
      title: '🏆 CWL Started!',
      description: `**${clanInfo.name}** has entered Clan War League!`,
      color: 0xFFD700, // Gold
      fields: [
        { name: 'Clan', value: `${clanInfo.name} (${formatClanTag(clanTag)})`, inline: true },
        { name: 'Season', value: leagueData.season || 'Unknown', inline: true },
        { name: 'Clans', value: `${numClans}`, inline: true },
        { name: 'Rounds', value: `${numRounds}`, inline: true }
      ],
      footer: { text: 'Clan War League' },
      timestamp: new Date().toISOString()
    };

    // Get mention targets
    const mentionTargets = clanConfig.warMentionTargets || cfg.mentionTargets || [];
    let content = '';
    if (mentionTargets.length > 0) {
      content = mentionTargets.map(t => t.startsWith('<@') ? t : `<@&${t}>`).join(' ');
    }

    const message = await channel.send({ 
      content: content || undefined, 
      embeds: [embed] 
    });

    // Store announcement message ID
    const stateManager = getCWLStateManager();
    await stateManager.storeCWLMessageId(guild.id, clanTag, 'announcement', message.id);

    console.log(`[CWL] Announced CWL started for clan ${clanTag} in guild ${guild.id}`);
  } catch (error) {
    console.error('[CWL] Error announcing CWL started:', error.message);
  }
}

/**
 * Announce CWL Wars Started
 */
async function announceCWLWarsStarted(guild, cfg, clanTag, clanInfo, leagueData) {
  try {
    const clanConfigs = cfg.clanConfigs || {};
    const clanConfig = clanConfigs[clanTag] || {};
    const channelId = clanConfig.cwlAnnounceChannelId || clanConfig.warAnnounceChannelId || cfg.warAnnounceChannelId;

    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const embed = {
      title: '⚔️ CWL Wars Started!',
      description: `**${clanInfo.name}** CWL wars are now active!`,
      color: 0xFF6B35, // Orange
      fields: [
        { name: 'Clan', value: `${clanInfo.name} (${formatClanTag(clanTag)})`, inline: true },
        { name: 'Season', value: leagueData.season || 'Unknown', inline: true }
      ],
      footer: { text: 'Clan War League' },
      timestamp: new Date().toISOString()
    };

    const message = await channel.send({ embeds: [embed] });

    // Store announcement message ID
    const stateManager = getCWLStateManager();
    await stateManager.storeCWLMessageId(guild.id, clanTag, 'announcement', message.id);

    console.log(`[CWL] Announced CWL wars started for clan ${clanTag}`);
  } catch (error) {
    console.error('[CWL] Error announcing CWL wars started:', error.message);
  }
}

/**
 * Announce CWL Round Result
 */
async function announceCWLRound(guild, cfg, clanTag, clanInfo, warData, roundNumber, leagueData) {
  try {
    const clanConfigs = cfg.clanConfigs || {};
    const clanConfig = clanConfigs[clanTag] || {};
    // Use leaderboard channel for round results, fallback to announce channel or war channel
    const channelId = clanConfig.cwlLeaderboardChannelId || clanConfig.cwlAnnounceChannelId || clanConfig.warLeaderboardChannelId || cfg.warLeaderboardChannelId;

    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    // Determine war result
    let warResult = 'Tie';
    let warColor = 0xFFFF00; // Yellow

    if (warData.state === 'warEnded') {
      const ourStars = warData.clan.stars || 0;
      const theirStars = warData.opponent.stars || 0;

      if (ourStars > theirStars) {
        warResult = 'Victory';
        warColor = 0x00FF00; // Green
      } else if (ourStars < theirStars) {
        warResult = 'Defeat';
        warColor = 0xFF0000; // Red
      } else {
        // Check destruction
        const ourDestruction = warData.clan.destructionPercentage || 0;
        const theirDestruction = warData.opponent.destructionPercentage || 0;
        if (ourDestruction > theirDestruction) {
          warResult = 'Victory';
          warColor = 0x00FF00;
        } else if (ourDestruction < theirDestruction) {
          warResult = 'Defeat';
          warColor = 0xFF0000;
        }
      }
    }

    const embed = {
      title: `🏆 CWL Round ${roundNumber} ${warData.state === 'warEnded' ? 'Result' : 'Update'}`,
      description: `**${warData.clan.name}** vs **${warData.opponent.name}**`,
      color: warColor,
      fields: [
        { name: 'Round', value: `${roundNumber}`, inline: true },
        { name: 'Status', value: warData.state === 'warEnded' ? warResult : 'In Progress', inline: true },
        { name: 'Our Stars', value: `${warData.clan.stars || 0}⭐`, inline: true },
        { name: 'Enemy Stars', value: `${warData.opponent.stars || 0}⭐`, inline: true },
        { name: 'Our Destruction', value: `${(warData.clan.destructionPercentage || 0).toFixed(1)}%`, inline: true },
        { name: 'Enemy Destruction', value: `${(warData.opponent.destructionPercentage || 0).toFixed(1)}%`, inline: true }
      ],
      footer: { text: `CWL ${leagueData.season || ''}` },
      timestamp: new Date().toISOString()
    };

    const message = await channel.send({ embeds: [embed] });

    // Store leaderboard message ID
    const stateManager = getCWLStateManager();
    await stateManager.storeCWLMessageId(guild.id, clanTag, 'leaderboard', message.id);

    // === NEW ENHANCED FEATURES ===
    
    // 1. Record player performance
    const playerPerformance = getCWLPlayerPerformance();
    const season = stateManager.getCurrentSeason();
    await playerPerformance.recordRoundAttacks(guild.id, clanTag, season, roundNumber, warData);
    
    // 2. Update leaderboard standings
    const leaderboard = getCWLLeaderboard();
    await leaderboard.updateRoundStandings(guild.id, clanTag, season, roundNumber, leagueData);
    
    // 3. Send leaderboard update (if war ended)
    if (warData.state === 'warEnded') {
      const leaderboardEmbed = await leaderboard.generateLeaderboardEmbed(guild.id, clanTag, season);
      if (leaderboardEmbed) {
        const leaderboardMsg = await channel.send({ embeds: [leaderboardEmbed] });
        await leaderboard.updateLeaderboardMessageId(guild.id, clanTag, season, roundNumber, leaderboardMsg.id);
      }
      
      // 4. Send predictions update (after round 3+)
      if (roundNumber >= 3) {
        const predictions = getCWLPredictions();
        const predictionEmbed = await predictions.generatePredictionEmbed(guild.id, clanTag, season);
        if (predictionEmbed) {
          await channel.send({ embeds: [predictionEmbed] });
        }
      }
    }
    
    // 5. Check for attack reminders (if war is still active)
    if (warData.state === 'inWar') {
      const reminders = getCWLReminders(guild.client);
      await reminders.sendAttackReminders(guild.id, clanTag, season, roundNumber, warData);
    }
    
    // === PHASE 2 FEATURES ===
    
    // 6. Announce MVP awards (if round ended)
    if (warData.state === 'warEnded') {
      const mvpAwards = getCWLMVPAwards();
      const roundMVPEmbed = await mvpAwards.generateRoundMVPEmbed(guild.id, clanTag, season, roundNumber);
      if (roundMVPEmbed) {
        await channel.send({ embeds: [roundMVPEmbed] });
      }
      
      // If final round, announce season MVP
      if (roundNumber === 7) {
        const seasonMVPEmbed = await mvpAwards.generateSeasonMVPEmbed(guild.id, clanTag, season);
        if (seasonMVPEmbed) {
          await channel.send({ embeds: [seasonMVPEmbed] });
        }
        
        // Send comprehensive dashboard
        const dashboard = getCWLStatisticsDashboard();
        const dashboardEmbed = await dashboard.generateDashboardEmbed(guild.id, clanTag, season);
        if (dashboardEmbed) {
          await channel.send({ embeds: [dashboardEmbed] });
        }
      }
    }

    console.log(`[CWL] Announced round ${roundNumber} for clan ${clanTag}`);
  } catch (error) {
    console.error(`[CWL] Error announcing round ${roundNumber}:`, error.message);
  }
}

/**
 * Announce CWL Ended with final standings
 */
async function announceCWLEnded(guild, cfg, clanTag, clanInfo, leagueData, currentState) {
  try {
    const clanConfigs = cfg.clanConfigs || {};
    const clanConfig = clanConfigs[clanTag] || {};
    const channelId = clanConfig.cwlAnnounceChannelId || clanConfig.warAnnounceChannelId || cfg.warAnnounceChannelId;

    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    // Calculate final standings if available
    let standingsText = '';
    if (leagueData && leagueData.clans) {
      const sortedClans = [...leagueData.clans].sort((a, b) => b.stars - a.stars);
      const ourClan = sortedClans.find(c => cleanClanTag(c.tag) === clanTag);
      const ourPosition = sortedClans.indexOf(ourClan) + 1;

      standingsText = `**Position:** ${ourPosition}/${sortedClans.length}\n`;
      standingsText += `**Stars Earned:** ${ourClan?.stars || 0}⭐\n`;
      standingsText += `**Destruction:** ${(ourClan?.destructionPercentage || 0).toFixed(1)}%`;
    }

    const embed = {
      title: '🏁 CWL Ended!',
      description: `**${clanInfo.name}** Clan War League has concluded!\n\n${standingsText}`,
      color: 0x9370DB, // Purple
      fields: [
        { name: 'Clan', value: `${clanInfo.name} (${formatClanTag(clanTag)})`, inline: true },
        { name: 'Season', value: leagueData?.season || currentState.season || 'Unknown', inline: true }
      ],
      footer: { text: 'Clan War League' },
      timestamp: new Date().toISOString()
    };

    await channel.send({ embeds: [embed] });

    console.log(`[CWL] Announced CWL ended for clan ${clanTag}`);
  } catch (error) {
    console.error('[CWL] Error announcing CWL ended:', error.message);
  }
}

/**
 * Start CWL watcher service
 */
function startCWLWatcher(client) {
  const COC_API_TOKEN = process.env.COC_API_TOKEN;
  if (!COC_API_TOKEN) {
    console.warn('CWL watcher disabled: No COC_API_TOKEN found');
    return;
  }

  console.log('CWL watcher starting...');

  async function tick() {
    try {
      for (const guild of client.guilds.cache.values()) {
        await pollGuildCWL(guild);
      }
    } catch (error) {
      console.error('[CWL] Polling error:', error.message);
    }

    // CWL polling interval (check every 30 minutes)
    const interval = parseInt(process.env.CWL_POLLING_INTERVAL || '1800', 10);
    setTimeout(tick, Math.max(300, interval) * 1000); // Minimum 5 minutes
  }

  // Initial delay (1 minute after bot starts)
  setTimeout(tick, 60000);
  console.log('CWL watcher started');
}

module.exports = {
  startCWLWatcher,
  pollGuildCWL,
  // Export manager getters for interaction handlers
  getCWLStateManager,
  getCWLPlayerPerformance,
  getCWLLeaderboard,
  getCWLPredictions,
  getCWLReminders,
  getCWLMVPAwards,
  getCWLDataExport,
  getCWLInteractiveLeaderboard,
  getCWLStatisticsDashboard,
  getCWLClanManagement
};
