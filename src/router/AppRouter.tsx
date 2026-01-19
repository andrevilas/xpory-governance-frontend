import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { MasterRoute } from '../components/MasterRoute';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AlertsPage } from '../pages/alerts/AlertsPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { InstancesPage } from '../pages/instances/InstancesPage';
import { LoginPage } from '../pages/login/LoginPage';
import { NotificationRecipientsPage } from '../pages/notifications/NotificationRecipientsPage';
import { NotificationRulesPage } from '../pages/notifications/NotificationRulesPage';
import { StacksLocalPage } from '../pages/stacks-local/StacksLocalPage';
import { StacksLocalVariablesPage } from '../pages/stacks-local/StacksLocalVariablesPage';
import { StacksLocalVersionsPage } from '../pages/stacks-local/StacksLocalVersionsPage';
import { UpdatePage } from '../pages/updates/UpdatePage';
import { UsersPage } from '../pages/users/UsersPage';

export function AppRouter(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<ProtectedRoute />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="instances" element={<InstancesPage />} />
          <Route path="stacks">
            <Route index element={<StacksLocalPage />} />
            <Route path="variables" element={<StacksLocalVariablesPage />} />
            <Route path="versions" element={<StacksLocalVersionsPage />} />
          </Route>
          <Route path="updates" element={<UpdatePage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="notifications">
            <Route index element={<Navigate to="recipients" replace />} />
            <Route path="recipients" element={<NotificationRecipientsPage />} />
            <Route path="rules" element={<NotificationRulesPage />} />
          </Route>
          <Route path="users" element={<MasterRoute />}>
            <Route index element={<UsersPage />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
