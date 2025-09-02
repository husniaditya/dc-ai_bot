import React, { useState } from 'react';
import { ChannelSelector, FormField } from '../components/SharedComponents';

// Scheduled Messages Configuration
export default function SchedulerConfigForm({ config, updateConfig, channels }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    channelId: '',
    message: '',
    cronExpression: '',
    enabled: true
  });

  const scheduledMessages = config.messages || [];

  const resetForm = () => {
    setFormData({
      title: '',
      channelId: '',
      message: '',
      cronExpression: '',
      enabled: true
    });
    setEditingMessage(null);
  };

  const addMessage = () => {
    if (!formData.title || !formData.channelId || !formData.message || !formData.cronExpression) {
      return;
    }

    const newMessage = {
      id: Date.now().toString(),
      ...formData
    };

    const newMessages = [...scheduledMessages, newMessage];
    updateConfig('messages', newMessages);
    resetForm();
    setShowAddForm(false);
  };

  const updateMessage = () => {
    if (!editingMessage || !formData.title || !formData.channelId || !formData.message || !formData.cronExpression) {
      return;
    }

    const newMessages = scheduledMessages.map(msg => 
      msg.id === editingMessage.id ? { ...editingMessage, ...formData } : msg
    );
    updateConfig('messages', newMessages);
    resetForm();
    setShowAddForm(false);
  };

  const deleteMessage = (messageId) => {
    const newMessages = scheduledMessages.filter(msg => msg.id !== messageId);
    updateConfig('messages', newMessages);
  };

  const startEdit = (message) => {
    setEditingMessage(message);
    setFormData({ ...message });
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
  ];

  return (
    <div className="moderation-config-form space-y-4">
      {/* Information Section */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">Scheduled Messages System</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-calendar-clock me-1"></i>
            Automated Announcements
          </span>
        </div>
        <p className="text-muted small mb-0" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
          Schedule recurring messages and announcements using cron expressions. Perfect for daily reminders, 
          weekly events, monthly updates, or any time-based automated communication.
        </p>
      </div>
      <hr />

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h6 className="mb-1">Scheduled Messages</h6>
          <p className="text-muted small mb-0">
            Schedule announcements and recurring messages
          </p>
        </div>
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
        >
          <i className="fa-solid fa-plus me-2" />
          Add Scheduled Message
        </button>
      </div>

      {/* Existing Scheduled Messages */}
      {scheduledMessages.length > 0 ? (
        <div className="scheduled-messages mb-4">
          {scheduledMessages.map(message => (
            <div key={message.id} className="scheduled-message mb-3 p-3 border rounded">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="flex-grow-1">
                  <h6 className="mb-1 d-flex align-items-center gap-2">
                    {message.title}
                    <span className={`badge ${message.enabled ? 'bg-success' : 'bg-secondary'}`}>
                      {message.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </h6>
                  <p className="text-muted small mb-1">{getChannelName(message.channelId)}</p>
                  <p className="small mb-1">{message.message}</p>
                  <div className="small text-muted">
                    <i className="fa-solid fa-clock me-1" />
                    Schedule: <code>{message.cronExpression}</code>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button 
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => startEdit(message)}
                  >
                    <i className="fa-solid fa-edit" />
                  </button>
                  <button 
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => deleteMessage(message.id)}
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted">
          <i className="fa-solid fa-calendar-days fa-2x mb-3 d-block opacity-50" />
          <p>No scheduled messages configured</p>
          <p className="small">Create your first scheduled message to automate announcements</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="add-form border rounded p-4 mb-4 bg-dark">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0">{editingMessage ? 'Edit' : 'Add'} Scheduled Message</h6>
            <button 
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
            >
              <i className="fa-solid fa-times" />
            </button>
          </div>

          <div className="row">
            <div className="col-md-6">
              <FormField label="Title" required>
                <input 
                  type="text"
                  className="form-control form-control-sm"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Daily Announcement"
                />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Channel" required>
                <ChannelSelector
                  value={formData.channelId}
                  onChange={(value) => setFormData(prev => ({ ...prev, channelId: value }))}
                  channels={channels}
                  allowEmpty={false}
                />
              </FormField>
            </div>
          </div>

          <FormField label="Message" required>
            <textarea 
              className="form-control form-control-sm"
              rows={4}
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Your scheduled message content..."
            />
          </FormField>

          <FormField 
            label="Schedule (Cron Expression)" 
            required
            description="Use cron format: minute hour day month dayofweek"
          >
            <div className="mb-2">
              <input 
                type="text"
                className="form-control form-control-sm"
                value={formData.cronExpression}
                onChange={(e) => setFormData(prev => ({ ...prev, cronExpression: e.target.value }))}
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
                  onClick={() => setFormData(prev => ({ ...prev, cronExpression: preset.value }))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </FormField>

          <div className="form-check form-switch mb-3">
            <input 
              id="scheduler-enabled"
              className="form-check-input" 
              type="checkbox" 
              checked={formData.enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            <label htmlFor="scheduler-enabled" className="form-check-label small fw-semibold">
              Enable this scheduled message
            </label>
          </div>

          <div className="d-flex gap-2">
            <button 
              className="btn btn-primary"
              onClick={editingMessage ? updateMessage : addMessage}
              disabled={!formData.title || !formData.channelId || !formData.message || !formData.cronExpression}
            >
              <i className={`fa-solid ${editingMessage ? 'fa-save' : 'fa-plus'} me-2`} />
              {editingMessage ? 'Update' : 'Add'} Scheduled Message
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
