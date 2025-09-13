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
          knownDonationMilestones: new Map()
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
        } else {
          // No war info available, reset war state
          if (clanState.lastWarState === 'inWar') {
            clanState.lastWarState = null;
          }
        }
      }
      
      clanState.lastMemberCount = currentMembers.length;
      
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