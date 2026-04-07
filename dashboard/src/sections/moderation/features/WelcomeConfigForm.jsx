import React, { useState } from 'react';
import { useI18n } from '../../../i18n';
import { ChannelSelector, RoleSelector, FormField, SwitchToggle } from '../components/SharedComponents';
import { sendAIChatMessage } from '../../../api';

// Welcome Messages Configuration
export default function WelcomeConfigForm({ config, updateConfig, channels, roles }) {
  const { t } = useI18n();
  const defaultWelcome = t('moderation.features.welcome.defaults.messageText') || 'Welcome to {server}, {user}!';
  const defaultDm = t('moderation.features.welcome.defaults.dmMessage') || 'Welcome to {server}! Thanks for joining us.';
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [generatingDm, setGeneratingDm] = useState(false);
  const [communityType, setCommunityType] = useState('general');

  const communityTypes = [
    { value: 'general', label: 'General Community', icon: 'fa-users' },
    { value: 'gaming', label: 'Gaming Community', icon: 'fa-gamepad' },
    { value: 'coding', label: 'Programming/Tech', icon: 'fa-code' },
    { value: 'design', label: 'Design/Creative', icon: 'fa-palette' },
    { value: 'music', label: 'Music/Audio', icon: 'fa-music' },
    { value: 'art', label: 'Art Community', icon: 'fa-paintbrush' },
    { value: 'education', label: 'Education/Learning', icon: 'fa-graduation-cap' },
    { value: 'business', label: 'Business/Professional', icon: 'fa-briefcase' },
    { value: 'anime', label: 'Anime/Manga', icon: 'fa-dragon' },
    { value: 'fitness', label: 'Fitness/Health', icon: 'fa-dumbbell' },
    { value: 'news', label: 'News/Discussion', icon: 'fa-newspaper' },
    { value: 'streaming', label: 'Content Creators', icon: 'fa-video' }
  ];

  const getCommunityPrompt = (type, isDm = false) => {
    const prompts = {
      general: isDm 
        ? 'Generate a friendly Discord DM welcome message for a general community server. Use {server} placeholder. Keep it warm and welcoming, 1-2 sentences.'
        : 'Generate a welcoming Discord message for a general community. Use {user} and {server} placeholders. Keep it friendly, 1-2 sentences.',
      gaming: isDm
        ? 'Generate an exciting Discord DM for a gaming community. Use {server} placeholder. Include gaming references, keep it energetic, 1-2 sentences.'
        : 'Generate a gaming-themed Discord welcome message. Use {user} and {server} placeholders. Make it exciting with gaming references, 1-2 sentences.',
      coding: isDm
        ? 'Generate a tech-savvy Discord DM for a programming community. Use {server} placeholder. Include coding references, keep it professional yet friendly, 1-2 sentences.'
        : 'Generate a developer-focused Discord welcome. Use {user} and {server} placeholders. Include programming references or humor, 1-2 sentences.',
      design: isDm
        ? 'Generate a creative Discord DM for a design community. Use {server} placeholder. Make it artistic and inspiring, 1-2 sentences.'
        : 'Generate a design-themed Discord welcome. Use {user} and {server} placeholders. Make it creative and inspiring, 1-2 sentences.',
      music: isDm
        ? 'Generate a melodic Discord DM for a music community. Use {server} placeholder. Include music references, keep it rhythmic, 1-2 sentences.'
        : 'Generate a music-themed Discord welcome. Use {user} and {server} placeholders. Include musical references, 1-2 sentences.',
      art: isDm
        ? 'Generate an artistic Discord DM for an art community. Use {server} placeholder. Make it creative and colorful, 1-2 sentences.'
        : 'Generate an art-focused Discord welcome. Use {user} and {server} placeholders. Make it creative and encouraging, 1-2 sentences.',
      education: isDm
        ? 'Generate an educational Discord DM for a learning community. Use {server} placeholder. Make it encouraging and supportive, 1-2 sentences.'
        : 'Generate an educational Discord welcome. Use {user} and {server} placeholders. Make it encouraging for learners, 1-2 sentences.',
      business: isDm
        ? 'Generate a professional Discord DM for a business community. Use {server} placeholder. Keep it professional yet warm, 1-2 sentences.'
        : 'Generate a professional Discord welcome. Use {user} and {server} placeholders. Keep it business-friendly, 1-2 sentences.',
      anime: isDm
        ? 'Generate an anime-themed Discord DM. Use {server} placeholder. Include anime culture references, keep it enthusiastic, 1-2 sentences.'
        : 'Generate an anime-themed Discord welcome. Use {user} and {server} placeholders. Include anime references, 1-2 sentences.',
      fitness: isDm
        ? 'Generate a motivational Discord DM for a fitness community. Use {server} placeholder. Make it energetic and encouraging, 1-2 sentences.'
        : 'Generate a fitness-themed Discord welcome. Use {user} and {server} placeholders. Make it motivational, 1-2 sentences.',
      news: isDm
        ? 'Generate a Discord DM for a news/discussion community. Use {server} placeholder. Keep it informative and welcoming, 1-2 sentences.'
        : 'Generate a discussion-focused Discord welcome. Use {user} and {server} placeholders. Encourage engagement, 1-2 sentences.',
      streaming: isDm
        ? 'Generate a Discord DM for content creators. Use {server} placeholder. Make it supportive and exciting, 1-2 sentences.'
        : 'Generate a streamer-focused Discord welcome. Use {user} and {server} placeholders. Make it energetic for creators, 1-2 sentences.'
    };
    return prompts[type] || prompts.general;
  };

  const extractMessageFromResponse = (text) => {
    // Remove markdown formatting
    let cleaned = text;
    
    // Remove markdown headings
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    
    // Extract from blockquote (> "text")
    const blockquoteMatch = cleaned.match(/>\s*["""]([^"""]+)["""]/);
    if (blockquoteMatch) return blockquoteMatch[1].trim();
    
    // Extract from quotes ("text" or "text")
    const quoteMatch = cleaned.match(/["""]([^"""]+)["""]/);
    if (quoteMatch) return quoteMatch[1].trim();
    
    // Extract from code block
    const codeMatch = cleaned.match(/```(?:[\w]*\n)?([\s\S]+?)```/);
    if (codeMatch) return codeMatch[1].trim();
    
    // Extract from inline code
    const inlineCodeMatch = cleaned.match(/`([^`]+)`/);
    if (inlineCodeMatch) return inlineCodeMatch[1].trim();
    
    // Remove common prefixes
    cleaned = cleaned.replace(/^(?:here'?s?|try this|use this|i suggest|suggested message|welcome message)[:.\s]*/gi, '');
    
    // Remove bullet points and list markers
    cleaned = cleaned.replace(/^[•\-*]\s*/gm, '');
    cleaned = cleaned.replace(/^\d+\.\s*/gm, '');
    
    // Get first meaningful sentence/paragraph
    const lines = cleaned.split('\n').filter(line => line.trim().length > 10);
    if (lines.length > 0) {
      // Find the line that contains placeholders
      const lineWithPlaceholder = lines.find(line => line.includes('{user}') || line.includes('{server}'));
      if (lineWithPlaceholder) return lineWithPlaceholder.trim();
      
      // Otherwise return first substantial line
      return lines[0].trim();
    }
    
    return cleaned.trim();
  };

  const generateWelcomeMessage = async () => {
    setGeneratingMessage(true);
    try {
      const prompt = `${getCommunityPrompt(communityType, false)} Return ONLY the message text without any explanation, markdown formatting, or additional text - just the pure message.`;
      const response = await sendAIChatMessage(prompt, []);
      if (response?.response) {
        const extracted = extractMessageFromResponse(response.response);
        updateConfig('messageText', extracted);
      }
    } catch (error) {
      console.error('Failed to generate welcome message:', error);
    } finally {
      setGeneratingMessage(false);
    }
  };

  const generateDmMessage = async () => {
    setGeneratingDm(true);
    try {
      const prompt = `${getCommunityPrompt(communityType, true)} Return ONLY the message text without any explanation, markdown formatting, or additional text - just the pure message.`;
      const response = await sendAIChatMessage(prompt, []);
      if (response?.response) {
        const extracted = extractMessageFromResponse(response.response);
        updateConfig('dmMessage', extracted);
      }
    } catch (error) {
      console.error('Failed to generate DM message:', error);
    } finally {
      setGeneratingDm(false);
    }
  };

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
        <div className="mb-3 d-flex gap-2 align-items-end">
          <div className="flex-grow-1" style={{ maxWidth: '280px' }}>
            <label className="form-label small text-muted mb-2">
              <i className="fa-solid fa-wand-magic-sparkles me-2" style={{ color: '#8b5cf6' }}></i>
              Community Type (for AI Generation)
            </label>
            <select 
              className="form-select form-select-sm custom-dropdown"
              value={communityType}
              onChange={(e) => setCommunityType(e.target.value)}
            >
              {communityTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="ai-generate-btn"
            onClick={generateWelcomeMessage}
            disabled={generatingMessage}
            title={`Generate ${communityTypes.find(t => t.value === communityType)?.label} welcome message`}
          >
            {generatingMessage ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span className="ms-2">AI</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span className="ms-2">AI</span>
              </>
            )}
          </button>
        </div>
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
          <div className="d-flex gap-2 align-items-start">
            <textarea 
              className="form-control form-control-sm custom-input flex-grow-1"
              rows={2}
              value={config.dmMessage ?? defaultDm}
              onChange={(e) => updateConfig('dmMessage', e.target.value)}
              placeholder={t('moderation.features.welcome.fields.dmMessage.placeholder')}
            />
            <button
              type="button"
              className="ai-generate-btn"
              onClick={generateDmMessage}
              disabled={generatingDm}
              title="Generate with AI"
            >
              {generatingDm ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span className="ms-2">AI</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span className="ms-2">AI</span>
                </>
              )}
            </button>
          </div>
        </FormField>
      )}
    </div>
  );
}
