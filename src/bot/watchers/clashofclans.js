// Clash of Clans watcher: polls configured clans per guild and announces wars, member changes, and donations.
// Stores seen states in clashofclans-state.json for persistence.
const fs = require('fs');
const path = require('path');
const store = require('../../config/store');

const STATE_PATH = path.join(__dirname, 'clashofclans-state.json');
let state = { clans: {} };
try { state = JSON.parse(fs.readFileSync(STATE_PATH,'utf8')); } catch { /* ignore */ }

// Centralized DB update for message ids with logging
async function persistMessageId(guildId, clanTag, field, messageId){
  try {
    const [result] = await store.sqlPool.execute(
      `UPDATE guild_clashofclans_watch SET ${field} = ? WHERE guild_id = ? AND clan_tag = ?`,
      [messageId, guildId, clanTag]
    );
    // mysql2 returns an object with affectedRows
    if(result && typeof result.affectedRows !== 'undefined' && result.affectedRows === 0){
      // console.warn(`[COC] persistMessageId: no row updated field=${field} guild=${guildId} clan=${clanTag}`);
    } else if(process.env.COC_DEBUG==='1') {
      console.log(`[COC] Stored ${field} guild=${guildId} clan=${clanTag} id=${messageId}`);
    }
  } catch(err){
    console.warn(`[COC] Failed to persist ${field} guild=${guildId} clan=${clanTag}: ${err.message}`);
  }
}

// Helper: discover existing leaderboard message for a clan (embed footer contains clan tag) or create placeholder
async function ensureLeaderboardMessage(guild, cfg, type, cleanTag, clanInfo){
  try {
    const isWar = type === 'war';
    const channelId = isWar
      ? (cfg.warLeaderboardChannelId || cfg.warAnnounceChannelId || null)
      : cfg.donationLeaderboardChannelId;
    if(!channelId) return null;

    const messageIdField = isWar ? 'war_preparing_message_id' : 'donation_message_id';
    // Check DB first
    let existingId = null;
    try {
      const [rows] = await store.sqlPool.execute(
        `SELECT ${messageIdField} FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1`,
        [guild.id, cleanTag]
      );
      if(rows.length && rows[0][messageIdField]) return rows[0][messageIdField];
    } catch(dbErr){
      console.warn(`[COC] ensureLeaderboardMessage DB read failed ${dbErr.message}`);
    }

    let channel = guild.channels.cache.get(channelId);
    if(!channel){
      try { channel = await guild.channels.fetch(channelId); } catch { /* ignore */ }
    }
    if(!channel) return null;

    // Try to discover by scanning recent messages
    try {
      const messages = await channel.messages.fetch({ limit: 50 });
      const match = messages.find(m => {
        if(m.author.id !== guild.client.user.id) return false;
        if(!m.embeds.length) return false;
        const embed = m.embeds[0];
        const footerText = embed.footer?.text || '';
        return footerText.includes(cleanTag);
      });
      if(match){
        existingId = match.id;
        await persistMessageId(guild.id, cleanTag, messageIdField, existingId);
        if(process.env.COC_DEBUG==='1') console.log(`[COC] Discovered existing ${type} leaderboard message guild=${guild.id} clan=${cleanTag} id=${existingId}`);
        return existingId;
      }
    } catch(scanErr){
      console.warn(`[COC] Failed discovery scan (${type}) guild=${guild.id} clan=${cleanTag}: ${scanErr.message}`);
    }

    // Create placeholder to stabilize message id before first real render
    try {
      const placeholderText = isWar
        ? `⚔️ War statistics for ${clanInfo?.name || cleanTag} will appear here once data is available.`
        : `📊 Donation leaderboard for ${clanInfo?.name || cleanTag} will appear soon.`;
      const placeholder = await channel.send(placeholderText);
      await persistMessageId(guild.id, cleanTag, messageIdField, placeholder.id);
      if(process.env.COC_DEBUG==='1') console.log(`[COC] Created placeholder ${type} leaderboard message guild=${guild.id} clan=${cleanTag} id=${placeholder.id}`);
      return placeholder.id;
    } catch(phErr){
      console.warn(`[COC] Failed to create placeholder ${type} leaderboard guild=${guild.id} clan=${cleanTag}: ${phErr.message}`);
    }
  } catch(err){
    console.warn(`[COC] ensureLeaderboardMessage error (${type}) guild=${guild.id} clan=${cleanTag}: ${err.message}`);
  }
  return null;
}

// Import COC service functions
const { 
  fetchClanInfo, 
  fetchClanWar, 
  announce, 
  cleanClanTag, 
  formatClanTag,
  getCOCStats,
  cocStats 
} = require('../services/clashofclans');

// Import war performance tracking
const WarPerformanceIntegration = require('../../utils/war/WarPerformanceIntegration');
const WarStateManager = require('../../utils/war/WarStateManager');

// Lazy singleton for LeaderboardEvents to avoid registering multiple listeners
let _leaderboardEventsInstance = null;
function getLeaderboardEventsInstance(client) {
  if (!_leaderboardEventsInstance) {
    try {
      const LeaderboardEvents = require('../handlers/LeaderboardEvents');
      _leaderboardEventsInstance = new LeaderboardEvents(client, store.sqlPool);
    } catch (err) {
      console.warn('[COC] Failed to initialize LeaderboardEvents singleton:', err.message);
    }
  }
  return _leaderboardEventsInstance;
}

// War performance integration instance
let _warPerformanceIntegration = null;
function getWarPerformanceIntegration() {
  if (!_warPerformanceIntegration) {
    try {
      const warStateManager = new WarStateManager(store.sqlPool);
      _warPerformanceIntegration = new WarPerformanceIntegration(warStateManager);
      // console.log('[COC] War performance integration initialized');
    } catch (err) {
      console.warn('[COC] Failed to initialize War Performance Integration:', err.message);
    }
  }
  return _warPerformanceIntegration;
}

