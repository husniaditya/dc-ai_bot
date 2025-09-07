import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

// Import translations
import en from './locales/en.json';
import id from './locales/id.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';

// Available translations
const translations = {
  en,
  id,
  es,
  fr,
  de,
  ja
};

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' }
];

// Default language
export const DEFAULT_LANGUAGE = 'en';

// Local storage key
const LANGUAGE_STORAGE_KEY = 'dashboard_language';

// Create context
const I18nContext = createContext();

// Provider component
export function I18nProvider({ children }) {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    // Try to get language from localStorage first
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && translations[saved]) {
      return saved;
    }
    
    // Try to detect browser language
    const browserLang = navigator.language.split('-')[0];
    if (translations[browserLang]) {
      return browserLang;
    }
    
    // Fall back to default
    return DEFAULT_LANGUAGE;
  });

  const [currentTranslations, setCurrentTranslations] = useState(translations[currentLanguage]);

  // Update translations when language changes
  useEffect(() => {
    setCurrentTranslations(translations[currentLanguage]);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  }, [currentLanguage]);

  // Get nested translation with fallback
  const getNestedValue = (obj, path, fallback = '') => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : fallback;
    }, obj);
  };

  // Change language function - memoized to prevent recreating on every render
  const changeLanguage = useCallback((languageCode) => {
    if (translations[languageCode] && languageCode !== currentLanguage) {
      setCurrentLanguage(languageCode);
    }
  }, [currentLanguage]);

  // Force language change (used for loading from database)
  const forceChangeLanguage = useCallback((languageCode) => {
    if (translations[languageCode]) {
      setCurrentLanguage(languageCode);
    }
  }, []);

  // Translation function with interpolation - memoized
  const t = useCallback((key, interpolations = {}) => {
    let translation = getNestedValue(currentTranslations, key, key);
    
    // If translation not found, try fallback to English
    if (translation === key && currentLanguage !== DEFAULT_LANGUAGE) {
      translation = getNestedValue(translations[DEFAULT_LANGUAGE], key, key);
    }

    // Handle interpolations (e.g., {{value}})
    if (typeof translation === 'string' && Object.keys(interpolations).length > 0) {
      return translation.replace(/\{\{(\w+)\}\}/g, (match, placeholder) => {
        return interpolations[placeholder] || match;
      });
    }

    return translation;
  }, [currentTranslations, currentLanguage]);

  // Get current language info - memoized
  const getCurrentLanguageInfo = useCallback(() => {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === currentLanguage) || SUPPORTED_LANGUAGES[0];
  }, [currentLanguage]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    currentLanguage,
    changeLanguage,
    forceChangeLanguage,
    t,
    translations: currentTranslations,
    supportedLanguages: SUPPORTED_LANGUAGES,
    isRTL: ['ar', 'he', 'fa', 'ur'].includes(currentLanguage),
    currentLanguageInfo: getCurrentLanguageInfo()
  }), [currentLanguage, changeLanguage, forceChangeLanguage, t, currentTranslations, getCurrentLanguageInfo]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

// Hook to use i18n
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Export context for advanced usage
export { I18nContext };
