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
      {/* Basic Settings */}
      <div className="row mb-4">
        <div className="col-lg-4">
          <div className="card card-glass">
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
                  className="form-check-input"
                  type="checkbox"
                  checked={config.embedEnabled}
                  onChange={e => onChange(prev => ({ ...prev, embedEnabled: e.target.checked }))}
                />
                <label className="form-check-label">{t('gamesSocials.common.embeds')}</label>
              </div>

              {/* Feature Toggles */}
              <div className="mb-3">
                <label className="form-label">{t('gamesSocials.clashofclans.sections.trackingFeatures')}</label>
                
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={config.trackWarEvents || config.trackWars}
                    onChange={e => onChange(prev => ({ ...prev, trackWarEvents: e.target.checked, trackWars: e.target.checked }))}
                  />
                  <label className="form-check-label">{t('gamesSocials.clashofclans.tracking.trackWars')}</label>
                </div>
                
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={config.trackMemberEvents || config.trackMemberChanges}
                    onChange={e => onChange(prev => ({ ...prev, trackMemberEvents: e.target.checked, trackMemberChanges: e.target.checked }))}
                  />
                  <label className="form-check-label">{t('gamesSocials.clashofclans.tracking.trackMembers')}</label>
                </div>
                
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={config.trackDonationEvents || config.trackDonations}
                    onChange={e => onChange(prev => ({ ...prev, trackDonationEvents: e.target.checked, trackDonations: e.target.checked }))}
                  />
                  <label className="form-check-label">{t('gamesSocials.clashofclans.tracking.trackDonations')}</label>
                </div>
              </div>

              {/* Donation Threshold */}
              {(config.trackDonationEvents || config.trackDonations) && (
                <div className="mb-3">
                  <label className="form-label">{t('gamesSocials.clashofclans.tracking.donationThreshold')}</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    value={config.minDonationThreshold || 100}
                    onChange={e => onChange(prev => ({ ...prev, minDonationThreshold: parseInt(e.target.value) || 100 }))}
                  />
                  <div className="form-text">{t('gamesSocials.clashofclans.tracking.donationThresholdHint')}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          {/* Mention Targets */}
          <div className="card card-glass">
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

        <div className="col-lg-4">
          {/* Donation Leaderboard Settings */}
          <div className="card card-glass">
            <div className="card-body">
              <div className="d-flex align-items-center mb-3">
                <h6 className="card-title mb-0">{t('gamesSocials.clashofclans.sections.donationLeaderboard')}</h6>
              </div>
              
              {/* Enable Donation Leaderboard */}
              <div className="form-check form-switch mb-4">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={config.trackDonationLeaderboard || false}
                  onChange={e => onChange(prev => ({ 
                    ...prev, 
                    trackDonationLeaderboard: e.target.checked,
                    // Set defaults when enabling: 20 per page, current season, random colors, interactive controls enabled
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
                      donation_leaderboard_background_type: 'random'
                    })
                  }))}
                />
                <label className="form-check-label fw-medium">
                  {t('gamesSocials.clashofclans.leaderboard.enableLeaderboard')}
                </label>
              </div>
              
              {config.trackDonationLeaderboard && (
                <div className="ps-3">
                  {/* Leaderboard Channel */}
                  <div className="mb-4">
                    <label className="form-label fw-medium">
                      {t('gamesSocials.clashofclans.leaderboard.channel')}
                    </label>
                    <select
                      className="form-select"
                      value={config.donationLeaderboardChannelId || config.donation_leaderboard_channel_id || config.donationAnnounceChannelId || ''}
                      onChange={e => onChange(prev => ({ 
                        ...prev, 
                        donationLeaderboardChannelId: e.target.value || null,
                        donation_leaderboard_channel_id: e.target.value || null,
                        // Reset message ID when channel changes
                        donation_message_id: null,
                        donationMessageId: null
                      }))}
                    >
                      <option value="">{t('gamesSocials.common.select')}</option>
                      {discordChannels.map(ch => (
                        <option key={ch.id} value={ch.id}>#{ch.name}</option>
                      ))}
                    </select>
                    <div className="form-text text-muted small">
                      {t('gamesSocials.clashofclans.leaderboard.channelHint')}
                    </div>
                  </div>
                  
                  {/* Schedule */}
                  <div className="mb-4">
                    <label className="form-label fw-medium">
                      {t('gamesSocials.clashofclans.leaderboard.schedule')}
                    </label>
                    <select
                      className="form-select"
                      value={config.donationLeaderboardSchedule || config.donation_leaderboard_schedule || 'weekly'}
                      onChange={e => onChange(prev => ({ 
                        ...prev, 
                        donationLeaderboardSchedule: e.target.value,
                        donation_leaderboard_schedule: e.target.value,
                        // Reset message ID when schedule changes as bot may need to recreate the message
                        donation_message_id: null,
                        donationMessageId: null
                      }))}
                    >
                      <option value="hourly">{t('gamesSocials.clashofclans.leaderboard.schedules.hourly')}</option>
                      <option value="daily">{t('gamesSocials.clashofclans.leaderboard.schedules.daily')}</option>
                      <option value="weekly">{t('gamesSocials.clashofclans.leaderboard.schedules.weekly')}</option>
                      <option value="monthly">{t('gamesSocials.clashofclans.leaderboard.schedules.monthly')}</option>
                    </select>
                    <div className="form-text text-muted small">
                      {t('gamesSocials.clashofclans.leaderboard.scheduleHint')}
                    </div>
                  </div>

                  {/* Custom Template */}
                  <div className="mb-3">
                    <label className="form-label fw-medium">
                      {t('gamesSocials.clashofclans.leaderboard.template')}
                    </label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={config.donationLeaderboardTemplate || config.donation_leaderboard_template || ''}
                      onChange={e => onChange(prev => ({ 
                        ...prev, 
                        donationLeaderboardTemplate: e.target.value,
                        donation_leaderboard_template: e.target.value
                      }))}
                      placeholder={t('gamesSocials.clashofclans.leaderboard.templatePlaceholder')}
                    />
                    <div className="form-text text-muted small">
                      {t('gamesSocials.clashofclans.leaderboard.templateHint')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Clan Management */}
      <div className="card card-glass mb-4">
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
                return (
                  <div key={clanTag} className={`d-flex align-items-center justify-content-between p-3 border rounded mb-2 ${isPrimary ? 'border-primary bg-primary bg-opacity-10' : ''}`}>
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

      {/* Announcement Channels */}
      <div className="row mb-4">
        <div className="col-lg-4">
          <div className="card card-glass">
            <div className="card-body">
              <h6 className="card-title">{t('gamesSocials.clashofclans.fields.warAnnouncements')}</h6>
              <select
                className="form-select"
                value={config.warAnnounceChannelId || ''}
                onChange={e => onChange(prev => ({ ...prev, warAnnounceChannelId: e.target.value || null }))}
              >
                <option value="">{t('gamesSocials.common.select')}</option>
                {discordChannels.map(ch => (
                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card card-glass">
            <div className="card-body">
              <h6 className="card-title">{t('gamesSocials.clashofclans.fields.memberAnnouncements')}</h6>
              <select
                className="form-select"
                value={config.memberAnnounceChannelId || ''}
                onChange={e => onChange(prev => ({ ...prev, memberAnnounceChannelId: e.target.value || null }))}
              >
                <option value="">{t('gamesSocials.common.select')}</option>
                {discordChannels.map(ch => (
                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card card-glass">
            <div className="card-body">
              <h6 className="card-title">{t('gamesSocials.clashofclans.fields.donationAnnouncements')}</h6>
              <select
                className="form-select"
                value={config.donationAnnounceChannelId || ''}
                onChange={e => onChange(prev => ({ ...prev, donationAnnounceChannelId: e.target.value || null }))}
                disabled={!(config.trackDonationEvents || config.trackDonations)}
              >
                <option value="">{t('gamesSocials.common.select')}</option>
                {discordChannels.map(ch => (
                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Message Templates */}
      <div className="row">
        <div className="col-lg-6">
          <div className="card card-glass mb-3">
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

          <div className="card card-glass mb-3">
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

        <div className="col-lg-6">
          <div className="card card-glass mb-3">
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

          {(config.trackDonationEvents || config.trackDonations) && (
            <div className="card card-glass mb-3">
              <div className="card-body">
                <h6 className="card-title">{t('gamesSocials.clashofclans.sections.donationTemplate')}</h6>
                <textarea
                  className="form-control mb-2"
                  rows="3"
                  value={config.donationTemplate || ''}
                  onChange={e => onChange(prev => ({ ...prev, donationTemplate: e.target.value }))}
                  placeholder={t('gamesSocials.clashofclans.templates.donationPlaceholder')}
                />
                <TemplatePreview
                  template={config.donationTemplate || ''}
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
          )}
        </div>
      </div>

      {/* Placeholders Reference */}
      <div className="card card-glass border-info">
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