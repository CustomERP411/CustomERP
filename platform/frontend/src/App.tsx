import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import MobileGate from './components/MobileGate';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import PreviewPage from './pages/PreviewPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import TrainingDataPage from './pages/TrainingDataPage';
import FeatureRequestsAdminPage from './pages/FeatureRequestsAdminPage';
import MyRequestsPage from './pages/MyRequestsPage';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';

function App() {
  return (
    <MobileGate>
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        } />
        <Route path="/register" element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        } />
        
        {/* Protected Routes */}
        <Route element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/projects/:id/preview" element={<PreviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/my/requests" element={<MyRequestsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/training" element={<TrainingDataPage />} />
          <Route path="/admin/feature-requests" element={<FeatureRequestsAdminPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
    </MobileGate>
  );
}

export default App;
