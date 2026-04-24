import { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import LanguageSelector from '../components/common/LanguageSelector';
import ThemeToggle from '../components/common/ThemeToggle';
import BrandMark from '../components/brand/BrandMark';
import AuthSidePuzzle from '../components/auth/AuthSidePuzzle';
import { normalizeLanguage, setAppLanguage, type SupportedLanguage } from '../i18n';
import type { RegisterFormData, FormErrors } from '../types/auth';
import { AxiosError } from 'axios';

export default function RegisterPage() {
  const { i18n, t } = useTranslation(['auth', 'landing']);

  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    preferredLanguage: normalizeLanguage(i18n.language),
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();

  // Keep the registration form's initial language in sync with the UI language
  // if the user changes it via other means before interacting with the picker.
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      preferredLanguage: normalizeLanguage(i18n.language),
    }));
  }, [i18n.language]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (apiError) setApiError('');
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setFormData((prev) => ({ ...prev, preferredLanguage: lang }));
    // Preview the UI change so the user experiences the chosen language immediately.
    void setAppLanguage(lang);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name) {
      newErrors.name = t('auth:register.errors.nameRequired');
    }

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

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('auth:register.errors.passwordMismatch');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth:register.errors.passwordMismatch');
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
      await register(
        formData.name,
        formData.email,
        formData.password,
        formData.preferredLanguage,
      );
      navigate('/projects', { replace: true });
    } catch (error) {
      console.error('Registration error:', error);
      const axiosError = error as AxiosError<{ error: string }>;
      setApiError(
        axiosError.response?.data?.error || t('auth:register.errors.generic'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-app-bg transition-colors duration-200">
      {/* Left Panel — same puzzle-piece jigsaw as the sign-in screen, so the
       *  auth flow stays visually cohesive with the landing page. */}
      <div className="hidden lg:flex lg:w-1/2 bg-app-surface p-10 xl:p-12 flex-col justify-between relative border-r border-app-border">
        <Link
          to="/"
          className="absolute top-6 right-6 z-10 flex items-center text-app-text-subtle hover:text-app-accent-blue transition-colors"
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

      {/* Right Panel - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 bg-app-bg relative">
        {/* Only the theme toggle lives here — the form itself has the
         *  preferred-language picker (that also previews the UI language),
         *  so a second selector in the corner would be redundant. */}
        <div className="absolute top-4 right-4 flex items-center gap-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-6 sm:mb-8">
            <BrandMark variant="wordmark" className="h-14 w-auto max-w-[min(100%,380px)] sm:h-16 object-contain" />
          </div>

          <div className="bg-app-surface/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 sm:p-8 border border-app-border">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-app-text">{t('auth:register.title')}</h2>
              <p className="text-app-text-subtle mt-1">{t('auth:register.subtitle')}</p>
            </div>

            {apiError && (
              <div className="mb-4 p-3 rounded-lg bg-app-danger-soft border border-app-danger-border flex items-start gap-3">
                <svg className="w-5 h-5 text-app-danger mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-app-danger text-sm font-medium">{apiError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                label={t('auth:register.nameLabel')}
                type="text"
                name="name"
                placeholder={t('auth:register.namePlaceholder')}
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                autoComplete="name"
                className="bg-app-surface/50 border-app-border-strong text-app-text focus:ring-app-accent-blue"
              />

              <Input
                label={t('auth:register.emailLabel')}
                type="email"
                name="email"
                placeholder={t('auth:register.emailPlaceholder')}
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
                className="bg-app-surface/50 border-app-border-strong text-app-text focus:ring-app-accent-blue"
              />

              <Input
                label={t('auth:register.passwordLabel')}
                type="password"
                name="password"
                placeholder={t('auth:register.passwordPlaceholder')}
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                autoComplete="new-password"
                className="bg-app-surface/50 border-app-border-strong text-app-text focus:ring-app-accent-blue"
              />

              <Input
                label={t('auth:register.confirmPasswordLabel')}
                type="password"
                name="confirmPassword"
                placeholder={t('auth:register.confirmPasswordPlaceholder')}
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                autoComplete="new-password"
                className="bg-app-surface/50 border-app-border-strong text-app-text focus:ring-app-accent-blue"
              />

              {/* Preferred language picker with prominent info note */}
              <div className="pt-2">
                <label className="block text-sm font-medium text-app-text-subtle mb-1.5">
                  {t('auth:register.languageLabel')}
                </label>
                <LanguageSelector
                  value={formData.preferredLanguage}
                  onChange={handleLanguageChange}
                  syncToAccount={false}
                />
                <div className="mt-2 rounded-md border-l-4 border-app-accent-blue bg-app-surface-muted px-3 py-2 text-xs leading-relaxed text-app-text-subtle">
                  <strong>{t('auth:register.languageLabel')}: </strong>
                  {t('auth:register.languageInfo')}
                </div>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full bg-app-accent-blue hover:bg-app-accent-dark-blue text-white py-2.5 rounded-lg font-semibold transition-all shadow-lg mt-2"
                size="lg"
              >
                {loading ? t('auth:register.submitting') : t('auth:register.submit')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-app-text-subtle">
                {t('auth:register.haveAccount')}{' '}
                <Link to="/login" className="text-app-accent-blue font-semibold hover:text-app-accent-dark-blue">
                  {t('auth:register.signIn')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
