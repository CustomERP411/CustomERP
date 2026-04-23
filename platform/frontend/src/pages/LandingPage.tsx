import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/common/LanguageSelector';
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-12 sm:mb-16">
          <Link to="/" className="flex items-center min-w-0">
            <BrandMark
              variant="wordmark"
              className="h-8 sm:h-9 w-auto max-w-[min(100%,220px)] object-contain object-left"
            />
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <LanguageSelector variant="landing" />
            <Link
              to="/login"
              className="px-3 sm:px-6 py-2 text-xs sm:text-sm text-white hover:text-emerald-400 transition-colors font-medium"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              to="/register"
              className="px-3 sm:px-6 py-2 sm:py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all font-semibold shadow-lg text-xs sm:text-sm"
            >
              {t('nav.getStarted')}
            </Link>
          </div>
        </header>

        {/* Hero Content */}
        <div className="text-center space-y-6 sm:space-y-8 py-6 sm:py-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
            {t('hero.titleLine1')}
            <br />
            <span className="text-emerald-400">{t('hero.titleLine2')}</span>
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-indigo-200 max-w-3xl mx-auto">
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-6 sm:pt-8">
            <Link
              to="/register"
              className="px-6 sm:px-8 py-3 sm:py-4 bg-emerald-500 text-white text-base sm:text-lg rounded-lg hover:bg-emerald-600 transition-all font-semibold shadow-xl text-center"
            >
              {t('hero.ctaPrimary')}
            </Link>
            <a
              href="#how-it-works"
              className="px-6 sm:px-8 py-3 sm:py-4 bg-white/10 backdrop-blur-sm text-white text-base sm:text-lg rounded-lg hover:bg-white/20 transition-all font-semibold text-center"
            >
              {t('hero.ctaSecondary')}
            </a>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-8 text-white/80 text-sm">
            {(['aiPowered', 'noCoding', 'deployFast', 'openSource'] as const).map((pill) => (
              <div key={pill} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{t(`pills.${pill}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div id="how-it-works" className="bg-white/5 backdrop-blur-sm py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            {t('howItWorks.heading')}
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 space-y-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">{n}</span>
                </div>
                <h3 className="text-2xl font-bold text-white">
                  {t(`howItWorks.step${n}Title` as const)}
                </h3>
                <p className="text-indigo-200">{t(`howItWorks.step${n}Body` as const)}</p>
              </div>
            ))}
          </div>

          {/* Quote */}
          <div className="mt-16 bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center">
            <p className="text-white text-xl font-medium italic">
              "{t('howItWorks.quote')}"
            </p>
            <p className="text-emerald-400 mt-4 font-semibold">{t('howItWorks.quoteAttribution')}</p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            {t('cta.heading')}
          </h2>
          <p className="text-xl text-indigo-200">{t('cta.body')}</p>
          <Link
            to="/register"
            className="inline-block px-10 py-4 bg-emerald-500 text-white text-lg rounded-lg hover:bg-emerald-600 transition-all font-semibold shadow-xl"
          >
            {t('cta.button')}
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-indigo-300 text-sm">{t('footer.copyright')}</p>
            <div className="flex items-center gap-6 text-indigo-300 text-sm">
              <a href="#" className="hover:text-white transition-colors">{t('footer.docs')}</a>
              <a href="#" className="hover:text-white transition-colors">{t('footer.github')}</a>
              <a href="#" className="hover:text-white transition-colors">{t('footer.contact')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
