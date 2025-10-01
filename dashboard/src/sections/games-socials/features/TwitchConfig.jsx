import React, { useState } from 'react';
import { resolveTwitchStreamer } from '../../../api';
import MentionTargetsPicker from '../components/MentionTargetsPicker';
import TemplatePreview from '../components/TemplatePreview';
import { TEMPLATE_PLACEHOLDERS } from '../constants';
import { useI18n } from '../../../i18n';

/**
 * TwitchConfig - Twitch integration configuration component
 */
export default function TwitchConfig({ 
  config, 
  onChange, 
  onSave, 
  discordChannels = [], 
  guildRoles = [], 
  guildId,
  pushToast,
  isSaving = false 
}) {
  const { t } = useI18n();
  const [newStreamerId, setNewStreamerId] = useState('');
  const [resolving, setResolving] = useState(false);
  const [editingStreamer, setEditingStreamer] = useState(null);

  if (!config) {
    return <div className="text-muted small">{t('gamesSocials.common.loadingConfig', { service: t('gamesSocials.services.twitch.label') })}</div>;
  }

  async function addStreamer() {
    const raw = newStreamerId.trim();
    if (!raw) return;
    
    let username = null;
    let resolvedName = null;
    setResolving(true);
    
    try {
      const r = await resolveTwitchStreamer(raw);
      username = r?.username || null;
      resolvedName = r?.displayName || null;
      if (!username) throw new Error('not resolved');
  pushToast && pushToast('success', t('gamesSocials.twitch.toasts.resolvedTo', { username }));
    } catch (e) {
  pushToast && pushToast('error', t('gamesSocials.twitch.toasts.resolveFailed'));
    } finally {
      setResolving(false);
    }

    if (username) {
      onChange({
        ...config,
        streamers: config.streamers.includes(username) ? config.streamers : [...config.streamers, username],
        streamerNames: resolvedName ? { 
          ...(config.streamerNames || {}), 
          [username]: resolvedName 
        } : (config.streamerNames || {})
      });
      setNewStreamerId('');
    }
  }

  function removeStreamer(username) {
    onChange({
      ...config,
      streamers: config.streamers.filter(x => x !== username)
    });
  }

  return (
    <>
      <div className="twitch-config-grid mt-2">
        {/* MAIN CONFIG */}
        <div className="twitch-config-block">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div className="small text-uppercase text-muted fw-semibold mb-1">{t('gamesSocials.common.announcement')}</div>
              <div className="form-check form-switch m-0">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  checked={config.enabled} 
                  onChange={e => onChange({ ...config, enabled: e.target.checked })} 
                />
                <label className="form-check-label ms-2">
                  {config.enabled ? t('common.enabled') : t('common.disabled')}
                </label>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">{t('gamesSocials.twitch.fields.announceChannel')}</label>
            <select 
              className="form-select form-select-sm" 
              value={config.announceChannelId || ''} 
              onChange={e => onChange({ ...config, announceChannelId: e.target.value || null })}
            >
              <option value="">{t('gamesSocials.common.select')}</option>
              {discordChannels.map(ch => 
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              )}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold d-flex align-items-center gap-2 mb-1">
              {t('gamesSocials.common.mentionTargets')} 
              {config.mentionTargets?.length ? (
                <span className="badge-soft" style={{fontSize: '.55rem'}}>
                  {config.mentionTargets.length}
                </span>
              ) : null}
            </label>
            <MentionTargetsPicker
              value={config.mentionTargets && config.mentionTargets.length ? config.mentionTargets : (config.mentionRoleId ? [config.mentionRoleId] : [])}
              roles={guildRoles}
              onChange={(list) => onChange({
                ...config,
                mentionTargets: list,
                mentionRoleId: (list.length === 1 && /^[0-9]{5,32}$/.test(list[0])) ? list[0] : null
              })}
            />
            <div className="form-text tiny text-muted mt-1">
              {t('gamesSocials.common.mentionHelper')}
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">{t('gamesSocials.common.intervalSec')}</label>
            <input 
              type="number" 
              min={60} 
              className="form-control form-control-sm" 
              style={{width: 110}} 
              value={config.intervalSec} 
              onChange={e => onChange({ 
                ...config, 
                intervalSec: Math.max(60, parseInt(e.target.value) || 300) 
              })} 
            />
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">{t('gamesSocials.common.embeds')}</label>
            <div className="form-check form-switch m-0">
              <input 
                className="form-check-input" 
                type="checkbox" 
                checked={config.embedEnabled !== false} 
                onChange={e => onChange({ ...config, embedEnabled: e.target.checked })} 
              />
              <label className="form-check-label ms-2">
                {config.embedEnabled !== false ? t('common.enabled') : t('gamesSocials.common.plain')}
              </label>
            </div>
          </div>
        </div>

        {/* GLOBAL TEMPLATES */}
        <div className="twitch-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">{t('gamesSocials.twitch.sections.globalTemplate')}</div>
          
          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">{t('gamesSocials.twitch.fields.liveStream')}</label>
            <textarea 
              rows={7} 
              className="form-control form-control-sm" 
              value={config.liveTemplate || ''} 
              onChange={e => onChange({ ...config, liveTemplate: e.target.value })}
            />
          </div>
          
          <div className="form-text tiny mt-2">
            {t('gamesSocials.common.placeholders')}: {TEMPLATE_PLACEHOLDERS.twitch.join(' ')}
          </div>
        </div>

        {/* TEMPLATE PREVIEW */}
        <div className="twitch-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">{t('gamesSocials.twitch.sections.templatePreview')}</div>
          
          <div className="mb-2">
            <TemplatePreview 
              template={config.liveTemplate} 
              size="lg" 
              type="twitch" 
              config={config} 
              guildRoles={guildRoles} 
            />
          </div>
          
          <div className="form-text tiny mt-2">
            {t('gamesSocials.common.placeholders')}: {TEMPLATE_PLACEHOLDERS.twitch.join(' ')}
          </div>
        </div>
      </div>

      {/* STREAMERS MANAGEMENT */}
      <div className="twitch-config-block mt-3">
        <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
          <div style={{flex: '1 1 260px'}}>
            <label className="form-label small fw-semibold mb-1">{t('gamesSocials.twitch.streamers.addLabel')}</label>
            <input 
              className="form-control form-control-sm" 
              placeholder={t('gamesSocials.twitch.streamers.addPlaceholder')} 
              value={newStreamerId} 
              onChange={e => setNewStreamerId(e.target.value)} 
              onKeyDown={e => { 
                if (e.key === 'Enter') { 
                  e.preventDefault(); 
                  addStreamer(); 
                } 
              }} 
            />
          </div>
          <button 
            type="button" 
            className="btn btn-sm btn-accent" 
            onClick={addStreamer} 
            disabled={!newStreamerId.trim() || resolving}
          >
            <i className="fa-solid fa-plus" /> {resolving ? t('gamesSocials.common.resolving') : t('common.add')}
          </button>
        </div>

        <ul className="twitch-channel-list list-unstyled m-0 p-0">
          {(!Array.isArray(config.streamers) || config.streamers.length === 0) && (
            <li className="text-muted small py-2">{t('gamesSocials.twitch.streamers.empty')}</li>
          )}
          
          {Array.isArray(config.streamers) && config.streamers.map(username => {
            const override = (config.streamerMessages || {})[username] || {};
            const name = (config.streamerNames || {})[username] || '';
            const isEditing = editingStreamer === username;
            
            return (
              <li key={username} className={"twitch-channel-item " + (isEditing ? 'editing' : '')}>
                <div className="twitch-channel-row">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <code className="small text-muted">{username}</code>
                      <input 
                        className="form-control form-control-sm flex-grow-1" 
                        placeholder={t('gamesSocials.common.namePlaceholder')} 
                        value={name} 
                        onChange={e => onChange({
                          ...config,
                          streamerNames: { 
                            ...(config.streamerNames || {}), 
                            [username]: e.target.value.slice(0, 120) 
                          }
                        })} 
                      />
                    </div>
                  </div>
                  
                  <div className="d-flex align-items-center gap-2 ms-2">
                    <button 
                      type="button" 
                      className="btn btn-icon btn-xs" 
                      title={t('gamesSocials.twitch.streamers.editTitle')} 
                      onClick={() => setEditingStreamer(p => p === username ? null : username)}
                    >
                      <i className="fa-solid fa-pen" />
                    </button>
                    
                    {(!name || name.trim() === '') && (
                      <button 
                        type="button" 
                        className="btn btn-icon btn-xs" 
                        title={t('gamesSocials.twitch.streamers.fetchTitle')} 
                        onClick={async () => {
                          try { 
                            setResolving(true); 
                            const r = await resolveTwitchStreamer(username); 
                            if (r?.username) { 
                              onChange({
                                ...config,
                                streamerNames: { 
                                  ...(config.streamerNames || {}), 
                                  [username]: r.displayName || config.streamerNames?.[username] || '' 
                                }
                              }); 
                            } 
                          } catch {} finally { 
                            setResolving(false); 
                          } 
                        }} 
                        disabled={resolving}
                      >
                        <i className="fa-solid fa-download" />
                      </button>
                    )}
                    
                    <button 
                      type="button" 
                      className="btn btn-icon btn-xs text-danger" 
                      title={t('gamesSocials.common.remove')} 
                      onClick={() => removeStreamer(username)}
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="twitch-channel-edit mt-2">
                    <div className="row g-2">
                      <div className="col-md-12">
                        <label className="form-label tiny fw-semibold mb-1">{t('gamesSocials.twitch.streamers.liveTemplate')}</label>
                        <textarea 
                          rows={2} 
                          className="form-control form-control-sm" 
                          value={override.liveTemplate || ''} 
                          onChange={e => onChange({
                            ...config,
                            streamerMessages: { 
                              ...(config.streamerMessages || {}), 
                              [username]: { 
                                ...(config.streamerMessages?.[username] || {}), 
                                liveTemplate: e.target.value 
                              } 
                            }
                          })}
                        />
                        <TemplatePreview 
                          template={override.liveTemplate || config.liveTemplate} 
                          channelId={username} 
                          type="twitch" 
                          config={config} 
                          guildRoles={guildRoles} 
                        />
                      </div>
                    </div>
                    
                    <div className="d-flex gap-2 mt-2">
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-secondary" 
                        onClick={() => {
                          const sm = { ...(config.streamerMessages || {}) }; 
                          delete sm[username]; 
                          onChange({ ...config, streamerMessages: sm }); 
                        }}
                      >
                        {t('gamesSocials.common.clearOverrides')}
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-light" 
                        onClick={() => setEditingStreamer(null)}
                      >
                        {t('common.close')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
