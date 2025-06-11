import { apiClient } from '../lib/api';

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  screenId?: string;
}

export interface CreateMessageData {
  text: string;
  sender: string;
  timestamp?: number;
  screenId?: string;
}

export const messageService = {
  // Obtener mensajes
  async getMessages(screenId?: string): Promise<ChatMessage[]> {
    const params = screenId ? `?screenId=${screenId}` : '';
    return await apiClient.get(`/message${params}`);
  },

  // Crear mensaje
  async createMessage(messageData: CreateMessageData): Promise<{ message: string; data: ChatMessage }> {
    return await apiClient.post('/message', messageData);
  }
};