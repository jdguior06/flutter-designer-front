// lib/services/authService.ts
import { apiClient } from '../lib/api'

export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  rol: string;
  createdAt: string;
  _count?: {
    proyectos: number;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  name: string;
  email: string;
  password: string;
  rol?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

class AuthService {
  private tokenKey = 'token';
  private userKey = 'user';

  // Registro de usuario
  async register(userData: RegisterData): Promise<RegisterResponse> {
    try {
      const response = await apiClient.post('/auth/register', userData);
      console.log('✅ Registro exitoso');
      return response;
    } catch (error) {
      console.error('❌ Error en registro:', error);
      throw error;
    }
  }

  // Login
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiClient.post('/auth/login', credentials);
      
      // Guardar token y usuario en localStorage
      if (response.token && response.user) {
        this.setToken(response.token);
        this.setUser(response.user);
        console.log('✅ Login exitoso, token guardado');
      }
      
      return response;
    } catch (error) {
      console.error('❌ Error en login:', error);
      throw error;
    }
  }

  // Logout
  logout(): void {
    this.removeToken();
    this.removeUser();
    console.log('👋 Datos de sesión eliminados');
  }

  // Obtener usuario actual del localStorage
  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const userStr = localStorage.getItem(this.userKey);
      if (!userStr) return null;
      
      const user = JSON.parse(userStr);
      return user;
    } catch (error) {
      console.error('Error parseando usuario del localStorage:', error);
      this.removeUser(); // Limpiar datos corruptos
      return null;
    }
  }

  // Verificar si está autenticado
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  // Obtener token
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    return localStorage.getItem(this.tokenKey);
  }

  // Establecer token
  private setToken(token: string): void {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem(this.tokenKey, token);
  }

  // Eliminar token
  private removeToken(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(this.tokenKey);
  }

  // Establecer usuario
  private setUser(user: User): void {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  // Eliminar usuario
  private removeUser(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(this.userKey);
  }

  // Obtener usuario por ID (para verificar token)
  async getUserById(id: number): Promise<User> {
    try {
      const user = await apiClient.get(`/auth/${id}`);
      
      // Actualizar usuario en localStorage si es exitoso
      this.setUser(user);
      
      return user;
    } catch (error) {
      console.error('❌ Error obteniendo usuario:', error);
      throw error;
    }
  }

  // Verificar si el token sigue siendo válido
  async verifyToken(): Promise<boolean> {
    const user = this.getCurrentUser();
    if (!user) return false;

    try {
      await this.getUserById(user.id);
      return true;
    } catch (error) {
      console.warn('Token inválido');
      this.logout();
      return false;
    }
  }
}

export const authService = new AuthService();