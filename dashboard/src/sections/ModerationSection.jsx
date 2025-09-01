import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getChannels, getRoles, getGuildEmojis } from '../api.js';

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
    desc: 'Manage roles with reaction roles and role menus.',
    features: ['Reaction Roles', 'Role Menus', 'Permission Sync', 'Custom Messages']
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
  
  // Safe toast function that can be used in async contexts
  const showToast = (type, message) => {
    try {
      if (pushToast && typeof pushToast === 'function') {
        pushToast(type, message);
      } else {
        console.log('Toast would show:', type, message);
      }
    } catch (error) {
      console.error('Error showing toast:', error);
    }
  };
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
          guildId={guildId}
          onSave={saveFeatureConfig}
          onClose={closeConfigModal}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// Configuration Modal Component
function ConfigurationModal({ feature, channels, roles, guildId, onSave, onClose, showToast }) {
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
            {renderConfigForm(feature.key, config, updateConfig, channels, roles, guildId, showToast)}
          </div>
          <div className="modal-footer border-secondary">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              <i className="fa-solid fa-times me-2" />
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Render different config forms based on feature type
function renderConfigForm(featureKey, config, updateConfig, channels, roles, guildId, showToast) {
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
          guildId={guildId}
          showToast={showToast}
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
            id="welcome-card-enabled"
            className="form-check-input" 
            type="checkbox" 
            checked={config.cardEnabled || false}
            onChange={(e) => updateConfig('cardEnabled', e.target.checked)}
          />
          <label htmlFor="welcome-card-enabled" className="form-check-label small fw-semibold">Enable Welcome Card</label>
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
            id="automod-spam-detection"
            className="form-check-input" 
            type="checkbox" 
            checked={config.spamDetection || false}
            onChange={(e) => updateConfig('spamDetection', e.target.checked)}
          />
          <label htmlFor="automod-spam-detection" className="form-check-label small fw-semibold">Spam Detection</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            id="automod-caps-filter"
            className="form-check-input" 
            type="checkbox" 
            checked={config.capsFilter || false}
            onChange={(e) => updateConfig('capsFilter', e.target.checked)}
          />
          <label htmlFor="automod-caps-filter" className="form-check-label small fw-semibold">Excessive Caps Filter</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            id="automod-link-filter"
            className="form-check-input" 
            type="checkbox" 
            checked={config.linkFilter || false}
            onChange={(e) => updateConfig('linkFilter', e.target.checked)}
          />
          <label htmlFor="automod-link-filter" className="form-check-label small fw-semibold">Link Filter</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            id="automod-profanity-filter"
            className="form-check-input" 
            type="checkbox" 
            checked={config.profanityFilter || false}
            onChange={(e) => updateConfig('profanityFilter', e.target.checked)}
          />
          <label htmlFor="automod-profanity-filter" className="form-check-label small fw-semibold">Profanity Filter</label>
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
function RolesConfigForm({ config, updateConfig, channels, roles, guildId, showToast }) {
  const [activeTab, setActiveTab] = useState('reaction');

  return (
    <div className="moderation-config-form space-y-4">
      {/* Tab Navigation */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">Role Management System</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-users-gear me-1"></i>
            Multiple Role Assignment Methods
          </span>
        </div>
        
        <nav className="nav nav-pills nav-fill bg-dark rounded p-1" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <button
            className={`nav-link ${activeTab === 'reaction' ? 'active' : ''}`}
            onClick={() => setActiveTab('reaction')}
            style={{
              backgroundColor: activeTab === 'reaction' ? '#8b5cf6' : 'transparent',
              color: activeTab === 'reaction' ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              fontWeight: '500',
              fontSize: '0.875rem'
            }}
          >
            <i className="fa-solid fa-face-smile me-2"></i>
            Reaction Roles
          </button>
          <button
            className={`nav-link ${activeTab === 'slash' ? 'active' : ''}`}
            onClick={() => setActiveTab('slash')}
            style={{
              backgroundColor: activeTab === 'slash' ? '#8b5cf6' : 'transparent',
              color: activeTab === 'slash' ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              fontWeight: '500',
              fontSize: '0.875rem'
            }}
          >
            <i className="fa-solid fa-terminal me-2"></i>
            Slash Commands
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'reaction' && (
          <ReactionRolesConfig
            config={config}
            updateConfig={updateConfig}
            channels={channels}
            roles={roles}
            guildId={guildId}
            showToast={showToast}
          />
        )}
        {activeTab === 'slash' && (
          <SlashCommandRolesConfig
            config={config}
            updateConfig={updateConfig}
            channels={channels}
            roles={roles}
            guildId={guildId}
            showToast={showToast}
          />
        )}
      </div>
    </div>
  );
}

// Reaction Roles Configuration Component
function ReactionRolesConfig({ config, updateConfig, channels, roles, guildId, showToast }) {
  const [reactionRoles, setReactionRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState({
    messageId: '',
    channelId: '',
    title: '',
    status: true,
    reactions: [{ emoji: '', roleId: '', type: 'toggle' }]
  });
  const [customMessage, setCustomMessage] = useState('React to get your roles!');
  const [originalFormData, setOriginalFormData] = useState({
    messageId: '',
    channelId: '',
    title: '',
    status: true,
    reactions: [{ emoji: '', roleId: '', type: 'toggle' }]
  });
  const [originalCustomMessage, setOriginalCustomMessage] = useState('React to get your roles!');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [guildEmojis, setGuildEmojis] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState({});
  const emojiPickerRef = useRef(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Fetch reaction roles when component mounts
  useEffect(() => {
    fetchReactionRoles();
    fetchGuildEmojis();
  }, []);

  const fetchGuildEmojis = async () => {
    try {
      const data = await getGuildEmojis(guildId);
      if (data.emojis) {
        setGuildEmojis(data.emojis);
      }
    } catch (error) {
      console.error('Error fetching guild emojis:', error);
    }
  };

  const fetchReactionRoles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/roles/reaction-roles?guildId=${guildId}`, {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token')
        }
      });
      const data = await response.json();
      if (data.reactionRoles) {
        setReactionRoles(data.reactionRoles);
      }
    } catch (error) {
      console.error('Error fetching reaction roles:', error);
    }
    setLoading(false);
  };

  const handleAddReactionRole = async () => {
    setSaving(true);
    
    try {
      const payload = { 
        guildId, 
        ...formData,
        customMessage: customMessage,
        title: formData.title || null
      };
      
      const response = await fetch('/api/roles/reaction-roles', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        await fetchReactionRoles();
        setShowAddForm(false);
        resetForm();
        showToast('success', `Reaction role "${formData.title}" created successfully!`);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create reaction role');
      }
    } catch (error) {
      console.error('Error adding reaction role:', error);
      showToast('error', `Failed to create reaction role: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateReactionRole = async () => {
    setSaving(true);
    
    try {
      const payload = { 
        guildId, 
        ...formData,
        customMessage: customMessage,
        title: formData.title || null
      };
      
      const response = await fetch(`/api/roles/reaction-roles/${editingRole.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        await fetchReactionRoles();
        setEditingRole(null);
        resetForm();
        showToast('success', `Reaction role "${formData.title}" updated successfully!`);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update reaction role');
      }
    } catch (error) {
      console.error('Error updating reaction role:', error);
      showToast('error', `Failed to update reaction role: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReactionRole = async (messageId) => {
    try {
      const response = await fetch(`/api/roles/reaction-roles/message/${messageId}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ guildId })
      });
      
      if (response.ok) {
        await fetchReactionRoles();
        showToast('success', 'Reaction role configuration deleted successfully!');
      } else {
        throw new Error('Failed to delete reaction role configuration');
      }
    } catch (error) {
      console.error('Error deleting reaction role:', error);
      showToast('error', 'Failed to delete reaction role configuration');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const confirmDelete = (group) => {
    setDeleteTarget(group);
    setShowDeleteConfirm(true);
  };

  const handleToggleStatus = async (roleId, currentStatus) => {
    const newStatus = !currentStatus;
    
    setUpdatingStatus(prev => ({ ...prev, [roleId]: true }));
    
    try {
      const response = await fetch(`/api/roles/reaction-roles/${roleId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ guildId, status: newStatus })
      });
      
      if (response.ok) {
        await fetchReactionRoles();
        showToast('success', `Reaction role ${newStatus ? 'enabled' : 'disabled'} successfully!`);
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      showToast('error', 'Failed to update reaction role status');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [roleId]: false }));
    }
  };

  const resetForm = () => {
    if (editingRole) {
      // Reset to original values when editing
      setFormData(originalFormData);
      setCustomMessage(originalCustomMessage);
    } else {
      // Reset to default values when adding new
      setFormData({
        messageId: '',
        channelId: '',
        title: '',
        status: true,
        reactions: [{ emoji: '', roleId: '', type: 'toggle' }]
      });
      setCustomMessage('React to get your roles!');
    }
    setShowEmojiPicker(false);
  };

  // Check if form has been modified
  const hasChanges = () => {
    if (editingRole) {
      // When editing, compare with original values
      return JSON.stringify(formData) !== JSON.stringify(originalFormData) || 
             customMessage !== originalCustomMessage;
    } else {
      // When adding new, check if any field has been filled
      const defaultReactions = [{ emoji: '', roleId: '', type: 'toggle' }];
      return formData.title !== '' || 
             formData.channelId !== '' || 
             JSON.stringify(formData.reactions) !== JSON.stringify(defaultReactions) ||
             formData.status !== true ||
             customMessage !== 'React to get your roles!';
    }
  };

  // Add a new reaction to the reactions array
  const addReaction = () => {
    setFormData(prev => ({
      ...prev,
      reactions: [...prev.reactions, { emoji: '', roleId: '', type: 'toggle' }]
    }));
  };

  // Remove a reaction from the reactions array
  const removeReaction = (index) => {
    if (formData.reactions.length > 1) {
      setFormData(prev => ({
        ...prev,
        reactions: prev.reactions.filter((_, i) => i !== index)
      }));
    }
  };

  // Update a specific reaction
  const updateReaction = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      reactions: prev.reactions.map((reaction, i) => 
        i === index ? { ...reaction, [field]: value } : reaction
      )
    }));
  };

  // Remove a role from the roles array
  const removeRole = (index) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.filter((_, i) => i !== index)
    }));
  };

  const startEdit = (role) => {
    setEditingRole(role);
    const editFormData = {
      messageId: role.messageId,
      channelId: role.channelId,
      title: role.title || '',
      status: role.status !== false,
      reactions: role.reactions || [{ emoji: role.emoji || '', roleId: role.roleId || '', type: role.type || 'toggle' }] // Handle both grouped and legacy single reaction
    };
    const editCustomMessage = role.customMessage || 'React to get your roles!';
    
    setFormData(editFormData);
    setCustomMessage(editCustomMessage);
    
    // Store original values for reset functionality
    setOriginalFormData(editFormData);
    setOriginalCustomMessage(editCustomMessage);
    setShowEmojiPicker(false);
  };

  const getChannelName = (channelId) => {
    const channel = channels.find(ch => ch.id === channelId);
    return channel ? `#${channel.name}` : 'Unknown Channel';
  };

  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : 'Unknown Role';
  };

  // Group reaction roles by message
  const groupedReactionRoles = () => {
    const grouped = {};
    reactionRoles.forEach(role => {
      const key = role.messageId || 'no-message';
      if (!grouped[key]) {
        grouped[key] = {
          messageId: role.messageId,
          channelId: role.channelId,
          title: role.title,
          customMessage: role.customMessage,
          status: role.status,
          reactions: []
        };
      }
      grouped[key].reactions.push({
        id: role.id,
        emoji: role.emoji,
        roleId: role.roleId,
        type: role.type
      });
    });
    return Object.values(grouped);
  };

  return (
    <div className="moderation-config-form space-y-4">
      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="form-label small fw-semibold mb-0">Reaction Role Configurations</label>
          <button 
            type="button" 
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingRole(null);
              setShowAddForm(true);
              // Force reset to default values for adding new
              setFormData({
                messageId: '',
                channelId: '',
                title: '',
                status: true,
                reactions: [{ emoji: '', roleId: '', type: 'toggle' }]
              });
              setCustomMessage('React to get your roles!');
              setShowEmojiPicker(false);
            }}
          >
            <i className="fa-solid fa-plus me-1"></i>
            Add Reaction Role
          </button>
        </div>

        {/* Reaction Roles Table */}
        {loading ? (
          <div className="text-center py-3">
            <i className="fa-solid fa-spinner fa-spin me-2"></i>
            Loading reaction roles...
          </div>
        ) : reactionRoles.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Title</th>
                  <th>Channel</th>
                  <th>Message</th>
                  <th>Reactions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedReactionRoles().map((group, index) => (
                  <tr key={group.messageId || index}>
                    <td>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={group.status !== false}
                          disabled={updatingStatus[group.reactions[0]?.id]}
                          onChange={() => handleToggleStatus(group.reactions[0]?.id, group.status)}
                          style={{ cursor: updatingStatus[group.reactions[0]?.id] ? 'not-allowed' : 'pointer' }}
                        />
                        {updatingStatus[group.reactions[0]?.id] && (
                          <small className="text-muted d-block">Updating...</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold text-primary" style={{ fontSize: '0.85rem' }}>
                        {group.title || 'Untitled'}
                      </div>
                    </td>
                    <td>{getChannelName(group.channelId)}</td>
                    <td>
                      {group.customMessage ? (
                        <div>
                          <span className="badge badge-success mb-1">Bot Message</span>
                          <div className="small text-muted text-truncate" style={{maxWidth: '150px'}}>
                            {group.customMessage}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="badge badge-secondary mb-1">User Message</span>
                          <div className="font-monospace small">{group.messageId}</div>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {group.reactions.map((reaction, reactionIndex) => (
                          <div key={reactionIndex} className="d-flex align-items-center gap-1 p-1 rounded" style={{backgroundColor: 'rgba(255,255,255,0.05)'}}>
                            <span className="small text-muted">{getRoleName(reaction.roleId)}</span>
                            <span className={`badge badge-${(reaction.type || 'toggle') === 'toggle' ? 'primary' : (reaction.type || 'toggle') === 'add_only' ? 'success' : 'warning'}`} style={{fontSize: '0.6rem'}}>
                              {(reaction.type || 'toggle').replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button 
                        type="button" 
                        className="btn btn-outline-primary btn-sm me-1"
                        onClick={() => {
                          // Create a pseudo-role object for editing
                          const editRole = {
                            id: group.reactions[0]?.id,
                            messageId: group.messageId,
                            channelId: group.channelId,
                            title: group.title,
                            customMessage: group.customMessage,
                            status: group.status,
                            reactions: group.reactions
                          };
                          startEdit(editRole);
                        }}
                      >
                        <i className="fa-solid fa-edit"></i>
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => confirmDelete(group)}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-3 text-muted">
            No reaction roles configured. Click "Add Reaction Role" to get started.
          </div>
        )}

        {/* Add/Edit Form */}
        {(showAddForm || editingRole) && (
          <div className="mt-3 p-3 border rounded position-relative">
            {/* Loading Overlay */}
            {saving && (
              <div 
                className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  borderRadius: '6px',
                  zIndex: 1000
                }}
              >
                <div className="text-center text-light">
                  <div className="spinner-border spinner-border-sm mb-2" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <div className="small">
                    {editingRole ? 'Updating reaction role...' : 'Creating reaction role...'}
                  </div>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">
                {editingRole ? 'Edit Existing Reaction Role' : 'Create New Reaction Role'}
                {hasChanges() && (
                  <span className="badge badge-warning ms-2" style={{ fontSize: '0.6rem' }}>
                    <i className="fa-solid fa-circle-exclamation me-1"></i>
                    Unsaved Changes
                  </span>
                )}
              </h6>
              
              {/* Status Toggle - Top Right */}
              <div className="form-check form-switch">
                <input 
                  id="reaction-role-status"
                  className="form-check-input" 
                  type="checkbox" 
                  checked={formData.status !== false}
                  onChange={(e) => setFormData({...formData, status: e.target.checked})}
                />
                <label htmlFor="reaction-role-status" className="form-check-label small fw-semibold">
                  Enable Reaction Role
                </label>
              </div>
            </div>
            
            {/* Title Field */}
            <div className="mb-3">
              <label className="form-label small fw-semibold">Title</label>
              <input 
                type="text" 
                className="form-control form-control-sm"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Enter a title for this reaction role"
              />
              <small className="text-muted">A descriptive title to help identify this reaction role</small>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label small">Channel</label>
                <select 
                  className="form-select form-select-sm custom-dropdown"
                  value={formData.channelId}
                  onChange={(e) => setFormData({...formData, channelId: e.target.value})}
                >
                  <option value="">Select a channel...</option>
                  {channels.filter(ch => ch.type === 0).map(channel => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
              {editingRole && (
                <div className="col-md-6 mb-3">
                  <label className="form-label small">Message ID</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm"
                    value={formData.messageId}
                    readOnly
                    style={{ 
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      cursor: 'not-allowed'
                    }}
                    title="Message ID cannot be changed when editing"
                  />
                  <small className="text-muted">Message ID is read-only when editing</small>
                </div>
              )}
            </div>

            {/* Custom Message - Always show for both add and edit */}
            <div className="mb-3">
              <label className="form-label small fw-semibold">Custom Message</label>
              <textarea 
                className="form-control form-control-sm"
                rows={6}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="React to get your roles!"
              />
              <small className="text-muted">
                {editingRole 
                  ? 'The message content for this reaction role'
                  : 'The message content that will be posted by the bot'
                }
              </small>
              
              {/* Message Preview with Multiple Reactions */}
              <div className="template-preview mt-2">
                <div className="preview-label">Preview</div>
                <div className="preview-body">
                  <div style={{ marginBottom: '8px' }}>
                    {customMessage || 'React to get your roles!'}
                  </div>
                  {formData.reactions.map((reaction, index) => (
                    <div key={index} className="d-flex align-items-center gap-2 mb-1">
                      <span style={{ fontSize: '1.2rem' }}>{reaction.emoji || '🎉'}</span>
                      <span>→</span>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {reaction.roleId ? getRoleName(reaction.roleId) : 'Select a role'}
                      </span>
                      <span className="badge badge-secondary" style={{ fontSize: '0.6rem' }}>
                        {(reaction.type || 'toggle').replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Multiple Reactions Section */}
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label small fw-semibold mb-0">Reaction Roles</label>
                <button 
                  type="button" 
                  className="btn btn-outline-primary btn-sm"
                  onClick={addReaction}
                >
                  <i className="fa-solid fa-plus me-1"></i>
                  Add Reaction
                </button>
              </div>

              {formData.reactions.map((reaction, index) => (
                <div key={index} className="reaction-row border rounded p-3 mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 small fw-semibold">Reaction {index + 1}</h6>
                    {formData.reactions.length > 1 && (
                      <button 
                        type="button" 
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => removeReaction(index)}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    )}
                  </div>

                  <div className="row">
                    <div className="col-md-5 mb-3">
                      <label className="form-label small">Emoji</label>
                      <div className="position-relative">
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={reaction.emoji || ''}
                          onChange={(e) => updateReaction(index, 'emoji', e.target.value)}
                          placeholder="🎉 or custom emoji ID"
                          style={{ paddingRight: '35px' }}
                        />
                        <button
                          type="button"
                          className="btn position-absolute"
                          style={{
                            right: '2px',
                            top: '2px',
                            bottom: '2px',
                            width: '30px',
                            padding: '0',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            border: 'none',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={() => setShowEmojiPicker(index)}
                          title="Choose emoji"
                        >
                          😀
                        </button>
                        
                        {/* Emoji Picker Dropdown */}
                        {showEmojiPicker === index && (
                          <div 
                            ref={emojiPickerRef}
                            className="position-absolute border rounded shadow-lg p-3"
                            style={{
                              top: '100%',
                              left: '0',
                              right: '0',
                              zIndex: 1050,
                              maxHeight: '250px',
                              overflowY: 'auto',
                              marginTop: '4px',
                              backgroundColor: 'var(--bs-dark)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}
                          >
                            <div className="small text-muted mb-2 fw-semibold">Guild Emojis</div>
                            {guildEmojis.length > 0 ? (
                              <div className="d-flex flex-wrap gap-1 mb-3">
                                {guildEmojis.map(emoji => (
                                  <button
                                    key={emoji.id}
                                    type="button"
                                    className="btn p-1"
                                    style={{
                                      backgroundColor: 'transparent',
                                      border: '1px solid transparent',
                                      borderRadius: '6px',
                                      minWidth: '36px',
                                      height: '36px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                      e.target.style.borderColor = 'rgba(255,255,255,0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.backgroundColor = 'transparent';
                                      e.target.style.borderColor = 'transparent';
                                    }}
                                    onClick={() => {
                                      updateReaction(index, 'emoji', `<:${emoji.name}:${emoji.id}>`);
                                      setShowEmojiPicker(false);
                                    }}
                                    title={emoji.name}
                                  >
                                    <img 
                                      src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`}
                                      alt={emoji.name}
                                      style={{ width: '24px', height: '24px' }}
                                    />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-muted small mb-3">No custom emojis found</div>
                            )}
                            
                            <div className="border-top pt-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                              <div className="small text-muted mb-2 fw-semibold">Common Emojis</div>
                              <div className="d-flex flex-wrap gap-1">
                                {['🎉', '✅', '❌', '👍', '👎', '❤️', '💜', '💙', '💚', '💛', '🔥', '⭐', '🎯', '🎮', '🎵', '📢'].map(emoji => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="btn p-1"
                                    style={{
                                      backgroundColor: 'transparent',
                                      border: '1px solid transparent',
                                      borderRadius: '6px',
                                      minWidth: '36px',
                                      height: '36px',
                                      fontSize: '20px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                      e.target.style.borderColor = 'rgba(255,255,255,0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.backgroundColor = 'transparent';
                                      e.target.style.borderColor = 'transparent';
                                    }}
                                    onClick={() => {
                                      updateReaction(index, 'emoji', emoji);
                                      setShowEmojiPicker(false);
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label small">Role</label>
                      <select 
                        className="form-select form-select-sm custom-dropdown"
                        value={reaction.roleId || ''}
                        onChange={(e) => updateReaction(index, 'roleId', e.target.value)}
                      >
                        <option value="">Select a role...</option>
                        {roles.filter(role => !role.managed).map(role => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label small">Type</label>
                      <select 
                        className="form-select form-select-sm custom-dropdown"
                        value={reaction.type || 'toggle'}
                        onChange={(e) => updateReaction(index, 'type', e.target.value)}
                      >
                        <option value="toggle">Toggle (Add/Remove)</option>
                        <option value="add_only">Add Only</option>
                        <option value="remove_only">Remove Only</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="d-flex justify-content-between gap-2">
              {hasChanges() && (
                <button 
                  type="button" 
                  className="btn btn-outline-warning btn-sm"
                  onClick={resetForm}
                  disabled={saving}
                  title={editingRole ? "Reset to original values" : "Clear all fields"}
                >
                  <i className="fa-solid fa-rotate-left me-1"></i>
                  Reset
                </button>
              )}
              
              <div className={`d-flex gap-2 ${!hasChanges() ? 'ms-auto' : ''}`}>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  disabled={saving}
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingRole(null);
                    resetForm();
                  }}
                >
                  <i className="fa-solid fa-times me-1"></i>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm"
                  onClick={editingRole ? handleUpdateReactionRole : handleAddReactionRole}
                  disabled={
                    saving ||
                    !formData.channelId || 
                    !formData.title.trim() ||
                    !customMessage.trim() ||
                    formData.reactions.some(reaction => !reaction.emoji || !reaction.roleId) ||
                    (editingRole && !formData.messageId)
                  }
                >
                  {saving ? (
                    <>
                      <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      {editingRole ? 'Updating...' : 'Saving...'}
                    </>
                  ) : editingRole ? (
                    <>
                      <i className="fa-solid fa-pen-to-square me-1"></i>
                      Update Reaction Role
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk me-1"></i>
                      Save Reaction Role
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modern Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div 
          className="modal show d-block"
          style={{ 
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 1060
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark text-light border-0 shadow-lg">
              <div className="modal-body text-center p-4">
                {/* Warning Icon */}
                <div className="mb-3">
                  <div 
                    className="d-inline-flex align-items-center justify-content-center rounded-circle"
                    style={{
                      width: '64px',
                      height: '64px',
                      backgroundColor: 'rgba(220, 38, 38, 0.1)',
                      border: '3px solid rgba(220, 38, 38, 0.3)'
                    }}
                  >
                    <i 
                      className="fa-solid fa-triangle-exclamation" 
                      style={{ 
                        fontSize: '24px', 
                        color: '#dc2626' 
                      }}
                    />
                  </div>
                </div>

                {/* Title */}
                <h5 className="mb-3 fw-bold">Delete Reaction Role Configuration?</h5>

                {/* Message */}
                <div className="mb-4">
                  <p className="text-muted mb-2">
                    You're about to permanently delete the reaction role configuration:
                  </p>
                  <div 
                    className="p-3 rounded border"
                    style={{ 
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderColor: 'rgba(255,255,255,0.1)'
                    }}
                  >
                    <div className="fw-semibold text-primary mb-1">
                      {deleteTarget.title || 'Untitled Configuration'}
                    </div>
                    <div className="small text-muted">
                      {getChannelName(deleteTarget.channelId)} • {deleteTarget.reactions.length} reaction{deleteTarget.reactions.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <p className="text-warning small mt-3 mb-0">
                    <i className="fa-solid fa-exclamation-triangle me-2"></i>
                    This action cannot be undone.
                  </p>
                </div>

                {/* Buttons */}
                <div className="d-flex gap-3 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-secondary px-4"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteTarget(null);
                    }}
                  >
                    <i className="fa-solid fa-times me-2"></i>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger px-4"
                    onClick={() => handleDeleteReactionRole(deleteTarget.messageId)}
                    style={{
                      background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                    }}
                  >
                    <i className="fa-solid fa-trash me-2"></i>
                    Delete Forever
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Slash Command Roles Configuration Component
function SlashCommandRolesConfig({ config, updateConfig, channels, roles, guildId, showToast }) {
  const [slashRoles, setSlashRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCommand, setEditingCommand] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState({
    commandName: '',
    description: '',
    channelId: '',
    roles: [{ roleId: '', type: 'toggle' }],
    requirePermission: false,
    allowedRoles: [],
    status: true
  });

  // Fetch slash command roles when component mounts
  useEffect(() => {
    fetchSlashRoles();
  }, []);

  const fetchSlashRoles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/roles/guild/${guildId}/self-assignable-roles`, {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token')
        }
      });
      const data = await response.json();
      if (data.success && data.slashRoles) {
        setSlashRoles(data.slashRoles);
      }
    } catch (error) {
      console.error('Error fetching slash command roles:', error);
      showToast('error', 'Failed to fetch slash command roles');
    }
    setLoading(false);
  };

  const handleAddSlashRole = async () => {
    setSaving(true);
    try {
      const payload = { 
        guildId, 
        commandName: formData.commandName,
        description: formData.description,
        channelId: formData.channelId || null,
        roles: formData.roles,
        requirePermission: formData.requirePermission,
        allowedRoles: formData.allowedRoles,
        status: formData.status
      };
      
      console.log('Sending payload:', payload);
      
      const isEditing = editingCommand !== null;
      const url = isEditing 
        ? `/api/roles/guild/${guildId}/self-assignable-roles/${editingCommand.commandName}`
        : `/api/roles/guild/${guildId}/self-assignable-roles`;
      
      console.log('Request URL:', url);
      console.log('Request method:', isEditing ? 'PUT' : 'POST');
      
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        setShowAddForm(false);
        setEditingCommand(null);
        resetForm();
        fetchSlashRoles();
        showToast('success', `Slash command role ${isEditing ? 'updated' : 'created'} successfully!`);
      } else {
        const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
        console.error('API Error:', errorData);
        console.error('Request payload:', payload);
        console.error('Response status:', response.status);
        showToast('error', errorData.message || `Failed to ${isEditing ? 'update' : 'create'} slash command role`);
      }
    } catch (error) {
      console.error('Error saving slash command role:', error);
      showToast('error', `Failed to ${editingCommand ? 'update' : 'create'} slash command role`);
    }
    setSaving(false);
  };

  const handleToggleStatus = async (commandName, currentStatus) => {
    try {
      const response = await fetch(`/api/roles/guild/${guildId}/self-assignable-roles/${commandName}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ status: !currentStatus })
      });

      if (response.ok) {
        fetchSlashRoles();
        showToast('success', `Slash command ${!currentStatus ? 'enabled' : 'disabled'} successfully!`);
      } else {
        const error = await response.json();
        showToast('error', error.message || 'Failed to toggle slash command status');
      }
    } catch (error) {
      console.error('Error toggling slash command status:', error);
      showToast('error', 'Failed to toggle slash command status');
    }
  };

  const handleDeleteSlashRole = async (commandName) => {
    try {
      const response = await fetch(`/api/roles/guild/${guildId}/self-assignable-roles/${commandName}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token')
        }
      });

      if (response.ok) {
        fetchSlashRoles();
        showToast('info', 'Slash command role deleted successfully!');
      } else {
        const error = await response.json();
        showToast('error', error.message || 'Failed to delete slash command role');
      }
    } catch (error) {
      console.error('Error deleting slash command role:', error);
      showToast('error', 'Failed to delete slash command role');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const confirmDelete = (command) => {
    setDeleteTarget(command);
    setShowDeleteConfirm(true);
  };

  const resetForm = () => {
    setEditingCommand(null);
    setFormData({
      commandName: '',
      description: '',
      channelId: '',
      roles: [{ roleId: '', type: 'toggle' }],
      requirePermission: false,
      allowedRoles: [],
      status: true
    });
  };

  const addRole = () => {
    setFormData(prev => ({
      ...prev,
      roles: [...prev.roles, { roleId: '', type: 'toggle' }]
    }));
  };

  const removeRole = (index) => {
    if (formData.roles.length > 1) {
      setFormData(prev => ({
        ...prev,
        roles: prev.roles.filter((_, i) => i !== index)
      }));
    }
  };

  const updateRole = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.map((role, i) => 
        i === index ? { ...role, [field]: value } : role
      )
    }));
  };

  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : 'Unknown Role';
  };

  const getChannelName = (channelId) => {
    const channel = channels.find(ch => ch.id === channelId);
    return channel ? `#${channel.name}` : 'Unknown Channel';
  };

  return (
    <div className="moderation-config-form space-y-4">
      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="form-label small fw-semibold mb-0">Slash Command Roles</label>
          <button 
            type="button" 
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingCommand(null);
              setShowAddForm(true);
              resetForm();
            }}
          >
            <i className="fa-solid fa-plus me-1"></i>
            Add Slash Command
          </button>
        </div>

        {/* Slash Command Roles Table */}
        {loading ? (
          <div className="text-center py-3">
            <i className="fa-solid fa-spinner fa-spin me-2"></i>
            Loading slash command roles...
          </div>
        ) : slashRoles.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Channel</th>
                  <th>Roles</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slashRoles.map((command, index) => (
                  <tr key={command.id || index}>
                    <td>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={command.status !== false}
                          onChange={() => handleToggleStatus(command.commandName, command.status)}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold text-primary" style={{ fontSize: '0.85rem' }}>
                        {command.commandName}
                      </div>
                    </td>
                    <td>
                      <div className="small text-muted">
                        {command.description || 'No description'}
                      </div>
                    </td>
                    <td>{getChannelName(command.channelId)}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {command.roles?.map((role, roleIndex) => (
                          <div key={roleIndex} className="d-flex align-items-center gap-1 p-1 rounded" style={{backgroundColor: 'rgba(255,255,255,0.05)'}}>
                            <span className="small text-muted">{getRoleName(role.roleId)}</span>
                            <span className={`badge badge-${role.type === 'toggle' ? 'primary' : role.type === 'add_only' ? 'success' : 'warning'}`} style={{fontSize: '0.6rem'}}>
                              {role.type?.replace('_', ' ') || 'toggle'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button 
                        type="button" 
                        className="btn btn-outline-primary btn-sm me-1"
                        onClick={() => {
                          setEditingCommand(command);
                          setFormData({
                            commandName: command.commandName,
                            description: command.description,
                            channelId: command.channelId || '',
                            roles: command.roles || [{ roleId: '', type: 'toggle' }],
                            requirePermission: command.requirePermission || false,
                            allowedRoles: command.allowedRoles || [],
                            status: command.status !== false
                          });
                          setShowAddForm(true);
                        }}
                      >
                        <i className="fa-solid fa-edit"></i>
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => confirmDelete(command)}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-3 text-muted">
            No slash command roles configured. Click "Add Slash Command" to get started.
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="mt-3 p-3 border rounded position-relative">
            {saving && (
              <div 
                className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  borderRadius: '6px',
                  zIndex: 1000
                }}
              >
                <div className="text-center text-light">
                  <div className="spinner-border spinner-border-sm mb-2" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <div className="small">{editingCommand ? 'Updating' : 'Creating'} slash command...</div>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">
                {editingCommand ? 'Edit' : 'Create New'} Slash Command Role
              </h6>
              <div className="form-check form-switch">
                <input 
                  id="slash-command-status"
                  className="form-check-input" 
                  type="checkbox" 
                  checked={formData.status !== false}
                  onChange={(e) => setFormData({...formData, status: e.target.checked})}
                />
                <label htmlFor="slash-command-status" className="form-check-label small fw-semibold">
                  Enable Command
                </label>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">Title</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  value={formData.commandName}
                  onChange={(e) => setFormData({...formData, commandName: e.target.value})}
                  placeholder="Gaming Roles"
                />
                <small className="text-muted">A descriptive title for this role group</small>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label small">Channel</label>
                <select 
                  className="form-select form-select-sm custom-dropdown"
                  value={formData.channelId}
                  onChange={(e) => setFormData({...formData, channelId: e.target.value})}
                >
                  <option value="">All Channel</option>
                  {channels.filter(ch => ch.type === 0).map(channel => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Description</label>
              <input 
                type="text" 
                className="form-control form-control-sm"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Manage your roles with this command"
              />
              <small className="text-muted">A brief description of what this command does</small>
            </div>

            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label small fw-semibold mb-0">Command Roles</label>
                <button 
                  type="button" 
                  className="btn btn-outline-primary btn-sm"
                  onClick={addRole}
                >
                  <i className="fa-solid fa-plus me-1"></i>
                  Add Role
                </button>
              </div>

              {formData.roles.map((role, index) => (
                <div key={index} className="role-row border rounded p-3 mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 small fw-semibold">Role {index + 1}</h6>
                    {formData.roles.length > 1 && (
                      <button 
                        type="button" 
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => removeRole(index)}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    )}
                  </div>

                  <div className="row">
                    <div className="col-md-8 mb-3">
                      <label className="form-label small">Role</label>
                      <select 
                        className="form-select form-select-sm custom-dropdown"
                        value={role.roleId || ''}
                        onChange={(e) => updateRole(index, 'roleId', e.target.value)}
                      >
                        <option value="">Select a role...</option>
                        {roles.filter(role => !role.managed).map(role => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label small">Type</label>
                      <select 
                        className="form-select form-select-sm custom-dropdown"
                        value={role.type || 'toggle'}
                        onChange={(e) => updateRole(index, 'type', e.target.value)}
                      >
                        <option value="toggle">Toggle (Add/Remove)</option>
                        <option value="add_only">Add Only</option>
                        <option value="remove_only">Remove Only</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                disabled={saving}
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
              >
                <i className="fa-solid fa-times me-1"></i>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                onClick={handleAddSlashRole}
                disabled={
                  saving ||
                  !formData.commandName.trim() ||
                  !formData.description.trim() ||
                  formData.roles.some(role => !role.roleId)
                }
              >
                {saving ? (
                  <>
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk me-1"></i>
                    {editingCommand ? 'Update' : 'Save'} Slash Command
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div 
          className="modal show d-block"
          style={{ 
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 1060
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark text-light border-0 shadow-lg">
              <div className="modal-body text-center p-4">
                <div className="mb-3">
                  <div 
                    className="d-inline-flex align-items-center justify-content-center rounded-circle"
                    style={{
                      width: '64px',
                      height: '64px',
                      backgroundColor: 'rgba(220, 38, 38, 0.1)',
                      border: '3px solid rgba(220, 38, 38, 0.3)'
                    }}
                  >
                    <i 
                      className="fa-solid fa-triangle-exclamation" 
                      style={{ 
                        fontSize: '24px', 
                        color: '#dc2626' 
                      }}
                    />
                  </div>
                </div>

                <h5 className="mb-3 fw-bold">Delete Slash Command?</h5>

                <div className="mb-4">
                  <p className="text-muted mb-2">
                    You're about to permanently delete the slash command:
                  </p>
                  <div 
                    className="p-3 rounded border"
                    style={{ 
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderColor: 'rgba(255,255,255,0.1)'
                    }}
                  >
                    <div className="fw-semibold text-primary mb-1">
                      Title: {deleteTarget.commandName}
                    </div>
                    <div className="small text-muted">
                      Desc: {deleteTarget.description}
                    </div>
                  </div>
                  <p className="text-warning small mt-3 mb-0">
                    <i className="fa-solid fa-exclamation-triangle me-2"></i>
                    This action cannot be undone.
                  </p>
                </div>

                <div className="d-flex gap-3 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-secondary px-4"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteTarget(null);
                    }}
                  >
                    <i className="fa-solid fa-times me-2"></i>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger px-4"
                    onClick={() => handleDeleteSlashRole(deleteTarget.commandName)}
                    style={{
                      background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                    }}
                  >
                    <i className="fa-solid fa-trash me-2"></i>
                    Delete Forever
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
            id="xp-level-roles"
            className="form-check-input" 
            type="checkbox" 
            checked={config.levelRoles || false}
            onChange={(e) => updateConfig('levelRoles', e.target.checked)}
          />
          <label htmlFor="xp-level-roles" className="form-check-label small fw-semibold">Level Role Rewards</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            id="xp-leaderboard"
            className="form-check-input" 
            type="checkbox" 
            checked={config.leaderboard || false}
            onChange={(e) => updateConfig('leaderboard', e.target.checked)}
          />
          <label htmlFor="xp-leaderboard" className="form-check-label small fw-semibold">Enable Leaderboard Command</label>
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
            id="scheduler-user-scheduling"
            className="form-check-input" 
            type="checkbox" 
            checked={config.allowUserScheduling || false}
            onChange={(e) => updateConfig('allowUserScheduling', e.target.checked)}
          />
          <label htmlFor="scheduler-user-scheduling" className="form-check-label small fw-semibold">Allow Users to Schedule Messages</label>
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
            id="scheduler-recurring-messages"
            className="form-check-input" 
            type="checkbox" 
            checked={config.recurringMessages || false}
            onChange={(e) => updateConfig('recurringMessages', e.target.checked)}
          />
          <label htmlFor="scheduler-recurring-messages" className="form-check-label small fw-semibold">Enable Recurring Messages</label>
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
            id="logging-messages"
            className="form-check-input" 
            type="checkbox" 
            checked={config.logMessages || false}
            onChange={(e) => updateConfig('logMessages', e.target.checked)}
          />
          <label htmlFor="logging-messages" className="form-check-label small fw-semibold">Log Message Events</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            id="logging-members"
            className="form-check-input" 
            type="checkbox" 
            checked={config.logMembers || false}
            onChange={(e) => updateConfig('logMembers', e.target.checked)}
          />
          <label htmlFor="logging-members" className="form-check-label small fw-semibold">Log Member Events</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            id="logging-channels"
            className="form-check-input" 
            type="checkbox" 
            checked={config.logChannels || false}
            onChange={(e) => updateConfig('logChannels', e.target.checked)}
          />
          <label htmlFor="logging-channels" className="form-check-label small fw-semibold">Log Channel Events</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            id="logging-roles"
            className="form-check-input" 
            type="checkbox" 
            checked={config.logRoles || false}
            onChange={(e) => updateConfig('logRoles', e.target.checked)}
          />
          <label htmlFor="logging-roles" className="form-check-label small fw-semibold">Log Role Events</label>
        </div>
      </div>

      <div className="mb-3">
        <div className="form-check form-switch">
          <input 
            id="logging-moderation-actions"
            className="form-check-input" 
            type="checkbox" 
            checked={config.logModerationActions || false}
            onChange={(e) => updateConfig('logModerationActions', e.target.checked)}
          />
          <label htmlFor="logging-moderation-actions" className="form-check-label small fw-semibold">Log Moderation Actions</label>
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
            id="antiraid-auto-lockdown"
            className="form-check-input" 
            type="checkbox" 
            checked={config.autoLockdown || false}
            onChange={(e) => updateConfig('autoLockdown', e.target.checked)}
          />
          <label htmlFor="antiraid-auto-lockdown" className="form-check-label small fw-semibold">Auto Lockdown on Raid Detection</label>
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
            id="antiraid-verification-required"
            className="form-check-input" 
            type="checkbox" 
            checked={config.verificationRequired || false}
            onChange={(e) => updateConfig('verificationRequired', e.target.checked)}
          />
          <label htmlFor="antiraid-verification-required" className="form-check-label small fw-semibold">Require Verification for New Members</label>
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
