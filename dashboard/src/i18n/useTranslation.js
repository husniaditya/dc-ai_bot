import { useI18n } from './I18nContext';

// Custom hook with additional utility functions
export function useTranslation() {
  const i18n = useI18n();
  
  // Utility function for plural forms (basic implementation)
  const plural = (key, count, interpolations = {}) => {
    const { t } = i18n;
    const baseKey = count === 1 ? `${key}.singular` : `${key}.plural`;
    return t(baseKey, { count, ...interpolations });
  };
  
  // Utility function for conditional translation
  const conditionalT = (condition, trueKey, falseKey, interpolations = {}) => {
    const { t } = i18n;
    return t(condition ? trueKey : falseKey, interpolations);
  };
  
  // Utility function for array of translations
  const tArray = (keyArray, interpolations = {}) => {
    const { t } = i18n;
    return keyArray.map(key => t(key, interpolations));
  };
  
  return {
    ...i18n,
    plural,
    conditionalT,
    tArray
  };
}

export default useTranslation;
