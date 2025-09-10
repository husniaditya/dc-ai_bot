import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ChannelSelector, FormField } from '../components/SharedComponents';
import { createScheduledMessage, updateScheduledMessage, deleteScheduledMessage, getScheduledMessages } from '../../../api';
import { useI18n } from '../../../i18n';
import LoadingOverlay from '../../../components/LoadingOverlay';

// Delete Confirmation Component
function DeleteConfirmationModal({ show, onHide, onConfirm, message }) {
  const { t } = useI18n();
  if (!show) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fa-solid fa-triangle-exclamation text-warning me-2"></i>
              {t('moderation.features.scheduler.delete.title')}
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          <div className="modal-body">
            <p className="mb-0">{message}</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={onHide}>
              {t('moderation.features.scheduler.delete.cancel')}
            </button>
            <button type="button" className="btn btn-danger" onClick={onConfirm}>
              <i className="fa-solid fa-trash me-1"></i>
              {t('moderation.features.scheduler.delete.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Scheduled Messages Configuration
// Integrates with guild settings for timezone and hour format (12h/24h)
export default forwardRef(function SchedulerConfigForm({ config, updateConfig, channels, guildId, settings, showToast, onConfigSaved, onClose }, ref) {
  const { t } = useI18n();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ show: false, messageId: null, messageTitle: '' });
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true for initial load
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    channelId: '',
    message: '',
    scheduleType: 'cron',
    scheduleValue: '',
    embedData: null,
    useEmbed: false
  });
  // Initialize time format from settings, fallback to 24h
  const [timeFormatMode, setTimeFormatMode] = useState(
    settings?.hourFormat === '12' ? '12h' : '24h'
  );
  
  // Update timeFormatMode when settings change
  useEffect(() => {
    if (settings?.hourFormat) {
      setTimeFormatMode(settings.hourFormat === '12' ? '12h' : '24h');
    }
  }, [settings?.hourFormat]);

  // Load messages when component mounts for the first time
  useEffect(() => {
    if (guildId) {
      loadScheduledMessages();
    }
  }, [guildId]);

  const loadScheduledMessages = async () => {
    if (!guildId) return;
    
    try {
      setIsLoading(true);
      const response = await getScheduledMessages(guildId);
      
      // Handle different possible API response structures
      let messages = [];
      if (Array.isArray(response)) {
        messages = response;
      } else if (response?.messages && Array.isArray(response.messages)) {
        messages = response.messages;
      } else if (response?.data && Array.isArray(response.data)) {
        messages = response.data;
      } else {
        console.warn('Unexpected API response structure:', response);
        messages = [];
      }
      
      // Ensure each message has the required properties with defaults
      const processedMessages = messages.map(msg => ({
        id: msg.id,
        title: msg.title || '',
        channelId: msg.channelId || msg.channel_id || '',
        messageContent: msg.messageContent || msg.message_content || msg.message || '',
        embedData: msg.embedData || msg.embed_data || null,
        scheduleType: msg.scheduleType || msg.schedule_type || 'cron',
        scheduleValue: msg.scheduleValue || msg.schedule_value || '',
        nextRun: msg.nextRun || msg.next_run || null,
        lastRun: msg.lastRun || msg.last_run || null,
        enabled: msg.enabled !== undefined ? Boolean(msg.enabled) : true,
        createdBy: msg.createdBy || msg.created_by || null,
        createdAt: msg.createdAt || msg.created_at || null,
        updatedAt: msg.updatedAt || msg.updated_at || null
      }));
      
      setScheduledMessages(processedMessages);
      
      // Update the parent config if provided for backward compatibility
      if (updateConfig) {
        updateConfig('messages', processedMessages);
      }
    } catch (error) {
      console.error('Failed to load scheduled messages:', error);
      showToast?.('error', t('moderation.features.scheduler.toasts.loadFailed'));
      setScheduledMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helpers for new pipe-based schedule formats (option 2)
  const parseWeekly = (value) => {
    if (!value) return { day: '0', time: '09:00' };
    const sep = value.includes('|') ? '|' : ':'; // backward compatibility
    const [day, time] = value.split(sep);
    return { day: day ?? '0', time: time ?? '09:00' };
  };

  const parseMonthly = (value) => {
    if (!value) return { day: '01', time: '09:00' };
    const sep = value.includes('|') ? '|' : ':'; // backward compatibility
    const [day, time] = value.split(sep);
    const dayNum = (day || '1').toString();
    const paddedDay = dayNum.padStart(2, '0');
    return { day: paddedDay, time: time ?? '09:00' };
  };

  const toWeeklyValue = (day, time) => `${day}|${time}`;
  const toMonthlyValue = (day, time) => `${day.toString().padStart(2, '0')}|${time}`;

  // Helpers for date construction when using date pickers
  const pad = (n) => n.toString().padStart(2, '0');

  const parseDaily = (value) => {
    if (!value || !/^[0-2]?\d:[0-5]\d$/.test(value)) return { hour: '09', minute: '00' };
    const [h, m] = value.split(':');
    return { hour: pad(h), minute: pad(m) };
  };

  const buildDateFromHM = (hour, minute) => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
    
    // If settings timezone is provided, adjust the date to that timezone
    if (settings?.timezone) {
      // Create date in the user's preferred timezone
      try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: settings.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        
        const parts = formatter.formatToParts(d);
        const year = parseInt(parts.find(p => p.type === 'year').value);
        const month = parseInt(parts.find(p => p.type === 'month').value) - 1;
        const day = parseInt(parts.find(p => p.type === 'day').value);
        
        return new Date(year, month, day, parseInt(hour, 10), parseInt(minute, 10), 0, 0);
      } catch (error) {
        console.warn('Invalid timezone in settings, using local time:', settings.timezone);
      }
    }
    
    return d;
  };

  const getWeeklyDate = (day, time) => {
    const { hour, minute } = parseDaily(time);
    let now = new Date();
    
    // If settings timezone is provided, get current time in that timezone
    if (settings?.timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: settings.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          weekday: 'numeric'
        });
        
        const parts = formatter.formatToParts(now);
        const year = parseInt(parts.find(p => p.type === 'year').value);
        const month = parseInt(parts.find(p => p.type === 'month').value) - 1;
        const dayNum = parseInt(parts.find(p => p.type === 'day').value);
        
        now = new Date(year, month, dayNum);
      } catch (error) {
        console.warn('Invalid timezone in settings, using local time:', settings.timezone);
      }
    }
    
    const target = new Date(now);
    const currentDow = now.getDay();
    let diff = parseInt(day, 10) - currentDow;
    if (diff < 0) diff += 7; // upcoming occurrence
    target.setDate(now.getDate() + diff);
    target.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
    return target;
  };

  const getMonthlyDate = (day, time) => {
    const { hour, minute } = parseDaily(time);
    let now = new Date();
    
    // If settings timezone is provided, get current time in that timezone
    if (settings?.timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: settings.timezone,
          year: 'numeric',
          month: '2-digit'
        });
        
        const parts = formatter.formatToParts(now);
        const year = parseInt(parts.find(p => p.type === 'year').value);
        const month = parseInt(parts.find(p => p.type === 'month').value) - 1;
        
        const target = new Date(year, month, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), 0, 0);
        return target;
      } catch (error) {
        console.warn('Invalid timezone in settings, using local time:', settings.timezone);
      }
    }
    
    const target = new Date(now.getFullYear(), now.getMonth(), parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), 0, 0);
    // If date already passed this month, keep it (only used for picking), user can re-pick
    return target;
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    isDirty: () => showAddForm && isFormDirty,
    getMessages: () => scheduledMessages,
    refresh: () => loadScheduledMessages()
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
    // Don't clear editingMessage when resetting - keep the editing state
    // setEditingMessage(null); // Removed this line
    setIsFormDirty(false);
  };

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setIsFormDirty(true);
  };

  const saveMessage = async () => {
    if (!formData.title || !formData.channelId || !formData.message || !formData.scheduleValue) {
      showToast?.('error', t('moderation.features.scheduler.toasts.validationRequired'));
      return;
    }

    // Calculate if the scheduled message should be enabled based on timing
    const calculateEnabled = () => {
      const now = new Date();
      
      switch (formData.scheduleType) {
        case 'once': {
          // For one-time messages, check if scheduled time is in the future
          const scheduledDate = new Date(formData.scheduleValue);
          return scheduledDate > now;
        }
        case 'daily': {
          // For daily messages, always enable (they repeat daily)
          return true;
        }
        case 'weekly': {
          // For weekly messages, always enable (they repeat weekly) 
          return true;
        }
        case 'monthly': {
          // For monthly messages, always enable (they repeat monthly)
          return true;
        }
        case 'cron': {
          // For cron expressions, always enable (they are recurring)
          return true;
        }
        default:
          return true;
      }
    };

    const messageData = {
      title: formData.title,
      channelId: formData.channelId,
      message: formData.message,
      scheduleType: formData.scheduleType,
      scheduleValue: formData.scheduleValue,
      embedData: formData.useEmbed ? formData.embedData : null,
      enabled: calculateEnabled() ? 1 : 0 // Store as integer: 1 for enabled, 0 for disabled
    };

    try {
      let response;
      
      if (editingMessage && editingMessage.id && !String(editingMessage.id).startsWith('temp_')) {
        // Update existing message (has a real database ID)
        response = await updateScheduledMessage(editingMessage.id, messageData, guildId);
      } else {
        // Create new message
        response = await createScheduledMessage(messageData, guildId);
      }

      // Refresh the messages from the database to ensure we have the latest data
      await loadScheduledMessages();
      
      // Notify parent that config has been saved
      onConfigSaved?.(scheduledMessages);
      
      // Reset form state and clear editing state
      setEditingMessage(null); // Clear editing state after successful save
      resetForm();
      setShowAddForm(false);
      
      // Show success message
      showToast?.('success', editingMessage ? t('moderation.features.scheduler.toasts.savedUpdated') : t('moderation.features.scheduler.toasts.savedAdded'));
    } catch (error) {
      console.error('Failed to save scheduler message:', error);
      showToast?.('error', t('moderation.features.scheduler.toasts.saveFailed'));
    }
  };

  const deleteMessage = (messageId) => {
    const message = scheduledMessages.find(msg => msg.id === messageId);
    setDeleteConfirmation({
      show: true,
      messageId: messageId,
  messageTitle: message?.title || t('common.unknown')
    });
  };

  const confirmDelete = async () => {
    try {
      const messageToDelete = scheduledMessages.find(msg => msg.id === deleteConfirmation.messageId);
      
      // Only call API if this is a real database record (not a temporary frontend ID)
      if (messageToDelete && messageToDelete.id && !String(messageToDelete.id).startsWith('temp_')) {
        await deleteScheduledMessage(messageToDelete.id, guildId);
      }
      
      // Refresh the messages from the database to ensure we have the latest data
      await loadScheduledMessages();
      
      // Notify parent that config has been saved
      onConfigSaved?.(scheduledMessages);
      
      setDeleteConfirmation({ show: false, messageId: null, messageTitle: '' });
      showToast?.('success', t('moderation.features.scheduler.toasts.deleted'));
    } catch (error) {
      console.error('Failed to delete scheduler message:', error);
      showToast?.('error', t('moderation.features.scheduler.toasts.deleteFailed'));
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
    // Migrate legacy colon format to pipe for weekly/monthly
    if (editFormData.scheduleType === 'weekly') {
      const { day, time } = parseWeekly(editFormData.scheduleValue);
      editFormData.scheduleValue = toWeeklyValue(day, time);
    }
    if (editFormData.scheduleType === 'monthly') {
      const { day, time } = parseMonthly(editFormData.scheduleValue);
      editFormData.scheduleValue = toMonthlyValue(day, time);
    }
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
    return channel ? `#${channel.name}` : t('moderation.features.scheduler.unknownChannel');
  };
  const cronPresets = [
    { label: t('moderation.features.scheduler.form.pickers.cron.presets.everyHour'), value: '0 * * * *' },
    { label: t('moderation.features.scheduler.form.pickers.cron.presets.everyDay9'), value: '0 9 * * *' },
    { label: t('moderation.features.scheduler.form.pickers.cron.presets.everyMonday9'), value: '0 9 * * 1' },
    { label: t('moderation.features.scheduler.form.pickers.cron.presets.everySunday9'), value: '0 9 * * 0' },
    { label: t('moderation.features.scheduler.form.pickers.cron.presets.everyMonthFirst9'), value: '0 9 1 * *' },
    { label: t('moderation.features.scheduler.form.pickers.cron.presets.every6Hours'), value: '0 */6 * * *' },
    { label: t('moderation.features.scheduler.form.pickers.cron.presets.everyWeekday8'), value: '0 8 * * 1-5' }
  ];

  const scheduleTypes = [
    { value: 'once', label: t('moderation.features.scheduler.form.scheduleTypes.once') },
    { value: 'daily', label: t('moderation.features.scheduler.form.scheduleTypes.daily') },
    { value: 'weekly', label: t('moderation.features.scheduler.form.scheduleTypes.weekly') },
    { value: 'monthly', label: t('moderation.features.scheduler.form.scheduleTypes.monthly') },
    { value: 'cron', label: t('moderation.features.scheduler.form.scheduleTypes.cron') }
  ];

  const renderScheduleInput = () => {
    const is12h = timeFormatMode === '12h';
    const onceDateFormat = is12h ? 'yyyy-MM-dd h:mm aa' : 'yyyy-MM-dd HH:mm';
    const dailyDateFormat = is12h ? 'h:mm aa' : 'HH:mm';
    const weeklyDateFormat = is12h ? 'EEEE h:mm aa' : 'EEEE HH:mm';
    const monthlyDateFormat = is12h ? 'd MMM h:mm aa' : 'd MMM HH:mm';
    switch (formData.scheduleType) {
      case 'once':
        return (
          <DatePicker
            selected={formData.scheduleValue ? new Date(formData.scheduleValue) : null}
            onChange={(date) => {
              if (!date) return updateFormData({ scheduleValue: '' });
              
              // If timezone setting is available, convert to that timezone
              let targetDate = date;
              if (settings?.timezone) {
                try {
                  // Create a date in the user's timezone
                  const formatter = new Intl.DateTimeFormat('en-CA', {
                    timeZone: settings.timezone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  });
                  
                  // Format the selected date using the target timezone
                  const formatted = formatter.format(date);
                  targetDate = new Date(formatted.replace(/(\d{4})-(\d{2})-(\d{2}), (\d{2}):(\d{2})/, '$1-$2-$3T$4:$5:00'));
                } catch (error) {
                  console.warn('Timezone conversion failed, using original date:', error);
                }
              }
              
              // Store ISO string truncated to minutes to remain compatible with backend expectation  
              const iso = new Date(targetDate.getTime() - targetDate.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
              updateFormData({ scheduleValue: iso });
            }}
            showTimeSelect
            timeIntervals={30}
            timeFormat={is12h ? 'h:mm aa' : 'HH:mm'}
            dateFormat={onceDateFormat}
            minDate={new Date()}
            className="form-control form-control-sm"
            placeholderText={t('moderation.features.scheduler.form.pickers.once.placeholder')}
          />
        );
      case 'daily':
        const daily = parseDaily(formData.scheduleValue);
        return (
          <div>
            <DatePicker
              selected={buildDateFromHM(daily.hour, daily.minute)}
              onChange={(date) => {
                if (!date) return updateFormData({ scheduleValue: '' });
                const hh = pad(date.getHours());
                const mm = pad(date.getMinutes());
                updateFormData({ scheduleValue: `${hh}:${mm}` });
              }}
              showTimeSelect
              showTimeSelectOnly
              timeIntervals={30}
              timeCaption={t('moderation.features.scheduler.form.pickers.daily.timeCaption')}
              timeFormat={is12h ? 'h:mm aa' : 'HH:mm'}
              dateFormat={dailyDateFormat}
              className="form-control form-control-sm"
              placeholderText={t('moderation.features.scheduler.form.pickers.daily.placeholder')}
            />
            <div className="form-text small">{t('moderation.features.scheduler.form.pickers.daily.help')}</div>
          </div>
        );
      case 'weekly':
        const weeklyParts = parseWeekly(formData.scheduleValue);
        return (
          <div>
            <DatePicker
              selected={getWeeklyDate(weeklyParts.day, weeklyParts.time)}
              onChange={(date) => {
                if (!date) return updateFormData({ scheduleValue: '' });
                const dow = date.getDay();
                const hh = pad(date.getHours());
                const mm = pad(date.getMinutes());
                updateFormData({ scheduleValue: toWeeklyValue(dow.toString(), `${hh}:${mm}`) });
              }}
              showTimeSelect
              timeIntervals={30}
              timeFormat={is12h ? 'h:mm aa' : 'HH:mm'}
              dateFormat={weeklyDateFormat}
              className="form-control form-control-sm"
              placeholderText={t('moderation.features.scheduler.form.pickers.weekly.placeholder')}
            />
            <div className="form-text small">{t('moderation.features.scheduler.form.pickers.weekly.help')}</div>
          </div>
        );
      case 'monthly':
        const monthlyParts = parseMonthly(formData.scheduleValue);
        return (
          <div>
            <DatePicker
              selected={getMonthlyDate(monthlyParts.day, monthlyParts.time)}
              onChange={(date) => {
                if (!date) return updateFormData({ scheduleValue: '' });
                const day = pad(date.getDate());
                const hh = pad(date.getHours());
                const mm = pad(date.getMinutes());
                updateFormData({ scheduleValue: toMonthlyValue(day, `${hh}:${mm}`) });
              }}
              showTimeSelect
              timeIntervals={30}
              timeFormat={is12h ? 'h:mm aa' : 'HH:mm'}
              dateFormat={monthlyDateFormat}
              className="form-control form-control-sm"
              placeholderText={t('moderation.features.scheduler.form.pickers.monthly.placeholder')}
            />
            <div className="form-text small">{t('moderation.features.scheduler.form.pickers.monthly.help')}</div>
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
                placeholder={t('moderation.features.scheduler.form.pickers.cron.placeholders.expression')}
              />
            </div>
            <div className="small text-muted mb-2">{t('moderation.features.scheduler.form.pickers.cron.presetsTitle')}</div>
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
    <>
      {/* Loading Overlay */}
      {isLoading && (
        <LoadingOverlay
          title={t('moderation.features.scheduler.loading.title')}
          message={t('moderation.features.scheduler.loading.message')}
          fullHeight={false}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        show={deleteConfirmation.show}
        onHide={cancelDelete}
        onConfirm={confirmDelete}
        message={t('moderation.features.scheduler.delete.message', { title: deleteConfirmation.messageTitle })}
      />

      {/* Main Content */}
      <div className="moderation-config-form space-y-4">
        {/* Information Section */}
        <div className="mb-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <h6 className="mb-0 fw-bold">{t('moderation.features.scheduler.header')}</h6>
            <span className="badge badge-soft">
              <i className="fa-solid fa-calendar-clock me-1"></i>
              {t('moderation.features.scheduler.badge')}
            </span>
          </div>
          <p className="text-muted mb-0">
            {t('moderation.features.scheduler.info.description')}
          </p>
        </div>

      {/* Existing Messages */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">{t('moderation.features.scheduler.list.title', { count: scheduledMessages.length })}</h6>
          <button
            className="btn btn-primary btn-sm"
            onClick={startAdd}
            disabled={isLoading}
          >
            <i className="fa-solid fa-plus me-1"></i>
            {t('moderation.features.scheduler.buttons.add')}
          </button>
        </div>

        {scheduledMessages.length === 0 && !isLoading ? (
          <div className="text-center py-4 text-muted">
            <i className="fa-solid fa-calendar-xmark fs-1 mb-3 opacity-50"></i>
            <p>{t('moderation.features.scheduler.list.emptyTitle')}</p>
            <p className="small">{t('moderation.features.scheduler.list.emptyCta')}</p>
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
                          {t(`moderation.features.scheduler.form.scheduleTypes.${message.scheduleType || 'cron'}`)}
                        </span>
                        {message.embedData && (
                          <span className="badge badge-soft">
                            <i className="fa-solid fa-window-maximize me-1"></i>
                            {t('moderation.features.scheduler.badges.embed')}
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
                          {t('moderation.features.scheduler.labels.schedule', { value: message.scheduleValue })}
                        </span>
                        <span className={`badge ${message.enabled ? 'badge-success' : 'badge-secondary'}`}>
                          <i className={`fa-solid ${message.enabled ? 'fa-check-circle' : 'fa-pause-circle'} me-1`}></i>
                          {message.enabled ? t('moderation.features.scheduler.badges.active') : t('moderation.features.scheduler.badges.inactive')}
                        </span>
                        {message.nextRun && (
                          <span className="text-muted">
                            <i className="fa-solid fa-calendar-days me-1"></i>
                            {t('moderation.features.scheduler.labels.nextRun', { 
                              time: new Date(message.nextRun).toLocaleString()
                            })}
                          </span>
                        )}
                        {message.lastRun && (
                          <span className="text-muted">
                            <i className="fa-solid fa-history me-1"></i>
                            {t('moderation.features.scheduler.labels.lastRun', { 
                              time: new Date(message.lastRun).toLocaleString()
                            })}
                          </span>
                        )}
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
              {editingMessage ? t('moderation.features.scheduler.form.editTitle') : t('moderation.features.scheduler.form.addTitle')}
            </h6>
          </div>
          <div className="card-body">
            <form onSubmit={(e) => { e.preventDefault(); saveMessage(); }}>
              <div className="row mb-3">
                <div className="col-md-6">
                  <FormField label={t('moderation.features.scheduler.form.fields.title.label')} required>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.title}
                      onChange={(e) => updateFormData({ title: e.target.value })}
                      placeholder={t('moderation.features.scheduler.form.fields.title.placeholder')}
                    />
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField label={t('moderation.features.scheduler.form.fields.channel.label')} required>
                    <ChannelSelector
                      channels={channels}
                      value={formData.channelId}
                      onChange={(channelId) => updateFormData({ channelId })}
                      placeholder={t('moderation.features.scheduler.form.fields.channel.placeholder')}
                    />
                  </FormField>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-4">
                  <FormField label={t('moderation.features.scheduler.form.fields.scheduleType.label')} required>
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
                {formData.scheduleType !== 'cron' && (
                  <div className="col-md-4">
                    <FormField label={t('moderation.features.scheduler.form.fields.timeDisplay.label')} required={false}>
                      <select
                        className="form-select form-select-sm"
                        value={timeFormatMode}
                        onChange={(e) => setTimeFormatMode(e.target.value)}
                      >
                        <option value="24h">{t('moderation.features.scheduler.form.fields.timeDisplay.option24')}</option>
                        <option value="12h">{t('moderation.features.scheduler.form.fields.timeDisplay.option12')}</option>
                      </select>
                      {settings?.timezone && (
                        <div className="form-text small mt-1">
                          <i className="fa-solid fa-info-circle text-info me-1"></i>
                          Using timezone: {settings.timezone}
                        </div>
                      )}
                    </FormField>
                  </div>
                )}
                <div className={`col-md-${formData.scheduleType === 'cron' ? '8' : '4'}`}>
                  <FormField label={t('moderation.features.scheduler.form.fields.scheduleValue.label')} required>
                    {renderScheduleInput()}
                  </FormField>
                </div>
              </div>

              <div className="mb-3">
                <FormField label={t('moderation.features.scheduler.form.fields.message.label')} required>
                  <textarea
                    className="form-control form-control-sm"
                    rows="4"
                    value={formData.message}
                    onChange={(e) => updateFormData({ message: e.target.value })}
                    placeholder={t('moderation.features.scheduler.form.fields.message.placeholder')}
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
                    {t('moderation.features.scheduler.form.fields.useEmbed.label')}
                  </label>
                </div>
              </div>

              {/* Embed Configuration */}
              {formData.useEmbed && (
        <div className="border border-light rounded p-3 mb-3">
          <h6 className="mb-3">{t('moderation.features.scheduler.form.fields.embed.header')}</h6>
                  
                  <div className="row mb-3">
                    <div className="col-md-8">
            <FormField label={t('moderation.features.scheduler.form.fields.embed.title.label')}>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.embedData?.title || ''}
                          onChange={(e) => updateFormData({
                            embedData: { ...formData.embedData, title: e.target.value }
                          })}
              placeholder={t('moderation.features.scheduler.form.fields.embed.title.placeholder')}
                        />
                      </FormField>
                    </div>
                    <div className="col-md-4">
            <FormField label={t('moderation.features.scheduler.form.fields.embed.color.label')}>
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
          <FormField label={t('moderation.features.scheduler.form.fields.embed.description.label')}>
                      <textarea
                        className="form-control form-control-sm"
                        rows="3"
                        value={formData.embedData?.description || ''}
                        onChange={(e) => updateFormData({
                          embedData: { ...formData.embedData, description: e.target.value }
                        })}
            placeholder={t('moderation.features.scheduler.form.fields.embed.description.placeholder')}
                      />
                    </FormField>
                  </div>

                  <div className="row mb-3">
                    <div className="col-md-6">
            <FormField label={t('moderation.features.scheduler.form.fields.embed.footer.label')}>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.embedData?.footer || ''}
                          onChange={(e) => updateFormData({
                            embedData: { ...formData.embedData, footer: e.target.value }
                          })}
              placeholder={t('moderation.features.scheduler.form.fields.embed.footer.placeholder')}
                        />
                      </FormField>
                    </div>
                    <div className="col-md-6">
            <FormField label={t('moderation.features.scheduler.form.fields.embed.thumbnail.label')}>
                        <input
                          type="url"
                          className="form-control form-control-sm"
                          value={formData.embedData?.thumbnail || ''}
                          onChange={(e) => updateFormData({
                            embedData: { ...formData.embedData, thumbnail: e.target.value }
                          })}
              placeholder={t('moderation.features.scheduler.form.fields.embed.thumbnail.placeholder')}
                        />
                      </FormField>
                    </div>
                  </div>

                  <div className="mb-3">
          <FormField label={t('moderation.features.scheduler.form.fields.embed.image.label')}>
                      <input
                        type="url"
                        className="form-control form-control-sm"
                        value={formData.embedData?.image || ''}
                        onChange={(e) => updateFormData({
                          embedData: { ...formData.embedData, image: e.target.value }
                        })}
            placeholder={t('moderation.features.scheduler.form.fields.embed.image.placeholder')}
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
          {t('moderation.features.scheduler.buttons.reset')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingMessage(null); // Clear editing state when canceling
                    resetForm();
                  }}
                >
                  <i className="fa-solid fa-times me-1" />
          {t('moderation.features.scheduler.buttons.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={!formData.title || !formData.channelId || !formData.message || !formData.scheduleValue}
                >
                  <i className="fa-solid fa-plus me-1" />
          {editingMessage ? t('moderation.features.scheduler.buttons.saveUpdate') : t('moderation.features.scheduler.buttons.saveAdd')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div> {/* End of main content div */}
    </>
  );
});
