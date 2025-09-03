import React, { useState, useEffect, useRef } from 'react';
import { ChannelSelector, FormField, SwitchToggle, RoleSelector } from '../components/SharedComponents';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { getProfanityWords, addProfanityWord, updateProfanityWord, deleteProfanityWord, 
         getProfanityPatterns, addProfanityPattern, updateProfanityPattern, deleteProfanityPattern } from '../../../api';

// Custom Channel Picker Component
function ChannelPicker({ value, onChange, channels }) {
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
          placeholder={list.length ? '' : 'Add channels…'} 
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
              <span className="meta">channel</span>
            </button>
          ))}
        </div>
      )}
      
      {open && filtered.length === 0 && (
        <div className="mention-targets-suggestions">
          <div className="text-muted small p-2" style={{fontSize: '.55rem'}}>
            No matches
          </div>
        </div>
      )}
    </div>
  );
}

// Custom Role Picker Component
function RolePicker({ value, onChange, roles }) {
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
          placeholder={list.length ? '' : 'Add roles…'} 
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
              <span className="meta">role</span>
            </button>
          ))}
        </div>
      )}
      
      {open && filtered.length === 0 && (
        <div className="mention-targets-suggestions">
          <div className="text-muted small p-2" style={{fontSize: '.55rem'}}>
            No matches
          </div>
        </div>
      )}
    </div>
  );
}

