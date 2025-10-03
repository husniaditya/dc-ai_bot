// Point to backend API (proxy handles /api during dev; fallback direct port)
const API_BASE = import.meta.env.VITE_API_BASE || '';

// Secure token management for production
function getToken(){ 
  // For development/backward compatibility, check localStorage
  // In production, tokens should be in HttpOnly cookies
  return localStorage.getItem('token'); 
}

function setToken(t){ 
  if (t) {
    localStorage.setItem('token', t); 
  } else {
    localStorage.removeItem('token');
  }
}

// Check if we're using cookie-based auth (more secure)
function isUsingCookieAuth() {
  return document.cookie.includes('authToken=');
}

async function login(username, password){
  const r = await fetch(API_BASE + '/api/login', { 
    method:'POST', 
    headers:{'Content-Type':'application/json'}, 
    body: JSON.stringify({ username, password }),
    credentials: 'include' // Important: Include cookies in requests
  });
  if(!r.ok) throw new Error('Login failed');
  const data = await r.json();
  
  // Set token in localStorage for backward compatibility
  // In production, prefer HttpOnly cookies set by server
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

// Enhanced auth fetch with JWT expiration handling
async function authFetch(path, opts={}){
  // Check if using cookie-based auth (more secure)
  const usingCookies = isUsingCookieAuth();
  const token = usingCookies ? null : getToken();
  
  if (!usingCookies && !token) {
    // No token available - don't call handleAuthError to avoid loops
    console.warn('authFetch called without token for:', path);
    throw new Error('No authentication token available');
  }
  
  const headers = Object.assign({}, opts.headers||{}, { 
    'Content-Type':'application/json'
  });
  
  // Only add Authorization header if not using cookies
  if (!usingCookies && token) {
    headers.Authorization = 'Bearer ' + token;
  }
  
  const fetchOptions = { 
    ...opts, 
    headers,
    credentials: 'include' // Always include cookies
  };
  
  try {
    const res = await fetch(API_BASE + path, fetchOptions);
    
    // Handle authentication errors with specific JWT error handling
    if(res.status === 401) {
      let errorData = {};
      try {
        const text = await res.text();
        errorData = text ? JSON.parse(text) : {};
      } catch (e) {
        // If we can't parse the error response, treat as generic auth error
        errorData = { error: 'authentication_failed', message: 'Authentication failed' };
      }
      
      // Check if server indicates forced logout is required
      if (errorData.requiresLogout) {
        handleAuthError(errorData.message || 'Session expired');
        throw new Error('Authentication failed - session expired');
      }
      
      // Generic 401 handling
      handleAuthError('Unauthorized access');
      throw new Error('Unauthorized');
    }
    
    let text;
    try { text = await res.text(); } catch { text = ''; }
    if(!text) return null; // allow empty 204 responses
    try { return JSON.parse(text); } catch(e){ throw new Error('Bad JSON response'); }
    
  } catch (error) {
    // Network errors or other fetch failures
    if (error.message.includes('Authentication failed')) {
      throw error; // Re-throw auth errors
    }
    
    // For network errors, don't force logout
    throw error;
  }
}

/**
 * Handle authentication errors by clearing token and redirecting
 * @param {string} message - Error message to display
 */
let isHandlingAuthError = false; // Guard to prevent multiple simultaneous logout attempts

function handleAuthError(message = 'Authentication failed') {
  // Prevent multiple simultaneous logout attempts
  if (isHandlingAuthError) {
    console.log('Auth error already being handled, skipping...');
    return;
  }
  
  isHandlingAuthError = true;
  console.warn('Authentication error:', message);
  
  // Clear stored token
  localStorage.removeItem('token');
  
  // Reset the guard after a short delay
  setTimeout(() => {
    isHandlingAuthError = false;
  }, 1000);
  
  // Try to use auth manager if available
  if (window.authManager) {
    window.authManager.forceLogout(message);
  } else {
    // Fallback: redirect to login with message
    const params = new URLSearchParams();
    params.set('message', message);
    window.location.href = '/?message=' + encodeURIComponent(message);
  }
}

export function getApiBase(){ return API_BASE || ''; }

// Generic unauthenticated JSON fetch with fallback to localhost:3001 if proxy/base missing
export async function fetchJson(path){
  const bases = API_BASE ? [API_BASE] : ['', 'http://localhost:3001'];
  let lastErr;
  for(const b of bases){
    try {
      const res = await fetch(b + path, { headers:{ 'Accept':'application/json' } });
      
      // Clone the response so we can read it multiple times if needed
      const resClone = res.clone();
      
      if(!res.ok){
        let txt = '';
        try { 
          txt = await res.text(); 
        } catch { 
          txt = ''; 
        }
        try { 
          const j = txt ? JSON.parse(txt) : {}; 
          throw new Error(j.error || ('HTTP '+res.status)); 
        } catch(e){ 
          if(e.message.startsWith('HTTP ')) throw e; 
          throw new Error('HTTP '+res.status);
        }
      }
      
      let txt = '';
      try {
        txt = await resClone.text();
      } catch {
        txt = '';
      }
      
      if(!txt) return null;
      try { 
        return JSON.parse(txt); 
      } catch { 
        throw new Error('Bad JSON response'); 
      }
    } catch(e){ 
      lastErr = e; 
    }
  }
  throw lastErr || new Error('Network error');
}

export async function getSettings(guildId){ return authFetch('/api/settings' + (guildId?`?guildId=${guildId}`:'')); }
export async function updateSettings(p, guildId){ return authFetch('/api/settings' + (guildId?`?guildId=${guildId}`:''), { method:'PUT', body: JSON.stringify(p) }); }
export async function listAuto(guildId){ return authFetch('/api/auto-responses' + (guildId?`?guildId=${guildId}`:'')); }
export async function upsertAuto(entry, guildId){ return authFetch('/api/auto-responses' + (guildId?`?guildId=${guildId}`:''), { method:'POST', body: JSON.stringify(entry) }); }
export async function deleteAuto(key, guildId){ return authFetch('/api/auto-responses/' + encodeURIComponent(key) + (guildId?`?guildId=${guildId}`:''), { method:'DELETE' }); }

// Audit Logging API functions
export async function getAuditLogConfig(guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/logging/config', { headers });
}

export async function updateAuditLogConfig(config, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/logging/config', {
    method: 'PUT',
    headers,
    body: JSON.stringify(config)
  });
}

