import { apiClient } from '../lib/api';

export interface ScreenData {
  id: string;
  name: string;
  elements: any[];
  proyectoId: number;
  createdAt: string;
  updatedAt: string;
  proyecto?: {
    id: number;
    name: string;
    deviceType: string;
  };
}

export interface CreateScreenData {
  name: string;
  elements?: any[];
  proyectoId: number;
}

export interface UpdateScreenData {
  name?: string;
  elements?: any[];
}

export const screenService = {
  // Crear pantalla
  async createScreen(screenData: CreateScreenData): Promise<{ message: string; screen: ScreenData }> {
    return await apiClient.post('/screen', screenData);
  },

  // Obtener pantalla por ID
  async getScreenById(id: string): Promise<ScreenData> {
    return await apiClient.get(`/screen/${id}`);
  },

  // Actualizar pantalla
  async updateScreen(id: string, screenData: UpdateScreenData): Promise<{ message: string; screen: ScreenData }> {
    return await apiClient.put(`/screen/${id}`, screenData);
  },

  // Eliminar pantalla
  async deleteScreen(id: string): Promise<{ message: string }> {
    return await apiClient.delete(`/screen/${id}`);
  }
};