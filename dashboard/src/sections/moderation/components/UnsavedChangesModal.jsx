import React from 'react';

/**
 * UnsavedChangesModal - Modern confirmation modal for unsaved changes
 */
export default function UnsavedChangesModal({ isOpen, onConfirm, onCancel, featureName }) {
  if (!isOpen) return null;

  return (
    <div className="unsaved-changes-overlay">
      <div className="unsaved-changes-backdrop" onClick={onCancel} />
      <div className="unsaved-changes-modal">
        <div className="unsaved-changes-header">
          <div className="unsaved-changes-icon">
            <i className="fa-solid fa-exclamation-triangle"></i>
          </div>
          <h4 className="unsaved-changes-title">Unsaved Changes</h4>
        </div>
        
        <div className="unsaved-changes-body">
          <p className="unsaved-changes-message">
            You have unsaved changes to your <strong>{featureName}</strong> configuration. 
            These changes will be lost if you close without saving.
          </p>
          
          <div className="unsaved-changes-warning">
            <i className="fa-solid fa-info-circle me-2"></i>
            Make sure to save your changes to preserve your settings.
          </div>
        </div>
        
        <div className="unsaved-changes-actions">
          <button 
            type="button" 
            className="btn btn-outline-light unsaved-cancel-btn"
            onClick={onCancel}
          >
            <i className="fa-solid fa-arrow-left me-2"></i>
            Continue Editing
          </button>
          <button 
            type="button" 
            className="btn btn-danger unsaved-confirm-btn"
            onClick={onConfirm}
          >
            <i className="fa-solid fa-trash me-2"></i>
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}
