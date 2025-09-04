import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ChannelSelector, FormField } from '../components/SharedComponents';
import { createScheduledMessage, updateScheduledMessage, deleteScheduledMessage } from '../../../api';

// Delete Confirmation Component
function DeleteConfirmationModal({ show, onHide, onConfirm, message }) {
  if (!show) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fa-solid fa-triangle-exclamation text-warning me-2"></i>
              Confirm Deletion
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          <div className="modal-body">
            <p className="mb-0">{message}</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={onHide}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={onConfirm}>
              <i className="fa-solid fa-trash me-1"></i>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Scheduled Messages Configuration
export default forwardRef(function SchedulerConfigForm({ config, updateConfig, channels, guildId, showToast, onConfigSaved, onClose }, ref) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ show: false, messageId: null, messageTitle: '' });
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    channelId: '',
    message: '',
    scheduleType: 'cron',
    scheduleValue: '',
    embedData: null,
    useEmbed: false
  });

  const scheduledMessages = config.messages || [];

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    isDirty: () => showAddForm && isFormDirty
  }));

  const resetForm = () => {
    if (originalFormData) {
      setFormData(originalFormData);
    } else {
      setFormData({
        title: '',
        channelId: '',
        message: '',
        scheduleType: 'cron',
        scheduleValue: '',
        embedData: null,
        useEmbed: false
      });
    }
    setEditingMessage(null);
    setIsFormDirty(false);
  };

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setIsFormDirty(true);
  };

  const saveMessage = async () => {
    if (!formData.title || !formData.channelId || !formData.message || !formData.scheduleValue) {
      showToast?.('error', 'Please fill in all required fields');
      return;
    }

    const messageData = {
      title: formData.title,
      channelId: formData.channelId,
      message: formData.message,
      scheduleType: formData.scheduleType,
      scheduleValue: formData.scheduleValue,
      embedData: formData.useEmbed ? formData.embedData : null
    };

    try {
      let updatedMessage;
      
      if (editingMessage && editingMessage.id && !String(editingMessage.id).startsWith('temp_')) {
        // Update existing message (has a real database ID)
        updatedMessage = await updateScheduledMessage(editingMessage.id, messageData, guildId);
      } else {
        // Create new message
        updatedMessage = await createScheduledMessage(messageData, guildId);
      }

      // Update local config state with the response from backend
      let newMessages;
      if (editingMessage) {
        newMessages = scheduledMessages.map(msg => 
          msg.id === editingMessage.id ? updatedMessage.message : msg
        );
      } else {
        newMessages = [...scheduledMessages, updatedMessage.message];
      }
      
      updateConfig('messages', newMessages);
      
      // Notify parent that config has been saved - use the updated messages
      const newConfig = { ...config, messages: newMessages };
      onConfigSaved?.(newConfig);
      
      // Reset form state
      resetForm();
      setShowAddForm(false);
      
      // Show success message
      showToast?.('success', editingMessage ? 'Message updated successfully' : 'Message added successfully');
    } catch (error) {
      console.error('Failed to save scheduler message:', error);
      showToast?.('error', 'Failed to save message');
    }
  };

  const deleteMessage = (messageId) => {
    const message = scheduledMessages.find(msg => msg.id === messageId);
    setDeleteConfirmation({
      show: true,
      messageId: messageId,
      messageTitle: message?.title || 'Unknown Message'
    });
  };

  const confirmDelete = async () => {
    try {
      const messageToDelete = scheduledMessages.find(msg => msg.id === deleteConfirmation.messageId);
      
      // Only call API if this is a real database record (not a temporary frontend ID)
      if (messageToDelete && messageToDelete.id && !String(messageToDelete.id).startsWith('temp_')) {
        await deleteScheduledMessage(messageToDelete.id, guildId);
      }
      
      // Update local config state
      const newMessages = scheduledMessages.filter(msg => msg.id !== deleteConfirmation.messageId);
      updateConfig('messages', newMessages);
      
      // Notify parent that config has been saved
      const newConfig = { ...config, messages: newMessages };
      onConfigSaved?.(newConfig);
      
      setDeleteConfirmation({ show: false, messageId: null, messageTitle: '' });
      showToast?.('success', 'Scheduled message deleted successfully');
    } catch (error) {
      console.error('Failed to delete scheduler message:', error);
      showToast?.('error', 'Failed to delete message');
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation({ show: false, messageId: null, messageTitle: '' });
  };

  const startEdit = (message) => {
    setEditingMessage(message);
    const editFormData = {
      title: message.title,
      channelId: message.channelId,
      message: message.messageContent,
      scheduleType: message.scheduleType || 'cron',
      scheduleValue: message.scheduleValue,
      embedData: message.embedData || {
        title: '',
        description: '',
        color: '#5865F2',
        footer: '',
        thumbnail: '',
        image: ''
      },
      useEmbed: !!message.embedData
    };
    setFormData(editFormData);
    setOriginalFormData(editFormData); // Store original values for reset
    setIsFormDirty(false);
    setShowAddForm(true);
  };

  const startAdd = () => {
    const newFormData = {
      title: '',
      channelId: '',
      message: '',
      scheduleType: 'cron',
      scheduleValue: '',
      embedData: null,
      useEmbed: false
    };
    setFormData(newFormData);
    setOriginalFormData(newFormData); // Store original (empty) values for reset
    setEditingMessage(null);
    setIsFormDirty(false);
    setShowAddForm(true);
  };

  const getChannelName = (channelId) => {
    const channel = channels.find(c => c.id === channelId);
    return channel ? `#${channel.name}` : 'Unknown Channel';
  };

  const cronPresets = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every day at 9 AM', value: '0 9 * * *' },
    { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
    { label: 'Every week (Sunday 9 AM)', value: '0 9 * * 0' },
    { label: 'Every month (1st at 9 AM)', value: '0 9 1 * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Every weekday at 8 AM', value: '0 8 * * 1-5' }
  ];

  const scheduleTypes = [
    { value: 'once', label: 'Once (timestamp)' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'cron', label: 'Custom (Cron)' }
  ];

  const renderScheduleInput = () => {
    switch (formData.scheduleType) {
      case 'once':
        return (
          <input 
            type="datetime-local"
            className="form-control form-control-sm"
            value={formData.scheduleValue}
            onChange={(e) => updateFormData({ scheduleValue: e.target.value })}
            min={new Date().toISOString().slice(0, 16)}
          />
        );
      case 'daily':
        return (
          <input 
            type="time"
            className="form-control form-control-sm"
            value={formData.scheduleValue}
            onChange={(e) => setFormData(prev => ({ ...prev, scheduleValue: e.target.value }))}
          />
        );
      case 'weekly':
        return (
          <div className="row">
            <div className="col-6">
              <select 
                className="form-select form-select-sm"
                value={formData.scheduleValue.split(':')[0] || '0'}
                onChange={(e) => {
                  const time = formData.scheduleValue.split(':')[1] || '09:00';
                  setFormData(prev => ({ ...prev, scheduleValue: `${e.target.value}:${time}` }));
                }}
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            </div>
            <div className="col-6">
              <input 
                type="time"
                className="form-control form-control-sm"
                value={formData.scheduleValue.split(':')[1] || '09:00'}
                onChange={(e) => {
                  const day = formData.scheduleValue.split(':')[0] || '0';
                  setFormData(prev => ({ ...prev, scheduleValue: `${day}:${e.target.value}` }));
                }}
              />
            </div>
          </div>
        );
      case 'monthly':
        return (
          <div className="row">
            <div className="col-6">
              <input 
                type="number"
                className="form-control form-control-sm"
                min="1"
                max="31"
                placeholder="Day"
                value={formData.scheduleValue.split(':')[0] || '1'}
                onChange={(e) => {
                  const time = formData.scheduleValue.split(':')[1] || '09:00';
                  setFormData(prev => ({ ...prev, scheduleValue: `${e.target.value}:${time}` }));
                }}
              />
            </div>
            <div className="col-6">
              <input 
                type="time"
                className="form-control form-control-sm"
                value={formData.scheduleValue.split(':')[1] || '09:00'}
                onChange={(e) => {
                  const day = formData.scheduleValue.split(':')[0] || '1';
                  setFormData(prev => ({ ...prev, scheduleValue: `${day}:${e.target.value}` }));
                }}
              />
            </div>
          </div>
        );
      case 'cron':
      default:
        return (
          <>
            <div className="mb-2">
              <input 
                type="text"
                className="form-control form-control-sm"
                value={formData.scheduleValue}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduleValue: e.target.value }))}
                placeholder="0 9 * * *"
              />
            </div>
            <div className="small text-muted mb-2">Common presets:</div>
            <div className="d-flex flex-wrap gap-1">
              {cronPresets.map((preset, index) => (
                <button 
                  key={index}
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setFormData(prev => ({ ...prev, scheduleValue: preset.value }))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </>
        );
    }
  };

  return (
    <div className="moderation-config-form space-y-4">
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        show={deleteConfirmation.show}
        onHide={cancelDelete}
        onConfirm={confirmDelete}
        message={`Are you sure you want to delete the scheduled message "${deleteConfirmation.messageTitle}"? This action cannot be undone.`}
      />

      {/* Information Section */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">Scheduled Messages System</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-calendar-clock me-1"></i>
            Automated Announcements
          </span>
        </div>
        <p className="text-muted mb-0">
          Set up automated messages to be sent at specific times or intervals. Perfect for announcements, reminders, and recurring posts.
        </p>
      </div>

      {/* Existing Messages */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">Scheduled Messages ({scheduledMessages.length})</h6>
          <button
            className="btn btn-primary btn-sm"
            onClick={startAdd}
          >
            <i className="fa-solid fa-plus me-1"></i>
            Add Message
          </button>
        </div>

        {scheduledMessages.length === 0 ? (
          <div className="text-center py-4 text-muted">
            <i className="fa-solid fa-calendar-xmark fs-1 mb-3 opacity-50"></i>
            <p>No scheduled messages configured</p>
            <p className="small">Click "Add Message" to create your first scheduled message</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledMessages.map((message) => (
              <div key={message.id} className="card card-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <h6 className="mb-0">{message.title}</h6>
                        <span className="badge badge-soft">
                          {message.scheduleType || 'cron'}
                        </span>
                        {message.embedData && (
                          <span className="badge badge-soft">
                            <i className="fa-solid fa-window-maximize me-1"></i>
                            Embed
                          </span>
                        )}
                      </div>
                      <p className="text-muted mb-2 small">
                        <i className="fa-solid fa-hashtag me-1"></i>
                        {getChannelName(message.channelId)}
                      </p>
                      <p className="mb-2">{message.messageContent}</p>
                      <div className="d-flex align-items-center gap-3 text-muted small">
                        <span>
                          <i className="fa-solid fa-clock me-1"></i>
                          Schedule: {message.scheduleValue}
                        </span>
                        <span className={`badge ${message.isActive ? 'badge-success' : 'badge-secondary'}`}>
                          {message.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="d-flex gap-1">
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => startEdit(message)}
                      >
                        <i className="fa-solid fa-edit"></i>
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => deleteMessage(message.id)}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">
              {editingMessage ? 'Edit Scheduled Message' : 'Add Scheduled Message'}
            </h6>
          </div>
          <div className="card-body">
            <form onSubmit={(e) => { e.preventDefault(); saveMessage(); }}>
              <div className="row mb-3">
                <div className="col-md-6">
                  <FormField label="Message Title" required>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.title}
                      onChange={(e) => updateFormData({ title: e.target.value })}
                      placeholder="Enter message title"
                    />
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField label="Channel" required>
                    <ChannelSelector
                      channels={channels}
                      value={formData.channelId}
                      onChange={(channelId) => updateFormData({ channelId })}
                      placeholder="Select channel"
                    />
                  </FormField>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <FormField label="Schedule Type" required>
                    <select
                      className="form-select form-select-sm"
                      value={formData.scheduleType}
                      onChange={(e) => updateFormData({ scheduleType: e.target.value, scheduleValue: '' })}
                    >
                      {scheduleTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField label="Schedule Value" required>
                    {renderScheduleInput()}
                  </FormField>
                </div>
              </div>

              <div className="mb-3">
                <FormField label="Message Content" required>
                  <textarea
                    className="form-control form-control-sm"
                    rows="4"
                    value={formData.message}
                    onChange={(e) => updateFormData({ message: e.target.value })}
                    placeholder="Enter your message content..."
                  />
                </FormField>
              </div>

              {/* Embed Toggle */}
              <div className="mb-3">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="useEmbed"
                    checked={formData.useEmbed}
                    onChange={(e) => {
                      const useEmbed = e.target.checked;
                      updateFormData({
                        useEmbed,
                        embedData: useEmbed ? (formData.embedData || {
                          title: '',
                          description: '',
                          color: '#5865F2',
                          footer: '',
                          thumbnail: '',
                          image: ''
                        }) : null
                      });
                    }}
                  />
                  <label className="form-check-label" htmlFor="useEmbed">
                    Use Discord Embed
                  </label>
                </div>
              </div>

              {/* Embed Configuration */}
              {formData.useEmbed && (
                <div className="border border-light rounded p-3 mb-3">
                  <h6 className="mb-3">Embed Configuration</h6>
                  
                  <div className="row mb-3">
                    <div className="col-md-8">
                      <FormField label="Embed Title">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.embedData?.title || ''}
                          onChange={(e) => updateFormData({
                            embedData: { ...formData.embedData, title: e.target.value }
                          })}
                          placeholder="Embed title"
                        />
                      </FormField>
                    </div>
                    <div className="col-md-4">
                      <FormField label="Color">
                        <input
                          type="color"
                          className="form-control form-control-color form-control-sm"
                          value={formData.embedData?.color || '#5865F2'}
                          onChange={(e) => updateFormData({
                            embedData: { ...formData.embedData, color: e.target.value }
                          })}
                        />
                      </FormField>
                    </div>
                  </div>

                  <div className="mb-3">
                    <FormField label="Description">
                      <textarea
                        className="form-control form-control-sm"
                        rows="3"
                        value={formData.embedData?.description || ''}
                        onChange={(e) => updateFormData({
                          embedData: { ...formData.embedData, description: e.target.value }
                        })}
                        placeholder="Embed description"
                      />
                    </FormField>
                  </div>

                  <div className="row mb-3">
                    <div className="col-md-6">
                      <FormField label="Footer Text">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.embedData?.footer || ''}
                          onChange={(e) => updateFormData({
                            embedData: { ...formData.embedData, footer: e.target.value }
                          })}
                          placeholder="Footer text"
                        />
                      </FormField>
                    </div>
                    <div className="col-md-6">
                      <FormField label="Thumbnail URL">
                        <input
                          type="url"
                          className="form-control form-control-sm"
                          value={formData.embedData?.thumbnail || ''}
                          onChange={(e) => updateFormData({
                            embedData: { ...formData.embedData, thumbnail: e.target.value }
                          })}
                          placeholder="https://example.com/image.png"
                        />
                      </FormField>
                    </div>
                  </div>

                  <div className="mb-3">
                    <FormField label="Image URL">
                      <input
                        type="url"
                        className="form-control form-control-sm"
                        value={formData.embedData?.image || ''}
                        onChange={(e) => updateFormData({
                          embedData: { ...formData.embedData, image: e.target.value }
                        })}
                        placeholder="https://example.com/image.png"
                      />
                    </FormField>
                  </div>
                </div>
              )}

              <div className="d-flex justify-content-end gap-2">
                {isFormDirty && (
                  <button
                    type="button"
                    className="btn btn-outline-warning btn-sm"
                    onClick={resetForm}
                  >
                    <i className="fa-solid fa-rotate-left me-1" />
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                >
                  <i className="fa-solid fa-times me-1" />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={!formData.title || !formData.channelId || !formData.message || !formData.scheduleValue}
                >
                  <i className="fa-solid fa-plus me-1" />
                  {editingMessage ? 'Update Message' : 'Add Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
