import React, { useState, useEffect, useRef } from 'react';
import WelcomeConfigForm from '../features/WelcomeConfigForm';
import AutomodConfigForm from '../features/AutomodConfigForm';
import RolesConfigForm from '../features/RolesConfigForm';
import XPConfigForm from '../features/XPConfigForm';
import SchedulerConfigForm from '../features/SchedulerConfigForm';
import LoggingConfigForm from '../features/LoggingConfigForm';
import AntiRaidConfigForm from '../features/AntiRaidConfigForm';
import UnsavedChangesModal from './UnsavedChangesModal';

// Configuration Modal Component
export default function ConfigurationModal({ 
  feature, 
  channels, 
  roles, 
  guildId, 
  onSave, 
  onClose, 
  showToast 
}) {
  const [config, setConfig] = useState(feature.config || {});
  const [originalConfig, setOriginalConfig] = useState(feature.config || {});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  
  // Ref for forms that handle their own save/reset
  const loggingFormRef = useRef(null);

  // Fetch specific configuration when modal opens
  useEffect(() => {
    const fetchConfig = async () => {
      if (!feature.key || !guildId) return;
      
      setLoading(true);
      try {
        let response;
        
        // Handle different features with specific endpoints
        if (feature.key === 'welcome') {
          response = await fetch('/api/moderation/welcome/config', {
            headers: { 
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'X-Guild-Id': guildId
            }
          });
        } else if (feature.key === 'xp') {
          response = await fetch('/api/moderation/xp/config', {
            headers: { 
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'X-Guild-Id': guildId
            }
          });
        } else if (feature.key === 'antiraid') {
          response = await fetch('/api/moderation/antiraid/config', {
            headers: { 
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'X-Guild-Id': guildId
            }
          });
        } else if (feature.key === 'logging') {
          response = await fetch('/api/moderation/audit-logs/config', {
            headers: { 
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'X-Guild-Id': guildId
            }
          });
        } else {
          response = await fetch(`/api/moderation/features/${feature.key}/config`, {
            headers: { 
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'X-Guild-Id': guildId
            }
          });
        }
        
        if (response.ok) {
          const data = await response.json();
          
          // Handle different possible response structures
          const configData = (feature.key === 'welcome' || feature.key === 'xp' || feature.key === 'antiraid' || feature.key === 'logging') 
            ? (data.config || data || {})
            : (data.config || data || {});
          
          setConfig(configData);
          setOriginalConfig(configData);
        } else {
          // Use feature's default config if none exists
          const defaultConfig = getDefaultConfig(feature.key);
          setConfig(defaultConfig);
          setOriginalConfig(defaultConfig);
        }
      } catch (error) {
        console.error(`Failed to fetch ${feature.key} config:`, error);
        showToast('error', `Failed to load ${feature.label} configuration`);
        
        // Fallback to default config on error
        const defaultConfig = getDefaultConfig(feature.key);
        setConfig(defaultConfig);
        setOriginalConfig(defaultConfig);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [feature.key, guildId]);

  // Get default configuration for a feature
  const getDefaultConfig = (featureKey) => {
    const defaults = {
      welcome: {
        enabled: false,
        channelId: '',
        messageType: 'text',
        messageText: 'Welcome to {server}, {user}!',
        cardEnabled: false,
        roleId: '',
        dmEnabled: false,
        dmMessage: 'Welcome to {server}! Thanks for joining us.'
      },
      automod: {
        enabled: false,
        logChannelId: '',
        bypassRoles: [],
        // Legacy simple toggles for backward compatibility
        spamDetection: false,
        capsFilter: false,
        linkFilter: false,
        profanityFilter: false,
        autoDelete: false
      },
      roles: {
        enabled: false,
        reactionRoles: [],
        slashCommands: []
      },
      xp: {
        enabled: false,
        xpPerMessage: 15,
        xpPerVoiceMinute: 5,
        cooldownSeconds: 60,
        excludedChannels: [],
        excludedRoles: [],
        levelUpMessages: true,
        levelUpChannel: null,
        doubleXpEvents: []
      },
      scheduler: {
        enabled: false,
        scheduledMessages: []
      },
      logging: {
        enabled: false,
        globalChannel: null,
        messageChannel: null,
        memberChannel: null,
        channelChannel: null,
        roleChannel: null,
        serverChannel: null,
        voiceChannel: null,
        includeBots: true,
        enhancedDetails: true
      },
      antiraid: {
        enabled: false,
        joinRate: 5,
        joinWindow: 10,
        accountAge: 7,
        autoLockdown: false,
        verificationLevel: 'medium',
        alertChannel: null,
        kickSuspicious: false,
        deleteInviteSpam: true,
        gracePeriod: 30,
        bypassRoles: []
      }
    };

    return defaults[featureKey] || {};
  };

  // Check if configuration has been modified
  const isDirty = () => {
    // Use standard config comparison for all forms
    return JSON.stringify(config) !== JSON.stringify(originalConfig);
  };

  // Reset configuration to original values
  const resetConfig = () => {
    // Use standard config reset for all forms
    setConfig({ ...originalConfig });
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Handle different features with specific endpoints
      if (feature.key === 'welcome') {
        await onSave(config);
      } else if (feature.key === 'logging') {
        // Use same pattern as welcome - let onSave handle it
        await onSave(config);
      } else if (feature.key === 'xp') {
        // Use same pattern as welcome - let onSave handle it
        await onSave(config);
      } else if (feature.key === 'antiraid') {
        // Use same pattern as welcome - let onSave handle it
        await onSave(config);
      } else {
        await onSave(config);
      }
      
      showToast('success', `${feature.label} configuration saved successfully`);
    } catch (error) {
      console.error('Save failed:', error);
      showToast('error', `Failed to save ${feature.label} configuration`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty() && !saving) {
      setShowUnsavedModal(true);
      return;
    }
    
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleConfirmClose = () => {
    setShowUnsavedModal(false);
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleCancelClose = () => {
    setShowUnsavedModal(false);
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const renderConfigForm = () => {
    const commonProps = {
      config,
      updateConfig,
      channels,
      roles,
      guildId,
      showToast
    };

    switch (feature.key) {
      case 'welcome':
        return <WelcomeConfigForm {...commonProps} />;
      case 'automod':
        return <AutomodConfigForm {...commonProps} />;
      case 'roles':
        return <RolesConfigForm {...commonProps} />;
      case 'xp':
        return <XPConfigForm {...commonProps} />;
      case 'scheduler':
        return <SchedulerConfigForm {...commonProps} />;
      case 'logging':
        return <LoggingConfigForm ref={loggingFormRef} {...commonProps} />;
      case 'antiraid':
        return <AntiRaidConfigForm {...commonProps} />;
      default:
        return (
          <div className="text-center py-4">
            <div className="text-muted">
              Configuration form for {feature.label} is not yet implemented.
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className={`modal show d-block modal-backdrop-animated ${isClosing ? 'closing' : ''}`} 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className={`modal-dialog modal-lg modal-content-animated ${isClosing ? 'closing' : ''}`}>
        <div className="modal-content bg-dark text-light position-relative">
          {saving && (
            <div 
              className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '8px',
                zIndex: 1000
              }}
            >
              <div className="text-center text-light">
                <div className="spinner-border spinner-border-lg mb-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <div className="h6 mb-0">Saving Configuration...</div>
                <div className="small text-muted">Please wait while we update your settings</div>
              </div>
            </div>
          )}
          
          <div className="modal-header border-secondary">
            <h5 className="modal-title d-flex align-items-center gap-2">
              <i className={`fa-solid ${feature.icon}`} style={{ color: feature.color }} />
              {feature.label} Configuration
              {isDirty() && <span className="dirty-badge">Unsaved</span>}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={handleClose} />
          </div>
          <div className="modal-body">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border spinner-border-lg mb-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <div className="h6 mb-0">Loading Configuration...</div>
                <div className="small text-muted">Fetching your current settings</div>
              </div>
            ) : (
              renderConfigForm()
            )}
          </div>
          
          {/* Modal Footer */}
          <div className="modal-footer border-secondary">
            {isDirty() && (
              <button 
                type="button" 
                className="btn btn-outline-warning me-2"
                onClick={resetConfig}
                disabled={saving}
              >
                <i className="fa-solid fa-rotate-left me-1" />
                Reset
              </button>
            )}
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={saving}
            >
              <i className="fa-solid fa-times me-1" />
              Close
            </button>
            {/* Add Save button for all forms except roles */}
            {feature.key !== 'roles' && feature.key !== 'scheduler' && feature.key !== 'automod' && (
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !isDirty()}
              >
                {saving ? (
                  <>
                    <div className="spinner-border spinner-border-sm me-1" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-save me-1" />
                    Save Changes
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Unsaved Changes Confirmation Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        featureName={feature.label}
      />
    </div>
  );
}
