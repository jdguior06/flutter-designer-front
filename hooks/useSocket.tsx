import { useEffect, useRef, useCallback } from 'react';
import { socketManager } from '../lib/socket';

export const useSocket = (projectId?: string) => {
  const socketRef = useRef<any>(null);

  useEffect(() => {
    socketRef.current = socketManager.connect();

    if (projectId) {
      socketManager.joinProject(projectId);
    }

    return () => {
      if (projectId) {
        socketManager.leaveProject(projectId);
      }
    };
  }, [projectId]);

  const emit = useCallback((event: string, data: any) => {
    socketManager.emit(event, data);
  }, []);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    socketManager.on(event, callback);
  }, []);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    socketManager.off(event, callback);
  }, []);

  const updateElements = useCallback((screenId: string, elements: any[]) => {
    if (projectId) {
      socketManager.updateElements(projectId, screenId, elements);
    }
  }, [projectId]);

  const isConnected = useCallback(() => {
    return socketManager.isConnected();
  }, []);

  return { emit, on, off, updateElements, isConnected };
};