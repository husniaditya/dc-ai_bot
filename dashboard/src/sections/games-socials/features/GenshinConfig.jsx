import React, { useState } from 'react';
import MentionTargetsPicker from '../components/MentionTargetsPicker';
import TemplatePreview from '../components/TemplatePreview';
import { TEMPLATE_PLACEHOLDERS } from '../constants';
import { useI18n } from '../../../i18n';
import { resolveGenshinPlayer } from '../../../api';

// GenshinConfig - Genshin Impact integration configuration component
export default function GenshinConfig({
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
  const [newPlayerUID, setNewPlayerUID] = useState('');
  const [resolving, setResolving] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);

  // Function to validate UID format
  function isValidUID(uid) {
    return /^[1-9]\d{8}$/.test(uid);
  }

  // Function to fetch player name from Enka.Network API
  async function fetchPlayerName(uid) {
    try {
      const playerData = await resolveGenshinPlayer(uid);
      return playerData?.playerInfo?.nickname || `Player ${uid}`;
    } catch (error) {
      console.error('Failed to fetch player name:', error);
      // Use fallback name on any error (network, 404, etc.)
      return `Player ${uid}`;
    }
  }

  if (!config) {
    return (
      <div className="text-muted small">
        {t('gamesSocials.common.loadingConfig', { service: t('gamesSocials.services.genshin.label') })}
      </div>
    );
  }

  async function addPlayer() {
    const rawUID = newPlayerUID.trim();
    if (!rawUID) return;

    // Validate UID format
    if (!isValidUID(rawUID)) {
      pushToast && pushToast('error', t('gamesSocials.genshin.errors.invalidUID'));
      return;
    }

    // Check if UID already exists
    if (config.players.includes(rawUID)) {
      pushToast && pushToast('error', t('gamesSocials.genshin.errors.playerExists'));
      return;
    }

    setResolving(true);

    try {
      // Fetch player name to validate UID
      const playerName = await fetchPlayerName(rawUID);
      
      // Add to the list
      const newPlayers = [...config.players, rawUID];
      const newPlayerNames = { ...config.playerNames, [rawUID]: playerName };
      
      onChange({
        ...config,
        players: newPlayers,
        playerNames: newPlayerNames
      });

      setNewPlayerUID('');
      pushToast && pushToast('success', t('gamesSocials.genshin.messages.playerAdded', { player: playerName }));
    } catch (error) {
      console.error('Error adding player:', error);
      pushToast && pushToast('error', t('gamesSocials.genshin.errors.playerNotFound'));
    } finally {
      setResolving(false);
    }
  }

  function removePlayer(uid) {
    const newPlayers = config.players.filter(p => p !== uid);
    const newPlayerNames = { ...config.playerNames };
    const newPlayerMessages = { ...config.playerMessages };
    
    delete newPlayerNames[uid];
    delete newPlayerMessages[uid];
    
    onChange({
      ...config,
      players: newPlayers,
      playerNames: newPlayerNames,
      playerMessages: newPlayerMessages
    });

    pushToast && pushToast('success', t('gamesSocials.genshin.messages.playerRemoved'));
  }

  function updatePlayerMessage(uid, message) {
    onChange({
      ...config,
      playerMessages: {
        ...config.playerMessages,
        [uid]: message
      }
    });
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
              {t('gamesSocials.genshin.help.interval')}
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
                  checked={config.trackProfileUpdates || false}
                  onChange={e => onChange({...config, trackProfileUpdates: e.target.checked})}
                />
                <label className="form-check-label small">
                  {t('gamesSocials.genshin.options.trackProfileUpdates')}
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
                  {t('gamesSocials.genshin.options.trackAchievements')}
                </label>
              </div>
              <div className="form-check form-check-sm">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  checked={config.trackSpiralAbyss || false}
                  onChange={e => onChange({...config, trackSpiralAbyss: e.target.checked})}
                />
                <label className="form-check-label small">
                  {t('gamesSocials.genshin.options.trackSpiralAbyss')}
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* PLAYERS MANAGEMENT */}
        <div className="genshin-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">
            {t('gamesSocials.genshin.playersToTrack')} ({config.players?.length || 0})
          </div>
          
          {/* Add Player Form */}
          <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
            <div style={{ flex: '1 1 260px' }}>
              <label className="form-label small fw-semibold mb-1">
                {t('gamesSocials.genshin.placeholders.playerUID')}
              </label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder={t('gamesSocials.genshin.placeholders.playerUID')}
                value={newPlayerUID}
                onChange={e => setNewPlayerUID(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPlayer();
                  }
                }}
              />
            </div>
            <button 
              type="button" 
              className="btn btn-sm btn-accent" 
              onClick={addPlayer}
              disabled={resolving || !newPlayerUID.trim()}
            >
              <i className="fa-solid fa-plus" /> {resolving ? t('gamesSocials.common.resolving') : t('common.add')}
            </button>
          </div>

          <div className="form-text tiny mb-3">
            {t('gamesSocials.genshin.help.addPlayer')}
          </div>

          {/* Players List */}
          <ul className="genshin-player-list list-unstyled m-0 p-0">
            {(!Array.isArray(config.players) || config.players.length === 0) && (
              <li className="text-muted small py-2">{t('gamesSocials.genshin.noPlayers')}</li>
            )}

            {Array.isArray(config.players) &&
              config.players.map((uid) => {
                const playerName = config.playerNames?.[uid] || `Player ${uid}`;
                const isEditing = editingPlayer === uid;

                return (
                  <li key={uid} className={"genshin-player-item " + (isEditing ? 'editing' : '')}>
                    <div className="genshin-player-row">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <code className="small text-muted">{uid}</code>
                          <div className="flex-grow-1">
                            <div className="fw-semibold small">{playerName}</div>
                          </div>
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-2 ms-2">
                        <button
                          type="button"
                          className="btn btn-icon btn-xs"
                          title={t('gamesSocials.genshin.customMessage', { player: playerName })}
                          onClick={() => setEditingPlayer((p) => (p === uid ? null : uid))}
                        >
                          <i className="fa-solid fa-pen" />
                        </button>

                        <button
                          type="button"
                          className="btn btn-icon btn-xs text-danger"
                          title={t('gamesSocials.common.remove')}
                          onClick={() => removePlayer(uid)}
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="genshin-player-edit mt-2">
                        <label className="form-label tiny fw-semibold mb-1">
                          {t('gamesSocials.genshin.customMessage', { player: playerName })}
                        </label>
                        <textarea
                          rows={2}
                          className="form-control form-control-sm"
                          placeholder={t('gamesSocials.genshin.placeholders.customMessage')}
                          value={config.playerMessages?.[uid] || ''}
                          onChange={e => updatePlayerMessage(uid, e.target.value)}
                        />
                        <div className="form-text tiny mt-1">
                          {t('gamesSocials.genshin.help.customMessage')}
                        </div>
                        
                        <div className="d-flex gap-2 mt-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => updatePlayerMessage(uid, '')}
                          >
                            {t('gamesSocials.common.clearOverrides')}
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-outline-light" 
                            onClick={() => setEditingPlayer(null)}
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

        {/* CHANNELS & MENTIONS */}
        <div className="genshin-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">
            {t('gamesSocials.common.announcementChannels')}
          </div>
          
          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.genshin.channels.profileUpdates')}
            </label>
            <select 
              className="form-select form-select-sm"
              value={config.profileAnnounceChannelId || ''}
              onChange={e => onChange({...config, profileAnnounceChannelId: e.target.value || null})}
            >
              <option value="">{t('gamesSocials.common.select')}</option>
              {discordChannels.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.genshin.channels.achievements')}
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
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.genshin.channels.spiralAbyss')}
            </label>
            <select 
              className="form-select form-select-sm"
              value={config.spiralAbyssAnnounceChannelId || ''}
              onChange={e => onChange({...config, spiralAbyssAnnounceChannelId: e.target.value || null})}
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
              {t('gamesSocials.genshin.help.mentionTargets')}
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.genshin.settings.minAchievementThreshold')}
            </label>
            <input 
              type="number" 
              className="form-control form-control-sm" 
              style={{ width: 110 }}
              min="1" 
              max="100"
              value={config.minAchievementThreshold || 10}
              onChange={e => onChange({...config, minAchievementThreshold: parseInt(e.target.value) || 10})}
            />
            <div className="form-text tiny text-muted mt-1">
              {t('gamesSocials.genshin.help.minAchievementThreshold')}
            </div>
          </div>
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
              {t('gamesSocials.genshin.templates.profileUpdate')}
            </label>
            <textarea
              rows={7}
              className="form-control form-control-sm"
              placeholder={t('gamesSocials.genshin.placeholders.profileUpdateTemplate')}
              value={config.profileUpdateTemplate || ''}
              onChange={e => onChange({...config, profileUpdateTemplate: e.target.value})}
            />
          </div>

          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.genshin.templates.achievement')}
            </label>
            <textarea
              rows={7}
              className="form-control form-control-sm"
              placeholder={t('gamesSocials.genshin.placeholders.achievementTemplate')}
              value={config.achievementTemplate || ''}
              onChange={e => onChange({...config, achievementTemplate: e.target.value})}
            />
          </div>

          <div>
            <label className="form-label small fw-semibold mb-1">
              {t('gamesSocials.genshin.templates.spiralAbyss')}
            </label>
            <textarea
              rows={7}
              className="form-control form-control-sm"
              placeholder={t('gamesSocials.genshin.placeholders.spiralAbyssTemplate')}
              value={config.spiralAbyssTemplate || ''}
              onChange={e => onChange({...config, spiralAbyssTemplate: e.target.value})}
            />
          </div>

          <div className="form-text tiny mt-2">
            {t('gamesSocials.common.placeholders')}: {TEMPLATE_PLACEHOLDERS.genshin.join(' ')}
          </div>
        </div>

        {/* TEMPLATE PREVIEW */}
        <div className="genshin-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">
            {t('gamesSocials.genshin.sections.preview')}
          </div>

          <div className="mb-2">
            <div className="small fw-semibold mb-1">{t('gamesSocials.genshin.templates.profileUpdate')}</div>
            <TemplatePreview 
              template={config.profileUpdateTemplate} 
              size="lg" 
              type="genshin" 
              config={config} 
              guildRoles={guildRoles} 
            />
          </div>

          <div className="mb-2">
            <div className="small fw-semibold mb-1">{t('gamesSocials.genshin.templates.achievement')}</div>
            <TemplatePreview 
              template={config.achievementTemplate} 
              size="lg" 
              type="genshin" 
              config={config} 
              guildRoles={guildRoles} 
            />
          </div>

          <div className="mb-2">
            <div className="small fw-semibold mb-1">{t('gamesSocials.genshin.templates.spiralAbyss')}</div>
            <TemplatePreview 
              template={config.spiralAbyssTemplate} 
              size="lg" 
              type="genshin" 
              config={config} 
              guildRoles={guildRoles} 
            />
          </div>

          <div className="form-text tiny mt-2">
            {t('gamesSocials.common.placeholders')}: {TEMPLATE_PLACEHOLDERS.genshin.join(' ')}
          </div>
        </div>
      </div>
    </>
  );
}