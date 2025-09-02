// Point to backend API (proxy handles /api during dev; fallback direct port)
const API_BASE = import.meta.env.VITE_API_BASE || '';

function getToken(){ return localStorage.getItem('token'); }
function setToken(t){ localStorage.setItem('token', t); }

async function login(username, password){
  const r = await fetch(API_BASE + '/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) });
  if(!r.ok) throw new Error('Login failed');
  const data = await r.json();
  setToken(data.token);
  return data;
}

// Enhanced auth fetch with JWT expiration handling
async function authFetch(path, opts={}){
  const token = getToken();
  
  if (!token) {
    // No token available - don't call handleAuthError to avoid loops
    console.warn('authFetch called without token for:', path);
    throw new Error('No authentication token available');
  }
  
  const headers = Object.assign({}, opts.headers||{}, { 
    'Content-Type':'application/json', 
    Authorization: 'Bearer ' + token 
  });
  
  try {
    const res = await fetch(API_BASE + path, { ...opts, headers });
    
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
export async function resolveTwitchStreamer(input){ return authFetch('/api/twitch/resolve-streamer', { method:'POST', body: JSON.stringify({ input }) }); }

// Authentication management
export async function logout() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    // Even if logout API call fails, clear local storage
    console.warn('Logout API call failed:', error);
  } finally {
    // Always clear local storage
    localStorage.removeItem('token');
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

export { login, getToken, setToken, handleAuthError };