export async function getAuditLogs(guildId, options = {}) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  const params = new URLSearchParams();
  
  if (options.actionType) params.append('actionType', options.actionType);
  if (options.userId) params.append('userId', options.userId);
  if (options.channelId) params.append('channelId', options.channelId);
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.offset) params.append('offset', options.offset.toString());
  if (options.orderBy) params.append('orderBy', options.orderBy);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  return authFetch(`/api/moderation/logging/logs${query}`, { headers });
}

export async function createAuditLogEntry(logData, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/logging/logs', {
    method: 'POST',
    headers,
    body: JSON.stringify(logData)
  });
}

export async function deleteAuditLogEntry(logId, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch(`/api/moderation/logging/logs/${logId}`, {
    method: 'DELETE',
    headers
  });
}

// Anti-Raid Configuration API functions
export async function getAntiRaidConfig(guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/antiraid/config', { headers });
}

export async function updateAntiRaidConfig(config, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/antiraid/config', {
    method: 'PUT',
    headers,
    body: JSON.stringify(config)
  });
}
export async function getCommandToggles(guildId){ return authFetch('/api/commands' + (guildId?`?guildId=${guildId}`:'')); }
export async function setCommandToggle(name, enabled, guildId){ return authFetch('/api/commands/toggle' + (guildId?`?guildId=${guildId}`:''), { method:'POST', body: JSON.stringify({ name, enabled }) }); }
export async function getPersonalization(guildId){ return authFetch('/api/personalization' + (guildId?`?guildId=${guildId}`:'')); }
export async function updatePersonalization(p, guildId){ return authFetch('/api/personalization' + (guildId?`?guildId=${guildId}`:''), { method:'PUT', body: JSON.stringify(p) }); }
export async function invalidatePersonalizationCache(guildId){ return authFetch('/api/personalization/invalidate', { method:'POST', body: JSON.stringify({ guildId }) }); }
export async function getWelcome(guildId){ return authFetch('/api/welcome' + (guildId?`?guildId=${guildId}`:'')); }
export async function updateWelcome(p, guildId){ return authFetch('/api/welcome' + (guildId?`?guildId=${guildId}`:''), { method:'PUT', body: JSON.stringify(p) }); }
export async function getChannels(guildId){ return authFetch('/api/channels' + (guildId?`?guildId=${guildId}`:'')); }
export async function getRoles(guildId){ return authFetch('/api/roles' + (guildId?`?guildId=${guildId}`:'')); }
export async function getGuildEmojis(guildId){ return authFetch('/api/guilds/' + guildId + '/emojis'); }
// YouTube watcher config helpers
export async function getYouTubeConfig(guildId){ return authFetch('/api/youtube/config' + (guildId?`?guildId=${guildId}`:'')); }
export async function updateYouTubeConfig(partial, guildId){ return authFetch('/api/youtube/config' + (guildId?`?guildId=${guildId}`:''), { method:'PUT', body: JSON.stringify(partial) }); }
export async function resolveYouTubeChannel(input){ return authFetch('/api/youtube/resolve-channel', { method:'POST', body: JSON.stringify({ input }) }); }
export async function extractYouTubeChannelId(input){ return authFetch('/api/youtube/extract-channel-id', { method:'POST', body: JSON.stringify({ input }) }); }