// Auto Moderation Configuration
export default function AutomodConfigForm({ config, updateConfig, channels, roles, guildId, showToast }) {
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
    { value: 'spam', label: 'Spam Detection', description: 'Detect repeated messages and spam patterns' },
    { value: 'caps', label: 'Excessive Caps', description: 'Filter messages with too many capital letters' },
    { value: 'links', label: 'Link Filter', description: 'Block unauthorized links and URLs' },
    { value: 'invite_links', label: 'Invite Links', description: 'Block Discord server invites' },
    { value: 'profanity', label: 'Profanity Filter', description: 'Filter inappropriate language' },
    { value: 'mention_spam', label: 'Mention Spam', description: 'Prevent excessive user/role mentions' }
  ];

  const actionTypes = [
    { value: 'delete', label: 'Delete Message', description: 'Remove the violating message' },
    { value: 'mute', label: 'Temporary Mute', description: 'Mute the user for a specified duration' },
    { value: 'kick', label: 'Kick User', description: 'Remove the user from the server' },
    { value: 'ban', label: 'Ban User', description: 'Permanently ban the user' }
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
  focusModal('profanity-words-modal');
  };

  const closeWordForm = () => {
    setShowProfanityWordForm(false);
    setEditingWord(null);
  };

  const saveWord = async () => {
    try {
      if (editingWord) {
        await updateProfanityWord(editingWord.id, wordForm, guildId);
        showToast?.('success', `Profanity word "${wordForm.word}" updated successfully!`);
      } else {
        await addProfanityWord(wordForm, guildId);
        showToast?.('success', `Profanity word "${wordForm.word}" added successfully!`);
      }
      
      await loadProfanityData();
      closeWordForm();
    } catch (error) {
      console.error('Failed to save profanity word:', error);
      showToast?.('error', `Failed to save profanity word. ${error.message || 'Please try again.'}`);
    }
  };

  const deleteWord = async (wordId, word) => {
    try {
      await deleteProfanityWord(wordId, guildId);
      await loadProfanityData();
      showToast?.('success', `Profanity word "${word}" deleted successfully!`);
    } catch (error) {
      console.error('Failed to delete profanity word:', error);
      showToast?.('error', `Failed to delete profanity word. ${error.message || 'Please try again.'}`);
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
      
      showToast?.('success', `Profanity word ${updatedWord.enabled ? 'enabled' : 'disabled'} successfully!`);
    } catch (error) {
      console.error('Failed to toggle profanity word status:', error);
      showToast?.('error', `Failed to toggle profanity word status. ${error.message || 'Please try again.'}`);
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
  focusModal('profanity-patterns-modal');
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
        showToast?.('error', `Invalid regex pattern: ${regexError.message}`);
        return;
      }

      if (editingPattern) {
        await updateProfanityPattern(editingPattern.id, patternForm, guildId);
        showToast?.('success', `Profanity pattern updated successfully!`);
      } else {
        await addProfanityPattern(patternForm, guildId);
        showToast?.('success', `Profanity pattern added successfully!`);
      }
      
      await loadProfanityData();
      closePatternForm();
    } catch (error) {
      console.error('Failed to save profanity pattern:', error);
      showToast?.('error', `Failed to save profanity pattern. ${error.message || 'Please try again.'}`);
    }
  };

  const deletePattern = async (patternId, description) => {
    try {
      await deleteProfanityPattern(patternId, guildId);
      await loadProfanityData();
      showToast?.('success', `Profanity pattern ${description ? `"${description}"` : ''} deleted successfully!`);
    } catch (error) {
      console.error('Failed to delete profanity pattern:', error);
      showToast?.('error', `Failed to delete profanity pattern. ${error.message || 'Please try again.'}`);
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
      
      showToast?.('success', `Profanity pattern ${updatedPattern.enabled ? 'enabled' : 'disabled'} successfully!`);
    } catch (error) {
      console.error('Failed to toggle profanity pattern status:', error);
      showToast?.('error', `Failed to toggle profanity pattern status. ${error.message || 'Please try again.'}`);
    }
  };

  const saveRule = async () => {
    setSaving(true);
    try {
      const ruleData = {
        ...ruleForm,
        whitelistChannels: JSON.stringify(ruleForm.whitelistChannels || []),
        whitelistRoles: JSON.stringify(ruleForm.whitelistRoles || [])
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
            ? `Automod rule "${ruleForm.name}" updated successfully!` 
            : `Automod rule "${ruleForm.name}" created successfully!`
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
          ? `Failed to update automod rule "${ruleForm.name}". Please try again.`
          : `Failed to create automod rule "${ruleForm.name}". Please try again.`
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
          showToast('success', `Automod rule "${ruleToDelete.name}" deleted successfully!`);
        }
      } else {
        throw new Error('Failed to delete rule');
      }
    } catch (error) {
      console.error('Failed to delete automod rule:', error);
      
      // Show error toast
      if (showToast) {
        showToast('error', `Failed to delete automod rule "${ruleToDelete.name}". Please try again.`);
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
          showToast('success', `Automod rule "${ruleName}" ${enabled ? 'enabled' : 'disabled'} successfully!`);
        }
      } else {
        throw new Error('Failed to toggle rule');
      }
    } catch (error) {
      console.error('Failed to toggle automod rule:', error);
      
      // Show error toast
      if (showToast) {
        showToast('error', `Failed to ${enabled ? 'enable' : 'disable'} automod rule "${ruleName}". Please try again.`);
      }
    }
  };

  return (
    <div className="moderation-config-form space-y-4">
      {/* Information Section */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">Auto Moderation System</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-shield-halved me-1"></i>
            Automated Content Filtering
          </span>
        </div>
        <p className="text-muted small mb-0" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
          Create custom auto moderation rules to automatically detect and handle unwanted content including spam, 
          excessive caps, unauthorized links, and inappropriate language. Configure actions, thresholds, and bypass settings.
        </p>
      </div>
      <hr />

      {/* Quick Settings */}
      <div className="row mb-4">
        <div className="col-md-12">
          <FormField 
            label="Global Log Channel"
            description="Default channel for all auto moderation logs"
          >
            <ChannelSelector
              value={config.logChannelId || ''}
              onChange={(value) => updateConfig('logChannelId', value)}
              channels={channels}
              placeholder="No global logging"
            />
          </FormField>
        </div>
      </div>

      {/* Auto Moderation Rules */}
      <div className="mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h6 className="mb-1 fw-bold">Auto Moderation Rules</h6>
            <p className="text-muted small mb-0">
              Create and manage custom rules for different types of content filtering
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => openRuleForm()}
          >
            <i className="fa-solid fa-plus me-2"></i>
            Add Rule
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            Loading rules...
          </div>
        ) : automodRules.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-muted">
              <i className="fa-solid fa-robot fs-1 mb-3 opacity-50"></i>
              <p className="mb-0">No auto moderation rules configured</p>
              <small>Click "Add Rule" to create your first rule</small>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Rule Name</th>
                  <th>Trigger</th>
                  <th>Action</th>
                  <th>Threshold</th>
                  <th>Channel Whitelist</th>
                  <th>Role Whitelist</th>
                  <th>Actions</th>
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
                          Logs to #{channels.find(c => c.id === rule.logChannelId)?.name || 'Unknown'}
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
                          {rule.duration} minutes
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="text-warning fw-semibold">{rule.thresholdValue || 'N/A'}</span>
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
                              return <span className="text-muted small">None</span>;
                            } catch (e) {
                              return <span className="text-danger small">Invalid data</span>;
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
                        <span className="text-muted small">None</span>
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
                              return <span className="text-muted small">None</span>;
                            } catch (e) {
                              return <span className="text-danger small">Invalid data</span>;
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
                        <span className="text-muted small">None</span>
                      )}
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-info btn-sm"
                          onClick={() => openRuleForm(rule)}
                          title="Edit Rule"
                        >
                          <i className="fa-solid fa-edit"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => deleteRule(rule.id)}
                          title="Delete Rule"
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
              Profanity Management
            </h6>
            <p className="text-muted small mb-0">
              Manage custom profanity words and patterns for enhanced content filtering
            </p>
          </div>
        </div>

        {loadingProfanity ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            Loading profanity data...
          </div>
        ) : (
          <div className="row">
            {/* Profanity Words */}
            <div className="col-md-6 mb-4">
              <div className="card profanity-table">
                <div className="card-header profanity-table-header d-flex align-items-center justify-content-between py-2">
                  <h6 className="mb-0 fw-semibold">
                    <i className="fa-solid fa-list me-2"></i>
                    Profanity Words ({profanityWords.filter(word => 
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
                    Add Word
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
                        placeholder="Search words..."
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
                          {wordSearchFilter ? 'No words match your search' : 'No profanity words configured'}
                        </p>
                        <small>
                          {wordSearchFilter ? 'Try a different search term' : 'Click "Add Word" to create your first word filter'}
                        </small>
                      </div>
                    </div>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table className="table table-sm table-hover mb-0">
                        <thead className="table-dark sticky-top">
                          <tr>
                            <th style={{ fontSize: '0.75rem' }}>Word</th>
                            <th style={{ fontSize: '0.75rem' }}>Severity</th>
                            <th style={{ fontSize: '0.75rem' }}>Status</th>
                            <th style={{ fontSize: '0.75rem' }}>Actions</th>
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
                                  {word.language} • {word.wholeWordOnly ? 'Whole word' : 'Partial'} • {word.caseSensitive ? 'Case sensitive' : 'Case insensitive'}
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
                                    title="Edit Word"
                                  >
                                    <i className="fa-solid fa-edit"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    style={{ fontSize: '0.65rem', padding: '0.125rem 0.25rem' }}
                                    onClick={() => deleteWord(word.id, word.word)}
                                    title="Delete Word"
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
                    Regex Patterns ({profanityPatterns.filter(pattern => 
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
                    Add Pattern
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
                        placeholder="Search patterns..."
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
                          {patternSearchFilter ? 'No patterns match your search' : 'No regex patterns configured'}
                        </p>
                        <small>
                          {patternSearchFilter ? 'Try a different search term' : 'Click "Add Pattern" to create advanced filters'}
                        </small>
                      </div>
                    </div>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table className="table table-sm table-hover mb-0">
                        <thead className="table-dark sticky-top">
                          <tr>
                            <th style={{ fontSize: '0.75rem' }}>Pattern</th>
                            <th style={{ fontSize: '0.75rem' }}>Severity</th>
                            <th style={{ fontSize: '0.75rem' }}>Status</th>
                            <th style={{ fontSize: '0.75rem' }}>Actions</th>
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
                                    title="Edit Pattern"
                                  >
                                    <i className="fa-solid fa-edit"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    style={{ fontSize: '0.65rem', padding: '0.125rem 0.25rem' }}
                                    onClick={() => deletePattern(pattern.id, pattern.description)}
                                    title="Delete Pattern"
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
                  {editingWord ? 'Edit Profanity Word' : 'Add Profanity Word'}
                </h6>
                <button type="button" className="btn-close" onClick={closeWordForm}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Word *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={wordForm.word}
                    onChange={(e) => setWordForm(prev => ({ ...prev, word: e.target.value }))}
                    placeholder="Enter profanity word"
                  />
                </div>
                
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-semibold">Severity</label>
                    <select
                      className="form-select form-select-sm"
                      value={wordForm.severity}
                      onChange={(e) => setWordForm(prev => ({ ...prev, severity: e.target.value }))}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="extreme">Extreme</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-semibold">Language</label>
                    <select
                      className="form-select form-select-sm"
                      value={wordForm.language}
                      onChange={(e) => setWordForm(prev => ({ ...prev, language: e.target.value }))}
                    >
                      <option value="en">English</option>
                      <option value="id">Indonesian</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
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
                        Case Sensitive
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
                        Whole Word Only
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
                      Enabled
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm modal-action-btn" onClick={closeWordForm}>
                  <i className="fa-solid fa-times"></i>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm modal-action-btn" 
                  onClick={saveWord}
                  disabled={!wordForm.word.trim()}
                >
                  <i className={`fa-solid fa-${editingWord ? 'edit' : 'plus'}`}></i>
                  {editingWord ? 'Update' : 'Add'} Word
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
                  {editingPattern ? 'Edit Profanity Pattern' : 'Add Profanity Pattern'}
                </h6>
                <button type="button" className="btn-close" onClick={closePatternForm}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Regex Pattern *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm font-monospace"
                    value={patternForm.pattern}
                    onChange={(e) => setPatternForm(prev => ({ ...prev, pattern: e.target.value }))}
                    placeholder="Enter regex pattern (without delimiters)"
                  />
                  <small className="text-muted">
                    Example: <code>b+a+d+w+o+r+d+</code> to detect "badword" with repeated characters
                  </small>
                </div>
                
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Description</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={patternForm.description}
                    onChange={(e) => setPatternForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of what this pattern detects"
                  />
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-semibold">Severity</label>
                    <select
                      className="form-select form-select-sm"
                      value={patternForm.severity}
                      onChange={(e) => setPatternForm(prev => ({ ...prev, severity: e.target.value }))}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="extreme">Extreme</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-semibold">Regex Flags</label>
                    <input
                      type="text"
                      className="form-control form-control-sm font-monospace"
                      value={patternForm.flags}
                      onChange={(e) => setPatternForm(prev => ({ ...prev, flags: e.target.value }))}
                      placeholder="gi"
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
                      Enabled
                    </label>
                  </div>
                </div>

                {/* Pattern Test Section */}
                <div className="pattern-preview-container">
                  <h6 className="small fw-semibold mb-2">
                    <i className="fa-solid fa-vial me-1"></i>
                    Test Pattern
                  </h6>
                  <p className="small text-muted mb-2">
                    Preview: <code>/{patternForm.pattern}/{patternForm.flags}</code>
                  </p>
                  {patternForm.pattern && (
                    <div className="small">
                      <strong>Pattern Status:</strong> 
                      {(() => {
                        try {
                          new RegExp(patternForm.pattern, patternForm.flags);
                          return <span className="text-success ms-1">✓ Valid</span>;
                        } catch (e) {
                          return <span className="text-danger ms-1">✗ Invalid: {e.message}</span>;
                        }
                      })()}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm modal-action-btn" onClick={closePatternForm}>
                  <i className="fa-solid fa-times"></i>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm modal-action-btn" 
                  onClick={savePattern}
                  disabled={!patternForm.pattern.trim()}
                >
                  <i className={`fa-solid fa-${editingPattern ? 'edit' : 'plus'}`}></i>
                  {editingPattern ? 'Update' : 'Add'} Pattern
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
                  <span className="visually-hidden">Loading...</span>
                </div>
                <div className="small">
                  {editingRule ? 'Updating rule...' : 'Creating rule...'}
                </div>
              </div>
            </div>
          )}

          <div className="card-header d-flex align-items-center justify-content-between">
            <h6 className="mb-0">
              {editingRule ? 'Edit Auto Moderation Rule' : 'Create New Auto Moderation Rule'}
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
                <label className="form-label small fw-semibold">Rule Name *</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={ruleForm.name}
                  onChange={(e) => updateRuleForm('name', e.target.value)}
                  placeholder="e.g., Spam Protection"
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">Trigger Type *</label>
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
                    <strong>Tip:</strong> Manage your profanity words and patterns in the "Profanity Management" section above to customize what content gets filtered.
                  </div>
                )}
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">Action Type *</label>
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
                <label className="form-label small fw-semibold">Threshold Value</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={ruleForm.thresholdValue || ''}
                  onChange={(e) => updateRuleForm('thresholdValue', parseInt(e.target.value) || 0)}
                  placeholder="5"
                  min="1"
                  max="100"
                />
                <small className="text-muted">
                  Number of violations before action is taken (Warn to user)
                </small>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">Duration (minutes)</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={ruleForm.duration || ''}
                  onChange={(e) => updateRuleForm('duration', parseInt(e.target.value) || null)}
                  placeholder="10"
                  min="1"
                  max="43200"
                />
                <small className="text-muted">
                  Duration for mute/ban actions (leave empty for permanent)
                </small>
              </div>
            </div>

            <div className="row">
              
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">Log Channel</label>
                <ChannelSelector
                  value={ruleForm.logChannelId || ''}
                  onChange={(value) => updateRuleForm('logChannelId', value)}
                  channels={channels}
                  placeholder="Use global log channel"
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">Message Action</label>
                <select
                  className="form-select form-select-sm"
                  value={ruleForm.messageAction}
                  onChange={(e) => updateRuleForm('messageAction', e.target.value)}
                >
                  <option value="keep">Keep Message</option>
                  <option value="delete">Delete Message</option>
                </select>
                <small className="text-muted">
                  Action to take on violating messages
                </small>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">Whitelist Channels</label>
                <ChannelPicker
                  value={ruleForm.whitelistChannels}
                  onChange={(value) => updateRuleForm('whitelistChannels', value)}
                  channels={channels}
                />
                <small className="text-muted">
                  <i className="fa-solid fa-info-circle me-1"></i>
                  Channels where this rule won't apply
                </small>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label small fw-semibold">Whitelist Roles</label>
                <RolePicker
                  value={ruleForm.whitelistRoles}
                  onChange={(value) => updateRuleForm('whitelistRoles', value)}
                  roles={roles}
                />
                <small className="text-muted">
                  <i className="fa-solid fa-info-circle me-1"></i>
                  Roles that bypass this specific rule
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
                Cancel
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
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    {editingRule ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-save me-1"></i>
                    {editingRule ? 'Update Rule' : 'Create Rule'}
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
        title="Confirm Deletion"
        message="Are you sure you want to delete the automod rule?"
        warningMessage="This action cannot be undone."
        confirmButtonText="Delete Rule"
        itemDetails={ruleToDelete && (
          <>
            <div className="fw-semibold text-primary mb-2">
              <i className="fa-solid fa-shield-alt me-2"></i>
              {ruleToDelete.name}
            </div>
            <div className="small text-muted">
              <div className="row">
                <div className="col-6">
                  <strong>Trigger:</strong> <span className="badge bg-info ms-1">{ruleToDelete.triggerType}</span>
                </div>
                <div className="col-6">
                  <strong>Action:</strong> <span className="badge bg-primary ms-1">{ruleToDelete.actionType}</span>
                </div>
              </div>
              {ruleToDelete.thresholdValue && (
                <div className="mt-2">
                  <strong>Threshold:</strong> <span className="text-warning">{ruleToDelete.thresholdValue}</span>
                </div>
              )}
            </div>
          </>
        )}
      />
    </div>
  );
}
