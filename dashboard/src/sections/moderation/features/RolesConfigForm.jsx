import React, { useState } from 'react';
import { useI18n } from '../../../i18n';
import ReactionRolesConfig from './roles/ReactionRolesConfig';
import SlashCommandRolesConfig from './roles/SlashCommandRolesConfig';

// Role Management Configuration
export default function RolesConfigForm({ config, updateConfig, channels, roles, guildId, showToast }) {
  const [activeTab, setActiveTab] = useState('reaction');
  const { t } = useI18n();

  return (
    <div className="roles-config-form">
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">{t('moderation.features.roles.header')}</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-users-gear me-1"></i>
            {t('moderation.features.roles.badge')}
          </span>
        </div>
        
        <nav className="nav nav-pills nav-fill bg-dark rounded p-1 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <button
            className={`nav-link ${activeTab === 'reaction' ? 'active' : ''}`}
            onClick={() => setActiveTab('reaction')}
            style={{
              backgroundColor: activeTab === 'reaction' ? '#8b5cf6' : 'transparent',
              color: activeTab === 'reaction' ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              fontWeight: '500',
              fontSize: '0.875rem'
            }}
          >
            <i className="fa-solid fa-face-smile me-2"></i>
            {t('moderation.features.roles.tabs.reaction')}
          </button>
          <button
            className={`nav-link ${activeTab === 'slash' ? 'active' : ''}`}
            onClick={() => setActiveTab('slash')}
            style={{
              backgroundColor: activeTab === 'slash' ? '#8b5cf6' : 'transparent',
              color: activeTab === 'slash' ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              fontWeight: '500',
              fontSize: '0.875rem'
            }}
          >
            <i className="fa-solid fa-terminal me-2"></i>
            {t('moderation.features.roles.tabs.slash')}
          </button>
        </nav>
      </div>

      <div className="tab-content">
        {activeTab === 'reaction' && (
          <div className="tab-pane fade show active">
            <ReactionRolesConfig
              config={config}
              updateConfig={updateConfig}
              channels={channels}
              roles={roles}
              guildId={guildId}
              showToast={showToast}
            />
          </div>
        )}
        {activeTab === 'slash' && (
          <div className="tab-pane fade show active">
            <SlashCommandRolesConfig
              config={config}
              updateConfig={updateConfig}
              channels={channels}
              roles={roles}
              guildId={guildId}
              showToast={showToast}
            />
          </div>
        )}
      </div>
    </div>
  );
}
