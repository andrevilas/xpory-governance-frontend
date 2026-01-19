import { createContext, useCallback, useMemo, useState } from 'react';

import { decodeJwt, isTokenExpired } from '../../utils/jwt';

type AuthContextValue = {
  token: string | null;
  role: string | null;
  userId: string | null;
  isMaster: boolean;
  login: (token: string) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [token, setToken] = useState(() => localStorage.getItem('xpory_token'));
  const payload = useMemo(() => (token ? decodeJwt(token) : null), [token]);
  const role = payload?.role ?? null;
  const userId = payload?.sub ?? null;
  const isMaster = role === 'admin_master';

  const login = useCallback((nextToken: string) => {
    localStorage.setItem('xpory_token', nextToken);
    setToken(nextToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('xpory_token');
    setToken(null);
  }, []);

  const value = useMemo(() => ({
    token: isTokenExpired(payload) ? null : token,
    role: isTokenExpired(payload) ? null : role,
    userId: isTokenExpired(payload) ? null : userId,
    isMaster: !isTokenExpired(payload) && isMaster,
    login,
    logout,
  }), [token, role, userId, isMaster, login, logout, payload]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
