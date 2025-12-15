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
const CWLLeaderboardCanvas = require('../../utils/cwl/CWLLeaderboardCanvas');
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
  
  if (!leagueData) {
    return;
  }
  
  
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
  if (!ourClan) {
    return;
  }

  // Check each round
  for (let roundIndex = 0; roundIndex < leagueData.rounds.length; roundIndex++) {
    const round = leagueData.rounds[roundIndex];
    const roundNumber = roundIndex + 1;


    // Find our war in this round by checking all war tags
    let ourWarTag = null;
    for (const warTag of round.warTags) {
      if (!warTag || warTag === '#0') continue;
      
      const warData = await fetchCWLWar(warTag);
      if (!warData) continue;
      
      // Check if this war includes our clan
      const ourClanTag = cleanClanTag(clanTag);
      const clan1Tag = cleanClanTag(warData.clan?.tag);
      const clan2Tag = cleanClanTag(warData.opponent?.tag);
      
      if (clan1Tag === ourClanTag || clan2Tag === ourClanTag) {
        ourWarTag = warTag;
        break;
      }
    }
    
    if (!ourWarTag) {
      continue;
    }


    // Fetch the war details
    const warData = await fetchCWLWar(ourWarTag);
    if (!warData) {
      continue;
    }


    // === CONTINUOUS PLAYER PERFORMANCE TRACKING ===
    // Update player performance data on EVERY poll (not just when announcing)
    // This ensures we capture all attacks as they happen
    if (warData.state === 'inWar' || warData.state === 'warEnded') {
      // Check if round is finalized before updating
      const leaderboard = getCWLLeaderboard();
      const season = stateManager.getCurrentSeason();
      const standingsHistory = await leaderboard.getStandingsHistory(guild.id, clanTag, season);
      const roundData = standingsHistory.find(r => r.round_number === roundNumber);
      const isFinalized = roundData?.war_finalized;
      
      if (!isFinalized) {
        const playerPerformance = getCWLPlayerPerformance();
        await playerPerformance.recordRoundAttacks(guild.id, clanTag, season, roundNumber, warData);
        // console.log(`[CWL] Updated player performance for round ${roundNumber} (${warData.state})`);
        
        // Also update round standings continuously (even if already announced)
        await leaderboard.updateRoundStandings(guild.id, clanTag, season, roundNumber, leagueData, warData);
        // console.log(`[CWL] Updated round standings for round ${roundNumber} (${warData.state})`);
        
        // Check for attack reminders continuously (if war is still active)
        if (warData.state === 'inWar') {
          const reminders = getCWLReminders(guild.client);
          await reminders.sendAttackReminders(guild.id, clanTag, season, roundNumber, warData, cfg);
        }
      } else {
        if (process.env.COC_DEBUG === '1') {
        }
      }
    }

    // If not yet announced and war is active or ended, announce once with canvas
    if (!announcedRounds.includes(roundNumber)) {
      if (warData.state === 'inWar' || warData.state === 'warEnded') {
        await announceCWLRound(guild, cfg, clanTag, clanInfo, warData, roundNumber, leagueData);
        await stateManager.markRoundAnnounced(guild.id, clanTag, roundNumber);
      }
    } else {
      // Check if round is finalized before attempting any canvas updates
      const leaderboard = getCWLLeaderboard();
      const season = stateManager.getCurrentSeason();
      const standingsHistory = await leaderboard.getStandingsHistory(guild.id, clanTag, season);
      const roundData = standingsHistory.find(r => r.round_number === roundNumber);
      const isFinalized = roundData?.war_finalized;
      
      if (isFinalized) {
        if (process.env.COC_DEBUG === '1') {
        }
        continue; // Skip this round completely
      }
      
      if (warData.state === 'warEnded') {
        // Already announced earlier (likely during inWar). Update the existing canvas message with final results.
        await updateCWLFinalRoundCanvas(guild, cfg, clanTag, clanInfo, warData, roundNumber, leagueData);
      } else if (warData.state === 'inWar') {
        // Already announced and war in progress: refresh canvas every poll (~1 minute)
        await updateCWLInWarCanvas(guild, cfg, clanTag, clanInfo, warData, roundNumber, leagueData);
      }
    }
  }
}

/**
 * Announce CWL Started
 */
