import React from 'react';

export default function AutoResponseModal({ show, modalAuto, autos, setModalAuto, closeAutoModal, addOrUpdateAuto, dashSection }) {
  if(!show || dashSection !== 'autos') return null;
  return (
    <div className="modal d-block fade-in" tabIndex={-1} role="dialog" style={{background:'rgba(8,10,18,0.72)'}} onMouseDown={(e)=>{ if(e.target.classList.contains('modal')) closeAutoModal(); }}>
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
    </div>
  );
}
