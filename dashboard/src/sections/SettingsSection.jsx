import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getSettings, updateSettings } from '../api';
import LoadingSection from '../components/LoadingSection';
import { useI18n } from '../i18n';

export default function SettingsSection({ guildId, pushToast }){
  const { t, changeLanguage, currentLanguage } = useI18n();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [original, setOriginal] = useState(null);
  const hasInitializedLanguage = useRef(false);
  const isLanguageChanging = useRef(false);

  useEffect(()=>{
    if(!guildId) return;
    setLoading(true);
    hasInitializedLanguage.current = false; // Reset language sync flag
    getSettings(guildId)
      .then(s => { 
        setSettings(s); 
        setOriginal(s);
        
        // Sync language immediately after loading settings, only once
        if (s.language && s.language !== currentLanguage && !hasInitializedLanguage.current) {
          isLanguageChanging.current = true;
          changeLanguage(s.language);
          hasInitializedLanguage.current = true;
          // Reset the flag after a brief delay
          setTimeout(() => {
            isLanguageChanging.current = false;
          }, 200);
        }
      })
      .catch(e => setError(e.message))
      .finally(()=> setLoading(false));
  }, [guildId, changeLanguage, currentLanguage]);

  function dirty(){
    if(!settings || !original) return false;
    const keys = ['autoReplyEnabled','autoReplyCooldownMs','language','timezone','hourFormat','embedColor','prefix','slashCommandsEnabled'];
    return keys.some(k => (settings[k]??'') !== (original[k]??''));
  }
  function reset(){ if(original) setSettings(original); }

  async function save(){
    if(!settings) return;
    setSaving(true);
    try {
      const updated = await updateSettings(settings, guildId);
      setSettings(updated); 
      setOriginal(updated);
      
      // Update dashboard language only if it's actually different and we haven't already synced it
      if (settings.language && settings.language !== currentLanguage) {
        isLanguageChanging.current = true;
        // Use setTimeout to prevent the blinking effect by updating language after the UI has updated
        setTimeout(() => {
          changeLanguage(settings.language);
          setTimeout(() => {
            isLanguageChanging.current = false;
          }, 200);
        }, 100);
      }
      
      pushToast && pushToast('success', t('settings.messages.saved'));
    } catch(e){ 
      setError(e.message); 
      pushToast && pushToast('error', t('settings.messages.saveFailed')); 
    }
    finally { setSaving(false); }
  }

  if(!guildId) return <div className="text-muted small">{t('settings.selectServerFirst')}</div>;
  
  const showOverlay = loading && !settings;
  return (
    <LoadingSection
      loading={showOverlay}
      title={t('settings.loadingTitle')}
      message={t('settings.loadingMessage')}
      className={`settings-section-wrapper fade-in-soft position-relative ${isLanguageChanging.current ? 'language-changing' : ''}`}
      style={{ minHeight: showOverlay ? '500px' : 'auto' }}
    >
    <div className="d-flex align-items-center gap-2 mb-3">
      <h5 className="mb-0">{t('settings.title')}</h5>
      {dirty() && <span className="dirty-badge">{t('common.unsaved')}</span>}
    </div>
    {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
    {settings && <div className="row g-4">
      <div className="col-lg-6">
        <div className="card card-glass shadow-sm"><div className="card-body vstack gap-3">
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="autoReplyEnabled" checked={settings.autoReplyEnabled} onChange={e=>setSettings(s=>({...s,autoReplyEnabled:e.target.checked}))} />
            <label className="form-check-label" htmlFor="autoReplyEnabled">{t('settings.autoReply.enabled')}</label>
          </div>
          <div>
            <label className="form-label mb-1">{t('settings.autoReply.cooldown')}</label>
            <input type="number" className="form-control" value={settings.autoReplyCooldownMs} onChange={e=>setSettings(s=>({...s,autoReplyCooldownMs:e.target.value}))} />
          </div>
          <div className="row g-3">
            <div className="col-6">
              <label className="form-label mb-1">{t('settings.language.label')}</label>
              <select className="form-select" value={settings.language||'en'} onChange={e=>setSettings(s=>({...s,language:e.target.value}))}>
                <option value="en">{t('languages.en')}</option>
                <option value="id">{t('languages.id')}</option>
                <option value="es">{t('languages.es')}</option>
                <option value="fr">{t('languages.fr')}</option>
                <option value="de">{t('languages.de')}</option>
                <option value="ja">{t('languages.ja')}</option>
              </select>
            </div>
            <div className="col-6">
              <label className="form-label mb-1">{t('settings.hourFormat.label')}</label>
              <select className="form-select" value={settings.hourFormat||24} onChange={e=>setSettings(s=>({...s,hourFormat:parseInt(e.target.value,10)}))}>
                <option value={24}>{t('settings.hourFormat.24hour')}</option>
                <option value={12}>{t('settings.hourFormat.12hour')}</option>
              </select>
            </div>
          </div>
            <TimezoneSelect value={settings.timezone||'UTC'} onChange={tz=>setSettings(s=>({...s, timezone: tz}))} />
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="slashEnabled" checked={settings.slashCommandsEnabled!==false} onChange={e=>setSettings(s=>({...s,slashCommandsEnabled:e.target.checked}))} />
            <label className="form-check-label" htmlFor="slashEnabled">{t('settings.slashCommands.enabled')}</label>
          </div>
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!dirty()||saving} onClick={reset}><i className="fa-solid fa-rotate-left me-1"/>{t('common.reset')}</button>
            <button type="button" className="btn btn-brand" disabled={!dirty()||saving} onClick={save}>{saving? <><span className="spinner-border spinner-border-sm me-2"/>{t('common.saving')}</> : <><i className="fa-solid fa-floppy-disk me-2"/>{t('common.save')}</>}</button>
          </div>
          <div className="small text-muted">{t('settings.language.help')}</div>
          {settings.language !== currentLanguage && (
            <div className="alert alert-info py-2 mt-2 mb-0">
              <i className="fa-solid fa-info-circle me-2"></i>
              {t('settings.language.changeNote')}
            </div>
          )}
        </div></div>
      </div>
      <div className="col-lg-6">
        <div className="card card-glass shadow-sm h-100"><div className="card-body small d-flex flex-column">
          <h6 className="text-muted mb-2" style={{letterSpacing:'.5px'}}>{t('settings.preview.title')}</h6>
          <div className="mb-2">{t('settings.preview.sampleTimestamp', { timestamp: formatSampleDate(settings) })}</div>
          <div className="mt-auto text-muted" style={{opacity:.75}}>{t('settings.preview.help')}</div>
        </div></div>
      </div>
    </div>}
    </LoadingSection>
  );
}

