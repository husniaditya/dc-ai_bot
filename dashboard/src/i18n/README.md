# Internationalization (i18n) System

This dashboard supports multiple languages through a comprehensive internationalization system.

## Supported Languages

- English (en) - Default
- Indonesian (id) - Bahasa Indonesia  
- Spanish (es) - Español
- French (fr) - Français
- German (de) - Deutsch
- Japanese (ja) - 日本語

## Quick Start

### 1. Using translations in components

```jsx
import { useI18n } from '../i18n';

function MyComponent() {
  const { t } = useI18n();
  
  return (
    <div>
      <h1>{t('common.settings')}</h1>
      <p>{t('settings.description')}</p>
    </div>
  );
}
```

### 2. Using translations with interpolation

```jsx
const { t } = useI18n();

// In your JSX
<p>{t('settings.timezone.help', { value: 'UTC+07:00' })}</p>
```

### 3. Changing language

```jsx
import { useI18n } from '../i18n';

function LanguageSwitcher() {
  const { currentLanguage, changeLanguage, supportedLanguages } = useI18n();
  
  return (
    <select value={currentLanguage} onChange={e => changeLanguage(e.target.value)}>
      {supportedLanguages.map(lang => (
        <option key={lang.code} value={lang.code}>
          {lang.nativeName}
        </option>
      ))}
    </select>
  );
}
```

## Available Hooks and Components

### Hooks

- `useI18n()` - Main hook for accessing translation functions
- `useTranslation()` - Extended hook with additional utilities
- `useLocalizedDate()` - Hook for date/time formatting

### Components

- `<LanguageSelector />` - Full language selector component
- `<CompactLanguageSelector />` - Compact dropdown for navbar
- `<T k="translation.key" />` - Inline translation component

## Translation Structure

Translations are organized in JSON files located in `src/i18n/locales/`:

```
src/i18n/locales/
├── en.json     # English (default)
├── id.json     # Indonesian
├── es.json     # Spanish
├── fr.json     # French
├── de.json     # German
└── ja.json     # Japanese
```

### Translation Key Structure

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "loading": "Loading..."
  },
  "settings": {
    "title": "Settings",
    "autoReply": {
      "enabled": "Auto Reply Enabled"
    }
  }
}
```

## Adding New Translations

### 1. Add to existing files

Edit the JSON files in `src/i18n/locales/` and add your new keys.

### 2. Adding a new language

1. Create a new JSON file: `src/i18n/locales/xx.json`
2. Add the language to `SUPPORTED_LANGUAGES` in `I18nContext.jsx`
3. Import and add to `translations` object in `I18nContext.jsx`

Example:
```javascript
// Add to imports
import pt from './locales/pt.json';

// Add to translations object
const translations = {
  en, id, es, fr, de, ja, pt
};

// Add to SUPPORTED_LANGUAGES
export const SUPPORTED_LANGUAGES = [
  // ... existing languages
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' }
];
```

## Best Practices

### 1. Use nested keys for organization
```json
{
  "settings": {
    "server": {
      "title": "Server Settings",
      "description": "Configure your server"
    }
  }
}
```

### 2. Use interpolation for dynamic content
```json
{
  "welcome": "Welcome back, {{username}}!"
}
```

```jsx
// Usage
t('welcome', { username: 'John' })
```

### 3. Provide context in key names
```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel"
  },
  "messages": {
    "save": "Your changes have been saved"
  }
}
```

### 4. Use descriptive namespaces
- `common.*` - General UI elements (buttons, actions)
- `navigation.*` - Menu items, navigation
- `settings.*` - Settings page content
- `errors.*` - Error messages
- `auth.*` - Authentication related
- `loading.*` - Loading states

## Language Detection

The system automatically detects the user's preferred language in this order:

1. Previously saved language (localStorage)
2. Browser language (navigator.language)
3. Default language (English)

## Fallback System

If a translation key is not found in the current language, the system will:

1. Try to find the key in English (default language)
2. Return the key itself if not found in any language

## Date and Time Formatting

Use the localized date formatting utilities:

```jsx
import { useLocalizedDate } from '../i18n/utils';

function MyComponent() {
  const { formatDate, formatTime, formatDateTime } = useLocalizedDate();
  
  return (
    <div>
      <p>Date: {formatDate(new Date())}</p>
      <p>Time: {formatTime(new Date())}</p>
      <p>DateTime: {formatDateTime(new Date())}</p>
    </div>
  );
}
```

## Testing Translations

1. Change language using the language selector in the navbar
2. All UI elements should update immediately
3. Language preference is persisted across browser sessions
4. Check that placeholders and interpolations work correctly

## Performance

- Translations are loaded once at application start
- Language changes are instant (no additional network requests)
- Only used translations are bundled with the app
- Translation files are cached by the browser
