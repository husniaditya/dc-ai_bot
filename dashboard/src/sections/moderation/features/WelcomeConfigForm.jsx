import React from 'react';
import { useI18n } from '../../../i18n';
import { ChannelSelector, RoleSelector, FormField, SwitchToggle } from '../components/SharedComponents';

// Welcome Messages Configuration
export default function WelcomeConfigForm({ config, updateConfig, channels, roles }) {
  const { t } = useI18n();
  const defaultWelcome = t('moderation.features.welcome.defaults.messageText') || 'Welcome to {server}, {user}!';
  const defaultDm = t('moderation.features.welcome.defaults.dmMessage') || 'Welcome to {server}! Thanks for joining us.';
  return (
    <div className="moderation-config-form space-y-4">
      {/* Information Section */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">{t('moderation.features.welcome.header')}</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-hand-wave me-1"></i>
            {t('moderation.features.welcome.badge')}
          </span>
        </div>
        <p className="text-muted small mb-0" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
          {t('moderation.features.welcome.info')}
        </p>
      </div>
      <hr />

      <FormField 
        label={t('moderation.features.welcome.fields.channel.label')}
        description={t('moderation.features.welcome.fields.channel.desc')}
      >
        <ChannelSelector
          value={config.channelId}
          onChange={(value) => updateConfig('channelId', value)}
          channels={channels}
          placeholder={t('moderation.features.welcome.fields.channel.placeholder')}
        />
      </FormField>

      <FormField label={t('moderation.features.welcome.fields.type.label')}>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.messageType || 'text'}
          onChange={(e) => updateConfig('messageType', e.target.value)}
        >
          <option value="text">{t('moderation.features.welcome.fields.type.options.text')}</option>
          <option value="embed">{t('moderation.features.welcome.fields.type.options.embed')}</option>
        </select>
      </FormField>

      <FormField 
        label={t('moderation.features.welcome.fields.message.label')}
        description={t('moderation.features.welcome.fields.message.desc')}
      >
        <textarea 
          className="form-control form-control-sm custom-input"
          rows={5}
          value={config.messageText ?? defaultWelcome}
          onChange={(e) => updateConfig('messageText', e.target.value)}
          placeholder={t('moderation.features.welcome.fields.message.placeholder')}
        />
      </FormField>

      <SwitchToggle
        id="welcome-card-enabled"
        label={t('moderation.features.welcome.fields.card.label')}
        checked={config.cardEnabled}
        onChange={(checked) => updateConfig('cardEnabled', checked)}
        description={t('moderation.features.welcome.fields.card.desc')}
      />

      <FormField 
        label={t('moderation.features.welcome.fields.role.label')}
        description={t('moderation.features.welcome.fields.role.desc')}
      >
        <RoleSelector
          value={config.roleId}
          onChange={(value) => updateConfig('roleId', value)}
          roles={roles}
          placeholder={t('moderation.features.welcome.fields.role.placeholder')}
        />
      </FormField>

      <SwitchToggle
        id="welcome-dm-enabled"
        label={t('moderation.features.welcome.fields.dm.label')}
        checked={config.dmEnabled}
        onChange={(checked) => updateConfig('dmEnabled', checked)}
        description={t('moderation.features.welcome.fields.dm.desc')}
      />

      {config.dmEnabled && (
        <FormField 
          label={t('moderation.features.welcome.fields.dmMessage.label')}
          description={t('moderation.features.welcome.fields.dmMessage.desc')}
        >
          <textarea 
            className="form-control form-control-sm custom-input"
            rows={2}
            value={config.dmMessage ?? defaultDm}
            onChange={(e) => updateConfig('dmMessage', e.target.value)}
            placeholder={t('moderation.features.welcome.fields.dmMessage.placeholder')}
          />
        </FormField>
      )}
    </div>
  );
}
