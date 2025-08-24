import React, { useState, useEffect, useRef } from 'react';
// Lazy loaded sections (code splitting)
const SettingsPanel = React.lazy(()=> import('./Settings.jsx'));
const AutosSectionLazy = React.lazy(()=> import('./AutosSection'));
import 'bootstrap/dist/css/bootstrap.min.css';
// Highcharts libs will be loaded dynamically (not via React.lazy because they export objects, not components)
// We'll load them when the Overview section is first viewed
// Option B: removed DataTables – using pure React table implementation
import { login, getSettings, updateSettings, listAuto, upsertAuto, deleteAuto, getApiBase, fetchJson, getCommandToggles, setCommandToggle, getPersonalization, updatePersonalization, getWelcome, updateWelcome, getChannels } from './api';
const API_BASE = getApiBase();

export default function App(){
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loginForm, setLoginForm] = useState({ username:'', password:'' });
  const [settings, setSettings] = useState(null);
  const [autos, setAutos] = useState([]); // always array
  // Modal editing state
  const emptyAuto = { key:'', pattern:'', flags:'i', replies:'', enabled:true };
  const [modalAuto, setModalAuto] = useState(emptyAuto);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [toasts, setToasts] = useState([]); // {id,type,message}
  const [loading, setLoading] = useState(false);
  const [oauthMode, setOauthMode] = useState(true); // new flag
  const [guilds, setGuilds] = useState(()=>{
    try {
      const raw = localStorage.getItem('guildsCache');
      if(raw) return JSON.parse(raw) || [];
    } catch {}
    return [];
  });
  // Persist selected guild & view so refresh keeps current location
  const [selectedGuild, setSelectedGuild] = useState(()=>{
    try { return localStorage.getItem('selectedGuild') || null; } catch { return null; }
  });
  const [view, setView] = useState(()=>{
    try {
      const tok = localStorage.getItem('token');
      const sg = localStorage.getItem('selectedGuild');
      // If we have both token + selectedGuild assume dashboard; guild list will refresh async
      if(tok && sg) return 'dashboard';
      return 'login';
    } catch { return 'login'; }
  }); // login | guild | dashboard
  const [guildSearch, setGuildSearch] = useState('');
  // Sidebar section
  const [dashSection, setDashSection] = useState(()=>{
    try { return localStorage.getItem('dashSection') || 'overview'; } catch { return 'overview'; }
  }); // overview | autos | commands | personal | welcome | settings
  // Sidebar UI state
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
  // Sidebar modes: full (240px) | mini (70px) – persisted
  const [sidebarMode, setSidebarMode] = useState(()=> (typeof window!=='undefined' && localStorage.getItem('sidebarMode')==='mini') ? 'mini' : 'full');
  const sidebarRef = useRef(null);
  function cycleSidebarMode(){
    setSidebarMode(m => {
      const next = (m==='full') ? 'mini' : 'full';
      if(sidebarRef.current){
        sidebarRef.current.classList.add('animating');
        setTimeout(()=> sidebarRef.current && sidebarRef.current.classList.remove('animating'), 360);
      }
      return next;
    });
  }
  useEffect(()=>{ try { localStorage.setItem('sidebarMode', sidebarMode); } catch(_){} }, [sidebarMode]);
  useEffect(()=>{ try { localStorage.setItem('guildsCache', JSON.stringify(guilds)); } catch(_){} }, [guilds]);
  // Persist selected guild & dash section
  useEffect(()=>{ try { if(selectedGuild) localStorage.setItem('selectedGuild', selectedGuild); } catch(_){} }, [selectedGuild]);
  useEffect(()=>{ try { localStorage.setItem('dashSection', dashSection); } catch(_){} }, [dashSection]);
  // Persist view mainly for guild vs dashboard (login recalculated from token presence)
  useEffect(()=>{ try { localStorage.setItem('lastView', view); } catch(_){} }, [view]);
  // On reload when we jumped straight to dashboard but guilds list empty, fetch guild metadata silently so logo appears
  useEffect(()=>{
    if(token && selectedGuild && guilds.length===0){
      (async()=>{
        try {
          const res = await fetch(API_BASE + '/api/guilds', { headers:{ Authorization: 'Bearer '+localStorage.getItem('token') }});
          if(!res.ok) return;
          const txt = await res.text();
            let data={}; try { data = txt? JSON.parse(txt):{}; } catch { return; }
          if(Array.isArray(data.guilds)) setGuilds(data.guilds);
          else if(Array.isArray(data)) setGuilds(data);
        } catch {}
      })();
    }
  }, [token, selectedGuild, guilds.length]);
  // Effect: lock body scroll when mobile sidebar open
  useEffect(()=>{
    if(sidebarOpen) { document.body.classList.add('sidebar-open'); }
    else { document.body.classList.remove('sidebar-open'); }
  }, [sidebarOpen]);
  // Global Escape key handler: closes modal first, then sidebar
  useEffect(()=>{
    const handler = (e)=>{
      if(e.key !== 'Escape') return;
      if(showAutoModal){
        e.preventDefault();
        closeAutoModal();
        return;
      }
      if(sidebarOpen){
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return ()=> window.removeEventListener('keydown', handler);
  }, [showAutoModal, sidebarOpen]);
  // Detect OAuth code immediately to avoid login flash
  const initialAuthCode = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search).get('code') : null;
  const [authProcessing, setAuthProcessing] = useState(!!initialAuthCode && !token);

  // --- Lifecycle / bootstrap ---
  useEffect(()=>{
    // If token already exists (persisted), go fetch guilds
    if(token && view==='login'){
      bootstrapGuilds();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Handle OAuth code & state present in URL (Discord redirect)
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if(!token && code && state){
      (async()=>{
        try {
          if(!authProcessing) setAuthProcessing(true);
          const resp = await fetch(API_BASE + '/api/oauth/discord/exchange', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code, state }) });
          const text = await resp.text();
          let data; try { data = text? JSON.parse(text):{}; } catch { throw new Error('OAuth exchange failed (bad JSON)'); }
          if(!resp.ok){ throw new Error(data.error || 'OAuth exchange failed'); }
          if(data.token){ localStorage.setItem('token', data.token); setToken(data.token); }
          if(Array.isArray(data.guilds)) setGuilds(data.guilds);
          setView('guild');
          const cleanUrl = window.location.origin + window.location.pathname; // strip params
          window.history.replaceState({}, '', cleanUrl);
        } catch(e){ setError(e.message); }
        finally { setAuthProcessing(false); }
      })();
    }
  }, [token, authProcessing]);

  // If token exists (return visit) fetch user profile to restore selected guild automatically
  useEffect(()=>{
    if(token && view==='login'){
      (async()=>{
        try {
          const resp = await fetch(API_BASE + '/api/user/me', { headers:{ Authorization:'Bearer '+token }});
          if(resp.ok){
            const t = await resp.text();
            let u={}; try { u = t? JSON.parse(t):{}; } catch {}
            if(u && u.selected_guild_id){
              setSelectedGuild(u.selected_guild_id);
              setView('dashboard');
              refresh();
            } else {
              bootstrapGuilds();
            }
          }
        } catch{}
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function bootstrapGuilds(){
    try {
      setLoading(true);
      // guild list endpoint piggybacked from settings API when guild not chosen yet? Fallback to /api/guilds via window.fetch
  const res = await fetch(API_BASE + '/api/guilds', { headers:{ Authorization: 'Bearer '+localStorage.getItem('token') }});
      if(!res.ok) throw new Error('Failed to load guilds');
  const txt = await res.text(); let data={}; try { data = txt? JSON.parse(txt):{}; } catch { throw new Error('Guilds JSON parse failed'); }
      setGuilds(data.guilds||data||[]);
      setView('guild');
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ if(token && view==='dashboard' && selectedGuild){ refresh(); } }, [token, view, selectedGuild]);

  async function refresh(){
    if(!selectedGuild) return;
    try {
      setLoading(true);
  const [s, a] = await Promise.all([getSettings(selectedGuild), listAuto(selectedGuild)]);
  setSettings(s || {});
  setAutos(Array.isArray(a) ? a : []);
      setError('');
    } catch(e){
      if (e.message.toLowerCase().includes('unauthorized')) { doLogout(); }
      else setError(e.message);
    } finally { setLoading(false); }
  }

  async function handleLogin(e){
    e.preventDefault();
    try { await login(loginForm.username, loginForm.password); setToken(localStorage.getItem('token')); setError(''); } catch(e){ setError(e.message); }
  }

  function startDiscordLogin(){
    fetchJson('/api/oauth/discord/url')
      .then(d=>{ if(d && d.url) window.location.href = d.url; else throw new Error('No OAuth URL'); })
      .catch(e=> setError('OAuth URL error: '+e.message+' (is backend running on 3001?)'));
  }

  function doLogout(){
    localStorage.removeItem('token');
    try {
      localStorage.removeItem('selectedGuild');
      localStorage.removeItem('dashSection');
      localStorage.removeItem('lastView');
    } catch(_){}
    setToken(null);
    setSelectedGuild(null);
    setSettings(null);
    setAutos([]);
    setView('login');
  }

  function saveSelectedGuild(nextView){
    if(!selectedGuild) return;
    (async()=>{
      try {
  await fetch(API_BASE + '/api/user/select-guild', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('token') }, body: JSON.stringify({ guildId: selectedGuild }) });
      } catch(e){ /* non-fatal */ }
      setView(nextView||'dashboard');
      refresh();
    })();
  }

  function openNewAuto(){
    setModalAuto(emptyAuto);
    setShowAutoModal(true);
  }
  function openEditAuto(a){
    const replies = Array.isArray(a.replies)? a.replies.join('\n'): '';
    setModalAuto({...a, replies });
    setShowAutoModal(true);
  }
  function closeAutoModal(){
    setShowAutoModal(false);
    setModalAuto(emptyAuto);
  }

  // (regex tester + table logic moved into AutosSection)

  async function saveSettings(){
    try {
      const optimistic = { ...settings };
      setSettings(optimistic);
  const updated = await updateSettings(optimistic, selectedGuild);
      setSettings(updated);
  pushToast('success','Settings saved');
    } catch(e){ setError(e.message); }
  }

  async function addOrUpdateAuto(){
    if(!modalAuto.key || !modalAuto.pattern) return;
    const replies = modalAuto.replies.split('\n').map(r=>r.trim()).filter(Boolean);
    const entry = { key:modalAuto.key, pattern:modalAuto.pattern, flags:modalAuto.flags, replies, enabled: modalAuto.enabled };
    // optimistic update
    setAutos(prev => {
      const idx = prev.findIndex(p=>p.key===entry.key);
      if(idx>=0){ const copy=[...prev]; copy[idx]=entry; return copy; }
      return [...prev, entry];
    });
    try {
  await upsertAuto(entry, selectedGuild);
  pushToast('success','Auto response saved');
      closeAutoModal();
    } catch(e){ setError(e.message); refresh(); }
  }

  async function removeAuto(key){
    if(!window.confirm('Delete '+key+'?')) return;
    // optimistic removal
    const prev = autos;
    setAutos(autos.filter(a=>a.key!==key));
  try { await deleteAuto(key, selectedGuild); pushToast('success','Deleted'); } catch(e){ setError(e.message); setAutos(prev); }
  }

  function pushToast(type,message){
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(()=> setToasts(t => t.filter(x=>x.id!==id)), 3500);
  }

  // Responsive breakpoint detection for mobile optimized UI (used for sidebar behavior only now)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(()=>{
    function handleResize(){ setIsMobile(window.innerWidth < 720); }
    handleResize();
    window.addEventListener('resize', handleResize);
    return ()=> window.removeEventListener('resize', handleResize);
  }, []);

  // Add body padding to accommodate fixed footer
  useEffect(()=>{
    if(typeof document !== 'undefined'){
      document.body.classList.add('has-fixed-footer');
      return () => document.body.classList.remove('has-fixed-footer');
    }
  }, []);

  // simple stats
  const totalEnabled = Array.isArray(autos) ? autos.filter(a=>a && a.enabled!==false).length : 0;
  const totalDisabled = (Array.isArray(autos)? autos.length:0) - totalEnabled;
  // Analytics snapshot state
  const [analytics, setAnalytics] = useState(null);
  const [apiStatus, setApiStatus] = useState(null); // shape { gemini:{enabled}, discord:{ready,ping}, database:{mode,connected}, uptime:{seconds,startedAt} }
  // Highcharts dynamic modules
  const [Highcharts, setHighcharts] = useState(null);
  const [HighchartsReact, setHighchartsReact] = useState(null);
  const [chartsReady, setChartsReady] = useState(false);
  // Load chart libs only when overview section is viewed & analytics needed
  useEffect(()=>{
    let cancelled = false;
    if(dashSection==='overview' && !Highcharts){
      (async()=>{
        try {
          const [hc, hcr] = await Promise.all([
            import(/* webpackChunkName: 'charts-hc' */ 'highcharts'),
            import(/* webpackChunkName: 'charts-hcr' */ 'highcharts-react-official')
          ]);
          if(!cancelled){
            setHighcharts(hc.default || hc);
            setHighchartsReact(hcr.default || hcr);
            setChartsReady(true);
          }
        } catch(e){ /* ignore failed chart load */ }
      })();
    }
    return ()=>{ cancelled=true; };
  }, [dashSection, Highcharts]);
  useEffect(()=>{
    if(view==='dashboard' && selectedGuild){
      fetch(getApiBase() + '/api/analytics/overview?guildId='+selectedGuild, { headers:{ Authorization:'Bearer '+localStorage.getItem('token') }} )
        .then(r=>r.json().catch(()=>null))
        .then(d=>{ if(d && d.totals) setAnalytics(d); })
        .catch(()=>{});
      fetch(getApiBase() + '/api/status', { headers:{ Authorization:'Bearer '+localStorage.getItem('token') }} )
        .then(r=>r.json().catch(()=>null))
        .then(d=>{ if(d && d.uptime) setApiStatus(d); })
        .catch(()=>{});
    }
  }, [view, selectedGuild, autos.length]);

  // Command toggles state
  const [commandTogglesState, setCommandTogglesState] = useState({}); // name -> enabled bool
  const [commandMeta, setCommandMeta] = useState({}); // name -> {createdAt, createdBy, updatedAt, updatedBy}
  useEffect(()=>{
    if(dashSection==='commands' && selectedGuild){
      (async()=>{
        try {
          const data = await getCommandToggles(selectedGuild);
          if(data && Array.isArray(data.commands)){
            const enabledMap = {}; const metaMap = {};
            for (const c of data.commands){
              enabledMap[c.name] = c.enabled !== false;
              metaMap[c.name] = { createdAt: c.createdAt, createdBy: c.createdBy, updatedAt: c.updatedAt, updatedBy: c.updatedBy };
            }
            setCommandTogglesState(enabledMap);
            setCommandMeta(metaMap);
          } else if (data && data.toggles) { // fallback older shape
            setCommandTogglesState(data.toggles);
          }
        } catch(e){ /* ignore */ }
      })();
    }
  }, [dashSection, selectedGuild]);
  function toggleCommand(name, enabled){
    setCommandTogglesState(t => ({ ...t, [name]: enabled }));
    setCommandToggle(name, enabled, selectedGuild).catch(()=>{
      // revert on failure
      setCommandTogglesState(t => ({ ...t, [name]: !enabled }));
      pushToast('error', 'Failed to update '+name);
    });
  }

  // (Legacy selection helpers removed in Option B)

  // ---- Move below states above conditional early returns to maintain consistent hook order ----
  // Personalization state (must be declared before any conditional returns)
  const [personalization, setPersonalization] = useState(null);
  const [personalizationLoading, setPersonalizationLoading] = useState(false);
  const [personalizationOriginal, setPersonalizationOriginal] = useState(null); // snapshot for dirty detection
  useEffect(()=>{
    if(dashSection==='personal' && selectedGuild){
      (async()=>{ 
        try { 
          setPersonalizationLoading(true);
          const p = await getPersonalization(selectedGuild); 
          setPersonalization(p); 
          setPersonalizationOriginal(p);
        } catch{} 
        finally { setPersonalizationLoading(false); }
      })();
    }
  }, [dashSection, selectedGuild]);

  // Welcome config state (also before conditional returns)
  const [welcomeCfg, setWelcomeCfg] = useState(null);
  const [welcomeOriginal, setWelcomeOriginal] = useState(null); // snapshot for dirty detection
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [welcomeChannels, setWelcomeChannels] = useState([]);
  useEffect(()=>{
    if(dashSection==='welcome' && selectedGuild){
  (async()=>{ try { setWelcomeLoading(true); const [w, ch] = await Promise.all([getWelcome(selectedGuild), getChannels(selectedGuild).catch(()=>null)]); setWelcomeCfg(w); setWelcomeOriginal(w); if(ch && Array.isArray(ch.channels)) setWelcomeChannels(ch.channels); } catch{} finally { setWelcomeLoading(false); } })();
    }
  }, [dashSection, selectedGuild]);

  // Login view
  if(view==='login' && !token){
    if(typeof document!=='undefined'){ document.body.classList.add('login-mode'); }
    const year = new Date().getFullYear();
    return <div className="login-viewport">
      <div className="login-center fade-in">
        <div className="login-card card-glass">
          <div className="login-card-inner">
            <div className="login-hero mb-3">
              <div className="logo-orb">
                <img src="/images.jpg" alt="Choco Maid" className="logo-img" onError={(e)=>{ e.currentTarget.style.display='none'; }} />
                <span className="orb-text">CM</span>
              </div>
              <div>
                <h1 className="login-title mb-1">Choco Maid</h1>
                <div className="login-subtitle">Smart assistant & auto‑response manager</div>
              </div>
            </div>
            {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
            {authProcessing ? <div className="auth-processing vstack gap-3 text-center py-4">
              <div className="spinner-border text-light mx-auto" style={{width:'2.5rem', height:'2.5rem'}} role="status"><span className="visually-hidden">Loading...</span></div>
              <div className="small text-muted">Completing Discord sign‑in…</div>
            </div> : oauthMode ? <div className="vstack gap-3">
                <p className="text-muted small m-0">Authenticate with your Discord account to access your servers and manage bot settings.</p>
                <button onClick={startDiscordLogin} className="btn btn-discord-cta">
                  <span className="ico me-1"><i className="fa-brands fa-discord" /></span>
                  <span>Login with Discord</span>
                </button>
                {!(typeof import.meta!=='undefined' && import.meta.env && import.meta.env.VITE_DISABLE_LEGACY_LOGIN) && <button type="button" className="btn btn-link p-0 small" onClick={()=>setOauthMode(false)}>Use legacy admin login</button>}
              </div> : <form onSubmit={handleLogin} className="vstack gap-3">
                <div>
                  <label className="form-label small mb-1">Username</label>
                  <input className="form-control" placeholder="admin" value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username:e.target.value})} />
                </div>
                <div>
                  <label className="form-label small mb-1">Password</label>
                  <input className="form-control" type="password" placeholder="••••••" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password:e.target.value})} />
                </div>
                <div className="d-flex justify-content-between align-items-center mt-1">
                  <button type="submit" className="btn btn-brand flex-grow-1">
                    <i className="fa-solid fa-right-to-bracket me-2" />
                    Login
                  </button>
                  <button type="button" className="btn btn-link p-0 small ms-3" onClick={()=>setOauthMode(true)}>Discord login</button>
                </div>
              </form>}
            <div className="login-footer small text-muted mt-4">© {year} Choco Maid • Not affiliated with Discord</div>
          </div>
        </div>
      </div>
    </div>;
  } else if(typeof document!=='undefined'){ document.body.classList.remove('login-mode'); }

  // Guild selection view
  if(view==='guild'){
    const filteredGuilds = guilds.filter(g=> !guildSearch || g.name.toLowerCase().includes(guildSearch.toLowerCase()));
    return <div className="container mt-4 fade-in" style={{maxWidth:960}}>
      <div className="card card-glass shadow-sm p-2 p-md-3 guild-select-wrapper">
        <div className="card-body pt-3">
          <div className="d-flex flex-column flex-md-row justify-content-between gap-3 align-items-md-center mb-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <h4 className="mb-0 fw-semibold">Choose a Server</h4>
              </div>
              <p className="text-muted small mb-0">Select the Discord server you want to manage. You can change this later in the dashboard.</p>
            </div>
            <div className="d-flex gap-2 align-items-center w-100 w-md-auto">
              <input className="form-control form-control-sm guild-search" placeholder="Search servers..." value={guildSearch} onChange={e=>setGuildSearch(e.target.value)} />
            </div>
          </div>
          {error && <div className="alert alert-danger py-2 mb-2">{error}</div>}
          <div className="guild-grid mb-3">
            {filteredGuilds.map(g => {
              const active = selectedGuild===g.id;
              const iconUrl = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null;
              return <button key={g.id} type="button" onClick={()=>setSelectedGuild(g.id)} className={'guild-card' + (active?' active':'')}>
                <div className="guild-icon-wrap">{iconUrl ? <img src={iconUrl} alt={g.name} loading="lazy" /> : <div className="guild-icon-fallback">{g.name.slice(0,2).toUpperCase()}</div>}</div>
                <div className="guild-meta">
                  <div className="guild-name" title={g.name}>{g.name}</div>
                  <div className="guild-tags">{g.canManage && <span className="badge-perm">Manage</span>}</div>
                </div>
                {active && <div className="checkmark">✓</div>}
              </button>;
            })}
            {filteredGuilds.length===0 && guilds.length>0 && <div className="text-muted small p-4">No servers match your search.</div>}
            {guilds.length===0 && <div className="text-muted small p-4">No servers found that the bot is in. Invite the bot to a server, then refresh this page.</div>}
          </div>
          <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
            <div className="small text-muted">{selectedGuild ? 'Selected: '+(guilds.find(g=>g.id===selectedGuild)?.name || selectedGuild) : guilds.length+ ' servers'}</div>
            <div className="d-flex gap-2">
              <button disabled={!selectedGuild} onClick={()=>saveSelectedGuild('dashboard')} className="btn btn-brand px-4">
                <i className="fa-solid fa-gauge-high me-2" />
                Continue to Dashboard
              </button>
              <button onClick={()=>{ setSelectedGuild(null); doLogout(); }} className="btn btn-outline-secondary">
                <i className="fa-solid fa-right-from-bracket me-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>;
  }

  // Dashboard view --------------------------------------------------
  if(view!=='dashboard') return null; // safety

  const resolvedGuildName = guilds.find(g=>g.id===selectedGuild)?.name || (selectedGuild && selectedGuild.length>4 ? 'Server '+selectedGuild.slice(0,6)+'…' : selectedGuild) || 'Unknown';
  const guildBanner = guilds.find(g=>g.id===selectedGuild)?.banner ? `https://cdn.discordapp.com/banners/${selectedGuild}/${guilds.find(g=>g.id===selectedGuild).banner}.png?size=512` : null;

  // --- Section contents ---
  const overviewContent = <div className="overview-section fade-in-soft">
    <h5 className="mb-3">Overview</h5>
    {error && <div className="alert alert-danger py-2 mb-2">{error}</div>}
    {info && <div className="alert alert-success py-2 mb-2">{info}</div>}
    {loading && <div className="alert alert-info py-2 mb-2">Loading...</div>}
    <div className="row g-4">
      <div className="col-12 col-lg-5">
        {analytics && <div className="card card-glass shadow-sm h-100"><div className="card-body d-flex flex-column">
          <h6 className="mb-3 text-muted" style={{letterSpacing:'.5px'}}>Quick Statistics</h6>
          <div className="row g-3 mb-3">
            <div className="col-6">
              <div className="mini-stat">
                <div className="mini-label">Autos Enabled</div>
                <div className="mini-value text-accent">{analytics.totals.autosEnabled}</div>
                <div className="mini-sub text-muted">of {analytics.totals.autos}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="mini-stat">
                <div className="mini-label">Cmds Enabled</div>
                <div className="mini-value text-success">{analytics.totals.commandsEnabled}</div>
                <div className="mini-sub text-muted">of {analytics.totals.commands}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="mini-stat">
                <div className="mini-label">Autos Disabled</div>
                <div className="mini-value text-danger">{analytics.totals.autos - analytics.totals.autosEnabled}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="mini-stat">
                <div className="mini-label">Cmds Disabled</div>
                <div className="mini-value text-danger">{analytics.totals.commandsDisabled}</div>
              </div>
            </div>
            {apiStatus && <div className="col-12">
              <div className="mini-stat api-status-grid small" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:'12px'}}>
                <div className="api-pill">
                  <div className="mini-label">Gemini AI</div>
                  <div className={'mini-value '+(apiStatus.gemini.enabled ? 'text-success':'text-danger')}>{apiStatus.gemini.enabled ? 'On':'Off'}</div>
                </div>
                <div className="api-pill">
                  <div className="mini-label">Discord</div>
                  <div className={'mini-value '+(apiStatus.discord.ready ? 'text-success':'text-danger')}>{apiStatus.discord.ready ? 'Ready':'Down'}</div>
                  {apiStatus.discord.ping!=null && <div className="mini-sub text-muted">{apiStatus.discord.ping} ms</div>}
                </div>
                <div className="api-pill">
                  <div className="mini-label">Database</div>
                  <div className={'mini-value '+(apiStatus.database.connected ? 'text-success':'text-danger')}>{apiStatus.database.mode}</div>
                </div>
                <div className="api-pill">
                  <div className="mini-label">Uptime</div>
                  <div className="mini-value text-accent">{Math.floor(apiStatus.uptime.seconds/3600)}h</div>
                  <div className="mini-sub text-muted">{Math.floor((apiStatus.uptime.seconds%3600)/60)}m</div>
                </div>
              </div>
            </div>}
          </div>
          <div className="flex-grow-1 d-flex flex-column">
            {!chartsReady && dashSection==='overview' && <div className="text-muted small">Loading charts…</div>}
            {chartsReady && HighchartsReact && Highcharts && <HighchartsReact highcharts={Highcharts} options={{
              chart:{ type:'bar', backgroundColor:'transparent', height:260, styledMode:false },
              title:{ text:null },
              xAxis:{ categories:['Autos','Commands'], labels:{ style:{ color:'#9ca3af' } } },
              yAxis:{ min:0, title:{ text:'Count' }, gridLineColor:'rgba(255,255,255,0.08)', labels:{ style:{ color:'#9ca3af' } } },
              legend:{ reversed:true },
              plotOptions:{ series:{ stacking:'normal', borderWidth:0 } },
              series:[
                { name:'Disabled', data:[analytics.totals.autos - analytics.totals.autosEnabled, analytics.totals.commandsDisabled], color:'#4b5563' },
                { name:'Enabled', data:[analytics.totals.autosEnabled, analytics.totals.commandsEnabled], color:'#6366f1' }
              ],
              credits:{ enabled:false },
              tooltip:{ shared:true, backgroundColor:'#111827', borderColor:'#374151', style:{ color:'#f9fafb' } }
            }} />}
            <div className="small text-muted mt-2" style={{opacity:.75}}>Stacked bar compares enabled vs disabled for autos and commands.</div>
          </div>
        </div></div>}
        {!analytics && <div className="card card-glass shadow-sm h-100"><div className="card-body d-flex align-items-center justify-content-center text-muted small">Loading analytics…</div></div>}
      </div>
      <div className="col-12 col-lg-7">
        <div className="stat-cards mb-3">
          <div className="stat-card"><h6>Total Autos</h6><div className="value">{autos.length}</div></div>
          <div className="stat-card"><h6>Enabled</h6><div className="value text-success">{totalEnabled}</div></div>
          <div className="stat-card"><h6>Disabled</h6><div className="value text-danger">{totalDisabled}</div></div>
        </div>
        <div className="card card-glass shadow-sm mb-3"><div className="card-body small" style={{lineHeight:'1.15rem'}}>
          <strong>Welcome!</strong> Use the sidebar to manage auto responses and (soon) commands. This overview summarizes key stats.
        </div></div>
        {analytics && <div className="card card-glass shadow-sm mb-3"><div className="card-body">
          <h6 className="text-muted mb-2" style={{letterSpacing:'.5px'}}>Autos by First Letter</h6>
          {!chartsReady && dashSection==='overview' && <div className="text-muted small">Loading chart…</div>}
          {chartsReady && HighchartsReact && Highcharts && <HighchartsReact highcharts={Highcharts} options={{
            chart:{ type:'column', backgroundColor:'transparent', height:240 },
            title:{ text:null },
            xAxis:{ categories:Object.keys(analytics.autoBuckets), labels:{ style:{ color:'#9ca3af' } } },
            yAxis:{ title:{ text:'Count' }, gridLineColor:'rgba(255,255,255,0.08)', labels:{ style:{ color:'#9ca3af' } } },
            legend:{ enabled:false },
            series:[{ name:'Autos', data:Object.values(analytics.autoBuckets), color:'#5865F2' }],
            credits:{ enabled:false },
            tooltip:{ backgroundColor:'#111827', borderColor:'#374151', style:{ color:'#f9fafb' } }
          }} />}
        </div></div>}
        {analytics && <div className="row g-3">
          <div className="col-md-6">
            <div className="card card-glass shadow-sm h-100"><div className="card-body">
              <h6 className="text-muted mb-2" style={{letterSpacing:'.5px'}}>Commands Enabled vs Disabled</h6>
              {!chartsReady && dashSection==='overview' && <div className="text-muted small">Loading…</div>}
              {chartsReady && HighchartsReact && Highcharts && <HighchartsReact highcharts={Highcharts} options={{
                chart:{ type:'pie', backgroundColor:'transparent', height:220 },
                title:{ text:null },
                tooltip:{ pointFormat:'<b>{point.y}</b> ({point.percentage:.1f}%)' },
                plotOptions:{ pie:{ innerSize:'55%', dataLabels:{ style:{ color:'#e5e7eb', textOutline:'none', fontSize:'11px' } } } },
                series:[{ name:'Commands', data:[
                  { name:'Enabled', y:analytics.totals.commandsEnabled, color:'#10b981' },
                  { name:'Disabled', y:analytics.totals.commandsDisabled, color:'#ef4444' }
                ]}],
                credits:{ enabled:false }
              }} />}
            </div></div>
          </div>
          <div className="col-md-6">
            <div className="card card-glass shadow-sm h-100"><div className="card-body">
              <h6 className="text-muted mb-2" style={{letterSpacing:'.5px'}}>Auto Response Enablement</h6>
              {!chartsReady && dashSection==='overview' && <div className="text-muted small">Loading…</div>}
              {chartsReady && HighchartsReact && Highcharts && <HighchartsReact highcharts={Highcharts} options={{
                chart:{ type:'pie', backgroundColor:'transparent', height:220 },
                title:{ text:null },
                plotOptions:{ pie:{ innerSize:'55%', dataLabels:{ style:{ color:'#e5e7eb', textOutline:'none', fontSize:'11px' } } } },
                tooltip:{ pointFormat:'<b>{point.y}</b> ({point.percentage:.1f}%)' },
                series:[{ name:'Autos', data:[
                  { name:'Enabled', y:analytics.totals.autosEnabled, color:'#6366f1' },
                  { name:'Disabled', y:analytics.totals.autos - analytics.totals.autosEnabled, color:'#4b5563' }
                ]}],
                credits:{ enabled:false }
              }} />}
            </div></div>
          </div>
        </div>}
      </div>
    </div>
  </div>;

  const autosContent = <React.Suspense fallback={<div className="text-muted small p-3">Loading auto responses…</div>}>
    <AutosSectionLazy
    autos={autos}
    setAutos={setAutos}
    totalEnabled={totalEnabled}
    totalDisabled={totalDisabled}
    selectedGuild={selectedGuild}
    openEditAuto={openEditAuto}
    openNewAuto={openNewAuto}
    upsertAuto={upsertAuto}
    deleteAuto={deleteAuto}
    pushToast={pushToast}
    refresh={refresh}
  />
  </React.Suspense>;

  const commandGroups = [
    {
      key: 'core', title: 'Core', icon: 'fa-gauge-high', accent: 'var(--accent)',
      items: [
        { name:'ping', usage:'/ping', desc:'Health check – replies with Pong.' },
        { name:'uptime', usage:'/uptime', desc:'Shows bot process uptime.' },
        { name:'whoami', usage:'/whoami', desc:'Shows your user tag & id.' },
        { name:'echo', usage:'/echo <text>', desc:'Replies with the same text.' },
        { name:'help', usage:'/help', desc:'Interactive category help menu.' }
      ]
    },
    {
      key: 'ai', title: 'AI & Language', icon: 'fa-robot', accent: '#8d90ff',
      items: [
        { name:'ask', usage:'/ask prompt:<text>', desc:'Ask AI a question (cached 3 min).' },
        { name:'askfollow', usage:'/askfollow prompt:<text>', desc:'Follow-up using recent conversation context.' },
        { name:'explain_image', usage:'/explain_image image(1-3) [prompt]', desc:'Explain up to 3 images with optional prompt.' },
        { name:'summarize', usage:'/summarize [count]', desc:'Summarize last messages (default 30).' },
        { name:'translate', usage:'/translate text target', desc:'Translate text into the target language.' }
      ]
    },
    {
      key: 'polls', title: 'Polls', icon: 'fa-square-poll-horizontal', accent: '#10b981',
      items: [
        { name:'poll create', usage:'/poll create question options', desc:'Create a poll (up to 5 options).' },
        { name:'poll results', usage:'/poll results id', desc:'Show results for a poll id.' }
      ]
    },
    {
      key: 'utilities', title: 'Utilities', icon: 'fa-wrench', accent: '#f59e0b',
      items: [
        { name:'math', usage:'/math add|sub|mul|div a b', desc:'Basic arithmetic operations.' },
        { name:'user info', usage:'/user info [target]', desc:'Lookup Discord user info.' },
  { name:'remind', usage:'/remind minutes text', desc:'Schedule a reminder DM or channel.' },
  { name:'meme', usage:'/meme', desc:'Random meme image from meme-api.com.' }
      ]
    },
    {
      key: 'passive', title: 'Passive / Automation', icon: 'fa-bolt', accent: '#ef4444',
      items: [
        { name:'autoreply', usage:'(passive)', desc:'Automatic replies based on configured patterns.' }
      ]
    }
  ];
  const commandsContent = <div className="commands-section fade-in-soft">
    <h5 className="mb-3">Commands</h5>
    <div className="cmd-groups">
      {commandGroups.map(gr => <div key={gr.key} className="cmd-group-card">
        <div className="cmd-group-head" style={{'--grp-accent': gr.accent}}>
          <div className="cmd-group-icon"><i className={'fa-solid '+gr.icon}></i></div>
          <div className="cmd-group-meta">
            <h6 className="cmd-group-title mb-0">{gr.title}</h6>
            <div className="cmd-group-count small">{gr.items.length} command{gr.items.length!==1?'s':''}</div>
          </div>
        </div>
        <div className="cmd-items">
          { gr.items.map(it => <div key={it.name} className="cmd-item">
            <div className="cmd-item-main">
              <div className="cmd-item-name"><code>{it.name}</code></div>
              <div className="cmd-item-usage"><code>{it.usage}</code></div>
                <div className="ms-auto d-flex align-items-center">
                  <div className="d-flex flex-column align-items-end">
                    <label className="form-check form-switch m-0">
                      <input type="checkbox" className="form-check-input" checked={commandTogglesState[it.name] !== false} onChange={e=>toggleCommand(it.name, e.target.checked)} />
                    </label>
                    {commandMeta[it.name]?.updatedAt && <div className="cmd-meta-hint small text-muted" title={`Updated by ${commandMeta[it.name]?.updatedBy||'unknown'}`}>{new Date(commandMeta[it.name].updatedAt).toLocaleDateString()}</div>}
                  </div>
                </div>
            </div>
            <div className="cmd-item-desc small text-muted">{it.desc}</div>
          </div>)}
        </div>
      </div>)}
    </div>
    <div className="text-muted small mt-3" style={{opacity:.8}}>AI related calls may be rate limited. Image size limit 8MB each. Passive features run automatically.</div>
  </div>;

  function handleAvatarFile(e){
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.toString();
      setPersonalization(p => ({ ...(p||{}), avatarBase64: b64 }));
    };
    reader.readAsDataURL(file);
  }
  async function savePersonalization(){
    if(!personalization) return;
    try { const res = await updatePersonalization(personalization, selectedGuild); setPersonalization(res); setPersonalizationOriginal(res); pushToast('success','Bot personalization saved'); } catch(e){ pushToast('error','Save failed'); }
  }
  function personalizationDirty(){
    if(!personalization || !personalizationOriginal) return false;
    const keys=['nickname','activityType','activityText','status','avatarBase64'];
    return keys.some(k => (personalization[k]||'') !== (personalizationOriginal[k]||''));
  }
  function resetPersonalization(){ if(personalizationOriginal) setPersonalization(personalizationOriginal); }
  function welcomeDirty(){
    if(!welcomeCfg || !welcomeOriginal) return false;
    const keys=['channelId','messageType','messageText','cardEnabled'];
    return keys.some(k => (welcomeCfg[k]??'') !== (welcomeOriginal[k]??''));
  }
  function resetWelcome(){ if(welcomeOriginal) setWelcomeCfg(welcomeOriginal); }
  async function saveWelcome(){
    if(!welcomeCfg) return;
    try { const res = await updateWelcome(welcomeCfg, selectedGuild); setWelcomeCfg(res); setWelcomeOriginal(res); pushToast('success','Welcome settings saved'); } catch(e){ pushToast('error','Save failed'); }
  }
  // --- Personalization Preview helpers ---
  function renderStatusDot(st){
    const map = { online:'#16a34a', idle:'#f59e0b', dnd:'#dc2626', invisible:'#6b7280' };
    const color = map[st] || '#16a34a';
    return <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:color,marginRight:6,boxShadow:'0 0 0 2px rgba(255,255,255,0.1)'}}></span>;
  }
  const personalizationContent = <div className="fade-in-soft personalization-section-wrapper position-relative">
    <div className="d-flex align-items-center gap-2 mb-3">
      <h5 className="mb-0">Bot Personalization</h5>
      {personalizationDirty() && <span className="dirty-badge">Unsaved</span>}
    </div>
    {personalization && <div className="row g-4">
      <div className="col-lg-6">
        <div className="card card-glass shadow-sm"><div className="card-body vstack gap-3 position-relative">
          <div>
            <label className="form-label mb-1">Bot Nickname (guild only)</label>
            <input className="form-control" value={personalization.nickname||''} onChange={e=>setPersonalization(p=>({...p,nickname:e.target.value}))} placeholder="Leave blank to keep current" />
          </div>
          <div>
            <label className="form-label mb-1">Activity Type</label>
            <select className="form-select" value={personalization.activityType||''} onChange={e=>setPersonalization(p=>({...p,activityType:e.target.value||null}))}>
              <option value="">(none)</option>
              <option value="PLAYING">Playing</option>
              <option value="LISTENING">Listening</option>
              <option value="WATCHING">Watching</option>
              <option value="COMPETING">Competing</option>
            </select>
          </div>
          <div>
            <label className="form-label mb-1">Activity Text</label>
            <input className="form-control" value={personalization.activityText||''} onChange={e=>setPersonalization(p=>({...p,activityText:e.target.value}))} placeholder="e.g. with your messages" />
          </div>
            <div>
              <label className="form-label mb-1">Status</label>
              <select className="form-select" value={personalization.status||''} onChange={e=>setPersonalization(p=>({...p,status:e.target.value||null}))}>
                <option value="">(default)</option>
                <option value="online">Online</option>
                <option value="idle">Idle</option>
                <option value="dnd">Do Not Disturb</option>
                <option value="invisible">Invisible</option>
              </select>
            </div>
          <div>
            <label className="form-label mb-1">Avatar Image</label>
            <input className="form-control" type="file" accept="image/png,image/jpeg" onChange={handleAvatarFile} />
            {personalization.avatarBase64 && <div className="mt-2"><img src={personalization.avatarBase64} alt="avatar preview" style={{maxWidth:120,borderRadius:'12px'}} /></div>}
          </div>
          <div className="d-flex gap-2 justify-content-end">
            {personalizationDirty() && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetPersonalization}><i className="fa-solid fa-rotate-left me-1"/>Reset</button>}
            <button className="btn btn-brand" disabled={!personalizationDirty()} onClick={savePersonalization}><i className="fa-solid fa-floppy-disk me-2" />Save</button>
          </div>
          <div className="small text-muted">Nickname & avatar require bot permissions; activity applies globally per shard if implemented.</div>
          {personalizationLoading && <div className="section-loading-overlay">
            <div className="spinner-border text-light" role="status" style={{width:'2.5rem',height:'2.5rem'}}><span className="visually-hidden">Loading…</span></div>
            <div className="mt-3 small text-muted">Loading bot profile…</div>
          </div>}
        </div></div>
      </div>
      {/* Live Preview Column */}
      <div className="col-lg-6">
        <div className="card card-glass shadow-sm h-100"><div className="card-body d-flex flex-column live-preview-card">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h6 className="mb-0 text-muted" style={{letterSpacing:'.5px'}}>Live Preview</h6>
            {personalizationDirty() && <span className="badge bg-warning-subtle text-warning-emphasis">Unsaved</span>}
          </div>
          <div className="d-flex align-items-center mb-3">
            <div style={{width:72,height:72,borderRadius:'18px',overflow:'hidden',background:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
              {personalization.avatarBase64 ? <img src={personalization.avatarBase64} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <i className="fa-solid fa-robot fa-2x text-muted"></i>}
              {personalization.status && <span style={{position:'absolute',bottom:6,right:6,width:18,height:18,borderRadius:'50%',background:'#1f2937',display:'flex',alignItems:'center',justifyContent:'center'}}>{renderStatusDot(personalization.status)}</span>}
            </div>
            <div className="ms-3 flex-grow-1">
              <div className="fw-semibold" style={{fontSize:'1.05rem'}}>{personalization.nickname?.trim() || 'Current Bot Name'}</div>
              <div className="small text-muted">{personalization.status ? (personalization.status.charAt(0).toUpperCase()+personalization.status.slice(1)) : 'Default status'}</div>
            </div>
          </div>
          {(personalization.activityType && personalization.activityText) ? <div className="mb-2 small"><strong>{personalization.activityType.charAt(0)+personalization.activityType.slice(1).toLowerCase()}</strong> {personalization.activityText}</div> : <div className="mb-2 small text-muted">No activity set</div>}
          <div className="mt-auto small text-muted" style={{opacity:.75}}>This preview updates instantly with your unsaved changes.</div>
        </div></div>
      </div>
    </div>}
    {!personalization && personalizationLoading && <div className="section-loading-standalone">
      <div className="spinner-border text-light" role="status" style={{width:'2.75rem',height:'2.75rem'}}><span className="visually-hidden">Loading…</span></div>
      <div className="mt-3 small text-muted">Loading bot profile…</div>
    </div>}
  </div>;

  // saveWelcome redefined above with dirty tracking
  // Channel selection placeholder (requires channel list API future). For now free text.
  const welcomeContent = <div className="fade-in-soft welcome-section-wrapper position-relative">
    <div className="d-flex align-items-center gap-2 mb-3">
      <h5 className="mb-0">Welcome Messages</h5>
      {welcomeDirty() && <span className="dirty-badge">Unsaved</span>}
    </div>
    {welcomeCfg && <div className="row g-4">
      <div className="col-lg-7">
        <div className="card card-glass shadow-sm"><div className="card-body vstack gap-3 position-relative">
          <div>
            <label className="form-label mb-1">Channel</label>
            <select className="form-select" value={welcomeCfg.channelId||''} onChange={e=>setWelcomeCfg(w=>({...w,channelId:e.target.value||null}))}>
              <option value="">(none)</option>
              {welcomeChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
            <div className="form-text">Select the channel to send welcome messages.</div>
          </div>
          <div>
            <label className="form-label mb-1">Message Type</label>
            <select className="form-select" value={welcomeCfg.messageType||'text'} onChange={e=>setWelcomeCfg(w=>({...w,messageType:e.target.value}))}>
              <option value="text">Plain Text</option>
              <option value="embed">Embed</option>
            </select>
          </div>
          <div>
            <label className="form-label mb-1">Message Content</label>
            <textarea className="form-control" rows={4} value={welcomeCfg.messageText||''} onChange={e=>setWelcomeCfg(w=>({...w,messageText:e.target.value}))} placeholder="Welcome {user} to {server}!" />
            <div className="form-text">Tokens: {'{user}'} mention, {'{server}'} name.</div>
          </div>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="welcomeCardSwitch" checked={welcomeCfg.cardEnabled} onChange={e=>setWelcomeCfg(w=>({...w,cardEnabled:e.target.checked}))} />
            <label className="form-check-label" htmlFor="welcomeCardSwitch">Enable Welcome Card (embed thumbnail / future image)</label>
          </div>
          <div className="d-flex gap-2 justify-content-end">
            <button className="btn btn-outline-secondary btn-sm" disabled={!welcomeDirty()} onClick={resetWelcome}><i className="fa-solid fa-rotate-left me-1"/>Reset</button>
            <button className="btn btn-brand" disabled={!welcomeDirty()} onClick={saveWelcome}><i className="fa-solid fa-floppy-disk me-2"/>Save</button>
          </div>
          <div className="small text-muted">A message is sent when a new member joins. Ensure the bot can view & send to the channel.</div>
          {welcomeLoading && <div className="welcome-loading-overlay">
            <div className="spinner-border text-light" role="status" style={{width:'2.75rem', height:'2.75rem'}}>
              <span className="visually-hidden">Loading…</span>
            </div>
            <div className="mt-3 small text-muted">Loading welcome settings…</div>
          </div>}
        </div></div>
      </div>
      {/* Live Preview Column */}
      <div className="col-lg-5">
        <div className="card card-glass shadow-sm h-100"><div className="card-body d-flex flex-column live-preview-card">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h6 className="mb-0 text-muted" style={{letterSpacing:'.5px'}}>Live Preview</h6>
            {welcomeDirty() && <span className="badge bg-warning-subtle text-warning-emphasis">Unsaved</span>}
          </div>
          {(() => {
            const sampleUser = '@NewUser';
            const guildName = resolvedGuildName || '{server}';
            const msgRaw = (welcomeCfg.messageText||'').trim() || 'Welcome {user} to {server}!';
            const substituted = msgRaw.replace(/\{user\}/g, sampleUser).replace(/\{server\}/g, guildName);
            if(welcomeCfg.messageType==='embed'){
              return <div className="welcome-preview-embed" style={{background:'rgba(255,255,255,0.04)',borderRadius:'12px',padding:'12px 14px',position:'relative',border:'1px solid rgba(255,255,255,0.08)'}}>
                <div style={{position:'absolute',left:0,top:0,bottom:0,width:4,background:'var(--accent,#5865f2)',borderTopLeftRadius:12,borderBottomLeftRadius:12}}></div>
                <div className="small" style={{whiteSpace:'pre-wrap'}}>{substituted}</div>
                {welcomeCfg.cardEnabled && <div className="mt-3 d-flex align-items-center gap-2 small text-muted" style={{opacity:.85}}>
                  <div style={{width:40,height:40,borderRadius:'8px',background:'linear-gradient(135deg,#5865f2,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600}}>CM</div>
                  <span>Welcome card thumbnail</span>
                </div>}
              </div>;
            }
            return <div className="welcome-preview-text" style={{background:'rgba(255,255,255,0.04)',borderRadius:'12px',padding:'12px 14px',border:'1px solid rgba(255,255,255,0.08)'}}>
              <span style={{whiteSpace:'pre-wrap'}}>{substituted}</span>
              {welcomeCfg.cardEnabled && <div className="mt-2 small text-muted">(Card thumbnail enabled)</div>}
            </div>;
          })()}
          <div className="mt-auto small text-muted" style={{opacity:.75}}>Preview updates instantly. Save to apply to real join events.</div>
        </div></div>
      </div>
    </div>}
    {!welcomeCfg && welcomeLoading && <div className="welcome-loading-standalone">
      <div className="spinner-border text-light" role="status" style={{width:'2.75rem', height:'2.75rem'}}><span className="visually-hidden">Loading…</span></div>
      <div className="mt-3 small text-muted">Loading welcome settings…</div>
    </div>}
  </div>;

  const settingsContent = <React.Suspense fallback={<div className="text-muted small p-3">Loading settings…</div>}>
    <SettingsPanel guildId={selectedGuild} pushToast={pushToast} />
  </React.Suspense>;
  const sectionMap = { overview: overviewContent, autos: autosContent, commands: commandsContent, personal: personalizationContent, welcome: welcomeContent, settings: settingsContent };

  const effectiveSidebarMode = isMobile ? 'full' : sidebarMode; // force full on mobile
  const content = <div className="container-fluid py-4 fade-in">
    {guildBanner}
    <div className={"dashboard-flex sidebar-"+effectiveSidebarMode}>
      <aside ref={sidebarRef} className={"dash-sidebar mode-"+effectiveSidebarMode + (sidebarOpen? ' open':'')}>
        <div className="sidebar-inner">
        <div className="guild-switcher card-glass mb-3 p-2 d-flex align-items-center gap-2">
          <button type="button" className="guild-switcher-btn flex-grow-1" onClick={()=>setView('guild')} title="Change server">
            {(() => { const g = guilds.find(x=>x.id===selectedGuild); const iconUrl = g?.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null; return <>
              <div className="gw-icon">{iconUrl ? <img src={iconUrl} alt={g?.name||'Guild'} /> : <span className="fallback">{(g?.name||'?').slice(0,2).toUpperCase()}</span>}</div>
              <div className="gw-meta">
                <div className="gw-name" title={g?.name}>{g?.name||'Select a Server'}</div>
                <div className="gw-action">Change server ▾</div>
              </div>
            </>; })()}
          </button>
          {!isMobile && <button type="button" className="collapse-toggle" onClick={cycleSidebarMode} title={effectiveSidebarMode==='full'? 'Collapse sidebar':'Expand sidebar'}>
            <i className={'fa-solid chev '+ (effectiveSidebarMode==='full'? 'fa-chevron-left':'fa-chevron-right')}></i>
          </button>}
        </div>
        <div className="dash-menu">
          <button type="button" data-label="Overview" onClick={()=>{setDashSection('overview'); setSidebarOpen(false);}} className={'dash-menu-item'+(dashSection==='overview'? ' active':'')}>
            <i className="fa-solid fa-gauge-high menu-ico"></i>
            <span className="menu-label">Overview</span>
          </button>
          <button type="button" data-label="Auto Responses" onClick={()=>{setDashSection('autos'); setSidebarOpen(false);}} className={'dash-menu-item'+(dashSection==='autos'? ' active':'')}>
            <i className="fa-solid fa-bolt menu-ico"></i>
            <span className="menu-label">Auto Responses</span>
          </button>
          <button type="button" data-label="Commands" onClick={()=>{setDashSection('commands'); setSidebarOpen(false);}} className={'dash-menu-item'+(dashSection==='commands'? ' active':'')}>
            <i className="fa-solid fa-terminal menu-ico"></i>
            <span className="menu-label">Commands</span>
          </button>
          <button type="button" data-label="Bot Personalization" onClick={()=>{setDashSection('personal'); setSidebarOpen(false);}} className={'dash-menu-item'+(dashSection==='personal'? ' active':'')}>
            <i className="fa-solid fa-user-gear menu-ico"></i>
            <span className="menu-label">Bot Personalization</span>
          </button>
          <button type="button" data-label="Welcome" onClick={()=>{setDashSection('welcome'); setSidebarOpen(false);}} className={'dash-menu-item'+(dashSection==='welcome'? ' active':'')}>
            <i className="fa-solid fa-door-open menu-ico"></i>
            <span className="menu-label">Welcome</span>
          </button>
          <button type="button" data-label="Settings" onClick={()=>{setDashSection('settings'); setSidebarOpen(false);}} className={'dash-menu-item'+(dashSection==='settings'? ' active':'')}>
            <i className="fa-solid fa-sliders menu-ico"></i>
            <span className="menu-label">Settings</span>
          </button>
        </div>
        <div className="dash-sidebar-footer mt-4">
          <button
            type="button"
            data-label="Logout"
            className="dash-menu-item logout-btn"
            onClick={()=>{ doLogout(); setSidebarOpen(false); }}
            title="Sign out"
          >
            <i className="fa-solid fa-right-from-bracket menu-ico"></i>
            <span className="menu-label">Logout</span>
          </button>
        </div>
        </div>
      </aside>
      <main className="dash-main">
        {sectionMap[dashSection]}
      </main>
    </div>
    {/* Floating action button & backdrop for mobile */}
    {!sidebarOpen && <button type="button" className="fab-toggle d-lg-none" onClick={()=>setSidebarOpen(true)} aria-label="Open menu">
      <span className="fab-ripple"></span>
      <i className="fa-solid fa-bars"></i>
    </button>}
    {sidebarOpen && <div className="sidebar-backdrop d-lg-none" onClick={()=>setSidebarOpen(false)} />}
    {showAutoModal && dashSection==='autos' && <div className="modal d-block fade-in" tabIndex={-1} role="dialog" style={{background:'rgba(8,10,18,0.72)'}} onMouseDown={(e)=>{ if(e.target.classList.contains('modal')) closeAutoModal(); }}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document" onMouseDown={e=>e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title mb-0">{modalAuto.key ? 'Edit Auto Response' : 'Add Auto Response'}</h5>
            <button type="button" className="btn-close" onClick={closeAutoModal}></button>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <label className="form-label mb-1">Key <span className="text-muted small">(unique id)</span></label>
                <input className="form-control" disabled={!!(autos.find(a=>a.key===modalAuto.key))} placeholder="greet" value={modalAuto.key} onChange={e=>setModalAuto({...modalAuto, key:e.target.value})} />
                <div className="form-text">No spaces.</div>
              </div>
              <div className="col-12 col-md-5">
                <label className="form-label mb-1">Regex Pattern</label>
                <input className="form-control" placeholder="^hello|hi" value={modalAuto.pattern} onChange={e=>setModalAuto({...modalAuto, pattern:e.target.value})} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label mb-1">Flags</label>
                <input className="form-control" placeholder="i" value={modalAuto.flags} onChange={e=>setModalAuto({...modalAuto, flags:e.target.value})} />
              </div>
              <div className="col-12">
                <label className="form-label mb-1">Replies <span className="text-muted small">(one per line)</span></label>
                <textarea className="form-control" rows={4} placeholder={"Hello there!\nHi!"} value={modalAuto.replies} onChange={e=>setModalAuto({...modalAuto, replies:e.target.value})} />
              </div>
              <div className="col-12">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="modalEnabledSwitch" checked={modalAuto.enabled} onChange={e=>setModalAuto({...modalAuto, enabled:e.target.checked})} />
                  <label className="form-check-label" htmlFor="modalEnabledSwitch">Enabled</label>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer py-2 d-flex justify-content-between">
            <div className="small text-muted">Bot picks one reply randomly.</div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={closeAutoModal}>Cancel</button>
              <button type="button" className="btn btn-success" onClick={addOrUpdateAuto}>Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>}
  </div>;
  // Toasts container
  const year = new Date().getFullYear();
  const footer = <footer className="app-footer fade-in-soft"><div className="footer-inner">© {year} Choco Maid • Bot dashboard – Not affiliated with Discord</div></footer>;
  const header = null; // undo navbar per request
  return <>
  {header}
    {content}
    {footer}
    <div className="toast-holder">
      {toasts.map(t => <div key={t.id} className={"toast-item toast-"+t.type}>
        <div className="flex-grow-1">{t.message}</div>
        <button className="toast-close" onClick={()=>setToasts(ts=>ts.filter(x=>x.id!==t.id))}>×</button>
      </div>)}
    </div>
  </>;
}
