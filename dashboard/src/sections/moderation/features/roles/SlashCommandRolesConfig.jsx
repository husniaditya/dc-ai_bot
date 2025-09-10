import React, { useState, useEffect } from 'react';
import { FormField, SwitchToggle } from '../../components/SharedComponents';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import useResponsiveTable from '../../../../hooks/useResponsiveTable';
import { useI18n } from '../../../../i18n';

// Slash Command Roles Configuration Component
export default function SlashCommandRolesConfig({ config, updateConfig, channels, roles, guildId, showToast }) {
  const [slashRoles, setSlashRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCommand, setEditingCommand] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [formData, setFormData] = useState({
    commandName: '',
    description: '',
    channelId: '',
    roles: [{ roleId: '', type: 'toggle' }],
    requirePermission: false,
    allowedRoles: [],
    status: true
  });
  const { t } = useI18n();

  // Use responsive table hook
  const tableRef = useResponsiveTable();

  // Fetch slash command roles when component mounts
  useEffect(() => {
    fetchSlashRoles();
  }, []);

  const fetchSlashRoles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/roles/guild/${guildId}/self-assignable-roles`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success && data.slashRoles) {
        setSlashRoles(data.slashRoles);
      }
    } catch (error) {
      console.error('Error fetching slash command roles:', error);
  showToast('error', t('moderation.features.roles.slash.toasts.fetchFailed'));
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      commandName: '',
      description: '',
      channelId: '',
      roles: [{ roleId: '', type: 'toggle' }],
      requirePermission: false,
      allowedRoles: [],
      status: true
    });
  };

  // Check if form has been modified
  const hasChanges = () => {
    const defaultData = {
      commandName: '',
      description: '',
      channelId: '',
      roles: [{ roleId: '', type: 'toggle' }],
      requirePermission: false,
      allowedRoles: [],
      status: true
    };
    
    return JSON.stringify(formData) !== JSON.stringify(defaultData);
  };

  const handleAddSlashRole = async () => {
    setSaving(true);
    try {
      const payload = { 
        guildId, 
        commandName: formData.commandName,
        description: formData.description,
        channelId: formData.channelId || null,
        roles: formData.roles,
        requirePermission: formData.requirePermission,
        allowedRoles: formData.allowedRoles,
        status: formData.status
      };
      
      const isEditing = editingCommand !== null;
      const url = isEditing 
        ? `/api/roles/guild/${guildId}/self-assignable-roles/${encodeURIComponent(editingCommand.commandName)}`
        : `/api/roles/guild/${guildId}/self-assignable-roles`;
      
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowAddForm(false);
        setEditingCommand(null);
        resetForm();
        fetchSlashRoles();
        showToast('success', isEditing 
          ? t('moderation.features.roles.slash.toasts.updated')
          : t('moderation.features.roles.slash.toasts.created'));
      } else {
        const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
        console.error('Failed to save slash command:', {
          isEditing,
          originalCommandName: editingCommand?.commandName,
          newCommandName: formData.commandName,
          url,
          payload,
          errorData
        });
        showToast('error', errorData.message || t('common.error'));
      }
    } catch (error) {
      console.error('Error saving slash command role:', error);
      showToast('error', t('common.error'));
    }
    setSaving(false);
  };

  const handleToggleStatus = async (commandName, currentStatus) => {
    setUpdatingStatus(prev => ({ ...prev, [commandName]: true }));
    
    try {
      const response = await fetch(`/api/roles/guild/${guildId}/self-assignable-roles/${encodeURIComponent(commandName)}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: !currentStatus })
      });

      if (response.ok) {
        // Update local state instead of refetching all data
        setSlashRoles(prev => prev.map(command => 
          command.commandName === commandName 
            ? { ...command, status: !currentStatus ? 1 : 0 }
            : command
        ));
        showToast('success', !currentStatus 
          ? t('moderation.features.roles.slash.toasts.statusEnabled')
          : t('moderation.features.roles.slash.toasts.statusDisabled'));
      } else {
        const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        console.error('Toggle failed:', errorData);
        showToast('error', errorData.message || t('moderation.features.roles.slash.toasts.toggleFailed'));
      }
    } catch (error) {
      console.error('Error toggling command status:', error);
      showToast('error', t('moderation.features.roles.slash.toasts.toggleFailed'));
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [commandName]: false }));
    }
  };

  const handleDeleteCommand = async (commandName) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/roles/guild/${guildId}/self-assignable-roles/${encodeURIComponent(commandName)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        fetchSlashRoles();
        showToast('success', t('moderation.features.roles.slash.toasts.deleteSuccess'));
      } else {
        const errorData = await response.json();
        showToast('error', errorData.message || t('moderation.features.roles.slash.toasts.deleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting command:', error);
      showToast('error', t('moderation.features.roles.slash.toasts.deleteFailed'));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const confirmDelete = (command) => {
    setDeleteTarget(command);
    setShowDeleteConfirm(true);
  };

  const handleEditCommand = (command) => {
    setEditingCommand(command);
    setFormData({
      commandName: command.commandName,
      description: command.description,
      channelId: command.channelId || '',
      roles: command.roles || [{ roleId: '', type: 'toggle' }],
      requirePermission: command.requirePermission || false,
      allowedRoles: command.allowedRoles || [],
      status: Boolean(command.status)
    });
    setShowAddForm(true);
  };

  const addRole = () => {
    setFormData(prev => ({
      ...prev,
      roles: [...prev.roles, { roleId: '', type: 'toggle' }]
    }));
  };

  const removeRole = (index) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.filter((_, i) => i !== index)
    }));
  };

  const updateRole = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.map((role, i) => 
        i === index ? { ...role, [field]: value } : role
      )
    }));
  };

  const getChannelName = (channelId) => {
    const channel = channels.find(ch => ch.id === channelId);
  return channel ? `#${channel.name}` : t('common.unknown');
  };

  const availableRoles = roles.filter(role => 
    !role.managed && 
    role.name !== '@everyone' &&
    role.id !== roles.find(r => r.name === '@everyone')?.id
  );

  return (
    <div className="slash-command-roles-config">
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div>
            <h6 className="mb-1">{t('moderation.features.roles.slash.header')}</h6>
            <p className="text-muted small mb-0">{t('moderation.features.roles.slash.subtitle')}</p>
          </div>
          <button 
            type="button" 
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingCommand(null);
              setShowAddForm(true);
              resetForm();
            }}
          >
            <i className="fa-solid fa-plus me-1"></i>
            {t('moderation.features.roles.slash.buttons.add')}
          </button>
        </div>

        {/* Information Section */}
        {slashRoles.length > 0 && (
          <div className="mb-4 p-3 bg-dark border rounded">
            <h6 className="mb-2">
              <i className="fa-solid fa-info-circle text-info me-2" />
              {t('moderation.features.roles.slash.info.title')}
            </h6>
            <div className="small text-muted">
              <p className="mb-2">{t('moderation.features.roles.slash.info.description')}</p>
              <div className="mb-2">
                <strong>{t('moderation.features.roles.slash.info.types.title')}</strong>
              </div>
              <ul className="mb-0">
                <li>{t('moderation.features.roles.slash.info.types.toggle')}</li>
                <li>{t('moderation.features.roles.slash.info.types.add')}</li>
                <li>{t('moderation.features.roles.slash.info.types.remove')}</li>
              </ul>
            </div>
          </div>
        )}

        {/* Slash Command Roles Table */}
        {loading ? (
          <div className="text-center py-3">
            <i className="fa-solid fa-spinner fa-spin me-2"></i>
            {t('moderation.features.roles.slash.loading')}
          </div>
        ) : slashRoles.length > 0 ? (
          <div ref={tableRef} className="table-responsive-scroll mb-4">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{t('moderation.features.roles.table.status')}</th>
                  <th>{t('moderation.features.roles.table.title')}</th>
                  <th>{t('common.description')}</th>
                  <th>{t('moderation.features.roles.table.channel')}</th>
                  <th>{t('moderation.features.roles.table.roles')}</th>
                  <th>{t('moderation.features.roles.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {slashRoles.map((command, index) => (
                  <tr key={command.id || index}>
                    <td>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={Boolean(command.status)}
                          disabled={updatingStatus[command.commandName]}
                          onChange={() => handleToggleStatus(command.commandName, command.status)}
                          id={`status-${index}`}
                          style={{ cursor: updatingStatus[command.commandName] ? 'not-allowed' : 'pointer' }}
                        />
                      </div>
                    </td>
                    <td>
                      <code className="mobile-truncate">{command.commandName}</code>
                    </td>
                    <td>
                      <span className="tablet-truncate desc-text">{command.description}</span>
                    </td>
                    <td>
                      <span className="mobile-truncate channel-text">
                        {command.channelId ? getChannelName(command.channelId) : t('moderation.features.roles.slash.anyChannel')}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {command.roles?.map((role, roleIndex) => {
                          const roleInfo = roles.find(r => r.id === role.roleId);
                          return roleInfo ? (
                            <span 
                              key={roleIndex} 
                              className="badge bg-secondary small"
                              style={{ fontSize: '0.7rem' }}
                            >
                              {roleInfo.name} ({role.type})
                            </span>
                          ) : null;
                        })}
                      </div>
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button 
                          type="button" 
                          className="btn btn-outline-info btn-sm"
                          onClick={() => handleEditCommand(command)}
                          title={t('common.edit')}
                        >
                          <i className="fa-solid fa-edit"></i>
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => confirmDelete(command)}
                          title={t('common.delete')}
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
        ) : (
          <div className="text-center py-4 text-muted mb-4">
            <i className="fa-solid fa-terminal fa-2x mb-3 d-block opacity-50" />
            <p>{t('moderation.features.roles.slash.empty')}</p>
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="card mb-3 position-relative" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
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
                    {editingCommand ? 'Updating slash command...' : 'Creating slash command...'}
                  </div>
                </div>
              </div>
            )}

            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">{editingCommand ? t('moderation.features.roles.slash.form.editTitle') : t('moderation.features.roles.slash.form.addTitle')}</h6>
              <button 
                type="button" 
                className="btn-close btn-close-white"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingCommand(null);
                  resetForm();
                }}
              />
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label small fw-semibold">{t('moderation.features.roles.slash.form.title')}</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm"
                    value={formData.commandName}
                    onChange={(e) => setFormData(prev => ({ ...prev, commandName: e.target.value }))}
                    placeholder={t('moderation.features.roles.slash.form.titlePlaceholder')}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label small fw-semibold">{t('moderation.features.roles.slash.form.description')}</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('moderation.features.roles.slash.form.descriptionPlaceholder')}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">{t('moderation.features.roles.slash.form.channel')}</label>
                <select 
                  className="form-select form-select-sm"
                  value={formData.channelId}
                  onChange={(e) => setFormData(prev => ({ ...prev, channelId: e.target.value }))}
                >
                  <option value="">{t('moderation.features.roles.slash.form.channelPlaceholder')}</option>
                  {channels.filter(ch => ch.type === 0).map(channel => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label small fw-semibold mb-0">{t('moderation.features.roles.slash.form.roles')}</label>
                  <button 
                    type="button" 
                    className="btn btn-outline-light btn-sm"
                    onClick={addRole}
                  >
                    <i className="fa-solid fa-plus me-1"></i>
                    {t('moderation.features.roles.slash.buttons.addRole')}
                  </button>
                </div>
                
                {formData.roles.map((role, index) => (
                  <div key={index} className="d-flex gap-2 mb-2">
                    <select 
                      className="form-select form-select-sm"
                      value={role.roleId}
                      onChange={(e) => updateRole(index, 'roleId', e.target.value)}
                    >
                      <option value="">{t('moderation.features.roles.slash.form.selectRole')}</option>
                      {availableRoles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <select 
                      className="form-select form-select-sm"
                      value={role.type}
                      onChange={(e) => updateRole(index, 'type', e.target.value)}
                    >
                      <option value="toggle">{t('moderation.features.roles.slash.form.typeOptions.toggle')}</option>
                      <option value="add">{t('moderation.features.roles.slash.form.typeOptions.add')}</option>
                      <option value="remove">{t('moderation.features.roles.slash.form.typeOptions.remove')}</option>
                    </select>
                    <button 
                      type="button" 
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => removeRole(index)}
                      disabled={formData.roles.length === 1}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>

              <div className="mb-3">
                <div className="form-check form-switch">
                  <input 
                    className="form-check-input" 
                    type="checkbox"
                    checked={formData.requirePermission}
                    onChange={(e) => setFormData(prev => ({ ...prev, requirePermission: e.target.checked }))}
                    id="require-permission"
                  />
                  <label className="form-check-label small fw-semibold" htmlFor="require-permission">
                    {t('moderation.features.roles.slash.form.requirePermission')}
                  </label>
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2">
                {hasChanges() && (
                  <button 
                    type="button" 
                    className="btn btn-outline-warning btn-sm"
                    onClick={() => resetForm()}
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
                    setEditingCommand(null);
                    resetForm();
                  }}
                >
                  <i className="fa-solid fa-times me-1"></i>
                  {t('common.cancel')}
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm"
                  onClick={handleAddSlashRole}
                  disabled={saving || !formData.commandName || !formData.description}
                >
                  {saving ? (
                    <>
                      <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">{t('common.loading')}</span>
                      </div>
                      {editingCommand ? t('common.updating') : t('common.creating')}
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-save me-1"></i>
                      {editingCommand ? t('moderation.features.roles.slash.form.updateCommand') : t('moderation.features.roles.slash.form.createCommand')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        show={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
        }}
        onConfirm={() => handleDeleteCommand(deleteTarget?.commandName)}
        isDeleting={deleting}
    title={t('moderation.features.roles.slash.delete.title')}
    message={t('moderation.features.roles.slash.delete.message', { name: deleteTarget?.commandName || t('common.unknown') })}
    warningMessage={t('moderation.features.roles.slash.delete.warning')}
        itemDetails={deleteTarget && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
      <span className="text-muted">{t('moderation.features.roles.table.title')}:</span>
              <code className="fw-semibold">{deleteTarget.commandName}</code>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-2">
      <span className="text-muted">{t('common.description')}:</span>
              <span>{deleteTarget.description}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-2">
      <span className="text-muted">{t('moderation.features.roles.table.channel')}:</span>
      <span>{deleteTarget.channelId ? getChannelName(deleteTarget.channelId) : t('moderation.features.roles.slash.anyChannel')}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center">
      <span className="text-muted">{t('moderation.features.roles.table.roles')}:</span>
              <span className="badge bg-info">{deleteTarget.roles?.length || 0}</span>
            </div>
          </div>
        )}
    confirmButtonText={t('moderation.features.roles.slash.delete.confirm')}
    cancelButtonText={t('common.cancel')}
      />
    </div>
  );
}
