import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../../i18n';
import { ChannelSelector, FormField, SwitchToggle, RoleSelector } from '../components/SharedComponents';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { getProfanityWords, addProfanityWord, updateProfanityWord, deleteProfanityWord, 
         getProfanityPatterns, addProfanityPattern, updateProfanityPattern, deleteProfanityPattern } from '../../../api';

// Custom Channel Picker Component
function ChannelPicker({ value, onChange, channels }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const list = value || [];
  
  useEffect(() => {
    function onDoc(e) { 
      if (!boxRef.current) return; 
      if (!boxRef.current.contains(e.target)) setOpen(false); 
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  
  const baseOptions = channels.filter(ch => ch.type === 0).map(ch => ({ 
    id: ch.id, 
    label: `#${ch.name}`, 
    type: 'channel' 
  }));
  
  const filtered = baseOptions
    .filter(o => !query || o.label.toLowerCase().includes(query.toLowerCase()))
    .filter(o => !list.includes(o.id));
  
  const [activeIdx, setActiveIdx] = useState(0);
  
  useEffect(() => { 
    setActiveIdx(0); 
  }, [query, open]);
  
  function add(id) { 
    if (!list.includes(id)) onChange([...list, id]); 
    setQuery(''); 
    setOpen(false); 
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0); 
  }
  
  function remove(id) { 
    onChange(list.filter(x => x !== id)); 
  }
  
  function handleKey(e) {
    if (e.key === 'Backspace' && !query) { 
      onChange(list.slice(0, -1)); 
    } else if (e.key === 'Enter') { 
      e.preventDefault(); 
      if (open && filtered[activeIdx]) add(filtered[activeIdx].id); 
    } else if (e.key === 'ArrowDown') { 
      e.preventDefault(); 
      setOpen(true); 
      setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); 
    } else if (e.key === 'ArrowUp') { 
      e.preventDefault(); 
      setActiveIdx(i => Math.max(0, i - 1)); 
    }
  }
  
  return (
    <div className="mention-targets-picker" ref={boxRef}>
      <div 
        className="mention-targets-box" 
        onClick={() => { 
          setOpen(true); 
          inputRef.current && inputRef.current.focus(); 
        }}
      >
        {list.map(id => {
          const channel = channels.find(ch => ch.id === id);
          const label = channel ? `#${channel.name}` : `#${id}`;
          return (
            <span key={id} className="mention-chip">
              {label}
              <button 
                type="button" 
                onClick={e => { 
                  e.stopPropagation(); 
                  remove(id); 
                }}
              >
                &times;
              </button>
            </span>
          );
        })}
        <input 
          ref={inputRef} 
          value={query} 
          placeholder={list.length ? '' : t('moderation.features.automod.placeholders.addChannels')}
          onFocus={() => setOpen(true)} 
          onChange={e => { 
            setQuery(e.target.value); 
            setOpen(true); 
          }} 
          onKeyDown={handleKey} 
        />
      </div>
      
      {open && filtered.length > 0 && (
        <div className="mention-targets-suggestions">
          {filtered.slice(0, 40).map((o, idx) => (
            <button 
              type="button" 
              key={o.id} 
              className={idx === activeIdx ? 'active' : ''} 
              onMouseEnter={() => setActiveIdx(idx)} 
              onClick={() => add(o.id)}
            >
              {o.label}
              <span className="meta">{t('moderation.features.automod.meta.channel')}</span>
            </button>
          ))}
        </div>
      )}
      
      {open && filtered.length === 0 && (
        <div className="mention-targets-suggestions">
          <div className="text-muted small p-2" style={{fontSize: '.55rem'}}>
            {t('common.noMatches')}
          </div>
        </div>
      )}
    </div>
  );
}

// Custom Role Picker Component
function RolePicker({ value, onChange, roles }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const list = value || [];
  
  useEffect(() => {
    function onDoc(e) { 
      if (!boxRef.current) return; 
      if (!boxRef.current.contains(e.target)) setOpen(false); 
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  
  const baseOptions = roles
    .filter(role => !role.managed && role.name !== '@everyone')
    .map(role => ({ 
      id: role.id, 
      label: `@${role.name}`, 
      type: 'role',
      color: role.color 
    }));
  
  const filtered = baseOptions
    .filter(o => !query || o.label.toLowerCase().includes(query.toLowerCase()))
    .filter(o => !list.includes(o.id));
  
  const [activeIdx, setActiveIdx] = useState(0);
  
  useEffect(() => { 
    setActiveIdx(0); 
  }, [query, open]);
  
  function add(id) { 
    if (!list.includes(id)) onChange([...list, id]); 
    setQuery(''); 
    setOpen(false); 
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0); 
  }
  
  function remove(id) { 
    onChange(list.filter(x => x !== id)); 
  }
  
  function handleKey(e) {
    if (e.key === 'Backspace' && !query) { 
      onChange(list.slice(0, -1)); 
    } else if (e.key === 'Enter') { 
      e.preventDefault(); 
      if (open && filtered[activeIdx]) add(filtered[activeIdx].id); 
    } else if (e.key === 'ArrowDown') { 
      e.preventDefault(); 
      setOpen(true); 
      setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); 
    } else if (e.key === 'ArrowUp') { 
      e.preventDefault(); 
      setActiveIdx(i => Math.max(0, i - 1)); 
    }
  }
  
  return (
    <div className="mention-targets-picker" ref={boxRef}>
      <div 
        className="mention-targets-box" 
        onClick={() => { 
          setOpen(true); 
          inputRef.current && inputRef.current.focus(); 
        }}
      >
        {list.map(id => {
          const role = roles.find(r => r.id === id);
          const label = role ? `@${role.name}` : `@${id}`;
          return (
            <span key={id} className="mention-chip role">
              {label}
              <button 
                type="button" 
                onClick={e => { 
                  e.stopPropagation(); 
                  remove(id); 
                }}
              >
                &times;
              </button>
            </span>
          );
        })}
        <input 
          ref={inputRef} 
          value={query} 
          placeholder={list.length ? '' : t('moderation.features.automod.placeholders.addRoles')}
          onFocus={() => setOpen(true)} 
          onChange={e => { 
            setQuery(e.target.value); 
            setOpen(true); 
          }} 
          onKeyDown={handleKey} 
        />
      </div>
      
      {open && filtered.length > 0 && (
        <div className="mention-targets-suggestions">
          {filtered.slice(0, 40).map((o, idx) => (
            <button 
              type="button" 
              key={o.id} 
              className={idx === activeIdx ? 'active' : ''} 
              onMouseEnter={() => setActiveIdx(idx)} 
              onClick={() => add(o.id)}
              style={o.color ? { color: `#${o.color.toString(16).padStart(6, '0')}` } : {}}
            >
              {o.label}
              <span className="meta">{t('moderation.features.automod.meta.role')}</span>
            </button>
          ))}
        </div>
      )}
      
      {open && filtered.length === 0 && (
        <div className="mention-targets-suggestions">
          <div className="text-muted small p-2" style={{fontSize: '.55rem'}}>
            {t('common.noMatches')}
          </div>
        </div>
      )}
    </div>
  );
}

// Auto Moderation Configuration
export default function AutomodConfigForm({ config, updateConfig, channels, roles, guildId, showToast }) {
  const { t } = useI18n();
  const [automodRules, setAutomodRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Profanity management state
  const [profanityWords, setProfanityWords] = useState([]);
  const [profanityPatterns, setProfanityPatterns] = useState([]);
  const [loadingProfanity, setLoadingProfanity] = useState(false);
  
  // Profanity delete confirmation state
  const [showDeleteWordModal, setShowDeleteWordModal] = useState(false);
  const [showDeletePatternModal, setShowDeletePatternModal] = useState(false);
  const [wordToDelete, setWordToDelete] = useState(null);
  const [patternToDelete, setPatternToDelete] = useState(null);
  const [deletingWord, setDeletingWord] = useState(false);
  const [deletingPattern, setDeletingPattern] = useState(false);
  const [showProfanityWordForm, setShowProfanityWordForm] = useState(false);
  const [showProfanityPatternForm, setShowProfanityPatternForm] = useState(false);
  const [editingWord, setEditingWord] = useState(null);
  const [editingPattern, setEditingPattern] = useState(null);
  const [wordSearchFilter, setWordSearchFilter] = useState('');
  const [patternSearchFilter, setPatternSearchFilter] = useState('');
  const [wordForm, setWordForm] = useState({
    word: '',
    severity: 'medium',
    language: 'en',
    caseSensitive: false,
    wholeWordOnly: true,
    enabled: true
  });
  const [patternForm, setPatternForm] = useState({
    pattern: '',
    description: '',
    severity: 'medium',
    flags: 'gi',
    enabled: true
  });
  
  const [ruleForm, setRuleForm] = useState({
    name: '',
    triggerType: 'spam',
    actionType: 'warn',
    thresholdValue: 5,
    duration: null,
    enabled: true,
    whitelistChannels: [],
    whitelistRoles: [],
    logChannelId: '',
    messageAction: 'keep'
  });

  // Load existing auto mod rules
  useEffect(() => {
    if (guildId) {
      loadAutomodRules();
      loadProfanityData();
    }
  }, [guildId]);

  const loadAutomodRules = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/moderation/automod/rules', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Guild-Id': guildId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAutomodRules(data.rules || []);
      } else {
        setAutomodRules([]);
      }
    } catch (error) {
      console.error('Failed to load automod rules:', error);
      setAutomodRules([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProfanityData = async () => {
    setLoadingProfanity(true);
    try {
      const [wordsData, patternsData] = await Promise.all([
        getProfanityWords(guildId),
        getProfanityPatterns(guildId)
      ]);
      
      setProfanityWords(wordsData.words || []);
      setProfanityPatterns(patternsData.patterns || []);
    } catch (error) {
      console.error('Failed to load profanity data:', error);
      setProfanityWords([]);
      setProfanityPatterns([]);
    } finally {
      setLoadingProfanity(false);
    }
  };

  const triggerTypes = [
    { value: 'spam', label: t('moderation.features.automod.triggers.spam.label'), description: t('moderation.features.automod.triggers.spam.description') },
    { value: 'caps', label: t('moderation.features.automod.triggers.caps.label'), description: t('moderation.features.automod.triggers.caps.description') },
    { value: 'links', label: t('moderation.features.automod.triggers.links.label'), description: t('moderation.features.automod.triggers.links.description') },
    { value: 'invite_links', label: t('moderation.features.automod.triggers.invite_links.label'), description: t('moderation.features.automod.triggers.invite_links.description') },
    { value: 'profanity', label: t('moderation.features.automod.triggers.profanity.label'), description: t('moderation.features.automod.triggers.profanity.description') },
    { value: 'mention_spam', label: t('moderation.features.automod.triggers.mention_spam.label'), description: t('moderation.features.automod.triggers.mention_spam.description') }
  ];

  const actionTypes = [
    { value: 'warn', label: t('moderation.features.automod.actions.warn.label'), description: t('moderation.features.automod.actions.warn.description') },
    { value: 'delete', label: t('moderation.features.automod.actions.delete.label'), description: t('moderation.features.automod.actions.delete.description') },
    { value: 'mute', label: t('moderation.features.automod.actions.mute.label'), description: t('moderation.features.automod.actions.mute.description') },
    { value: 'kick', label: t('moderation.features.automod.actions.kick.label'), description: t('moderation.features.automod.actions.kick.description') },
    { value: 'ban', label: t('moderation.features.automod.actions.ban.label'), description: t('moderation.features.automod.actions.ban.description') }
  ];

  // Scroll helper function
  const scrollToElement = (elementId) => {
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start', 
          inline: 'nearest' 
        });
      }
    }, 100); // Small delay to ensure element is rendered
  };

  // Focus + scroll helper for modals (ensures the overlay gets focus and first input is focused)
  const focusModal = (modalId) => {
    // Use two animation frames to ensure paint after state update
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Always scroll page to very top first so modal starts at top of viewport
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
        const modal = document.getElementById(modalId);
        if (modal) {
          // Align modal toward top rather than centered
            try { modal.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
            if (typeof modal.focus === 'function') {
              modal.focus({ preventScroll: true });
            }
            const firstInput = modal.querySelector('input[type="text"], input:not([type]), textarea, select');
            if (firstInput && typeof firstInput.focus === 'function') {
              setTimeout(() => firstInput.focus({ preventScroll: true }), 10);
            }
        }
      });
    });
  };

  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      triggerType: 'spam',
      actionType: 'warn',
      thresholdValue: 5,
      duration: null,
      enabled: true,
      whitelistChannels: [],
      whitelistRoles: [],
      logChannelId: '',
      messageAction: 'keep'
    });
    setEditingRule(null);
  };

  const openRuleForm = (rule = null) => {
    if (rule) {
      setRuleForm({
        ...rule,
        whitelistChannels: rule.whitelistChannels ? (typeof rule.whitelistChannels === 'string' ? JSON.parse(rule.whitelistChannels) : rule.whitelistChannels) : [],
        whitelistRoles: rule.whitelistRoles ? (typeof rule.whitelistRoles === 'string' ? JSON.parse(rule.whitelistRoles) : rule.whitelistRoles) : []
      });
      setEditingRule(rule);
    } else {
      resetRuleForm();
    }
    setShowRuleForm(true);
    scrollToElement('automod-rule-form');
  };

  const closeRuleForm = () => {
    setShowRuleForm(false);
    resetRuleForm();
  };

  const updateRuleForm = (field, value) => {
    setRuleForm(prev => ({ ...prev, [field]: value }));
  };

  // Profanity Words Management
  const openWordForm = (word = null) => {
    if (word) {
      setWordForm({
        word: word.word,
        severity: word.severity,
        language: word.language,
        caseSensitive: word.caseSensitive,
        wholeWordOnly: word.wholeWordOnly,
        enabled: word.enabled
      });
      setEditingWord(word);
    } else {
      setWordForm({
        word: '',
        severity: 'medium',
        language: 'en',
        caseSensitive: false,
        wholeWordOnly: true,
        enabled: true
      });
      setEditingWord(null);
    }
    setShowProfanityWordForm(true);
  // focusModal('profanity-words-modal');
  };

  const closeWordForm = () => {
    setShowProfanityWordForm(false);
    setEditingWord(null);
  };

  const saveWord = async () => {
    try {
      if (editingWord) {
        await updateProfanityWord(editingWord.id, wordForm, guildId);
        showToast?.('success', t('moderation.features.automod.toasts.wordUpdated', { word: wordForm.word }));
      } else {
        await addProfanityWord(wordForm, guildId);
        showToast?.('success', t('moderation.features.automod.toasts.wordAdded', { word: wordForm.word }));
      }
      
      await loadProfanityData();
      closeWordForm();
    } catch (error) {
      console.error('Failed to save profanity word:', error);
      showToast?.('error', t('moderation.features.automod.toasts.wordSaveFailed', { error: error.message || t('errors.general') }));
    }
  };

  // Delete confirmation handlers for words
  const requestDeleteWord = (wordId, word) => {
    setWordToDelete({ id: wordId, word });
    setShowDeleteWordModal(true);
  };

  const cancelDeleteWord = () => {
    setShowDeleteWordModal(false);
    setWordToDelete(null);
  };

  const confirmDeleteWord = async () => {
    if (!wordToDelete) return;
    
    setDeletingWord(true);
    try {
      await deleteProfanityWord(wordToDelete.id, guildId);
      await loadProfanityData();
  showToast?.('success', t('moderation.features.automod.toasts.wordDeleted', { word: wordToDelete.word }));
      setShowDeleteWordModal(false);
      setWordToDelete(null);
    } catch (error) {
      console.error('Failed to delete profanity word:', error);
  showToast?.('error', t('moderation.features.automod.toasts.wordDeleteFailed', { error: error.message || t('errors.general') }));
    } finally {
      setDeletingWord(false);
    }
  };

  const deleteWord = async (wordId, word) => {
    try {
      await deleteProfanityWord(wordId, guildId);
      await loadProfanityData();
  showToast?.('success', t('moderation.features.automod.toasts.wordDeleted', { word }));
    } catch (error) {
      console.error('Failed to delete profanity word:', error);
  showToast?.('error', t('moderation.features.automod.toasts.wordDeleteFailed', { error: error.message || t('errors.general') }));
    }
  };

  const toggleWordStatus = async (wordObject) => {
    try {
      const updatedWord = {
        ...wordObject,
        enabled: !wordObject.enabled
      };
      await updateProfanityWord(wordObject.id, updatedWord, guildId);
      
      // Update local state instead of reloading all data
      setProfanityWords(prev => 
        prev.map(word => 
          word.id === wordObject.id ? updatedWord : word
        )
      );
      
      showToast?.('success', updatedWord.enabled
        ? t('moderation.features.automod.toasts.wordToggleEnabled')
        : t('moderation.features.automod.toasts.wordToggleDisabled')
      );
    } catch (error) {
      console.error('Failed to toggle profanity word status:', error);
      showToast?.('error', t('moderation.features.automod.toasts.wordToggleFailed', { error: error.message || t('errors.general') }));
    }
  };

  // Profanity Patterns Management
  const openPatternForm = (pattern = null) => {
    if (pattern) {
      setPatternForm({
        pattern: pattern.pattern,
        description: pattern.description,
        severity: pattern.severity,
        flags: pattern.flags,
        enabled: pattern.enabled
      });
      setEditingPattern(pattern);
    } else {
      setPatternForm({
        pattern: '',
        description: '',
        severity: 'medium',
        flags: 'gi',
        enabled: true
      });
      setEditingPattern(null);
    }
    setShowProfanityPatternForm(true);
  // focusModal('profanity-patterns-modal');
  };

  const closePatternForm = () => {
    setShowProfanityPatternForm(false);
    setEditingPattern(null);
  };

  const savePattern = async () => {
    try {
      // Validate regex pattern
      try {
        new RegExp(patternForm.pattern, patternForm.flags);
      } catch (regexError) {
        showToast?.('error', t('moderation.features.automod.toasts.invalidRegex', { error: regexError.message }));
        return;
      }

      if (editingPattern) {
        await updateProfanityPattern(editingPattern.id, patternForm, guildId);
        showToast?.('success', t('moderation.features.automod.toasts.patternUpdated'));
      } else {
        await addProfanityPattern(patternForm, guildId);
        showToast?.('success', t('moderation.features.automod.toasts.patternAdded'));
      }
      
      await loadProfanityData();
      closePatternForm();
    } catch (error) {
      console.error('Failed to save profanity pattern:', error);
      showToast?.('error', t('moderation.features.automod.toasts.patternSaveFailed', { error: error.message || t('errors.general') }));
    }
  };

  // Delete confirmation handlers for patterns
  const requestDeletePattern = (patternId, description) => {
    setPatternToDelete({ id: patternId, description });
    setShowDeletePatternModal(true);
  };

  const cancelDeletePattern = () => {
    setShowDeletePatternModal(false);
    setPatternToDelete(null);
  };

  const confirmDeletePattern = async () => {
    if (!patternToDelete) return;
    
    setDeletingPattern(true);
    try {
      await deleteProfanityPattern(patternToDelete.id, guildId);
      await loadProfanityData();
  showToast?.('success', t('moderation.features.automod.toasts.patternDeleted', { description: patternToDelete.description ? `"${patternToDelete.description}"` : '' }));
      setShowDeletePatternModal(false);
      setPatternToDelete(null);
    } catch (error) {
      console.error('Failed to delete profanity pattern:', error);
  showToast?.('error', t('moderation.features.automod.toasts.patternDeleteFailed', { error: error.message || t('errors.general') }));
    } finally {
      setDeletingPattern(false);
    }
  };

  const deletePattern = async (patternId, description) => {
    try {
      await deleteProfanityPattern(patternId, guildId);
      await loadProfanityData();
  showToast?.('success', t('moderation.features.automod.toasts.patternDeleted', { description: description ? `"${description}"` : '' }));
    } catch (error) {
      console.error('Failed to delete profanity pattern:', error);
  showToast?.('error', t('moderation.features.automod.toasts.patternDeleteFailed', { error: error.message || t('errors.general') }));
    }
  };

  const togglePatternStatus = async (patternObject) => {
    try {
      const updatedPattern = {
        ...patternObject,
        enabled: !patternObject.enabled
      };
      await updateProfanityPattern(patternObject.id, updatedPattern, guildId);
      
      // Update local state instead of reloading all data
      setProfanityPatterns(prev => 
        prev.map(pattern => 
          pattern.id === patternObject.id ? updatedPattern : pattern
        )
      );
      
      showToast?.('success', updatedPattern.enabled
        ? t('moderation.features.automod.toasts.patternToggleEnabled')
        : t('moderation.features.automod.toasts.patternToggleDisabled')
      );
    } catch (error) {
      console.error('Failed to toggle profanity pattern status:', error);
      showToast?.('error', t('moderation.features.automod.toasts.patternToggleFailed', { error: error.message || t('errors.general') }));
    }
  };

  const saveRule = async () => {
    setSaving(true);
    try {
      const ruleData = {
        ...ruleForm,
        whitelistChannels: JSON.stringify(ruleForm.whitelistChannels || []),
        whitelistRoles: JSON.stringify(ruleForm.whitelistRoles || []),
        logChannelId: ruleForm.logChannelId || config.logChannelId || null // Use global log channel if no specific channel selected
      };

      const url = editingRule 
        ? `/api/moderation/automod/rules/${editingRule.id}`
        : '/api/moderation/automod/rules';

      const response = await fetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Guild-Id': guildId
        },
        body: JSON.stringify(ruleData)
      });

      if (response.ok) {
        await loadAutomodRules();
        closeRuleForm();
        
        // Show success toast
        if (showToast) {
          showToast('success', editingRule 
            ? t('moderation.features.automod.toasts.ruleUpdated', { name: ruleForm.name })
            : t('moderation.features.automod.toasts.ruleCreated', { name: ruleForm.name })
          );
        }
      } else {
        throw new Error('Failed to save rule');
      }
    } catch (error) {
      console.error('Failed to save automod rule:', error);
      
      // Show error toast
      if (showToast) {
        showToast('error', editingRule 
          ? t('moderation.features.automod.toasts.ruleUpdateFailed', { name: ruleForm.name })
          : t('moderation.features.automod.toasts.ruleCreateFailed', { name: ruleForm.name })
        );
      }
    }
    setSaving(false);
  };

  const deleteRule = async (ruleId) => {
    // Find the rule to show in the confirmation modal
    const rule = automodRules.find(r => r.id === ruleId);
    setRuleToDelete(rule);
    setShowDeleteModal(true);
  };

  const confirmDeleteRule = async () => {
    if (!ruleToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/moderation/automod/rules/${ruleToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Guild-Id': guildId
        }
      });

      if (response.ok) {
        await loadAutomodRules();
        setShowDeleteModal(false);
        setRuleToDelete(null);
        
        // Show success toast
        if (showToast) {
          showToast('success', t('moderation.features.automod.toasts.ruleDeleted', { name: ruleToDelete.name }));
        }
      } else {
        throw new Error('Failed to delete rule');
      }
    } catch (error) {
      console.error('Failed to delete automod rule:', error);
      
      // Show error toast
      if (showToast) {
        showToast('error', t('moderation.features.automod.toasts.ruleDeleteFailed', { name: ruleToDelete.name }));
      }
    }
    setDeleting(false);
  };

  const cancelDeleteRule = () => {
    setShowDeleteModal(false);
    setRuleToDelete(null);
  };

  const toggleRule = async (ruleId, enabled) => {
    // Find the rule to get its name for the toast
    const rule = automodRules.find(r => r.id === ruleId);
    const ruleName = rule?.name || 'Unknown rule';
    
    try {
      const response = await fetch(`/api/moderation/automod/rules/${ruleId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Guild-Id': guildId
        },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        // Update local state instead of refetching all data
        setAutomodRules(prev => prev.map(rule => 
          rule.id === ruleId 
            ? { ...rule, enabled: enabled }
            : rule
        ));
        
        // Show success toast
        if (showToast) {
          showToast('success', enabled
            ? t('moderation.features.automod.toasts.ruleEnabled', { name: ruleName })
            : t('moderation.features.automod.toasts.ruleDisabled', { name: ruleName })
          );
        }
      } else {
        throw new Error('Failed to toggle rule');
      }
    } catch (error) {
      console.error('Failed to toggle automod rule:', error);
      
      // Show error toast
      if (showToast) {
        showToast('error', t('moderation.features.automod.toasts.ruleToggleFailed', { name: ruleName, action: enabled ? 'enable' : 'disable' }));
      }
    }
  };

  return (
    <div className="moderation-config-form space-y-4">
      {/* Information Section */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">{t('moderation.features.automod.header')}</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-shield-halved me-1"></i>
            {t('moderation.features.automod.badge')}
          </span>
        </div>
        <p className="text-muted small mb-0" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
          {t('moderation.features.automod.info.pre')}
          {' '}
          <a href="https://www.virustotal.com" target="_blank" rel="noreferrer" className="text-decoration-underline">VirusTotal</a>,
          {' '}
          <a href="https://safebrowsing.googleapis.com" target="_blank" rel="noreferrer" className="text-decoration-underline">Google Safe Browsing</a>.
        </p>
      </div>
      <hr />

      {/* Quick Settings */}
      <div className="row mb-4">
        <div className="col-md-12">
          <FormField 
            label={t('moderation.features.automod.globalLog.label')}
            description={t('moderation.features.automod.globalLog.desc')}
          >
            <ChannelSelector
              value={config.logChannelId || ''}
              onChange={(value) => updateConfig('logChannelId', value || null)}
              channels={channels}
              placeholder={t('moderation.features.automod.globalLog.placeholder')}
            />
          </FormField>
        </div>
      </div>

      {/* Auto Moderation Rules */}
      <div className="mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h6 className="mb-1 fw-bold">{t('moderation.features.automod.rules.header')}</h6>
            <p className="text-muted small mb-0">{t('moderation.features.automod.rules.subheader')}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => openRuleForm()}
          >
            <i className="fa-solid fa-plus me-2"></i>
            {t('moderation.features.automod.rules.add')}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">{t('common.loading')}</span>
            </div>
            {t('moderation.features.automod.rules.loading')}
          </div>
        ) : automodRules.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-muted">
              <i className="fa-solid fa-robot fs-1 mb-3 opacity-50"></i>
              <p className="mb-0">{t('moderation.features.automod.rules.empty')}</p>
              <small>{t('moderation.features.automod.rules.emptyCta')}</small>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{t('moderation.features.automod.table.status')}</th>
                  <th>{t('moderation.features.automod.table.name')}</th>
                  <th>{t('moderation.features.automod.table.trigger')}</th>
                  <th>{t('moderation.features.automod.table.action')}</th>
                  <th>{t('moderation.features.automod.table.threshold')}</th>
                  <th>{t('moderation.features.automod.table.channelWhitelist')}</th>
                  <th>{t('moderation.features.automod.table.roleWhitelist')}</th>
                  <th>{t('moderation.features.automod.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {automodRules.map(rule => (
                  <tr key={rule.id}>
                    <td>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={Boolean(rule.enabled)}
                          onChange={(e) => toggleRule(rule.id, e.target.checked)}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold text-primary" style={{ fontSize: '0.85rem' }}>
                        {rule.name}
                      </div>
            {rule.logChannelId && (
                        <div className="small text-muted">
              <i className="fa-solid fa-list me-1"></i>
              {t('moderation.features.automod.table.logsTo', { channel: `#${channels.find(c => c.id === rule.logChannelId)?.name || t('common.unknown')}` })}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge bg-info">
                        {triggerTypes.find(t => t.value === rule.triggerType)?.label || rule.triggerType}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        rule.actionType === 'ban' ? 'bg-danger' :
                        rule.actionType === 'kick' ? 'bg-warning' :
                        rule.actionType === 'mute' ? 'bg-secondary' :
                        'bg-primary'
                      }`}>
                        {actionTypes.find(a => a.value === rule.actionType)?.label || rule.actionType}
                      </span>
            {rule.duration && (
                        <div className="small text-muted">
              {t('moderation.features.automod.table.minutes', { count: rule.duration })}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="text-warning fw-semibold">{rule.thresholdValue || t('common.na')}</span>
                    </td>
                    <td>
                      {rule.whitelistChannels && typeof rule.whitelistChannels === 'string' && rule.whitelistChannels !== '[]' && rule.whitelistChannels !== '' ? (
                        <div className="d-flex flex-wrap gap-1">
                          {(() => {
                            try {
                              const channelIds = JSON.parse(rule.whitelistChannels);
                              if (Array.isArray(channelIds) && channelIds.length > 0) {
                                return channelIds.map(channelId => {
                                  const channel = channels.find(c => c.id === channelId);
                                  return (
                                    <span key={channelId} className="badge bg-secondary bg-opacity-75 text-light small">
                                      <i className="fa-solid fa-hashtag me-1"></i>
                                      {channel?.name || `Unknown (${channelId})`}
                                    </span>
                                  );
                                });
                              }
                              return <span className="text-muted small">{t('common.none')}</span>;
                            } catch (e) {
                              return <span className="text-danger small">{t('common.invalidData')}</span>;
                            }
                          })()}
                        </div>
                      ) : rule.whitelistChannels && Array.isArray(rule.whitelistChannels) && rule.whitelistChannels.length > 0 ? (
                        <div className="d-flex flex-wrap gap-1">
                          {rule.whitelistChannels.map(channelId => {
                            const channel = channels.find(c => c.id === channelId);
                            return (
                              <span key={channelId} className="badge bg-secondary bg-opacity-75 text-light small">
                                <i className="fa-solid fa-hashtag me-1"></i>
                                {channel?.name || `Unknown (${channelId})`}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-muted small">{t('common.none')}</span>
                      )}
                    </td>
                    <td>
                      {rule.whitelistRoles && typeof rule.whitelistRoles === 'string' && rule.whitelistRoles !== '[]' && rule.whitelistRoles !== '' ? (
                        <div className="d-flex flex-wrap gap-1">
                          {(() => {
                            try {
                              const roleIds = JSON.parse(rule.whitelistRoles);
                              if (Array.isArray(roleIds) && roleIds.length > 0) {
                                return roleIds.map(roleId => {
                                  const role = roles.find(r => r.id === roleId);
                                  return (
                                    <span 
                                      key={roleId} 
                                      className="badge bg-primary bg-opacity-75 text-light small"
                                      style={role?.color ? { backgroundColor: `#${role.color.toString(16).padStart(6, '0')}` } : {}}
                                    >
                                      <i className="fa-solid fa-users me-1"></i>
                                      {role?.name || `Unknown (${roleId})`}
                                    </span>
                                  );
                                });
                              }
                              return <span className="text-muted small">{t('common.none')}</span>;
                            } catch (e) {
                              return <span className="text-danger small">{t('common.invalidData')}</span>;
                            }
                          })()}
                        </div>
                      ) : rule.whitelistRoles && Array.isArray(rule.whitelistRoles) && rule.whitelistRoles.length > 0 ? (
                        <div className="d-flex flex-wrap gap-1">
                          {rule.whitelistRoles.map(roleId => {
                            const role = roles.find(r => r.id === roleId);
                            return (
                              <span 
                                key={roleId} 
                                className="badge bg-primary bg-opacity-75 text-light small"
                                style={role?.color ? { backgroundColor: `#${role.color.toString(16).padStart(6, '0')}` } : {}}
                              >
                                <i className="fa-solid fa-users me-1"></i>
                                {role?.name || `Unknown (${roleId})`}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-muted small">{t('common.none')}</span>
                      )}
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-info btn-sm"
                          onClick={() => openRuleForm(rule)}
                          title={t('common.editRule')}
                        >
                          <i className="fa-solid fa-edit"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => deleteRule(rule.id)}
                          title={t('common.deleteRule')}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Profanity Management Section */}
      <div id="profanity-management-section" className="mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h6 className="mb-1 fw-bold">
              <i className="fa-solid fa-comment-slash me-2 text-danger"></i>
              {t('moderation.features.automod.profanity.header')}
            </h6>
            <p className="text-muted small mb-0">
              {t('moderation.features.automod.profanity.subheader')}
            </p>
          </div>
        </div>

        {loadingProfanity ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">{t('common.loading')}</span>
            </div>
            {t('moderation.features.automod.profanity.loading')}
          </div>
        ) : (
          <div className="row">
            {/* Profanity Words */}
            <div className="col-md-6 mb-4">
              <div className="card profanity-table">
                <div className="card-header profanity-table-header d-flex align-items-center justify-content-between py-2">
                  <h6 className="mb-0 fw-semibold">
                    <i className="fa-solid fa-list me-2"></i>
                    {t('moderation.features.automod.profanity.words.header')} ({profanityWords.filter(word => 
                      word.word.toLowerCase().includes(wordSearchFilter.toLowerCase())
                    ).length})
                  </h6>
                  <button
                    type="button"
                    id="add-profanity-word-btn"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => openWordForm()}
                  >
                    <i className="fa-solid fa-plus me-1"></i>
                    {t('moderation.features.automod.profanity.words.add')}
                  </button>
                </div>
                <div className="card-body p-0">
                  {/* Search Filter */}
                  <div className="p-3 border-bottom profanity-search-container">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">
                        <i className="fa-solid fa-search"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control profanity-search-input"
                        placeholder={t('moderation.features.automod.profanity.words.searchPlaceholder')}
                        value={wordSearchFilter}
                        onChange={(e) => setWordSearchFilter(e.target.value)}
                      />
                      {wordSearchFilter && (
                        <button
                          className="btn btn-outline-secondary"
                          type="button"
                          onClick={() => setWordSearchFilter('')}
                        >
                          <i className="fa-solid fa-times"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {profanityWords.filter(word => 
                    word.word.toLowerCase().includes(wordSearchFilter.toLowerCase())
                  ).length === 0 ? (
                    <div className="text-center py-4 profanity-empty-state">
                      <div className="text-muted">
                        <i className="fa-solid fa-comment-dots fs-1 mb-3 opacity-50"></i>
                        <p className="mb-0">
                          {wordSearchFilter ? t('moderation.features.automod.profanity.words.noMatches') : t('moderation.features.automod.profanity.words.empty')}
                        </p>
                        <small>
                          {wordSearchFilter ? t('moderation.features.automod.profanity.words.tryDifferent') : t('moderation.features.automod.profanity.words.emptyCta')}
                        </small>
                      </div>
                    </div>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table className="table table-sm table-hover mb-0">
                        <thead className="table-dark sticky-top">
                          <tr>
                            <th style={{ fontSize: '0.75rem' }}>{t('moderation.features.automod.profanity.words.table.word')}</th>
                            <th style={{ fontSize: '0.75rem' }}>{t('moderation.features.automod.profanity.words.table.severity')}</th>
                            <th style={{ fontSize: '0.75rem' }}>{t('moderation.features.automod.profanity.words.table.status')}</th>
                            <th style={{ fontSize: '0.75rem' }}>{t('moderation.features.automod.profanity.words.table.actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profanityWords.filter(word => 
                            word.word.toLowerCase().includes(wordSearchFilter.toLowerCase())
                          ).map(word => (
                            <tr key={word.id}>
                              <td>
                                <code className="text-danger" style={{ fontSize: '0.85rem' }}>
                                  {word.word}
                                </code>
                                <div style={{ fontSize: '0.65rem' }} className="text-muted">
                                  {word.language} • {word.wholeWordOnly ? t('moderation.features.automod.profanity.words.wholeWord') : t('moderation.features.automod.profanity.words.partial')} • {word.caseSensitive ? t('moderation.features.automod.profanity.words.caseSensitive') : t('moderation.features.automod.profanity.words.caseInsensitive')}
                                </div>
                              </td>
                              <td>
                                <span className={`badge ${
                                  word.severity === 'extreme' ? 'bg-danger' :
                                  word.severity === 'high' ? 'bg-warning' :
                                  word.severity === 'medium' ? 'bg-info' :
                                  'bg-secondary'
                                }`} style={{ fontSize: '0.65rem' }}>
                                  {word.severity}
                                </span>
                              </td>
                              <td>
                                <div className="form-check form-switch">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`word-toggle-${word.id}`}
                                    checked={word.enabled}
                                    onChange={() => toggleWordStatus(word)}
                                  />
                                  <label className="form-check-label" htmlFor={`word-toggle-${word.id}`}>
                                  </label>
                                </div>
                              </td>
                              <td>
                                <div className="btn-group btn-group-sm">
                                  <button
                                    type="button"
                                    id="edit-profanity-word-btn"
                                    className="btn btn-outline-info btn-sm"
                                    style={{ fontSize: '0.65rem', padding: '0.125rem 0.25rem' }}
                                    onClick={() => openWordForm(word)}
                                    title={t('common.editWord')}
                                  >
                                    <i className="fa-solid fa-edit"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    style={{ fontSize: '0.65rem', padding: '0.125rem 0.25rem' }}
                                    onClick={() => requestDeleteWord(word.id, word.word)}
                                    title={t('common.deleteWord')}
                                  >
                                    <i className="fa-solid fa-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Profanity Patterns */}
            <div className="col-md-6 mb-4">
              <div className="card profanity-table">
                <div className="card-header profanity-table-header d-flex align-items-center justify-content-between py-2">
                  <h6 className="mb-0 fw-semibold">
                    <i className="fa-solid fa-code me-2"></i>
                    {t('moderation.features.automod.profanity.patterns.header')} ({profanityPatterns.filter(pattern => 
                      pattern.pattern.toLowerCase().includes(patternSearchFilter.toLowerCase()) ||
                      (pattern.description && pattern.description.toLowerCase().includes(patternSearchFilter.toLowerCase()))
                    ).length})
                  </h6>
                  <button
                    type="button"
                    id="add-profanity-pattern-btn"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => openPatternForm()}
                  >
                    <i className="fa-solid fa-plus me-1"></i>
                    {t('moderation.features.automod.profanity.patterns.add')}
                  </button>
                </div>
                <div className="card-body p-0">
                  {/* Search Filter */}
                  <div className="p-3 border-bottom profanity-search-container">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">
                        <i className="fa-solid fa-search"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control profanity-search-input"
                        placeholder={t('moderation.features.automod.profanity.patterns.searchPlaceholder')}
                        value={patternSearchFilter}
                        onChange={(e) => setPatternSearchFilter(e.target.value)}
                      />
                      {patternSearchFilter && (
                        <button
                          className="btn btn-outline-secondary"
                          type="button"
                          onClick={() => setPatternSearchFilter('')}
                        >
                          <i className="fa-solid fa-times"></i>
                        </button>
                      )}
                    </div>
                  </div>

                  {profanityPatterns.filter(pattern => 
                    pattern.pattern.toLowerCase().includes(patternSearchFilter.toLowerCase()) ||
                    (pattern.description && pattern.description.toLowerCase().includes(patternSearchFilter.toLowerCase()))
                  ).length === 0 ? (
                    <div className="text-center py-4 profanity-empty-state">
                      <div className="text-muted">
                        <i className="fa-solid fa-code fs-1 mb-3 opacity-50"></i>
                        <p className="mb-0">
                          {patternSearchFilter ? t('moderation.features.automod.profanity.patterns.noMatches') : t('moderation.features.automod.profanity.patterns.empty')}
                        </p>
                        <small>
                          {patternSearchFilter ? t('moderation.features.automod.profanity.patterns.tryDifferent') : t('moderation.features.automod.profanity.patterns.emptyCta')}
                        </small>
                      </div>
                    </div>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table className="table table-sm table-hover mb-0">
                        <thead className="table-dark sticky-top">
                          <tr>
                            <th style={{ fontSize: '0.75rem' }}>{t('moderation.features.automod.profanity.patterns.table.pattern')}</th>
                            <th style={{ fontSize: '0.75rem' }}>{t('moderation.features.automod.profanity.patterns.table.severity')}</th>
                            <th style={{ fontSize: '0.75rem' }}>{t('moderation.features.automod.profanity.patterns.table.status')}</th>
                            <th style={{ fontSize: '0.75rem' }}>{t('moderation.features.automod.profanity.patterns.table.actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profanityPatterns.filter(pattern => 
                            pattern.pattern.toLowerCase().includes(patternSearchFilter.toLowerCase()) ||
                            (pattern.description && pattern.description.toLowerCase().includes(patternSearchFilter.toLowerCase()))
                          ).map(pattern => (
                            <tr key={pattern.id}>
                              <td>
                                <code className="text-warning" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>
                                  /{pattern.pattern}/{pattern.flags}
                                </code>
                                {pattern.description && (
                                  <div style={{ fontSize: '0.65rem' }} className="text-muted">
                                    {pattern.description}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${
                                  pattern.severity === 'extreme' ? 'bg-danger' :
                                  pattern.severity === 'high' ? 'bg-warning' :
                                  pattern.severity === 'medium' ? 'bg-info' :
                                  'bg-secondary'
                                }`} style={{ fontSize: '0.65rem' }}>
                                  {pattern.severity}
                                </span>
                              </td>
                              <td>
                                <div className="form-check form-switch">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`pattern-toggle-${pattern.id}`}
                                    checked={pattern.enabled}
                                    onChange={() => togglePatternStatus(pattern)}
                                  />
                                  <label className="form-check-label" htmlFor={`pattern-toggle-${pattern.id}`}>
                                  </label>
                                </div>
                              </td>
                              <td>
                                <div className="btn-group btn-group-sm">
                                  <button
                                    type="button"
                                    id="edit-profanity-pattern-btn"
                                    className="btn btn-outline-info btn-sm"
                                    style={{ fontSize: '0.65rem', padding: '0.125rem 0.25rem' }}
                                    onClick={() => openPatternForm(pattern)}
                                    title={t('common.editPattern')}
                                  >
                                    <i className="fa-solid fa-edit"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    style={{ fontSize: '0.65rem', padding: '0.125rem 0.25rem' }}
                                    onClick={() => requestDeletePattern(pattern.id, pattern.description)}
                                    title={t('common.deletePattern')}
                                  >
                                    <i className="fa-solid fa-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profanity Word Form Modal */}
      {showProfanityWordForm && (
        <div className="modal fade show d-block" id="profanity-words-modal" role="dialog" aria-modal="true" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h6 className="modal-title">
                  {editingWord ? t('moderation.features.automod.profanity.words.modal.editTitle') : t('moderation.features.automod.profanity.words.modal.addTitle')}
                </h6>
                <button type="button" className="btn-close" onClick={closeWordForm}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-semibold">{t('moderation.features.automod.profanity.words.modal.wordLabel')} *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={wordForm.word}
                    onChange={(e) => setWordForm(prev => ({ ...prev, word: e.target.value }))}
                    placeholder={t('moderation.features.automod.profanity.words.modal.wordPlaceholder')}
                  />
                </div>
                
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-semibold">{t('moderation.features.automod.common.severity')}</label>
                    <select
                      className="form-select form-select-sm"
                      value={wordForm.severity}
                      onChange={(e) => setWordForm(prev => ({ ...prev, severity: e.target.value }))}
                    >
                      <option value="low">{t('moderation.features.automod.severity.low')}</option>
                      <option value="medium">{t('moderation.features.automod.severity.medium')}</option>
                      <option value="high">{t('moderation.features.automod.severity.high')}</option>
                      <option value="extreme">{t('moderation.features.automod.severity.extreme')}</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-semibold">{t('moderation.features.automod.common.language')}</label>
                    <select
                      className="form-select form-select-sm"
                      value={wordForm.language}
                      onChange={(e) => setWordForm(prev => ({ ...prev, language: e.target.value }))}
                    >
                      <option value="en">{t('languages.en')}</option>
                      <option value="id">{t('languages.id')}</option>
                      <option value="es">{t('languages.es')}</option>
                      <option value="fr">{t('languages.fr')}</option>
                      <option value="de">{t('languages.de')}</option>
                    </select>
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={wordForm.caseSensitive}
                        onChange={(e) => setWordForm(prev => ({ ...prev, caseSensitive: e.target.checked }))}
                      />
                      <label className="form-check-label small">
                        {t('moderation.features.automod.profanity.words.modal.caseSensitive')}
                      </label>
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={wordForm.wholeWordOnly}
                        onChange={(e) => setWordForm(prev => ({ ...prev, wholeWordOnly: e.target.checked }))}
                      />
                      <label className="form-check-label small">
                        {t('moderation.features.automod.profanity.words.modal.wholeWordOnly')}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={wordForm.enabled}
                      onChange={(e) => setWordForm(prev => ({ ...prev, enabled: e.target.checked }))}
                    />
                    <label className="form-check-label small">
                      {t('common.enabled')}
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm modal-action-btn" onClick={closeWordForm}>
                  <i className="fa-solid fa-times"></i>
                  {t('common.cancel')}
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm modal-action-btn" 
                  onClick={saveWord}
                  disabled={!wordForm.word.trim()}
                >
                  <i className={`fa-solid fa-${editingWord ? 'edit' : 'plus'}`}></i>
                  {editingWord ? t('common.update') : t('common.add')} {t('moderation.features.automod.common.word')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profanity Pattern Form Modal */}
      {showProfanityPatternForm && (
        <div className="modal fade show d-block" id="profanity-patterns-modal" role="dialog" aria-modal="true" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h6 className="modal-title">
                  {editingPattern ? t('moderation.features.automod.profanity.patterns.modal.editTitle') : t('moderation.features.automod.profanity.patterns.modal.addTitle')}
                </h6>
                <button type="button" className="btn-close" onClick={closePatternForm}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-semibold">{t('moderation.features.automod.profanity.patterns.modal.patternLabel')} *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm font-monospace"
                    value={patternForm.pattern}
                    onChange={(e) => setPatternForm(prev => ({ ...prev, pattern: e.target.value }))}
                    placeholder={t('moderation.features.automod.profanity.patterns.modal.patternPlaceholder')}
                  />
                  <small className="text-muted">
                    Example: <code>b+a+d+w+o+r+d+</code> to detect "badword" with repeated characters
                  </small>
                </div>
                
                <div className="mb-3">
                  <label className="form-label small fw-semibold">{t('moderation.features.automod.common.description')}</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={patternForm.description}
                    onChange={(e) => setPatternForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('moderation.features.automod.profanity.patterns.modal.descriptionPlaceholder')}
                  />
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-semibold">{t('moderation.features.automod.common.severity')}</label>
                    <select
                      className="form-select form-select-sm"
                      value={patternForm.severity}
                      onChange={(e) => setPatternForm(prev => ({ ...prev, severity: e.target.value }))}
                    >
                      <option value="low">{t('moderation.features.automod.severity.low')}</option>
                      <option value="medium">{t('moderation.features.automod.severity.medium')}</option>
                      <option value="high">{t('moderation.features.automod.severity.high')}</option>
                      <option value="extreme">{t('moderation.features.automod.severity.extreme')}</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-semibold">{t('moderation.features.automod.profanity.patterns.modal.flagsLabel')}</label>
                    <input
                      type="text"
                      className="form-control form-control-sm font-monospace"
                      value={patternForm.flags}
                      onChange={(e) => setPatternForm(prev => ({ ...prev, flags: e.target.value }))}
                      placeholder={t('moderation.features.automod.profanity.patterns.modal.flagsPlaceholder')}
                    />
                    <small className="text-muted">
                      Common: <code>gi</code> (global, case-insensitive), <code>g</code> (global), <code>i</code> (case-insensitive)
                    </small>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={patternForm.enabled}
                      onChange={(e) => setPatternForm(prev => ({ ...prev, enabled: e.target.checked }))}
                    />
                    <label className="form-check-label small">
                      {t('common.enabled')}
                    </label>
                  </div>
                </div>

                {/* Pattern Test Section */}
                <div className="pattern-preview-container">
                  <h6 className="small fw-semibold mb-2">
                    <i className="fa-solid fa-vial me-1"></i>
                    {t('moderation.features.automod.profanity.patterns.modal.testHeader')}
                  </h6>
                  <p className="small text-muted mb-2">
                    {t('moderation.features.automod.profanity.patterns.modal.preview')}: <code>/{patternForm.pattern}/{patternForm.flags}</code>
                  </p>
                  {patternForm.pattern && (
                    <div className="small">
                      <strong>{t('moderation.features.automod.profanity.patterns.modal.status')}:</strong> 
                      {(() => {
                        try {
                          new RegExp(patternForm.pattern, patternForm.flags);
                          return <span className="text-success ms-1">✓ {t('moderation.features.automod.profanity.patterns.modal.valid')}</span>;
                        } catch (e) {
                          return <span className="text-danger ms-1">✗ {t('moderation.features.automod.profanity.patterns.modal.invalid')}: {e.message}</span>;
                        }
                      })()}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm modal-action-btn" onClick={closePatternForm}>
                  <i className="fa-solid fa-times"></i>
                  {t('common.cancel')}
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm modal-action-btn" 
                  onClick={savePattern}
                  disabled={!patternForm.pattern.trim()}
                >
                  <i className={`fa-solid fa-${editingPattern ? 'edit' : 'plus'}`}></i>
                  {editingPattern ? t('common.update') : t('common.add')} {t('moderation.features.automod.common.pattern')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline Rule Form */}
      {showRuleForm && (
        <div id="automod-rule-form" className="card mb-3 position-relative automod-rule-form">
          {/* Loading Overlay */}
          {saving && (
            <div 
              className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '8px',
                zIndex: 1000
              }}
            >
              <div className="text-center text-light">
                <div className="spinner-border spinner-border-sm mb-2" role="status">
                  <span className="visually-hidden">{t('common.loading')}</span>
                </div>
                <div className="small">
                  {editingRule ? t('moderation.features.automod.rules.updating') : t('moderation.features.automod.rules.creating')}
                </div>
              </div>
            </div>
          )}

          <div className="card-header d-flex align-items-center justify-content-between">
            <h6 className="mb-0">
              {editingRule ? t('moderation.features.automod.rules.editTitle') : t('moderation.features.automod.rules.createTitle')}
            </h6>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={closeRuleForm}
            />
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">{t('moderation.features.automod.rules.form.name')} *</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={ruleForm.name}
                  onChange={(e) => updateRuleForm('name', e.target.value)}
                  placeholder={t('moderation.features.automod.rules.form.namePlaceholder')}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">{t('moderation.features.automod.rules.form.trigger')} *</label>
                <select
                  className="form-select form-select-sm"
                  value={ruleForm.triggerType}
                  onChange={(e) => updateRuleForm('triggerType', e.target.value)}
                >
                  {triggerTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <small className="text-muted">
                  {triggerTypes.find(t => t.value === ruleForm.triggerType)?.description}
                </small>
        {ruleForm.triggerType === 'profanity' && (
                  <div className="alert alert-info alert-sm mt-2" style={{ fontSize: '0.75rem', padding: '0.5rem' }}>
          <i className="fa-solid fa-info-circle me-1"></i>
          <strong>{t('moderation.features.automod.tip')}</strong> {t('moderation.features.automod.profanity.manageTip')}
                  </div>
                )}
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">{t('moderation.features.automod.rules.form.action')} *</label>
                <select
                  className="form-select form-select-sm"
                  value={ruleForm.actionType}
                  onChange={(e) => updateRuleForm('actionType', e.target.value)}
                >
                  {actionTypes.map(action => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </select>
                <small className="text-muted">
                  {actionTypes.find(a => a.value === ruleForm.actionType)?.description}
                </small>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">{t('moderation.features.automod.rules.form.threshold')}</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={ruleForm.thresholdValue || ''}
                  onChange={(e) => updateRuleForm('thresholdValue', parseInt(e.target.value) || 0)}
                  placeholder={t('moderation.features.automod.rules.form.thresholdPlaceholder')}
                  min="1"
                  max="100"
                />
                <small className="text-muted">{t('moderation.features.automod.rules.form.thresholdHelp')}</small>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">{t('moderation.features.automod.rules.form.duration')}</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={ruleForm.duration || ''}
                  onChange={(e) => updateRuleForm('duration', parseInt(e.target.value) || null)}
                  placeholder={t('moderation.features.automod.rules.form.durationPlaceholder')}
                  min="1"
                  max="43200"
                />
                <small className="text-muted">{t('moderation.features.automod.rules.form.durationHelp')}</small>
              </div>
            </div>

            <div className="row">
              
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">{t('moderation.features.automod.rules.form.logChannel')}</label>
                <ChannelSelector
                  value={ruleForm.logChannelId || ''}
                  onChange={(value) => updateRuleForm('logChannelId', value || null)}
                  channels={channels}
                  placeholder={t('moderation.features.automod.rules.form.logChannelPlaceholder')}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">{t('moderation.features.automod.rules.form.messageAction')}</label>
                <select
                  className="form-select form-select-sm"
                  value={ruleForm.messageAction}
                  onChange={(e) => updateRuleForm('messageAction', e.target.value)}
                >
                  <option value="keep">{t('moderation.features.automod.messageAction.keep')}</option>
                  <option value="delete">{t('moderation.features.automod.messageAction.delete')}</option>
                </select>
                <small className="text-muted">{t('moderation.features.automod.rules.form.messageActionHelp')}</small>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">{t('moderation.features.automod.rules.form.whitelistChannels')}</label>
                <ChannelPicker
                  value={ruleForm.whitelistChannels}
                  onChange={(value) => updateRuleForm('whitelistChannels', value)}
                  channels={channels}
                />
                <small className="text-muted">
                  <i className="fa-solid fa-info-circle me-1"></i>
                  {t('moderation.features.automod.rules.form.whitelistChannelsHelp')}
                </small>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">{t('moderation.features.automod.rules.form.whitelistRoles')}</label>
                <RolePicker
                  value={ruleForm.whitelistRoles}
                  onChange={(value) => updateRuleForm('whitelistRoles', value)}
                  roles={roles}
                />
                <small className="text-muted">
                  <i className="fa-solid fa-info-circle me-1"></i>
                  {t('moderation.features.automod.rules.form.whitelistRolesHelp')}
                </small>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={closeRuleForm}
              >
                <i className="fa-solid fa-times me-1"></i>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={saveRule}
                disabled={saving || !ruleForm.name || !ruleForm.triggerType || !ruleForm.actionType}
              >
                {saving ? (
                  <>
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">{t('common.loading')}</span>
                    </div>
                    {editingRule ? t('moderation.features.automod.rules.updatingShort') : t('moderation.features.automod.rules.creatingShort')}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-save me-1"></i>
                    {editingRule ? t('moderation.features.automod.rules.updateBtn') : t('moderation.features.automod.rules.createBtn')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        show={showDeleteModal}
        onClose={cancelDeleteRule}
        onConfirm={confirmDeleteRule}
        isDeleting={deleting}
  title={t('moderation.features.automod.deleteRule.title')}
  message={t('moderation.features.automod.deleteRule.message')}
  warningMessage={t('moderation.features.automod.deleteRule.warning')}
  confirmButtonText={t('moderation.features.automod.deleteRule.confirm')}
        itemDetails={ruleToDelete && (
          <>
            <div className="fw-semibold text-primary mb-2">
              <i className="fa-solid fa-shield-alt me-2"></i>
              {ruleToDelete.name}
            </div>
            <div className="small text-muted">
              <div className="row">
                <div className="col-6">
                  <strong>{t('moderation.features.automod.table.trigger')}:</strong> <span className="badge bg-info ms-1">{ruleToDelete.triggerType}</span>
                </div>
                <div className="col-6">
                  <strong>{t('moderation.features.automod.table.action')}:</strong> <span className="badge bg-primary ms-1">{ruleToDelete.actionType}</span>
                </div>
              </div>
              {ruleToDelete.thresholdValue && (
                <div className="mt-2">
                  <strong>{t('moderation.features.automod.table.threshold')}:</strong> <span className="text-warning">{ruleToDelete.thresholdValue}</span>
                </div>
              )}
            </div>
          </>
        )}
      />

      {/* Profanity Word Delete Confirmation Modal */}
      <DeleteConfirmationModal
        show={showDeleteWordModal}
        onClose={cancelDeleteWord}
        onConfirm={confirmDeleteWord}
        isDeleting={deletingWord}
  title={t('moderation.features.automod.profanity.words.delete.title')}
  message={t('moderation.features.automod.profanity.words.delete.message')}
  warningMessage={t('moderation.features.automod.profanity.words.delete.warning')}
  confirmButtonText={t('moderation.features.automod.profanity.words.delete.confirm')}
        itemDetails={wordToDelete && (
          <div className="fw-semibold text-warning">
            <i className="fa-solid fa-exclamation-triangle me-2"></i>
            "{wordToDelete.word}"
          </div>
        )}
      />

      {/* Profanity Pattern Delete Confirmation Modal */}
      <DeleteConfirmationModal
        show={showDeletePatternModal}
        onClose={cancelDeletePattern}
        onConfirm={confirmDeletePattern}
        isDeleting={deletingPattern}
  title={t('moderation.features.automod.profanity.patterns.delete.title')}
  message={t('moderation.features.automod.profanity.patterns.delete.message')}
  warningMessage={t('moderation.features.automod.profanity.patterns.delete.warning')}
  confirmButtonText={t('moderation.features.automod.profanity.patterns.delete.confirm')}
        itemDetails={patternToDelete && (
          <div>
            <div className="fw-semibold text-warning mb-2">
              <i className="fa-solid fa-code me-2"></i>
              Pattern: <code>/{patternToDelete.id && profanityPatterns.find(p => p.id === patternToDelete.id)?.pattern}/{profanityPatterns.find(p => p.id === patternToDelete.id)?.flags}</code>
            </div>
            {patternToDelete.description && (
              <div className="small text-muted">
                Description: {patternToDelete.description}
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
