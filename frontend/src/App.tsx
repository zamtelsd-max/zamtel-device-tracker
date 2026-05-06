import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DevicesPoolPage from './pages/DevicesPoolPage';
import MyDevicesPage from './pages/MyDevicesPage';
import ClosureQueuePage from './pages/ClosureQueuePage';
import ReportsPage from './pages/ReportsPage';
import AdminPage from './pages/AdminPage';
import MapDevicePage from './pages/MapDevicePage';
import NetworkImportPage from './pages/NetworkImportPage';
import Layout from './components/Layout';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zamtel-green" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  const getDefaultRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'trade_auditor': return '/my-devices';
      case 'back_office': return '/closure-queue';
      default: return '/dashboard';
    }
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to={getDefaultRoute()} replace />} />
        <Route path="dashboard" element={<ProtectedRoute roles={['project_manager', 'head_of_sales', 'project_lead', 'back_office']}><DashboardPage /></ProtectedRoute>} />
        <Route path="devices-pool" element={<ProtectedRoute roles={['trade_auditor', 'project_lead']}><DevicesPoolPage /></ProtectedRoute>} />
        <Route path="my-devices" element={<ProtectedRoute roles={['trade_auditor', 'project_lead']}><MyDevicesPage /></ProtectedRoute>} />
        <Route path="map-devices" element={<ProtectedRoute roles={['trade_auditor', 'project_lead', 'project_manager', 'head_of_sales']}><MapDevicePage /></ProtectedRoute>} />
        <Route path="network-import" element={<ProtectedRoute roles={['project_lead', 'project_manager', 'head_of_sales']}><NetworkImportPage /></ProtectedRoute>} />
        <Route path="closure-queue" element={<ProtectedRoute roles={['back_office', 'project_lead']}><ClosureQueuePage /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute roles={['project_manager', 'head_of_sales', 'project_lead']}><ReportsPage /></ProtectedRoute>} />
        <Route path="admin" element={<ProtectedRoute roles={['project_lead']}><AdminPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </HashRouter>
    </AuthProvider>
  );
}
