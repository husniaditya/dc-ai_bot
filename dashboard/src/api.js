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

async function authFetch(path, opts={}){
  const token = getToken();
  const headers = Object.assign({}, opts.headers||{}, { 'Content-Type':'application/json', Authorization: 'Bearer ' + token });
  const res = await fetch(API_BASE + path, { ...opts, headers });
  if(res.status === 401) throw new Error('Unauthorized');
  let text;
  try { text = await res.text(); } catch { text = ''; }
  if(!text) return null; // allow empty 204 responses
  try { return JSON.parse(text); } catch(e){ throw new Error('Bad JSON response'); }
}

export function getApiBase(){ return API_BASE || ''; }

// Generic unauthenticated JSON fetch with fallback to localhost:3001 if proxy/base missing
export async function fetchJson(path){
  const bases = API_BASE ? [API_BASE] : ['', 'http://localhost:3001'];
  let lastErr;
  for(const b of bases){
    try {
      const res = await fetch(b + path, { headers:{ 'Accept':'application/json' } });
      if(!res.ok){
        const txt = await res.text().catch(()=>'');
        try { const j = txt? JSON.parse(txt):{}; throw new Error(j.error || ('HTTP '+res.status)); } catch(e){ if(e.message.startsWith('HTTP ')) throw e; }
      }
      const txt = await res.text();
      if(!txt) return null;
      try { return JSON.parse(txt); } catch { throw new Error('Bad JSON'); }
    } catch(e){ lastErr = e; }
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
// YouTube watcher config helpers
export async function getYouTubeConfig(guildId){ return authFetch('/api/youtube/config' + (guildId?`?guildId=${guildId}`:'')); }
export async function updateYouTubeConfig(partial, guildId){ return authFetch('/api/youtube/config' + (guildId?`?guildId=${guildId}`:''), { method:'PUT', body: JSON.stringify(partial) }); }
export async function resolveYouTubeChannel(input){ return authFetch('/api/youtube/resolve-channel', { method:'POST', body: JSON.stringify({ input }) }); }
export { login };
