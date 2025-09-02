import React, { useEffect, useState } from 'react';
import LoadingOverlay from './LoadingOverlay';

interface LoadingSectionProps {
  children: React.ReactNode;
  loading: boolean;
  title?: string;
  message?: string;
  variant?: 'default' | 'minimal' | 'pulse';
  className?: string;
  style?: React.CSSProperties;
}

const LoadingSection: React.FC<LoadingSectionProps> = ({
  children,
  loading,
  title = "Loading...",
  message = "Please wait while we fetch your data...",
  variant = 'default',
  className = '',
  style = {}
}) => {
  // Track viewport width to decide when to escalate to full-screen overlay.
  const [isSmallViewport, setIsSmallViewport] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsSmallViewport(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Prevent background scroll & optionally add a helper class while full-screen loading
  useEffect(() => {
    if (loading && isSmallViewport) {
      document.body.classList.add('overlay-lock');
    } else {
      document.body.classList.remove('overlay-lock');
    }
    return () => document.body.classList.remove('overlay-lock');
  }, [loading, isSmallViewport]);

  if (loading) {
  const fullScreen = isSmallViewport; // full screen only on mobile/tablet
    return (
      <div 
        className={`loading-section-container ${className}`} 
        style={{ 
          // Use a smaller minHeight; when full screen it's ignored because overlay is fixed.
          minHeight: fullScreen ? '0' : '600px',
            position: 'relative',
          width: '100%',
          height: '100%',
          ...style
        }}
      >
        <LoadingOverlay
          title={title}
          message={message}
          variant={variant}
          fullHeight={fullScreen}
        />
      </div>
    );
  }

  return <div className={className} style={style}>{children}</div>;
};

export default LoadingSection;
