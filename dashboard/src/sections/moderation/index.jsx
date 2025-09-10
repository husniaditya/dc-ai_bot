import React, { useState, useEffect } from 'react';
import { getChannels, getRoles } from '../../api';
import { MODERATION_FEATURES } from './constants';
import FeatureCard from './components/FeatureCard';
import ConfigurationModal from './components/ConfigurationModal';
import LoadingSection from '../../components/LoadingSection';
import { useI18n } from '../../i18n';

export default function ModerationSection({ guildId, pushToast, settings }) {
  const { t } = useI18n();
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
  showToast('error', t('moderation.common.loadFailedGeneric'));
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

  const found = MODERATION_FEATURES.find(f => f.key === featureKey);
  const label = found?.labelKey ? t(found.labelKey) : found?.label;
  const msg = enabled ? t('moderation.common.enabled', { feature: label }) : t('moderation.common.disabled', { feature: label });
  showToast('success', msg);
    } catch (error) {
      console.error('Failed to toggle feature:', error);
      // Revert optimistic update
      setFeatures(prev => ({
        ...prev,
        [featureKey]: { ...(prev[featureKey] || {}), enabled: !enabled }
      }));
  showToast('error', enabled ? t('moderation.common.enableFailed') : t('moderation.common.disableFailed'));
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
      } else if (activeFeature.key === 'logging') {
        response = await fetch('/api/moderation/audit-logs/config', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'X-Guild-Id': guildId
          },
          body: JSON.stringify(config)
        });
      } else if (activeFeature.key === 'xp') {
        response = await fetch('/api/moderation/xp/config', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'X-Guild-Id': guildId
          },
          body: JSON.stringify(config)
        });
      } else if (activeFeature.key === 'antiraid') {
        response = await fetch('/api/moderation/antiraid/config', {
          method: 'PUT',
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
      } else if (activeFeature.key === 'logging') {
        updatedConfig = data.config || data || config;
      } else if (activeFeature.key === 'xp') {
        updatedConfig = data.config || data || config;
      } else if (activeFeature.key === 'antiraid') {
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

  // Compute counts based only on declared features
  const total = MODERATION_FEATURES.length;
  const enabledCount = MODERATION_FEATURES.reduce(
    (n, f) => n + (features?.[f.key]?.enabled ? 1 : 0),
    0
  );
  const pct = Math.round((enabledCount / total) * 100);

  return (
    <LoadingSection
      loading={loading}
  title={t('moderation.loading.title')}
  message={t('moderation.loading.message')}
      className="moderation-section fade-in-soft position-relative"
      style={{ minHeight: '600px' }}
    >
      <div className="d-flex align-items-center gap-2 mb-3">
        <h5 className="mb-0">{t('moderation.title')}</h5>
        <span className="badge badge-soft">
          {t('moderation.badge.enabledOfTotal', { enabled: enabledCount, total })}
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
            <h6 className="mb-2">{t('moderation.overview.title')}</h6>
            <p className="text-muted small mb-0">
              {t('moderation.overview.desc')}
            </p>
          </div>
          <div className="col-md-4">
            <div className="text-end">
              <div className="small text-muted mb-1">{t('moderation.overview.protectionLevel')}</div>
              <div className="progress" style={{ height: 8 }}>
                <div 
                  className="progress-bar bg-primary"
                  style={{ 
                    width: `${(enabledCount / total) * 100}%`
                  }}
                />
              </div>
              <div className="small text-muted mt-1">
                {pct}% {t('moderation.overview.complete')}
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
          settings={settings}
          onSave={saveFeatureConfig}
          onClose={closeConfigModal}
          showToast={showToast}
        />
      )}
    </LoadingSection>
  );
}
