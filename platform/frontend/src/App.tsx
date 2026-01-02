import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

interface DashboardCardProps {
  title: string;
  value: string;
  description: string;
  color: 'indigo' | 'emerald' | 'amber';
}

/**
 * Dashboard Card Component
 */
function DashboardCard({ title, value, description, color }: DashboardCardProps) {
  const colors: Record<DashboardCardProps['color'], string> = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className="text-sm mt-2 opacity-70">{description}</p>
    </div>
  );
}

/**
 * Logout Button Component
 */
function LogoutButton() {
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <button 
      onClick={handleLogout}
      className="text-gray-600 hover:text-gray-900 font-medium"
    >
      Logout
    </button>
  );
}

/**
 * Dashboard placeholder - will be implemented in Task A3
 */
function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-600">CustomERP</h1>
          <LogoutButton />
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h2>
          <p className="text-gray-600 mb-6">
            Welcome to CustomERP! This dashboard will be implemented in Task A3.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DashboardCard 
              title="Projects" 
              value="0" 
              description="ERP generation projects"
              color="indigo"
            />
            <DashboardCard 
              title="Generated" 
              value="0" 
              description="Completed ERPs"
              color="emerald"
            />
            <DashboardCard 
              title="Pending" 
              value="0" 
              description="Awaiting approval"
              color="amber"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Home page - redirects based on auth status
 */
function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800">
      <div className="text-center text-white max-w-2xl px-6">
        <h1 className="text-5xl font-bold mb-4">CustomERP</h1>
        <p className="text-xl text-indigo-200 mb-8">
          AI-Powered ERP Generation Platform
        </p>
        <p className="text-indigo-100 mb-12">
          Transform your business processes into a custom ERP system using natural language.
          No coding required.
        </p>
        <div className="flex gap-4 justify-center">
          <a 
            href="/login"
            className="px-8 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Sign In
          </a>
          <a 
            href="/register"
            className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition"
          >
            Get Started
          </a>
        </div>
        <div className="mt-16 grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold">70%</div>
            <div className="text-indigo-200 text-sm">AI Accuracy</div>
          </div>
          <div>
            <div className="text-3xl font-bold">&lt;4h</div>
            <div className="text-indigo-200 text-sm">Deployment Time</div>
          </div>
          <div>
            <div className="text-3xl font-bold">0</div>
            <div className="text-indigo-200 text-sm">Lines of Code</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main App Component
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route 
            path="/login" 
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            } 
          />
          
          {/* Protected routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

