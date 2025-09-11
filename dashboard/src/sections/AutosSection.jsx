import React, { useState, useEffect, useRef, useMemo } from 'react';
import LoadingSection from '../components/LoadingSection';
import { useI18n } from '../i18n';

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
  const { t } = useI18n();
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
    pushToast('success', disable ? t('autosSection.toasts.bulkDisabled') : t('autosSection.toasts.bulkEnabled'));
    refreshAnalytics && refreshAnalytics();
    refresh();
  }
  async function bulkDelete(){ const keys=[...selectedKeys]; if(!keys.length) return; if(!window.confirm(t('autosSection.confirm.deleteSelected', { count: keys.length }))) return; for(const k of keys){ try { await deleteAuto(k, selectedGuild); } catch {} } pushToast('success', t('autosSection.toasts.bulkDeleted')); refresh(); clearSelection(); }
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
  function removeAuto(key){ if(!window.confirm(t('autosSection.confirm.deleteOne', { key }))) return; const prev=autos; setAutos(autos.filter(a=>a.key!==key)); deleteAuto(key, selectedGuild).then(()=>pushToast('success', t('autosSection.toasts.deleted'))).catch(e=>{ pushToast('error', e.message); setAutos(prev); }); }
  function runTester(){ if(!testerPattern){ setTesterResult(null); return; } try { const reg=new RegExp(testerPattern, testerFlags); const lines=testerSample.split(/\r?\n/); const matches=lines.map(line=>({ line, match: reg.test(line)})); setTesterResult({ ok:true, matches }); } catch(e){ setTesterResult({ ok:false, error:e.message }); } }

  // Helper functions to extract display values
  function getDisplayPattern(auto) {
    // Use rawText if available (new format), otherwise try to extract from pattern (legacy)
    if (auto.rawText) {
      return auto.rawText;
    }
    
    // Legacy: try to extract from regex pattern
    if (auto.pattern.startsWith('^(?:') && auto.pattern.endsWith(')$')) {
      return auto.pattern.slice(4, -2);
    } else if (auto.pattern.startsWith('\\b(?:') && auto.pattern.endsWith(')\\b')) {
      return auto.pattern.slice(5, -3);
    }
    return auto.pattern;
  }

  function getDisplayMatchType(auto) {
    // Use stored matchType if available, otherwise detect from pattern
    const matchType = auto.matchType || detectMatchType(auto.pattern);
    switch(matchType) {
      case 'exact': return t('autosSection.modal.matchTypes.exact');
      case 'whole': return t('autosSection.modal.matchTypes.whole');
      default: return t('autosSection.modal.matchTypes.contains');
    }
  }

  function detectMatchType(pattern) {
    if (pattern.startsWith('^(?:') && pattern.endsWith(')$')) {
      return 'exact';
    } else if (pattern.startsWith('\\b(?:') && pattern.endsWith(')\\b')) {
      return 'whole';
    }
    return 'contains';
  }

  return (
    <LoadingSection
      loading={loading}
      title={t('autosSection.loadingTitle')}
      message={t('autosSection.loadingMessage')}
      className="autos-section fade-in-soft autos-section-wrapper position-relative"
    >
    <h5 className="mb-3">{t('autoResponses.title')}</h5>
    <div className="auto-head mb-3">
      <div className="section-title visually-hidden">{t('autoResponses.title')}</div>
      <div className="auto-head-search"><input className="form-control form-control-sm search-input w-100" placeholder={`${t('common.search')}...`} value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} /></div>
      <div className="auto-head-actions">
  <button className="btn btn-sm btn-regex d-inline-flex align-items-center gap-1" type="button" onClick={()=>setShowRegexTester(s=>!s)}>
          <i className="fa-solid fa-code" /> {showRegexTester? t('autosSection.regexTester.close') : t('autosSection.regexTester.open')}
        </button>
        <button className="btn btn-sm btn-brand d-inline-flex align-items-center gap-1" onClick={openNewAuto} title={t('autoResponses.addResponse')}>
          <i className="fa-solid fa-plus" /> {t('common.add')}
        </button>
      </div>
    </div>
  {showRegexTester && <div className="card card-glass shadow-sm mb-3"><div className="card-body row g-3"><div className="col-md-4"><label className="form-label small mb-1">{t('autosSection.regexTester.pattern')}</label><input className="form-control form-control-sm" placeholder="^hello" value={testerPattern} onChange={e=>setTesterPattern(e.target.value)} /></div><div className="col-md-2 col-4"><label className="form-label small mb-1">{t('autosSection.regexTester.flags')}</label><input className="form-control form-control-sm" placeholder="i" value={testerFlags} onChange={e=>setTesterFlags(e.target.value)} /></div><div className="col-md-6"><label className="form-label small mb-1">{t('autosSection.regexTester.sampleLabel')}</label><textarea className="form-control form-control-sm" rows={2} value={testerSample} onChange={e=>setTesterSample(e.target.value)} placeholder={t('autosSection.regexTester.samplePlaceholder')} /></div><div className="col-12 d-flex gap-2"><button className="btn btn-sm btn-brand d-inline-flex align-items-center gap-1" type="button" onClick={runTester}><i className="fa-solid fa-play" /> {t('autosSection.regexTester.run')}</button><button className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1" type="button" onClick={()=>{ setTesterPattern(''); setTesterSample(''); setTesterResult(null); }}><i className="fa-solid fa-eraser" /> {t('common.clear')}</button></div>{testerResult && <div className="col-12 small">{testerResult.ok ? <div className="vstack gap-1">{testerResult.matches.map((m,i)=><div key={i} className={m.match? 'text-success':'text-muted'}>{m.match? '✓':'✗'} {m.line || <em>({t('autosSection.regexTester.empty')})</em>}</div>)}</div> : <div className="text-danger">{t('autosSection.regexTester.error', { error: testerResult.error })}</div>}</div>}</div></div>}
    <div className="stat-cards mb-3"><div className="stat-card"><h6>{t('overview.total')}</h6><div className="value">{autos.length}</div></div><div className="stat-card"><h6>{t('overview.enabled')}</h6><div className="value text-success">{totalEnabled}</div></div><div className="stat-card"><h6>{t('overview.disabled')}</h6><div className="value text-danger">{totalDisabled}</div></div></div>
    <div className={"bulk-bar mb-2" + (isMobile? ' bulk-bar-mobile-sticky':'')}>
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <strong className="small">{t('autosSection.bulk.selectedCount', { count: selectedKeys.size })}</strong>
        {!isMobile && <>
          <button className="btn btn-sm btn-enable d-inline-flex align-items-center gap-1" onClick={()=>bulkEnable(false)} title={t('autosSection.bulk.enableSelected')}><i className="fa-solid fa-toggle-on" /> {t('autosSection.bulk.enable')}</button>
          <button className="btn btn-sm btn-disable d-inline-flex align-items-center gap-1" onClick={()=>bulkEnable(true)} disabled={!selectedKeys.size} title={t('autosSection.bulk.disableSelected')}><i className="fa-solid fa-toggle-off" /> {t('autosSection.bulk.disable')}</button>
          <button className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" onClick={bulkDelete} title={t('autosSection.bulk.deleteSelected')}><i className="fa-solid fa-trash" /> {t('common.delete')}</button>
          <button className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={clearSelection} disabled={!selectedKeys.size} title={t('autosSection.bulk.clearSelection')}><i className="fa-solid fa-xmark" /> {t('common.clear')}</button>
        </>}
        {isMobile && <>
          <button className="btn btn-sm btn-outline-light" onClick={selectAllFiltered} disabled={allFilteredSelected} title={t('autosSection.bulk.selectAllFiltered')}><i className="fa-solid fa-check-double" /></button>
          <button className="btn btn-sm btn-enable" onClick={()=>bulkEnable(false)} disabled={!selectedKeys.size} title={t('autosSection.bulk.enableSelected')}><i className="fa-solid fa-toggle-on" /></button>
            <button className="btn btn-sm btn-disable" onClick={()=>bulkEnable(true)} disabled={!selectedKeys.size} title={t('autosSection.bulk.disableSelected')}><i className="fa-solid fa-toggle-off" /></button>
          <button className="btn btn-sm btn-outline-danger" onClick={bulkDelete} disabled={!selectedKeys.size} title={t('autosSection.bulk.deleteSelected')}><i className="fa-solid fa-trash" /></button>
          <button className="btn btn-sm btn-outline-secondary" onClick={clearSelection} disabled={!selectedKeys.size} title={t('autosSection.bulk.clearSelection')}><i className="fa-solid fa-xmark" /></button>
        </>}
      </div>
      <div className="ms-auto d-flex align-items-center gap-2"><label className="small text-muted">{t('autosSection.pagination.rows')}</label><select className="form-select form-select-sm" style={{width:90}} value={pageSize} onChange={e=>{ setPageSize(parseInt(e.target.value)||15); setPage(1); }}>{[10,15,25,50,100].map(s=> <option key={s} value={s}>{s}</option>)}</select></div>
    </div>
  {!isMobile && <div className="table-responsive table-modern-shell table-mobile-stack"><table className="table table-sm table-modern align-middle" style={{minWidth:'1100px'}}><thead><tr><th style={{width:34}}><input ref={headerSelectRef} type="checkbox" aria-label={t('autosSection.bulk.selectAllFiltered')} checked={allFilteredSelected} onChange={headerToggleSelect} /></th>{['key','pattern','matchType','flags','replies','enabled'].map(col => { const labelMap={ key:t('autosSection.columns.key'), pattern:t('autosSection.columns.pattern'), matchType:t('autosSection.columns.matchType'), flags:t('autosSection.columns.flags'), replies:t('autosSection.columns.replies'), enabled:t('autosSection.columns.enabled')}; const active=sort.field===col; const dir=active? sort.dir:null; return <th key={col} onClick={()=> toggleSort(col)} style={{cursor:'pointer'}}>{labelMap[col]} {active && (dir==='asc'? '▲':'▼')}</th>; })}<th style={{width:110}}>{t('common.actions')}</th></tr></thead><tbody>{pageAutos.map(a => { const replies=Array.isArray(a.replies)? a.replies.join(' | '):''; const matchHighlight=(()=>{ if(!testerPattern) return false; try { return new RegExp(testerPattern, testerFlags).test(a.pattern); } catch { return false; } })(); const selected=selectedKeys.has(a.key); const displayPattern = getDisplayPattern(a); const displayMatchType = getDisplayMatchType(a); return <tr key={a.key} className={(a.enabled===false?'row-disabled ':'') + (matchHighlight? 'match-highlight ':'') + (selected? 'selected':'')}><td data-label={t('autosSection.columns.select')}><input type="checkbox" className="form-check-input" checked={selected} onChange={()=>toggleRowSelect(a.key)} /></td><td data-label={t('autosSection.columns.key')} className="text-primary" style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}>{a.key}</td><td data-label={t('autosSection.columns.pattern')} style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}>{displayPattern}</td><td data-label={t('autosSection.columns.matchType')} style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}><small className="text-muted">{displayMatchType}</small></td><td data-label={t('autosSection.columns.flags')} style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}>{a.flags}</td><td data-label={t('autosSection.columns.replies')} style={{cursor:'pointer'}} onClick={()=>editAutoByKey(a.key)}><small className="text-muted">{replies}</small></td><td data-label={t('autosSection.columns.enabled')} className="text-center"><div className="form-check form-switch m-0 d-inline-flex"><input className="form-check-input" type="checkbox" checked={a.enabled!==false} onChange={e=>toggleEnabled(a, e.target.checked)} /></div></td><td data-label={t('common.actions')}><div className="btn-group btn-group-sm"><button className="btn btn-edit d-inline-flex align-items-center gap-1" onClick={()=>editAutoByKey(a.key)} title={t('common.edit')}><i className="fa-solid fa-pen" /> {t('common.edit')}</button><button className="btn btn-outline-danger d-inline-flex align-items-center gap-1" onClick={()=>removeAuto(a.key)} title={t('common.delete')}><i className="fa-solid fa-trash" /> {t('common.delete')}</button></div></td></tr>; })}{pageAutos.length===0 && <tr><td colSpan={8} className="text-center text-muted small py-3">{t('autosSection.empty')}</td></tr>}</tbody></table></div>}
  {isMobile && <div className="auto-cards-list">{pageAutos.map(a => { const repliesArr=Array.isArray(a.replies)? a.replies:[]; const replies=repliesArr.join(' | '); const selected=selectedKeys.has(a.key); const matchHighlight=(()=>{ if(!testerPattern) return false; try { return new RegExp(testerPattern, testerFlags).test(a.pattern); } catch { return false; } })(); const displayPattern = getDisplayPattern(a); const displayMatchType = getDisplayMatchType(a); return <div key={a.key} className={'auto-card card-glass ' + (selected? ' sel':'') + (a.enabled===false? ' disabled':'') + (matchHighlight? ' match':'')}><div className="auto-card-row top"><div className="form-check m-0"><input className="form-check-input" type="checkbox" checked={selected} onChange={()=>toggleRowSelect(a.key)} /></div><button className="auto-key-btn" onClick={()=>editAutoByKey(a.key)}>{a.key}</button><div className="ms-auto form-check form-switch m-0"><input className="form-check-input" type="checkbox" checked={a.enabled!==false} onChange={e=>toggleEnabled(a, e.target.checked)} /></div></div><div className="auto-card-row pattern" onClick={()=>editAutoByKey(a.key)}><code className="pattern-text">{displayPattern}</code><span className="match-type-badge small text-muted ms-2">{displayMatchType}</span>{a.flags && <span className="flags-badge">{a.flags}</span>}</div>{replies && <div className="auto-card-row replies" onClick={()=>editAutoByKey(a.key)}><div className="replies-preview">{replies.length>160? replies.slice(0,160)+'…': replies}</div></div>}<div className="auto-card-row actions"><button className="btn btn-sm btn-edit d-inline-flex align-items-center gap-1" onClick={()=>editAutoByKey(a.key)} title={t('common.edit')}><i className="fa-solid fa-pen" /> {t('common.edit')}</button><button className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" onClick={()=>removeAuto(a.key)} title={t('common.delete')}><i className="fa-solid fa-trash" /> {t('common.delete')}</button></div></div>; })}{pageAutos.length===0 && <div className="text-muted small py-3">{t('autosSection.empty')}</div>}</div>}
  <div className="d-flex flex-wrap gap-2 align-items-center small mt-2"><div>{t('autosSection.pagination.showing', { count: pageAutos.length, filtered: filteredAutos.length, total: autos.length })}</div><div className="ms-auto d-flex gap-1 align-items-center"><button className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} title={t('autosSection.pagination.prevPage')}><i className="fa-solid fa-chevron-left" /></button><span className="px-2">{t('autosSection.pagination.page', { page, total: totalPages })}</span><button className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} title={t('autosSection.pagination.nextPage')}><i className="fa-solid fa-chevron-right" /></button></div></div>
    </LoadingSection>
  );
}
