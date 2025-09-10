import React from 'react';
import { useI18n } from '../i18n';

// Utility component to easily translate text
export function T({ k, ...interpolations }) {
  const { t } = useI18n();
  return <>{t(k, interpolations)}</>;
}

// Higher-order component to add translation function to any component
export function withTranslation(Component) {
  return function TranslatedComponent(props) {
    const { t, currentLanguage, changeLanguage } = useI18n();
    return (
      <Component 
        {...props} 
        t={t} 
        currentLanguage={currentLanguage} 
        changeLanguage={changeLanguage} 
      />
    );
  };
}

// Component for conditional rendering based on language
export function LanguageSwitch({ children }) {
  const { currentLanguage } = useI18n();
  
  return React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      const { language, languages } = child.props;
      
      // If specific language prop, only render for that language
      if (language && language !== currentLanguage) {
        return null;
      }
      
      // If languages array prop, only render if current language is in array
      if (languages && Array.isArray(languages) && !languages.includes(currentLanguage)) {
        return null;
      }
      
      return child;
    }
    
    return child;
  });
}

// Component for language-specific content
export function LangContent({ language, languages, children }) {
  // This component is designed to be used within LanguageSwitch
  return <>{children}</>;
}

// Hook for formatting dates according to current locale
export function useLocalizedDate() {
  const { currentLanguage } = useI18n();
  
  const formatDate = (date, options = {}) => {
    try {
      const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        ...options
      };
      return new Intl.DateTimeFormat(currentLanguage, defaultOptions).format(new Date(date));
    } catch {
      return new Date(date).toLocaleDateString();
    }
  };
  
  const formatTime = (date, options = {}) => {
    try {
      const defaultOptions = {
        hour: '2-digit',
        minute: '2-digit',
        ...options
      };
      return new Intl.DateTimeFormat(currentLanguage, defaultOptions).format(new Date(date));
    } catch {
      return new Date(date).toLocaleTimeString();
    }
  };
  
  const formatDateTime = (date, options = {}) => {
    try {
      const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...options
      };
      return new Intl.DateTimeFormat(currentLanguage, defaultOptions).format(new Date(date));
    } catch {
      return new Date(date).toLocaleString();
    }
  };
  
  return { formatDate, formatTime, formatDateTime };
}
