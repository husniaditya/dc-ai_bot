import React from 'react';

export default function LoadingOverlay({ 
  title = "Loading...", 
  message = "Please wait while we fetch your data...",
  fullHeight = true 
}) {
  return (
    <div className={`loading-overlay ${fullHeight ? 'full-height' : 'section-height'}`}>
      <div className="loading-backdrop">
        <div className="loading-content">
          <div className="loading-spinner-container mb-4">
            <div className="loading-spinner">
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
            </div>
          </div>
          <div className="loading-text">
            <h5 className="mb-2 loading-title">{title}</h5>
            <p className="loading-message mb-0">{message}</p>
          </div>
          <div className="loading-progress mt-4">
            <div className="progress-dots">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .loading-overlay {
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          animation: fadeIn 0.3s ease-out;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }

        .loading-overlay.full-height {
          position: fixed;
          width: 100vw;
          height: 100vh;
        }

        .loading-overlay.section-height {
          position: absolute;
          width: 100%;
          height: 100%;
          min-height: 400px;
        }

        .loading-title {
          color: white;
        }

        .loading-message {
          color: rgba(255, 255, 255, 0.7);
        }

        /* Light theme overrides */
        html:not(.dark) .loading-title {
          color: #1f2530 !important;
        }

        html:not(.dark) .loading-message {
          color: #6b7484 !important;
        }
      
        .loading-backdrop {
          background: linear-gradient(135deg, rgba(88, 101, 242, 0.1), rgba(114, 137, 218, 0.1));
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 3rem;
          text-align: center;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 90%;
          position: relative;
          z-index: 1000;
        }
        
        .loading-spinner-container {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .loading-spinner {
          position: relative;
          width: 60px;
          height: 60px;
        }
        
        .spinner-ring {
          position: absolute;
          width: 60px;
          height: 60px;
          border: 3px solid transparent;
          border-radius: 50%;
          animation: spin 2s linear infinite;
        }
        
        .spinner-ring:nth-child(1) {
          border-top-color: #5865f2;
          animation-delay: 0s;
        }
        
        .spinner-ring:nth-child(2) {
          border-right-color: #7289da;
          animation-delay: 0.5s;
          width: 50px;
          height: 50px;
          top: 5px;
          left: 5px;
        }
        
        .spinner-ring:nth-child(3) {
          border-bottom-color: #99aab5;
          animation-delay: 1s;
          width: 40px;
          height: 40px;
          top: 10px;
          left: 10px;
        }
        
        .progress-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
        }
        
        .dot {
          width: 8px;
          height: 8px;
          background: #5865f2;
          border-radius: 50%;
          animation: dotPulse 1.5s ease-in-out infinite;
        }
        
        .dot:nth-child(2) {
          animation-delay: 0.3s;
        }
        
        .dot:nth-child(3) {
          animation-delay: 0.6s;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes dotPulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
