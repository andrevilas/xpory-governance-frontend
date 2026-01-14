import { createContext, useCallback, useMemo, useState } from 'react';

type AuthContextValue = {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [token, setToken] = useState(() => localStorage.getItem('xpory_token'));

  const login = useCallback((nextToken: string) => {
    localStorage.setItem('xpory_token', nextToken);
    setToken(nextToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('xpory_token');
    setToken(null);
  }, []);

  const value = useMemo(() => ({ token, login, logout }), [token, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
