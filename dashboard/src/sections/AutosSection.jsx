import React, { useState, useEffect, useRef, useMemo } from 'react';

export default function AutosSection({
  autos,
  setAutos,
  totalEnabled,
  totalDisabled,
  selectedGuild,
  openEditAuto,
  openNewAuto,
  upsertAuto,
  deleteAuto,
  pushToast,
  refresh,
  refreshAnalytics,
  adjustAutosEnabled,
  loading
}) {
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [showRegexTester, setShowRegexTester] = useState(false);
  const [testerPattern, setTesterPattern] = useState('');
  const [testerFlags, setTesterFlags] = useState('i');
  const [testerSample, setTesterSample] = useState('');
  const [testerResult, setTesterResult] = useState(null);
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ field: 'key', dir: 'asc' });
  const headerSelectRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(()=>{ function handleResize(){ setIsMobile(window.innerWidth < 720); } handleResize(); window.addEventListener('resize', handleResize); return ()=> window.removeEventListener('resize', handleResize); }, []);

  if (loading) {
    return (
      <div className="autos-loading-overlay">
        <div className="loading-backdrop">
          <div className="loading-content">
            <div className="loading-spinner-container mb-4">
              <div className="loading-spinner">
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
              </div>
            </div>
            <div className="loading-text">
              <h5 className="mb-2 text-white">Loading Auto Responses</h5>
              <p className="text-white-50 mb-0">Fetching your server's auto response patterns and settings...</p>
            </div>
            <div className="loading-progress mt-4">
              <div className="progress-dots">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          </div>
        </div>
        
        <style jsx>{`
          .autos-loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease-out;
          }
          
          .loading-backdrop {
            background: linear-gradient(135deg, rgba(88, 101, 242, 0.1), rgba(114, 137, 218, 0.1));
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 3rem;
            text-align: center;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
          }
          
          .loading-spinner-container {
            display: flex;
            justify-content: center;
            align-items: center;
          }
          
          .loading-spinner {
            position: relative;
            width: 60px;
            height: 60px;
          }
          
          .spinner-ring {
            position: absolute;
            width: 60px;
            height: 60px;
            border: 3px solid transparent;
            border-radius: 50%;
            animation: spin 2s linear infinite;
          }
          
          .spinner-ring:nth-child(1) {
            border-top-color: #5865f2;
            animation-delay: 0s;
          }
          
          .spinner-ring:nth-child(2) {
            border-right-color: #7289da;
            animation-delay: 0.5s;
            width: 50px;
            height: 50px;
            top: 5px;
            left: 5px;
          }
          
          .spinner-ring:nth-child(3) {
            border-bottom-color: #99aab5;
            animation-delay: 1s;
            width: 40px;
            height: 40px;
            top: 10px;
            left: 10px;
          }
          
          .progress-dots {
            display: flex;
            justify-content: center;
            gap: 8px;
          }
          
          .dot {
            width: 8px;
            height: 8px;
            background: #5865f2;
            border-radius: 50%;
            animation: dotPulse 1.5s ease-in-out infinite;
          }
          
          .dot:nth-child(2) {
            animation-delay: 0.3s;
          }
          
          .dot:nth-child(3) {
            animation-delay: 0.6s;
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
          
          @keyframes dotPulse {
            0%, 100% {
              opacity: 0.4;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.2);
            }
          }
        `}</style>
      </div>
    );
  }

  const filteredAutos = useMemo(()=>{ if(!search) return autos; const q = search.toLowerCase(); return autos.filter(a => a.key.toLowerCase().includes(q) || a.pattern.toLowerCase().includes(q) || (a.flags||'').toLowerCase().includes(q) || (Array.isArray(a.replies)? a.replies.join(' | ') : '').toLowerCase().includes(q)); }, [autos, search]);
  const sortedAutos = useMemo(()=>{ const arr=[...filteredAutos]; const { field, dir } = sort; if(!field) return arr; arr.sort((a,b)=>{ let av=a[field]; let bv=b[field]; if(Array.isArray(av)) av=av.join(' '); if(Array.isArray(bv)) bv=bv.join(' '); if(typeof av==='boolean') av=av?1:0; if(typeof bv==='boolean') bv=bv?1:0; av=(av??'').toString().toLowerCase(); bv=(bv??'').toString().toLowerCase(); if(av<bv) return dir==='asc'?-1:1; if(av>bv) return dir==='asc'?1:-1; return 0; }); return arr; }, [filteredAutos, sort]);
  const totalPages = Math.max(1, Math.ceil(sortedAutos.length / pageSize));
  useEffect(()=>{ if(page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pageAutos = useMemo(()=>{ const start=(page-1)*pageSize; return sortedAutos.slice(start, start+pageSize); }, [sortedAutos, page, pageSize]);

  const allFilteredKeys = useMemo(()=> filteredAutos.map(a=>a.key), [filteredAutos]);
  const selectedInFilterCount = useMemo(()=> allFilteredKeys.reduce((acc,k)=> acc + (selectedKeys.has(k)?1:0), 0), [allFilteredKeys, selectedKeys]);
  const allFilteredSelected = allFilteredKeys.length>0 && selectedInFilterCount === allFilteredKeys.length;
  const someFilteredSelected = selectedInFilterCount>0 && !allFilteredSelected;
  useEffect(()=>{ if(headerSelectRef.current) headerSelectRef.current.indeterminate = someFilteredSelected; }, [someFilteredSelected, allFilteredSelected]);

  function toggleSort(field){ setSort(prev => prev.field!==field ? { field, dir:'asc'} : prev.dir==='asc'? { field, dir:'desc'} : { field:null, dir:'asc'}); }
  function toggleRowSelect(key){ setSelectedKeys(prev => { const n=new Set(prev); n.has(key)?n.delete(key):n.add(key); return n; }); }
  function headerToggleSelect(e){ const checked=e.target.checked; setSelectedKeys(prev => { if(checked) return new Set([...prev, ...allFilteredKeys]); const n=new Set(prev); allFilteredKeys.forEach(k=>n.delete(k)); return n; }); }
  function clearSelection(){ setSelectedKeys(new Set()); }
  function selectAllFiltered(){ setSelectedKeys(new Set(allFilteredKeys)); }
  async function bulkEnable(disable=false){
    const keys=[...selectedKeys]; if(!keys.length) return;
    // Optimistic state update
    setAutos(prev => prev.map(a => keys.includes(a.key)? { ...a, enabled: !disable }: a));
    // Adjust analytics counts optimistically
    if(adjustAutosEnabled){
      const affected = keys.map(k => autos.find(a=>a.key===k)).filter(Boolean);
      const delta = affected.reduce((acc,a)=>{
        const currentlyEnabled = a.enabled !== false;
        if(disable && currentlyEnabled) return acc - 1;
        if(!disable && !currentlyEnabled) return acc + 1;
        return acc;
      },0);
      if(delta) adjustAutosEnabled(delta);
    }
    for(const k of keys){
      const item=autos.find(x=>x.key===k); if(!item) continue;
      try { await upsertAuto({ ...item, enabled: !disable }, selectedGuild); }
      catch {/* ignore per-item; final refresh fallback below */}
    }
    pushToast('success', disable? 'Disabled selected':'Enabled selected');
    refreshAnalytics && refreshAnalytics();
    refresh();
  }
  async function bulkDelete(){ const keys=[...selectedKeys]; if(!keys.length) return; if(!window.confirm('Delete '+keys.length+' selected?')) return; for(const k of keys){ try { await deleteAuto(k, selectedGuild); } catch {} } pushToast('success','Deleted selected'); refresh(); clearSelection(); }
  function editAutoByKey(k){ const item=autos.find(a=>a.key===k); if(item) openEditAuto(item); }
  function toggleEnabled(item, enabled){
    const prevEnabled = item.enabled !== false;
    if(prevEnabled === enabled) return;
    setAutos(prev => prev.map(p=> p.key===item.key? { ...p, enabled }: p));
    if(adjustAutosEnabled){ adjustAutosEnabled(enabled ? 1 : -1); }
    upsertAuto({ ...item, enabled }, selectedGuild)
      .then(()=>{ refreshAnalytics && refreshAnalytics(); })
      .catch(()=>{ refresh(); adjustAutosEnabled && adjustAutosEnabled(enabled ? -1 : 1); });
  }
  function removeAuto(key){ if(!window.confirm('Delete '+key+'?')) return; const prev=autos; setAutos(autos.filter(a=>a.key!==key)); deleteAuto(key, selectedGuild).then(()=>pushToast('success','Deleted')).catch(e=>{ pushToast('error', e.message); setAutos(prev); }); }
  function runTester(){ if(!testerPattern){ setTesterResult(null); return; } try { const reg=new RegExp(testerPattern, testerFlags); const lines=testerSample.split(/\r?\n/); const matches=lines.map(line=>({ line, match: reg.test(line)})); setTesterResult({ ok:true, matches }); } catch(e){ setTesterResult({ ok:false, error:e.message }); } }

  return <div className="autos-section fade-in-soft autos-section-wrapper">
    <h5 className="mb-3">Auto Responses</h5>
    <div className="auto-head mb-3">
      <div className="section-title visually-hidden">Auto Responses</div>
      <div className="auto-head-search"><input className="form-control form-control-sm search-input w-100" placeholder="Search..." value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} /></div>
      <div className="auto-head-actions">
        <button className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1" type="button" onClick={()=>setShowRegexTester(s=>!s)}>
          <i className="fa-solid fa-code" /> {showRegexTester? 'Close Tester':'Regex Tester'}
        </button>
        <button className="btn btn-sm btn-brand d-inline-flex align-items-center gap-1" onClick={openNewAuto} title="Add new auto response">
          <i className="fa-solid fa-plus" /> Add
        </button>
      </div>
    </div>
  {showRegexTester && <div className="card card-glass shadow-sm mb-3"><div className="card-body row g-3"><div className="col-md-4"><label className="form-label small mb-1">Pattern</label><input className="form-control form-control-sm" placeholder="^hello" value={testerPattern} onChange={e=>setTesterPattern(e.target.value)} /></div><div className="col-md-2 col-4"><label className="form-label small mb-1">Flags</label><input className="form-control form-control-sm" placeholder="i" value={testerFlags} onChange={e=>setTesterFlags(e.target.value)} /></div><div className="col-md-6"><label className="form-label small mb-1">Sample Text (multi-line)</label><textarea className="form-control form-control-sm" rows={2} value={testerSample} onChange={e=>setTesterSample(e.target.value)} placeholder={'hello world\nHi there'} /></div><div className="col-12 d-flex gap-2"><button className="btn btn-sm btn-brand d-inline-flex align-items-center gap-1" type="button" onClick={runTester}><i className="fa-solid fa-play" /> Run</button><button className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1" type="button" onClick={()=>{ setTesterPattern(''); setTesterSample(''); setTesterResult(null); }}><i className="fa-solid fa-eraser" /> Clear</button></div>{testerResult && <div className="col-12 small">{testerResult.ok ? <div className="vstack gap-1">{testerResult.matches.map((m,i)=><div key={i} className={m.match? 'text-success':'text-muted'}>{m.match? '✓':'✗'} {m.line || <em>(empty)</em>}</div>)}</div> : <div className="text-danger">Regex error: {testerResult.error}</div>}</div>}</div></div>}
    <div className="stat-cards mb-3"><div className="stat-card"><h6>Total</h6><div className="value">{autos.length}</div></div><div className="stat-card"><h6>Enabled</h6><div className="value text-success">{totalEnabled}</div></div><div className="stat-card"><h6>Disabled</h6><div className="value text-danger">{totalDisabled}</div></div></div>
    <div className={"bulk-bar mb-2" + (isMobile? ' bulk-bar-mobile-sticky':'')}>
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <strong className="small">Selected: {selectedKeys.size}</strong>
        {!isMobile && <>
          <button className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1" onClick={()=>bulkEnable(false)} title="Enable selected"><i className="fa-solid fa-toggle-on" /> Enable</button>
          <button className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1" onClick={()=>bulkEnable(true)} disabled={!selectedKeys.size} title="Disable selected"><i className="fa-solid fa-toggle-off" /> Disable</button>
          <button className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" onClick={bulkDelete} title="Delete selected"><i className="fa-solid fa-trash" /> Delete</button>
          <button className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={clearSelection} disabled={!selectedKeys.size} title="Clear selection"><i className="fa-solid fa-xmark" /> Clear</button>
        </>}
        {isMobile && <>
          <button className="btn btn-sm btn-outline-light" onClick={selectAllFiltered} disabled={allFilteredSelected} title="Select all filtered"><i className="fa-solid fa-check-double" /></button>
          <button className="btn btn-sm btn-outline-light" onClick={()=>bulkEnable(false)} disabled={!selectedKeys.size} title="Enable selected"><i className="fa-solid fa-toggle-on" /></button>
            <button className="btn btn-sm btn-outline-light" onClick={()=>bulkEnable(true)} disabled={!selectedKeys.size} title="Disable selected"><i className="fa-solid fa-toggle-off" /></button>
          <button className="btn btn-sm btn-outline-danger" onClick={bulkDelete} disabled={!selectedKeys.size} title="Delete selected"><i className="fa-solid fa-trash" /></button>
          <button className="btn btn-sm btn-outline-secondary" onClick={clearSelection} disabled={!selectedKeys.size} title="Clear selection"><i className="fa-solid fa-xmark" /></button>
        </>}
      </div>
      <div className="ms-auto d-flex align-items-center gap-2"><label className="small text-muted">Rows</label><select className="form-select form-select-sm" style={{width:90}} value={pageSize} onChange={e=>{ setPageSize(parseInt(e.target.value)||15); setPage(1); }}>{[10,15,25,50,100].map(s=> <option key={s} value={s}>{s}</option>)}</select></div>
    </div>
  {!isMobile && <div className="table-responsive table-modern-shell table-mobile-stack"><table className="table table-sm table-modern align-middle" style={{minWidth:'900px'}}><thead><tr><th style={{width:34}}><input ref={headerSelectRef} type="checkbox" aria-label="Select all filtered" checked={allFilteredSelected} onChange={headerToggleSelect} /></th>{['key','pattern','flags','replies','enabled'].map(col => { const labelMap={ key:'Key', pattern:'Pattern', flags:'Flags', replies:'Replies', enabled:'On'}; const active=sort.field===col; const dir=active? sort.dir:null; return <th key={col} onClick={()=> toggleSort(col)} style={{cursor:'pointer'}}>{labelMap[col]} {active && (dir==='asc'? '▲':'▼')}</th>; })}<th style={{width:110}}>Actions</th></tr></thead><tbody>{pageAutos.map(a => { const replies=Array.isArray(a.replies)? a.replies.join(' | '):''; const matchHighlight=(()=>{ if(!testerPattern) return false; try { return new RegExp(testerPattern, testerFlags).test(a.pattern); } catch { return false; } })(); const selected=selectedKeys.has(a.key); return <tr key={a.key} className={(a.enabled===false?'row-disabled ':'') + (matchHighlight? 'match-highlight ':'') + (selected? 'selected':'')}><td data-label="Select"><input type="checkbox" className="form-check-input" checked={selected} onChange={()=>toggleRowSelect(a.key)} /></td><td data-label="Key" className="text-primary" style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}>{a.key}</td><td data-label="Pattern" style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}>{a.pattern}</td><td data-label="Flags" style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}>{a.flags}</td><td data-label="Replies" style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}><small className="text-muted">{replies}</small></td><td data-label="On" className="text-center"><div className="form-check form-switch m-0 d-inline-flex"><input className="form-check-input" type="checkbox" checked={a.enabled!==false} onChange={e=>toggleEnabled(a, e.target.checked)} /></div></td><td data-label="Actions"><div className="btn-group btn-group-sm"><button className="btn btn-edit d-inline-flex align-items-center gap-1" onClick={()=>editAutoByKey(a.key)} title="Edit"><i className="fa-solid fa-pen" /> Edit</button><button className="btn btn-outline-danger d-inline-flex align-items-center gap-1" onClick={()=>removeAuto(a.key)} title="Delete"><i className="fa-solid fa-trash" /> Del</button></div></td></tr>; })}{pageAutos.length===0 && <tr><td colSpan={7} className="text-center text-muted small py-3">No auto responses match your search.</td></tr>}</tbody></table></div>}
  {isMobile && <div className="auto-cards-list">{pageAutos.map(a => { const repliesArr=Array.isArray(a.replies)? a.replies:[]; const replies=repliesArr.join(' | '); const selected=selectedKeys.has(a.key); const matchHighlight=(()=>{ if(!testerPattern) return false; try { return new RegExp(testerPattern, testerFlags).test(a.pattern); } catch { return false; } })(); return <div key={a.key} className={'auto-card card-glass ' + (selected? ' sel':'') + (a.enabled===false? ' disabled':'') + (matchHighlight? ' match':'')}><div className="auto-card-row top"><div className="form-check m-0"><input className="form-check-input" type="checkbox" checked={selected} onChange={()=>toggleRowSelect(a.key)} /></div><button className="auto-key-btn" onClick={()=>editAutoByKey(a.key)}>{a.key}</button><div className="ms-auto form-check form-switch m-0"><input className="form-check-input" type="checkbox" checked={a.enabled!==false} onChange={e=>toggleEnabled(a, e.target.checked)} /></div></div><div className="auto-card-row pattern" onClick={()=>editAutoByKey(a.key)}><code className="pattern-text">{a.pattern}</code>{a.flags && <span className="flags-badge">{a.flags}</span>}</div>{replies && <div className="auto-card-row replies" onClick={()=>editAutoByKey(a.key)}><div className="replies-preview">{replies.length>160? replies.slice(0,160)+'…': replies}</div></div>}<div className="auto-card-row actions"><button className="btn btn-sm btn-edit d-inline-flex align-items-center gap-1" onClick={()=>editAutoByKey(a.key)} title="Edit"><i className="fa-solid fa-pen" /> Edit</button><button className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" onClick={()=>removeAuto(a.key)} title="Delete"><i className="fa-solid fa-trash" /> Del</button></div></div>; })}{pageAutos.length===0 && <div className="text-muted small py-3">No auto responses match your search.</div>}</div>}
  <div className="d-flex flex-wrap gap-2 align-items-center small mt-2"><div>Showing <strong>{pageAutos.length}</strong> of <strong>{filteredAutos.length}</strong> filtered (total {autos.length})</div><div className="ms-auto d-flex gap-1 align-items-center"><button className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} title="Previous page"><i className="fa-solid fa-chevron-left" /></button><span className="px-2">Page {page} / {totalPages}</span><button className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} title="Next page"><i className="fa-solid fa-chevron-right" /></button></div></div>
  </div>;
}
