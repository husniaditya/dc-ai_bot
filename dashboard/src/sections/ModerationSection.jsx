import React, { useEffect, useState, useRef } from 'react';
import { getChannels, getRoles } from '../api.js';

// Moderation features with their configurations
const MODERATION_FEATURES = [
  {
    key: 'welcome',
    label: 'Welcome Messages',
    icon: 'fa-door-open',
    color: '#10b981',
    desc: 'Greet new members with customizable welcome messages and cards.',
    features: ['Custom Messages', 'Welcome Cards', 'Role Assignment', 'Channel Selection']
  },
  {
    key: 'automod',
    label: 'Auto Moderation',
    icon: 'fa-robot',
    color: '#dc2626',
    desc: 'Automatically detect and handle spam, excessive caps, and inappropriate content.',
    features: ['Spam Detection', 'Caps Lock Filter', 'Link Filtering', 'Profanity Filter']
  },
  {
    key: 'roles',
    label: 'Role Management',
    icon: 'fa-users-gear',
    color: '#8b5cf6',
    desc: 'Manage roles with reaction roles and automated role assignment.',
    features: ['Reaction Roles', 'Auto Roles', 'Role Menus', 'Permission Sync']
  },
  {
    key: 'xp',
    label: 'XP & Leveling',
    icon: 'fa-chart-line',
    color: '#06b6d4',
    desc: 'Reward active members with XP points and level progression.',
    features: ['XP Tracking', 'Level Rewards', 'Leaderboards', 'Custom Multipliers']
  },
  {
    key: 'scheduler',
    label: 'Scheduled Messages',
    icon: 'fa-calendar-days',
    color: '#3b82f6',
    desc: 'Schedule announcements and recurring messages for your server.',
    features: ['Scheduled Posts', 'Recurring Messages', 'Event Reminders', 'Auto Announcements']
  },
  {
    key: 'logging',
    label: 'Audit Logging',
    icon: 'fa-clipboard-list',
    color: '#f97316',
    desc: 'Track all moderation actions and server changes.',
    features: ['Message Logs', 'Member Logs', 'Channel Logs', 'Role Logs']
  },
  {
    key: 'antiraid',
    label: 'Anti-Raid Protection',
    icon: 'fa-shield',
    color: '#ef4444',
    desc: 'Protect your server from raids and mass join attacks.',
    features: ['Join Rate Limiting', 'Account Age Filter', 'Auto Lockdown', 'Verification System']
  }
];

