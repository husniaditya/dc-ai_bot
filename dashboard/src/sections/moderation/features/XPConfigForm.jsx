import React from 'react';
import { ChannelSelector, FormField, SwitchToggle } from '../components/SharedComponents';

// XP & Leveling Configuration
export default function XPConfigForm({ config, updateConfig, channels, roles }) {
  return (
    <div className="moderation-config-form space-y-4">
      {/* Information Section */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">XP & Leveling System</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-chart-line me-1"></i>
            Member Engagement
          </span>
        </div>
        <p className="text-muted small mb-0" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
          Reward member activity with experience points and level progression. Configure XP rates, cooldowns, 
          multiplier roles for special members, and excluded channels where XP won't be gained.
        </p>
      </div>
      <hr />

      <div className="row">
        <div className="col-md-6">
          <FormField 
            label="XP per Message"
            description="XP gained per message"
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
            label="XP Cooldown (seconds)"
            description="Time users must wait between XP gains"
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
          label="Level Up Channel"
          description="Where to send level up messages (leave empty for same channel)"
        >
          <ChannelSelector
            value={config.levelUpChannel}
            onChange={(value) => updateConfig('levelUpChannel', value)}
            channels={channels}
            placeholder="Same channel as message"
          />
        </FormField>
      )}

      <FormField 
        label="Excluded Channels"
        description="Channels where users won't gain XP"
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
                        }}
                        aria-label={`Remove ${channel.name}`}
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
              }
            }}
            channels={channels.filter(ch => !config.excludedChannels?.includes(ch.id))}
            placeholder="Add channel to exclude"
          />
        </div>
      </FormField>

      <FormField 
        label="Excluded Roles"
        description="Roles that won't gain XP"
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
                        }}
                        aria-label={`Remove ${role.name}`}
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
              }
              e.target.value = ''; // Reset selection
            }}
          >
            <option value="">Add role to exclude...</option>
            {roles
              .filter(role => !role.managed && role.name !== '@everyone' && !config.excludedRoles?.includes(role.id))
              .map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
          </select>
        </div>
      </FormField>

      <FormField 
        label="XP Multiplier Roles"
        description="Roles that get bonus XP multipliers"
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
                            <div className="text-muted-primary" style={{ fontSize: '0.8rem' }}>{roleMultiplier.multiplier}x multiplier</div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => {
                              const newEvents = config.doubleXpEvents.filter(event => event.roleId !== roleMultiplier.roleId);
                              updateConfig('doubleXpEvents', newEvents);
                            }}
                            title="Remove multiplier"
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
            <div className="row g-2 align-items-end">
              <div className="col-md-6">
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: '500' }}>Role</label>
                <select 
                  id="new-multiplier-role"
                  className="form-select form-select-sm"
                  defaultValue=""
                >
                  <option value="">Select role...</option>
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
              <div className="col-md-4">
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: '500' }}>Multiplier</label>
                <input 
                  id="new-multiplier-value"
                  type="number"
                  className="form-control form-control-sm"
                  placeholder="1.5"
                  min="0.1"
                  max="10"
                  step="0.1"
                />
              </div>
              <div className="col-md-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm w-100"
                  onClick={() => {
                    const roleSelect = document.getElementById('new-multiplier-role');
                    const multiplierInput = document.getElementById('new-multiplier-value');
                    
                    const roleId = roleSelect.value;
                    const multiplier = parseFloat(multiplierInput.value);
                    
                    if (roleId && multiplier && multiplier > 0) {
                      const newEvents = [...(config.doubleXpEvents || []), {
                        roleId: roleId,
                        multiplier: multiplier
                      }];
                      updateConfig('doubleXpEvents', newEvents);
                      
                      // Reset form
                      roleSelect.value = '';
                      multiplierInput.value = '';
                    }
                  }}
                >
                  <i className="fa-solid fa-plus me-1"></i>
                  Add
                </button>
              </div>
            </div>
            <div className="mt-2">
              <small className="text-muted">
                <i className="fa-solid fa-info-circle me-1"></i>
                Members with multiple multiplier roles will get the highest multiplier.
              </small>
            </div>
          </div>
        </div>
      </FormField>

      <SwitchToggle
        id="xp-levelup-message"
        label="Level Up Messages"
        checked={config.levelUpMessages !== false}
        onChange={(checked) => updateConfig('levelUpMessages', checked)}
        description="Send a message when users level up"
      />
    </div>
  );
}
