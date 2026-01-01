import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Placeholder pages - will be implemented in Task A2
function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold text-center mb-6">Login</h1>
        <p className="text-gray-500 text-center">Login page coming in Task A2</p>
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center text-white">
        <h1 className="text-5xl font-bold mb-4">CustomERP</h1>
        <p className="text-xl mb-8">AI-Powered ERP Generation Platform</p>
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6">
          <p className="text-lg">✅ React + Vite scaffolding complete</p>
          <p className="text-lg">✅ Tailwind CSS configured</p>
          <p className="text-lg">✅ React Router ready</p>
          <p className="text-lg">✅ Axios API service ready</p>
        </div>
        <div className="mt-8">
          <a 
            href="/login" 
            className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Go to Login
          </a>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