async function announceCWLStarted(guild, cfg, clanTag, clanInfo, leagueData) {
  try {
    // Get CWL announce channel from per-clan config (REQUIRED - no fallback)
    const clanConfigs = cfg.clanConfigs || {};
    const clanConfig = clanConfigs[clanTag] || {};
    const channelId = clanConfig.cwlAnnounceChannelId;

    if (!channelId) {
      console.warn(`[CWL] ⚠️  Clan ${clanTag} (${clanInfo.name}) has no CWL Announce Channel configured!`);
      console.warn(`[CWL] ℹ️  Please set 'CWL Announcements' channel in Dashboard → Games & Socials → Clash of Clans → Clan Configuration`);
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      console.warn(`[CWL] Channel ${channelId} not found for clan ${clanTag}`);
      return;
    }

    console.log(`[CWL] Announcing CWL started for ${clanInfo.name} in channel ${channel.name} (cwlAnnounceChannelId)`);

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

    // Post initial CWL Statistics Dashboard in the leaderboard channel
    await postCWLStatisticsDashboard(guild, cfg, clanTag, clanInfo);
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
    const channelId = clanConfig.cwlAnnounceChannelId;

    if (!channelId) {
      console.warn(`[CWL] ⚠️  Clan ${clanTag} (${clanInfo.name}) has no CWL Announce Channel configured!`);
      console.warn(`[CWL] ℹ️  Please set 'CWL Announcements' channel in Dashboard → Games & Socials → Clash of Clans → Clan Configuration`);
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      console.warn(`[CWL] Channel ${channelId} not found for clan ${clanTag}`);
      return;
    }

    console.log(`[CWL] Announcing CWL wars started for ${clanInfo.name} in channel ${channel.name} (cwlAnnounceChannelId)`);

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
    // Use CWL Announce channel for round announcements (NOT leaderboard channel)
    const channelId = clanConfig.cwlAnnounceChannelId;

    if (!channelId) {
      console.warn(`[CWL] ⚠️  Clan ${clanTag} (${clanInfo.name}) has no CWL Announce Channel configured!`);
      console.warn(`[CWL] ℹ️  Please set 'CWL Announcements' channel in Dashboard → Games & Socials → Clash of Clans → Clan Configuration`);
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      console.warn(`[CWL] Channel ${channelId} not found for clan ${clanTag}`);
      return;
    }

    console.log(`[CWL] Announcing round ${roundNumber} for ${warData.clan.name} vs ${warData.opponent.name} in channel ${channel.name} (cwlAnnounceChannelId)`);
    // The API might return clans in any order, so we need to check and swap if needed
    const ourClanTag = cleanClanTag(clanTag);
    const clan1Tag = cleanClanTag(warData.clan?.tag);
    const clan2Tag = cleanClanTag(warData.opponent?.tag);
    
    if (clan2Tag === ourClanTag && clan1Tag !== ourClanTag) {
      // Swap clan and opponent so our clan is always in warData.clan
      const temp = warData.clan;
      warData.clan = warData.opponent;
      warData.opponent = temp;
      console.log(`[CWL] Swapped clan/opponent for correct perspective (clan ${clanTag})`);
    }

    console.log(`[CWL] Announcing round ${roundNumber} for ${warData.clan.name} vs ${warData.opponent.name} in channel ${channel.name} (cwlLeaderboardChannelId)`);

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

    // Determine embed description based on war state
    let embedDescription = `**${warData.clan.name}** vs **${warData.opponent.name}**`;
    let embedFooter = `CWL ${leagueData.season || ''}`;
    let embedTimestamp = undefined; // Don't include timestamp by default
    
    if (warData.state === 'warEnded') {
      // For ended wars, show war end time in footer, no timestamp field
      if (warData.endTime) {
        try {
          const warEndDate = new Date(warData.endTime);
          const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
          const formattedTime = warEndDate.toLocaleString('en-US', options);
          embedFooter = `CWL ${leagueData.season || ''} • War Ended • ${formattedTime}`;
        } catch (e) {
          embedFooter = `CWL ${leagueData.season || ''} • War Ended`;
        }
      } else {
        embedFooter = `CWL ${leagueData.season || ''} • War Ended`;
      }
    } else {
      // For in-progress wars, show "Last Updated" with timestamp
      embedDescription += `\n\n🕐 Last Updated: <t:${Math.floor(Date.now() / 1000)}:R>`;
      embedTimestamp = new Date().toISOString();
    }

    const embed = {
      title: `🏆 CWL Round ${roundNumber} ${warData.state === 'warEnded' ? 'Result' : 'Update'}`,
      description: embedDescription,
      color: warColor,
      fields: [
        { name: 'Round', value: `${roundNumber}`, inline: true },
        { name: 'Status', value: warData.state === 'warEnded' ? warResult : 'In Progress', inline: true },
        { name: 'Our Stars', value: `${warData.clan.stars || 0}⭐`, inline: true },
        { name: 'Enemy Stars', value: `${warData.opponent.stars || 0}⭐`, inline: true },
        { name: 'Our Destruction', value: `${(warData.clan.destructionPercentage || 0).toFixed(1)}%`, inline: true },
        { name: 'Enemy Destruction', value: `${(warData.opponent.destructionPercentage || 0).toFixed(1)}%`, inline: true }
      ],
      footer: { text: embedFooter }
    };
    
    // Only add timestamp if it's defined (for in-progress wars)
    if (embedTimestamp) {
      embed.timestamp = embedTimestamp;
    }

    // Build player list for canvas from DB performance (authoritative)
    const perfSvc = getCWLPlayerPerformance();
    if (!perfSvc) {
      console.error('[CWL] ERROR: getCWLPlayerPerformance() returned null/undefined');
      throw new Error('CWLPlayerPerformance service not initialized');
    }
    const seasonForPlayers = getCWLStateManager().getCurrentSeason();
    const perfRows = await perfSvc.getRoundPlayerPerformance(guild.id, cleanClanTag(clanTag), seasonForPlayers, roundNumber);
    
    // Get cumulative stats for all rounds up to current round (for Avg, Wars, WR columns)
    const cumulativeStats = await getCumulativeCWLStats(guild.id, cleanClanTag(clanTag), seasonForPlayers, roundNumber);
    
    // Build a lookup for opponent positions
    const opponentMembers = Array.isArray(warData.opponent?.members) ? warData.opponent.members : [];
    const opponentByTag = new Map(opponentMembers.map(m => [m.tag, m]));
    
    // Build a lookup for clan members to get roles from clanInfo
    const clanMemberList = Array.isArray(clanInfo?.memberList) ? clanInfo.memberList : [];
    const clanMemberByTag = new Map(clanMemberList.map(m => [m.tag, m]));

    const players = perfRows.map((r, idx) => {
      const details = [];
      // We only persist the best (or total) metrics per player per round; map to a single detail entry
      if (r.attack_order && r.stars_earned != null) {
        const target = r.target_tag ? opponentByTag.get(r.target_tag) : null;
        details.push({
          defenderPosition: r.target_position ?? (target?.mapPosition ?? null),
          stars: Number(r.stars_earned) || 0,
          destructionPercentage: Number(r.destruction_percentage) || 0
        });
      }
      
      // Get cumulative stats for this player
      const playerStats = cumulativeStats.get(r.player_tag) || {
        totalStars: 0,
        totalAttacks: 0,
        roundsParticipated: 0,
        roundsWon: 0
      };
      
      // Get player role from clanInfo
      const clanMember = clanMemberByTag.get(r.player_tag);
      
      return {
        rank: idx + 1,
        name: r.player_name,
        role: formatRole(clanMember?.role),
        townHallLevel: r.townhall_level || 1, // ✅ CORRECT - attacker's TH from database
        averageStars: playerStats.totalAttacks > 0 ? (playerStats.totalStars / playerStats.totalAttacks).toFixed(2) : '0.00',
        warsParticipated: playerStats.roundsParticipated,
        winRate: playerStats.roundsParticipated > 0 ? ((playerStats.roundsWon / playerStats.roundsParticipated) * 100).toFixed(1) : '0.0', // Personal win rate
        currentWarAttackDetails: details
      };
    });

    // Compose warData object as expected by canvas war generator
    const canvasWarData = {
      clanName: warData.clan?.name || clanInfo.name,
      clanTag: clanTag,
      currentWar: warData,
      opponent: warData.opponent?.name
    };

    const warState = warData.state === 'preparation' ? 'preparation' : (warData.state === 'inWar' ? 'inWar' : 'warEnded');
    const canvas = new CWLLeaderboardCanvas();
    const canvasBuffer = await canvas.generateCWLWarLeaderboard(
      players,
      { ...cfg, clan_name: canvasWarData.clanName, clan_tag: clanTag },
      1,
      1,
      canvasWarData,
      warState
    );

  const message = await channel.send({ embeds: [embed], files: [{ attachment: canvasBuffer, name: `cwl_round_${roundNumber}.png` }] });

  // Store per-round leaderboard message ID in standings table so we can edit later on war end
  const stateManager = getCWLStateManager();
  const cwlLeaderboardSvc = getCWLLeaderboard();
  const seasonForMsg = stateManager.getCurrentSeason();
  await cwlLeaderboardSvc.updateLeaderboardMessageId(guild.id, clanTag, seasonForMsg, roundNumber, message.id);

    // Don't mark as finalized here - let updateCWLFinalRoundCanvas handle it
    // This allows the canvas to be updated with final results even if war ends between polls

    // === NEW ENHANCED FEATURES ===
    
    // Note: Player performance and standings are now tracked continuously in checkCWLRounds()
    // This announcement function only handles the announcement and related features
    
    // 1. Send leaderboard update (if war ended)
  const leaderboard = getCWLLeaderboard();
  const season = stateManager.getCurrentSeason();
    if (warData.state === 'warEnded') {
      const leaderboardEmbed = await leaderboard.generateLeaderboardEmbed(guild.id, clanTag, season);
      if (leaderboardEmbed) {
        await channel.send({ embeds: [leaderboardEmbed] });
      }
      
      // 2. Send predictions update (after round 3+)
      if (roundNumber >= 3) {
        const predictions = getCWLPredictions();
        const predictionEmbed = await predictions.generatePredictionEmbed(guild.id, clanTag, season);
        if (predictionEmbed) {
          await channel.send({ embeds: [predictionEmbed] });
        }
      }
    }
    
    // === PHASE 2 FEATURES ===
    
    // 4. Announce MVP awards (if round ended)
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
    console.error(`[CWL] Error stack:`, error.stack);
    console.error(`[CWL] perfSvc type:`, typeof getCWLPlayerPerformance());
    console.error(`[CWL] perfSvc value:`, getCWLPlayerPerformance());
  }
}

