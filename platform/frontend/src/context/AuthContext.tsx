import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import type { User, AuthResponse, AuthContextType, UserLanguage } from '../types/auth';
import { normalizeLanguage, setAppLanguage } from '../i18n';

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 * Manages user authentication state and provides auth methods
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session: prefer server truth for is_admin (etc.) so demoted users cannot
  // use stale localStorage and open admin UIs that APIs reject with 403.
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser) as User;
          setUser(parsed);
          if (parsed.preferred_language) {
            void setAppLanguage(normalizeLanguage(parsed.preferred_language));
          }
        } catch (error) {
          console.error('Auth verification failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setLoading(false);
          return;
        }
      }

      try {
        const res = await api.get<{ user: User }>('/auth/me');
        const u = res.data.user;
        localStorage.setItem('user', JSON.stringify(u));
        setUser(u);
        if (u.preferred_language) {
          await setAppLanguage(normalizeLanguage(u.preferred_language));
        }
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    void initAuth();
  }, []);

  /**
   * Login with email and password
   */
  const login = async (email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    const { token, user: userData } = res.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    if (userData.preferred_language) {
      await setAppLanguage(normalizeLanguage(userData.preferred_language));
    }

    return res.data;
  };

  /**
   * Register a new user
   */
  const register = async (
    name: string,
    email: string,
    password: string,
    preferredLanguage: UserLanguage = 'en',
  ): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/register', {
      name,
      email,
      password,
      preferred_language: preferredLanguage,
    });
    const { token, user: userData } = res.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    if (userData.preferred_language) {
      await setAppLanguage(normalizeLanguage(userData.preferred_language));
    }

    return res.data;
  };

  /**
   * Logout the current user
   */
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  /**
   * Soft-delete account on backend, then clear local session.
   */
  const deleteAccount = async (): Promise<void> => {
    await api.delete('/auth/account');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  /**
   * Update user profile
   */
  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    deleteAccount,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

