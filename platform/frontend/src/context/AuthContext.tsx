import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import type { User, AuthResponse, AuthContextType } from '../types/auth';

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

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (token && savedUser) {
        try {
          // Set user from localStorage first for faster UI
          setUser(JSON.parse(savedUser) as User);
          
          // Optionally verify token with backend
          // const res = await api.get('/auth/me');
          // setUser(res.data.user);
        } catch (error) {
          console.error('Auth verification failed:', error);
          // Clear invalid session
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      
      setLoading(false);
    };

    initAuth();
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
    
    return res.data;
  };

  /**
   * Register a new user
   */
  const register = async (name: string, email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/register', { name, email, password });
    const { token, user: userData } = res.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    
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

