import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AuthCtx {
  token: string | null;
  setToken: (t: string | null) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const STORAGE_KEY = 'admin_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const setToken = useCallback((t: string | null) => {
    if (t) localStorage.setItem(STORAGE_KEY, t);
    else localStorage.removeItem(STORAGE_KEY);
    setTokenState(t);
  }, []);
  const logout = useCallback(() => setToken(null), [setToken]);
  return <Ctx.Provider value={{ token, setToken, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}
