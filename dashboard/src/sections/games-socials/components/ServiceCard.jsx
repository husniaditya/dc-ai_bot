import React from 'react';
import { SERVICES } from '../constants';
import { useI18n } from '../../../i18n';

/**
 * ServiceCard - Represents a service integration card
 */
export default function ServiceCard({ 
  serviceKey, 
  isActive, 
  isEnabled, 
  onSelect, 
  onToggle, 
  canToggle = true,
  isLoading = false 
}) {
  const { t } = useI18n();
  const service = SERVICES.find(s => s.key === serviceKey);
  if (!service) return null;

  const activeCls = isActive ? 'active' : '';
  
  function handleToggle(e) {
    e.stopPropagation();
    if (canToggle && !isLoading) {
      onToggle?.(serviceKey);
    }
  }

  return (
    <button 
      type="button" 
      className={`service-card card-glass p-3 pt-4 text-start position-relative ${activeCls}`} 
      onClick={() => onSelect?.(serviceKey)} 
      style={{
        width: 170, 
        border: isActive ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <div className="position-absolute top-0 end-0 p-1" onClick={e => e.stopPropagation()}>
        <div className="form-check form-switch m-0">
          <input 
            className="form-check-input" 
            style={{cursor: canToggle && !isLoading ? 'pointer' : 'not-allowed'}} 
            disabled={!canToggle || isLoading} 
            type="checkbox" 
            checked={isEnabled} 
            onChange={handleToggle} 
          />
        </div>
      </div>
      
      <div className="d-flex align-items-center gap-2 mb-2">
        {service.image ? (
          <img 
            src={`/images/${service.image}`} 
            alt={t(service.labelKey || '') || service.key} 
            style={{height: 44, width: 44, objectFit: 'contain', borderRadius: 8}} 
          />
        ) : (
          <span className="service-icon" style={{color: service.color, fontSize: '1.4rem'}}>
            <i className={service.icon}></i>
          </span>
        )}
        <span className="fw-semibold" style={{fontSize: '0.85rem'}}>
          {t(service.labelKey || '') || service.key}
        </span>
      </div>
      
      <div className="small text-muted" style={{fontSize: '0.65rem', lineHeight: 1.1}}>
        {t(service.descKey || '')}
      </div>
      
      {isLoading && (
        <div className="position-absolute top-50 start-50 translate-middle">
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">{t('common.loading')}</span>
          </div>
        </div>
      )}
    </button>
  );
}
