import React, { useState } from 'react';
import { useI18n } from '../../../i18n';
import { ChannelSelector, RoleSelector, FormField, SwitchToggle } from '../components/SharedComponents';
import { generateWelcomeMessage } from '../../../api';

const COMMUNITY_TYPES = [
  { value: '', labelKey: 'welcome.communityType.select' },
  { value: 'gaming', labelKey: 'welcome.communityType.gaming' },
  { value: 'coding', labelKey: 'welcome.communityType.coding' },
  { value: 'art', labelKey: 'welcome.communityType.art' },
  { value: 'music', labelKey: 'welcome.communityType.music' },
  { value: 'anime', labelKey: 'welcome.communityType.anime' },
  { value: 'education', labelKey: 'welcome.communityType.education' },
  { value: 'social', labelKey: 'welcome.communityType.social' },
  { value: 'business', labelKey: 'welcome.communityType.business' },
  { value: 'sports', labelKey: 'welcome.communityType.sports' },
  { value: 'other', labelKey: 'welcome.communityType.other' }
];

// Welcome Messages Configuration
export default function WelcomeConfigForm({ config, updateConfig, channels, roles, guildId }) {
  const { t } = useI18n();
  const [communityType, setCommunityType] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const defaultWelcome = t('moderation.features.welcome.defaults.messageText') || 'Welcome to {server}, {user}!';
  const defaultDm = t('moderation.features.welcome.defaults.dmMessage') || 'Welcome to {server}! Thanks for joining us.';

  async function handleAiGenerate() {
    if (!communityType || aiGenerating) return;
    setAiGenerating(true);
    try {
      const res = await generateWelcomeMessage(communityType, '', guildId);
      if (res?.message) {
        updateConfig('messageText', res.message);
      }
    } catch (e) {
      console.error('AI generate failed:', e);
    } finally {
      setAiGenerating(false);
    }
  }

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
        label={t('welcome.communityType.label')}
        description={t('welcome.communityType.help')}
      >
        <div className="d-flex gap-2">
          <select 
            className="form-select form-select-sm custom-dropdown"
            value={communityType}
            onChange={(e) => setCommunityType(e.target.value)}
          >
            {COMMUNITY_TYPES.map(ct => (
              <option key={ct.value} value={ct.value}>{t(ct.labelKey)}</option>
            ))}
          </select>
          <button
            className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 flex-shrink-0"
            disabled={!communityType || aiGenerating}
            onClick={handleAiGenerate}
            title={t('welcome.aiGenerate.tooltip')}
          >
            {aiGenerating ? (
              <><span className="spinner-border spinner-border-sm" role="status"></span> {t('welcome.aiGenerate.generating')}</>
            ) : (
              <><i className="fas fa-wand-magic-sparkles"></i> {t('welcome.aiGenerate.button')}</>
            )}
          </button>
        </div>
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