// Twitch watcher config helpers
export async function getTwitchConfig(guildId){ return authFetch('/api/twitch/config' + (guildId?`?guildId=${guildId}`:'')); }
export async function updateTwitchConfig(partial, guildId){ return authFetch('/api/twitch/config' + (guildId?`?guildId=${guildId}`:''), { method:'PUT', body: JSON.stringify(partial) }); }

// Clash of Clans API
export async function getClashOfClansConfig(guildId){ return authFetch('/api/clashofclans/config' + (guildId?`?guildId=${guildId}`:'')); }
export async function updateClashOfClansConfig(partial, guildId){ return authFetch('/api/clashofclans/config' + (guildId?`?guildId=${guildId}`:''), { method:'PUT', body: JSON.stringify(partial) }); }
export async function resolveTwitchStreamer(input){ return authFetch('/api/twitch/resolve-streamer', { method:'POST', body: JSON.stringify({ input }) }); }

// Genshin Impact API
export async function getGenshinConfig(guildId){ return authFetch('/api/genshin/config' + (guildId?`?guildId=${guildId}`:'')); }
export async function updateGenshinConfig(partial, guildId){ return authFetch('/api/genshin/config' + (guildId?`?guildId=${guildId}`:''), { method:'PUT', body: JSON.stringify(partial) }); }
export async function resolveGenshinPlayer(uid){ return authFetch('/api/genshin/resolve-player', { method:'POST', body: JSON.stringify({ uid }) }); }

// Valorant API
export async function getValorantConfig(guildId){ return authFetch('/api/valorant/config' + (guildId?`?guildId=${guildId}`:'')); }
export async function updateValorantConfig(partial, guildId){ return authFetch('/api/valorant/config' + (guildId?`?guildId=${guildId}`:''), { method:'PUT', body: JSON.stringify(partial) }); }

