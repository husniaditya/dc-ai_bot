const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

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
  const r = await fetch(API_BASE + path, { ...opts, headers });
  if(r.status === 401) throw new Error('Unauthorized');
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

export async function getSettings(guildId){ return authFetch('/api/settings' + (guildId?`?guildId=${guildId}`:'')); }
export async function updateSettings(p, guildId){ return authFetch('/api/settings' + (guildId?`?guildId=${guildId}`:''), { method:'PUT', body: JSON.stringify(p) }); }
export async function listAuto(guildId){ return authFetch('/api/auto-responses' + (guildId?`?guildId=${guildId}`:'')); }
export async function upsertAuto(entry, guildId){ return authFetch('/api/auto-responses' + (guildId?`?guildId=${guildId}`:''), { method:'POST', body: JSON.stringify(entry) }); }
export async function deleteAuto(key, guildId){ return authFetch('/api/auto-responses/' + encodeURIComponent(key) + (guildId?`?guildId=${guildId}`:''), { method:'DELETE' }); }
export { login };
