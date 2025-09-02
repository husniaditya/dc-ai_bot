import React from 'react';

export default function FeatureCard({ 
  feature, 
  featureConfig, 
  onToggle, 
  onConfigure, 
  saving 
}) {
  const isEnabled = featureConfig?.enabled || false;
  const isSaving = saving[feature.key];

  return (
    <div className="col-md-6 col-lg-4">
      <div 
        className={`moderation-card card-glass h-100 p-3 position-relative d-flex flex-column ${isEnabled ? 'enabled' : ''}`}
        style={{ 
          '--feature-color': feature.color,
          '--grp-accent': feature.color
        }}
      >
        {/* Toggle Switch */}
        <div className="position-absolute top-0 end-0 p-2">
          <div className="form-check form-switch m-0">
            <input 
              className="form-check-input" 
              type="checkbox" 
              checked={isEnabled}
              onChange={(e) => onToggle(feature.key, e.target.checked)}
              disabled={isSaving}
              id={`toggle-${feature.key}`}
              style={{ cursor: isSaving ? 'not-allowed' : 'pointer' }}
            />
          </div>
        </div>

        <div className="d-flex align-items-start gap-3 mb-3" style={{ paddingRight: '2.5rem' }}>
          <div 
            className="feature-icon d-flex align-items-center justify-content-center"
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 12,
              backgroundColor: isEnabled ? feature.color + '20' : 'rgba(255,255,255,0.05)',
              border: `2px solid ${isEnabled ? feature.color : 'rgba(255,255,255,0.1)'}`,
              '--feature-color': feature.color,
              '--feature-color-bg': feature.color + '15'
            }}
          >
            <i 
              className={`fa-solid ${feature.icon}`}
              style={{ 
                fontSize: '1.2rem',
                color: isEnabled ? feature.color : 'rgba(255,255,255,0.5)'
              }}
            />
          </div>
          <div className="flex-grow-1">
            <h6 className="mb-1 fw-semibold">{feature.label}</h6>
            <div className={`status-badge moderation-status-badge ${isEnabled ? 'enabled' : 'disabled'}`}>
              {isSaving ? 'Updating...' : (isEnabled ? 'Enabled' : 'Disabled')}
            </div>
          </div>
        </div>
        
        {/* Feature Description */}
        <p className="text-muted small mb-3" style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
          {feature.desc}
        </p>
        
        <div className="mb-3">
          <div className="small text-muted mb-2 fw-semibold">Features:</div>
          <ul className="list-unstyled small mb-0" style={{ opacity: isEnabled ? 1 : 0.9 }}>
            {feature.features.map((feat, idx) => (
              <li key={idx} className="d-flex align-items-center gap-2 mb-1">
                <i className="fa-solid fa-circle-check" style={{ 
                  fontSize: '0.7rem', 
                  color: isEnabled ? '#10b981' : '#9ca3af'
                }} />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="mt-auto">
          <button 
            type="button"
            className="btn btn-outline-light btn-sm w-100 d-flex align-items-center justify-content-center gap-2 configure-btn"
            onClick={() => onConfigure(feature.key)}
            disabled={isSaving}
            style={{
              background: `linear-gradient(145deg, ${feature.color}15, ${feature.color}08)`,
              borderColor: `${feature.color}40`,
              color: feature.color,
              fontWeight: '600',
              letterSpacing: '0.3px',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              '--hover-bg': `linear-gradient(145deg, ${feature.color}25, ${feature.color}18)`,
              '--hover-border': `${feature.color}60`,
              '--hover-color': feature.color
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.target.style.background = `linear-gradient(145deg, ${feature.color}25, ${feature.color}18)`;
                e.target.style.borderColor = `${feature.color}60`;
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = `0 4px 12px ${feature.color}20`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving) {
                e.target.style.background = `linear-gradient(145deg, ${feature.color}15, ${feature.color}08)`;
                e.target.style.borderColor = `${feature.color}40`;
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }
            }}
          >
            {isSaving ? (
              <>
                <div className="spinner-border spinner-border-sm" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <span>Updating...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-cog" />
                <span>Configure</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
