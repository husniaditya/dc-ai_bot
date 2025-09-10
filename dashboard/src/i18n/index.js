// Main exports for i18n module
export { I18nProvider, useI18n, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './I18nContext';
export { default as useTranslation } from './useTranslation';
export { T, withTranslation, LanguageSwitch, LangContent, useLocalizedDate } from './utils';

// Utility functions for i18n
export const formatNumber = (number, locale) => {
  try {
    return new Intl.NumberFormat(locale).format(number);
  } catch {
    return number.toString();
  }
};

export const formatCurrency = (amount, currency = 'USD', locale) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

export const formatDate = (date, locale, options = {}) => {
  try {
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      ...options
    };
    return new Intl.DateTimeFormat(locale, defaultOptions).format(new Date(date));
  } catch {
    return new Date(date).toLocaleDateString();
  }
};

export const formatRelativeTime = (date, locale) => {
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const now = new Date();
    const target = new Date(date);
    const diffInSeconds = (target - now) / 1000;
    
    if (Math.abs(diffInSeconds) < 60) {
      return rtf.format(Math.round(diffInSeconds), 'second');
    } else if (Math.abs(diffInSeconds) < 3600) {
      return rtf.format(Math.round(diffInSeconds / 60), 'minute');
    } else if (Math.abs(diffInSeconds) < 86400) {
      return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
    } else {
      return rtf.format(Math.round(diffInSeconds / 86400), 'day');
    }
  } catch {
    return new Date(date).toLocaleDateString();
  }
};
