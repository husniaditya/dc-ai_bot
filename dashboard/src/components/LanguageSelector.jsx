import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import '../styles/flags.css';
import 'flag-icons/css/flag-icons.min.css';
import { getSettings, updateSettings } from '../api';

// Map languages to a representative country's ISO 3166-1 alpha-2 code for flag assets
const FLAG_CODES = {
  en: 'us', // English → US
  id: 'id',
  es: 'es',
  fr: 'fr',
  de: 'de',
  ja: 'jp',
};
const getFlagCode = (code) => FLAG_CODES[code] || 'un';

export default function LanguageSelector({ className = '', showLabel = true, size = 'sm', guildId = null, pushToast = null }) {
  const { currentLanguage, changeLanguage, supportedLanguages, t } = useI18n();
  const [saving, setSaving] = useState(false);

  const handleLanguageChange = async (e) => {
    const newLanguage = e.target.value;
  const selectedLang = supportedLanguages.find(l => l.code === newLanguage) || { nativeName: newLanguage.toUpperCase() };
    
    // Always update the UI language immediately
    changeLanguage(newLanguage);
    
    // If guildId is provided, also save to database
    if (guildId) {
      setSaving(true);
      try {
        // Get current settings
        const currentSettings = await getSettings(guildId);
        
        // Update only the language field
        const updatedSettings = {
          ...currentSettings,
          language: newLanguage
        };
        
        // Save to database
        await updateSettings(updatedSettings, guildId);
        
        if (pushToast) {
          pushToast('success', t('settings.language.changedTo', { language: selectedLang.nativeName }));
        }
      } catch (error) {
        console.error('Failed to save language setting:', error);
        if (pushToast) {
          pushToast('error', t('settings.language.saveFailed'));
        }
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className={`language-selector ${className} ${saving ? 'saving' : ''}`}>
      {showLabel && (
        <label className="form-label mb-1 small" htmlFor="language-select">
          {t('settings.language.label')}
          {saving && <span className="ms-2 text-muted small">({t('common.saving')}...)</span>}
        </label>
      )}
      <select
        id="language-select"
        className={`form-select form-select-${size} language-select`}
        value={currentLanguage}
        onChange={handleLanguageChange}
        disabled={saving}
        title={t('settings.language.help')}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}

// Modern compact language selector for navbar/header
export function CompactLanguageSelector({ className = '', guildId = null, pushToast = null }) {
  const { currentLanguage, changeLanguage, supportedLanguages, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  const getCurrentLanguageDisplay = () => {
    const current = supportedLanguages.find(lang => lang.code === currentLanguage);
    return current ? current.code.toUpperCase() : 'EN';
  };

  const getCurrentLanguageInfo = () => {
    return supportedLanguages.find(lang => lang.code === currentLanguage) || supportedLanguages[0];
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleLanguageSelect = async (languageCode) => {
    const selectedLang = supportedLanguages.find(l => l.code === languageCode) || { nativeName: languageCode.toUpperCase() };
    // Always update the UI language immediately
    changeLanguage(languageCode);
    setIsOpen(false);
    
    // If guildId is provided, also save to database
    if (guildId) {
      setSaving(true);
      try {
        // Get current settings
        const currentSettings = await getSettings(guildId);
        
        // Update only the language field
        const updatedSettings = {
          ...currentSettings,
          language: languageCode
        };
        
        // Save to database
        await updateSettings(updatedSettings, guildId);
        
        if (pushToast) {
          pushToast('success', t('settings.language.changedTo', { language: selectedLang.nativeName }));
        }
      } catch (error) {
        console.error('Failed to save language setting:', error);
        if (pushToast) {
          pushToast('error', t('settings.language.saveFailed'));
        }
      } finally {
        setSaving(false);
      }
    }
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const currentLang = getCurrentLanguageInfo();
  const currentFlagCode = getFlagCode(currentLang.code);
  const isMobile = window.innerWidth <= 768;

  return (
    <div 
      className={`language-dropdown ${className} ${isOpen && isMobile ? 'mobile-open' : ''}`} 
      ref={dropdownRef}
    >
      <button
        className={`language-dropdown-trigger ${saving ? 'saving' : ''}`}
        type="button"
        onClick={toggleDropdown}
        disabled={saving}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Current language: ${currentLang.nativeName}. Click to change language.`}
        title="Change Language"
      >
  <span className={`fi fi-${currentFlagCode}`} aria-hidden="true"></span>
        <span className="language-code">{getCurrentLanguageDisplay()}</span>
        {saving ? (
          <i className="fa-solid fa-spinner fa-spin"></i>
        ) : (
          <i className={`fa-solid fa-chevron-down chevron ${isOpen ? 'open' : ''}`}></i>
        )}
      </button>
      
      {isOpen && (
        <div className="language-dropdown-menu" role="menu">
          <div className="language-dropdown-header">
            <i className="fa-solid fa-globe"></i>
            <span>Choose Language</span>
          </div>
          <div className="language-options">
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                className={`language-option ${currentLanguage === lang.code ? 'active' : ''}`}
                onClick={() => handleLanguageSelect(lang.code)}
                role="menuitem"
                aria-label={`Switch to ${lang.nativeName} (${lang.name})`}
              >
                <span className={`fi fi-${getFlagCode(lang.code)}`} aria-hidden="true"></span>
                <div className="language-info">
                  <span className="language-native">{lang.nativeName}</span>
                  <span className="language-english">{lang.name}</span>
                </div>
                {currentLanguage === lang.code && (
                  <i className="fa-solid fa-check check-icon" aria-hidden="true"></i>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
