import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

class SocketManager {
  private socket: Socket | null = null;
  private currentProjectId: string | null = null;

  connect(): Socket {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000,
      });
      
      this.socket.on('connect', () => {
        console.log('🔌 Conectado a Socket.IO');
        
        if (this.currentProjectId) {
          console.log('🔄 Reconectando al proyecto:', this.currentProjectId);
          this.joinProject(this.currentProjectId);
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Desconectado de Socket.IO:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Error de conexión Socket.IO:', error);
      });
    }
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentProjectId = null; 
      console.log('Socket.IO desconectado manualmente');
    }
  }

  emit(event: string, data: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
      console.log('Enviando evento:', event, data);
    } else {
      console.warn('Socket no conectado, no se puede enviar:', event);
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Unirse a una sala de proyecto
  joinProject(projectId: string): void {
    this.currentProjectId = projectId; 
    this.emit('join-project', { projectId });
  }

  // Salir de una sala de proyecto
  leaveProject(projectId: string): void {
    this.currentProjectId = null; 
    this.emit('leave-project', { projectId });
  }

  // Enviar actualización de elementos
  updateElements(projectId: string, screenId: string, elements: any[]): void {
    if (!projectId || !screenId || !Array.isArray(elements)) {
      console.warn('Datos inválidos para updateElements:', { projectId, screenId, elements });
      return;
    }

    this.emit('update-elements', { 
      projectId, 
      screenId, 
      elements,
      timestamp: Date.now()
    });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

export const socketManager = new SocketManager();