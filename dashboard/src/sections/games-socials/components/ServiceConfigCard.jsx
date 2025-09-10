import React from 'react';
import { SERVICES } from '../constants';
import { useI18n } from '../../../i18n';

/**
 * ServiceConfigCard - Header card for service configuration
 */
export default function ServiceConfigCard({ serviceKey, isEnabled, hasUnsavedChanges }) {
  const { t } = useI18n();
  const service = SERVICES.find(s => s.key === serviceKey);
  if (!service) return null;

  return (
    <div className="app-config-header d-flex align-items-center gap-3 mb-3">
      {service.image ? (
        <img 
          src={`/images/${service.image}`} 
          alt={t(service.labelKey || '') || service.key} 
          className="app-config-icon" 
        />
      ) : (
        <span className="service-icon" style={{color: service.color}}>
          <i className={service.icon}></i>
        </span>
      )}
      
      <div className="flex-grow-1">
        <div className="fw-semibold d-flex align-items-center gap-2" style={{fontSize: '.9rem'}}>
          {t(service.labelKey || '') || service.key} {t('gamesSocials.common.configuration')}
          {hasUnsavedChanges && <span className="dirty-badge">{t('common.unsaved')}</span>}
        </div>
        <div className="small text-muted" style={{fontSize: '.6rem'}}>
          {isEnabled ? t('gamesSocials.common.announcementsEnabled') : t('gamesSocials.common.announcementsDisabled')}
        </div>
      </div>
      
      <span className={`status-dot ${isEnabled ? 'on' : 'off'}`}></span>
    </div>
  );
}
