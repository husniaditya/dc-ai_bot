import React from 'react';
import LoadingOverlay from '../components/LoadingOverlay';

export default function PersonalizationSection({ personalization, personalizationLoading, personalizationDirty, resetPersonalization, savePersonalization, handleAvatarFile, renderStatusDot, setPersonalization }) {
  const showOverlay = personalizationLoading;
  return <div className="fade-in-soft personalization-section-wrapper position-relative">
    {showOverlay && (
      <LoadingOverlay 
        title="Loading Bot Personalization"
        message="Fetching your bot's appearance and activity settings..."
        fullHeight={false}
      />
    )}
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
        </div></div>
      </div>
      <div className="col-lg-6">
        <div className="card card-glass shadow-sm h-100"><div className="card-body d-flex flex-column live-preview-card">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h6 className="mb-0 text-muted" style={{letterSpacing:'.5px'}}>Live Preview</h6>
            {personalizationDirty() && <span className="badge bg-warning-subtle text-warning-emphasis">Unsaved</span>}
          </div>
          <div className="d-flex align-items-center mb-3">
            <div style={{width:72,height:72,borderRadius:'18px',overflow:'hidden',background:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
              {personalization.avatarBase64 ? <img src={personalization.avatarBase64} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <img src="/images.jpg" alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}} />}
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
  {/* Standalone fallback removed in favor of full overlay */}
  </div>;
}
