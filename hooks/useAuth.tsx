'use client';

import { useState, useEffect, useContext, createContext, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authService, User, LoginCredentials, RegisterData } from '../services/authService';

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<any>;
  register: (userData: RegisterData) => Promise<any>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = authService.getCurrentUser();
        const token = authService.getToken();

        if (currentUser && token) {
          try {
            await authService.getUserById(currentUser.id);
            setUser(currentUser);
          } catch (error) {
            console.warn('Token inválido, limpiando sesión');
            authService.logout();
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error inicializando auth:', error);
        authService.logout();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      const response = await authService.login(credentials);
      setUser(response.user);
      
      console.log('Login exitoso:', response.user.name);
      return response;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (userData: RegisterData) => {
    try {
      setLoading(true);
      const response = await authService.register(userData);
      
      console.log('Registro exitoso:', response.user.name);
      return response;
    } catch (error) {
      console.error('Error en registro:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    console.log('👋 Sesión cerrada');
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    if (!user) return;

    try {
      const updatedUser = await authService.getUserById(user.id);
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      logout();
    }
  }, [user, logout]);

  // Verificar token periódicamente (cada 5 minutos)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        await authService.getUserById(user.id);
      } catch (error) {
        console.warn('Token expirado, cerrando sesión');
        logout();
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [user, logout]);

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};