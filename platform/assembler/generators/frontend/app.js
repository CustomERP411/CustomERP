function buildApp({ toolImports, imports, toolRoutes, routes, rbac }) {
  if (!rbac) {
    return `import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
${toolImports || ''}
${imports || ''}

function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<DashboardHome />} />
${toolRoutes || ''}
${routes || ''}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;`;
  }

  return `import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import LoginPage from './pages/LoginPage';
import RequireAuth from './components/RequireAuth';
import UsersAdminPage from './pages/admin/UsersAdminPage';
import GroupsAdminPage from './pages/admin/GroupsAdminPage';
import PermissionsAdminPage from './pages/admin/PermissionsAdminPage';
${toolImports || ''}
${imports || ''}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/admin/users" element={<UsersAdminPage />} />
        <Route path="/admin/groups" element={<GroupsAdminPage />} />
        <Route path="/admin/permissions" element={<PermissionsAdminPage />} />
${toolRoutes || ''}
${routes || ''}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;`;
}

module.exports = {
  buildApp,
};
