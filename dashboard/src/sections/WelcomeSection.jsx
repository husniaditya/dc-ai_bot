import React from 'react';

export default function WelcomeSection({ welcomeCfg, welcomeChannels, welcomeDirty, resetWelcome, saveWelcome, welcomeLoading, resolvedGuildName, setWelcomeCfg }) {
  function substitutedPreview() {
    const sampleUser='@NewUser';
    const guildName = resolvedGuildName || '{server}';
    const msgRaw = (welcomeCfg.messageText||'').trim() || 'Welcome {user} to {server}!';
    return msgRaw.replace(/\{user\}/g, sampleUser).replace(/\{server\}/g, guildName);
  }
  return <div className="fade-in-soft welcome-section-wrapper position-relative">
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
      <div className="col-lg-5">
        <div className="card card-glass shadow-sm h-100"><div className="card-body d-flex flex-column live-preview-card">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h6 className="mb-0 text-muted" style={{letterSpacing:'.5px'}}>Live Preview</h6>
            {welcomeDirty() && <span className="badge bg-warning-subtle text-warning-emphasis">Unsaved</span>}
          </div>
          {welcomeCfg.messageType==='embed' ? <div className="welcome-preview-embed" style={{background:'rgba(255,255,255,0.04)',borderRadius:'12px',padding:'12px 14px',position:'relative',border:'1px solid rgba(255,255,255,0.08)'}}>
            <div style={{position:'absolute',left:0,top:0,bottom:0,width:4,background:'var(--accent,#5865f2)',borderTopLeftRadius:12,borderBottomLeftRadius:12}}></div>
            <div className="small" style={{whiteSpace:'pre-wrap'}}>{substitutedPreview()}</div>
            {welcomeCfg.cardEnabled && <div className="mt-3 d-flex align-items-center gap-2 small text-muted" style={{opacity:.85}}>
              <div style={{width:40,height:40,borderRadius:'8px',background:'linear-gradient(135deg,#5865f2,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600}}>CM</div>
              <span>Welcome card thumbnail</span>
            </div>}
          </div> : <div className="welcome-preview-text" style={{background:'rgba(255,255,255,0.04)',borderRadius:'12px',padding:'12px 14px',border:'1px solid rgba(255,255,255,0.08)'}}>
            <span style={{whiteSpace:'pre-wrap'}}>{substitutedPreview()}</span>
            {welcomeCfg.cardEnabled && <div className="mt-2 small text-muted">(Card thumbnail enabled)</div>}
          </div>}
          <div className="mt-auto small text-muted" style={{opacity:.75}}>Preview updates instantly. Save to apply to real join events.</div>
        </div></div>
      </div>
    </div>}
    {!welcomeCfg && welcomeLoading && <div className="welcome-loading-standalone">
      <div className="spinner-border text-light" role="status" style={{width:'2.75rem', height:'2.75rem'}}><span className="visually-hidden">Loading…</span></div>
      <div className="mt-3 small text-muted">Loading welcome settings…</div>
    </div>}
  </div>;
}
