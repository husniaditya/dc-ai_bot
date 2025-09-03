import React from 'react';

export default function DeleteConfirmationModal({
  show,
  onClose,
  onConfirm,
  isDeleting = false,
  title = "Confirm Deletion",
  message = "Are you sure you want to delete this item?",
  warningMessage = "This action cannot be undone.",
  itemDetails = null,
  confirmButtonText = "Delete",
  cancelButtonText = "Cancel"
}) {
  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content bg-dark text-light">
          <div className="modal-header border-secondary">
            <h5 className="modal-title">
              <i className="fa-solid fa-exclamation-triangle text-warning me-2"></i>
              {title}
            </h5>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={onClose}
              disabled={isDeleting}
            ></button>
          </div>
          
          <div className="modal-body">
            {warningMessage && (
              <div className="alert alert-warning border-warning bg-warning bg-opacity-10 text-warning">
                <i className="fa-solid fa-exclamation-triangle me-2"></i>
                <strong>Warning:</strong> {warningMessage}
              </div>
            )}
            
            <p className="mb-3">{message}</p>
            
            {itemDetails && (
              <div className="bg-secondary bg-opacity-25 rounded p-3">
                {itemDetails}
              </div>
            )}
          </div>
          
          <div className="modal-footer border-secondary">
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={onClose}
              disabled={isDeleting}
            >
              <i className="fa-solid fa-times me-1"></i>
              {cancelButtonText}
            </button>
            <button 
              type="button" 
              className="btn btn-danger" 
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <div className="spinner-border spinner-border-sm me-2" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  Deleting...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-trash me-1"></i>
                  {confirmButtonText}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