function formatSampleDate(s){
  try {
    const d = new Date('2025-01-05T16:34:00Z');
    const tz = s.timezone || 'UTC';
    const opts = { hour12: s.hourFormat===12, timeZone: tz, year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' };
    return new Intl.DateTimeFormat(s.language||'en', opts).format(d);
  } catch { return 'Sample date'; }
}

function TimezoneSelect({ value, onChange }){
  const { t } = useI18n();
  const zones = useMemo(()=>{
    let list = [];
    try { if (Intl.supportedValuesOf) list = Intl.supportedValuesOf('timeZone'); } catch {}
    if(!list || list.length===0){
      list = [ 'UTC','Etc/UTC','America/Los_Angeles','America/Denver','America/Phoenix','America/Chicago','America/New_York','America/Sao_Paulo','Europe/London','Europe/Paris','Europe/Berlin','Europe/Moscow','Africa/Johannesburg','Asia/Dubai','Asia/Kolkata','Asia/Jakarta','Asia/Bangkok','Asia/Shanghai','Asia/Singapore','Asia/Seoul','Asia/Tokyo','Australia/Sydney','Pacific/Auckland' ];
    }
    return Array.from(new Set(list));
  }, []);
  const computeOffset = (tz) => {
    try {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12:false, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
      const parts = fmt.formatToParts(now).reduce((acc,p)=>{ if(p.type!=='literal') acc[p.type]=p.value; return acc; }, {});
      const y = parseInt(parts.year,10);
      const m = parseInt(parts.month,10);
      const d = parseInt(parts.day,10);
      const h = parseInt(parts.hour,10);
      const min = parseInt(parts.minute,10);
      const tzAsUTCms = Date.UTC(y, m-1, d, h, min);
      const nowUtcMs = now.getTime();
      let offsetMinutes = Math.round((tzAsUTCms - nowUtcMs)/60000);
      if (offsetMinutes < -14*60 || offsetMinutes > 14*60) offsetMinutes = 0;
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const abs = Math.abs(offsetMinutes);
      const hh = String(Math.floor(abs/60)).padStart(2,'0');
      const mm = String(abs % 60).padStart(2,'0');
      return { minutes: offsetMinutes, str: `UTC${sign}${hh}:${mm}` };
    } catch { return { minutes:0, str:'UTC+00:00' }; }
  };
  const items = useMemo(()=>{
    return zones.map(z => {
      const off = computeOffset(z);
      const minutes = off.minutes;
      const sign = minutes >= 0 ? '+' : '-';
      const abs = Math.abs(minutes);
      const hh = Math.floor(abs/60);
      const mm = abs % 60;
      const gmtShort = `GMT${sign}${hh}${mm? ':'+String(mm).padStart(2,'0'):''}`;
      return { zone:z, offsetMinutes: minutes, offsetLabel: off.str, gmtShort };
    }).sort((a,b)=> a.offsetMinutes === b.offsetMinutes ? a.zone.localeCompare(b.zone) : a.offsetMinutes - b.offsetMinutes);
  }, [zones]);
  function handleInput(e){
    const entered = e.target.value.trim();
    if (items.find(it => it.zone.toLowerCase() === entered.toLowerCase())) {
      onChange && onChange(items.find(it => it.zone.toLowerCase() === entered.toLowerCase()).zone);
    }
  }
  const datalistId = 'tz-datalist';
  const currentLabel = (()=>{
    const it = items.find(i=>i.zone===value);
    return it ? `[${it.offsetLabel}] ${it.zone} (${it.gmtShort})` : value || '';
  })();
  return <div>
    <label className="form-label mb-1">{t('settings.timezone.label')}</label>
    <input
      list={datalistId}
      className="form-control"
      defaultValue={value}
      placeholder={t('settings.timezone.placeholder')}
      onChange={handleInput}
      onBlur={handleInput}
    />
    <datalist id={datalistId}>
      {items.map(it => <option key={it.zone} value={it.zone} label={`[${it.offsetLabel}] ${it.zone} (${it.gmtShort})`}>{`[${it.offsetLabel}] ${it.zone} (${it.gmtShort})`}</option>)}
    </datalist>
    <div className="form-text">{t('settings.timezone.help', { value: currentLabel })}</div>
  </div>;
}
