import React, { useState } from 'react';
import { 
  extractYouTubeChannelId, 
  resolveYouTubeChannel, 
  updateYouTubeConfig 
} from '../../../api';
import MentionTargetsPicker from '../components/MentionTargetsPicker';
import TemplatePreview from '../components/TemplatePreview';
import { TEMPLATE_PLACEHOLDERS } from '../constants';

/**
 * YouTubeConfig - YouTube integration configuration component
 */
export default function YouTubeConfig({ 
  config, 
  onChange, 
  onSave, 
  discordChannels = [], 
  guildRoles = [], 
  guildId,
  pushToast,
  isSaving = false 
}) {
  const [newChannelId, setNewChannelId] = useState('');
  const [resolving, setResolving] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);

  if (!config) {
    return <div className="text-muted small">Loading YouTube config…</div>;
  }

  async function addChannel() {
    const raw = newChannelId.trim();
    if (!raw) return;

    setResolving(true);
    try {
      const result = await extractYouTubeChannelId(raw);
      const cid = result.channelId;
      const resolvedName = result.channelName || null;

      if (config.channels.includes(cid)) {
        pushToast && pushToast('error', `Channel ${cid} is already being watched`);
        return;
      }

      // Show extraction info if URL was converted
      if (result.extracted) {
        pushToast && pushToast('success', `Extracted channel ID: ${cid}${resolvedName ? ` (${resolvedName})` : ''}`);
      } else if (resolvedName) {
        pushToast && pushToast('success', `Added channel: ${resolvedName}`);
      }

      onChange({
        ...config,
        channels: [...config.channels, cid],
        channelNames: resolvedName ? { ...(config.channelNames || {}), [cid]: resolvedName } : (config.channelNames || {})
      });
      setNewChannelId('');

    } catch (e) {
      console.error('Channel extraction error:', e);
      pushToast && pushToast('error', e.message || 'Failed to add channel');
    } finally {
      setResolving(false);
    }
  }

  function removeChannel(cid) {
    onChange({
      ...config,
      channels: config.channels.filter(x => x !== cid)
    });
  }

  return (
    <>
      <div className="yt-config-grid mt-2">
        {/* MAIN CONFIG */}
        <div className="yt-config-block">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div className="small text-uppercase text-muted fw-semibold mb-1">Announcement</div>
              <div className="form-check form-switch m-0">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  checked={config.enabled} 
                  onChange={e => onChange({ ...config, enabled: e.target.checked })} 
                />
                <label className="form-check-label ms-2">
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </label>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">Upload Announce Channel</label>
            <select 
              className="form-select form-select-sm" 
              value={config.uploadAnnounceChannelId || config.announceChannelId || ''} 
              onChange={e => onChange({ ...config, uploadAnnounceChannelId: e.target.value || null })}
            >
              <option value="">Select…</option>
              {discordChannels.map(ch => 
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              )}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">Live Announce Channel</label>
            <select 
              className="form-select form-select-sm" 
              value={config.liveAnnounceChannelId || config.announceChannelId || ''} 
              onChange={e => onChange({ ...config, liveAnnounceChannelId: e.target.value || null })}
            >
              <option value="">Select…</option>
              {discordChannels.map(ch => 
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              )}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold d-flex align-items-center gap-2 mb-1">
              Mention Targets 
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
              Enter to add • Backspace to remove • Order preserved
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">Interval (sec)</label>
            <input 
              type="number" 
              min={30} 
              className="form-control form-control-sm" 
              style={{width: 110}} 
              value={config.intervalSec} 
              onChange={e => onChange({ 
                ...config, 
                intervalSec: Math.max(30, parseInt(e.target.value) || 300) 
              })} 
            />
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">Embeds</label>
            <div className="form-check form-switch m-0">
              <input 
                className="form-check-input" 
                type="checkbox" 
                checked={config.embedEnabled !== false} 
                onChange={e => onChange({ ...config, embedEnabled: e.target.checked })} 
              />
              <label className="form-check-label ms-2">
                {config.embedEnabled !== false ? 'Enabled' : 'Plain'}
              </label>
            </div>
          </div>
        </div>

        {/* GLOBAL TEMPLATES */}
        <div className="yt-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">Regular Template</div>
          
          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">Upload</label>
            <textarea 
              rows={7} 
              className="form-control form-control-sm" 
              value={config.uploadTemplate || ''} 
              onChange={e => onChange({ ...config, uploadTemplate: e.target.value })}
            />
          </div>
          
          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">Live</label>
            <textarea 
              rows={7} 
              className="form-control form-control-sm" 
              value={config.liveTemplate || ''} 
              onChange={e => onChange({ ...config, liveTemplate: e.target.value })}
            />
          </div>
          
          <br />
          
          <div className="small text-uppercase text-muted fw-semibold mb-2">Member Template</div>
          
          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">Member Upload</label>
            <textarea 
              rows={7} 
              className="form-control form-control-sm" 
              value={config.memberOnlyUploadTemplate || ''} 
              onChange={e => onChange({ ...config, memberOnlyUploadTemplate: e.target.value })}
            />
          </div>
          
          <div>
            <label className="form-label small fw-semibold mb-1">Member Live</label>
            <textarea 
              rows={7} 
              className="form-control form-control-sm" 
              value={config.memberOnlyLiveTemplate || ''} 
              onChange={e => onChange({ ...config, memberOnlyLiveTemplate: e.target.value })}
            />
          </div>
          
          <div className="form-text tiny mt-2">
            Placeholders: {TEMPLATE_PLACEHOLDERS.youtube.join(' ')}
          </div>
        </div>

        {/* TEMPLATE PREVIEW */}
        <div className="yt-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">Regular Template Preview</div>
          
          <div className="mb-2">
            <div className="small fw-semibold mb-1">Regular Upload</div>
            <TemplatePreview 
              template={config.uploadTemplate} 
              size="lg" 
              type="youtube" 
              config={config} 
              guildRoles={guildRoles} 
            />
          </div>
          
          <div className="mb-2">
            <div className="small fw-semibold mb-1">Regular Live</div>
            <TemplatePreview 
              template={config.liveTemplate} 
              size="lg" 
              type="youtube" 
              config={config} 
              guildRoles={guildRoles} 
            />
          </div>
          
          <br />
          
          <div className="small text-uppercase text-muted fw-semibold mb-2">Member Template Preview</div>
          
          <div className="mb-2">
            <div className="small fw-semibold mb-1">Member Upload</div>
            <TemplatePreview 
              template={config.memberOnlyUploadTemplate} 
              size="lg" 
              type="youtube" 
              config={config} 
              guildRoles={guildRoles} 
            />
          </div>
          
          <div className="mb-2">
            <div className="small fw-semibold mb-1">Member Live</div>
            <TemplatePreview 
              template={config.memberOnlyLiveTemplate} 
              size="lg" 
              type="youtube" 
              config={config} 
              guildRoles={guildRoles} 
            />
          </div>
          
          <div className="form-text tiny mt-2">
            Placeholders: {TEMPLATE_PLACEHOLDERS.youtube.join(' ')}
          </div>
        </div>
      </div>

      {/* CHANNELS MANAGEMENT */}
      <div className="yt-config-block mt-3">
        <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
          <div style={{flex: '1 1 260px'}}>
            <label className="form-label small fw-semibold mb-1">Add Channel (URL)</label>
            <input 
              className="form-control form-control-sm" 
              placeholder="https://youtube.com/@handle" 
              value={newChannelId} 
              onChange={e => setNewChannelId(e.target.value)} 
              onKeyDown={e => { 
                if (e.key === 'Enter') { 
                  e.preventDefault(); 
                  addChannel(); 
                } 
              }} 
            />
          </div>
          <button 
            type="button" 
            className="btn btn-sm btn-accent" 
            onClick={addChannel} 
            disabled={!newChannelId.trim() || resolving}
          >
            <i className="fa-solid fa-plus" /> {resolving ? 'Resolving...' : 'Add'}
          </button>
        </div>

        <ul className="yt-channel-list list-unstyled m-0 p-0">
          {(!Array.isArray(config.channels) || config.channels.length === 0) && (
            <li className="text-muted small py-2">No channels added yet.</li>
          )}
          
          {Array.isArray(config.channels) && config.channels.map(cid => {
            const override = (config.channelMessages || {})[cid] || {};
            const name = (config.channelNames || {})[cid] || '';
            const isEditing = editingChannel === cid;
            
            return (
              <li key={cid} className={"yt-channel-item " + (isEditing ? 'editing' : '')}>
                <div className="yt-channel-row">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <code className="small text-muted">{cid}</code>
                      <input 
                        className="form-control form-control-sm flex-grow-1" 
                        placeholder="Name" 
                        value={name} 
                        onChange={e => onChange({
                          ...config,
                          channelNames: { 
                            ...(config.channelNames || {}), 
                            [cid]: e.target.value.slice(0, 120) 
                          }
                        })} 
                      />
                    </div>
                  </div>
                  
                  <div className="d-flex align-items-center gap-2 ms-2">
                    <button 
                      type="button" 
                      className="btn btn-icon btn-xs" 
                      title="Edit per-channel templates" 
                      onClick={() => setEditingChannel(p => p === cid ? null : cid)}
                    >
                      <i className="fa-solid fa-pen" />
                    </button>
                    
                    {(!name || name.trim() === '') && (
                      <button 
                        type="button" 
                        className="btn btn-icon btn-xs" 
                        title="Fetch channel name" 
                        onClick={async () => {
                          try { 
                            setResolving(true); 
                            const r = await resolveYouTubeChannel(cid); 
                            if (r?.channelId) { 
                              onChange({
                                ...config,
                                channelNames: { 
                                  ...(config.channelNames || {}), 
                                  [cid]: r.title || config.channelNames?.[cid] || '' 
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
                      title="Remove" 
                      onClick={() => removeChannel(cid)}
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="yt-channel-edit mt-2">
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label tiny fw-semibold mb-1">Upload Template</label>
                        <textarea 
                          rows={2} 
                          className="form-control form-control-sm" 
                          value={override.uploadTemplate || ''} 
                          onChange={e => onChange({
                            ...config,
                            channelMessages: { 
                              ...(config.channelMessages || {}), 
                              [cid]: { 
                                ...(config.channelMessages?.[cid] || {}), 
                                uploadTemplate: e.target.value 
                              } 
                            }
                          })}
                        />
                        <TemplatePreview 
                          template={override.uploadTemplate || config.uploadTemplate} 
                          channelId={cid} 
                          type="youtube" 
                          config={config} 
                          guildRoles={guildRoles} 
                        />
                      </div>
                      
                      <div className="col-md-6">
                        <label className="form-label tiny fw-semibold mb-1">Member Upload Template</label>
                        <textarea 
                          rows={2} 
                          className="form-control form-control-sm" 
                          value={override.memberOnlyUploadTemplate || ''} 
                          onChange={e => onChange({
                            ...config,
                            channelMessages: { 
                              ...(config.channelMessages || {}), 
                              [cid]: { 
                                ...(config.channelMessages?.[cid] || {}), 
                                memberOnlyUploadTemplate: e.target.value 
                              } 
                            }
                          })}
                        />
                        <TemplatePreview 
                          template={override.memberOnlyUploadTemplate || config.memberOnlyUploadTemplate} 
                          channelId={cid} 
                          type="youtube" 
                          config={config} 
                          guildRoles={guildRoles} 
                        />
                      </div>
                      
                      <div className="col-md-6">
                        <label className="form-label tiny fw-semibold mb-1">Live Template</label>
                        <textarea 
                          rows={2} 
                          className="form-control form-control-sm" 
                          value={override.liveTemplate || ''} 
                          onChange={e => onChange({
                            ...config,
                            channelMessages: { 
                              ...(config.channelMessages || {}), 
                              [cid]: { 
                                ...(config.channelMessages?.[cid] || {}), 
                                liveTemplate: e.target.value 
                              } 
                            }
                          })}
                        />
                        <TemplatePreview 
                          template={override.liveTemplate || config.liveTemplate} 
                          channelId={cid} 
                          type="youtube" 
                          config={config} 
                          guildRoles={guildRoles} 
                        />
                      </div>
                      
                      <div className="col-md-6">
                        <label className="form-label tiny fw-semibold mb-1">Member Live Template</label>
                        <textarea 
                          rows={2} 
                          className="form-control form-control-sm" 
                          value={override.memberOnlyLiveTemplate || ''} 
                          onChange={e => onChange({
                            ...config,
                            channelMessages: { 
                              ...(config.channelMessages || {}), 
                              [cid]: { 
                                ...(config.channelMessages?.[cid] || {}), 
                                memberOnlyLiveTemplate: e.target.value 
                              } 
                            }
                          })}
                        />
                        <TemplatePreview 
                          template={override.memberOnlyLiveTemplate || config.memberOnlyLiveTemplate} 
                          channelId={cid} 
                          type="youtube" 
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
                          const cm = { ...(config.channelMessages || {}) }; 
                          delete cm[cid]; 
                          onChange({ ...config, channelMessages: cm }); 
                        }}
                      >
                        Clear Overrides
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-light" 
                        onClick={() => setEditingChannel(null)}
                      >
                        Close
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