export default function ModerationSection({ guildId, pushToast }) {
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeFeature, setActiveFeature] = useState(null);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);

  // Load moderation configurations
  useEffect(() => {
    if (!guildId) return;
    
    const loadModerationConfig = async () => {
      setLoading(true);
      try {
        const [featuresResponse, channelsData, rolesData] = await Promise.all([
          fetch('/api/moderation/features', {
            headers: { 
              Authorization: 'Bearer ' + localStorage.getItem('token'),
              'X-Guild-Id': guildId
            }
          }),
          getChannels(guildId),
          getRoles(guildId)
        ]);
        
        if (featuresResponse.ok) {
          const data = await featuresResponse.json();
          setFeatures(data || {});
        } else {
          // Initialize with default disabled state if no config exists
          const defaultConfig = {};
          MODERATION_FEATURES.forEach(feature => {
            defaultConfig[feature.key] = {
              enabled: false,
              config: {}
            };
          });
          setFeatures(defaultConfig);
        }

        if (channelsData && channelsData.channels) {
          setChannels(channelsData.channels);
        }

        if (rolesData && rolesData.roles) {
          setRoles(rolesData.roles);
        }
      } catch (error) {
        console.error('Failed to load moderation config:', error);
        // Initialize with default disabled state on error
        const defaultConfig = {};
        MODERATION_FEATURES.forEach(feature => {
          defaultConfig[feature.key] = {
            enabled: false,
            config: {}
          };
        });
        setFeatures(defaultConfig);
      } finally {
        setLoading(false);
      }
    };

    loadModerationConfig();
  }, [guildId]);

  // Toggle feature enabled state
  const toggleFeature = async (featureKey) => {
    if (saving[featureKey]) return;

    const currentState = features[featureKey]?.enabled || false;
    const newState = !currentState;

    // Optimistic update
    setFeatures(prev => ({
      ...prev,
      [featureKey]: {
        ...prev[featureKey],
        enabled: newState
      }
    }));

    setSaving(prev => ({ ...prev, [featureKey]: true }));

    try {
      const response = await fetch(`/api/moderation/features/${featureKey}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
          'X-Guild-Id': guildId
        },
        body: JSON.stringify({
          enabled: newState
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update feature');
      }
      
      const featureName = MODERATION_FEATURES.find(f => f.key === featureKey)?.label || featureKey;
      pushToast?.('success', `${featureName} ${newState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      // Revert on error
      setFeatures(prev => ({
        ...prev,
        [featureKey]: {
          ...prev[featureKey],
          enabled: currentState
        }
      }));
      pushToast?.('error', 'Failed to update feature');
    } finally {
      setSaving(prev => ({ ...prev, [featureKey]: false }));
    }
  };

  // Open configuration modal
  const openConfigModal = (featureKey) => {
    const feature = MODERATION_FEATURES.find(f => f.key === featureKey);
    setActiveFeature({
      ...feature,
      config: features[featureKey]?.config || {}
    });
    setShowConfigModal(true);
  };

  // Close configuration modal
  const closeConfigModal = () => {
    setShowConfigModal(false);
    setActiveFeature(null);
  };

  // Save feature configuration
  const saveFeatureConfig = async (config) => {
    if (!activeFeature) return;

    try {
      const response = await fetch(`/api/moderation/features/${activeFeature.key}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
          'X-Guild-Id': guildId
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      // Update local state
      setFeatures(prev => ({
        ...prev,
        [activeFeature.key]: {
          ...prev[activeFeature.key],
          config: config
        }
      }));

      pushToast?.('success', `${activeFeature.label} configuration saved`);
      closeConfigModal();
    } catch (error) {
      pushToast?.('error', 'Failed to save configuration');
    }
  };

  if (loading) {
    return (
      <div className="moderation-section fade-in-soft">
        <div className="loading-overlay">
          <div className="spinner" />
          <div className="loading-text small mt-3 text-muted">Loading moderation features…</div>
        </div>
        <div className="d-flex align-items-center gap-2 mb-3">
          <h5 className="mb-0">Moderation</h5>
        </div>
        <div className="row g-4 moderation-features-row">
          {MODERATION_FEATURES.map(feature => (
            <div key={feature.key} className="col-md-6 col-lg-4">
              <div 
                className="moderation-card card-glass h-100 p-3 position-relative"
                style={{ '--feature-color': feature.color }}
              >
                <div className="d-flex align-items-start gap-3 mb-3">
                  <div 
                    className="feature-icon d-flex align-items-center justify-content-center"
                    style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '2px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    <i 
                      className={`fa-solid ${feature.icon}`}
                      style={{ 
                        fontSize: '1.2rem',
                        color: 'rgba(255,255,255,0.5)'
                      }}
                    />
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="mb-1 fw-semibold">{feature.label}</h6>
                    <div className="status-badge disabled">Loading...</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="moderation-section fade-in-soft">
      <div className="d-flex align-items-center gap-2 mb-3">
        <h5 className="mb-0">Moderation</h5>
        <span className="badge badge-soft">
          {Object.values(features).filter(f => f.enabled).length} of {MODERATION_FEATURES.length} enabled
        </span>
      </div>
      
      <div className="row g-4 moderation-features-row">
        {MODERATION_FEATURES.map(feature => {
          const isEnabled = features[feature.key]?.enabled || false;
          const isSaving = saving[feature.key] || false;
          
          return (
            <div key={feature.key} className="col-md-6 col-lg-4">
              <div 
                className={`moderation-card card-glass h-100 p-3 position-relative ${isEnabled ? 'enabled' : ''}`}
                style={{ '--feature-color': feature.color }}
              >
                {/* Toggle Switch */}
                <div className="position-absolute top-0 end-0 p-2">
                  <div className="form-check form-switch m-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={isEnabled}
                      disabled={isSaving}
                      onChange={() => toggleFeature(feature.key)}
                      style={{ cursor: isSaving ? 'not-allowed' : 'pointer' }}
                    />
                  </div>
                </div>

                {/* Feature Header */}
                <div className="d-flex align-items-start gap-3 mb-3">
                  <div 
                    className="feature-icon d-flex align-items-center justify-content-center"
                    style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: 12,
                      backgroundColor: isEnabled ? feature.color + '20' : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${isEnabled ? feature.color : 'rgba(255,255,255,0.1)'}`,
                      '--feature-color': feature.color,
                      '--feature-color-bg': feature.color + '15'
                    }}
                  >
                    <i 
                      className={`fa-solid ${feature.icon}`}
                      style={{ 
                        fontSize: '1.2rem',
                        color: isEnabled ? feature.color : 'rgba(255,255,255,0.5)'
                      }}
                    />
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="mb-1 fw-semibold">{feature.label}</h6>
                    <div className={`status-badge ${isEnabled ? 'enabled' : 'disabled'}`}>
                      {isSaving ? 'Updating...' : (isEnabled ? 'Enabled' : 'Disabled')}
                    </div>
                  </div>
                </div>

                {/* Feature Description */}
                <p className="text-muted small mb-3" style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                  {feature.desc}
                </p>

                {/* Feature List */}
                <div className="feature-list">
                  <div className="small text-muted mb-2 fw-semibold">Features:</div>
                  <ul className="list-unstyled mb-0">
                    {feature.features.map((featureName, index) => (
                      <li key={index} className="d-flex align-items-center gap-2 mb-1">
                        <i 
                          className={`fa-solid fa-circle-check`}
                          style={{ 
                            fontSize: '0.7rem',
                            color: isEnabled ? feature.color : 'rgba(255,255,255,0.3)'
                          }}
                        />
                        <span 
                          className="small"
                          style={{ 
                            fontSize: '0.75rem',
                            color: isEnabled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'
                          }}
                        >
                          {featureName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Configure Button (only shown when enabled) */}
                {isEnabled && (
                  <div className="mt-3 pt-3 border-top border-secondary border-opacity-25 text-center">
                    <button 
                      className="btn btn-sm btn-primary configure-btn"
                      onClick={() => openConfigModal(feature.key)}
                    >
                      <i className="fa-solid fa-gear me-2" />
                      Configure
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Section */}
      <div className="mt-4 pt-4 border-top border-secondary border-opacity-25">
        <div className="row">
          <div className="col-md-8">
            <h6 className="mb-2">Moderation Overview</h6>
            <p className="text-muted small mb-0">
              Configure automated moderation tools to keep your server safe and organized. 
              Each feature can be enabled independently and customized to fit your community's needs.
            </p>
          </div>
          <div className="col-md-4">
            <div className="text-end">
              <div className="small text-muted mb-1">Protection Level</div>
              <div className="progress" style={{ height: 8 }}>
                <div 
                  className="progress-bar bg-primary"
                  style={{ 
                    width: `${(Object.values(features).filter(f => f.enabled).length / MODERATION_FEATURES.length) * 100}%`
                  }}
                />
              </div>
              <div className="small text-muted mt-1">
                {Math.round((Object.values(features).filter(f => f.enabled).length / MODERATION_FEATURES.length) * 100)}% Complete
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfigModal && activeFeature && (
        <ConfigurationModal
          feature={activeFeature}
          channels={channels}
          roles={roles}
          onSave={saveFeatureConfig}
          onClose={closeConfigModal}
        />
      )}
    </div>
  );
}

// Configuration Modal Component
function ConfigurationModal({ feature, channels, roles, onSave, onClose }) {
  const [config, setConfig] = useState(feature.config || {});
  const [originalConfig, setOriginalConfig] = useState(feature.config || {});
  const [saving, setSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Update original config when feature config changes
  useEffect(() => {
    setConfig(feature.config || {});
    setOriginalConfig(feature.config || {});
  }, [feature.config]);

  // Check if configuration has been modified
  const isDirty = () => {
    return JSON.stringify(config) !== JSON.stringify(originalConfig);
  };

  // Reset configuration to original values
  const resetConfig = () => {
    setConfig(originalConfig);
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await onSave(config);
    setSaving(false);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 150); // Match animation duration
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div 
      className={`modal show d-block modal-backdrop-animated ${isClosing ? 'closing' : ''}`} 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={`modal-dialog modal-lg modal-content-animated ${isClosing ? 'closing' : ''}`}>
        <div className="modal-content bg-dark text-light">
          <div className="modal-header border-secondary">
            <h5 className="modal-title d-flex align-items-center gap-2">
              <i className={`fa-solid ${feature.icon}`} style={{ color: feature.color }} />
              {feature.label} Configuration
              {isDirty() && <span className="dirty-badge">Unsaved</span>}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={handleClose} />
          </div>
          <div className="modal-body">
            {renderConfigForm(feature.key, config, updateConfig, channels, roles)}
          </div>
          <div className="modal-footer border-secondary">
            <button 
              type="button" 
              className="btn btn-outline-secondary" 
              onClick={resetConfig}
              disabled={!isDirty() || saving}
            >
              <i className="fa-solid fa-rotate-left me-2" />
              Reset
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              <i className="fa-solid fa-times me-2" />
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleSave}
              disabled={!isDirty() || saving}
            >
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} me-2`} />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Render different config forms based on feature type
function renderConfigForm(featureKey, config, updateConfig, channels, roles) {
  switch (featureKey) {
    case 'welcome':
      return (
        <WelcomeConfigForm 
          config={config} 
          updateConfig={updateConfig} 
          channels={channels} 
          roles={roles} 
        />
      );
    case 'automod':
      return (
        <AutomodConfigForm 
          config={config} 
          updateConfig={updateConfig} 
          channels={channels} 
          roles={roles}
        />
      );
    case 'roles':
      return (
        <RolesConfigForm 
          config={config} 
          updateConfig={updateConfig} 
          channels={channels} 
          roles={roles} 
        />
      );
    case 'xp':
      return (
        <XPConfigForm 
          config={config} 
          updateConfig={updateConfig} 
          channels={channels} 
          roles={roles} 
        />
      );
    case 'scheduler':
      return (
        <SchedulerConfigForm 
          config={config} 
          updateConfig={updateConfig} 
          channels={channels} 
        />
      );
    case 'logging':
      return (
        <LoggingConfigForm 
          config={config} 
          updateConfig={updateConfig} 
          channels={channels} 
        />
      );
    case 'antiraid':
      return (
        <AntiRaidConfigForm 
          config={config} 
          updateConfig={updateConfig} 
          channels={channels} 
          roles={roles} 
        />
      );
    default:
      return <div className="text-muted">Configuration coming soon...</div>;
  }
}

// Welcome Messages Configuration
function WelcomeConfigForm({ config, updateConfig, channels, roles }) {
  return (
    <div className="moderation-config-form space-y-4">
      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Welcome Channel</label>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.channelId || ''}
          onChange={(e) => updateConfig('channelId', e.target.value)}
        >
          <option value="">Select a channel...</option>
          {channels.filter(ch => ch.type === 0).map(channel => (
            <option key={channel.id} value={channel.id}>#{channel.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Welcome Message</label>
        <textarea 
          className="form-control form-control-sm custom-input"
          rows={3}
          value={config.message || 'Welcome to {server}, {user}!'}
          onChange={(e) => updateConfig('message', e.target.value)}
          placeholder="Use {user} for mention, {username} for name, {server} for server name"
        />
        <small className="text-muted">Available variables: {`{user}, {username}, {server}, {memberCount}`}</small>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.cardEnabled || false}
            onChange={(e) => updateConfig('cardEnabled', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Enable Welcome Card</label>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Auto Role (Optional)</label>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.autoRoleId || ''}
          onChange={(e) => updateConfig('autoRoleId', e.target.value)}
        >
          <option value="">No auto role</option>
          {roles.filter(role => !role.managed && role.name !== '@everyone').map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Auto Moderation Configuration
function AutomodConfigForm({ config, updateConfig, channels, roles }) {
  return (
    <div className="moderation-config-form space-y-4">
      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.spamDetection || false}
            onChange={(e) => updateConfig('spamDetection', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Spam Detection</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.capsFilter || false}
            onChange={(e) => updateConfig('capsFilter', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Excessive Caps Filter</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.linkFilter || false}
            onChange={(e) => updateConfig('linkFilter', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Link Filter</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.profanityFilter || false}
            onChange={(e) => updateConfig('profanityFilter', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Profanity Filter</label>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Log Channel</label>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.logChannelId || ''}
          onChange={(e) => updateConfig('logChannelId', e.target.value)}
        >
          <option value="">No logging</option>
          {channels.filter(ch => ch.type === 0).map(channel => (
            <option key={channel.id} value={channel.id}>#{channel.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Auto Delete Violations</label>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.autoDelete || 'false'}
          onChange={(e) => updateConfig('autoDelete', e.target.value === 'true')}
        >
          <option value="false">Warn only</option>
          <option value="true">Delete messages</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold d-flex align-items-center gap-2 mb-1">
          Bypass Roles 
          {config.bypassRoles?.length ? (
            <span className="badge-soft" style={{fontSize:'.55rem'}}>
              {config.bypassRoles.length}
            </span>
          ) : null}
        </label>
        <BypassRolesPicker
          value={config.bypassRoles || []}
          onChange={(list) => updateConfig('bypassRoles', list)}
          roles={roles}
        />
        <small className="text-muted mt-1 d-block">
          Members with these roles will bypass all auto moderation filters
        </small>
      </div>
    </div>
  );
}

// Role Management Configuration
function RolesConfigForm({ config, updateConfig, channels, roles }) {
  return (
    <div className="moderation-config-form space-y-4">
      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.reactionRoles || false}
            onChange={(e) => updateConfig('reactionRoles', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Enable Reaction Roles</label>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Reaction Roles Channel</label>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.reactionChannelId || ''}
          onChange={(e) => updateConfig('reactionChannelId', e.target.value)}
        >
          <option value="">Select a channel...</option>
          {channels.filter(ch => ch.type === 0).map(channel => (
            <option key={channel.id} value={channel.id}>#{channel.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.autoRoles || false}
            onChange={(e) => updateConfig('autoRoles', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Auto Role Assignment</label>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Role Menu Message</label>
        <textarea 
          className="form-control form-control-sm custom-input"
          rows={3}
          value={config.menuMessage || 'React to get your roles!'}
          onChange={(e) => updateConfig('menuMessage', e.target.value)}
          placeholder="Message to show above role reactions"
        />
      </div>
    </div>
  );
}

// XP & Leveling Configuration
function XPConfigForm({ config, updateConfig, channels, roles }) {
  return (
    <div className="moderation-config-form space-y-4">
      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">XP per Message</label>
        <input 
          type="number" 
          className="form-control form-control-sm custom-input"
          min="1" 
          max="100"
          value={config.xpPerMessage || 10}
          onChange={(e) => updateConfig('xpPerMessage', parseInt(e.target.value) || 10)}
        />
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Level Up Channel</label>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.levelChannelId || ''}
          onChange={(e) => updateConfig('levelChannelId', e.target.value)}
        >
          <option value="">Same channel as message</option>
          {channels.filter(ch => ch.type === 0).map(channel => (
            <option key={channel.id} value={channel.id}>#{channel.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Level Up Message</label>
        <textarea 
          className="form-control form-control-sm custom-input"
          rows={2}
          value={config.levelMessage || 'Congratulations {user}! You reached level {level}!'}
          onChange={(e) => updateConfig('levelMessage', e.target.value)}
          placeholder="Use variables: {user}, {level}, {xp}"
        />
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.levelRoles || false}
            onChange={(e) => updateConfig('levelRoles', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Level Role Rewards</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.leaderboard || false}
            onChange={(e) => updateConfig('leaderboard', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Enable Leaderboard Command</label>
        </div>
      </div>
    </div>
  );
}

// Scheduled Messages Configuration
function SchedulerConfigForm({ config, updateConfig, channels }) {
  return (
    <div className="moderation-config-form space-y-4">
      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Default Announcement Channel</label>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.defaultChannelId || ''}
          onChange={(e) => updateConfig('defaultChannelId', e.target.value)}
        >
          <option value="">Select a channel...</option>
          {channels.filter(ch => ch.type === 0).map(channel => (
            <option key={channel.id} value={channel.id}>#{channel.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.allowUserScheduling || false}
            onChange={(e) => updateConfig('allowUserScheduling', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Allow Users to Schedule Messages</label>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Max Scheduled Messages per User</label>
        <input 
          type="number" 
          className="form-control form-control-sm custom-input"
          min="1" 
          max="10"
          value={config.maxPerUser || 3}
          onChange={(e) => updateConfig('maxPerUser', parseInt(e.target.value) || 3)}
        />
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.recurringMessages || false}
            onChange={(e) => updateConfig('recurringMessages', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Enable Recurring Messages</label>
        </div>
      </div>
    </div>
  );
}

// Audit Logging Configuration
function LoggingConfigForm({ config, updateConfig, channels }) {
  return (
    <div className="moderation-config-form space-y-4">
      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Log Channel</label>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.logChannelId || ''}
          onChange={(e) => updateConfig('logChannelId', e.target.value)}
        >
          <option value="">Select a channel...</option>
          {channels.filter(ch => ch.type === 0).map(channel => (
            <option key={channel.id} value={channel.id}>#{channel.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.logMessages || false}
            onChange={(e) => updateConfig('logMessages', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Log Message Events</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.logMembers || false}
            onChange={(e) => updateConfig('logMembers', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Log Member Events</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.logChannels || false}
            onChange={(e) => updateConfig('logChannels', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Log Channel Events</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.logRoles || false}
            onChange={(e) => updateConfig('logRoles', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Log Role Events</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.logModerationActions || false}
            onChange={(e) => updateConfig('logModerationActions', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Log Moderation Actions</label>
        </div>
      </div>
    </div>
  );
}

// Anti-Raid Protection Configuration
function AntiRaidConfigForm({ config, updateConfig, channels, roles }) {
  return (
    <div className="moderation-config-form space-y-4">
      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Join Rate Limit (users per minute)</label>
        <input 
          type="number" 
          className="form-control form-control-sm custom-input"
          min="1" 
          max="100"
          value={config.joinRateLimit || 10}
          onChange={(e) => updateConfig('joinRateLimit', parseInt(e.target.value) || 10)}
        />
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Minimum Account Age (days)</label>
        <input 
          type="number" 
          className="form-control form-control-sm custom-input"
          min="0" 
          max="365"
          value={config.minAccountAge || 7}
          onChange={(e) => updateConfig('minAccountAge', parseInt(e.target.value) || 7)}
        />
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.autoLockdown || false}
            onChange={(e) => updateConfig('autoLockdown', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Auto Lockdown on Raid Detection</label>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Alert Channel</label>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.alertChannelId || ''}
          onChange={(e) => updateConfig('alertChannelId', e.target.value)}
        >
          <option value="">Select a channel...</option>
          {channels.filter(ch => ch.type === 0).map(channel => (
            <option key={channel.id} value={channel.id}>#{channel.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Quarantine Role</label>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.quarantineRoleId || ''}
          onChange={(e) => updateConfig('quarantineRoleId', e.target.value)}
        >
          <option value="">No quarantine role</option>
          {roles.filter(role => !role.managed && role.name !== '@everyone').map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={config.verificationRequired || false}
            onChange={(e) => updateConfig('verificationRequired', e.target.checked)}
          />
          <label className="form-check-label small fw-semibold">Require Verification for New Members</label>
        </div>
      </div>
    </div>
  );
}

// Bypass Roles Picker Component (similar to MentionTargetsPicker but for roles only)
function BypassRolesPicker({ value, onChange, roles }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const list = value || [];
  
  useEffect(() => {
    function onDoc(e) { 
      if (!boxRef.current) return; 
      if (!boxRef.current.contains(e.target)) setOpen(false); 
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const availableRoles = (roles || [])
    .filter(role => !role.managed && role.name !== '@everyone')
    .map(r => ({ id: r.id, label: r.name, type: 'role' }));
  
  const filtered = availableRoles
    .filter(o => !query || o.label.toLowerCase().includes(query.toLowerCase()))
    .filter(o => !list.includes(o.id));
  
  const [activeIdx, setActiveIdx] = useState(0);
  
  useEffect(() => { 
    setActiveIdx(0); 
  }, [query, open]);

  function add(id) { 
    if (!list.includes(id)) onChange([...list, id]); 
    setQuery(''); 
    setOpen(false); 
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0); 
  }
  
  function remove(id) { 
    onChange(list.filter(x => x !== id)); 
  }
  
  function handleKey(e) {
    if (e.key === 'Backspace' && !query) { 
      onChange(list.slice(0, -1)); 
    }
    else if (e.key === 'Enter') { 
      e.preventDefault(); 
      if (open && filtered[activeIdx]) add(filtered[activeIdx].id); 
    }
    else if (e.key === 'ArrowDown') { 
      e.preventDefault(); 
      setOpen(true); 
      setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); 
    }
    else if (e.key === 'ArrowUp') { 
      e.preventDefault(); 
      setActiveIdx(i => Math.max(0, i - 1)); 
    }
  }

  return (
    <div className="mention-targets-picker" ref={boxRef}>
      <div className="mention-targets-box" onClick={() => { setOpen(true); inputRef.current && inputRef.current.focus(); }}>
        {list.map(id => {
          const role = availableRoles.find(r => r.id === id);
          const label = role ? role.label : `<@&${id}>`;
          return (
            <span key={id} className="mention-chip role">
              {label}
              <button type="button" onClick={e => { e.stopPropagation(); remove(id); }}>
                &times;
              </button>
            </span>
          );
        })}
        <input 
          ref={inputRef} 
          value={query} 
          placeholder={list.length ? '' : 'Add roles to bypass moderation…'} 
          onFocus={() => setOpen(true)} 
          onChange={e => { setQuery(e.target.value); setOpen(true); }} 
          onKeyDown={handleKey} 
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="mention-targets-suggestions">
          {filtered.slice(0, 40).map((role, idx) => (
            <button 
              type="button" 
              key={role.id} 
              className={idx === activeIdx ? 'active' : ''} 
              onMouseEnter={() => setActiveIdx(idx)} 
              onClick={() => add(role.id)}
            >
              {role.label}
              <span className="meta">role</span>
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="mention-targets-suggestions">
          <div className="text-muted small p-2" style={{fontSize: '.55rem'}}>
            No roles found
          </div>
        </div>
      )}
    </div>
  );
}
