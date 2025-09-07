import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { getSettings } from '../api';

/**
 * Custom hook to sync language settings with database
 * Loads guild language preference when guild changes and syncs UI language
 */
export function useLanguageSync(guildId, enabled = true) {
  const { currentLanguage, forceChangeLanguage } = useI18n();
  const lastGuildId = useRef(null);
  const isLoadingLanguage = useRef(false);

  useEffect(() => {
    // Only proceed if enabled and we have a guild ID that's different from last one
    if (!enabled || !guildId || guildId === lastGuildId.current || isLoadingLanguage.current) {
      return;
    }

    const loadGuildLanguage = async () => {
      try {
        isLoadingLanguage.current = true;
        lastGuildId.current = guildId;

        // Fetch guild settings to get language preference
        const settings = await getSettings(guildId);
        
        // If guild has a language preference and it's different from current, change it
        if (settings.language && settings.language !== currentLanguage) {
          console.log(`Loading guild language preference: ${settings.language}`);
          forceChangeLanguage(settings.language);
        }
      } catch (error) {
        console.warn('Failed to load guild language preference:', error);
        // Don't throw error, just continue with current language
      } finally {
        isLoadingLanguage.current = false;
      }
    };

    loadGuildLanguage();
  }, [guildId, currentLanguage, forceChangeLanguage, enabled]);

  // Reset when guild changes to null (logged out)
  useEffect(() => {
    if (!guildId) {
      lastGuildId.current = null;
      isLoadingLanguage.current = false;
    }
  }, [guildId]);

  return {
    isLoadingLanguage: isLoadingLanguage.current,
    lastLoadedGuildId: lastGuildId.current
  };
}
