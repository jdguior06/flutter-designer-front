import { apiClient } from '../lib/api';

export interface Project {
  id: number;
  name: string;
  description?: string;
  deviceType: string;
  userId: number;
  createdAt: string;
  screens: Screen[];
  user: {
    id: number;
    name: string;
    username: string;
  };
}

export interface Screen {
  id: string;
  name: string;
  createdAt: string;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  deviceType: string;
  userId: number;
}

export interface UpdateProjectData {
  name?: string;
  link?: string;
  deviceType?: string;
}

export const projectService = {
  // Obtener proyectos por usuario
  async getProjectsByUser(userId: number): Promise<Project[]> {
    return await apiClient.get(`/proyectos/user/${userId}`);
  },

  // Crear proyecto
  async createProject(projectData: CreateProjectData): Promise<{ message: string; project: Project }> {
    return await apiClient.post('/proyectos', projectData);
  },

  // Obtener proyecto por ID
  async getProjectById(id: number): Promise<Project> {
    return await apiClient.get(`/proyectos/${id}`);
  },

  // Actualizar proyecto
  async updateProject(id: number, projectData: UpdateProjectData): Promise<{ message: string; project: Project }> {
    return await apiClient.put(`/proyectos/${id}`, projectData);
  },

  // Eliminar proyecto
  async deleteProject(id: number): Promise<{ message: string }> {
    return await apiClient.delete(`/proyectos/${id}`);
  }
};