// XP System config helpers
export async function getXpConfig(guildId){ 
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/xp/config', { headers }); 
}
export async function updateXpConfig(config, guildId){ 
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/xp/config', { 
    method:'PUT', 
    headers,
    body: JSON.stringify(config) 
  }); 
}

// XP User management
export async function getXpLeaderboard(guildId, limit = 10, offset = 0) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
  return authFetch(`/api/moderation/xp/leaderboard?${params}`, { headers });
}

export async function getUserXp(guildId, userId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch(`/api/moderation/xp/user/${userId}`, { headers });
}

export async function addUserXp(guildId, userId, amount, source = 'manual') {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch(`/api/moderation/xp/user/${userId}/add`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount, source })
  });
}

export async function resetUserXp(guildId, userId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch(`/api/moderation/xp/user/${userId}`, {
    method: 'DELETE',
    headers
  });
}

// XP Level rewards
export async function getXpLevelRewards(guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/xp/rewards', { headers });
}

export async function addXpLevelReward(guildId, level, roleId, removePrevious = false) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/xp/rewards', {
    method: 'POST',
    headers,
    body: JSON.stringify({ level, roleId, removePrevious })
  });
}

export async function removeXpLevelReward(guildId, level) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch(`/api/moderation/xp/rewards/${level}`, {
    method: 'DELETE',
    headers
  });
}

// Authentication management
export async function logout() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    // Even if logout API call fails, clear local storage
    console.warn('Logout API call failed:', error);
  } finally {
    // Always clear local storage and cookies
    localStorage.removeItem('token');
    // Clear cookie by setting it to expire
    document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure; samesite=strict';
  }
}

export async function validateToken() {
  try {
    const result = await authFetch('/api/auth/validate');
    return result && result.valid === true;
  } catch (error) {
    console.warn('Token validation failed:', error);
    return false;
  }
}

export async function getCurrentUser() {
  return authFetch('/api/auth/user/me');
}

// Profanity management API functions
export async function getProfanityWords(guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/profanity/words', { headers });
}

export async function addProfanityWord(wordData, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/profanity/words', {
    method: 'POST',
    headers,
    body: JSON.stringify(wordData)
  });
}

export async function updateProfanityWord(wordId, wordData, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch(`/api/moderation/profanity/words/${wordId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(wordData)
  });
}

export async function deleteProfanityWord(wordId, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch(`/api/moderation/profanity/words/${wordId}`, {
    method: 'DELETE',
    headers
  });
}

export async function getProfanityPatterns(guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/profanity/patterns', { headers });
}

export async function addProfanityPattern(patternData, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/profanity/patterns', {
    method: 'POST',
    headers,
    body: JSON.stringify(patternData)
  });
}

export async function updateProfanityPattern(patternId, patternData, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch(`/api/moderation/profanity/patterns/${patternId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(patternData)
  });
}

export async function deleteProfanityPattern(patternId, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch(`/api/moderation/profanity/patterns/${patternId}`, {
    method: 'DELETE',
    headers
  });
}

// Scheduler API functions
export async function getSchedulerConfig(guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/scheduler/config', { headers });
}

export async function updateSchedulerConfig(config, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/scheduler/config', {
    method: 'PUT',
    headers,
    body: JSON.stringify(config)
  });
}

export async function getScheduledMessages(guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/scheduler/messages', { headers });
}

export async function createScheduledMessage(messageData, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch('/api/moderation/scheduler/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(messageData)
  });
}

export async function updateScheduledMessage(messageId, messageData, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch(`/api/moderation/scheduler/messages/${messageId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(messageData)
  });
}

export async function deleteScheduledMessage(messageId, guildId) {
  const headers = guildId ? { 'X-Guild-Id': guildId } : {};
  return authFetch(`/api/moderation/scheduler/messages/${messageId}`, {
    method: 'DELETE',
    headers
  });
}

export { login, getToken, setToken, handleAuthError, authFetch };
