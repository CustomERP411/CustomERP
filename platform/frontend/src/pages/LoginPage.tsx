import { useState, ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import LanguageSelector from '../components/common/LanguageSelector';
import BrandMark from '../components/brand/BrandMark';
import ThemeToggle from '../components/common/ThemeToggle';
import AuthSidePuzzle from '../components/auth/AuthSidePuzzle';
import type { LoginFormData, FormErrors } from '../types/auth';
import { AxiosError } from 'axios';

interface LocationState {
  from?: {
    pathname: string;
  };
}

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(['auth', 'landing']);

  const state = location.state as LocationState;
  const from = state?.from?.pathname || '/projects';

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (apiError) setApiError('');
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = t('auth:register.errors.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('auth:register.errors.emailInvalid');
    }

    if (!formData.password) {
      newErrors.password = t('auth:register.errors.passwordRequired');
    } else if (formData.password.length < 8) {
      newErrors.password = t('auth:register.errors.passwordTooShort');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    setApiError('');

    try {
      await login(formData.email, formData.password);
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      const axiosError = error as AxiosError<{ error: string }>;
      setApiError(axiosError.response?.data?.error || t('auth:login.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-app-bg transition-colors duration-200">
      {/* Left Panel — puzzle-piece brand + "how it works" steps. Mirrors the
       *  landing page's jigsaw so the sign-in flow feels like a continuation
       *  of the marketing surface instead of a disconnected form screen. */}
      <div className="hidden lg:flex lg:w-1/2 bg-app-surface p-10 xl:p-12 flex-col justify-between relative border-r border-app-border">
        <Link
          to="/"
          className="absolute top-4 right-6 z-10 flex items-center text-app-text-subtle hover:text-app-accent-blue transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('common:back')}
        </Link>

        <div className="mx-auto w-full max-w-xl">
          <AuthSidePuzzle />
        </div>

        <p className="text-app-text-muted text-sm">{t('landing:footer.copyright')}</p>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 bg-app-bg relative">
        <div className="absolute top-4 right-4 flex items-center gap-4">
          <ThemeToggle />
          <LanguageSelector compact />
        </div>
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-6 sm:mb-8">
            <BrandMark variant="wordmark" className="h-14 w-auto max-w-[min(100%,380px)] sm:h-16 object-contain" />
          </div>

          <div className="bg-app-surface/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 sm:p-8 border border-app-border">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-app-text">{t('auth:login.title')}</h2>
              <p className="text-app-text-subtle mt-1">{t('auth:login.subtitle')}</p>
            </div>

            {apiError && (
              <div className="bg-app-danger-soft border border-app-danger-border text-app-danger p-3 rounded-lg text-sm">
                {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={t('auth:login.emailLabel')}
                type="email"
                name="email"
                placeholder={t('auth:login.emailPlaceholder')}
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
                className="w-full px-4 py-2 rounded-lg border border-app-border-strong bg-app-surface/50 text-app-text focus:ring-2 focus:ring-app-accent-blue outline-none transition-all"
              />

              <Input
                label={t('auth:login.passwordLabel')}
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                autoComplete="current-password"
                className="w-full px-4 py-2 rounded-lg border border-app-border-strong bg-app-surface/50 text-app-text focus:ring-2 focus:ring-app-accent-blue outline-none transition-all"
              />

              <Button
                type="submit"
                loading={loading}
                className="w-full bg-app-accent-blue hover:bg-app-accent-dark-blue text-white py-2.5 rounded-lg font-semibold transition-all shadow-lg mt-2"
                size="lg"
              >
                {loading ? t('auth:login.submitting') : t('auth:login.submit')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-app-text-subtle">
                {t('auth:login.noAccount')}{' '}
                <Link to="/register" className="text-app-accent-blue font-semibold hover:text-app-accent-dark-blue">
                  {t('auth:login.signUpLink')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
