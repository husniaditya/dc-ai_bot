import React from 'react';
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
  if (loading) {
    return (
      <div 
        className={`loading-section-container ${className}`} 
        style={{ 
          minHeight: '600px', 
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
          fullHeight={false}
        />
      </div>
    );
  }

  return <div className={className} style={style}>{children}</div>;
};

export default LoadingSection;
