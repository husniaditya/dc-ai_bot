import React, { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
// Option B: removed DataTables – using pure React table implementation
import { login, getSettings, updateSettings, listAuto, upsertAuto, deleteAuto, getApiBase, fetchJson } from './api';
import AutosSection from './AutosSection';
const API_BASE = getApiBase();

export default function App(){
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loginForm, setLoginForm] = useState({ username:'', password:'' });
  const [settings, setSettings] = useState(null);
  const [autos, setAutos] = useState([]);
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
  }); // overview | autos | commands
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
      setSettings(s);
      setAutos(a);
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

  // simple stats
  const totalEnabled = autos.filter(a=>a.enabled!==false).length;
  const totalDisabled = autos.length - totalEnabled;

  // (Legacy selection helpers removed in Option B)

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
                <img src="/logo.svg" alt="Choco Maid" className="logo-img" onError={(e)=>{ e.currentTarget.style.display='none'; }} />
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
                <button onClick={startDiscordLogin} className="btn btn-discord-cta"><span className="ico">🡪</span> Login with Discord</button>
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
                  <button type="submit" className="btn btn-brand flex-grow-1">Login</button>
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
              <h4 className="mb-1 fw-semibold">Choose a Server</h4>
              <p className="text-muted small mb-0">Select the Discord server you want to manage. You can change this later in the dashboard.</p>
            </div>
            <div className="d-flex gap-2 align-items-center w-100 w-md-auto">
              <input className="form-control form-control-sm guild-search" placeholder="Search servers..." value={guildSearch} onChange={e=>setGuildSearch(e.target.value)} />
              <button className="btn btn-outline-secondary btn-sm" onClick={doLogout}>Logout</button>
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
              <button disabled={!selectedGuild} onClick={()=>saveSelectedGuild('dashboard')} className="btn btn-brand px-4">Continue to Dashboard</button>
              <button onClick={()=>{ setSelectedGuild(null); doLogout(); }} className="btn btn-outline-secondary">Logout</button>
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
    {error && <div className="alert alert-danger py-2 mb-2">{error}</div>}
    {info && <div className="alert alert-success py-2 mb-2">{info}</div>}
    {loading && <div className="alert alert-info py-2 mb-2">Loading...</div>}
    <div className="row g-4">
      <div className="col-12 col-lg-5">
        {settings && <div className="card card-glass shadow-sm h-100"><div className="card-body vstack gap-3">
          <h6 className="mb-1 text-muted" style={{letterSpacing:'.5px'}}>Bot Settings</h6>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="autoReplySwitch" checked={settings.autoReplyEnabled} onChange={e=>setSettings({...settings, autoReplyEnabled:e.target.checked})} />
            <label className="form-check-label" htmlFor="autoReplySwitch">Auto Reply Enabled</label>
          </div>
          <div>
            <label className="form-label mb-1">Cooldown (ms)</label>
            <input type="number" className="form-control" value={settings.autoReplyCooldownMs} onChange={e=>setSettings({...settings, autoReplyCooldownMs:e.target.value})} />
          </div>
          <div className="d-flex"><button onClick={saveSettings} className="btn btn-brand ms-auto">Save</button></div>
        </div></div>}
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
      </div>
    </div>
  </div>;

  const autosContent = <AutosSection
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
  />;

  const commandsContent = <div className="commands-section fade-in-soft">
    <div className="section-title">Commands</div>
    <div className="card card-glass shadow-sm mb-3"><div className="card-body small">
      Command management UI coming soon. You will be able to enable/disable commands and tweak permissions here.
    </div></div>
  </div>;

  const sectionMap = { overview: overviewContent, autos: autosContent, commands: commandsContent };

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
        </div>
        <div className="dash-sidebar-footer mt-4">
          <button type="button" data-label="Logout" className="btn btn-sm btn-outline-danger w-100 logout-btn" onClick={()=>{ doLogout(); setSidebarOpen(false); }}>
            <i className="fa-solid fa-right-from-bracket"></i>
            <span className="menu-label ms-1">Logout</span>
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
