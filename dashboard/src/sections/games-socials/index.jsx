import React, { useEffect, useState } from 'react';
import { 
  getYouTubeConfig, 
  updateYouTubeConfig, 
  getTwitchConfig, 
  updateTwitchConfig,
  getChannels, 
  getRoles 
} from '../../api';
import LoadingSection from '../../components/LoadingSection';
import { useI18n } from '../../i18n';

// Components
import ServiceCard from './components/ServiceCard';
import ServiceConfigCard from './components/ServiceConfigCard';
import PlaceholderService from './components/PlaceholderService';

// Features
import YouTubeConfig from './features/YouTubeConfig';
import TwitchConfig from './features/TwitchConfig';

// Utils
import { cleanChannelIds, cleanStreamerUsernames, hasUnsavedChanges } from './utils';
import { SERVICES, DEFAULT_CONFIGS } from './constants';

/**
 * GamesSocialsSection - Main container for Games & Socials integrations
 */
export default function GamesSocialsSection({ guildId, pushToast }) {
  const { t } = useI18n();
  const [activeService, setActiveService] = useState('youtube');
  
  // YouTube state
  const [ytConfig, setYtConfig] = useState(null);
  const [ytOriginal, setYtOriginal] = useState(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytSaving, setYtSaving] = useState(false);
  
  // Twitch state
  const [twitchConfig, setTwitchConfig] = useState(null);
  const [twitchOriginal, setTwitchOriginal] = useState(null);
  const [twitchLoading, setTwitchLoading] = useState(false);
  const [twitchSaving, setTwitchSaving] = useState(false);
  
  // Shared data
  const [discordChannels, setDiscordChannels] = useState([]);
  const [guildRoles, setGuildRoles] = useState([]);

  // Load configurations when guildId changes or component mounts
  useEffect(() => {
    if (!guildId) return;
    
    (async () => {
      try {
        setYtLoading(true);
        setTwitchLoading(true);
        
        const [ytCfg, twitchCfg, ch, roles] = await Promise.all([
          getYouTubeConfig(guildId).catch(() => null),
          getTwitchConfig(guildId).catch(() => null),
          getChannels(guildId).catch(() => null),
          getRoles(guildId).catch(() => null)
        ]);
        
        // Set YouTube config
        if (ytCfg) { 
          const cleanedYtCfg = {
            ...DEFAULT_CONFIGS.youtube,
            ...ytCfg,
            channels: cleanChannelIds(ytCfg.channels || [])
          };
          setYtConfig(cleanedYtCfg); 
          setYtOriginal(cleanedYtCfg); 
        }
        
        // Set Twitch config
        if (twitchCfg) { 
          const cleanedTwitchCfg = {
            ...DEFAULT_CONFIGS.twitch,
            ...twitchCfg,
            streamers: cleanStreamerUsernames(twitchCfg.streamers || [])
          };
          setTwitchConfig(cleanedTwitchCfg); 
          setTwitchOriginal(cleanedTwitchCfg); 
        }
        
        // Set shared data
        if (ch && Array.isArray(ch.channels)) setDiscordChannels(ch.channels);
        if (roles && Array.isArray(roles.roles)) setGuildRoles(roles.roles);
        
      } finally { 
        setYtLoading(false); 
        setTwitchLoading(false);
      }
    })();
  }, [guildId]);

  // Service handlers
  const handleServiceSelect = (serviceKey) => {
    setActiveService(serviceKey);
  };

  const handleServiceToggle = async (serviceKey) => {
    if (serviceKey === 'youtube') {
      if (!ytConfig) return;
      
      const newEnabled = !ytConfig.enabled;
      const prevConfig = ytConfig;
      
      // Optimistic update
      setYtConfig(prev => ({ ...prev, enabled: newEnabled }));
      
      try {
        const updated = await updateYouTubeConfig({ ...prevConfig, enabled: newEnabled }, guildId);
        const safeConfig = {
          ...DEFAULT_CONFIGS.youtube,
          ...updated,
          channels: cleanChannelIds(updated?.channels || [])
        };
  setYtConfig(safeConfig); 
  setYtOriginal(safeConfig);
  pushToast && pushToast('success', t(newEnabled ? 'gamesSocials.toasts.serviceEnabled' : 'gamesSocials.toasts.serviceDisabled', { service: t('gamesSocials.services.youtube.label') }));
      } catch (err) {
  pushToast && pushToast('error', t('gamesSocials.toasts.toggleFailed'));
        setYtConfig(prevConfig); // revert
      }
    } else if (serviceKey === 'twitch') {
      if (!twitchConfig) return;
      
      const newEnabled = !twitchConfig.enabled;
      const prevConfig = twitchConfig;
      
      // Optimistic update
      setTwitchConfig(prev => ({ ...prev, enabled: newEnabled }));
      
      try {
        const updated = await updateTwitchConfig({ ...prevConfig, enabled: newEnabled }, guildId);
        const safeConfig = {
          ...DEFAULT_CONFIGS.twitch,
          ...updated,
          streamers: cleanStreamerUsernames(updated?.streamers || [])
        };
  setTwitchConfig(safeConfig); 
  setTwitchOriginal(safeConfig);
  pushToast && pushToast('success', t(newEnabled ? 'gamesSocials.toasts.serviceEnabled' : 'gamesSocials.toasts.serviceDisabled', { service: t('gamesSocials.services.twitch.label') }));
      } catch (err) {
  pushToast && pushToast('error', t('gamesSocials.toasts.toggleFailed'));
        setTwitchConfig(prevConfig); // revert
      }
    }
  };

  // YouTube handlers
  const handleYtSave = async () => {
    if (!ytConfig) return;
    
    try { 
      setYtSaving(true); 
      const updated = await updateYouTubeConfig(ytConfig, guildId); 
      const safe = {
        ...DEFAULT_CONFIGS.youtube,
        ...updated,
        channels: Array.isArray(updated?.channels) ? updated.channels : [],
        mentionTargets: Array.isArray(updated?.mentionTargets) ? updated.mentionTargets : (updated?.mentionRoleId ? [updated.mentionRoleId] : []),
        channelMessages: updated?.channelMessages || {},
        channelNames: updated?.channelNames || {}
      }; 
  setYtConfig(safe); 
  setYtOriginal(safe); 
  pushToast && pushToast('success', t('gamesSocials.toasts.saved', { service: t('gamesSocials.services.youtube.label') })); 
    } catch (e) { 
      console.error('YouTube save error:', e);
  pushToast && pushToast('error', t('gamesSocials.toasts.saveFailed')); 
    } finally { 
      setYtSaving(false); 
    }
  };

  const handleYtReset = () => {
    if (ytOriginal) setYtConfig(ytOriginal);
  };

  // Twitch handlers
  const handleTwitchSave = async () => {
    if (!twitchConfig) return;
    
    try { 
      setTwitchSaving(true); 
      const updated = await updateTwitchConfig(twitchConfig, guildId); 
      const safe = {
        ...DEFAULT_CONFIGS.twitch,
        ...updated,
        streamers: Array.isArray(updated?.streamers) ? updated.streamers : [],
        mentionTargets: Array.isArray(updated?.mentionTargets) ? updated.mentionTargets : (updated?.mentionRoleId ? [updated.mentionRoleId] : []),
        streamerMessages: updated?.streamerMessages || {},
        streamerNames: updated?.streamerNames || {}
      }; 
  setTwitchConfig(safe); 
  setTwitchOriginal(safe); 
  pushToast && pushToast('success', t('gamesSocials.toasts.saved', { service: t('gamesSocials.services.twitch.label') })); 
    } catch (e) { 
      console.error('Twitch save error:', e);
  pushToast && pushToast('error', t('gamesSocials.toasts.saveFailed')); 
    } finally { 
      setTwitchSaving(false); 
    }
  };

  const handleTwitchReset = () => {
    if (twitchOriginal) setTwitchConfig(twitchOriginal);
  };

  // Get current service and check states
  const currentService = SERVICES.find(s => s.key === activeService);
  const showOverlay = (activeService === 'youtube' && (ytLoading || (!ytConfig && guildId))) || 
                     (activeService === 'twitch' && (twitchLoading || (!twitchConfig && guildId)));

  const ytHasChanges = hasUnsavedChanges(ytConfig, ytOriginal);
  const twitchHasChanges = hasUnsavedChanges(twitchConfig, twitchOriginal);

  return (
    <LoadingSection
      loading={showOverlay}
      title={t('gamesSocials.loading.title')}
      message={t('gamesSocials.loading.message')}
      className="p-4 games-socials-wrapper position-relative"
      style={{ minHeight: '600px' }}
    >
      {/* Header */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <h5 className="mb-0">{t('gamesSocials.title')}</h5>
        {activeService === 'youtube' && ytHasChanges && <span className="dirty-badge">{t('common.unsaved')}</span>}
        {activeService === 'twitch' && twitchHasChanges && <span className="dirty-badge">{t('common.unsaved')}</span>}
      </div>

      {/* Service Cards Grid */}
      <div className="services-grid d-flex flex-wrap gap-3 mb-3">
        {SERVICES.map(service => {
          const isEnabled = service.key === 'youtube' ? (ytConfig?.enabled ?? false) : 
                           service.key === 'twitch' ? (twitchConfig?.enabled ?? false) : false;
          const isLoading = service.key === 'youtube' ? ytLoading : 
                           service.key === 'twitch' ? twitchLoading : false;
          
          return (
            <ServiceCard
              key={service.key}
              serviceKey={service.key}
              isActive={service.key === activeService}
              isEnabled={isEnabled}
              onSelect={handleServiceSelect}
              onToggle={handleServiceToggle}
              canToggle={service.implemented && (
                (service.key === 'youtube' && ytConfig) || 
                (service.key === 'twitch' && twitchConfig)
              )}
              isLoading={isLoading}
            />
          );
        })}
      </div>

      <hr />

      {/* Service Configuration */}
      {currentService && (
        <>
          <ServiceConfigCard 
            serviceKey={activeService}
            isEnabled={activeService === 'youtube' ? (ytConfig?.enabled ?? false) : 
                      activeService === 'twitch' ? (twitchConfig?.enabled ?? false) : false}
            hasUnsavedChanges={activeService === 'youtube' ? ytHasChanges : 
                             activeService === 'twitch' ? twitchHasChanges : false}
          />

          {/* Render appropriate configuration component */}
          {activeService === 'youtube' ? (
            <>
              <YouTubeConfig
                config={ytConfig}
                onChange={setYtConfig}
                onSave={handleYtSave}
                discordChannels={discordChannels}
                guildRoles={guildRoles}
                guildId={guildId}
                pushToast={pushToast}
                isSaving={ytSaving}
              />
              
              <div className="d-flex gap-2 mt-3">
                <button 
                  className="btn btn-outline-secondary" 
                  disabled={!ytHasChanges || ytSaving} 
                  onClick={handleYtReset}
                >
                  <i className="fa-solid fa-rotate-left me-2"/>{t('common.reset')}
                </button>
                <button 
                  className="btn btn-primary" 
                  disabled={!ytHasChanges || ytSaving} 
                  onClick={handleYtSave}
                >
                  <i className="fa-solid fa-floppy-disk me-2"/>
                  {ytSaving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </>
          ) : activeService === 'twitch' ? (
            <>
              <TwitchConfig
                config={twitchConfig}
                onChange={setTwitchConfig}
                onSave={handleTwitchSave}
                discordChannels={discordChannels}
                guildRoles={guildRoles}
                guildId={guildId}
                pushToast={pushToast}
                isSaving={twitchSaving}
              />
              
              <div className="d-flex gap-2 mt-3">
                <button 
                  className="btn btn-outline-secondary" 
                  disabled={!twitchHasChanges || twitchSaving} 
                  onClick={handleTwitchReset}
                >
                  <i className="fa-solid fa-rotate-left me-2"/>{t('common.reset')}
                </button>
                <button 
                  className="btn btn-primary" 
                  disabled={!twitchHasChanges || twitchSaving} 
                  onClick={handleTwitchSave}
                >
                  <i className="fa-solid fa-floppy-disk me-2"/>
                  {twitchSaving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </>
          ) : (
            <PlaceholderService service={currentService} />
          )}
        </>
      )}
    </LoadingSection>
  );
}
