import React, { useState, useEffect, useRef, useMemo } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
// Option B: removed DataTables – using pure React table implementation
import { login, getSettings, updateSettings, listAuto, upsertAuto, deleteAuto } from './api';

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
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [view, setView] = useState('login'); // login | guild | dashboard
  const [guildSearch, setGuildSearch] = useState('');
  // Sidebar section
  const [dashSection, setDashSection] = useState('overview'); // overview | autos | commands
  // Sidebar UI state
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop collapse
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
          const resp = await fetch('/api/oauth/discord/exchange', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code, state }) });
          if(!resp.ok){ const j = await resp.json().catch(()=>({})); throw new Error(j.error || 'OAuth exchange failed'); }
          const data = await resp.json();
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
          const resp = await fetch('/api/user/me', { headers:{ Authorization:'Bearer '+token }});
          if(resp.ok){
            const u = await resp.json();
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
      const res = await fetch('/api/guilds', { headers:{ Authorization: 'Bearer '+localStorage.getItem('token') }});
      if(!res.ok) throw new Error('Failed to load guilds');
      const data = await res.json();
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
    fetch('/api/oauth/discord/url')
      .then(r=>r.json())
      .then(d=>{ if(d.url) window.location.href = d.url; else throw new Error('No OAuth URL'); })
      .catch(e=> setError(e.message));
  }

  function doLogout(){
    localStorage.removeItem('token');
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
        await fetch('/api/user/select-guild', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('token') }, body: JSON.stringify({ guildId: selectedGuild }) });
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

  function runTester(){
    if(!testerPattern){ setTesterResult(null); return; }
    try {
      const reg = new RegExp(testerPattern, testerFlags);
      const lines = testerSample.split(/\r?\n/);
      const matches = lines.map(line => ({ line, match: reg.test(line) }));
      setTesterResult({ ok:true, matches });
    } catch(e){ setTesterResult({ ok:false, error: e.message }); }
  }

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

  // search/filter
  const [search, setSearch] = useState('');
  // Manual selection state (keys)
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [showRegexTester, setShowRegexTester] = useState(false);
  const [testerPattern, setTesterPattern] = useState('');
  const [testerFlags, setTesterFlags] = useState('i');
  const [testerSample, setTesterSample] = useState('');
  const [testerResult, setTesterResult] = useState(null);
  // Pagination + sorting (pure React table for autos)
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ field: 'key', dir: 'asc' }); // dir: asc|desc
  const headerSelectRef = useRef(null);
  // Responsive breakpoint detection for mobile optimized UI
  const [isMobile, setIsMobile] = useState(false);
  useEffect(()=>{
    function handleResize(){ setIsMobile(window.innerWidth < 720); }
    handleResize();
    window.addEventListener('resize', handleResize);
    return ()=> window.removeEventListener('resize', handleResize);
  }, []);

  // Filtered list
  const filteredAutos = useMemo(()=>{
    if(!search) return autos;
    const q = search.toLowerCase();
    return autos.filter(a =>
      a.key.toLowerCase().includes(q) ||
      a.pattern.toLowerCase().includes(q) ||
      (a.flags||'').toLowerCase().includes(q) ||
      (Array.isArray(a.replies)? a.replies.join(' | ') : '').toLowerCase().includes(q)
    );
  }, [autos, search]);

  // Sort
  const sortedAutos = useMemo(()=>{
    const arr = [...filteredAutos];
    const { field, dir } = sort;
    if(!field) return arr;
    arr.sort((a,b)=>{
      let av = a[field];
      let bv = b[field];
      if(Array.isArray(av)) av = av.join(' ');
      if(Array.isArray(bv)) bv = bv.join(' ');
      if(typeof av === 'boolean') av = av?1:0;
      if(typeof bv === 'boolean') bv = bv?1:0;
      av = (av ?? '').toString().toLowerCase();
      bv = (bv ?? '').toString().toLowerCase();
      if(av < bv) return dir==='asc'? -1: 1;
      if(av > bv) return dir==='asc'? 1: -1;
      return 0;
    });
    return arr;
  }, [filteredAutos, sort]);

  // Pagination boundaries
  const totalPages = Math.max(1, Math.ceil(sortedAutos.length / pageSize));
  useEffect(()=>{ if(page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageAutos = useMemo(()=>{
    const start = (page-1)*pageSize;
    return sortedAutos.slice(start, start+pageSize);
  }, [sortedAutos, page, pageSize]);

  // Select all (filtered)
  const allFilteredKeys = useMemo(()=> filteredAutos.map(a=>a.key), [filteredAutos]);
  const selectedInFilterCount = useMemo(()=> allFilteredKeys.reduce((acc,k)=> acc + (selectedKeys.has(k)?1:0), 0), [allFilteredKeys, selectedKeys]);
  const allFilteredSelected = allFilteredKeys.length>0 && selectedInFilterCount === allFilteredKeys.length;
  const someFilteredSelected = selectedInFilterCount>0 && !allFilteredSelected;
  useEffect(()=>{ if(headerSelectRef.current) headerSelectRef.current.indeterminate = someFilteredSelected; }, [someFilteredSelected, allFilteredSelected]);

  function toggleSort(field){
    setSort(prev => {
      if(prev.field !== field) return { field, dir:'asc' };
      if(prev.dir === 'asc') return { field, dir:'desc' };
      return { field:null, dir:'asc' }; // third click removes sorting
    });
  }

  function toggleRowSelect(key){
    setSelectedKeys(prev => { const n = new Set(prev); if(n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  function headerToggleSelect(e){
    const checked = e.target.checked;
    setSelectedKeys(prev => {
      if(checked){ return new Set([...prev, ...allFilteredKeys]); }
      // remove all filtered keys
      const n = new Set(prev);
      allFilteredKeys.forEach(k=> n.delete(k));
      return n;
    });
  }
  function clearSelection(){ setSelectedKeys(new Set()); }
  function selectAllFiltered(){
    setSelectedKeys(new Set(allFilteredKeys));
  }
  async function bulkEnable(disable=false){
    const keys = Array.from(selectedKeys);
    if(!keys.length) return;
    for(const k of keys){ const item = autos.find(x=>x.key===k); if(!item) continue; try { await upsertAuto({ ...item, enabled: !disable }, selectedGuild); } catch {} }
    pushToast('success', disable? 'Disabled selected':'Enabled selected');
    refresh();
  }
  async function bulkDelete(){
    const keys = Array.from(selectedKeys);
    if(!keys.length) return;
    if(!window.confirm('Delete '+keys.length+' selected?')) return;
    for(const k of keys){ try { await deleteAuto(k, selectedGuild); } catch {} }
    pushToast('success','Deleted selected');
    refresh();
    clearSelection();
  }
  function editAutoByKey(k){ const item = autos.find(a=>a.key===k); if(item) openEditAuto(item); }
  function toggleEnabled(item, enabled){
    setAutos(prev => prev.map(p=> p.key===item.key ? { ...p, enabled } : p));
    upsertAuto({ ...item, enabled }, selectedGuild).catch(()=>refresh());
  }

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
                {!process.env.DISABLE_LEGACY_LOGIN && <button type="button" className="btn btn-link p-0 small" onClick={()=>setOauthMode(false)}>Use legacy admin login</button>}
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

  const autosContent = <div className="autos-section fade-in-soft autos-section-wrapper">
    <div className="auto-head mb-3">
      <div className="section-title">Auto Responses</div>
      <div className="auto-head-search">
        <input className="form-control form-control-sm search-input w-100" placeholder="Search..." value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} />
      </div>
      <div className="auto-head-actions">
        <button className="btn btn-sm btn-outline-light" type="button" onClick={()=>setShowRegexTester(s=>!s)}>{showRegexTester? 'Close Tester':'Regex Tester'}</button>
        <button className="btn btn-sm btn-brand" onClick={openNewAuto}>Add</button>
      </div>
    </div>
    {showRegexTester && <div className="card card-glass shadow-sm mb-3">
      <div className="card-body row g-3">
        <div className="col-md-4">
          <label className="form-label small mb-1">Pattern</label>
          <input className="form-control form-control-sm" placeholder="^hello" value={testerPattern} onChange={e=>setTesterPattern(e.target.value)} />
        </div>
        <div className="col-md-2 col-4">
          <label className="form-label small mb-1">Flags</label>
          <input className="form-control form-control-sm" placeholder="i" value={testerFlags} onChange={e=>setTesterFlags(e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label small mb-1">Sample Text (multi-line)</label>
          <textarea className="form-control form-control-sm" rows={2} value={testerSample} onChange={e=>setTesterSample(e.target.value)} placeholder={'hello world\nHi there'} />
        </div>
        <div className="col-12 d-flex gap-2">
          <button className="btn btn-sm btn-brand" type="button" onClick={runTester}>Run</button>
          <button className="btn btn-sm btn-outline-light" type="button" onClick={()=>{setTesterPattern('');setTesterSample('');setTesterResult(null);}}>Clear</button>
        </div>
        {testerResult && <div className="col-12 small">
          {testerResult.ok ? <div className="vstack gap-1">{testerResult.matches.map((m,i) => <div key={i} className={m.match? 'text-success':'text-muted'}>{m.match? '✓':'✗'} {m.line || <em>(empty)</em>}</div>)}</div> : <div className="text-danger">Regex error: {testerResult.error}</div>}
        </div>}
      </div>
    </div>}
    <div className="stat-cards mb-3">
      <div className="stat-card"><h6>Total</h6><div className="value">{autos.length}</div></div>
      <div className="stat-card"><h6>Enabled</h6><div className="value text-success">{totalEnabled}</div></div>
      <div className="stat-card"><h6>Disabled</h6><div className="value text-danger">{totalDisabled}</div></div>
    </div>
    <div className={"bulk-bar mb-2" + (isMobile? ' bulk-bar-mobile-sticky':'')}>
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <strong className="small">Selected: {selectedKeys.size}</strong>
        {!isMobile && <>
          <button className="btn btn-sm btn-outline-light" onClick={()=>bulkEnable(false)}>Enable</button>
          <button className="btn btn-sm btn-outline-light" onClick={()=>bulkEnable(true)}>Disable</button>
          <button className="btn btn-sm btn-outline-danger" onClick={bulkDelete}>Delete</button>
          <button className="btn btn-sm btn-outline-secondary" onClick={clearSelection} disabled={!selectedKeys.size}>Clear</button>
        </>}
        {isMobile && <>
          <button className="btn btn-sm btn-outline-light" onClick={selectAllFiltered} disabled={allFilteredSelected}>All</button>
          <button className="btn btn-sm btn-outline-light" onClick={()=>bulkEnable(false)} disabled={!selectedKeys.size}>On</button>
          <button className="btn btn-sm btn-outline-light" onClick={()=>bulkEnable(true)} disabled={!selectedKeys.size}>Off</button>
          <button className="btn btn-sm btn-outline-danger" onClick={bulkDelete} disabled={!selectedKeys.size}>Del</button>
          <button className="btn btn-sm btn-outline-secondary" onClick={clearSelection} disabled={!selectedKeys.size}>Clear</button>
        </>}
      </div>
      <div className="ms-auto d-flex align-items-center gap-2">
        <label className="small text-muted">Rows</label>
        <select className="form-select form-select-sm" style={{width:90}} value={pageSize} onChange={e=>{ setPageSize(parseInt(e.target.value)||15); setPage(1); }}>
          {[10,15,25,50,100].map(s=> <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
    {!isMobile && <div className="table-responsive table-modern-shell table-mobile-stack">
      <table className="table table-sm table-modern align-middle" style={{minWidth:'900px'}}>
        <thead>
          <tr>
            <th style={{width:34}}>
              <input ref={headerSelectRef} type="checkbox" aria-label="Select all filtered" checked={allFilteredSelected} onChange={headerToggleSelect} />
            </th>
            {['key','pattern','flags','replies','enabled'].map(col => {
              const labelMap = { key:'Key', pattern:'Pattern', flags:'Flags', replies:'Replies', enabled:'On' };
              const active = sort.field===col;
              const dir = active? sort.dir : null;
              return <th key={col} onClick={()=> toggleSort(col)} style={{cursor:'pointer'}}>
                {labelMap[col]} {active && (dir==='asc'? '▲':'▼')}
              </th>;
            })}
            <th style={{width:110}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pageAutos.map(a => {
            const replies = Array.isArray(a.replies)? a.replies.join(' | '):'';
            const matchHighlight = (()=>{ if(!testerPattern) return false; try { return new RegExp(testerPattern, testerFlags).test(a.pattern); } catch { return false; } })();
            const selected = selectedKeys.has(a.key);
            return <tr key={a.key} className={(a.enabled===false?'row-disabled ':'') + (matchHighlight? 'match-highlight ':'') + (selected? 'selected':'')}>
              <td data-label="Select"><input type="checkbox" className="form-check-input" checked={selected} onChange={()=>toggleRowSelect(a.key)} /></td>
              <td data-label="Key" className="text-primary" style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}>{a.key}</td>
              <td data-label="Pattern" style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}>{a.pattern}</td>
              <td data-label="Flags" style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}>{a.flags}</td>
              <td data-label="Replies" style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}><small className="text-muted">{replies}</small></td>
              <td data-label="On" className="text-center">
                <div className="form-check form-switch m-0 d-inline-flex">
                  <input className="form-check-input" type="checkbox" checked={a.enabled!==false} onChange={e=>toggleEnabled(a, e.target.checked)} />
                </div>
              </td>
              <td data-label="Actions">
                <div className="btn-group btn-group-sm">
                  <button className="btn btn-edit" onClick={()=>editAutoByKey(a.key)}>Edit</button>
                  <button className="btn btn-outline-danger" onClick={()=>removeAuto(a.key)}>Del</button>
                </div>
              </td>
            </tr>;
          })}
          {pageAutos.length===0 && <tr><td colSpan={7} className="text-center text-muted small py-3">No auto responses match your search.</td></tr>}
        </tbody>
      </table>
    </div>}
    {isMobile && <div className="auto-cards-list">
      {pageAutos.map(a => {
        const repliesArr = Array.isArray(a.replies)? a.replies:[];
        const replies = repliesArr.join(' | ');
        const selected = selectedKeys.has(a.key);
        const matchHighlight = (()=>{ if(!testerPattern) return false; try { return new RegExp(testerPattern, testerFlags).test(a.pattern); } catch { return false; } })();
        return <div key={a.key} className={'auto-card card-glass ' + (selected? ' sel':'') + (a.enabled===false? ' disabled':'') + (matchHighlight? ' match':'')}>
          <div className="auto-card-row top">
            <div className="form-check m-0">
              <input className="form-check-input" type="checkbox" checked={selected} onChange={()=>toggleRowSelect(a.key)} />
            </div>
            <button className="auto-key-btn" onClick={()=>editAutoByKey(a.key)}>{a.key}</button>
            <div className="ms-auto form-check form-switch m-0">
              <input className="form-check-input" type="checkbox" checked={a.enabled!==false} onChange={e=>toggleEnabled(a, e.target.checked)} />
            </div>
          </div>
          <div className="auto-card-row pattern" onClick={()=>editAutoByKey(a.key)}>
            <code className="pattern-text">{a.pattern}</code>
            {a.flags && <span className="flags-badge">{a.flags}</span>}
          </div>
          {replies && <div className="auto-card-row replies" onClick={()=>editAutoByKey(a.key)}>
            <div className="replies-preview">{replies.length>160? replies.slice(0,160)+'…': replies}</div>
          </div>}
          <div className="auto-card-row actions">
            <button className="btn btn-sm btn-edit" onClick={()=>editAutoByKey(a.key)}>Edit</button>
            <button className="btn btn-sm btn-outline-danger" onClick={()=>removeAuto(a.key)}>Del</button>
          </div>
        </div>;
      })}
      {pageAutos.length===0 && <div className="text-muted small py-3">No auto responses match your search.</div>}
    </div>}
    <div className="d-flex flex-wrap gap-2 align-items-center small mt-2">
      <div>Showing <strong>{pageAutos.length}</strong> of <strong>{filteredAutos.length}</strong> filtered (total {autos.length})</div>
      <div className="ms-auto d-flex gap-1 align-items-center">
        <button className="btn btn-sm btn-outline-secondary" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
        <span className="px-2">Page {page} / {totalPages}</span>
        <button className="btn btn-sm btn-outline-secondary" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button>
      </div>
    </div>
  </div>;

  const commandsContent = <div className="commands-section fade-in-soft">
    <div className="section-title">Commands</div>
    <div className="card card-glass shadow-sm mb-3"><div className="card-body small">
      Command management UI coming soon. You will be able to enable/disable commands and tweak permissions here.
    </div></div>
  </div>;

  const sectionMap = { overview: overviewContent, autos: autosContent, commands: commandsContent };

  const content = <div className="container-fluid py-4 fade-in">
    {guildBanner}
    <div className="dashboard-flex">
      <aside className={"dash-sidebar" + (sidebarCollapsed? ' collapsed':'') + (sidebarOpen? ' open':'')}>
        <div className="sidebar-inner">
        <div className="sidebar-top-controls d-flex justify-content-between align-items-center mb-2">
          <button type="button" className="btn btn-sm btn-outline-secondary d-lg-none" onClick={()=>setSidebarOpen(false)} title="Close menu"><i className="fa-solid fa-xmark"></i></button>
          <button type="button" className="btn btn-sm btn-outline-secondary d-none d-lg-inline-flex collapse-toggle" onClick={()=>setSidebarCollapsed(c=>!c)} title={sidebarCollapsed? 'Expand sidebar':'Collapse sidebar'}>
            <i className={'fa-solid ' + (sidebarCollapsed? 'fa-chevron-right':'fa-chevron-left')}></i>
          </button>
        </div>
        <div className="guild-switcher card-glass mb-3 p-2">
          <button type="button" className="guild-switcher-btn" onClick={()=>setView('guild')} title="Change server">
            {(() => { const g = guilds.find(x=>x.id===selectedGuild); const iconUrl = g?.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null; return <>
              <div className="gw-icon">{iconUrl ? <img src={iconUrl} alt={g?.name||'Guild'} /> : <span className="fallback">{(g?.name||'?').slice(0,2).toUpperCase()}</span>}</div>
              <div className="gw-meta">
                <div className="gw-name" title={g?.name}>{g?.name||'Select a Server'}</div>
                <div className="gw-action">Change server ▾</div>
              </div>
            </>; })()}
          </button>
        </div>
        <div className="dash-menu">
          <button type="button" onClick={()=>{setDashSection('overview'); setSidebarOpen(false);}} className={'dash-menu-item'+(dashSection==='overview'? ' active':'')}>
            <i className="fa-solid fa-gauge-high menu-ico"></i>
            <span className="menu-label">Overview</span>
          </button>
          <button type="button" onClick={()=>{setDashSection('autos'); setSidebarOpen(false);}} className={'dash-menu-item'+(dashSection==='autos'? ' active':'')}>
            <i className="fa-solid fa-bolt menu-ico"></i>
            <span className="menu-label">Auto Responses</span>
          </button>
          <button type="button" onClick={()=>{setDashSection('commands'); setSidebarOpen(false);}} className={'dash-menu-item'+(dashSection==='commands'? ' active':'')}>
            <i className="fa-solid fa-terminal menu-ico"></i>
            <span className="menu-label">Commands</span>
          </button>
        </div>
        <div className="dash-sidebar-footer mt-4">
          <button type="button" className="btn btn-sm btn-outline-danger w-100 logout-btn" onClick={()=>{ doLogout(); setSidebarOpen(false); }}>
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
  return <>
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
