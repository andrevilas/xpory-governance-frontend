import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '../components/ProtectedRoute';
import { AlertsPage } from '../pages/alerts/AlertsPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { InstancesPage } from '../pages/instances/InstancesPage';
import { LoginPage } from '../pages/login/LoginPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { StacksLocalPage } from '../pages/stacks-local/StacksLocalPage';
import { UpdatePage } from '../pages/updates/UpdatePage';

export function AppRouter(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<ProtectedRoute />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="instances" element={<InstancesPage />} />
          <Route path="stacks" element={<StacksLocalPage />} />
          <Route path="updates" element={<UpdatePage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
