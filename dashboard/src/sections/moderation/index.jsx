import React, { useState, useEffect } from 'react';
import { getChannels, getRoles } from '../../api';
import { MODERATION_FEATURES } from './constants';
import FeatureCard from './components/FeatureCard';
import ConfigurationModal from './components/ConfigurationModal';

export default function ModerationSection({ guildId, pushToast }) {
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeFeature, setActiveFeature] = useState(null);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);

  // Safe toast function that can be used in async contexts
  const showToast = (type, message) => {
    if (pushToast && typeof pushToast === 'function') {
      pushToast(type, message);
    }
  };

  // Load moderation configurations
  useEffect(() => {
    if (!guildId) return;

    const loadModerationData = async () => {
      setLoading(true);
      try {
        // Load all data in parallel
        const [featuresRes, channelsData, rolesData] = await Promise.all([
          fetch('/api/moderation/features', {
            headers: { 
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'X-Guild-Id': guildId
            }
          }),
          getChannels(guildId),
          getRoles(guildId)
        ]);

        if (featuresRes.ok) {
          const featuresData = await featuresRes.json();
          setFeatures(featuresData || {});
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
        console.error('Failed to load moderation data:', error);
        // Initialize with default disabled state on error
        const defaultConfig = {};
        MODERATION_FEATURES.forEach(feature => {
          defaultConfig[feature.key] = {
            enabled: false,
            config: {}
          };
        });
        setFeatures(defaultConfig);
        showToast('error', 'Failed to load moderation settings');
      } finally {
        setLoading(false);
      }
    };

    loadModerationData();
  }, [guildId]);

  // Toggle feature enabled state
  const toggleFeature = async (featureKey, enabled) => {
    setSaving(prev => ({ ...prev, [featureKey]: true }));
    
    // Optimistic update
    setFeatures(prev => ({
      ...prev,
      [featureKey]: { ...(prev[featureKey] || {}), enabled }
    }));

    try {
      const response = await fetch(`/api/moderation/features/${featureKey}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Guild-Id': guildId
        },
        body: JSON.stringify({ enabled })
      });

      if (!response.ok) {
        throw new Error(`Failed to toggle ${featureKey}`);
      }

      const data = await response.json();
      setFeatures(prev => ({
        ...prev,
        [featureKey]: data
      }));

      showToast('success', `${MODERATION_FEATURES.find(f => f.key === featureKey)?.label} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle feature:', error);
      // Revert optimistic update
      setFeatures(prev => ({
        ...prev,
        [featureKey]: { ...(prev[featureKey] || {}), enabled: !enabled }
      }));
      showToast('error', `Failed to ${enabled ? 'enable' : 'disable'} feature`);
    } finally {
      setSaving(prev => ({ ...prev, [featureKey]: false }));
    }
  };

  // Open configuration modal
  const openConfigModal = (featureKey) => {
    const feature = MODERATION_FEATURES.find(f => f.key === featureKey);
    if (!feature) return;

    setActiveFeature({
      ...feature,
      config: features[featureKey] || {}
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
      let response;
      
      // Handle welcome feature differently
      if (activeFeature.key === 'welcome') {
        response = await fetch('/api/moderation/welcome/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'X-Guild-Id': guildId
          },
          body: JSON.stringify(config)
        });
      } else {
        response = await fetch(`/api/moderation/features/${activeFeature.key}/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'X-Guild-Id': guildId
          },
          body: JSON.stringify(config)
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to save ${activeFeature.key} configuration`);
      }

      const data = await response.json();
      
      // Handle different response structures
      let updatedConfig;
      if (activeFeature.key === 'welcome') {
        updatedConfig = data.config || data || config;
      } else {
        updatedConfig = data || config;
      }
      
      setFeatures(prev => ({
        ...prev,
        [activeFeature.key]: {
          ...prev[activeFeature.key],
          ...updatedConfig
        }
      }));

      closeConfigModal();
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error; // Re-throw to let modal handle the error
    }
  };

  if (loading) {
    return (
      <div className="moderation-loading-overlay">
        <div className="loading-backdrop">
          <div className="loading-content">
            <div className="loading-spinner-container mb-4">
              <div className="loading-spinner">
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
              </div>
            </div>
            <div className="loading-text">
              <h5 className="mb-2 text-white">Loading Moderation Settings</h5>
              <p className="text-white-50 mb-0">Fetching your server configuration and permissions...</p>
            </div>
            <div className="loading-progress mt-4">
              <div className="progress-dots">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          </div>
        </div>
        
        <style jsx>{`
          .moderation-loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease-out;
          }
          
          .loading-backdrop {
            background: linear-gradient(135deg, rgba(88, 101, 242, 0.1), rgba(114, 137, 218, 0.1));
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 3rem;
            text-align: center;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
          }
          
          .loading-spinner-container {
            display: flex;
            justify-content: center;
            align-items: center;
          }
          
          .loading-spinner {
            position: relative;
            width: 60px;
            height: 60px;
          }
          
          .spinner-ring {
            position: absolute;
            width: 60px;
            height: 60px;
            border: 3px solid transparent;
            border-radius: 50%;
            animation: spin 2s linear infinite;
          }
          
          .spinner-ring:nth-child(1) {
            border-top-color: #5865f2;
            animation-delay: 0s;
          }
          
          .spinner-ring:nth-child(2) {
            border-right-color: #7289da;
            animation-delay: 0.5s;
            width: 50px;
            height: 50px;
            top: 5px;
            left: 5px;
          }
          
          .spinner-ring:nth-child(3) {
            border-bottom-color: #99aab5;
            animation-delay: 1s;
            width: 40px;
            height: 40px;
            top: 10px;
            left: 10px;
          }
          
          .progress-dots {
            display: flex;
            justify-content: center;
            gap: 8px;
          }
          
          .dot {
            width: 8px;
            height: 8px;
            background: #5865f2;
            border-radius: 50%;
            animation: dotPulse 1.5s ease-in-out infinite;
          }
          
          .dot:nth-child(2) {
            animation-delay: 0.3s;
          }
          
          .dot:nth-child(3) {
            animation-delay: 0.6s;
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
          
          @keyframes dotPulse {
            0%, 100% {
              opacity: 0.4;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.2);
            }
          }
        `}</style>
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
        {MODERATION_FEATURES.map(feature => (
          <FeatureCard
            key={feature.key}
            feature={feature}
            featureConfig={features[feature.key]}
            onToggle={toggleFeature}
            onConfigure={openConfigModal}
            saving={saving}
          />
        ))}
      </div>

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