/**
 * Update existing CWL round canvas message with final results after war ends
 */
async function updateCWLFinalRoundCanvas(guild, cfg, clanTag, clanInfo, warData, roundNumber, leagueData) {
  try {
    const clanConfigs = cfg.clanConfigs || {};
    const clanConfig = clanConfigs[clanTag] || {};
    // Use CWL Announce channel (same as initial announcement)
    const channelId = clanConfig.cwlAnnounceChannelId;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const stateManager = getCWLStateManager();
    const cwlLeaderboardSvc = getCWLLeaderboard();
    const season = stateManager.getCurrentSeason();

    // Check if already finalized
    const standingsHistory = await cwlLeaderboardSvc.getStandingsHistory(guild.id, clanTag, season);
    const roundData = standingsHistory.find(r => r.round_number === roundNumber);
    
    if (roundData?.war_finalized) {
      return;
    }

    // Fetch the previously stored message id for this round from standings table
    const messageId = await getCWLStandingMessageId(cwlLeaderboardSvc, guild.id, clanTag, season, roundNumber);
    if (!messageId) return; // No message to update

    // Ensure perspective: our clan should be in warData.clan
    const ourClanTag = cleanClanTag(clanTag);
    const clan1Tag = cleanClanTag(warData.clan?.tag);
    const clan2Tag = cleanClanTag(warData.opponent?.tag);
    if (clan2Tag === ourClanTag && clan1Tag !== ourClanTag) {
      const temp = warData.clan;
      warData.clan = warData.opponent;
      warData.opponent = temp;
      if (process.env.COC_DEBUG === '1') {
        console.log(`[CWL] (update) Swapped clan/opponent for correct perspective (clan ${clanTag})`);
      }
    }

  // Rebuild players and canvas like in announceCWLRound, but from DB performance
    const perfSvc = getCWLPlayerPerformance();
    const perfRows = await perfSvc.getRoundPlayerPerformance(guild.id, cleanClanTag(clanTag), season, roundNumber);
    
    // Get cumulative stats for all rounds up to current round (for Avg, Wars, WR columns)
    const cumulativeStats = await getCumulativeCWLStats(guild.id, cleanClanTag(clanTag), season, roundNumber);
    
    const opponentMembers = Array.isArray(warData.opponent?.members) ? warData.opponent.members : [];
    const opponentByTag = new Map(opponentMembers.map(m => [m.tag, m]));
    
    // Build a lookup for clan members to get roles from clanInfo
    const clanMemberList = Array.isArray(clanInfo?.memberList) ? clanInfo.memberList : [];
    const clanMemberByTag = new Map(clanMemberList.map(m => [m.tag, m]));
    
    const players = perfRows.map((r, idx) => {
      const details = [];
      if (r.attack_order && r.stars_earned != null) {
        const target = r.target_tag ? opponentByTag.get(r.target_tag) : null;
        details.push({
          defenderPosition: r.target_position ?? (target?.mapPosition ?? null),
          stars: Number(r.stars_earned) || 0,
          destructionPercentage: Number(r.destruction_percentage) || 0
        });
      }
      
      // Get cumulative stats for this player
      const playerStats = cumulativeStats.get(r.player_tag) || {
        totalStars: 0,
        totalAttacks: 0,
        roundsParticipated: 0,
        roundsWon: 0
      };
      
      // Get player role from clanInfo
      const clanMember = clanMemberByTag.get(r.player_tag);
      
      return {
        rank: idx + 1,
        name: r.player_name,
        role: formatRole(clanMember?.role),
        townHallLevel: r.townhall_level || 1, // ✅ CORRECT - attacker's TH from database
        averageStars: playerStats.totalAttacks > 0 ? (playerStats.totalStars / playerStats.totalAttacks).toFixed(2) : '0.00',
        warsParticipated: playerStats.roundsParticipated,
        winRate: playerStats.roundsParticipated > 0 ? ((playerStats.roundsWon / playerStats.roundsParticipated) * 100).toFixed(1) : '0.0', // Personal win rate
        currentWarAttackDetails: details
      };
    });

    const canvasWarData = {
      clanName: warData.clan?.name || clanInfo.name,
      clanTag: clanTag,
      currentWar: warData,
      opponent: warData.opponent?.name
    };
    const canvas = new CWLLeaderboardCanvas();
    const canvasBuffer = await canvas.generateCWLWarLeaderboard(
      players,
      { ...cfg, clan_name: canvasWarData.clanName, clan_tag: clanTag },
      1,
      1,
      canvasWarData,
      'warEnded'
    );

    // Build updated embed for final result
    let warResult = 'Tie';
    let warColor = 0xFFFF00; // Yellow
    const ourStars = warData.clan.stars || 0;
    const theirStars = warData.opponent.stars || 0;
    if (ourStars > theirStars) {
      warResult = 'Victory';
      warColor = 0x00FF00;
    } else if (ourStars < theirStars) {
      warResult = 'Defeat';
      warColor = 0xFF0000;
    } else {
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
    
    // For finalized wars, format the war end time as readable text
    let warEndedText = 'War Ended';
    if (warData.endTime) {
      try {
        const warEndDate = new Date(warData.endTime);
        const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        warEndedText = `War Ended • ${warEndDate.toLocaleString('en-US', options)}`;
      } catch (e) {
        warEndedText = 'War Ended';
      }
    }
    
    const finalEmbed = {
      title: `🏆 CWL Round ${roundNumber} Result`,
      description: `**${warData.clan.name}** vs **${warData.opponent.name}**`,
      color: warColor,
      fields: [
        { name: 'Round', value: `${roundNumber}`, inline: true },
        { name: 'Status', value: warResult, inline: true },
        { name: 'Our Stars', value: `${ourStars}⭐`, inline: true },
        { name: 'Enemy Stars', value: `${theirStars}⭐`, inline: true },
        { name: 'Our Destruction', value: `${(warData.clan.destructionPercentage || 0).toFixed(1)}%`, inline: true },
        { name: 'Enemy Destruction', value: `${(warData.opponent.destructionPercentage || 0).toFixed(1)}%`, inline: true }
      ],
      footer: { text: `CWL ${leagueData.season || ''} • ${warEndedText}` }
      // NO timestamp field - this prevents Discord from showing "Last Updated: X ago"
    };

    // Edit the previous message with the final canvas and refreshed embed
    try {
      const msg = await channel.messages.fetch(messageId);
      await msg.edit({ embeds: [finalEmbed], files: [{ attachment: canvasBuffer, name: `cwl_round_${roundNumber}.png` }] });
      
      // Mark this round as finalized so it won't be updated again
      await cwlLeaderboardSvc.markRoundFinalized(guild.id, clanTag, season, roundNumber);
      
    } catch (e) {
      console.error(`[CWL] Could not update final canvas for round ${roundNumber}:`, e.message);
      
      // If message not found (deleted/moved), create a new final announcement
      if (e.message.includes('Unknown Message') || e.code === 10008) {
        try {
          const newMsg = await channel.send({ embeds: [finalEmbed], files: [{ attachment: canvasBuffer, name: `cwl_round_${roundNumber}.png` }] });
          await cwlLeaderboardSvc.updateLeaderboardMessageId(guild.id, clanTag, season, roundNumber, newMsg.id);
          await cwlLeaderboardSvc.markRoundFinalized(guild.id, clanTag, season, roundNumber);
        } catch (createError) {
          console.error(`[CWL] Failed to create new final canvas message:`, createError.message);
        }
      }
      
      if (process.env.COC_DEBUG === '1') {
        console.warn(`[CWL] Could not update final canvas for round ${roundNumber}:`, e.message);
      }
    }
  } catch (error) {
    if (process.env.COC_DEBUG === '1') {
      console.error('[CWL] Error updating final CWL round canvas:', error.message);
    }
  }
}

/**
 * Update existing CWL round canvas message while war is active (inWar)
 * Runs each poll (min 60s) to keep the canvas fresh
 */
async function updateCWLInWarCanvas(guild, cfg, clanTag, clanInfo, warData, roundNumber, leagueData) {
  try {
    const clanConfigs = cfg.clanConfigs || {};
    const clanConfig = clanConfigs[clanTag] || {};
    // Use CWL Announce channel (same as initial announcement)
    const channelId = clanConfig.cwlAnnounceChannelId;
    
    if (!channelId) {
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      return;
    }

    const stateManager = getCWLStateManager();
    const cwlLeaderboardSvc = getCWLLeaderboard();
    const season = stateManager.getCurrentSeason();

    // Previously stored message id for this round
    const messageId = await getCWLStandingMessageId(cwlLeaderboardSvc, guild.id, clanTag, season, roundNumber);
    
    if (!messageId) {
      // If no message exists yet, create initial announcement (shouldn't happen if announced properly during inWar start)
      await announceCWLRound(guild, cfg, clanTag, clanInfo, warData, roundNumber, leagueData);
      return;
    }
    

    // Ensure perspective: our clan should be in warData.clan
    const ourClanTag = cleanClanTag(clanTag);
    const clan1Tag = cleanClanTag(warData.clan?.tag);
    const clan2Tag = cleanClanTag(warData.opponent?.tag);
    if (clan2Tag === ourClanTag && clan1Tag !== ourClanTag) {
      const temp = warData.clan;
      warData.clan = warData.opponent;
      warData.opponent = temp;
      if (process.env.COC_DEBUG === '1') {
        console.log(`[CWL] (inWar update) Swapped clan/opponent for correct perspective (clan ${clanTag})`);
      }
    }

    // Build players like in announceCWLRound, but from DB performance for in-war refresh
    const perfSvc2 = getCWLPlayerPerformance();
    const perfRows2 = await perfSvc2.getRoundPlayerPerformance(guild.id, cleanClanTag(clanTag), season, roundNumber);
    
    // Get cumulative stats for all rounds up to current round (for Avg, Wars, WR columns)
    const cumulativeStats2 = await getCumulativeCWLStats(guild.id, cleanClanTag(clanTag), season, roundNumber);
    
    const opponentMembers2 = Array.isArray(warData.opponent?.members) ? warData.opponent.members : [];
    const opponentByTag2 = new Map(opponentMembers2.map(m => [m.tag, m]));
    
    // Build a lookup for clan members to get roles from clanInfo
    const clanMemberList2 = Array.isArray(clanInfo?.memberList) ? clanInfo.memberList : [];
    const clanMemberByTag2 = new Map(clanMemberList2.map(m => [m.tag, m]));
    
    const players = perfRows2.map((r, idx) => {
      const details = [];
      if (r.attack_order && r.stars_earned != null) {
        const target = r.target_tag ? opponentByTag2.get(r.target_tag) : null;
        details.push({
          defenderPosition: r.target_position ?? (target?.mapPosition ?? null),
          stars: Number(r.stars_earned) || 0,
          destructionPercentage: Number(r.destruction_percentage) || 0
        });
      }
      
      // Get cumulative stats for this player
      const playerStats = cumulativeStats2.get(r.player_tag) || {
        totalStars: 0,
        totalAttacks: 0,
        roundsParticipated: 0,
        roundsWon: 0
      };
      
      // Get player role from clanInfo
      const clanMember = clanMemberByTag2.get(r.player_tag);
      
      return {
        rank: idx + 1,
        name: r.player_name,
        role: formatRole(clanMember?.role),
        townHallLevel: r.townhall_level || 1, // ✅ CORRECT - attacker's TH from database
        averageStars: playerStats.totalAttacks > 0 ? (playerStats.totalStars / playerStats.totalAttacks).toFixed(2) : '0.00',
        warsParticipated: playerStats.roundsParticipated,
        winRate: playerStats.roundsParticipated > 0 ? ((playerStats.roundsWon / playerStats.roundsParticipated) * 100).toFixed(1) : '0.0', // Personal win rate
        currentWarAttackDetails: details
      };
    });

    const canvasWarData = {
      clanName: warData.clan?.name || clanInfo.name,
      clanTag: clanTag,
      currentWar: warData,
      opponent: warData.opponent?.name
    };

    const canvas = new CWLLeaderboardCanvas();
    const canvasBuffer = await canvas.generateCWLWarLeaderboard(
      players,
      { ...cfg, clan_name: canvasWarData.clanName, clan_tag: clanTag },
      1,
      1,
      canvasWarData,
      'inWar'
    );

    // Build updated in-war embed with current totals
    const inWarEmbed = {
      title: `⚔️ CWL Round ${roundNumber} Update`,
      description: `**${warData.clan.name}** vs **${warData.opponent.name}**\n\n🕐 Last Updated: <t:${Math.floor(Date.now() / 1000)}:R>`,
      color: 0xFF6B35,
      fields: [
        { name: 'Round', value: `${roundNumber}`, inline: true },
        { name: 'Status', value: 'In Progress', inline: true },
        { name: 'Our Stars', value: `${warData.clan.stars || 0}⭐`, inline: true },
        { name: 'Enemy Stars', value: `${warData.opponent.stars || 0}⭐`, inline: true },
        { name: 'Our Destruction', value: `${(warData.clan.destructionPercentage || 0).toFixed(1)}%`, inline: true },
        { name: 'Enemy Destruction', value: `${(warData.opponent.destructionPercentage || 0).toFixed(1)}%`, inline: true }
      ],
      footer: { text: `CWL ${leagueData.season || ''}` },
      timestamp: new Date().toISOString()
    };

    // Edit the previous message with refreshed embed + attachment
    try {
      const msg = await channel.messages.fetch(messageId);
      await msg.edit({ embeds: [inWarEmbed], files: [{ attachment: canvasBuffer, name: `cwl_round_${roundNumber}.png` }] });
    } catch (e) {
      console.error(`[CWL] Could not update in-war canvas for round ${roundNumber}:`, e.message);
      
      // If message not found (deleted/moved), create a new announcement
      if (e.message.includes('Unknown Message') || e.code === 10008) {
        try {
          const newMsg = await channel.send({ embeds: [inWarEmbed], files: [{ attachment: canvasBuffer, name: `cwl_round_${roundNumber}.png` }] });
          // Update the stored message ID
          await cwlLeaderboardSvc.updateLeaderboardMessageId(guild.id, clanTag, season, roundNumber, newMsg.id);
        } catch (createError) {
          console.error(`[CWL] Failed to create new canvas message:`, createError.message);
        }
      }
      
      if (process.env.COC_DEBUG === '1') {
        console.warn(`[CWL] Could not update in-war canvas for round ${roundNumber}:`, e.message);
      }
    }
  } catch (error) {
    console.error('[CWL] Error updating in-war CWL canvas:', error.message, error.stack);
    if (process.env.COC_DEBUG === '1') {
      console.error('[CWL] Error updating in-war CWL canvas:', error.message);
    }
  }
}

// Helper: get stored message id from standings row (uses service’s getStandingsHistory)
async function getCWLStandingMessageId(cwlLeaderboardSvc, guildId, clanTag, season, roundNumber) {
  try {
    const history = await cwlLeaderboardSvc.getStandingsHistory(guildId, clanTag, season);
    const round = history.find(r => r.round_number === roundNumber);
    return round?.leaderboard_message_id || null;
  } catch {
    return null;
  }
}

/**
 * Format role name for display
 * @param {string} role - Role from API (member, admin, coLeader, leader)
 * @returns {string} Formatted role (Member, Admin, Co-leader, Leader)
 */
function formatRole(role) {
  if (!role) return 'Member';
  if (role === 'coLeader') return 'Co-leader';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

/**
 * Get cumulative CWL stats for all players up to a specific round
 * Returns Map<playerTag, { totalStars, totalAttacks, roundsParticipated, roundsWon }>
 */
async function getCumulativeCWLStats(guildId, clanTag, season, upToRound) {
  try {
    // Get player cumulative stats with rounds they participated in
    const [rows] = await store.sqlPool.query(
      `SELECT 
        player_tag,
        SUM(stars_earned) as total_stars,
        SUM(attacks_used) as total_attacks,
        COUNT(DISTINCT round_number) as rounds_participated,
        GROUP_CONCAT(DISTINCT round_number ORDER BY round_number) as participated_rounds
       FROM guild_clashofclans_cwl_player_performance
       WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number <= ?
       GROUP BY player_tag`,
      [guildId, clanTag, season, upToRound]
    );
    
    // Get which rounds the clan won from standings table
    const [standingsRows] = await store.sqlPool.query(
      `SELECT 
        round_number,
        wins
       FROM guild_clashofclans_cwl_round_standings
       WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number <= ?`,
      [guildId, clanTag, season, upToRound]
    );
    
    // Build a set of rounds where the clan won
    const wonRounds = new Set();
    for (const row of standingsRows) {
      if (parseInt(row.wins) > 0) {
        wonRounds.add(parseInt(row.round_number));
      }
    }
    
    const statsMap = new Map();
    for (const row of rows) {
      // Parse which rounds this player participated in
      const participatedRounds = row.participated_rounds 
        ? row.participated_rounds.split(',').map(r => parseInt(r))
        : [];
      
      // Count how many rounds this player participated in AND the clan won
      const playerWins = participatedRounds.filter(round => wonRounds.has(round)).length;
      
      statsMap.set(row.player_tag, {
        totalStars: parseInt(row.total_stars) || 0,
        totalAttacks: parseInt(row.total_attacks) || 0,
        roundsParticipated: parseInt(row.rounds_participated) || 0,
        roundsWon: playerWins // Personal wins - only rounds they participated in
      });
    }
    
    return statsMap;
  } catch (error) {
    console.error('[CWL] Error getting cumulative stats:', error);
    return new Map();
  }
}

/**
 * Announce CWL Ended with final standings
 */
async function announceCWLEnded(guild, cfg, clanTag, clanInfo, leagueData, currentState) {
  try {
    const clanConfigs = cfg.clanConfigs || {};
    const clanConfig = clanConfigs[clanTag] || {};
    const channelId = clanConfig.cwlAnnounceChannelId;

    if (!channelId) {
      console.warn(`[CWL] ⚠️  Clan ${clanTag} (${clanInfo.name}) has no CWL Announce Channel configured!`);
      console.warn(`[CWL] ℹ️  Please set 'CWL Announcements' channel in Dashboard → Games & Socials → Clash of Clans → Clan Configuration`);
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      console.warn(`[CWL] Channel ${channelId} not found for clan ${clanTag}`);
      return;
    }

    console.log(`[CWL] Announcing CWL ended for ${clanInfo.name} in channel ${channel.name} (cwlAnnounceChannelId)`);

    // Get final standings from database (authoritative source)
    const stateManager = getCWLStateManager();
    const cwlLeaderboardSvc = getCWLLeaderboard();
    const season = stateManager.getCurrentSeason();
    
    let standingsText = '';
    
    // Get ALL rounds' standings from database to calculate totals
    const allRounds = await cwlLeaderboardSvc.getStandingsHistory(guild.id, clanTag, season);
    
    if (allRounds && allRounds.length > 0) {
      // Calculate cumulative totals from all rounds
      const totalStars = allRounds.reduce((sum, round) => sum + (parseInt(round.stars_earned) || 0), 0);
      const totalDestruction = allRounds.reduce((sum, round) => sum + (parseFloat(round.destruction_percentage) || 0), 0);
      const avgDestruction = allRounds.length > 0 ? (totalDestruction / allRounds.length) : 0;
      
      // Get final position from the last round
      const finalRound = allRounds[allRounds.length - 1];
      
      standingsText = `**Position:** ${finalRound.position}/${finalRound.total_clans}\n`;
      standingsText += `**Stars Earned:** ${totalStars}⭐\n`;
      standingsText += `**Destruction:** ${avgDestruction.toFixed(1)}%\n`;
      standingsText += `**Record:** ${finalRound.wins || 0}W - ${finalRound.losses || 0}L`;
    } else if (leagueData && leagueData.clans) {
      // Fallback to API data if database is empty (shouldn't happen)
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
 * Post or update CWL Statistics Dashboard
 */
async function postCWLStatisticsDashboard(guild, cfg, clanTag, clanInfo) {
  try {
    const clanConfigs = cfg.clanConfigs || {};
    const clanConfig = clanConfigs[clanTag] || {};
    const leaderboardChannelId = clanConfig.cwlLeaderboardChannelId;

    if (!leaderboardChannelId) {
      console.log(`[CWL] No leaderboard channel configured for clan ${clanTag}, skipping dashboard post`);
      return;
    }

    const channel = guild.channels.cache.get(leaderboardChannelId);
    if (!channel) {
      console.warn(`[CWL] Leaderboard channel ${leaderboardChannelId} not found for clan ${clanTag}`);
      return;
    }

    const stateManager = getCWLStateManager();
    const season = stateManager.getCurrentSeason();

    // Generate dashboard embed
    const dashboard = getCWLStatisticsDashboard();
    const embed = await dashboard.generateDashboardEmbed(guild.id, clanTag, season);

    if (!embed) {
      console.log(`[CWL] No dashboard data available yet for clan ${clanTag}`);
      return;
    }

    // Add interactive buttons (same as /cwl dashboard command)
    const interactive = getCWLInteractiveLeaderboard();
    const buttons = interactive.createLeaderboardButtons(clanTag, season);

    // Check if we already have a dashboard message posted
    const currentState = await stateManager.getCurrentCWLState(guild.id, clanTag);
    const existingMessageId = currentState.cwl_leaderboard_message_id;

    if (existingMessageId) {
      // Try to update existing message
      try {
        const existingMessage = await channel.messages.fetch(existingMessageId);
        await existingMessage.edit({ embeds: [embed], components: buttons });
        console.log(`[CWL] Updated dashboard message ${existingMessageId} for clan ${clanTag}`);
      } catch (fetchError) {
        // Message not found, post a new one
        console.log(`[CWL] Could not fetch dashboard message ${existingMessageId}, posting new one`);
        const newMessage = await channel.send({ embeds: [embed], components: buttons });
        await stateManager.storeCWLMessageId(guild.id, clanTag, 'leaderboard', newMessage.id);
        console.log(`[CWL] Posted new dashboard message ${newMessage.id} for clan ${clanTag}`);
      }
    } else {
      // Post new dashboard message
      const newMessage = await channel.send({ embeds: [embed], components: buttons });
      await stateManager.storeCWLMessageId(guild.id, clanTag, 'leaderboard', newMessage.id);
      console.log(`[CWL] Posted initial dashboard message ${newMessage.id} for clan ${clanTag}`);
    }
  } catch (error) {
    console.error(`[CWL] Error posting/updating dashboard for clan ${clanTag}:`, error.message);
  }
}

/**
 * Update all active CWL Statistics Dashboards (hourly)
 */
async function updateAllCWLDashboards(client) {
  try {
    console.log('[CWL] Updating all CWL Statistics Dashboards...');
    const guilds = client.guilds.cache;
    
    for (const guild of guilds.values()) {
      let cfg;
      try {
        cfg = await store.getGuildClashOfClansConfig(guild.id);
      } catch {
        continue;
      }

      if (!cfg.enabled || !cfg.trackCWL) continue;
      if (!Array.isArray(cfg.clans) || !cfg.clans.length) continue;

      for (const clanTag of cfg.clans) {
        try {
          const clanInfo = await fetchClanInfo(clanTag);
          if (!clanInfo) continue;

          // Check if clan is in active CWL
          const stateManager = getCWLStateManager();
          const currentState = await stateManager.getCurrentCWLState(guild.id, clanTag);
          
          if (currentState.cwl_state === stateManager.STATES.ACTIVE || 
              currentState.cwl_state === stateManager.STATES.PREPARATION) {
            await postCWLStatisticsDashboard(guild, cfg, clanTag, clanInfo);
          }
        } catch (error) {
          console.error(`[CWL] Error updating dashboard for clan ${clanTag}:`, error.message);
        }
      }
    }
    
    console.log('[CWL] Finished updating CWL Statistics Dashboards');
  } catch (error) {
    console.error('[CWL] Error in updateAllCWLDashboards:', error.message);
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

    // CWL polling interval (check every 1 minute for real-time tracking)
    const interval = parseInt(process.env.CWL_POLLING_INTERVAL || '60', 10);
    setTimeout(tick, Math.max(60, interval) * 1000); // Minimum 1 minute
  }

  // Dashboard update ticker (every hour)
  async function dashboardTick() {
    try {
      await updateAllCWLDashboards(client);
    } catch (error) {
      console.error('[CWL] Dashboard update error:', error.message);
    }
    setTimeout(dashboardTick, 3600000); // Update every 1 hour
  }

  // Initial delay (1 minute after bot starts)
  setTimeout(tick, 60000);
  console.log('CWL watcher started (polling every 1 minute)');
  
  // Send dashboards immediately after restart (2 minutes after bot starts)
  setTimeout(async () => {
    console.log('[CWL] Sending dashboards after server restart...');
    await updateAllCWLDashboards(client);
  }, 120000);
  
  // Start dashboard updates after first immediate send (every hour after that)
  setTimeout(dashboardTick, 3720000); // 1 hour + 2 minutes (so it runs 1 hour after immediate send)
  console.log('CWL dashboard will be sent after restart and then update every 1 hour');
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
