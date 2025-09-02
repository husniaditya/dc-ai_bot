import React from 'react';
import { SERVICES } from '../constants';

/**
 * ServiceConfigCard - Header card for service configuration
 */
export default function ServiceConfigCard({ serviceKey, isEnabled, hasUnsavedChanges }) {
  const service = SERVICES.find(s => s.key === serviceKey);
  if (!service) return null;

  return (
    <div className="app-config-header d-flex align-items-center gap-3 mb-3">
      {service.image ? (
        <img 
          src={`/images/${service.image}`} 
          alt={service.label} 
          className="app-config-icon" 
        />
      ) : (
        <span className="service-icon" style={{color: service.color}}>
          <i className={service.icon}></i>
        </span>
      )}
      
      <div className="flex-grow-1">
        <div className="fw-semibold d-flex align-items-center gap-2" style={{fontSize: '.9rem'}}>
          {service.label} Configuration
          {hasUnsavedChanges && <span className="dirty-badge">Unsaved</span>}
        </div>
        <div className="small text-muted" style={{fontSize: '.6rem'}}>
          {isEnabled ? 'Announcements enabled' : 'Announcements disabled'}
        </div>
      </div>
      
      <span className={`status-dot ${isEnabled ? 'on' : 'off'}`}></span>
    </div>
  );
}
