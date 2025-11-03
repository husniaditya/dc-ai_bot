import React, { useState } from 'react';
import MentionTargetsPicker from '../components/MentionTargetsPicker';
import TemplatePreview from '../components/TemplatePreview';
import { TEMPLATE_PLACEHOLDERS } from '../constants';
import { useI18n } from '../../../i18n';
import { authFetch } from '../../../api';

// ClashOfClansConfig - Clash of Clans integration configuration component
export default function ClashOfClansConfig({
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
  const [newClanTag, setNewClanTag] = useState('');
  const [resolving, setResolving] = useState(false);
  const [editingClan, setEditingClan] = useState(null);

  // Function to fetch clan name from API
  async function fetchClanName(clanTag) {
    try {
      const clanData = await authFetch(`/api/clashofclans/clan/${clanTag}`);
      return clanData?.name || `Clan #${clanTag}`;
    } catch (error) {
      console.error('Failed to fetch clan name:', error);
      // Use fallback name on any error (network, 404, etc.)
      return `Clan #${clanTag}`;
    }
  }

  if (!config) {
    return (
      <div className="text-muted small">
        {t('gamesSocials.common.loadingConfig', { service: t('gamesSocials.services.clashofclans.label') })}
      </div>
    );
  }

  async function addClan() {
    const rawTag = newClanTag.trim();
    if (!rawTag) return;

    // Clean clan tag - remove # if present and validate format
    const cleanTag = rawTag.replace(/^#/, '').toUpperCase();
    
    if (!/^[0289PYLQGRJCUV]+$/.test(cleanTag)) {
      pushToast && pushToast('error', t('gamesSocials.clashofclans.toasts.invalidTag'));
      return;
    }

    if (config.clans.includes(cleanTag)) {
      pushToast && pushToast('error', t('gamesSocials.clashofclans.toasts.alreadyTracking', { tag: cleanTag }));
      return;
    }

    setResolving(true);
    try {
      // Fetch clan name from API
      const clanName = await fetchClanName(cleanTag);
      
      // Add clan with fetched name
      const updatedClans = [...config.clans, cleanTag];
      const updatedClanNames = { ...config.clanNames, [cleanTag]: clanName };
      
      // If this is the first clan, set it as the primary clan tag and name
      const isFirstClan = config.clans.length === 0;
      
      onChange(prev => ({
        ...prev,
        clans: updatedClans,
        clanNames: updatedClanNames,
        // Set primary clan tag and name if this is the first clan
        ...(isFirstClan && {
          clanTag: cleanTag,
          clanName: clanName
        })
      }));
      
      setNewClanTag('');
      pushToast && pushToast('success', t('gamesSocials.clashofclans.toasts.added', { tag: cleanTag }));
    } catch (error) {
      pushToast && pushToast('error', t('gamesSocials.clashofclans.toasts.addFailed'));
    } finally {
      setResolving(false);
    }
  }

  function removeClan(clanTag) {
    const updatedClans = config.clans.filter(tag => tag !== clanTag);
    const updatedMessages = { ...config.clanMessages };
    const updatedNames = { ...config.clanNames };
    
    delete updatedMessages[clanTag];
    delete updatedNames[clanTag];

    // If removing the primary clan, update primary clan tag/name
    const wasPrimaryClan = config.clanTag === clanTag;
    const newPrimaryClan = updatedClans.length > 0 ? updatedClans[0] : '';
    const newPrimaryClanName = newPrimaryClan ? (updatedNames[newPrimaryClan] || `Clan #${newPrimaryClan}`) : '';

    onChange(prev => ({
      ...prev,
      clans: updatedClans,
      clanMessages: updatedMessages,
      clanNames: updatedNames,
      // Update primary clan if needed
      ...(wasPrimaryClan && {
        clanTag: newPrimaryClan,
        clanName: newPrimaryClanName
      })
    }));
  }

  function updateClanName(clanTag, name) {
    // Update clan names mapping
    const updatedClanNames = {
      ...config.clanNames,
      [clanTag]: name
    };

    // If this is the primary clan, also update the primary clan name
    const isPrimaryClan = config.clanTag === clanTag;

    onChange(prev => ({
      ...prev,
      clanNames: updatedClanNames,
      // Update primary clan name if this is the primary clan
      ...(isPrimaryClan && { clanName: name })
    }));
  }

  function getDisplayName(clanTag) {
    return config.clanNames?.[clanTag] || `#${clanTag}`;
  }

  return (
    <div className="clash-config-wrapper">
      {/* First Row: Configuration and Mention Targets */}
      <div className="row mb-4">
        <div className="col-lg-6">
          <div className="clash-config-block">
            <div className="card-body">
              <h6 className="card-title">{t('gamesSocials.common.configuration')}</h6>
              
              {/* Check Interval */}
              <div className="mb-3">
                <label className="form-label">{t('gamesSocials.common.intervalSec')}</label>
                <input
                  type="number"
                  className="form-control"
                  min="300"
                  max="86400"
                  value={config.intervalSec || 3600}
                  onChange={e => onChange(prev => ({ ...prev, intervalSec: parseInt(e.target.value) || 3600 }))}
                />
                <div className="form-text">{t('gamesSocials.clashofclans.intervalHint')}</div>
              </div>

              {/* Embed Toggle */}
              <div className="form-check form-switch mb-3">
                <input
                  id="embedToggle"
                  className="form-check-input"
                  type="checkbox"
                  checked={config.embedEnabled}
                  onChange={e => onChange(prev => ({ ...prev, embedEnabled: e.target.checked }))}
                />
                <label 
                  className="form-check-label user-select-none" 
                  htmlFor="embedToggle"
                  style={{ cursor: 'pointer' }}
                >
                  {t('gamesSocials.common.embeds')}
                </label>
              </div>

              {/* Feature Toggles */}
              <div className="mb-3">
                <label className="form-label">{t('gamesSocials.clashofclans.sections.trackingFeatures')}</label>
                
                <div className="form-check form-switch">
                  <input
                    id="trackWarsToggle"
                    className="form-check-input"
                    type="checkbox"
                    checked={config.trackWarEvents || config.trackWars}
                    onChange={e => onChange(prev => ({ 
                      ...prev, 
                      trackWarEvents: e.target.checked, 
                      trackWars: e.target.checked
                    }))}
                  />
                  <label 
                    className="form-check-label user-select-none" 
                    htmlFor="trackWarsToggle"
                    style={{ cursor: 'pointer' }}
                  >
                    {t('gamesSocials.clashofclans.tracking.trackWars')}
                  </label>
                </div>
                
                <div className="form-check form-switch">
                  <input
                    id="trackMembersToggle"
                    className="form-check-input"
                    type="checkbox"
                    checked={config.trackMemberEvents || config.trackMemberChanges}
                    onChange={e => onChange(prev => ({ ...prev, trackMemberEvents: e.target.checked, trackMemberChanges: e.target.checked }))}
                  />
                  <label 
                    className="form-check-label user-select-none" 
                    htmlFor="trackMembersToggle"
                    style={{ cursor: 'pointer' }}
                  >
                    {t('gamesSocials.clashofclans.tracking.trackMembers')}
                  </label>
                </div>
                
                <div className="form-check form-switch">
                  <input
                    id="trackWarStatsToggle"
                    className="form-check-input"
                    type="checkbox"
                    checked={config.trackWarLeaderboard || config.track_war_leaderboard || false}
                    onChange={e => onChange(prev => ({ 
                      ...prev, 
                      trackWarLeaderboard: e.target.checked,
                      track_war_leaderboard: e.target.checked,
                      ...(e.target.checked && { 
                        warPreparingMessageId: config.warPreparingMessageId || config.war_preparing_message_id || null,
                        warActiveMessageId: config.warActiveMessageId || config.war_active_message_id || null,
                        war_preparing_message_id: config.war_preparing_message_id || config.warPreparingMessageId || null,
                        war_active_message_id: config.war_active_message_id || config.warActiveMessageId || null
                      })
                    }))}
                  />
                  <label 
                    className="form-check-label user-select-none" 
                    htmlFor="trackWarStatsToggle"
                    style={{ cursor: 'pointer' }}
                  >
                    {t('gamesSocials.clashofclans.tracking.trackWarStats')}
                  </label>
                </div>
                
                <div className="form-check form-switch">
                  <input
                    id="trackDonationLeaderboardToggle"
                    className="form-check-input"
                    type="checkbox"
                    checked={config.trackDonationLeaderboard || false}
                    onChange={e => onChange(prev => ({ 
                      ...prev, 
                      trackDonationLeaderboard: e.target.checked,
                      // Set defaults when enabling: hourly schedule (fixed), random colors, interactive controls enabled
                      ...(e.target.checked && { 
                        donation_message_id: config.donation_message_id || null,
                        donationMessageId: config.donationMessageId || null,
                        donationLeaderboardPlayersPerPage: 20,
                        donation_leaderboard_players_per_page: 20,
                        donationLeaderboardTimeRange: 'current_season',
                        donation_leaderboard_time_range: 'current_season',
                        donationLeaderboardInteractive: true,
                        donation_leaderboard_interactive: true,
                        donationLeaderboardBackgroundType: 'random',
                        donation_leaderboard_background_type: 'random',
                        donationLeaderboardSchedule: 'hourly',
                        donation_leaderboard_schedule: 'hourly'
                      })
                    }))}
                  />
                  <label 
                    className="form-check-label user-select-none" 
                    htmlFor="trackDonationLeaderboardToggle"
                    style={{ cursor: 'pointer' }}
                  >
                    {t('gamesSocials.clashofclans.tracking.trackDonationLeaderboard')}
                  </label>
                </div>
                
                <div className="form-check form-switch">
                  <input
                    id="trackCWLToggle"
                    className="form-check-input"
                    type="checkbox"
                    checked={config.trackCWL || config.track_cwl || false}
                    onChange={e => onChange(prev => ({ 
                      ...prev, 
                      trackCWL: e.target.checked,
                      track_cwl: e.target.checked
                    }))}
                  />
                  <label 
                    className="form-check-label user-select-none" 
                    htmlFor="trackCWLToggle"
                    style={{ cursor: 'pointer' }}
                  >
                    {t('gamesSocials.clashofclans.tracking.trackCWL', 'Track Clan War League')}
                  </label>
                </div>
                
                <div className="form-check form-switch">
                  <input
                    id="trackEventsToggle"
                    className="form-check-input"
                    type="checkbox"
                    checked={config.trackEvents || config.track_events || false}
                    onChange={e => onChange(prev => ({ 
                      ...prev, 
                      trackEvents: e.target.checked,
                      track_events: e.target.checked
                    }))}
                  />
                  <label 
                    className="form-check-label user-select-none" 
                    htmlFor="trackEventsToggle"
                    style={{ cursor: 'pointer' }}
                  >
                    {t('gamesSocials.clashofclans.tracking.trackEvents', 'Track Game Events (Trader, Raid, Games, Season)')}
                  </label>
                </div>
              </div>

              {/* Event Tracking Channel - Only show when enabled */}
              {(config.trackEvents || config.track_events) && (
                <div className="mb-3">
                  <label className="form-label">{t('gamesSocials.clashofclans.fields.eventsChannel', 'Events Channel')}</label>
                  <select
                    className="form-select"
                    value={config.eventsChannelId || config.events_channel_id || ''}
                    onChange={e => onChange(prev => ({ 
                      ...prev, 
                      eventsChannelId: e.target.value || null,
                      events_channel_id: e.target.value || null
                    }))}
                  >
                    <option value="">{t('gamesSocials.common.select')}</option>
                    {discordChannels.map(ch => (
                      <option key={ch.id} value={ch.id}>#{ch.name}</option>
                    ))}
                  </select>
                  <div className="form-text">
                    {t('gamesSocials.clashofclans.fields.eventsChannelHelp', 'Auto-updating message showing Trader Shop, Raid Weekend, Clan Games, and Season Challenge timers (updates every 5 minutes)')}
                  </div>
                </div>
              )}

              {/* Donation event-based tracking is not supported; threshold input removed */}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          {/* Mention Targets */}
          <div className="clash-config-block">
            <div className="card-body">
              <h6 className="card-title">{t('gamesSocials.common.mentionTargets')}</h6>
              
              {/* Global Mention Targets */}
              <div className="mb-3">
                <label className="form-label">
                  {t('gamesSocials.clashofclans.announce.globalMentions')}
                </label>
                <small className="form-text text-muted d-block mb-2">
                  {t('gamesSocials.clashofclans.announce.globalMentionsHelp')}
                </small>
                <MentionTargetsPicker
                  value={config.mentionTargets || []}
                  roles={guildRoles}
                  onChange={targets => onChange(prev => ({ 
                    ...prev, 
                    mentionTargets: targets,
                    // Update all individual mention targets to maintain compatibility
                    warMentionTarget: targets,
                    memberMentionTarget: targets, 
                    donationMentionTarget: targets
                  }))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clan Management */}
      <div className="clash-config-block mb-4">
        <div className="card-body">
          <h6 className="card-title">{t('gamesSocials.clashofclans.sections.clanManagement')}</h6>
          
          {/* Add Clan */}
          <div className="input-group mb-3">
            <span className="input-group-text">#</span>
            <input
              type="text"
              className="form-control"
              placeholder={t('gamesSocials.clashofclans.clans.clanTagPlaceholder')}
              value={newClanTag}
              onChange={e => setNewClanTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addClan()}
            />
            <button
              className="btn btn-outline-primary"
              onClick={addClan}
              disabled={resolving || !newClanTag.trim()}
            >
              {resolving ? t('gamesSocials.common.resolving') : t('gamesSocials.clashofclans.clans.addClan')}
            </button>
          </div>
          
          {/* Clan List */}
          {config.clans?.length > 0 ? (
            <div className="clans-list">
              {config.clans.map((clanTag, index) => {
                const isPrimary = config.clanTag === clanTag;
                const clanConfigs = config.clanConfigs || {};
                const clanConfig = clanConfigs[clanTag] || {};
                
                return (
                  <div key={clanTag} className={`clan-card border rounded mb-3 ${isPrimary ? 'border-primary bg-primary bg-opacity-10' : ''}`}>
                    {/* Clan Header */}
                    <div className="d-flex align-items-center justify-content-between p-3 border-bottom">
                      <div className="d-flex align-items-center gap-2 flex-grow-1">
                        <div className="d-flex flex-column">
                          <div className="d-flex align-items-center gap-2">
                            <code className="text-primary">#{clanTag}</code>
                            {isPrimary && <span className="badge bg-primary">Primary</span>}
                          </div>
                          {editingClan === clanTag ? (
                            <input
                              type="text"
                              className="form-control form-control-sm mt-1"
                              placeholder="Enter clan name..."
                              value={config.clanNames?.[clanTag] || ''}
                              onChange={e => updateClanName(clanTag, e.target.value)}
                              onBlur={() => setEditingClan(null)}
                              onKeyDown={e => e.key === 'Enter' && setEditingClan(null)}
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="text-muted cursor-pointer small mt-1"
                              onClick={() => setEditingClan(clanTag)}
                              title="Click to edit clan name"
                            >
                              {config.clanNames?.[clanTag] || 'Click to set clan name'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => removeClan(clanTag)}
                        title="Remove clan"
                      >
                        ×
                      </button>
                    </div>
                    
                    {/* Per-Clan Configuration */}
                    <div className="p-3">
                      <h6 className="mb-3 text-muted small">{t('gamesSocials.clashofclans.clans.mentionTargets')}</h6>
                      
                      {/* Announcement Channels */}
                      <div className="row g-3 mb-4">
                        {/* War Announcement Channel */}
                        <div className="col-md-4">
                          <label className="form-label small fw-medium">
                            {t('gamesSocials.clashofclans.fields.warAnnouncements')}
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={clanConfig.warAnnounceChannelId || ''}
                            onChange={e => {
                              const updatedClanConfigs = {
                                ...config.clanConfigs,
                                [clanTag]: {
                                  ...clanConfig,
                                  warAnnounceChannelId: e.target.value || null
                                }
                              };
                              onChange(prev => ({ 
                                ...prev, 
                                clanConfigs: updatedClanConfigs
                              }));
                            }}
                          >
                            <option value="">{t('gamesSocials.common.select')}</option>
                            {discordChannels.map(ch => (
                              <option key={ch.id} value={ch.id}>#{ch.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Member Announcement Channel */}
                        <div className="col-md-4">
                          <label className="form-label small fw-medium">
                            {t('gamesSocials.clashofclans.fields.memberAnnouncements')}
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={clanConfig.memberAnnouncementChannelId || ''}
                            onChange={e => {
                              const updatedClanConfigs = {
                                ...config.clanConfigs,
                                [clanTag]: {
                                  ...clanConfig,
                                  memberAnnouncementChannelId: e.target.value || null
                                }
                              };
                              onChange(prev => ({ 
                                ...prev, 
                                clanConfigs: updatedClanConfigs
                              }));
                            }}
                          >
                            <option value="">{t('gamesSocials.common.select')}</option>
                            {discordChannels.map(ch => (
                              <option key={ch.id} value={ch.id}>#{ch.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Donation Announcement Channel */}
                        <div className="col-md-4">
                          <label className="form-label small fw-medium">
                            {t('gamesSocials.clashofclans.fields.donationAnnouncements')}
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={clanConfig.donationAnnounceChannelId || ''}
                            onChange={e => {
                              const updatedClanConfigs = {
                                ...config.clanConfigs,
                                [clanTag]: {
                                  ...clanConfig,
                                  donationAnnounceChannelId: e.target.value || null
                                }
                              };
                              onChange(prev => ({ 
                                ...prev, 
                                clanConfigs: updatedClanConfigs
                              }));
                            }}
                            disabled={!config.trackDonationLeaderboard}
                          >
                            <option value="">{t('gamesSocials.common.select')}</option>
                            {discordChannels.map(ch => (
                              <option key={ch.id} value={ch.id}>#{ch.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* CWL Channels */}
                        {(config.trackCWL || config.track_cwl) && (
                          <>
                            <div className="col-md-6">
                              <label className="form-label small fw-medium">
                                {t('gamesSocials.clashofclans.fields.cwlAnnouncements', 'CWL Announcements')}
                              </label>
                              <select
                                className="form-select form-select-sm"
                                value={clanConfig.cwlAnnounceChannelId || ''}
                                onChange={e => {
                                  const updatedClanConfigs = {
                                    ...config.clanConfigs,
                                    [clanTag]: {
                                      ...clanConfig,
                                      cwlAnnounceChannelId: e.target.value || null
                                    }
                                  };
                                  onChange(prev => ({ 
                                    ...prev, 
                                    clanConfigs: updatedClanConfigs
                                  }));
                                }}
                              >
                                <option value="">{t('gamesSocials.common.select')}</option>
                                {discordChannels.map(ch => (
                                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                                ))}
                              </select>
                              <div className="form-text tiny">
                                {t('gamesSocials.clashofclans.fields.cwlAnnouncementsHelp', 'Announce CWL start, daily rounds, and final results')}
                              </div>
                            </div>
                            
                            <div className="col-md-6">
                              <label className="form-label small fw-medium">
                                {t('gamesSocials.clashofclans.fields.cwlLeaderboard', 'CWL Leaderboard')}
                              </label>
                              <select
                                className="form-select form-select-sm"
                                value={clanConfig.cwlLeaderboardChannelId || ''}
                                onChange={e => {
                                  const updatedClanConfigs = {
                                    ...config.clanConfigs,
                                    [clanTag]: {
                                      ...clanConfig,
                                      cwlLeaderboardChannelId: e.target.value || null
                                    }
                                  };
                                  onChange(prev => ({ 
                                    ...prev, 
                                    clanConfigs: updatedClanConfigs
                                  }));
                                }}
                              >
                                <option value="">{t('gamesSocials.common.select')}</option>
                                {discordChannels.map(ch => (
                                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                                ))}
                              </select>
                              <div className="form-text tiny">
                                {t('gamesSocials.clashofclans.fields.cwlLeaderboardHelp', 'Live CWL standings and statistics')}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className="row g-3">
                        {/* War Mention Targets */}
                        <div className="col-md-4">
                          <label className="form-label small fw-medium">
                            {t('gamesSocials.clashofclans.clans.warMentions')}
                          </label>
                          <MentionTargetsPicker
                            value={clanConfig.warMentionTargets || []}
                            roles={guildRoles}
                            onChange={targets => {
                              const updatedClanConfigs = {
                                ...config.clanConfigs,
                                [clanTag]: {
                                  ...clanConfig,
                                  warMentionTargets: targets
                                }
                              };
                              onChange(prev => ({ 
                                ...prev, 
                                clanConfigs: updatedClanConfigs
                              }));
                            }}
                          />
                          <div className="form-text small">
                            {t('gamesSocials.clashofclans.clans.warMentionsHelp')}
                          </div>
                        </div>
                        
                        {/* Member Mention Targets */}
                        <div className="col-md-4">
                          <label className="form-label small fw-medium">
                            {t('gamesSocials.clashofclans.clans.memberMentions')}
                          </label>
                          <MentionTargetsPicker
                            value={clanConfig.memberMentionTargets || []}
                            roles={guildRoles}
                            onChange={targets => {
                              const updatedClanConfigs = {
                                ...config.clanConfigs,
                                [clanTag]: {
                                  ...clanConfig,
                                  memberMentionTargets: targets
                                }
                              };
                              onChange(prev => ({ 
                                ...prev, 
                                clanConfigs: updatedClanConfigs
                              }));
                            }}
                          />
                          <div className="form-text small">
                            {t('gamesSocials.clashofclans.clans.memberMentionsHelp')}
                          </div>
                        </div>
                        
                        {/* Donation Mention Targets */}
                        <div className="col-md-4">
                          <label className="form-label small fw-medium">
                            {t('gamesSocials.clashofclans.clans.donationMentions')}
                          </label>
                          <MentionTargetsPicker
                            value={clanConfig.donationMentionTargets || []}
                            roles={guildRoles}
                            onChange={targets => {
                              const updatedClanConfigs = {
                                ...config.clanConfigs,
                                [clanTag]: {
                                  ...clanConfig,
                                  donationMentionTargets: targets
                                }
                              };
                              onChange(prev => ({ 
                                ...prev, 
                                clanConfigs: updatedClanConfigs
                              }));
                            }}
                          />
                          <div className="form-text small">
                            {t('gamesSocials.clashofclans.clans.donationMentionsHelp')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-muted text-center py-3">
              {t('gamesSocials.clashofclans.clans.noClans')}
            </div>
          )}
        </div>
      </div>

      {/* Message Templates */}
      <div className="clash-config-grid">
        <div>
          <div className="clash-config-block mb-3">
            <div className="card-body">
              <h6 className="card-title">{t('gamesSocials.clashofclans.sections.warStartTemplate')}</h6>
              <textarea
                className="form-control mb-2"
                rows="3"
                value={config.warStartTemplate || ''}
                onChange={e => onChange(prev => ({ ...prev, warStartTemplate: e.target.value }))}
                placeholder={t('gamesSocials.clashofclans.templates.warStartPlaceholder')}
              />
              <TemplatePreview
                template={config.warStartTemplate || ''}
                placeholders={TEMPLATE_PLACEHOLDERS.clashofclans}
                sampleData={{
                  clanName: 'Example Clan',
                  clanTag: '#ABC123',
                  warOpponent: 'Enemy Clan',
                  warEndTime: 'in 24 hours',
                  roleNames: 'Clan Members',
                  roleMention: '@Clan Members'
                }}
              />
            </div>
          </div>

          <div className="clash-config-block mb-3">
            <div className="card-body">
              <h6 className="card-title">{t('gamesSocials.clashofclans.sections.warEndTemplate')}</h6>
              <textarea
                className="form-control mb-2"
                rows="3"
                value={config.warEndTemplate || ''}
                onChange={e => onChange(prev => ({ ...prev, warEndTemplate: e.target.value }))}
                placeholder={t('gamesSocials.clashofclans.templates.warEndPlaceholder')}
              />
              <TemplatePreview
                template={config.warEndTemplate || ''}
                placeholders={TEMPLATE_PLACEHOLDERS.clashofclans}
                sampleData={{
                  clanName: 'Example Clan',
                  clanTag: '#ABC123',
                  warResult: 'Victory',
                  warStars: '47/50',
                  warDestructionPercentage: '98.5%',
                  roleNames: 'Clan Members',
                  roleMention: '@Clan Members'
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="clash-config-block mb-3">
            <div className="card-body">
              <h6 className="card-title">{t('gamesSocials.clashofclans.sections.memberJoinTemplate')}</h6>
              <textarea
                className="form-control mb-2"
                rows="3"
                value={config.memberJoinTemplate || ''}
                onChange={e => onChange(prev => ({ ...prev, memberJoinTemplate: e.target.value }))}
                placeholder={t('gamesSocials.clashofclans.templates.memberJoinPlaceholder')}
              />
              <TemplatePreview
                template={config.memberJoinTemplate || ''}
                placeholders={TEMPLATE_PLACEHOLDERS.clashofclans}
                sampleData={{
                  clanName: 'Example Clan',
                  memberCount: '48/50',
                  roleNames: 'Clan Members',
                  roleMention: '@Clan Members'
                }}
              />
            </div>
          </div>

          {/* Donation event template removed because donation request tracking is not supported */}
        </div>
      </div>

      {/* Placeholders Reference */}
      <div className="clash-config-block border-info">
        <div className="card-body">
          <h6 className="card-title text-info">
            <i className="fa-solid fa-info-circle me-2"/>
            {t('gamesSocials.common.placeholders')}
          </h6>
          <div className="row">
            {TEMPLATE_PLACEHOLDERS.clashofclans.map((placeholder, idx) => (
              <div key={idx} className="col-md-3 mb-1">
                <code className="small">{placeholder}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}