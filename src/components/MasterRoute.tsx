import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../context/auth/useAuth';

export function MasterRoute(): JSX.Element {
  const { token, isMaster } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!isMaster) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <Outlet />;
}
