import React, { useState, useEffect, useRef } from 'react';
import { getGuildEmojis } from '../../../../api';
import { ChannelSelector, FormField, SwitchToggle } from '../../components/SharedComponents';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import useResponsiveTable from '../../../../hooks/useResponsiveTable';
import { useI18n } from '../../../../i18n';

// Reaction Roles Configuration Component
export default function ReactionRolesConfig({ config, updateConfig, channels, roles, guildId, showToast }) {
  const [reactionRoles, setReactionRoles] = useState([]);
  const tableRef = useResponsiveTable();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    messageId: '',
    channelId: '',
    title: '',
    status: true,
    reactions: [{ emoji: '', roleId: '', type: 'toggle' }]
  });
  const [customMessage, setCustomMessage] = useState('React to get your roles!');
  const [originalFormData, setOriginalFormData] = useState({
    messageId: '',
    channelId: '',
    title: '',
    status: true,
    reactions: [{ emoji: '', roleId: '', type: 'toggle' }]
  });
  const [originalCustomMessage, setOriginalCustomMessage] = useState('React to get your roles!');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [guildEmojis, setGuildEmojis] = useState([]);
  const [currentEmojiIndex, setCurrentEmojiIndex] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState({});
  const emojiPickerRef = useRef(null);
  const { t } = useI18n();

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

  // Fetch reaction roles when component mounts
  useEffect(() => {
    fetchReactionRoles();
    fetchGuildEmojis();
  }, []);

  const fetchGuildEmojis = async () => {
    try {
      const response = await getGuildEmojis(guildId);
      if (response && response.emojis) {
        setGuildEmojis(response.emojis);
      }
    } catch (error) {
      console.error('Failed to fetch guild emojis:', error);
    }
  };

  const fetchReactionRoles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/roles/reaction-roles?guildId=${guildId}`, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      });
      
      if (response.ok) {
        const data = await response.json();
        setReactionRoles(data.reactionRoles || []);
      }
    } catch (error) {
      console.error('Failed to fetch reaction roles:', error);
  showToast('error', t('moderation.features.roles.reaction.toasts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddReactionRole = async () => {
    setSaving(true);
    
    try {
      const payload = { 
        guildId, 
        ...formData,
        customMessage: customMessage,
        title: formData.title || null
      };
      
      const response = await fetch('/api/roles/reaction-roles', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        await fetchReactionRoles();
        setShowAddForm(false);
        resetForm();
        showToast('success', t('moderation.features.roles.reaction.toasts.created', { title: formData.title || t('common.unknown') }));
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create reaction role');
      }
    } catch (error) {
      console.error('Error adding reaction role:', error);
      showToast('error', `${t('common.error')}: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateReactionRole = async () => {
    setSaving(true);
    
    try {
      const payload = { 
        guildId, 
        ...formData,
        customMessage: customMessage,
        title: formData.title || null
      };
      
      const response = await fetch(`/api/roles/reaction-roles/${editingRole.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        await fetchReactionRoles();
        setEditingRole(null);
        resetForm();
        showToast('success', t('moderation.features.roles.reaction.toasts.updated', { title: formData.title || t('common.unknown') }));
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update reaction role');
      }
    } catch (error) {
      console.error('Error updating reaction role:', error);
      showToast('error', `${t('common.error')}: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReactionRole = async (messageId) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/roles/reaction-roles/message/${messageId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': 'Bearer ' + localStorage.getItem('token'),
          'x-guild-id': guildId
        }
      });

      if (response.ok) {
        showToast('success', t('moderation.features.roles.reaction.toasts.deleteSuccess'));
        fetchReactionRoles();
      } else {
        showToast('error', t('moderation.features.roles.reaction.toasts.deleteFailed'));
      }
    } catch (error) {
      console.error('Failed to delete reaction role:', error);
      showToast('error', t('moderation.features.roles.reaction.toasts.deleteFailed'));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const confirmDelete = (group) => {
    setDeleteTarget(group);
    setShowDeleteConfirm(true);
  };

  const handleToggleStatus = async (roleId, currentStatus) => {
    setUpdatingStatus(prev => ({ ...prev, [roleId]: true }));
    
    try {
      const response = await fetch(`/api/roles/reaction-roles/${roleId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ guildId, status: !currentStatus })
      });

      if (response.ok) {
        // Update local state instead of refetching all data
        setReactionRoles(prev => prev.map(role => 
          role.id === roleId 
            ? { ...role, status: !currentStatus }
            : role
        ));
        showToast('success', !currentStatus 
          ? t('moderation.features.roles.reaction.toasts.statusEnabled') 
          : t('moderation.features.roles.reaction.toasts.statusDisabled'));
      } else {
        showToast('error', t('moderation.features.roles.reaction.toasts.statusFailed'));
      }
    } catch (error) {
      console.error('Failed to toggle status:', error);
      showToast('error', t('moderation.features.roles.reaction.toasts.statusFailed'));
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [roleId]: false }));
    }
  };

  const resetForm = () => {
    const defaultForm = {
      messageId: '',
      channelId: '',
      title: '',
      status: true,
      reactions: [{ emoji: '', roleId: '', type: 'toggle' }]
    };
    setFormData(defaultForm);
    setOriginalFormData(defaultForm);
    setCustomMessage('React to get your roles!');
    setOriginalCustomMessage('React to get your roles!');
  };

  // Check if form has been modified
  const hasChanges = () => {
    return JSON.stringify(formData) !== JSON.stringify(originalFormData) ||
           customMessage !== originalCustomMessage;
  };

  // Add a new reaction to the reactions array
  const addReaction = () => {
    setFormData(prev => ({
      ...prev,
      reactions: [...prev.reactions, { emoji: '', roleId: '', type: 'toggle' }]
    }));
  };

  // Remove a reaction from the reactions array
  const removeReaction = (index) => {
    setFormData(prev => ({
      ...prev,
      reactions: prev.reactions.filter((_, i) => i !== index)
    }));
  };

  // Update a specific reaction
  const updateReaction = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      reactions: prev.reactions.map((reaction, i) => 
        i === index ? { ...reaction, [field]: value } : reaction
      )
    }));
  };

  const startEdit = (role) => {
    setEditingRole(role);
    const editFormData = {
      messageId: role.messageId,
      channelId: role.channelId,
      title: role.title || '',
      status: Boolean(role.status),
      reactions: role.reactions || [{ emoji: role.emoji || '', roleId: role.roleId || '', type: role.type || 'toggle' }] // Handle both grouped and legacy single reaction
    };
    const editCustomMessage = role.customMessage || 'React to get your roles!';
    
    setFormData(editFormData);
    setCustomMessage(editCustomMessage);
    
    // Store original values for reset functionality
    setOriginalFormData(editFormData);
    setOriginalCustomMessage(editCustomMessage);
    setShowEmojiPicker(false);
    setShowAddForm(true);
  };

  const getChannelName = (channelId) => {
    const channel = channels.find(c => c.id === channelId);
  return channel ? `#${channel.name}` : t('common.unknown');
  };

  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
  return role ? role.name : t('common.unknown');
  };

  // Utility function to display emoji properly
  const getEmojiDisplay = (emojiValue) => {
    if (!emojiValue) return '🎉';
    
    // Check if it's a custom emoji ID format <:name:id> or <a:name:id>
    const customEmojiMatch = emojiValue.match(/<a?:(\w+):(\d+)>/);
    if (customEmojiMatch) {
      const [, name, id] = customEmojiMatch;
      // Try to find the emoji in guild emojis
      const guildEmoji = guildEmojis.find(e => e.id === id);
      if (guildEmoji) {
        return guildEmoji.animated 
          ? `<img src="https://cdn.discordapp.com/emojis/${id}.gif" alt="${name}" width="20" height="20" />`
          : `<img src="https://cdn.discordapp.com/emojis/${id}.png" alt="${name}" width="20" height="20" />`;
      }
      return `:${name}:`;
    }
    
    // Return as-is for unicode emojis
    return emojiValue;
  };

  // Group reaction roles by message
  const groupedReactionRoles = () => {
    const grouped = {};
    reactionRoles.forEach(role => {
      const key = role.messageId || 'no-message';
      if (!grouped[key]) {
        grouped[key] = {
          messageId: role.messageId,
          channelId: role.channelId,
          title: role.title,
          customMessage: role.customMessage,
          status: role.status,
          reactions: []
        };
      }
      grouped[key].reactions.push({
        id: role.id,
        emoji: role.emoji,
        roleId: role.roleId,
        type: role.type
      });
    });
    return Object.values(grouped);
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border mb-3" role="status">
          <span className="visually-hidden">{t('common.loading')}</span>
        </div>
        <div>{t('moderation.features.roles.reaction.loading')}</div>
      </div>
    );
  }

  return (
    <div className="moderation-config-form space-y-4">
      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="form-label small fw-semibold mb-0">{t('moderation.features.roles.reaction.header')}</label>
          <button 
            type="button" 
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingRole(null);
              setShowAddForm(true);
              // Force reset to default values for adding new
              setFormData({
                messageId: '',
                channelId: '',
                title: '',
                status: true,
                reactions: [{ emoji: '', roleId: '', type: 'toggle' }]
              });
              setCustomMessage('React to get your roles!');
              setShowEmojiPicker(false);
            }}
          >
            <i className="fa-solid fa-plus me-1"></i>
            {t('moderation.features.roles.reaction.buttons.add')}
          </button>
        </div>

        {/* Information Section */}
        {reactionRoles.length > 0 && (
          <div className="mb-4 p-3 bg-dark border rounded">
            <h6 className="mb-2">
              <i className="fa-solid fa-info-circle text-info me-2" />
              {t('moderation.features.roles.reaction.info.title')}
            </h6>
            <div className="small text-muted">
              <p className="mb-2">{t('moderation.features.roles.reaction.info.description')}</p>
              <div className="mb-2">
                <strong>{t('moderation.features.roles.reaction.info.types.title')}</strong>
              </div>
              <ul className="mb-0">
                <li>{t('moderation.features.roles.reaction.info.types.toggle')}</li>
                <li>{t('moderation.features.roles.reaction.info.types.addOnly')}</li>
                <li>{t('moderation.features.roles.reaction.info.types.removeOnly')}</li>
              </ul>
            </div>
          </div>
        )}

        {/* Reaction Roles Table */}
        {loading ? (
          <div className="text-center py-3">
            <i className="fa-solid fa-spinner fa-spin me-2"></i>
            {t('moderation.features.roles.reaction.loading')}
          </div>
        ) : reactionRoles.length > 0 ? (
          <div ref={tableRef} className="table-responsive-scroll">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{t('moderation.features.roles.table.status')}</th>
                  <th>{t('moderation.features.roles.table.title')}</th>
                  <th>{t('moderation.features.roles.table.channel')}</th>
                  <th>{t('moderation.features.roles.table.message')}</th>
                  <th>{t('moderation.features.roles.table.reactions')}</th>
                  <th>{t('moderation.features.roles.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {groupedReactionRoles().map((group, index) => (
                  <tr key={group.messageId || index}>
                    <td>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={Boolean(group.status)}
                          disabled={updatingStatus[group.reactions[0]?.id]}
                          onChange={() => handleToggleStatus(group.reactions[0]?.id, group.status)}
                          style={{ cursor: updatingStatus[group.reactions[0]?.id] ? 'not-allowed' : 'pointer' }}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold text-primary mobile-truncate" style={{ fontSize: '0.85rem' }}>
                        {group.title || t('common.unknown')}
                      </div>
                    </td>
                    <td>
                      <span className="mobile-truncate text-info">{getChannelName(group.channelId)}</span>
                    </td>
                    <td>
                      {group.customMessage ? (
                        <div>
                          <span className="badge badge-success mb-1">{t('moderation.features.roles.reaction.labels.botMessage')}</span>
                          <div className="small tablet-truncate" style={{maxWidth: '150px'}} title={group.customMessage}>
                            {group.customMessage && group.customMessage.length > 30 
                              ? `${group.customMessage.substring(0, 20)}...` 
                              : group.customMessage}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="badge badge-secondary mb-1">{t('moderation.features.roles.reaction.labels.userMessage')}</span>
                          <div className="font-monospace small mobile-truncate">{group.messageId}</div>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {group.reactions.map((reaction, reactionIndex) => (
                          <span 
                            key={reactionIndex} 
                            className="badge bg-secondary small"
                            style={{ fontSize: '0.7rem' }}
                          >
                            {getRoleName(reaction.roleId)} ({t(`moderation.features.roles.reaction.form.typeOptions.${reaction.type || 'toggle'}`)})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button 
                        type="button" 
                        className="btn btn-outline-primary btn-sm me-1"
                        onClick={() => {
                          // Create a pseudo-role object for editing
                          const editRole = {
                            id: group.reactions[0]?.id,
                            messageId: group.messageId,
                            channelId: group.channelId,
                            title: group.title,
                            customMessage: group.customMessage,
                            status: group.status,
                            reactions: group.reactions
                          };
                          startEdit(editRole);
                        }}
                        title={t('common.edit')}
                      >
                        <i className="fa-solid fa-edit"></i>
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => confirmDelete(group)}
                        title={t('common.delete')}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-3 text-muted">
            {t('moderation.features.roles.reaction.empty')}
          </div>
        )}

        {/* Add/Edit Form */}
        {(showAddForm || editingRole) && (
          <div className="mt-3 p-3 border rounded position-relative">
            {/* Loading Overlay */}
            {saving && (
              <div 
                className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  borderRadius: '6px',
                  zIndex: 1000
                }}
              >
                <div className="text-center text-light">
                  <div className="spinner-border spinner-border-sm mb-2" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <div className="small">
                    {editingRole ? 'Updating reaction role...' : 'Creating reaction role...'}
                  </div>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">
                {editingRole ? 'Edit Existing Reaction Role' : 'Create New Reaction Role'}
                {hasChanges() && (
                  <span className="badge badge-warning ms-2" style={{ fontSize: '0.6rem' }}>
                    <i className="fa-solid fa-circle-exclamation me-1"></i>
                    Unsaved Changes
                  </span>
                )}
              </h6>
              
              {/* Status Toggle - Top Right */}
              <div className="form-check form-switch">
                <input 
                  id="reaction-role-status"
                  className="form-check-input" 
                  type="checkbox" 
                  checked={formData.status !== false}
                  onChange={(e) => setFormData({...formData, status: e.target.checked})}
                />
                <label htmlFor="reaction-role-status" className="form-check-label small fw-semibold">
                  {t('moderation.features.roles.reaction.form.status')}
                </label>
              </div>
            </div>
            
            {/* Title Field */}
            <div className="mb-3">
              <label className="form-label small fw-semibold">{t('moderation.features.roles.reaction.form.title')}</label>
              <input 
                type="text" 
                className="form-control form-control-sm"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder={t('moderation.features.roles.reaction.form.titlePlaceholder')}
              />
              <small className="text-muted">{t('moderation.features.roles.reaction.form.titleHelp')}</small>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label small">{t('moderation.features.roles.reaction.form.channel')}</label>
                <select 
                  className="form-select form-select-sm custom-dropdown"
                  value={formData.channelId}
                  onChange={(e) => setFormData({...formData, channelId: e.target.value})}
                >
                  <option value="">{t('moderation.features.roles.reaction.form.channelPlaceholder')}</option>
                  {channels.filter(ch => ch.type === 0).map(channel => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
              {editingRole && (
                <div className="col-md-6 mb-3">
                  <label className="form-label small">{t('moderation.features.roles.reaction.form.messageId')}</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm"
                    value={formData.messageId}
                    readOnly
                    style={{ 
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      cursor: 'not-allowed'
                    }}
                    title={t('moderation.features.roles.reaction.form.messageIdTooltip')}
                  />
                  <small className="text-muted">{t('moderation.features.roles.reaction.form.messageIdReadOnly')}</small>
                </div>
              )}
            </div>

            {/* Custom Message - Always show for both add and edit */}
            <div className="mb-3">
              <label className="form-label small fw-semibold">{t('moderation.features.roles.reaction.form.customMessage')}</label>
              <textarea 
                className="form-control form-control-sm"
                rows={6}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={t('moderation.features.roles.reaction.form.customMessagePlaceholder')}
              />
              <small className="text-muted">
                {editingRole 
                  ? t('moderation.features.roles.reaction.form.customMessageHelp.editing')
                  : t('moderation.features.roles.reaction.form.customMessageHelp.creating')
                }
              </small>

            {/* Reactions Section */}
            <div className="mb-3">
              <label className="form-label small fw-semibold d-flex align-items-center gap-2">
                {t('moderation.features.roles.reaction.form.reactions')}
                <span className="badge badge-soft">{formData.reactions.length}</span>
              </label>
              
              {formData.reactions.map((reaction, index) => (
                <div key={index} className="reaction-row d-flex align-items-center gap-2 mb-2 p-2 rounded border">
                  <div className="flex-grow-1">
                    <label className="small text-muted">{t('moderation.features.roles.reaction.form.emoji')}</label>
                    <div className="input-group">
                      <span className="input-group-text bg-dark border-secondary p-1" style={{ minWidth: '40px', justifyContent: 'center' }}>
                        <span 
                          style={{ fontSize: '1.1rem' }}
                          dangerouslySetInnerHTML={{ __html: getEmojiDisplay(reaction.emoji) }}
                        />
                      </span>
                      <input 
                        type="text"
                        className="form-control form-control-sm"
                        placeholder={t('moderation.features.roles.reaction.form.emojiPlaceholder')}
                        value={reaction.emoji}
                        onChange={(e) => updateReaction(index, 'emoji', e.target.value)}
                      />
                      <button 
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => {
                          setCurrentEmojiIndex(index);
                          setShowEmojiPicker(true);
                        }}
                        title={t('moderation.features.roles.reaction.emojiPicker.title')}
                      >
                        <i className="fa-solid fa-smile"></i>
                      </button>
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <label className="small text-muted">{t('moderation.features.roles.reaction.form.role')}</label>
                    <select 
                      className="form-select form-select-sm"
                      value={reaction.roleId}
                      onChange={(e) => updateReaction(index, 'roleId', e.target.value)}
                    >
                      <option value="">{t('moderation.features.roles.reaction.form.rolePlaceholder')}</option>
                      {roles.filter(role => !role.managed && role.name !== '@everyone').map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="small text-muted">{t('moderation.features.roles.reaction.form.type')}</label>
                    <select 
                      className="form-select form-select-sm"
                      value={reaction.type || 'toggle'}
                      onChange={(e) => updateReaction(index, 'type', e.target.value)}
                    >
                      <option value="toggle">{t('moderation.features.roles.reaction.form.typeOptions.toggle')}</option>
                      <option value="add_only">{t('moderation.features.roles.reaction.form.typeOptions.add_only')}</option>
                      <option value="remove_only">{t('moderation.features.roles.reaction.form.typeOptions.remove_only')}</option>
                    </select>
                  </div>
                  <div className="pt-3">
                    <button 
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => removeReaction(index)}
                      disabled={formData.reactions.length === 1}
                      title={formData.reactions.length === 1 ? t('moderation.features.roles.reaction.buttons.removeReactionDisabled') : t('moderation.features.roles.reaction.buttons.removeReaction')}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
              
              <button 
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={addReaction}
              >
                <i className="fa-solid fa-plus me-2"></i>
                {t('moderation.features.roles.reaction.buttons.addReaction')}
              </button>
            </div>

            {/* Message Preview with Multiple Reactions */}
              <div className="preview-label">{t('settings.preview.title')}</div>
              <div className="template-preview mt-2">
                <div className="preview-body">
                  <div style={{ marginBottom: '8px' }}>
                    {customMessage || t('moderation.features.roles.reaction.form.customMessagePlaceholder')}
                  </div>
                  {formData.reactions.map((reaction, index) => (
                    <div key={index} className="d-flex align-items-center gap-2 mb-1">
                      <span 
                        style={{ fontSize: '1.2rem' }}
                        dangerouslySetInnerHTML={{ __html: getEmojiDisplay(reaction.emoji) }}
                      />
                      <span>→</span>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {reaction.roleId ? getRoleName(reaction.roleId) : t('moderation.features.roles.reaction.form.previewSelectRole')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card Footer with Action Buttons */}
            <div className="card-footer d-flex justify-content-end gap-2" style={{ backgroundColor: 'transparent', borderTop: 'none' }}>
              {hasChanges() && (
                <button 
                  type="button" 
                  className="btn btn-outline-warning btn-sm"
                  onClick={resetForm}
                  disabled={saving}
                >
                  <i className="fa-solid fa-rotate-left me-1"></i>
                  {t('common.reset')}
                </button>
              )}
              
              <button 
                type="button" 
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingRole(null);
                  resetForm();
                }}
                disabled={saving}
              >
                <i className="fa-solid fa-times me-1"></i>
                {t('common.cancel')}
              </button>

              <button 
                type="button"
                className="btn btn-primary btn-sm"
                onClick={editingRole ? handleUpdateReactionRole : handleAddReactionRole}
                disabled={saving || !formData.title || !formData.channelId || !formData.reactions.some(r => r.emoji && r.roleId)}
              >
                {saving ? (
                  <>
                    <div className="spinner-border spinner-border-sm me-1" role="status">
                      <span className="visually-hidden">{t('common.loading')}</span>
                    </div>
                    {editingRole ? t('common.updating') : t('common.creating')}
                  </>
                ) : (
                  <>
                    <i className={`fa-solid ${editingRole ? 'fa-save' : 'fa-plus'} me-1`}></i>
                    {editingRole ? t('common.update') : t('common.create')}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Emoji Picker Modal */}
      {showEmojiPicker && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content bg-dark text-light" ref={emojiPickerRef}>
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fa-solid fa-smile me-2"></i>
                  {t('moderation.features.roles.reaction.emojiPicker.title')}
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setShowEmojiPicker(false);
                    setCurrentEmojiIndex(null);
                  }} 
                />
              </div>
              <div className="modal-body">
                {guildEmojis.length > 0 && (
                  <>
                    <h6 className="mb-3">
                      <i className="fa-solid fa-server me-2"></i>
                      {t('moderation.features.roles.reaction.emojiPicker.serverEmojis')}
                    </h6>
                    <div className="row g-2 mb-4">
                      {guildEmojis.map(emoji => (
                        <div key={emoji.id} className="col-auto">
                          <button
                            type="button"
                            className="btn btn-outline-light btn-sm p-2"
                            onClick={() => {
                              if (currentEmojiIndex !== null) {
                                updateReaction(currentEmojiIndex, 'emoji', `<:${emoji.name}:${emoji.id}>`);
                              }
                              setShowEmojiPicker(false);
                              setCurrentEmojiIndex(null);
                            }}
                            title={emoji.name}
                            style={{ width: '48px', height: '48px' }}
                          >
                            <img 
                              src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`}
                              alt={emoji.name}
                              style={{ width: '24px', height: '24px' }}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <h6 className="mb-3">
                  <i className="fa-solid fa-globe me-2"></i>
                  {t('moderation.features.roles.reaction.emojiPicker.commonEmojis')}
                </h6>
                <div className="row g-2">
                  {['👍', '👎', '❤️', '🎉', '😊', '😢', '😡', '🔥', '💯', '✅', '❌', '⭐', '🎮', '🎵', '📚', '💰', '🏆', '🎯', '🚀', '💎'].map(emoji => (
                    <div key={emoji} className="col-auto">
                      <button
                        type="button"
                        className="btn btn-outline-light btn-sm p-2"
                        onClick={() => {
                          if (currentEmojiIndex !== null) {
                            updateReaction(currentEmojiIndex, 'emoji', emoji);
                          }
                          setShowEmojiPicker(false);
                          setCurrentEmojiIndex(null);
                        }}
                        style={{ width: '48px', height: '48px', fontSize: '1.5rem' }}
                      >
                        {emoji}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowEmojiPicker(false);
                    setCurrentEmojiIndex(null);
                  }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        show={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
        }}
        onConfirm={() => handleDeleteReactionRole(deleteTarget?.messageId)}
        isDeleting={deleting}
    title={t('moderation.features.roles.reaction.delete.title')}
    message={t('moderation.features.roles.reaction.delete.message', { title: deleteTarget?.title || t('common.unknown') })}
    warningMessage={t('moderation.features.roles.reaction.delete.warning')}
        itemDetails={deleteTarget && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
      <span className="text-muted">{t('moderation.features.roles.table.title')}:</span>
      <span className="fw-semibold">{deleteTarget.title || t('common.unknown')}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-2">
      <span className="text-muted">{t('moderation.features.roles.table.channel')}:</span>
              <span>{getChannelName(deleteTarget.channelId)}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-2">
      <span className="text-muted">{t('moderation.features.roles.table.reactions')}:</span>
              <span className="badge bg-info">{deleteTarget.reactions?.length || 0}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center">
      <span className="text-muted">{t('moderation.features.roles.reaction.form.messageId')}:</span>
              <code className="small">{deleteTarget.messageId}</code>
            </div>
          </div>
        )}
    confirmButtonText={t('moderation.features.roles.reaction.delete.confirm')}
    cancelButtonText={t('common.cancel')}
      />
    </div>
  );
}
