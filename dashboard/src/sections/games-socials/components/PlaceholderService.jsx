import React from 'react';
import { useI18n } from '../../../i18n';

/**
 * PlaceholderService - Shows placeholder content for unimplemented services
 */
export default function PlaceholderService({ service }) {
  const { t } = useI18n();
  if (!service) return null;

  return (
    <div className="text-muted small p-3">
      <p className="mb-1">
  <strong>{t(service.labelKey || '') || service.key}</strong> {t('gamesSocials.common.integrationNotConfigured')}
      </p>
      <p className="mb-2">
  {t('gamesSocials.common.plannedFeatures')}: {t(service.descKey || '')}
      </p>
      <p className="mb-0">
        {t('gamesSocials.common.needSooner')}
      </p>
    </div>
  );
}
