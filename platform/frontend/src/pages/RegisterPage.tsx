import { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import LanguageSelector from '../components/common/LanguageSelector';
import BrandMark from '../components/brand/BrandMark';
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
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-12 flex-col justify-between relative">
        <Link
          to="/"
          className="absolute top-8 right-8 flex items-center text-emerald-100 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('landing:nav.signIn')}
        </Link>

        <div>
          <BrandMark variant="wordmark" className="h-16 sm:h-20 md:h-24 w-auto max-w-lg object-left object-contain" />
          <p className="text-emerald-200 mt-4">{t('landing:hero.subtitle')}</p>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-white">
            {t('landing:hero.titleLine1')}
          </h2>
          <ul className="space-y-4">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">{n}</span>
                </div>
                <div>
                  <p className="text-white font-medium">{t(`landing:howItWorks.step${n}Title` as const)}</p>
                  <p className="text-emerald-200 text-sm">{t(`landing:howItWorks.step${n}Body` as const)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-emerald-300 text-sm">{t('landing:footer.copyright')}</p>
      </div>

      {/* Right Panel - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 relative">
        <div className="absolute top-4 right-4">
          <LanguageSelector compact />
        </div>
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-6 sm:mb-8">
            <BrandMark variant="wordmark" className="h-14 w-auto max-w-[min(100%,380px)] sm:h-16 object-contain" />
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{t('auth:register.title')}</h2>
              <p className="text-gray-600 mt-1">{t('auth:register.subtitle')}</p>
            </div>

            {apiError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 text-sm font-medium">{apiError}</p>
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
              />

              {/* Preferred language picker with prominent info note */}
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('auth:register.languageLabel')}
                </label>
                <LanguageSelector
                  value={formData.preferredLanguage}
                  onChange={handleLanguageChange}
                  syncToAccount={false}
                />
                <div className="mt-2 rounded-md border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
                  <strong>{t('auth:register.languageLabel')}: </strong>
                  {t('auth:register.languageInfo')}
                </div>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 mt-2"
                size="lg"
              >
                {loading ? t('auth:register.submitting') : t('auth:register.submit')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                {t('auth:register.haveAccount')}{' '}
                <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-500">
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
