import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../context/auth/useAuth';

export function ProtectedRoute(): JSX.Element {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
