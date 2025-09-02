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
            label="Base XP per Message"
            description="Minimum XP gained per message"
          >
            <input 
              type="number"
              className="form-control form-control-sm"
              min="1"
              max="100"
              value={config.baseXp || 15}
              onChange={(e) => updateConfig('baseXp', parseInt(e.target.value) || 15)}
            />
          </FormField>
        </div>
        <div className="col-md-6">
          <FormField 
            label="Max XP per Message"
            description="Maximum XP gained per message"
          >
            <input 
              type="number"
              className="form-control form-control-sm"
              min="1"
              max="200"
              value={config.maxXp || 25}
              onChange={(e) => updateConfig('maxXp', parseInt(e.target.value) || 25)}
            />
          </FormField>
        </div>
      </div>

      <FormField 
        label="XP Cooldown (seconds)"
        description="Time users must wait between XP gains"
      >
        <input 
          type="number"
          className="form-control form-control-sm"
          min="10"
          max="300"
          value={config.cooldown || 60}
          onChange={(e) => updateConfig('cooldown', parseInt(e.target.value) || 60)}
        />
      </FormField>

      <SwitchToggle
        id="xp-levelup-message"
        label="Level Up Messages"
        checked={config.levelUpMessage !== false}
        onChange={(checked) => updateConfig('levelUpMessage', checked)}
        description="Send a message when users level up"
      />

      {config.levelUpMessage !== false && (
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
        label="XP Multiplier Roles"
        description="Roles that give bonus XP"
      >
        <div className="multiplier-roles">
          {config.multiplierRoles?.map((multiplierRole, index) => (
            <div key={index} className="d-flex gap-2 mb-2 align-items-end">
              <div className="flex-grow-1">
                <select 
                  className="form-select form-select-sm"
                  value={multiplierRole.roleId || ''}
                  onChange={(e) => {
                    const newMultipliers = [...(config.multiplierRoles || [])];
                    newMultipliers[index] = { ...newMultipliers[index], roleId: e.target.value };
                    updateConfig('multiplierRoles', newMultipliers);
                  }}
                >
                  <option value="">Select role...</option>
                  {roles.filter(role => !role.managed && role.name !== '@everyone').map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: '120px' }}>
                <input 
                  type="number"
                  className="form-control form-control-sm"
                  placeholder="Multiplier"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={multiplierRole.multiplier || 1}
                  onChange={(e) => {
                    const newMultipliers = [...(config.multiplierRoles || [])];
                    newMultipliers[index] = { ...newMultipliers[index], multiplier: parseFloat(e.target.value) || 1 };
                    updateConfig('multiplierRoles', newMultipliers);
                  }}
                />
              </div>
              <button 
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => {
                  const newMultipliers = config.multiplierRoles.filter((_, i) => i !== index);
                  updateConfig('multiplierRoles', newMultipliers);
                }}
              >
                <i className="fa-solid fa-trash" />
              </button>
            </div>
          ))}
          <button 
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => {
              updateConfig('multiplierRoles', [...(config.multiplierRoles || []), { roleId: '', multiplier: 1.5 }]);
            }}
          >
            <i className="fa-solid fa-plus me-2" />
            Add Multiplier Role
          </button>
        </div>
      </FormField>
    </div>
  );
}
