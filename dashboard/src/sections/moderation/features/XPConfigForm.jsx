import React from 'react';
import { ChannelSelector, FormField, SwitchToggle } from '../components/SharedComponents';
import { useI18n } from '../../../i18n';

// XP & Leveling Configuration
export default function XPConfigForm({ config, updateConfig, channels, roles, showToast }) {
  const { t } = useI18n();
  return (
    <div className="moderation-config-form space-y-4">
      {/* Information Section */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">{t('moderation.features.xp.header')}</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-chart-line me-1"></i>
            {t('moderation.features.xp.badge')}
          </span>
        </div>
        <p className="text-muted small mb-0" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
          {t('moderation.features.xp.info.description')}
        </p>
      </div>
      <hr />

      <div className="row">
        <div className="col-md-6">
          <FormField 
            label={t('moderation.features.xp.fields.xpPerMessage.label')}
            description={t('moderation.features.xp.fields.xpPerMessage.desc')}
          >
            <input 
              type="number"
              className="form-control form-control-sm"
              min="1"
              max="100"
              value={config.xpPerMessage || 15}
              onChange={(e) => updateConfig('xpPerMessage', parseInt(e.target.value) || 15)}
            />
          </FormField>
        </div>
        <div className="col-md-6">
          <FormField 
            label={t('moderation.features.xp.fields.cooldownSeconds.label')}
            description={t('moderation.features.xp.fields.cooldownSeconds.desc')}
          >
            <input 
              type="number"
              className="form-control form-control-sm"
              min="10"
              max="300"
              value={config.cooldownSeconds || 60}
              onChange={(e) => updateConfig('cooldownSeconds', parseInt(e.target.value) || 60)}
            />
          </FormField>
        </div>
      </div>

      {config.levelUpMessages !== false && (
        <FormField 
          label={t('moderation.features.xp.fields.levelUpChannel.label')}
          description={t('moderation.features.xp.fields.levelUpChannel.desc')}
        >
          <ChannelSelector
            value={config.levelUpChannel}
            onChange={(value) => updateConfig('levelUpChannel', value)}
            channels={channels}
            placeholder={t('moderation.features.xp.placeholders.sameChannel')}
          />
        </FormField>
      )}

      <FormField 
        label={t('moderation.features.xp.fields.excludedChannels.label')}
        description={t('moderation.features.xp.fields.excludedChannels.desc')}
      >
        <div className="excluded-channels">
          {config.excludedChannels?.length > 0 && (
            <div className="selected-channels mb-2">
              <div className="d-flex flex-wrap gap-1">
                {config.excludedChannels.map(channelId => {
                  const channel = channels.find(c => c.id === channelId);
                  if (!channel) return null;
                  return (
                    <span key={channelId} className="badge bg-secondary d-flex align-items-center gap-1">
                      #{channel.name}
                      <button
                        type="button"
                        className="btn-close btn-close-white"
                        style={{ fontSize: '0.6em' }}
                        onClick={() => {
                          const newExcluded = config.excludedChannels.filter(id => id !== channelId);
                          updateConfig('excludedChannels', newExcluded);
                          showToast?.('success', t('moderation.features.xp.toasts.removedExcludedChannel', { name: channel.name }));
                        }}
                        aria-label={t('moderation.features.xp.aria.removeItem', { name: channel.name })}
                      />
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          
          <ChannelSelector
            value=""
            onChange={(channelId) => {
              if (channelId && !config.excludedChannels?.includes(channelId)) {
                updateConfig('excludedChannels', [...(config.excludedChannels || []), channelId]);
                const ch = channels.find(c => c.id === channelId);
                if (ch) showToast?.('success', t('moderation.features.xp.toasts.addedExcludedChannel', { name: ch.name }));
              }
            }}
            channels={channels.filter(ch => !config.excludedChannels?.includes(ch.id))}
            placeholder={t('moderation.features.xp.placeholders.addChannelToExclude')}
          />
        </div>
      </FormField>

      <FormField 
        label={t('moderation.features.xp.fields.excludedRoles.label')}
        description={t('moderation.features.xp.fields.excludedRoles.desc')}
      >
        <div className="excluded-roles">
          {config.excludedRoles?.length > 0 && (
            <div className="selected-roles mb-2">
              <div className="d-flex flex-wrap gap-1">
                {config.excludedRoles.map(roleId => {
                  const role = roles.find(r => r.id === roleId);
                  if (!role) return null;
                  return (
                    <span key={roleId} className="badge bg-secondary d-flex align-items-center gap-1">
                      @{role.name}
                      <button
                        type="button"
                        className="btn-close btn-close-white"
                        style={{ fontSize: '0.6em' }}
                        onClick={() => {
                          const newExcluded = config.excludedRoles.filter(id => id !== roleId);
                          updateConfig('excludedRoles', newExcluded);
                          showToast?.('success', t('moderation.features.xp.toasts.removedExcludedRole', { name: role.name }));
                        }}
                        aria-label={t('moderation.features.xp.aria.removeItem', { name: role.name })}
                      />
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          
          <select 
            className="form-select form-select-sm"
            value=""
            onChange={(e) => {
              const roleId = e.target.value;
              if (roleId && !config.excludedRoles?.includes(roleId)) {
                updateConfig('excludedRoles', [...(config.excludedRoles || []), roleId]);
                const rr = roles.find(r => r.id === roleId);
                if (rr) showToast?.('success', t('moderation.features.xp.toasts.addedExcludedRole', { name: rr.name }));
              }
              e.target.value = ''; // Reset selection
            }}
          >
            <option value="">{t('moderation.features.xp.placeholders.addRoleToExclude')}</option>
            {roles
              .filter(role => !role.managed && role.name !== '@everyone' && !config.excludedRoles?.includes(role.id))
              .map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
          </select>
        </div>
      </FormField>

      <FormField 
        label={t('moderation.features.xp.multipliers.label')}
        description={t('moderation.features.xp.multipliers.desc')}
      >
        <div className="role-multipliers">
          {config.doubleXpEvents?.filter(event => event.roleId)?.length > 0 && (
            <div className="current-multipliers mb-3">
              <div className="d-flex flex-wrap gap-2">
                {config.doubleXpEvents.filter(event => event.roleId).map((roleMultiplier, index) => {
                  const role = roles.find(r => r.id === roleMultiplier.roleId);
                  if (!role) return null;
                  return (
                    <div key={index} className="card-xp-roles" style={{ minWidth: '200px' }}>
                      <div className="card-xp-body py-2 px-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold text-success" style={{ fontSize: '0.9rem' }}>@{role.name}</div>
                            <div className="text-muted-primary" style={{ fontSize: '0.8rem' }}>{roleMultiplier.multiplier}{t('moderation.features.xp.multipliers.multiplierSuffix')}</div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => {
                              const newEvents = config.doubleXpEvents.filter(event => event.roleId !== roleMultiplier.roleId);
                              updateConfig('doubleXpEvents', newEvents);
                              showToast?.('success', t('moderation.features.xp.toasts.multiplierRemoved', { name: role.name }));
                            }}
                            title={t('moderation.features.xp.multipliers.remove')}
                          >
                            <i className="fa-solid fa-trash" style={{ fontSize: '0.8rem' }}></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="add-multiplier-form">
            {/* Use consistent label + spacing styles to align with other FormField inputs */}
            <div className="row g-2">
              <div className="col-md-6">
                <div className="mb-2 mb-md-0">
                  <label className="form-label small fw-semibold mb-1" htmlFor="new-multiplier-role">{t('moderation.features.xp.multipliers.roleLabel')}</label>
                  <select 
                    id="new-multiplier-role"
                    className="form-select form-select-sm"
                    defaultValue=""
                  >
                    <option value="">{t('moderation.features.xp.placeholders.selectRole')}</option>
                    {roles
                      .filter(role => 
                        !role.managed && 
                        role.name !== '@everyone' && 
                        !config.doubleXpEvents?.some(event => event.roleId === role.id)
                      )
                      .map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="col-md-4">
                <div className="mb-2 mb-md-0">
                  <label className="form-label small fw-semibold mb-1" htmlFor="new-multiplier-value">{t('moderation.features.xp.multipliers.multiplierLabel')}</label>
                  <input 
                    id="new-multiplier-value"
                    type="number"
                    className="form-control form-control-sm"
                    placeholder={t('moderation.features.xp.placeholders.multiplier')}
                    min="0.1"
                    max="10"
                    step="0.1"
                  />
                </div>
              </div>
              <div className="col-md-2">
                {/* Invisible label to preserve vertical rhythm with other fields */}
                <label className="form-label small fw-semibold mb-1 invisible">{t('common.add')}</label>
                <button
                  type="button"
                  className="btn btn-primary btn-sm w-100"
                  onClick={() => {
                    const roleSelect = document.getElementById('new-multiplier-role');
                    const multiplierInput = document.getElementById('new-multiplier-value');
                    const roleId = roleSelect.value;
                    const multiplier = parseFloat(multiplierInput.value);
                    if (roleId && multiplier && multiplier > 0) {
                      const newEvents = [...(config.doubleXpEvents || []), { roleId, multiplier }];
                      updateConfig('doubleXpEvents', newEvents);
                      roleSelect.value = '';
                      multiplierInput.value = '';
                      const role = roles.find(r => r.id === roleId);
                      if (role) showToast?.('success', t('moderation.features.xp.toasts.multiplierAdded', { name: role.name, value: multiplier }));
                    } else {
                      showToast?.('error', t('moderation.features.xp.toasts.invalidMultiplier'));
                    }
                  }}
                >
                  <i className="fa-solid fa-plus me-1"></i>
                  {t('common.add')}
                </button>
              </div>
            </div>
            <div className="mt-2">
              <small className="text-muted">
                <i className="fa-solid fa-info-circle me-1"></i>
                {t('moderation.features.xp.multipliers.note')}
              </small>
            </div>
          </div>
        </div>
      </FormField>

      <SwitchToggle
        id="xp-levelup-message"
        label={t('moderation.features.xp.fields.levelUpMessages.label')}
        checked={config.levelUpMessages !== false}
        onChange={(checked) => updateConfig('levelUpMessages', checked)}
        description={t('moderation.features.xp.fields.levelUpMessages.desc')}
      />
    </div>
  );
}
