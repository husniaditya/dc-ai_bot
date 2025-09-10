import React from 'react';
import { useI18n } from '../i18n';

export default function AutoResponseModal({ show, modalAuto, autos, setModalAuto, closeAutoModal, addOrUpdateAuto, dashSection }) {
  if(!show || dashSection !== 'autos') return null;
  const { t } = useI18n();
  return (
    <div className="modal d-block fade-in" tabIndex={-1} role="dialog" style={{background:'rgba(8,10,18,0.72)'}} onMouseDown={(e)=>{ if(e.target.classList.contains('modal')) closeAutoModal(); }}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document" onMouseDown={e=>e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title mb-0">{modalAuto.key ? t('autosSection.modal.titleEdit') : t('autosSection.modal.titleAdd')}</h5>
            <button type="button" className="btn-close" onClick={closeAutoModal}></button>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <label className="form-label mb-1">{t('autosSection.modal.key')} <span className="text-muted small">({t('autosSection.modal.keyHelpUnique')})</span></label>
                <input className="form-control" disabled={!!(autos.find(a=>a.key===modalAuto.key))} placeholder={t('autosSection.modal.keyPlaceholder')} value={modalAuto.key} onChange={e=>setModalAuto({...modalAuto, key:e.target.value})} />
                <div className="form-text">{t('autosSection.modal.keyNoSpaces')}</div>
              </div>
              <div className="col-12 col-md-5">
                <label className="form-label mb-1">{t('autosSection.modal.pattern')}</label>
                <input className="form-control" placeholder={t('autosSection.modal.patternPlaceholder')} value={modalAuto.pattern} onChange={e=>setModalAuto({...modalAuto, pattern:e.target.value})} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label mb-1">{t('autosSection.modal.flags')}</label>
                <input className="form-control" placeholder={t('autosSection.modal.flagsPlaceholder')} value={modalAuto.flags} onChange={e=>setModalAuto({...modalAuto, flags:e.target.value})} />
              </div>
              <div className="col-12">
                <label className="form-label mb-1">{t('autosSection.modal.replies')} <span className="text-muted small">({t('autosSection.modal.repliesHelp')})</span></label>
                <textarea className="form-control" rows={4} placeholder={t('autosSection.modal.repliesPlaceholder')} value={modalAuto.replies} onChange={e=>setModalAuto({...modalAuto, replies:e.target.value})} />
              </div>
              <div className="col-12">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="modalEnabledSwitch" checked={modalAuto.enabled} onChange={e=>setModalAuto({...modalAuto, enabled:e.target.checked})} />
                  <label className="form-check-label" htmlFor="modalEnabledSwitch">{t('autosSection.modal.enabled')}</label>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer py-2 d-flex justify-content-between">
            <div className="small text-muted">{t('autosSection.modal.footerNote')}</div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={closeAutoModal}>{t('common.cancel')}</button>
              <button type="button" className="btn btn-success" onClick={addOrUpdateAuto}>{t('common.save')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
