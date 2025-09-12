import React from 'react';
import LoadingSection from '../components/LoadingSection';
import { useI18n } from '../i18n';

export default function PersonalizationSection({ personalization, personalizationLoading, personalizationDirty, resetPersonalization, savePersonalization, handleAvatarFile, renderStatusDot, setPersonalization, selectedGuild }) {
  const { t } = useI18n();
  const showOverlay = personalizationLoading;
  
  // Enable global settings only for specific guild
  // selectedGuild is a string (guild ID), not an object
  const isAdminGuild = selectedGuild === '935480450707759165';
  
  return (
    <LoadingSection
      loading={showOverlay}
      title={t('personalization.title')}
      message={t('personalization.subtitle')}
      className="fade-in-soft personalization-section-wrapper position-relative"
    >
    <div className="d-flex align-items-center gap-2 mb-3">
      <h5 className="mb-0">{t('personalization.title')}</h5>
      {personalizationDirty() && <span className="dirty-badge">{t('common.unsaved')}</span>}
    </div>
    {personalization && <div className="row g-4">
      <div className="col-lg-6">
        <div className="card card-glass shadow-sm"><div className="card-body vstack gap-3 position-relative">
          <div>
            <label className="form-label mb-1">{t('personalization.fields.nickname')}</label>
            <input className="form-control" value={personalization.nickname||''} onChange={e=>setPersonalization(p=>({...p,nickname:e.target.value}))} placeholder={t('personalization.fields.nicknamePlaceholder')} />
          </div>
          {isAdminGuild && (
            <>
              <div>
                <label className="form-label mb-1">{t('personalization.fields.activityType')}</label>
                <select className="form-select" value={personalization.activityType||''} onChange={e=>setPersonalization(p=>({...p,activityType:e.target.value||null}))}>
                  <option value="">{t('personalization.activityTypes.none')}</option>
                  <option value="PLAYING">{t('personalization.activityTypes.playing')}</option>
                  <option value="LISTENING">{t('personalization.activityTypes.listening')}</option>
                  <option value="WATCHING">{t('personalization.activityTypes.watching')}</option>
                  <option value="COMPETING">{t('personalization.activityTypes.competing')}</option>
                </select>
              </div>
              <div>
                <label className="form-label mb-1">{t('personalization.fields.activityText')}</label>
                <input className="form-control" value={personalization.activityText||''} onChange={e=>setPersonalization(p=>({...p,activityText:e.target.value}))} placeholder={t('personalization.fields.activityTextPlaceholder')} />
              </div>
              <div>
                <label className="form-label mb-1">{t('personalization.fields.status')}</label>
                <select className="form-select" value={personalization.status||''} onChange={e=>setPersonalization(p=>({...p,status:e.target.value||null}))}>
                  <option value="">{t('personalization.statuses.default')}</option>
                  <option value="online">{t('personalization.statuses.online')}</option>
                  <option value="idle">{t('personalization.statuses.idle')}</option>
                  <option value="dnd">{t('personalization.statuses.dnd')}</option>
                  <option value="invisible">{t('personalization.statuses.invisible')}</option>
                </select>
              </div>
              <div>
                <label className="form-label mb-1">{t('personalization.fields.avatar')}</label>
                <input className="form-control" type="file" accept="image/png,image/jpeg" onChange={handleAvatarFile} />
                {personalization.avatarBase64 && <div className="mt-2"><img src={personalization.avatarBase64} alt="avatar preview" style={{maxWidth:120,borderRadius:'12px'}} /></div>}
              </div>
            </>
          )}
          <div className="d-flex gap-2 justify-content-end">
            {personalizationDirty() && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetPersonalization}><i className="fa-solid fa-rotate-left me-1"/>{t('common.reset')}</button>}
            <button className="btn btn-brand" disabled={!personalizationDirty()} onClick={savePersonalization}><i className="fa-solid fa-floppy-disk me-2" />{t('common.save')}</button>
          </div>
          <div className="small text-muted">{t('personalization.fields.permissionsNote')}</div>
        </div></div>
      </div>
      <div className="col-lg-6">
        <div className="card card-glass shadow-sm h-100"><div className="card-body d-flex flex-column live-preview-card">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h6 className="mb-0 text-muted" style={{letterSpacing:'.5px'}}>{t('personalization.fields.preview')}</h6>
            {personalizationDirty() && <span className="badge bg-warning-subtle text-warning-emphasis">{t('common.unsaved')}</span>}
          </div>
          <div className="d-flex align-items-center mb-3">
            <div style={{width:72,height:72,borderRadius:'18px',overflow:'hidden',background:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
              {personalization.avatarBase64 ? <img src={personalization.avatarBase64} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <img src="/images.jpg" alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover'}} />}
              {personalization.status && <span style={{position:'absolute',bottom:6,right:6,width:18,height:18,borderRadius:'50%',background:'#1f2937',display:'flex',alignItems:'center',justifyContent:'center'}}>{renderStatusDot(personalization.status)}</span>}
            </div>
            <div className="ms-3 flex-grow-1">
              <div className="fw-semibold" style={{fontSize:'1.05rem'}}>{personalization.nickname?.trim() || t('personalization.fields.currentBotName')}</div>
              <div className="small text-muted">{personalization.status ? (t(`personalization.statuses.${personalization.status}`)) : t('personalization.fields.defaultStatus')}</div>
            </div>
          </div>
          {(personalization.activityType && personalization.activityText) ? <div className="mb-2 small"><strong>{t(`personalization.activityTypes.${(personalization.activityType||'').toLowerCase()}`)}</strong> {personalization.activityText}</div> : <div className="mb-2 small text-muted">{t('personalization.fields.noActivity')}</div>}
          <div className="mt-auto small text-muted" style={{opacity:.75}}>{t('personalization.fields.previewNote')}</div>
        </div></div>
      </div>
    </div>}
  {/* Standalone fallback removed in favor of full overlay */}
    </LoadingSection>
  );
}
