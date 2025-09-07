import React from 'react';
import { useLanguageSync } from '../hooks/useLanguageSync';

/**
 * Component that handles automatic language synchronization with guild settings
 * Must be used within I18nProvider context
 */
export default function LanguageSyncHandler({ guildId, enabled = true }) {
  useLanguageSync(guildId, enabled);
  
  // This component doesn't render anything visible
  return null;
}
