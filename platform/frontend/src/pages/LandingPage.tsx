import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

/**
 * Landing Page Component
 * Public home page that introduces CustomERP to unauthenticated users
 */
export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
        <header className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-indigo-600 font-bold text-xl">C</span>
            </div>
            <div className="text-2xl font-bold text-white">
              <span className="text-emerald-400">Custom</span>ERP
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="px-6 py-2 text-white hover:text-emerald-400 transition-colors font-medium"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all font-semibold shadow-lg"
            >
              Get Started
            </Link>
          </div>
        </header>

        {/* Hero Content */}
        <div className="text-center space-y-8 py-12">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
            Build Your Custom ERP
            <br />
            <span className="text-emerald-400">Without Writing Code</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-indigo-200 max-w-3xl mx-auto">
            Transform your business processes into a fully functional ERP system 
            using just natural language. Powered by AI.
          </p>

          <div className="flex items-center justify-center gap-4 pt-8">
            <Link
              to="/register"
              className="px-8 py-4 bg-emerald-500 text-white text-lg rounded-lg hover:bg-emerald-600 transition-all font-semibold shadow-xl"
            >
              Start Building Free
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white text-lg rounded-lg hover:bg-white/20 transition-all font-semibold"
            >
              See How It Works
            </a>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-8 text-white/80 text-sm">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>No Coding Required</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Deploy in Hours</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Open Source</span>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div id="how-it-works" className="bg-white/5 backdrop-blur-sm py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Three Simple Steps
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 space-y-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-2xl">1</span>
              </div>
              <h3 className="text-2xl font-bold text-white">
                Describe Your Business
              </h3>
              <p className="text-indigo-200">
                Tell us about your operations in plain English. No technical knowledge required.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 space-y-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-2xl">2</span>
              </div>
              <h3 className="text-2xl font-bold text-white">
                AI Generates Your System
              </h3>
              <p className="text-indigo-200">
                Our AI analyzes your needs and creates the perfect ERP structure automatically.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 space-y-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-2xl">3</span>
              </div>
              <h3 className="text-2xl font-bold text-white">
                Download & Deploy
              </h3>
              <p className="text-indigo-200">
                Get a ready-to-use Docker container with your custom ERP system.
              </p>
            </div>
          </div>

          {/* Quote */}
          <div className="mt-16 bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center">
            <p className="text-white text-xl font-medium italic">
              "Transform your business processes into a custom ERP system using just natural language."
            </p>
            <p className="text-emerald-400 mt-4 font-semibold">— The Assembly Architecture</p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Ready to Build Your ERP?
          </h2>
          <p className="text-xl text-indigo-200">
            Join businesses already using CustomERP to streamline their operations.
          </p>
          <Link
            to="/register"
            className="inline-block px-10 py-4 bg-emerald-500 text-white text-lg rounded-lg hover:bg-emerald-600 transition-all font-semibold shadow-xl"
          >
            Get Started for Free
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-indigo-300 text-sm">
              © 2026 CustomERP. Bilkent University CTIS Project.
            </p>
            <div className="flex items-center gap-6 text-indigo-300 text-sm">
              <a href="#" className="hover:text-white transition-colors">Documentation</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

