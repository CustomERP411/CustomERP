import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/common/LanguageSelector';
import ThemeToggle from '../components/common/ThemeToggle';
import BrandMark from '../components/brand/BrandMark';

/**
 * Landing Page Component
 * Public home page that introduces CustomERP to unauthenticated users
 */
export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('landing');

  // Redirect authenticated users to their projects
  useEffect(() => {
    if (user) {
      navigate('/projects');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-app-bg transition-colors duration-200">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-12 sm:mb-16">
          <Link to="/" className="flex items-center min-w-0">
            <BrandMark
              variant="wordmark"
              className="h-14 sm:h-16 md:h-[4.5rem] w-auto max-w-[min(100%,420px)] object-contain object-left"
            />
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <LanguageSelector variant="landing" />
            <ThemeToggle />
            <Link
              to="/login"
              className="px-3 sm:px-6 py-2 text-xs sm:text-sm text-app-text-subtle hover:text-app-accent-blue transition-colors font-medium"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              to="/register"
              className="px-3 sm:px-6 py-2 sm:py-2.5 bg-app-accent-blue text-white rounded-lg hover:bg-app-accent-dark-blue transition-all font-semibold shadow-lg text-xs sm:text-sm"
            >
              {t('nav.getStarted')}
            </Link>
          </div>
        </header>

        {/* Hero Content */}
        <div className="text-center space-y-6 sm:space-y-8 py-6 sm:py-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-app-text leading-tight">
            {t('hero.titleLine1')}
            <br />
            <span className="text-app-accent-blue">{t('hero.titleLine2')}</span>
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-app-text-subtle max-w-3xl mx-auto">
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-6 sm:pt-8">
            <Link
              to="/register"
              className="px-6 sm:px-8 py-3 sm:py-4 bg-app-accent-blue text-white text-base sm:text-lg rounded-lg hover:bg-app-accent-dark-blue transition-all font-semibold shadow-xl text-center"
            >
              {t('hero.ctaPrimary')}
            </Link>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-8 text-app-text-subtle text-sm">
            {(['aiPowered', 'noCoding', 'deployFast', 'openSource'] as const).map((pill) => (
              <div key={pill} className="flex items-center gap-2 bg-app-surface-muted backdrop-blur-sm rounded-full px-4 py-2 border border-app-border">
                <svg className="w-5 h-5 text-app-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{t(`pills.${pill}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div id="how-it-works" className="bg-app-surface backdrop-blur-sm py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-app-text text-center mb-12">
            {t('howItWorks.heading')}
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-app-surface/10 backdrop-blur-sm rounded-2xl p-8 space-y-4 border border-app-border">
                <div className="w-12 h-12 bg-app-accent-blue rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">{n}</span>
                </div>
                <h3 className="text-2xl font-bold text-app-text">
                  {t(`howItWorks.step${n}Title` as const)}
                </h3>
                <p className="text-app-text-subtle">{t(`howItWorks.step${n}Body` as const)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-app-text">
            {t('cta.heading')}
          </h2>
          <p className="text-xl text-app-text-subtle">{t('cta.body')}</p>
          <Link
            to="/register"
            className="inline-block px-10 py-4 bg-app-accent-blue text-white text-lg rounded-lg hover:bg-app-accent-dark-blue transition-all font-semibold shadow-xl"
          >
            {t('cta.button')}
          </Link>
        </div>
      </div>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-app-surface/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-app-text">
            {t('footer.contact')}
          </h2>
          <p className="text-xl text-app-text-subtle">
            Have questions or need support? Reach out to us at:
          </p>
          <a
            href="mailto:salpkirisci@gmail.com"
            className="inline-block px-8 py-3 bg-app-surface hover:bg-app-surface-hover text-app-text text-xl font-semibold rounded-lg transition-all border border-app-border"
          >
            salpkirisci@gmail.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-app-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-app-text-subtle text-sm">{t('footer.copyright')}</p>
            <div className="flex items-center gap-6 text-app-text-subtle text-sm">
              <a href="https://github.com/CustomERP411/CustomERP" target="_blank" rel="noopener noreferrer" className="hover:text-app-accent-blue transition-colors">{t('footer.github')}</a>
              <a href="#contact" className="hover:text-app-accent-blue transition-colors">{t('footer.contact')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
