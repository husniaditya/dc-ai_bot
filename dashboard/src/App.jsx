import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
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
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [page, setPage] = useState(1);
  const [showRegexTester, setShowRegexTester] = useState(false);
  const [testerPattern, setTesterPattern] = useState('');
  const [testerFlags, setTesterFlags] = useState('i');
  const [testerSample, setTesterSample] = useState('');
  const [testerResult, setTesterResult] = useState(null);
  // DataTable multi-column sorting (array of {col, dir})
  const [sortRules, setSortRules] = useState([{ col:'key', dir:'asc' }]);
  // Page size selector
  const [pageSize, setPageSize] = useState(15);
  const filteredAutos = autos.filter(a => {
    if(!search) return true;
    const s = search.toLowerCase();
    return (
      (a.key||'').toLowerCase().includes(s) ||
      (a.pattern||'').toLowerCase().includes(s) ||
      (Array.isArray(a.replies) && a.replies.some(r => typeof r === 'string' && r.toLowerCase().includes(s)))
    );
  });
  const sortedAutos = React.useMemo(()=>{
    if(!sortRules.length) return filteredAutos;
    const copy = [...filteredAutos];
    copy.sort((a,b)=>{
      for(const rule of sortRules){
        let av = a[rule.col];
        let bv = b[rule.col];
        if(rule.col==='enabled') { av = a.enabled!==false; bv = b.enabled!==false; }
        av = (av===undefined||av===null)? '' : av.toString().toLowerCase();
        bv = (bv===undefined||bv===null)? '' : bv.toString().toLowerCase();
        if(av < bv) return rule.dir==='asc'? -1:1;
        if(av > bv) return rule.dir==='asc'? 1:-1;
      }
      return 0;
    });
    return copy;
  }, [filteredAutos, sortRules]);
  useEffect(()=>{ setPage(1); }, [search, pageSize]);
  const totalPages = Math.max(1, Math.ceil(sortedAutos.length / pageSize));
  const pagedAutos = sortedAutos.slice((page-1)*pageSize, page*pageSize);
  function toggleSort(col, evt){
    setSortRules(prev => {
      const isShift = evt && (evt.shiftKey || evt.metaKey || evt.ctrlKey);
      const idx = prev.findIndex(r=>r.col===col);
      if(!isShift){
        if(idx===-1) return [{ col, dir:'asc' }];
        const existing = prev[idx];
        if(existing.dir==='asc') return [{ col, dir:'desc' }];
        if(existing.dir==='desc') return [{ col:'key', dir:'asc' }];
      }
      if(idx===-1) return [...prev, { col, dir:'asc' }];
      const copy = [...prev];
      if(copy[idx].dir==='asc') copy[idx] = { ...copy[idx], dir:'desc' };
      else { copy.splice(idx,1); }
      return copy.length? copy : [{ col:'key', dir:'asc' }];
    });
  }

  function getSortMeta(col){
    const idx = sortRules.findIndex(r=>r.col===col);
    if(idx===-1) return { dir:null, index:null };
    return { dir: sortRules[idx].dir, index: idx };
  }

  // simple stats
  const totalEnabled = autos.filter(a=>a.enabled!==false).length;
  const totalDisabled = autos.length - totalEnabled;

  function toggleSelect(key){
    setSelectedKeys(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }
  function selectAllPage(){
    setSelectedKeys(prev => {
      const n = new Set(prev);
      for (const a of pagedAutos) n.add(a.key);
      return n;
    });
  }
  function clearSelection(){ setSelectedKeys(new Set()); }
  async function bulkEnable(disable=false){
    const keys = Array.from(selectedKeys);
    if(!keys.length) return; 
    for (const k of keys){
      const item = autos.find(x=>x.key===k);
      if(!item) continue;
      try { await upsertAuto({ ...item, enabled: !disable }, selectedGuild); } catch {}
    }
    pushToast('success', disable? 'Disabled selected':'Enabled selected');
    refresh();
    clearSelection();
  }
  async function bulkDelete(){
    const keys = Array.from(selectedKeys);
    if(!keys.length) return;
    if(!window.confirm('Delete '+keys.length+' selected?')) return;
    for (const k of keys){ try { await deleteAuto(k, selectedGuild); } catch {} }
    pushToast('success','Deleted selected');
    refresh();
    clearSelection();
  }

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
  const guildBanner = <div className="card card-glass py-2 px-3 d-flex flex-row justify-content-between align-items-center mb-3 fade-in" style={{border:'1px solid rgba(255,255,255,0.15)'}}>
    <div>
      <span className="badge-soft me-2">Server</span>{resolvedGuildName}
    </div>
    <div className="d-flex gap-2">
      <button className="btn btn-sm btn-outline-light" onClick={()=>setView('guild')}>Change</button>
      <button className="btn btn-sm btn-outline-light" onClick={()=>refresh()}>Reload</button>
      <button onClick={doLogout} className="btn btn-sm btn-outline-danger">Logout</button>
    </div>
  </div>;

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

  const autosContent = <div className="autos-section fade-in-soft">
    <div className="auto-head mb-3">
      <div className="section-title">Auto Responses</div>
      <div className="auto-head-search">
        <input className="form-control form-control-sm search-input w-100" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} />
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
    {selectedKeys.size>0 ? <div className="bulk-bar mb-2">
      <strong className="small">{selectedKeys.size} selected</strong>
      <button className="btn btn-sm btn-outline-light" onClick={()=>bulkEnable(false)}>Enable</button>
      <button className="btn btn-sm btn-outline-light" onClick={()=>bulkEnable(true)}>Disable</button>
      <button className="btn btn-sm btn-outline-danger" onClick={bulkDelete}>Delete</button>
      <button className="btn btn-sm btn-outline-secondary" onClick={clearSelection}>Clear</button>
    </div> : <div className="bulk-bar-placeholder mb-2" />}
    <div className="table-responsive table-modern-shell dt-compact">
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2 dt-toolbar">
        <div className="dt-status small text-muted">{sortedAutos.length} items • Sort: {sortRules.map(r=>r.col+':' + r.dir).join(', ')}</div>
        <div className="d-flex align-items-center gap-2">
          <label className="small text-muted">Rows</label>
          <select className="form-select form-select-sm" style={{width:90}} value={pageSize} onChange={e=>setPageSize(parseInt(e.target.value)||15)}>
            {[10,15,25,50,100].map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <table className="table table-sm table-modern table-dt align-middle">
        <thead><tr>
          <th style={{width:28}}><input type="checkbox" title="Select page" onChange={e=> e.target.checked? selectAllPage(): clearSelection()} checked={pagedAutos.length>0 && pagedAutos.every(a=>selectedKeys.has(a.key))} /></th>
          {['key','pattern','flags','enabled'].map(col => {
            if(col==='enabled') return (
              <th key={col} className={'sortable '+(getSortMeta(col).dir? 'sort-'+getSortMeta(col).dir:'')} onClick={(e)=>toggleSort(col,e)}>
                On {getSortMeta(col).index!==null && <sup className="sort-order">{getSortMeta(col).index+1}</sup>}
              </th>
            );
            const label = col==='key'? 'Key' : (col==='pattern'? 'Pattern': 'Flags');
            const meta = getSortMeta(col);
            return <th key={col} className={'sortable '+(meta.dir? 'sort-'+meta.dir:'')} onClick={(e)=>toggleSort(col,e)}>
              {label} {meta.index!==null && <sup className="sort-order">{meta.index+1}</sup>}
            </th>;
          })}
          <th>Replies</th>
          <th style={{width:110}}>Actions</th>
        </tr></thead>
        <tbody>
          {pagedAutos.map(a => {
            const matchClass = testerResult && testerResult.ok && testerPattern ? (()=>{ try { return new RegExp(testerPattern, testerFlags).test(a.pattern)? 'match-highlight':'' } catch { return ''; } })() : '';
            const selected = selectedKeys.has(a.key);
            const disabled = a.enabled===false;
            const cls = [matchClass, selected? 'row-selected':'', disabled? 'row-disabled':''].filter(Boolean).join(' ');
            return <tr key={a.key} className={cls}>
            <td><input type="checkbox" checked={selectedKeys.has(a.key)} onChange={()=>toggleSelect(a.key)} /></td>
            <td onClick={()=>openEditAuto(a)} className="text-primary" style={{cursor:'pointer'}}>{a.key}</td>
            <td onClick={()=>openEditAuto(a)} style={{cursor:'pointer'}}>{a.pattern}</td>
            <td onClick={()=>openEditAuto(a)} style={{cursor:'pointer'}}>{a.flags}</td>
            <td onClick={()=>openEditAuto(a)} style={{cursor:'pointer'}}><small className="text-muted">{Array.isArray(a.replies)?a.replies.join(' | '):''}</small></td>
            <td className="text-center">
              <div className="form-check form-switch m-0 d-inline-flex">
                <input className="form-check-input" type="checkbox" checked={a.enabled!==false} onChange={(e)=>{
                  const updated = { ...a, enabled: e.target.checked };
                  setAutos(prev => prev.map(p => p.key===a.key ? updated : p));
                  upsertAuto({ key:a.key, pattern:a.pattern, flags:a.flags, replies:a.replies, enabled:e.target.checked }, selectedGuild).catch(()=>refresh());
                }} />
              </div>
            </td>
            <td>
              <div className="btn-group btn-group-sm">
                <button onClick={()=>openEditAuto(a)} className="btn btn-edit">Edit</button>
                <button onClick={()=>removeAuto(a.key)} className="btn btn-outline-danger">Del</button>
              </div>
            </td>
          </tr>})}
          {pagedAutos.length===0 && <tr><td colSpan={7} className="text-center text-muted">No matches</td></tr>}
        </tbody>
      </table>
      <div className="d-flex justify-content-between align-items-center mt-2 gap-2 pagination-bar flex-nowrap">
        <div className="small text-muted">Page {page} / {totalPages}</div>
        <div className="pagination-modern d-flex gap-1">
          <button className="btn btn-sm" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
          {Array.from({length: totalPages}).slice(0,6).map((_,i)=>{
            const p = i+1; return <button key={p} className={'btn btn-sm'+(p===page?' active':'')} onClick={()=>setPage(p)}>{p}</button>;
          })}
          {totalPages>6 && <button className="btn btn-sm" disabled>…</button>}
          <button className="btn btn-sm" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button>
        </div>
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
      <aside className="dash-sidebar">
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
          <button type="button" onClick={()=>setDashSection('overview')} className={'dash-menu-item'+(dashSection==='overview'? ' active':'')}>Overview</button>
          <button type="button" onClick={()=>setDashSection('autos')} className={'dash-menu-item'+(dashSection==='autos'? ' active':'')}>Auto Responses</button>
          <button type="button" onClick={()=>setDashSection('commands')} className={'dash-menu-item'+(dashSection==='commands'? ' active':'')}>Commands</button>
        </div>
        <div className="dash-sidebar-footer mt-4">
          <button type="button" className="btn btn-sm btn-outline-danger w-100 logout-btn" onClick={doLogout}>Logout</button>
        </div>
      </aside>
      <main className="dash-main">
        {sectionMap[dashSection]}
      </main>
    </div>
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
