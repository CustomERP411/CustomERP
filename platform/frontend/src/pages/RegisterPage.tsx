import { useState, ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import type { RegisterFormData, FormErrors } from '../types/auth';
import { AxiosError } from 'axios';

/**
 * Register Page Component
 * Handles new user registration
 */
export default function RegisterPage() {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (apiError) setApiError('');
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      await register(formData.name, formData.email, formData.password);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Registration error:', error);
      const axiosError = error as AxiosError<{ error: string }>;
      setApiError(
        axiosError.response?.data?.error || 
        'Registration failed. Please try again.'
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
          Back to Home
        </Link>

        <div>
          <h1 className="text-4xl font-bold text-white">CustomERP</h1>
          <p className="text-emerald-200 mt-2">AI-Powered ERP Generation</p>
        </div>
        
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-white">
            Start Building Your Custom ERP Today
          </h2>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">1</span>
              </div>
              <div>
                <p className="text-white font-medium">Describe Your Business</p>
                <p className="text-emerald-200 text-sm">Tell us about your operations in plain English</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">2</span>
              </div>
              <div>
                <p className="text-white font-medium">AI Generates Your System</p>
                <p className="text-emerald-200 text-sm">Our AI creates the perfect ERP structure</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">3</span>
              </div>
              <div>
                <p className="text-white font-medium">Download & Deploy</p>
                <p className="text-emerald-200 text-sm">Get a ready-to-use Docker container</p>
              </div>
            </li>
          </ul>
        </div>
        
        <p className="text-emerald-300 text-sm">
          © 2026 CustomERP. Bilkent University CTIS Project.
        </p>
      </div>

      {/* Right Panel - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-emerald-600">CustomERP</h1>
            <p className="text-gray-600">AI-Powered ERP Generation</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
              <p className="text-gray-600 mt-1">Get started with your free account</p>
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
                label="Full Name"
                type="text"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                autoComplete="name"
              />

              <Input
                label="Email Address"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
              />

              <Input
                label="Password"
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                autoComplete="new-password"
              />

              <Input
                label="Confirm Password"
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />

              <div className="flex items-start pt-1">
                <input 
                  type="checkbox" 
                  id="terms"
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mt-1" 
                />
                <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
                  I agree to the{' '}
                  <a href="#" className="text-emerald-600 hover:text-emerald-500">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="text-emerald-600 hover:text-emerald-500">Privacy Policy</a>
                </label>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 mt-2"
                size="lg"
              >
                Create Account
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-500">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

