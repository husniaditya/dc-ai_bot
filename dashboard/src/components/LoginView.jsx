import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n';

// Modern homepage with typing animation and feature showcase
export default function LoginView({ error, authProcessing, loginLoading, startDiscordLogin }) {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const clientId = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_DISCORD_CLIENT_ID || import.meta.env.VITE_CLIENT_ID) : '';
  const invitePerms = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_INVITE_PERMISSIONS || '') : '';
  const inviteUrl = clientId ? `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands${invitePerms?`&permissions=${invitePerms}`:''}` : null;

  // Typing animation state
  const [typedText, setTypedText] = useState('');
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const phrases = t('homepage.hero.typingPhrases', { returnObjects: true }) || [
    'Your Smart Discord Companion',
    'AI-Powered Conversations',
    'Advanced Moderation Tools',
    'Gaming Integration Hub',
    'Automated Server Management'
  ];

  // Typing animation effect
  useEffect(() => {
    const currentPhrase = phrases[currentPhraseIndex];
    const typingSpeed = isDeleting ? 25 : 50;
    const pauseTime = isDeleting ? 1000 : 2000;

    const timer = setTimeout(() => {
      if (!isDeleting && typedText === currentPhrase) {
        setTimeout(() => setIsDeleting(true), pauseTime);
      } else if (isDeleting && typedText === '') {
        setIsDeleting(false);
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
      } else {
        setTypedText(prev => 
          isDeleting 
            ? currentPhrase.substring(0, prev.length - 1)
            : currentPhrase.substring(0, prev.length + 1)
        );
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [typedText, isDeleting, currentPhraseIndex]);

  // Ensure body can scroll for homepage
  useEffect(() => {
    // Allow scrolling on mount
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    
    return () => {
      // Clean up on unmount
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, []);

  // Detect mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));

  const features = [
    {
      icon: '🤖',
      title: t('homepage.features.ai.title'),
      description: t('homepage.features.ai.description'),
      highlights: t('homepage.features.ai.highlights', { returnObjects: true })
    },
    {
      icon: '🛡️',
      title: t('homepage.features.moderation.title'),
      description: t('homepage.features.moderation.description'),
      highlights: t('homepage.features.moderation.highlights', { returnObjects: true })
    },
    {
      icon: '🎮',
      title: t('homepage.features.gaming.title'),
      description: t('homepage.features.gaming.description'),
      highlights: t('homepage.features.gaming.highlights', { returnObjects: true })
    },
    {
      icon: '⚙️',
      title: t('homepage.features.automation.title'),
      description: t('homepage.features.automation.description'),
      highlights: t('homepage.features.automation.highlights', { returnObjects: true })
    },
    {
      icon: '📊',
      title: t('homepage.features.dashboard.title'),
      description: t('homepage.features.dashboard.description'),
      highlights: t('homepage.features.dashboard.highlights', { returnObjects: true })
    },
    {
      icon: '🌍',
      title: t('homepage.features.i18n.title'),
      description: t('homepage.features.i18n.description'),
      highlights: t('homepage.features.i18n.highlights', { returnObjects: true })
    }
  ];

  const stats = [
    { value: t('homepage.hero.stats.commands'), label: t('homepage.hero.stats.commandsLabel') },
    { value: t('homepage.hero.stats.languages'), label: t('homepage.hero.stats.languagesLabel') },
    { value: t('homepage.hero.stats.uptime'), label: t('homepage.hero.stats.uptimeLabel') },
    { value: t('homepage.hero.stats.online'), label: t('homepage.hero.stats.onlineLabel') }
  ];

  return (
    <div className="home-viewport">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6 hero-content fade-in">
              <div className="logo-badge mb-4">
                <img src="/images.jpg" alt="Choco Maid" className="logo-img-hero" onError={(e)=>{ e.currentTarget.style.display='none'; }} />
                <span className="logo-text">CM</span>
              </div>
              <h1 className="hero-title mb-3">
                {t('homepage.hero.title')}
              </h1>
              <div className="hero-subtitle mb-4">
                <span className="typing-text">{typedText}</span>
                <span className="typing-cursor">|</span>
              </div>
              <p className="hero-description mb-4">
                {t('homepage.hero.description')}
              </p>
              
              {error && (
                <div className="alert alert-danger mb-4">
                  {error}
                  {error.includes('invalid_state') || error.includes('session expired') ? (
                    <div className="mt-2">
                      <small className="text-muted d-block">
                        This usually happens if you took too long to complete the login or refreshed during authentication.
                      </small>
                    </div>
                  ) : null}
                </div>
              )}

              {authProcessing ? (
                <div className="auth-processing-hero mb-4">
                  <div className="spinner-border text-primary me-2" role="status">
                    <span className="visually-hidden">{t('common.loading')}</span>
                  </div>
                  <span>{t('homepage.hero.processing')}</span>
                </div>
              ) : (
                <div className="hero-actions d-flex gap-3 mb-4">
                  <button 
                    onClick={startDiscordLogin} 
                    className="btn btn-hero-primary"
                    disabled={loginLoading}
                  >
                    {loginLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        <span>{t('homepage.hero.connecting')}</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-brands fa-discord me-2"></i>
                        <span>{t('homepage.hero.loginButton')}</span>
                      </>
                    )}
                  </button>
                  {inviteUrl && (
                    <a 
                      href={inviteUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-hero-secondary"
                    >
                      <i className="fa-solid fa-plus me-2"></i>
                      <span>{t('homepage.hero.addButton')}</span>
                    </a>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="hero-stats row g-3">
                {stats.map((stat, idx) => (
                  <div key={idx} className="col-3">
                    <div className="stat-card">
                      <div className="stat-value">{stat.value}</div>
                      <div className="stat-label">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="col-lg-6 hero-visual d-none d-lg-block">
              <div className="hero-card-showcase">
                <div className="showcase-card card-1 fade-in-delay-1">
                  <i className="fa-solid fa-robot showcase-icon"></i>
                  <div className="showcase-text">{t('homepage.hero.showcaseCards.ai')}</div>
                </div>
                <div className="showcase-card card-2 fade-in-delay-2">
                  <i className="fa-solid fa-shield-halved showcase-icon"></i>
                  <div className="showcase-text">{t('homepage.hero.showcaseCards.moderation')}</div>
                </div>
                <div className="showcase-card card-3 fade-in-delay-3">
                  <i className="fa-solid fa-gamepad showcase-icon"></i>
                  <div className="showcase-text">{t('homepage.hero.showcaseCards.gaming')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="section-title mb-3">{t('homepage.features.title')}</h2>
            <p className="section-subtitle">{t('homepage.features.subtitle')}</p>
          </div>
          
          <div className="row g-4">
            {features.map((feature, idx) => (
              <div key={idx} className="col-lg-4 col-md-6">
                <div className="feature-card fade-in-on-scroll">
                  <div className="feature-header">
                    <div className="feature-icon">{feature.icon}</div>
                    <h3 className="feature-title">{feature.title}</h3>
                  </div>
                  <p className="feature-description mb-3">{feature.description}</p>
                  <ul className="feature-highlights">
                    {feature.highlights.map((highlight, hIdx) => (
                      <li key={hIdx}>
                        <i className="fa-solid fa-check-circle me-2"></i>
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commands Section */}
      <section className="commands-section">
        <div className="container">
          <div className="section-header text-center mb-5">
            <h2 className="section-title mb-3">{t('homepage.commands.title')}</h2>
            <p className="section-subtitle">{t('homepage.commands.subtitle')}</p>
          </div>
          
          <div className="row g-4">
            <div className="col-md-6">
              <div className="command-category-card">
                <h4 className="command-category-title">
                  <i className="fa-solid fa-brain me-2"></i>
                  {t('homepage.commands.ai.title')}
                </h4>
                <div className="command-list">
                  <div className="command-item">
                    <code>/ask</code>
                    <span>{t('homepage.commands.ai.ask')}</span>
                  </div>
                  <div className="command-item">
                    <code>/explain_image</code>
                    <span>{t('homepage.commands.ai.explainImage')}</span>
                  </div>
                  <div className="command-item">
                    <code>/summarize</code>
                    <span>{t('homepage.commands.ai.summarize')}</span>
                  </div>
                  <div className="command-item">
                    <code>/translate</code>
                    <span>{t('homepage.commands.ai.translate')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="command-category-card">
                <h4 className="command-category-title">
                  <i className="fa-solid fa-shield me-2"></i>
                  {t('homepage.commands.moderation.title')}
                </h4>
                <div className="command-list">
                  <div className="command-item">
                    <code>/antiraid</code>
                    <span>{t('homepage.commands.moderation.antiraid')}</span>
                  </div>
                  <div className="command-item">
                    <code>/automod</code>
                    <span>{t('homepage.commands.moderation.automod')}</span>
                  </div>
                  <div className="command-item">
                    <code>/audit</code>
                    <span>{t('homepage.commands.moderation.audit')}</span>
                  </div>
                  <div className="command-item">
                    <code>/welcome</code>
                    <span>{t('homepage.commands.moderation.welcome')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="command-category-card">
                <h4 className="command-category-title">
                  <i className="fa-solid fa-gamepad me-2"></i>
                  {t('homepage.commands.gaming.title')}
                </h4>
                <div className="command-list">
                  <div className="command-item">
                    <code>/coc</code>
                    <span>{t('homepage.commands.gaming.coc')}</span>
                  </div>
                  <div className="command-item">
                    <code>/valorant</code>
                    <span>{t('homepage.commands.gaming.valorant')}</span>
                  </div>
                  <div className="command-item">
                    <code>/ytwatch</code>
                    <span>{t('homepage.commands.gaming.ytwatch')}</span>
                  </div>
                  <div className="command-item">
                    <code>/twitchstats</code>
                    <span>{t('homepage.commands.gaming.twitchstats')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="command-category-card">
                <h4 className="command-category-title">
                  <i className="fa-solid fa-chart-line me-2"></i>
                  {t('homepage.commands.leveling.title')}
                </h4>
                <div className="command-list">
                  <div className="command-item">
                    <code>/xp check</code>
                    <span>{t('homepage.commands.leveling.xpCheck')}</span>
                  </div>
                  <div className="command-item">
                    <code>/leaderboard</code>
                    <span>{t('homepage.commands.leveling.leaderboard')}</span>
                  </div>
                  <div className="command-item">
                    <code>/role</code>
                    <span>{t('homepage.commands.leveling.role')}</span>
                  </div>
                  <div className="command-item">
                    <code>/poll create</code>
                    <span>{t('homepage.commands.leveling.pollCreate')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-card">
            <h2 className="cta-title mb-3">{t('homepage.cta.title')}</h2>
            <p className="cta-description mb-4">
              {t('homepage.cta.description')}
            </p>
            <div className="cta-actions d-flex gap-3 justify-content-center">
              <button 
                onClick={startDiscordLogin} 
                className="btn btn-cta-primary"
                disabled={loginLoading || authProcessing}
              >
                {loginLoading || authProcessing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    <span>{t('homepage.cta.processing')}</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-right-to-bracket me-2"></i>
                    <span>{t('homepage.cta.accessDashboard')}</span>
                  </>
                )}
              </button>
              {inviteUrl && (
                <a 
                  href={inviteUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-cta-secondary"
                >
                  <i className="fa-solid fa-robot me-2"></i>
                  <span>{t('homepage.cta.inviteBot')}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="container">
          <div className="row">
            <div className="col-md-6">
              <div className="footer-brand mb-3">
                <img src="/images.jpg" alt="Choco Maid" className="footer-logo" onError={(e)=>{ e.currentTarget.style.display='none'; }} />
                <span className="footer-brand-text">{t('homepage.hero.title')}</span>
              </div>
              <p className="footer-description">
                {t('homepage.footer.brandDescription')}
              </p>
            </div>
            <div className="col-md-3">
              <h5 className="footer-heading">{t('homepage.footer.resources')}</h5>
              <ul className="footer-links">
                <li><a href="#repo" target="_blank" rel="noopener noreferrer">
                  <i className="fa-brands fa-github me-2"></i>{t('homepage.footer.github')}
                </a></li>
                <li><a href="#discord" target="_blank" rel="noopener noreferrer">
                  <i className="fa-brands fa-discord me-2"></i>{t('homepage.footer.support')}
                </a></li>
              </ul>
            </div>
            <div className="col-md-3">
              <h5 className="footer-heading">{t('homepage.footer.documentation')}</h5>
              <ul className="footer-links">
                <li><a href="#commands">{t('homepage.footer.commandList')}</a></li>
                <li><a href="#features">{t('homepage.footer.features')}</a></li>
                <li><a href="#setup">{t('homepage.footer.setupGuide')}</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom mt-4 pt-4">
            <p className="footer-copyright mb-0">
              © {year} {t('homepage.footer.copyright')}
              <a href="https://github.com/husniaditya/dc-ai_bot/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="ms-1"></a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
