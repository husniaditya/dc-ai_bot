import React, { useState } from 'react';
import MentionTargetsPicker from '../components/MentionTargetsPicker';
import TemplatePreview from '../components/TemplatePreview';
import { TEMPLATE_PLACEHOLDERS } from '../constants';
import { useI18n } from '../../../i18n';
import { authFetch } from '../../../api';

// ValorantConfig - Valorant integration configuration component
export default function ValorantConfig({
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
  const [newRiotId, setNewRiotId] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('na');
  const [resolving, setResolving] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);

  // Function to fetch player name from Valorant API
  async function fetchPlayerInfo(name, tag, region) {
    try {
      const playerData = await authFetch(`/api/valorant/account/${name}/${tag}`);
      return {
        name: playerData?.name || name,
        tag: playerData?.tag || tag,
        displayName: `${playerData?.name || name}#${playerData?.tag || tag}`,
        region: playerData?.region || region
      };
    } catch (error) {
      console.error('Failed to fetch player info:', error);
      // Use fallback name on any error (network, 404, etc.)
      return {
        name,
        tag,
        displayName: `${name}#${tag}`,
        region
      };
    }
  }

  if (!config) {
    return (
      <div className="text-muted small">
        {t('gamesSocials.common.loadingConfig', { service: t('gamesSocials.services.valorant.label') })}
      </div>
    );
  }

  async function addPlayer() {
    const rawId = newRiotId.trim();
    if (!rawId) return;

    // Parse Riot ID (Name#TAG format)
    const [name, tag] = rawId.split('#');
    
    if (!name || !tag) {
      pushToast && pushToast('error', t('gamesSocials.valorant.toasts.invalidRiotId'));
      return;
    }

    const playerId = `${name}#${tag}`;
    
    if (config.players.includes(playerId)) {
      pushToast && pushToast('error', t('gamesSocials.valorant.toasts.alreadyTracking', { player: playerId }));
      return;
    }

    setResolving(true);
    try {
      // Fetch player info from API
      const playerInfo = await fetchPlayerInfo(name, tag, selectedRegion);
      
      // Add player with fetched info
      const updatedPlayers = [...config.players, playerId];
      const updatedPlayerNames = { ...config.playerNames, [playerId]: playerInfo.displayName };
      const updatedPlayerRegions = { ...config.playerRegions, [playerId]: playerInfo.region };
      
      onChange(prev => ({
        ...prev,
        players: updatedPlayers,
        playerNames: updatedPlayerNames,
        playerRegions: updatedPlayerRegions
      }));
      
      setNewRiotId('');
      pushToast && pushToast('success', t('gamesSocials.valorant.toasts.added', { player: playerId }));
    } catch (error) {
      pushToast && pushToast('error', t('gamesSocials.valorant.toasts.addFailed'));
    } finally {
      setResolving(false);
    }
  }

  function removePlayer(playerId) {
    const updatedPlayers = config.players.filter(id => id !== playerId);
    const updatedMessages = { ...config.playerMessages };
    const updatedNames = { ...config.playerNames };
    const updatedRegions = { ...config.playerRegions };
    
    delete updatedMessages[playerId];
    delete updatedNames[playerId];
    delete updatedRegions[playerId];

    onChange(prev => ({
      ...prev,
      players: updatedPlayers,
      playerMessages: updatedMessages,
      playerNames: updatedNames,
      playerRegions: updatedRegions
    }));
  }

  function updatePlayerMessage(playerId, message) {
    onChange(prev => ({
      ...prev,
      playerMessages: {
        ...prev.playerMessages,
        [playerId]: message
      }
    }));
  }

  function getDisplayName(playerId) {
    return config.playerNames?.[playerId] || playerId;
  }

  function getPlayerRegion(playerId) {
    return config.playerRegions?.[playerId] || 'na';
  }

  return (
    <>
      <div className="genshin-config-grid mt-2">
        {/* MAIN CONFIG */}
        <div className="genshin-config-block">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div className="small text-uppercase text-muted fw-semibold mb-1">
                {t('gamesSocials.common.announcement')}
              </div>
              <div className="form-check form-switch m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={config.enabled || false}
                  onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
                />
                <label className="form-check-label ms-2">
                  {config.enabled ? t('common.enabled') : t('common.disabled')}
                </label>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.common.checkInterval')}
              <span className="text-muted ms-1">({t('gamesSocials.common.seconds')})</span>
            </label>
            <input 
              type="number" 
              className="form-control form-control-sm" 
              style={{ width: 110 }}
              min="300" 
              max="86400"
              value={config.intervalSec || 1800}
              onChange={e => onChange({...config, intervalSec: parseInt(e.target.value) || 1800})}
            />
            <div className="form-text tiny text-muted mt-1">
              {t('gamesSocials.valorant.intervalHint')}
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.common.embeds')}
            </label>
            <div className="form-check form-switch m-0">
              <input
                className="form-check-input"
                type="checkbox"
                checked={config.embedEnabled !== false}
                onChange={(e) => onChange({ ...config, embedEnabled: e.target.checked })}
              />
              <label className="form-check-label ms-2">
                {config.embedEnabled !== false ? t('common.enabled') : t('gamesSocials.common.plain')}
              </label>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.common.features')}
            </label>
            <div className="d-flex flex-column gap-1">
              <div className="form-check form-check-sm">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  checked={config.trackMatches || false}
                  onChange={e => onChange({...config, trackMatches: e.target.checked})}
                />
                <label className="form-check-label small">
                  {t('gamesSocials.valorant.tracking.trackMatches')}
                </label>
              </div>
              <div className="form-check form-check-sm">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  checked={config.trackRankChanges || false}
                  onChange={e => onChange({...config, trackRankChanges: e.target.checked})}
                />
                <label className="form-check-label small">
                  {t('gamesSocials.valorant.tracking.trackRankChanges')}
                </label>
              </div>
              <div className="form-check form-check-sm">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  checked={config.trackAchievements || false}
                  onChange={e => onChange({...config, trackAchievements: e.target.checked})}
                />
                <label className="form-check-label small">
                  {t('gamesSocials.valorant.tracking.trackAchievements')}
                </label>
              </div>
            </div>
          </div>

          {config.trackMatches && (
            <div className="mb-3">
              <label className="form-label small fw-semibold mb-1">
                {t('gamesSocials.valorant.tracking.matchTypes')}
              </label>
              <div className="d-flex flex-column gap-1">
                <div className="form-check form-check-sm">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={config.matchTypes?.competitive !== false}
                    onChange={e => onChange({ 
                      ...config, 
                      matchTypes: { ...config.matchTypes, competitive: e.target.checked } 
                    })}
                  />
                  <label className="form-check-label small">
                    {t('gamesSocials.valorant.matchTypes.competitive')}
                  </label>
                </div>
                <div className="form-check form-check-sm">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={config.matchTypes?.unrated || false}
                    onChange={e => onChange({ 
                      ...config, 
                      matchTypes: { ...config.matchTypes, unrated: e.target.checked } 
                    })}
                  />
                  <label className="form-check-label small">
                    {t('gamesSocials.valorant.matchTypes.unrated')}
                  </label>
                </div>
                <div className="form-check form-check-sm">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={config.matchTypes?.deathmatch || false}
                    onChange={e => onChange({ 
                      ...config, 
                      matchTypes: { ...config.matchTypes, deathmatch: e.target.checked } 
                    })}
                  />
                  <label className="form-check-label small">
                    {t('gamesSocials.valorant.matchTypes.deathmatch')}
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PLAYERS MANAGEMENT */}
        <div className="genshin-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">
            {t('gamesSocials.valorant.sections.playerManagement')} ({config.players?.length || 0})
          </div>
          
          {/* Add Player Form */}
          <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
            <div style={{ flex: '1 1 200px' }}>
              <label className="form-label small fw-semibold mb-1">
                {t('gamesSocials.valorant.players.riotIdPlaceholder')}
              </label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Name#TAG"
                value={newRiotId}
                onChange={e => setNewRiotId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPlayer();
                  }
                }}
              />
            </div>
            <div style={{ flex: '0 0 80px' }}>
              <label className="form-label small fw-semibold mb-1">
                {t('gamesSocials.valorant.players.region')}
              </label>
              <select
                className="form-select form-select-sm"
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
              >
                <option value="na">NA</option>
                <option value="eu">EU</option>
                <option value="ap">AP</option>
                <option value="kr">KR</option>
                <option value="latam">LATAM</option>
                <option value="br">BR</option>
              </select>
            </div>
            <button 
              type="button" 
              className="btn btn-sm btn-accent" 
              onClick={addPlayer}
              disabled={resolving || !newRiotId.trim()}
            >
              <i className="fa-solid fa-plus" /> {resolving ? t('gamesSocials.common.resolving') : t('common.add')}
            </button>
          </div>

          <div className="form-text tiny mb-3">
            {t('gamesSocials.valorant.players.riotIdHelp')}
          </div>

          {/* Players List */}
          <ul className="genshin-player-list list-unstyled m-0 p-0">
            {(!Array.isArray(config.players) || config.players.length === 0) && (
              <li className="text-muted small py-2">{t('gamesSocials.valorant.players.noPlayers')}</li>
            )}

            {Array.isArray(config.players) &&
              config.players.map((playerId) => {
                const isEditing = editingPlayer === playerId;
                const displayName = getDisplayName(playerId);
                const region = getPlayerRegion(playerId);
                
                return (
                  <li key={playerId} className="genshin-player-item mb-2 border rounded">
                    <div className="d-flex align-items-center justify-content-between p-2">
                      <div className="d-flex align-items-center gap-2 flex-grow-1 min-w-0">
                        <i className="fa-solid fa-user text-muted" style={{ fontSize: '.75rem' }} />
                        <div className="d-flex flex-column min-w-0 flex-grow-1">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <code className="text-primary small text-truncate" style={{ maxWidth: '200px' }}>
                              {playerId}
                            </code>
                            <span className="badge bg-secondary" style={{ fontSize: '.65rem' }}>
                              {region.toUpperCase()}
                            </span>
                          </div>
                          {displayName !== playerId && (
                            <span className="text-muted tiny text-truncate" style={{ maxWidth: '250px' }}>
                              {displayName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setEditingPlayer(isEditing ? null : playerId)}
                          title={t('gamesSocials.valorant.players.customMessage')}
                          style={{ padding: '.15rem .4rem', fontSize: '.7rem' }}
                        >
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => removePlayer(playerId)}
                          title={t('common.remove')}
                          style={{ padding: '.15rem .4rem', fontSize: '.7rem' }}
                        >
                          <i className="fa-solid fa-times" />
                        </button>
                      </div>
                    </div>
                    
                    {isEditing && (
                      <div className="p-2 border-top">
                        <label className="form-label small fw-semibold mb-1">
                          {t('gamesSocials.valorant.players.customMessage')}
                        </label>
                        <textarea
                          className="form-control form-control-sm"
                          rows="2"
                          placeholder={t('gamesSocials.valorant.players.customMessagePlaceholder')}
                          value={config.playerMessages?.[playerId] || ''}
                          onChange={e => updatePlayerMessage(playerId, e.target.value)}
                          style={{ fontSize: '.8rem' }}
                        />
                        <div className="form-text tiny mt-1">
                          {t('gamesSocials.valorant.players.customMessageHelp')}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>

        {/* ANNOUNCEMENT CHANNELS */}
        <div className="genshin-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">
            {t('gamesSocials.common.announcementChannels')}
          </div>
          
          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.valorant.fields.matchAnnouncements')}
            </label>
            <select 
              className="form-select form-select-sm"
              value={config.matchAnnounceChannelId || ''}
              onChange={e => onChange({...config, matchAnnounceChannelId: e.target.value || null})}
            >
              <option value="">{t('gamesSocials.common.select')}</option>
              {discordChannels.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.valorant.fields.rankAnnouncements')}
            </label>
            <select 
              className="form-select form-select-sm"
              value={config.rankAnnounceChannelId || ''}
              onChange={e => onChange({...config, rankAnnounceChannelId: e.target.value || null})}
            >
              <option value="">{t('gamesSocials.common.select')}</option>
              {discordChannels.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.valorant.fields.achievementAnnouncements')}
            </label>
            <select 
              className="form-select form-select-sm"
              value={config.achievementAnnounceChannelId || ''}
              onChange={e => onChange({...config, achievementAnnounceChannelId: e.target.value || null})}
            >
              <option value="">{t('gamesSocials.common.select')}</option>
              {discordChannels.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold d-flex align-items-center gap-2 mb-1">
              {t('gamesSocials.common.mentionTargets')}
              {config.mentionTargets?.length ? (
                <span className="badge-soft" style={{ fontSize: '.55rem' }}>
                  {config.mentionTargets.length}
                </span>
              ) : null}
            </label>
            <MentionTargetsPicker
              value={config.mentionTargets || []}
              onChange={targets => onChange({...config, mentionTargets: targets})}
              roles={guildRoles}
            />
            <div className="form-text tiny text-muted mt-1">
              {t('gamesSocials.valorant.announce.globalMentionsHelp')}
            </div>
          </div>

          {config.trackMatches && (
            <div className="mb-3">
              <label className="form-label small fw-semibold mb-1">
                {t('gamesSocials.valorant.tracking.minKills')}
              </label>
              <input 
                type="number" 
                className="form-control form-control-sm" 
                style={{ width: 110 }}
                min="0" 
                max="100"
                value={config.minKillsThreshold || 20}
                onChange={e => onChange({...config, minKillsThreshold: parseInt(e.target.value) || 20})}
              />
              <div className="form-text tiny text-muted mt-1">
                {t('gamesSocials.valorant.tracking.minKillsHint')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MESSAGE TEMPLATES */}
      <div className="genshin-config-grid mt-3">
        <div className="genshin-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">
            {t('gamesSocials.common.messageTemplates')}
          </div>

          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.valorant.sections.matchTemplate')}
            </label>
            <textarea
              rows={7}
              className="form-control form-control-sm"
              placeholder={t('gamesSocials.valorant.templates.matchPlaceholder')}
              value={config.matchTemplate || ''}
              onChange={e => onChange({...config, matchTemplate: e.target.value})}
            />
          </div>

          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.valorant.sections.rankChangeTemplate')}
            </label>
            <textarea
              rows={7}
              className="form-control form-control-sm"
              placeholder={t('gamesSocials.valorant.templates.rankChangePlaceholder')}
              value={config.rankChangeTemplate || ''}
              onChange={e => onChange({...config, rankChangeTemplate: e.target.value})}
            />
          </div>

          <div>
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.valorant.sections.achievementTemplate')}
            </label>
            <textarea
              rows={7}
              className="form-control form-control-sm"
              placeholder={t('gamesSocials.valorant.templates.achievementPlaceholder')}
              value={config.achievementTemplate || ''}
              onChange={e => onChange({...config, achievementTemplate: e.target.value})}
            />
          </div>

          <div className="form-text tiny mt-2">
            {t('gamesSocials.common.placeholders')}: {TEMPLATE_PLACEHOLDERS.valorant.join(' ')}
          </div>
        </div>

        {/* TEMPLATE PREVIEWS */}
        <div className="genshin-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">
            {t('gamesSocials.genshin.sections.preview')}
          </div>

          <div className="mb-2">
            <div className="small fw-semibold mb-1">{t('gamesSocials.valorant.sections.matchTemplate')}</div>
            <TemplatePreview 
              template={config.matchTemplate} 
              size="lg" 
              type="valorant" 
              config={config} 
              guildRoles={guildRoles} 
            />
          </div>

          <div className="mb-2">
            <div className="small fw-semibold mb-1">{t('gamesSocials.valorant.sections.rankChangeTemplate')}</div>
            <TemplatePreview 
              template={config.rankChangeTemplate} 
              size="lg" 
              type="valorant" 
              config={config} 
              guildRoles={guildRoles} 
            />
          </div>

          <div className="mb-2">
            <div className="small fw-semibold mb-1">{t('gamesSocials.valorant.sections.achievementTemplate')}</div>
            <TemplatePreview 
              template={config.achievementTemplate} 
              size="lg" 
              type="valorant" 
              config={config} 
              guildRoles={guildRoles} 
            />
          </div>

          <div className="form-text tiny mt-2">
            {t('gamesSocials.common.placeholders')}: {TEMPLATE_PLACEHOLDERS.valorant.join(' ')}
          </div>
        </div>
      </div>
    </>
  );
}
