import { useState, ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import LanguageSelector from '../components/common/LanguageSelector';
import BrandMark from '../components/brand/BrandMark';
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
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 p-12 flex-col justify-between relative">
        <Link
          to="/"
          className="absolute top-8 right-8 flex items-center text-indigo-100 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('landing:nav.signIn') /* fallback in layout; not critical */}
        </Link>

        <div>
          <BrandMark variant="wordmark" className="h-16 sm:h-20 md:h-24 w-auto max-w-lg object-left object-contain" />
          <p className="text-indigo-200 mt-4">{t('landing:hero.subtitle')}</p>
        </div>

        <p className="text-indigo-300 text-sm">{t('landing:footer.copyright')}</p>
      </div>

      {/* Right Panel - Login Form */}
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
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">{t('auth:login.title')}</h2>
              <p className="text-gray-600 mt-2">{t('auth:login.subtitle')}</p>
            </div>

            {apiError && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 text-sm font-medium">{apiError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label={t('auth:login.emailLabel')}
                type="email"
                name="email"
                placeholder={t('auth:login.emailPlaceholder')}
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
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
              />

              <Button type="submit" loading={loading} className="w-full" size="lg">
                {loading ? t('auth:login.submitting') : t('auth:login.submit')}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                {t('auth:login.noAccount')}{' '}
                <Link to="/register" className="text-indigo-600 font-semibold hover:text-indigo-500">
                  {t('auth:login.createOne')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
