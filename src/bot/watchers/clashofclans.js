// Clash of Clans watcher: polls configured clans per guild and announces wars, member changes, and donations.
// Stores seen states in clashofclans-state.json for persistence.
const fs = require('fs');
const path = require('path');
const store = require('../../config/store');

const STATE_PATH = path.join(__dirname, 'clashofclans-state.json');
let state = { clans: {} };
try { state = JSON.parse(fs.readFileSync(STATE_PATH,'utf8')); } catch { /* ignore */ }

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
  if (debug) console.log('[COC] poll guild', guild.id, 'clans', cfg.clans.length);
  
  for (const clanTag of cfg.clans) {
    try {
      const cleanTag = cleanClanTag(clanTag);
      if (!cleanTag) continue;
      
      const clanInfo = await fetchClanInfo(cleanTag);
      if (!clanInfo) continue;
      
      const k = key(guild.id, cleanTag);
      if (!state.clans[k]) {
        state.clans[k] = {
          lastMemberCount: 0,
          knownMembers: [],
          lastWarState: null,
          lastWarEndTime: null,
          knownDonationMilestones: new Map(),
          lastLeaderboardPost: null
        };
      }
      
      const clanState = state.clans[k];
      
      // Ensure knownDonationMilestones is a Map (JSON loading converts it to object)
      if (!(clanState.knownDonationMilestones instanceof Map)) {
        const oldData = clanState.knownDonationMilestones || {};
        clanState.knownDonationMilestones = new Map(Object.entries(oldData));
      }
      const currentMembers = clanInfo.memberList || [];
      const currentMemberTags = currentMembers.map(m => m.tag);
      
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
        const warInfo = await fetchClanWar(cleanTag);
        
        if (warInfo) {
          const warState = warInfo.state;
          const warEndTime = warInfo.endTime;
          
          // War started
          if (warState === 'inWar' && clanState.lastWarState !== 'inWar') {
            await announce(guild, cfg, {
              clanName: clanInfo.name,
              clanTag: formatClanTag(cleanTag),
              warOpponent: warInfo.opponent.name,
              warEndTime: getWarTimeRemaining(warEndTime),
              memberCount: `${currentMembers.length}/50`
            }, 'war_start');
          }
          
          // War ended (was in war, now not in war, or preparation ended)
          if (clanState.lastWarState === 'inWar' && warState !== 'inWar') {
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
            
            await announce(guild, cfg, {
              clanName: clanInfo.name,
              clanTag: formatClanTag(cleanTag),
              warOpponent: warInfo.opponent.name,
              warResult,
              warStars,
              warDestructionPercentage: warDestruction,
              memberCount: `${currentMembers.length}/50`
            }, 'war_end');
          }
          
          clanState.lastWarState = warState;
          clanState.lastWarEndTime = warEndTime;

          // Auto-refresh war statistics during active wars
          if (warState === 'inWar' && cfg.warLeaderboardChannelId) {
            await autoRefreshWarLeaderboard(guild, cfg, cleanTag, warInfo, clanState);
          }
        } else {
          // No war info available, reset war state
          if (clanState.lastWarState === 'inWar') {
            clanState.lastWarState = null;
          }
        }
      }
      
      clanState.lastMemberCount = currentMembers.length;
      
      // Check if we should update donation leaderboard based on schedule
      if (cfg.trackDonationLeaderboard && cfg.donationLeaderboardSchedule) {
        const now = new Date();
        const lastLeaderboardPost = clanState.lastLeaderboardPost ? new Date(clanState.lastLeaderboardPost) : null;
        
        let shouldUpdate = false;
        
        // Check if it's time to update based on schedule
        switch (cfg.donationLeaderboardSchedule) {
          case 'hourly':
            shouldUpdate = !lastLeaderboardPost || 
              (now.getTime() - lastLeaderboardPost.getTime()) >= (60 * 60 * 1000);
            break;
          case 'daily':
            shouldUpdate = !lastLeaderboardPost || 
              (now.getTime() - lastLeaderboardPost.getTime()) >= (24 * 60 * 60 * 1000);
            break;
          case 'weekly':
            shouldUpdate = !lastLeaderboardPost || 
              (now.getTime() - lastLeaderboardPost.getTime()) >= (7 * 24 * 60 * 60 * 1000);
            break;
          case 'monthly':
            shouldUpdate = !lastLeaderboardPost || 
              (now.getMonth() !== lastLeaderboardPost.getMonth() || 
               now.getFullYear() !== lastLeaderboardPost.getFullYear());
            break;
        }
        
        if (shouldUpdate) {
          try {
            if (!cfg.donationLeaderboardChannelId) {
              console.warn(`[COC] Skipping leaderboard update for guild ${guild.id} (no donationLeaderboardChannelId set)`);
              continue;
            }
            
            // Get existing message ID for updating
            const currentConfig = await store.getGuildClashOfClansConfig(guild.id);
            let existingMessageId = currentConfig.donationMessageId || null;
            
            // If no message ID stored, try to find existing leaderboard message in channel
            if (!existingMessageId) {
              try {
                const channel = guild.channels.cache.get(cfg.donationLeaderboardChannelId);
                if (channel) {
                  // Search recent messages for existing leaderboard (last 50 messages)
                  const messages = await channel.messages.fetch({ limit: 50 });
                  const existingMessage = messages.find(msg => 
                    msg.author.id === guild.client.user.id && 
                    msg.embeds.length > 0 && 
                    (msg.embeds[0].title?.includes('Donation Leaderboard') || 
                     msg.embeds[0].title?.includes('War Statistics')) &&
                    msg.components.length > 0 &&
                    msg.components[0].components?.some(btn => btn.customId?.startsWith('leaderboard_'))
                  );
                  
                  if (existingMessage) {
                    existingMessageId = existingMessage.id;
                    console.log(`[COC] Found existing leaderboard message ${existingMessageId} for guild ${guild.id}`);
                    
                    // Update database with found message ID (for first clan only, since donations are shared)
                    try {
                      await store.sqlPool.execute(
                        'UPDATE guild_clashofclans_watch SET donation_message_id = ? WHERE guild_id = ? AND clan_tag = ? LIMIT 1',
                        [existingMessageId, guild.id, cleanTag]
                      );
                      console.log(`[COC] Updated donation message ID in database for guild ${guild.id}, clan ${cleanTag}`);
                    } catch (updateError) {
                      console.warn(`[COC] Failed to update donation message ID for guild ${guild.id}, clan ${cleanTag}:`, updateError.message);
                    }
                  }
                }
              } catch (findError) {
                console.warn(`[COC] Could not search for existing message in guild ${guild.id}:`, findError.message);
              }
            }
            
            // Use the new LeaderboardEvents system instead of old generateDonationLeaderboard
            const LeaderboardEvents = require('../handlers/LeaderboardEvents');
            const leaderboardEvents = new LeaderboardEvents(guild.client, store.sqlPool);
            
            // Post/update leaderboard using new system
            const result = await leaderboardEvents.postLeaderboard(
              guild.id, 
              cfg.donationLeaderboardChannelId, 
              existingMessageId,
              'donations'
            );
            
            if (result && result.success) {
              console.log(`[COC] ${existingMessageId ? 'Updated' : 'Created'} leaderboard using new canvas system for guild ${guild.id}`);
              clanState.lastLeaderboardPost = now.toISOString();
            } else {
              console.error(`[COC] Failed to update leaderboard for guild ${guild.id}:`, result?.error);
            }
              
          } catch (error) {
            console.error(`[COC] Error generating scheduled donation leaderboard for guild ${guild.id}:`, error.message);
          }
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
    // Check if war leaderboard is enabled and has a separate channel
    if (!cfg.warLeaderboardChannelId) {
      return; // No war leaderboard channel configured
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
        defenderPosition: attack.defenderPosition,
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
              currentAttack.destruction !== lastAttack.destruction ||
              currentAttack.defenderPosition !== lastAttack.defenderPosition) {
            attacksChanged = true;
            break;
          }
        }
        
        if (attacksChanged) break;
      }
    }

    // Refresh if attacks changed or enough time has passed
    if (attacksChanged || now - lastWarRefresh >= refreshInterval) {
      
      console.log(`[COC] Auto-refreshing war leaderboard for ${guild.name} - attacks changed: ${attacksChanged}`);
      
      // Use the unified LeaderboardEvents system for consistency
      try {
        const LeaderboardEvents = require('../handlers/LeaderboardEvents');
        const leaderboardEvents = new LeaderboardEvents(guild.client, store.sqlPool);
        
        // Get existing war message ID for updating
        let existingMessageId = cfg.warLeaderboardMessageId || null;
        
        // If no message ID stored, try to find existing war leaderboard message in channel
        if (!existingMessageId && cfg.warLeaderboardChannelId) {
          try {
            const channel = guild.channels.cache.get(cfg.warLeaderboardChannelId);
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
                console.log(`[COC] Found existing war leaderboard message ${existingMessageId} for guild ${guild.id}`);
                
                // Update database with found message ID for this specific clan
                try {
                  await store.sqlPool.execute(
                    'UPDATE guild_clashofclans_watch SET war_leaderboard_message_id = ? WHERE guild_id = ? AND clan_tag = ?',
                    [existingMessageId, guild.id, clanTag]
                  );
                  console.log(`[COC] Updated war message ID in database for guild ${guild.id}, clan ${clanTag}`);
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
          cfg.warLeaderboardChannelId, 
          existingMessageId,
          'war',
          clanTag  // Pass clan tag for proper database updates
        );
        
        if (result && result.success) {
          console.log(`[COC] ${existingMessageId ? 'Updated' : 'Created'} war leaderboard for guild ${guild.id}`);
        } else {
          console.error(`[COC] Failed to update war leaderboard for guild ${guild.id}:`, result?.error);
        }
      } catch (error) {
        console.error(`[COC] Error auto-refreshing war leaderboard for ${guild.name}:`, error.message);
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
