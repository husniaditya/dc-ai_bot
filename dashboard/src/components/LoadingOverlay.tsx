import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface LoadingOverlayProps {
  title?: string;
  message?: string;
  fullHeight?: boolean;
  variant?: 'default' | 'minimal' | 'pulse';
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  title = "Loading...", 
  message = "Please wait while we fetch your data...",
  fullHeight = true,
  variant = 'default'
}) => {
  // Viewport split (mobile/tablet < 1024px vs desktop)
  const [isMobile, setIsMobile] = useState<boolean>(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const renderSpinner = () => {
    switch (variant) {
      case 'minimal':
        return (
          <div className="relative" style={{ position: 'relative', width: 'clamp(28px, 6vw, 32px)', height: 'clamp(28px, 6vw, 32px)' }}>
            <div className="absolute inset-0 border-2 border-blue-200/20 rounded-full"></div>
            <div 
              className="spinner-ring absolute inset-0 border-2 border-transparent rounded-full animate-spin"
              style={{
                position: 'absolute',
                inset: '0',
                border: '2px solid transparent',
                borderTopColor: '#5865f2',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            ></div>
          </div>
        );
      
      case 'pulse':
        return (
          <div className="flex space-x-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="pulse-dot rounded-full animate-pulse"
                style={{ 
                  width: 'clamp(10px, 2.5vw, 12px)', 
                  height: 'clamp(10px, 2.5vw, 12px)', 
                  backgroundColor: '#5865f2', 
                  borderRadius: '50%',
                  animationDelay: `${i * 0.2}s`,
                  marginRight: i < 2 ? 'clamp(3px, 1vw, 4px)' : '0'
                }}
              />
            ))}
          </div>
        );
      
      default:
        return (
          <div className="relative spinner-root" style={{ position: 'relative', width: 'clamp(48px, 12vw, 64px)', height: 'clamp(48px, 12vw, 64px)' }}>
            {/* Outer ring */}
            <div 
              className="spinner-ring absolute inset-0 border-4 border-transparent rounded-full animate-spin"
              style={{
                position: 'absolute',
                inset: '0',
                border: 'clamp(3px, 1vw, 4px) solid transparent',
                borderTopColor: '#5865f2',
                borderRadius: '50%',
                animation: 'spin 2s linear infinite'
              }}
            ></div>
            {/* Middle ring */}
            <div 
              className="spinner-ring absolute border-4 border-transparent rounded-full animate-spin" 
              style={{ 
                position: 'absolute',
                inset: 'clamp(6px, 2vw, 8px)',
                border: 'clamp(3px, 1vw, 4px) solid transparent',
                borderRightColor: '#7289da',
                borderRadius: '50%',
                animation: 'spin 1.5s linear infinite'
              }}
            ></div>
            {/* Inner ring */}
            <div 
              className="spinner-ring absolute border-2 border-transparent rounded-full animate-spin" 
              style={{ 
                position: 'absolute',
                inset: 'clamp(12px, 4vw, 16px)',
                border: 'clamp(2px, 0.5vw, 2px) solid transparent',
                borderBottomColor: '#99aab5',
                borderRadius: '50%',
                animation: 'spin 2.5s linear infinite'
              }}
            ></div>
          </div>
        );
    }
  };

  const containerClasses = `
    ${fullHeight ? 'fixed inset-0 w-screen h-screen' : 'absolute inset-0 w-full h-full min-h-[400px]'}
    flex items-center justify-center
    opacity-100
    z-[9999]
    overflow-hidden
  `.trim();

  const overlayContent = (
    <div 
      className={`loading-overlay-backdrop ${containerClasses} animate-fade-in`}
      style={{
        position: fullHeight ? 'fixed' : 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        // Desktop rich animated background; mobile = translucent pass-through
        background: isMobile 
          ? 'rgba(15,17,25,0.55)' 
          : 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%)',
        backgroundSize: isMobile ? 'auto' : '400% 400%',
        animation: isMobile ? 'fadeIn 0.25s ease-out forwards' : 'gradientShift 8s ease infinite, fadeIn 0.3s ease-out forwards',
        backdropFilter: isMobile ? 'blur(2px)' : 'blur(4px)',
        WebkitBackdropFilter: isMobile ? 'blur(2px)' : 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        overflow: 'hidden',
        padding: '1rem',
        // Allow clicks through only on mobile; desktop blocks
        pointerEvents: isMobile ? 'none' : 'auto'
      }}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Moving gradient waves */}
        <div className="gradient-wave wave-1"></div>
        <div className="gradient-wave wave-2"></div>
        <div className="gradient-wave wave-3"></div>
        
        {/* Animated grid lines */}
        <div className="grid-overlay"></div>
        
        {/* Particle effect */}
        <div className="particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className={`particle particle-${i + 1}`}></div>
          ))}
        </div>
      </div>

  {/* Position wrapper to allow desktop upward offset */}
  <div
    style={{
      transform: isMobile ? 'none' : 'translateY(-70px)', // move upward on desktop
      transition: 'transform 0.4s ease'
    }}
  >
  <div 
        className="loading-card bg-gradient-to-br from-purple-900/20 via-blue-900/10 to-transparent
                        border border-white/10 rounded-2xl
                        backdrop-blur-xl
                        shadow-2xl
                        text-center
                        transform scale-100 opacity-100 animate-scale-in relative z-10
                        max-w-sm w-11/12 mx-auto"
        style={{
          background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.1), rgba(114, 137, 218, 0.1))',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1.5rem',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.28)',
          animation: 'scaleIn 0.4s ease-out 0.1s both',
          position: 'relative',
      zIndex: 10,
      pointerEvents: 'auto', // card itself captures events
          // Desktop square layout; mobile keeps fluid width
          maxWidth: isMobile ? 'min(90vw, 400px)' : '480px',
          width: isMobile ? '90%' : '480px',
          height: isMobile ? 'auto' : '350px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '1.25rem',
          overflow: 'hidden'
        }}
      >
        
        {/* Spinner */}
        <div className="flex justify-center mb-4 sm:mb-6" style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(1rem, 3vw, 1.5rem)' }}>
          {renderSpinner()}
        </div>
        
        {/* Text content */}
        <div className="space-y-2" style={{ marginBottom: 'clamp(0.5rem, 2vw, 1rem)' }}>
          <h3 className="loading-title text-base sm:text-lg font-semibold text-white" style={{ fontSize: 'clamp(1rem, 3vw, 1.125rem)', fontWeight: '600', marginBottom: '0.5rem' }}>
            {title}
          </h3>
          <p className="loading-message text-xs sm:text-sm text-white/70" style={{ fontSize: 'clamp(0.75rem, 2.5vw, 0.875rem)', lineHeight: '1.4' }}>
            {message}
          </p>
        </div>
        
        {/* Progress dots */}
        <div className="flex justify-center space-x-2 mt-4 sm:mt-6" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: 'clamp(1rem, 3vw, 1.5rem)' }}>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="progress-dot rounded-full animate-pulse"
              style={{ 
                width: 'clamp(6px, 1.5vw, 8px)', 
                height: 'clamp(6px, 1.5vw, 8px)', 
                backgroundColor: '#5865f2', 
                borderRadius: '50%',
                animationDelay: `${i * 0.3}s` 
              }}
            />
          ))}
        </div>
  </div>
  </div>
      
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        
        @keyframes floatX {
          0%, 100% {
            transform: translateX(0px);
          }
          50% {
            transform: translateX(30px);
          }
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }
        
        @keyframes drift {
          0% {
            transform: translateX(-100px) translateY(0px);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateX(calc(100vw + 100px)) translateY(-100px);
            opacity: 0;
          }
        }
        
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        @keyframes waveMove {
          0% {
            transform: translateX(-100%) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.3;
          }
          90% {
            opacity: 0.3;
          }
          100% {
            transform: translateX(100vw) rotate(360deg);
            opacity: 0;
          }
        }
        
        @keyframes wavePulse {
          0%, 100% {
            transform: scale(1) rotate(0deg);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.2) rotate(180deg);
            opacity: 0.4;
          }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }

        /* Fallback: if nested rings fail on some mobile browsers, spin root */
        @media (max-width:640px) {
          .spinner-root { animation: spin 2s linear infinite; }
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
        
        .animate-scale-in {
          animation: scaleIn 0.4s ease-out 0.1s both;
        }
        
        /* Grid overlay */
        .grid-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            linear-gradient(rgba(88, 101, 242, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(88, 101, 242, 0.1) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: float 20s ease-in-out infinite;
          opacity: 0.3;
        }
        
        /* Particles */
        .particles {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
        }
        
        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: rgba(88, 101, 242, 0.6);
          border-radius: 50%;
          animation: drift linear infinite;
        }
        
        .particle-1 { animation-duration: 15s; animation-delay: 0s; top: 10%; }
        .particle-2 { animation-duration: 18s; animation-delay: 2s; top: 20%; }
        .particle-3 { animation-duration: 12s; animation-delay: 4s; top: 30%; }
        .particle-4 { animation-duration: 20s; animation-delay: 1s; top: 40%; }
        .particle-5 { animation-duration: 16s; animation-delay: 3s; top: 50%; }
        .particle-6 { animation-duration: 14s; animation-delay: 5s; top: 60%; }
        .particle-7 { animation-duration: 19s; animation-delay: 2.5s; top: 70%; }
        .particle-8 { animation-duration: 13s; animation-delay: 4.5s; top: 80%; }
        .particle-9 { animation-duration: 17s; animation-delay: 1.5s; top: 15%; }
        .particle-10 { animation-duration: 21s; animation-delay: 3.5s; top: 25%; }
        .particle-11 { animation-duration: 11s; animation-delay: 0.5s; top: 35%; }
        .particle-12 { animation-duration: 22s; animation-delay: 2.8s; top: 45%; }
        .particle-13 { animation-duration: 15s; animation-delay: 4.2s; top: 55%; }
        .particle-14 { animation-duration: 18s; animation-delay: 1.8s; top: 65%; }
        .particle-15 { animation-duration: 16s; animation-delay: 3.2s; top: 75%; }
        .particle-16 { animation-duration: 14s; animation-delay: 5.2s; top: 85%; }
        .particle-17 { animation-duration: 20s; animation-delay: 0.8s; top: 12%; }
        .particle-18 { animation-duration: 12s; animation-delay: 4.8s; top: 22%; }
        .particle-19 { animation-duration: 19s; animation-delay: 2.2s; top: 32%; }
        .particle-20 { animation-duration: 17s; animation-delay: 3.8s; top: 42%; }
        
        /* Gradient waves */
        .gradient-wave {
          position: absolute;
          width: 200%;
          height: 200%;
          border-radius: 50%;
          filter: blur(3px);
        }
        
        .wave-1 {
          background: radial-gradient(circle, rgba(88, 101, 242, 0.1) 0%, rgba(114, 137, 218, 0.05) 50%, transparent 100%);
          top: -50%;
          left: -50%;
          animation: waveMove 20s linear infinite, wavePulse 8s ease-in-out infinite;
          animation-delay: 0s, 1s;
        }
        
        .wave-2 {
          background: radial-gradient(circle, rgba(114, 137, 218, 0.08) 0%, rgba(88, 101, 242, 0.04) 50%, transparent 100%);
          bottom: -50%;
          right: -50%;
          animation: waveMove 25s linear infinite reverse, wavePulse 12s ease-in-out infinite;
          animation-delay: 5s, 3s;
        }
        
        .wave-3 {
          background: radial-gradient(circle, rgba(153, 170, 181, 0.06) 0%, rgba(88, 101, 242, 0.03) 50%, transparent 100%);
          top: 25%;
          left: 25%;
          animation: waveMove 30s linear infinite, wavePulse 15s ease-in-out infinite;
          animation-delay: 10s, 6s;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: .5;
          }
        }

        /* Dark theme styles (default) */
        .loading-card {
          background: linear-gradient(135deg, rgba(88, 101, 242, 0.1), rgba(114, 137, 218, 0.1)) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
        }

        .loading-title {
          color: white !important;
        }

        .loading-message {
          color: rgba(255, 255, 255, 0.7) !important;
        }

        /* Light theme overrides */
        html:not(.dark) .loading-card {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.06) 50%, rgba(236, 72, 153, 0.04) 100%) !important;
          border: 1px solid rgba(99, 102, 241, 0.15) !important;
          box-shadow: 0 8px 32px rgba(99, 102, 241, 0.08), 0 4px 16px rgba(168, 85, 247, 0.04), 0 0 0 1px rgba(255,255,255,0.6) inset !important;
          backdrop-filter: blur(14px) saturate(160%) !important;
        }

        html:not(.dark) .loading-title {
          color: #1f2530 !important;
        }

        html:not(.dark) .loading-message {
          color: #6b7484 !important;
        }

        /* Light theme backdrop */
        html:not(.dark) .loading-overlay-backdrop {
          background: linear-gradient(135deg, 
            #fef7ff 0%, 
            #f3e8ff 15%, 
            #e0e7ff 30%, 
            #c7d2fe 45%, 
            #a5b4fc 60%, 
            #8b5cf6 75%, 
            #7c3aed 90%, 
            #6d28d9 100%) !important;
          background-size: 400% 400% !important;
          animation: gradientShift 8s ease infinite, fadeIn 0.3s ease-out forwards !important;
        }
        
        /* Light theme animated elements */
        html:not(.dark) .gradient-wave {
          filter: blur(2px) !important;
        }
        
        html:not(.dark) .wave-1 {
          background: radial-gradient(circle, 
            rgba(139, 92, 246, 0.15) 0%, 
            rgba(168, 85, 247, 0.10) 30%, 
            rgba(236, 72, 153, 0.08) 60%, 
            transparent 100%) !important;
        }
        
        html:not(.dark) .wave-2 {
          background: radial-gradient(circle, 
            rgba(236, 72, 153, 0.12) 0%, 
            rgba(249, 115, 22, 0.08) 30%, 
            rgba(245, 158, 11, 0.06) 60%, 
            transparent 100%) !important;
        }
        
        html:not(.dark) .wave-3 {
          background: radial-gradient(circle, 
            rgba(59, 130, 246, 0.10) 0%, 
            rgba(139, 92, 246, 0.06) 30%, 
            rgba(168, 85, 247, 0.04) 60%, 
            transparent 100%) !important;
        }
        
        html:not(.dark) .grid-overlay {
          background-image: 
            linear-gradient(rgba(139, 92, 246, 0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.10) 1px, transparent 1px) !important;
          opacity: 0.4 !important;
        }
        
        html:not(.dark) .particle {
          background: rgba(139, 92, 246, 0.6) !important;
          box-shadow: 0 0 4px rgba(168, 85, 247, 0.4) !important;
        }

        /* Spinner colors - Dark theme (default) */
        .spinner-ring {
          border-top-color: #5865f2;
          border-right-color: #7289da;
          border-bottom-color: #99aab5;
        }

        .pulse-dot, .progress-dot {
          background-color: #5865f2 !important;
        }

        /* Spinner colors - Light theme */
        html:not(.dark) .spinner-ring {
          border-top-color: #6366f1 !important;
          border-right-color: #8b5cf6 !important;
          border-bottom-color: #a855f7 !important;
        }

        html:not(.dark) .pulse-dot, html:not(.dark) .progress-dot {
          background-color: #6366f1 !important;
        }
        
        /* Mobile Responsive Styles */
        @media (max-width: 640px) {
          .loading-overlay-backdrop {
            padding: 1rem !important;
          }
          
          .loading-card {
            padding: 1.25rem !important;
            max-width: 320px !important;
            width: 90% !important;
            margin: 0 auto !important;
          }
          
          .loading-title {
            font-size: 1rem !important;
            margin-bottom: 0.5rem !important;
          }
          
          .loading-message {
            font-size: 0.8rem !important;
            line-height: 1.4 !important;
          }
          
          /* Mobile spinner: keep rotation only (scale caused transform override clash) */
          .spinner-ring {
            animation: spin 1.6s linear infinite !important;
            will-change: transform;
          }
          
          /* Reduce particles on mobile for performance */
          .particle {
            display: none;
          }
          .particle-1, .particle-2, .particle-3, .particle-4, .particle-5 {
            display: block;
          }
          
          /* Smaller waves on mobile */
          .gradient-wave {
            width: 150% !important;
            height: 150% !important;
          }
          
          /* Reduce grid density on mobile */
          .grid-overlay {
            background-size: 40px 40px !important;
            opacity: 0.2 !important;
          }
        }
        
        /* Tablet Responsive Styles */
        @media (min-width: 641px) and (max-width: 1024px) {
          .loading-card {
            padding: 1.75rem !important;
            max-width: 360px !important;
            width: 88% !important;
          }
          
          .loading-title {
            font-size: 1.05rem !important;
          }
          
          .loading-message {
            font-size: 0.8rem !important;
          }
          
          /* Slightly reduce effects on tablet */
          .particle {
            display: none;
          }
          .particle-1, .particle-2, .particle-3, .particle-4, .particle-5, 
          .particle-6, .particle-7, .particle-8, .particle-9, .particle-10 {
            display: block;
          }
          
          .grid-overlay {
            background-size: 45px 45px !important;
          }
        }
        
        /* Touch device improvements */
        @media (hover: none) and (pointer: coarse) {
          .loading-card {
            transform: none !important;
          }
          
          .animate-scale-in {
            animation: mobileScaleIn 0.3s ease-out both !important;
          }
        }
        
        /* Mobile scale-in animation */
        @keyframes mobileScaleIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(5px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        /* Landscape mobile adjustments */
        @media (max-width: 640px) and (orientation: landscape) {
          .loading-card {
            max-width: 280px !important;
            padding: 1rem !important;
          }
          
          .loading-title {
            font-size: 0.95rem !important;
          }
          
          .loading-message {
            font-size: 0.7rem !important;
          }
        }
      `}</style>
    </div>
  );

  // Portal full-height overlays to body to escape any transformed ancestors (mobile layout issue)
  if (fullHeight && typeof document !== 'undefined') {
    return createPortal(overlayContent, document.body);
  }

  return overlayContent;
};

export default LoadingOverlay;
