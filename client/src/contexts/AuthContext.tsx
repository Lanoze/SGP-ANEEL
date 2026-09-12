import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../lib/api';
import type { Usuario } from '../types';

interface AuthContextType {
  user: Usuario | null;
  token: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('sgp_token');
    const storedUser = localStorage.getItem('sgp_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoaded(true);
  }, []);

  async function login(email: string, senha: string) {
    const { data } = await api.post('/auth/login', { email, senha });
    localStorage.setItem('sgp_token', data.token);
    localStorage.setItem('sgp_user', JSON.stringify(data.usuario));
    setToken(data.token);
    setUser(data.usuario);
  }

  function logout() {
    localStorage.removeItem('sgp_token');
    localStorage.removeItem('sgp_user');
    setToken(null);
    setUser(null);
  }

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