function saveStateDebounced(){
	if(saveStateDebounced._t) clearTimeout(saveStateDebounced._t);
	saveStateDebounced._t = setTimeout(()=>{
		try { 
		  // Convert Map objects to plain objects for JSON serialization
		  const stateToSave = {
		    clans: {}
		  };
		  
		  for (const [key, clanState] of Object.entries(state.clans)) {
		    stateToSave.clans[key] = {
		      ...clanState,
		      knownDonationMilestones: clanState.knownDonationMilestones instanceof Map 
		        ? Object.fromEntries(clanState.knownDonationMilestones.entries())
		        : clanState.knownDonationMilestones || {}
		    };
		  }
		  
		  fs.writeFileSync(STATE_PATH, JSON.stringify(stateToSave, null, 2)); 
		} catch (error) {
		  console.error('[COC] Error saving state:', error);
		}
	}, 500);
}

function key(guildId, clanTag){ return guildId + ':' + clanTag; }

// Calculate time remaining for war
function getWarTimeRemaining(endTime) {
  if (!endTime) return 'Unknown';
  
  const end = new Date(endTime);
  const now = new Date();
  const diff = end - now;
  
  if (diff <= 0) return 'Ended';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Main polling function for a guild
async function pollGuild(guild) {
  let cfg;
  try { 
    cfg = await store.getGuildClashOfClansConfig(guild.id); 
  } catch { 
    return; 
  }
  
  if (!cfg.enabled) return;
  if (!Array.isArray(cfg.clans) || !cfg.clans.length) return;
  
  cocStats.totalPolls++;
  cocStats.lastPoll = new Date().toISOString();
  
  const debug = process.env.COC_DEBUG === '1';
  if (debug) console.log('[COC] poll guild', guild.id, 'clans', cfg.clans.length, 'tags:', cfg.clans);
  
  for (const clanTag of cfg.clans) {
    try {
      const cleanTag = cleanClanTag(clanTag);
      if (debug) console.log(`[COC] Processing clan ${clanTag} -> ${cleanTag}`);
      if (!cleanTag) continue;
      
      const clanInfo = await fetchClanInfo(cleanTag);
      if (!clanInfo) continue;
      
      const k = key(guild.id, cleanTag);
      if (!state.clans[k]) {
        if (debug) console.log(`[COC] Initializing new state for clan ${cleanTag}`);
        state.clans[k] = {
          lastMemberCount: 0,
          knownMembers: [],
          lastWarState: null,
          lastWarEndTime: null,
          knownDonationMilestones: new Map(),
          // Track last donation leaderboard post per clan (was lastLeaderboardPost)
          lastDonationLeaderboardPost: null,
          lastLeaderboardPost: null // backward compat load
        };
      }
      
      const clanState = state.clans[k];
      if (debug) console.log(`[COC] Clan ${cleanTag} state loaded:`, {
        hasLastDonationPost: !!clanState.lastDonationLeaderboardPost,
        lastDonationPost: clanState.lastDonationLeaderboardPost
      });
      
      // Ensure knownDonationMilestones is a Map (JSON loading converts it to object)
      if (!(clanState.knownDonationMilestones instanceof Map)) {
        const oldData = clanState.knownDonationMilestones || {};
        clanState.knownDonationMilestones = new Map(Object.entries(oldData));
      }
      const currentMembers = clanInfo.memberList || [];
      const currentMemberTags = currentMembers.map(m => m.tag);

      // ------------------------------------------------------------------
      // Ensure initial war leaderboard message exists (one per clan row)
      // Donation leaderboard gets created on first scheduled update; war
      // leaderboard previously only appeared once a war was active. This
      // block creates an initial (placeholder) war leaderboard message so
      // the channel has a persistent message whose ID can be updated later.
      // ------------------------------------------------------------------
      // Get per-clan channel configuration from database instead of using global config
      let effectiveWarLeaderboardChannelId = null;
      try {
        const [clanRows] = await store.sqlPool.execute(
          'SELECT war_leaderboard_channel_id, war_announce_channel_id FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
          [guild.id, cleanTag]
        );
        if (clanRows.length > 0) {
          // Use per-clan war_leaderboard_channel_id if set, otherwise fallback to per-clan war_announce_channel_id
          effectiveWarLeaderboardChannelId = clanRows[0].war_leaderboard_channel_id || clanRows[0].war_announce_channel_id || null;
        }
      } catch (channelLookupErr) {
        console.warn(`[COC] Error looking up per-clan channel config for ${cleanTag}:`, channelLookupErr.message);
        // Fallback to global config if database lookup fails
        effectiveWarLeaderboardChannelId = cfg.warLeaderboardChannelId || cfg.warAnnounceChannelId || null;
      }

      if (cfg.trackWarLeaderboard && effectiveWarLeaderboardChannelId) {
        try {
          const [rows] = await store.sqlPool.execute(
            'SELECT war_preparing_message_id, war_active_message_id FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
            [guild.id, cleanTag]
          );
          const existingMsgId = rows.length ? (rows[0].war_preparing_message_id || rows[0].war_active_message_id) : null;
          if (!existingMsgId) {
            // Check war state before creating initial leaderboard to avoid duplicate historical messages
            let shouldCreateInitialLeaderboard = true;
            try {
              const [stateRows] = await store.sqlPool.execute(
                'SELECT war_current_state, war_ended_message_id FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
                [guild.id, cleanTag]
              );
              if (stateRows.length > 0) {
                const currentState = stateRows[0].war_current_state;
                const endedMessageId = stateRows[0].war_ended_message_id;
                
                // Don't create initial leaderboard if war is ended or already finalized
                if (currentState === 'warEnded' || currentState === 'notInWar' || endedMessageId) {
                  console.log(`[COC] Skipping initial war leaderboard for ${cleanTag} - war state: ${currentState}, ended message exists: ${!!endedMessageId}`);
                  shouldCreateInitialLeaderboard = false;
                }
              }
            } catch (stateErr) {
              console.warn(`[COC] Error checking war state for initial leaderboard ${cleanTag}:`, stateErr.message);
            }
            
            // Declare posted variable before the conditional block
            let posted = false;
            
            if (shouldCreateInitialLeaderboard) {
              // Attempt to post real war leaderboard via unified system
              const leaderboardEvents = getLeaderboardEventsInstance(guild.client);
              if (leaderboardEvents) {
                try {
                  const result = await leaderboardEvents.postLeaderboard(
                    guild.id,
                    effectiveWarLeaderboardChannelId,
                    null,
                    'war',
                    cleanTag
                  );
                  posted = result && result.success;
                } catch (postErr) {
                  console.warn(`[COC] Initial war leaderboard generation failed for ${cleanTag}:`, postErr.message);
                }
              }
            } else {
              posted = true; // Skip the fallback placeholder creation too
            }
            if (!posted) {
              // Fallback placeholder so message id is stored for later updates
              try {
                const channel = guild.channels.cache.get(effectiveWarLeaderboardChannelId);
                if (channel) {
                  const placeholder = await channel.send(`⚔️ War statistics for ${clanInfo.name} will appear here once war data is available.`);
                  // Store in war_preparing_message_id as default for initial war leaderboard placeholders
                  await persistMessageId(guild.id, cleanTag, 'war_preparing_message_id', placeholder.id);
                }
              } catch (phErr) {
                console.warn(`[COC] Failed to create placeholder war leaderboard message for ${cleanTag}:`, phErr.message);
              }
            }
          }
        } catch (initErr) {
          console.warn('[COC] Error ensuring initial war leaderboard message:', initErr.message);
        }
      }
      else if (cfg.trackWarLeaderboard && !effectiveWarLeaderboardChannelId) {
        if (process.env.COC_DEBUG === '1') {
          console.warn(`[COC] War leaderboard enabled but no channel configured (guild=${guild.id}, clan=${cleanTag}).`);
        }
      }
      
      // Check for member changes if tracking is enabled
      if (cfg.trackMembers || cfg.trackMemberEvents) {
        // New members (joined)
        const newMembers = currentMembers.filter(m => !clanState.knownMembers.includes(m.tag));
        for (const member of newMembers) {
          if (clanState.knownMembers.length > 0) { // Don't announce on first poll
            await announce(guild, cfg, {
              clanName: clanInfo.name,
              clanTag: formatClanTag(cleanTag),
              playerName: member.name,
              memberCount: `${currentMembers.length}/50`
            }, 'member_join');
          }
        }
        
        // Left members
        const leftMembers = clanState.knownMembers.filter(tag => !currentMemberTags.includes(tag));
        for (const memberTag of leftMembers) {
          // We don't have the name anymore, so use tag
          await announce(guild, cfg, {
            clanName: clanInfo.name,
            clanTag: formatClanTag(cleanTag),
            playerName: memberTag,
            memberCount: `${currentMembers.length}/50`
          }, 'member_leave');
        }
        
        // Update known members
        clanState.knownMembers = currentMemberTags;
      }
      
      // Check for donation milestones if tracking is enabled
      if (cfg.trackDonations || cfg.trackDonationEvents) {
        const threshold = cfg.donationThreshold || 100;
        
        for (const member of currentMembers) {
          const donations = member.donations || 0;
          const lastKnown = clanState.knownDonationMilestones.get(member.tag) || 0;
          
          // Check if member reached a new milestone
          const currentMilestone = Math.floor(donations / threshold);
          const lastMilestone = Math.floor(lastKnown / threshold);
          
          if (currentMilestone > lastMilestone && currentMilestone > 0) {
            await announce(guild, cfg, {
              clanName: clanInfo.name,
              clanTag: formatClanTag(cleanTag),
              playerName: member.name,
              donationCount: currentMilestone * threshold,
              memberCount: `${currentMembers.length}/50`
            }, 'donation_milestone');
          }
          
          clanState.knownDonationMilestones.set(member.tag, donations);
        }
      }
      
      // Check for war events if tracking is enabled
      if (cfg.trackWars || cfg.trackWarEvents) {
        // console.log(`[COC] WATCHER: Checking war events for clan ${cleanTag}, trackWars: ${cfg.trackWars}, trackWarEvents: ${cfg.trackWarEvents}`);
        const warInfo = await fetchClanWar(cleanTag);
        console.log(`[COC] WATCHER: War info retrieved for clan ${cleanTag}, state: ${warInfo?.state || 'no war'}`);
        
        // Add war performance tracking
        try {
          const warPerformanceIntegration = getWarPerformanceIntegration();
          if (warPerformanceIntegration && warInfo) {
            // Process war with performance tracking (stores attack data automatically)
            await warPerformanceIntegration.processWarPerformance(guild.id, warInfo);
          }
        } catch (performanceError) {
          console.warn('[COC] War performance tracking failed (non-critical):', performanceError.message);
        }
        
        // Use WarStateManager for proper state transitions
        try {
          const warStateManager = new WarStateManager(store.sqlPool);
          const currentStateData = await warStateManager.getCurrentWarState(guild.id, cleanTag);
          const transitionAction = warStateManager.getTransitionAction(currentStateData, warInfo);
          
          console.log(`[COC] Watcher transition check for clan ${cleanTag}:`, JSON.stringify(transitionAction, null, 2));
          
          if (transitionAction.action === 'transition') {
            console.log(`[COC] WATCHER: War state transition detected: ${transitionAction.from} → ${transitionAction.to} for clan ${cleanTag}`);
            
            // Handle war declared (transition to preparation)
            if (transitionAction.to === warStateManager.STATES.PREPARING) {
              console.log(`[COC] WATCHER: Processing war declared transition for clan ${cleanTag}`);
              // Calculate preparation time remaining
              let preparationTimeRemaining = 'Unknown';
              if (warInfo.startTime) {
                try {
                  const warStartTime = new Date(warInfo.startTime);
                  const now = new Date();
                  const timeDiff = warStartTime - now;
                  
                  if (timeDiff > 0) {
                    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                    preparationTimeRemaining = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                  }
                } catch (timeError) {
                  console.warn('[COC] Error calculating preparation time:', timeError.message);
                }
              }

              // Fetch enemy clan information for win streak and win rate
              let enemyWinStreak, enemyWinRate;
              try {
                const enemyClanTag = cleanClanTag(warInfo.opponent.tag);
                if (enemyClanTag) {
                  const enemyClanInfo = await fetchClanInfo(enemyClanTag);
                  if (enemyClanInfo) {
                    enemyWinStreak = enemyClanInfo.warWinStreak;
                    // Calculate win rate from war statistics
                    const warWins = enemyClanInfo.warWins || 0;
                    const warLosses = enemyClanInfo.warLosses || 0;
                    const warTies = enemyClanInfo.warTies || 0;
                    const totalWars = warWins + warLosses + warTies;
                    if (totalWars > 0) {
                      enemyWinRate = ((warWins / totalWars) * 100).toFixed(1);
                    }
                  }
                }
              } catch (enemyError) {
                console.warn('[COC] Error fetching enemy clan info:', enemyError.message);
              }

              // FIRST: Send war declared message (before updating database state)
              console.log(`[COC] About to send war declared message for clan ${cleanTag}`);
              await announce(guild, cfg, {
                clanName: clanInfo.name,
                clanTag: formatClanTag(cleanTag),
                warOpponent: warInfo.opponent.name,
                warOpponentTag: formatClanTag(warInfo.opponent.tag),
                warOpponentLevel: warInfo.opponent.clanLevel || 'Unknown',
                warOpponentMembers: warInfo.opponent.members?.length || warInfo.teamSize || 'Unknown',
                warOpponentDescription: warInfo.opponent.description || '',
                warOpponentWinStreak: enemyWinStreak,
                warOpponentWinRate: enemyWinRate,
                warSize: warInfo.teamSize || 'Unknown',
                preparationTimeRemaining: preparationTimeRemaining,
                memberCount: `${currentMembers.length}/50`
              }, 'war_declared');
              console.log(`[COC] War declared message sent for clan ${cleanTag}`);

              // Add a small delay to ensure war declared message is sent before preparation leaderboard
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

              // SECOND: Update the database state (after sending declared message)
              await warStateManager.updateWarState(guild.id, cleanTag, transitionAction.to, warInfo);
              console.log(`[COC] Updated war state to '${transitionAction.to}' for clan ${cleanTag} in guild ${guild.id}`);

              // Update in-memory state immediately after database update
              clanState.lastWarState = warInfo.state;
              clanState.lastWarEndTime = warInfo.endTime;

              // THIRD: Create war preparation leaderboard message (after state update)
              // Get per-clan channel ID for this specific clan
              let clanSpecificChannelId = null;
              try {
                const [clanChannelRows] = await store.sqlPool.execute(
                  'SELECT war_leaderboard_channel_id, war_announce_channel_id FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
                  [guild.id, cleanTag]
                );
                if (clanChannelRows.length > 0) {
                  clanSpecificChannelId = clanChannelRows[0].war_leaderboard_channel_id || clanChannelRows[0].war_announce_channel_id || null;
                }
              } catch (channelErr) {
                console.warn(`[COC] Error getting clan-specific channel for ${cleanTag}:`, channelErr.message);
                clanSpecificChannelId = cfg.warLeaderboardChannelId || cfg.warAnnounceChannelId;
              }
              
              if (cfg.trackWarLeaderboard && clanSpecificChannelId) {
                console.log(`[COC] About to create war preparation leaderboard for clan ${cleanTag} in channel ${clanSpecificChannelId}`);
                try {
                  const leaderboardEvents = getLeaderboardEventsInstance(guild.client);
                  if (leaderboardEvents) {
                    const effectiveChannelId = clanSpecificChannelId;
                    
                    // Create a NEW war preparation leaderboard message using the new method
                    const result = await leaderboardEvents.createWarLeaderboardAfterStateUpdate(
                      guild.id,
                      effectiveChannelId,
                      cleanTag
                    );
                    
                    if (result && result.success) {
                      // console.log(`[COC] Created war preparation leaderboard message for clan ${cleanTag} in guild ${guild.id}, messageId: ${result.messageId}`);
                    } else {
                      console.error(`[COC] Failed to create war preparation leaderboard message for clan ${cleanTag}:`, result?.error);
                    }
                  } else {
                    console.warn(`[COC] LeaderboardEvents instance not available for clan ${cleanTag}`);
                  }
                } catch (preparationLeaderboardError) {
                  console.error(`[COC] Error creating war preparation leaderboard message:`, preparationLeaderboardError.message);
                }
              } else {
                console.log(`[COC] War leaderboard not enabled or no channel configured for clan ${cleanTag}`);
              }
            }
            
            // Handle war started (transition to active)
            if (transitionAction.to === warStateManager.STATES.ACTIVE) {
              // Send war start message first
              await announce(guild, cfg, {
                clanName: clanInfo.name,
                clanTag: formatClanTag(cleanTag),
                warOpponent: warInfo.opponent.name,
                warEndTime: getWarTimeRemaining(warInfo.endTime),
                memberCount: `${currentMembers.length}/50`
              }, 'war_start');

              // Handle leaderboard message transitions BEFORE updating database state
              // This ensures the transition detection works correctly
              if (cfg.trackWarLeaderboard && effectiveWarLeaderboardChannelId) {
                try {
                  const leaderboardEvents = getLeaderboardEventsInstance(guild.client);
                  if (leaderboardEvents) {
                    // Use the proper transition-aware method that handles delete_preparation_and_create_active
                    const result = await leaderboardEvents.postWarLeaderboardWithStateManagement(
                      guild.id,
                      effectiveWarLeaderboardChannelId,
                      cleanTag,
                      false // skipTransitions = false to handle the transition properly
                    );
                    
                    if (result && result.success) {
                      // console.log(`[COC] Handled war leaderboard transition for new war (clan ${cleanTag}, guild ${guild.id}), action: ${result.action}`);
                      // Reset the war refresh timer so it doesn't immediately update again
                      clanState.lastWarLeaderboardRefresh = Date.now();
                    } else {
                      console.error(`[COC] Failed to handle war leaderboard transition for clan ${cleanTag}:`, result?.error);
                    }
                  }
                } catch (newWarError) {
                  console.error(`[COC] Error handling war leaderboard transition for new war:`, newWarError.message);
                }
              } else {
                // If no leaderboard tracking, still need to update the war state
                await warStateManager.updateWarState(guild.id, cleanTag, transitionAction.to, warInfo);
                // console.log(`[COC] Updated war state to '${transitionAction.to}' for clan ${cleanTag} in guild ${guild.id} (no leaderboard)`);
              }

              // Update in-memory state after database update
              clanState.lastWarState = warInfo.state;
              clanState.lastWarEndTime = warInfo.endTime;
            }
            
            // Handle war ended (transition to ended)
            if (transitionAction.to === warStateManager.STATES.ENDED) {
              let warResult = 'tie';
              let warStars = `${warInfo.clan.stars}/${warInfo.teamSize}`;
              let warDestruction = `${warInfo.clan.destructionPercentage?.toFixed(1) || 0}%`;
              
              if (warInfo.clan.stars > warInfo.opponent.stars) {
                warResult = 'win';
              } else if (warInfo.clan.stars < warInfo.opponent.stars) {
                warResult = 'lose';
              } else {
                // Same stars, check destruction percentage
                const ourDestruction = warInfo.clan.destructionPercentage || 0;
                const theirDestruction = warInfo.opponent.destructionPercentage || 0;
                if (ourDestruction > theirDestruction) {
                  warResult = 'win';
                } else if (ourDestruction < theirDestruction) {
                  warResult = 'lose';
                }
              }
              
              // Send war end message first
              await announce(guild, cfg, {
                clanName: clanInfo.name,
                clanTag: formatClanTag(cleanTag),
                warOpponent: warInfo.opponent.name,
                warResult,
                warStars,
                warDestructionPercentage: warDestruction,
                memberCount: `${currentMembers.length}/50`
              }, 'war_end');

              // Handle leaderboard message transitions BEFORE updating database state
              // This ensures the transition detection works correctly
              if (cfg.trackWarLeaderboard && effectiveWarLeaderboardChannelId) {
                try {
                  const leaderboardEvents = getLeaderboardEventsInstance(guild.client);
                  if (leaderboardEvents) {
                    // Use the proper transition-aware method that handles delete_and_create_historical
                    const result = await leaderboardEvents.postWarLeaderboardWithStateManagement(
                      guild.id,
                      effectiveWarLeaderboardChannelId,
                      cleanTag,
                      false // skipTransitions = false to handle the transition properly
                    );
                    
                    if (result && result.success) {
                      // console.log(`[COC] Handled war leaderboard transition for ended war (clan ${cleanTag}, guild ${guild.id}), action: ${result.action}`);
                    } else {
                      console.error(`[COC] Failed to handle war leaderboard transition for ended war ${cleanTag}:`, result?.error);
                    }
                  }
                } catch (endedWarError) {
                  console.error(`[COC] Error handling war leaderboard transition for ended war:`, endedWarError.message);
                }
              } else {
                // If no leaderboard tracking, still need to update the war state
                await warStateManager.updateWarState(guild.id, cleanTag, transitionAction.to, warInfo);
                // console.log(`[COC] Updated war state to '${transitionAction.to}' for clan ${cleanTag} in guild ${guild.id} (no leaderboard)`);
              }

              // Update in-memory state after database update
              clanState.lastWarState = warInfo.state;
              clanState.lastWarEndTime = warInfo.endTime;
            }
          } else if (transitionAction.action === 'none') {
            // No state transition, but check if we should still call leaderboard events
            console.log(`[COC] WATCHER: No state transition for clan ${cleanTag}, checking current database state`);
            
            // Get current database war state to avoid spam when already notInWar
            let currentDbState = null;
            try {
              const [stateRows] = await store.sqlPool.execute(
                'SELECT war_current_state FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
                [guild.id, cleanTag]
              );
              if (stateRows.length > 0) {
                currentDbState = stateRows[0].war_current_state;
              }
            } catch (stateErr) {
              console.warn(`[COC] Error getting current war state for ${cleanTag}:`, stateErr.message);
            }
            
            // Skip LeaderboardEvents if war is already in notInWar state to prevent spam
            // BUT DO NOT SKIP donation leaderboard processing - only skip war leaderboard
            if (currentDbState !== 'notInWar') {
              console.log(`[COC] WATCHER: Database state is ${currentDbState}, proceeding with leaderboard events`);
              const leaderboardEvents = getLeaderboardEventsInstance(guild.client);
              
              // Get per-clan channel ID for this specific clan
              let noneClanChannelId = null;
              try {
                const [noneClanChannelRows] = await store.sqlPool.execute(
                  'SELECT war_leaderboard_channel_id, war_announce_channel_id FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
                  [guild.id, cleanTag]
                );
                if (noneClanChannelRows.length > 0) {
                  noneClanChannelId = noneClanChannelRows[0].war_leaderboard_channel_id || noneClanChannelRows[0].war_announce_channel_id || null;
                }
              } catch (noneChannelErr) {
                console.warn(`[COC] Error getting clan-specific channel for none action ${cleanTag}:`, noneChannelErr.message);
                noneClanChannelId = cfg.warLeaderboardChannelId || cfg.warAnnounceChannelId;
              }
              
              if (leaderboardEvents && noneClanChannelId) {
                try {
                  // console.log(`[COC] WATCHER: Calling LeaderboardEvents for 'none' action, current state: ${warInfo.state}`);
                  
                  // Use per-clan channel ID
                  const channelId = noneClanChannelId;
                  
                  const result = await leaderboardEvents.postWarLeaderboardWithStateManagement(
                    guild.id, 
                    channelId,   // Correct channel ID from config
                    cleanTag,    // Clan tag as the third parameter
                    true         // skipTransitions = true for 'none' action from watcher
                  );
                  
                  if (result && result.success) {
                    // console.log(`[COC] WATCHER: LeaderboardEvents handled successfully for clan ${cleanTag}`);
                  } else {
                    // console.log(`[COC] WATCHER: LeaderboardEvents returned no action needed for clan ${cleanTag}`);
                  }
                } catch (leaderboardError) {
                  console.error(`[COC] WATCHER: Error calling LeaderboardEvents for clan ${cleanTag}:`, leaderboardError.message);
                }
              } else {
                console.log(`[COC] WATCHER: LeaderboardEvents not available or war channels not configured for clan ${cleanTag}`);
              }
            } else {
              console.log(`[COC] WATCHER: Skipping war LeaderboardEvents for clan ${cleanTag} - war already finalized (state: ${currentDbState})`);
            }
          }
          
          // Update the in-memory state to match the database
          if (warInfo) {
            clanState.lastWarState = warInfo.state;
            clanState.lastWarEndTime = warInfo.endTime;

            // Auto-refresh war statistics during active wars
            // Get per-clan channel ID for this specific clan
            let refreshClanChannelId = null;
            try {
              const [refreshClanChannelRows] = await store.sqlPool.execute(
                'SELECT war_leaderboard_channel_id, war_announce_channel_id FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
                [guild.id, cleanTag]
              );
              if (refreshClanChannelRows.length > 0) {
                refreshClanChannelId = refreshClanChannelRows[0].war_leaderboard_channel_id || refreshClanChannelRows[0].war_announce_channel_id || null;
              }
            } catch (refreshChannelErr) {
              console.warn(`[COC] Error getting clan-specific channel for refresh ${cleanTag}:`, refreshChannelErr.message);
              refreshClanChannelId = cfg.warLeaderboardChannelId || cfg.warAnnounceChannelId;
            }
            
            // Only refresh war leaderboard if war is active (not notInWar)
            if (warInfo.state === 'inWar' && refreshClanChannelId) {
              await autoRefreshWarLeaderboard(guild, cfg, cleanTag, warInfo, clanState);
            } else if (warInfo.state === 'notInWar' && process.env.COC_DEBUG === '1') {
              console.log(`[COC] Skipping war leaderboard refresh - war not active (notInWar) for clan ${cleanTag}`);
            }
          } else {
            // No war info available, reset war state if currently in war
            if (clanState.lastWarState === 'inWar' || clanState.lastWarState === 'preparation') {
              await warStateManager.updateWarState(guild.id, cleanTag, 'notInWar', null);
              console.log(`[COC] Updated war state to 'notInWar' for clan ${cleanTag} in guild ${guild.id}`);
              clanState.lastWarState = null;
            }
          }
        } catch (stateError) {
          console.error('[COC] Error managing war state:', stateError.message);
          // Fallback to old logic if WarStateManager fails
          if (warInfo) {
            const warState = warInfo.state;
            const warEndTime = warInfo.endTime;
            
            // Update the in-memory state
            clanState.lastWarState = warState;
            clanState.lastWarEndTime = warEndTime;
          }
        }
      }
      
      clanState.lastMemberCount = currentMembers.length;

      // SIMPLIFIED: Use global config directly like the old working code
      // The per-clan config logic was causing issues - revert to simple global config
      const trackDonationLeaderboard = cfg.trackDonationLeaderboard;
      const donationLeaderboardChannelId = cfg.donationLeaderboardChannelId;
      const donationLeaderboardSchedule = cfg.donationLeaderboardSchedule;
      
      if (process.env.COC_DEBUG === '1') {
        console.log(`[COC] Clan ${cleanTag} donation leaderboard config:`, {
          enabled: trackDonationLeaderboard,
          channel: donationLeaderboardChannelId,
          schedule: donationLeaderboardSchedule,
          fromGlobal: true
        });
      }

      // Ensure donation leaderboard message id exists early (even before schedule triggers) to prevent duplicate messages
      if (trackDonationLeaderboard && donationLeaderboardChannelId) {
        await ensureLeaderboardMessage(guild, cfg, 'donations', cleanTag, clanInfo);
      }

      // Per-clan donation leaderboard scheduling (replaces single primary-only logic)
      if (trackDonationLeaderboard && donationLeaderboardSchedule && donationLeaderboardChannelId) {
        const now = new Date();
        // Backward compatibility: migrate old field name the first time
        if (!clanState.lastDonationLeaderboardPost && clanState.lastLeaderboardPost) {
          clanState.lastDonationLeaderboardPost = clanState.lastLeaderboardPost;
        }
        const lastPost = clanState.lastDonationLeaderboardPost ? new Date(clanState.lastDonationLeaderboardPost) : null;
        
        // Debug logging to see what's happening
        if (process.env.COC_DEBUG === '1') {
          console.log(`[COC] Checking donation leaderboard schedule for clan ${cleanTag}:`, {
            schedule: donationLeaderboardSchedule,
            lastPost: lastPost?.toISOString() || 'never',
            timeSinceLastPost: lastPost ? `${Math.floor((now - lastPost) / 1000 / 60)} minutes` : 'N/A',
            channelId: donationLeaderboardChannelId
          });
        }
        
        let shouldUpdate = false;
        switch (donationLeaderboardSchedule) {
          case 'hourly':
            shouldUpdate = !lastPost || (now - lastPost) >= 60 * 60 * 1000; 
            if (process.env.COC_DEBUG === '1' && lastPost) {
              console.log(`[COC] Hourly check: time diff = ${(now - lastPost) / 1000 / 60} minutes, threshold = 60 minutes`);
            }
            break;
          case 'daily':
            shouldUpdate = !lastPost || (now - lastPost) >= 24 * 60 * 60 * 1000; 
            if (process.env.COC_DEBUG === '1' && lastPost) {
              console.log(`[COC] Daily check: time diff = ${(now - lastPost) / 1000 / 60 / 60} hours, threshold = 24 hours`);
            }
            break;
          case 'weekly':
            shouldUpdate = !lastPost || (now - lastPost) >= 7 * 24 * 60 * 60 * 1000; 
            if (process.env.COC_DEBUG === '1' && lastPost) {
              console.log(`[COC] Weekly check: time diff = ${(now - lastPost) / 1000 / 60 / 60 / 24} days, threshold = 7 days`);
            }
            break;
          case 'monthly':
            shouldUpdate = !lastPost || now.getMonth() !== lastPost.getMonth() || now.getFullYear() !== lastPost.getFullYear(); 
            if (process.env.COC_DEBUG === '1' && lastPost) {
              console.log(`[COC] Monthly check: current month = ${now.getMonth()}, last month = ${lastPost.getMonth()}`);
            }
            break;
        }
        
        if (process.env.COC_DEBUG === '1') {
          console.log(`[COC] Donation leaderboard update decision for clan ${cleanTag}: shouldUpdate=${shouldUpdate}, schedule=${donationLeaderboardSchedule}, lastPost=${lastPost?.toISOString() || 'never'}`);
        }
        // Force update if database row lacks donation_message_id even if schedule not yet due
        if (!shouldUpdate) {
          try {
            const [rowCheck] = await store.sqlPool.execute(
              'SELECT donation_message_id FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
              [guild.id, cleanTag]
            );
            if (rowCheck.length && !rowCheck[0].donation_message_id) {
              if (process.env.COC_DEBUG === '1') {
                console.log(`[COC] Forcing donation leaderboard update (missing message id) guild=${guild.id} clan=${cleanTag}`);
              }
              shouldUpdate = true;
            }
          } catch (forceErr) {
            console.warn(`[COC] Could not verify donation_message_id for force-update check (guild=${guild.id} clan=${cleanTag}):`, forceErr.message);
          }
        }
        if (shouldUpdate) {
          try {
            // Fetch existing per-row donation message id
            let existingMessageId = null;
            try {
              const [rows] = await store.sqlPool.execute(
                'SELECT donation_message_id FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
                [guild.id, cleanTag]
              );
              if (rows.length && rows[0].donation_message_id) {
                existingMessageId = rows[0].donation_message_id;
              }
            } catch (idErr) {
              console.warn(`[COC] Failed to read donation message id (guild=${guild.id} clan=${cleanTag}):`, idErr.message);
            }
            // Attempt discovery ONLY if not stored and earlier ensureLeaderboardMessage did not already do it.
            // Tight filter: embed footer must contain the exact clan tag to avoid sharing one message across clans.
            if (!existingMessageId) {
              try {
                const channel = guild.channels.cache.get(donationLeaderboardChannelId);
                if (channel) {
                  const messages = await channel.messages.fetch({ limit: 50 });
                  const existingMessage = messages.find(msg => {
                    if (msg.author.id !== guild.client.user.id) return false;
                    if (!msg.embeds.length) return false;
                    const embed = msg.embeds[0];
                    const footerText = embed.footer?.text || '';
                    // require exact tag token boundary to reduce false positives
                    return footerText.includes(cleanTag);
                  });
                  if (existingMessage) {
                    existingMessageId = existingMessage.id;
                    try {
                      await persistMessageId(guild.id, cleanTag, 'donation_message_id', existingMessageId);
                      if (process.env.COC_DEBUG==='1') console.log(`[COC] Clan-specific donation message discovered guild=${guild.id} clan=${cleanTag} id=${existingMessageId}`);
                    } catch (upErr) {
                      console.warn(`[COC] Could not persist discovered donation message id (guild=${guild.id} clan=${cleanTag}):`, upErr.message);
                    }
                  }
                }
              } catch (discoverErr) {
                console.warn(`[COC] Discovery of donation message failed (guild=${guild.id} clan=${cleanTag}):`, discoverErr.message);
              }
            }
            const leaderboardEvents = getLeaderboardEventsInstance(guild.client);
            if (!leaderboardEvents) {
              console.warn('[COC] LeaderboardEvents unavailable; skipping donation leaderboard post');
            } else {
              const result = await leaderboardEvents.postLeaderboard(
                guild.id,
                donationLeaderboardChannelId,
                existingMessageId,
                'donations',
                cleanTag // pass clanTag to persist per-row id
              );
              if (result && result.success) {
                clanState.lastDonationLeaderboardPost = now.toISOString();
                // Force immediate state save (synchronous) to ensure this clan's timestamp is persisted
                // before processing the next clan, preventing debounce timer resets from losing updates
                try {
                  const stateToSave = {
                    clans: {}
                  };
                  
                  for (const [stateKey, stateClanState] of Object.entries(state.clans)) {
                    stateToSave.clans[stateKey] = {
                      ...stateClanState,
                      knownDonationMilestones: stateClanState.knownDonationMilestones instanceof Map 
                        ? Object.fromEntries(stateClanState.knownDonationMilestones.entries())
                        : stateClanState.knownDonationMilestones || {}
                    };
                  }
                  
                  fs.writeFileSync(STATE_PATH, JSON.stringify(stateToSave, null, 2));
                  if (process.env.COC_DEBUG === '1') {
                    console.log(`[COC] State immediately saved after donation leaderboard update for clan ${cleanTag}`);
                  }
                } catch (saveErr) {
                  console.error(`[COC] Failed to immediately save state after donation update for clan ${cleanTag}:`, saveErr.message);
                }
                
                if (process.env.COC_DEBUG === '1') {
                  console.log(`[COC] Donation leaderboard updated successfully guild=${guild.id} clan=${cleanTag} msgId=${existingMessageId || 'new'} nextUpdate=${new Date(now.getTime() + (donationLeaderboardSchedule === 'hourly' ? 60*60*1000 : 24*60*60*1000)).toISOString()}`);
                }
              } else {
                console.error(`[COC] Donation leaderboard update failed (guild=${guild.id} clan=${cleanTag}):`, result?.error || 'Unknown error');
              }
            }
          } catch (donErr) {
            console.error(`[COC] Error updating donation leaderboard (guild=${guild.id} clan=${cleanTag}):`, donErr.message, donErr.stack);
          }
        }
      } else if (trackDonationLeaderboard) {
        // Log why donation leaderboard is not being updated
        if (process.env.COC_DEBUG === '1') {
          console.log(`[COC] Donation leaderboard skipped for clan ${cleanTag}: trackEnabled=${trackDonationLeaderboard}, schedule=${donationLeaderboardSchedule}, channel=${donationLeaderboardChannelId}`);
        }
      }
      
    } catch (error) {
      cocStats.totalErrors++;
      console.error(`[COC] Error polling clan ${clanTag}:`, error.message);
    }
  }
  
  saveStateDebounced();
}

// Start the COC watcher service
function startCOCWatcher(client) {
  const COC_API_TOKEN = process.env.COC_API_TOKEN;
  if (!COC_API_TOKEN) {
    console.warn('COC watcher disabled: No COC_API_TOKEN found');
    return;
  }
  
  console.log('COC watcher starting...');
  
  async function tick() {
    try {
      for (const guild of client.guilds.cache.values()) {
        await pollGuild(guild);
      }
    } catch (error) {
      cocStats.totalErrors++;
      console.error('[COC] Polling error:', error.message);
    }
    
    // Dynamic interval based on guild configs
    let minInterval = parseInt(process.env.COC_POLLING_INTERVAL || '3600', 10); // Default 1 hour
    
    try {
      for (const guild of client.guilds.cache.values()) {
        const cfg = await store.getGuildClashOfClansConfig(guild.id);
        if (cfg.enabled && cfg.intervalSec && cfg.intervalSec < minInterval) {
          minInterval = cfg.intervalSec;
        }
      }
    } catch {}
    
    setTimeout(tick, Math.max(300, minInterval) * 1000); // Minimum 5 minutes
  }
  
  // Initial delay
  setTimeout(tick, 10000); // 10 seconds
  console.log('COC watcher started');
}

/**
 * Auto-refresh war leaderboard during active wars
 * Refreshes every 5 minutes when war is active or when new attacks are detected
 */
async function autoRefreshWarLeaderboard(guild, cfg, clanTag, warInfo, clanState) {
  try {
    // Skip if war is not active (notInWar state) to prevent spam
    if (!warInfo || warInfo.state === 'notInWar') {
      if (process.env.COC_DEBUG === '1') {
        console.log(`[COC] Skipping war leaderboard refresh - war not active (state: ${warInfo?.state || 'no war data'}) for clan ${clanTag}`);
      }
      return;
    }

    // Get per-clan channel configuration from database
    let effectiveChannelId = null;
    try {
      const [clanChannelRows] = await store.sqlPool.execute(
        'SELECT war_leaderboard_channel_id, war_announce_channel_id FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
        [guild.id, clanTag]
      );
      if (clanChannelRows.length > 0) {
        effectiveChannelId = clanChannelRows[0].war_leaderboard_channel_id || clanChannelRows[0].war_announce_channel_id || null;
      }
    } catch (channelErr) {
      console.warn(`[COC] Error getting clan-specific channel for refresh ${clanTag}:`, channelErr.message);
      // Fallback to global config if database lookup fails
      effectiveChannelId = cfg.warLeaderboardChannelId || cfg.warAnnounceChannelId || null;
    }

    // Check if war leaderboard is enabled and has a channel
    if (!effectiveChannelId) {
      if (process.env.COC_DEBUG === '1') {
        console.warn(`[COC] Skipping war leaderboard refresh (no channel) guild=${guild.id} clan=${clanTag}`);
      }
      return; // No channel configured
    }

    if (!clanState) return;

    const now = Date.now();
    const lastWarRefresh = clanState.lastWarLeaderboardRefresh || 0;
    const refreshInterval = 5 * 60 * 1000; // 5 minutes

    // Calculate current attack details for tracking changes
    const currentAttackData = warInfo.clan.members.map(member => ({
      tag: member.tag,
      attacks: (member.attacks || []).map(attack => ({
        stars: attack.stars,
        destruction: attack.destructionPercentage,
        order: attack.order
      }))
    }));

    // Check for attack changes (new attacks or star/destruction changes)
    const lastAttackData = clanState.lastWarAttackData || [];
    let attacksChanged = false;

    // Compare current attacks with last known attacks
    if (lastAttackData.length !== currentAttackData.length) {
      attacksChanged = true;
    } else {
      for (let i = 0; i < currentAttackData.length; i++) {
        const current = currentAttackData[i];
        const last = lastAttackData.find(l => l.tag === current.tag);
        
        if (!last || last.attacks.length !== current.attacks.length) {
          attacksChanged = true;
          break;
        }
        
        // Check if any attack details changed
        for (let j = 0; j < current.attacks.length; j++) {
          const currentAttack = current.attacks[j];
          const lastAttack = last.attacks[j];
          
          if (!lastAttack || 
              currentAttack.stars !== lastAttack.stars ||
              currentAttack.destruction !== lastAttack.destruction) {
            attacksChanged = true;
            break;
          }
        }
        
        if (attacksChanged) break;
      }
    }

    // Refresh if attacks changed or enough time has passed
    if (attacksChanged || now - lastWarRefresh >= refreshInterval) {
      
      // Use the unified LeaderboardEvents system for consistency
      try {
        const LeaderboardEvents = require('../handlers/LeaderboardEvents');
        const leaderboardEvents = new LeaderboardEvents(guild.client, store.sqlPool);
        
        // Get existing war message ID for this specific clan based on war state
        let existingMessageId = null;
        const messageIdColumn = warInfo.state === 'preparation' ? 'war_preparing_message_id' : 'war_active_message_id';
        try {
          const [messageRows] = await store.sqlPool.execute(
            `SELECT ${messageIdColumn} FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_tag = ?`,
            [guild.id, clanTag]
          );
          if (messageRows.length > 0 && messageRows[0][messageIdColumn]) {
            existingMessageId = messageRows[0][messageIdColumn];
          }
        } catch (dbError) {
          console.warn(`[COC] Failed to get clan-specific war message ID for ${clanTag}:`, dbError.message);
        }
        
        // If no message ID stored, try to find existing war leaderboard message in channel
        if (!existingMessageId && effectiveChannelId) {
          try {
            const channel = guild.channels.cache.get(effectiveChannelId);
            if (channel) {
              // Search recent messages for existing war leaderboard (last 50 messages)
              const messages = await channel.messages.fetch({ limit: 50 });
              const existingMessage = messages.find(msg => 
                msg.author.id === guild.client.user.id && 
                msg.embeds.length > 0 && 
                msg.embeds[0].title?.includes('War Statistics') &&
                msg.components.length > 0 &&
                msg.components[0].components?.some(btn => btn.customId?.startsWith('leaderboard_'))
              );
              
              if (existingMessage) {
                existingMessageId = existingMessage.id;
                
                // Update database with found message ID for this specific clan
                try {
                  await store.sqlPool.execute(
                    `UPDATE guild_clashofclans_watch SET ${messageIdColumn} = ? WHERE guild_id = ? AND clan_tag = ?`,
                    [existingMessageId, guild.id, clanTag]
                  );
                } catch (updateError) {
                  console.warn(`[COC] Failed to update war message ID for guild ${guild.id}, clan ${clanTag}:`, updateError.message);
                }
              }
            }
          } catch (findError) {
            console.warn(`[COC] Could not search for existing war message in guild ${guild.id}:`, findError.message);
          }
        }
        
        // Post/update war leaderboard using unified system
        const result = await leaderboardEvents.postLeaderboard(
          guild.id, 
          effectiveChannelId, 
          existingMessageId,
          'war',
          clanTag,  // Pass clan tag for proper database updates
          true      // skipTransitions = true for watcher calls
        );
        
        if (result && result.success) {
        } else {
          console.error(`[COC] Failed to update war leaderboard for guild ${guild.id}, clan ${clanTag}:`, result?.error);
        }
      } catch (error) {
        console.error(`[COC] Error auto-refreshing war leaderboard for ${guild.name} (clan ${clanTag}):`, error.message);
      }
      
      // Update last refresh time and attack data
      clanState.lastWarLeaderboardRefresh = now;
      clanState.lastWarAttackData = currentAttackData;
      saveStateDebounced();
    }
    
  } catch (error) {
    console.error('[COC] Error in auto-refresh war leaderboard:', error);
  }
}

// Get COC stats for debugging
function getWatcherStats() {
  return {
    stateKeys: Object.keys(state.clans).length
  };
}

module.exports = {
  startCOCWatcher,
  getCOCStats: () => ({ ...getCOCStats(), ...getWatcherStats() }),
  cocStats
};
