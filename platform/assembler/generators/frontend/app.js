function buildApp({ toolImports, imports, toolRoutes, routes }) {
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

module.exports = {
  buildApp,
};


