"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

// Importar servicios del backend
import { useAuth } from "@/hooks/useAuth";
import { projectService } from "@/services/projectService";
import { screenService } from "@/services/screenService";
import { messageService } from "@/services/messageService";

// Componentes existentes
import ComponentsSidebar from "./components-sidebar";
import DesignCanvas from "./design-canvas";
import PropertiesPanel from "./properties-panel";
import PreviewPanel from "./preview-panel";
import ExportPanel from "./export-panel";
import ScreensManager from "./screens-manager";
import ChatPanel from "./chat-panel";
import type {
  ComponentType,
  DesignElement,
  DeviceType,
  Screen,
  ChatMessage,
} from "@/lib/types";
import { generateFlutterCode } from "@/lib/code-generator";
import {
  getDefaultHeight,
  getDefaultProperties,
  getDefaultWidth,
} from "@/lib/properties";
import {
  RotateCcw,
  RotateCw,
  Trash2,
  Eye,
  Code,
  MessageSquare,
  Moon,
  Sun,
  Save,
  Cloud,
  CheckCircle,
} from "lucide-react";
import { DownloadZipButton } from "./export-flutter";
import IaImage from "./ia-image";
import IaExample from "./ia-example";
import { useSocket } from "@/hooks/useSocket";

import AIDesignPanel from "./ai-design-panel";
import { Wand2, Sparkles } from "lucide-react";

interface DesignerWorkspaceProps {
  projectId: string;
}

export default function DesignerWorkspace({
  projectId,
}: DesignerWorkspaceProps) {
  const router = useRouter();
  const { user } = useAuth();

  const { on, off, updateElements } = useSocket(projectId);

  const [showAIPanel, setShowAIPanel] = useState(false);

  // Estados de proyecto y guardado
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Estados existentes del componente original
  const [screens, setScreens] = useState<Screen[]>([]);
  const [currentScreenId, setCurrentScreenId] = useState("");
  const currentScreenIdRef = useRef(currentScreenId);

  const [selectedElement, setSelectedElement] = useState<DesignElement | null>(
    null
  );
  const [history, setHistory] = useState<Record<string, DesignElement[][]>>({});
  const [historyIndex, setHistoryIndex] = useState<Record<string, number>>({});

  const [previewDevice, setPreviewDevice] = useState<DeviceType>("iphone13");
  const [canvasDevice, setCanvasDevice] = useState<DeviceType>("iphone13");
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Cargar proyecto al inicio
  useEffect(() => {
    if (projectId && user) {
      loadProject();
    }
  }, [projectId, user]);

  useEffect(() => {
    if (!projectId || !user) return;

    // Escuchar actualizaciones de elementos de otros usuarios
    const handleElementsUpdated = (data: any) => {
      const {
        projectId: updatedProjectId,
        screenId,
        elements,
        timestamp,
      } = data;

      // Solo actualizar si es el mismo proyecto pero diferente usuario
      if (updatedProjectId === projectId && screenId === currentScreenId) {
        console.log(
          "🔄 Elementos actualizados por otro usuario:",
          elements.length
        );

        // Actualizar los elementos sin triggerar el auto-save
        setScreens((prevScreens) => {
          return prevScreens.map((screen) => {
            if (screen.id === screenId) {
              return { ...screen, elements };
            }
            return screen;
          });
        });
      }
    };

    // Escuchar eventos de otros usuarios
    on("elements-updated", handleElementsUpdated);

    // Escuchar cuando alguien se une o sale
    on("user-joined", (data: any) => {
      console.log("👤 Usuario se unió al proyecto:", data.userName);
    });

    on("user-left", (data: any) => {
      console.log("👤 Usuario salió del proyecto:", data.userName);
    });

    return () => {
      off("elements-updated", handleElementsUpdated);
      off("user-joined");
      off("user-left");
    };
  }, [projectId, currentScreenId, user, on, off]);

  // Auto-guardar cada 30 segundos si hay cambios
  useEffect(() => {
    if (hasUnsavedChanges && currentProject && screens.length > 0) {
      const timer = setTimeout(() => {
        saveProject();
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, currentProject, screens]);

  // Marcar cambios no guardados cuando cambian las screens
  useEffect(() => {
    if (currentProject && screens.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [screens, currentProject]);

  // Función para cargar proyecto desde el backend
  const loadProject = async () => {
    if (!projectId || !user) return;

    try {
      setIsLoading(true);

      console.log("🔄 Cargando proyecto:", projectId);

      // Cargar proyecto
      const project = await projectService.getProjectById(parseInt(projectId));
      setCurrentProject(project);

      console.log("📁 Proyecto cargado:", project);

      // Convertir screens del backend al formato del componente
      if (project.screens && project.screens.length > 0) {
        const loadedScreens: Screen[] = project.screens.map((screen: any) => ({
          id: screen.id,
          name: screen.name,
          elements: Array.isArray(screen.elements) ? screen.elements : [],
        }));

        setScreens(loadedScreens);
        setCurrentScreenId(loadedScreens[0].id);

        // Inicializar historial para cada screen
        const newHistory: Record<string, DesignElement[][]> = {};
        const newHistoryIndex: Record<string, number> = {};

        loadedScreens.forEach((screen) => {
          newHistory[screen.id] = [screen.elements];
          newHistoryIndex[screen.id] = 0;
        });

        setHistory(newHistory);
        setHistoryIndex(newHistoryIndex);

        console.log("✅ Pantallas cargadas:", loadedScreens.length);
      } else {
        // Si no hay pantallas, crear una por defecto
        // console.log("No hay pantallas, creando pantalla por defecto");
        // await createDefaultScreen(project.id);
        console.error("El proyecto no tiene pantallas - error en backend");
        router.push("/dashboard");
        return;
      }

      // Cargar mensajes de chat
      if (currentScreenId) {
        await loadChatMessages();
      }

      setHasUnsavedChanges(false);
      console.log("✅ Proyecto cargado completamente");
    } catch (error) {
      console.error("❌ Error cargando proyecto:", error);
      // Si el proyecto no existe o hay error, redirigir al dashboard
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  // Crear pantalla por defecto si no existe
  // const createDefaultScreen = async (proyectoId: number) => {
  //   try {
  //     const response = await screenService.createScreen({
  //       name: 'Home',
  //       elements: [],
  //       proyectoId
  //     });

  //     const newScreen = response.screen;
  //     const screenData: Screen = {
  //       id: newScreen.id,
  //       name: newScreen.name,
  //       elements: []
  //     };

  //     setScreens([screenData]);
  //     setCurrentScreenId(newScreen.id);
  //     setHistory({ [newScreen.id]: [[]] });
  //     setHistoryIndex({ [newScreen.id]: 0 });

  //     console.log("✅ Pantalla por defecto creada:", newScreen.id);
  //   } catch (error) {
  //     console.error("❌ Error creando pantalla por defecto:", error);
  //   }
  // };

  // Función para guardar proyecto
  const saveProject = async () => {
    if (!currentProject || !user || isSaving || screens.length === 0) return;

    try {
      setIsSaving(true);
      console.log("💾 Guardando proyecto...");

      // Guardar cada screen
      for (const screen of screens) {
        await screenService.updateScreen(screen.id, {
          name: screen.name,
          elements: screen.elements,
        });
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      console.log("✅ Proyecto guardado exitosamente");
    } catch (error) {
      console.error("❌ Error guardando proyecto:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Función para cargar mensajes de chat
  const loadChatMessages = async () => {
    if (!currentScreenId) return;

    try {
      const messages = await messageService.getMessages(currentScreenId);
      const formattedMessages: ChatMessage[] = messages.map((msg) => ({
        id: msg.id,
        text: msg.text,
        sender: msg.sender,
        timestamp: parseInt(msg.timestamp),
      }));

      setChatMessages(formattedMessages);
    } catch (error) {
      console.error("❌ Error cargando mensajes:", error);
    }
  };

  useEffect(() => {
    currentScreenIdRef.current = currentScreenId;
    console.log("🔄 Pantalla actual cambiada a:", currentScreenId);

    if (currentProject && currentScreenId) {
      loadChatMessages();
    }
  }, [currentScreenId, currentProject]);

  // Get current screen elements
  const getCurrentScreenElements = useCallback(() => {
    const screenId = currentScreenIdRef.current;
    const currentScreen = screens.find((s) => s.id === screenId);
    if (!currentScreen) {
      console.error("❌ No se encontró la pantalla actual:", screenId);
      return [];
    }
    return currentScreen.elements;
  }, [screens]);

  // Update current screen elements
  const updateCurrentScreenElements = useCallback(
    (elements: DesignElement[]) => {
      const screenId = currentScreenIdRef.current;
      console.log(
        "📝 Actualizando elementos para pantalla:",
        screenId,
        "Elementos:",
        elements.length
      );

      setScreens((prevScreens) => {
        const updatedScreens = prevScreens.map((screen) => {
          if (screen.id === screenId) {
            return { ...screen, elements };
          }
          return screen;
        });
        return updatedScreens;
      });

      updateElements(screenId, elements);
    },
    [updateElements]
  );

  const addToHistory = useCallback(
    (newElements: DesignElement[]) => {
      const screenId = currentScreenIdRef.current;
      console.log(
        "📚 Agregando al historial para pantalla:",
        screenId,
        "Elementos:",
        newElements.length
      );

      setHistory((prevHistory) => {
        const currentHistory = prevHistory[screenId] || [[]];
        const currentIndex = historyIndex[screenId] || 0;

        const newHistory = currentHistory.slice(0, currentIndex + 1);
        newHistory.push([...newElements]);

        if (newHistory.length > 50) {
          newHistory.shift();
          return {
            ...prevHistory,
            [screenId]: newHistory,
          };
        }

        return {
          ...prevHistory,
          [screenId]: newHistory,
        };
      });

      setHistoryIndex((prevIndices) => {
        const currentIndex = prevIndices[screenId] || 0;
        const newIndex = Math.min(49, currentIndex + 1);

        return {
          ...prevIndices,
          [screenId]: newIndex,
        };
      });
    },
    [historyIndex]
  );

  const addElement = useCallback(
    (type: ComponentType, x: number, y: number) => {
      const screenId = currentScreenIdRef.current;
      console.log("➕ AGREGANDO ELEMENTO");

      const newElement: DesignElement = {
        id: `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        x,
        y,
        width: getDefaultWidth(type),
        height: getDefaultHeight(type),
        properties: getDefaultProperties(type),
        children: [],
      };

      setScreens((prevScreens) => {
        const currentScreenIndex = prevScreens.findIndex(
          (s) => s.id === screenId
        );
        if (currentScreenIndex === -1) return prevScreens;

        const updatedScreens = [...prevScreens];
        const currentScreen = { ...updatedScreens[currentScreenIndex] };
        const updatedElements = [...currentScreen.elements, newElement];
        currentScreen.elements = updatedElements;
        updatedScreens[currentScreenIndex] = currentScreen;

        updateElements(screenId, updatedElements);

        setTimeout(() => {
          addToHistory(updatedElements);
        }, 0);

        return updatedScreens;
      });

      setSelectedElement(newElement);
    },
    [addToHistory, updateElements]
  );

  const updateElement = useCallback(
    (id: string, updates: Partial<DesignElement>) => {
      const screenId = currentScreenIdRef.current;

      setScreens((prevScreens) => {
        const currentScreenIndex = prevScreens.findIndex(
          (s) => s.id === screenId
        );
        if (currentScreenIndex === -1) return prevScreens;

        const updatedScreens = [...prevScreens];
        const currentScreen = { ...updatedScreens[currentScreenIndex] };
        const updatedElements = currentScreen.elements.map((el) =>
          el.id === id ? { ...el, ...updates } : el
        );

        currentScreen.elements = updatedElements;
        updatedScreens[currentScreenIndex] = currentScreen;

        updateElements(screenId, updatedElements);

        setTimeout(() => {
          addToHistory(updatedElements);
        }, 0);

        return updatedScreens;
      });

      setSelectedElement((prevSelected) => {
        if (prevSelected && prevSelected.id === id) {
          return { ...prevSelected, ...updates };
        }
        return prevSelected;
      });
    },
    [addToHistory, updateElements]
  );

  const removeElement = useCallback(
    (id: string) => {
      const screenId = currentScreenIdRef.current;

      setScreens((prevScreens) => {
        const currentScreenIndex = prevScreens.findIndex(
          (s) => s.id === screenId
        );
        if (currentScreenIndex === -1) return prevScreens;

        const updatedScreens = [...prevScreens];
        const currentScreen = { ...updatedScreens[currentScreenIndex] };
        const updatedElements = currentScreen.elements.filter(
          (el) => el.id !== id
        );

        currentScreen.elements = updatedElements;
        updatedScreens[currentScreenIndex] = currentScreen;

        updateElements(screenId, updatedElements);

        setTimeout(() => {
          addToHistory(updatedElements);
        }, 0);

        return updatedScreens;
      });

      setSelectedElement((prevSelected) => {
        if (prevSelected && prevSelected.id === id) {
          return null;
        }
        return prevSelected;
      });
    },
    [addToHistory, updateElements]
  );

  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!user || !currentScreenId) return;

      try {
        const messageData = {
          text,
          sender: user.name,
          timestamp: Date.now(),
          screenId: currentScreenId,
        };

        const response = await messageService.createMessage(messageData);

        const newMessage: ChatMessage = {
          id: response.data.id,
          text: response.data.text,
          sender: response.data.sender,
          timestamp: parseInt(response.data.timestamp),
        };

        setChatMessages((prev) => [...prev, newMessage]);
      } catch (error) {
        console.error("❌ Error enviando mensaje:", error);
      }
    },
    [user, currentScreenId]
  );

  // Funciones de pantallas (usando backend)
  const addScreen = useCallback(
    async (name: string) => {
      if (!currentProject || !user) return;

      try {
        const screenData = {
          name,
          elements: [],
          proyectoId: currentProject.id,
        };

        const response = await screenService.createScreen(screenData);
        const newScreen = response.screen;

        const screenForState: Screen = {
          id: newScreen.id,
          name: newScreen.name,
          elements: newScreen.elements || [],
        };

        setScreens((prevScreens) => [...prevScreens, screenForState]);

        setHistory((prevHistory) => ({
          ...prevHistory,
          [newScreen.id]: [[]],
        }));

        setHistoryIndex((prevIndices) => ({
          ...prevIndices,
          [newScreen.id]: 0,
        }));

        setCurrentScreenId(newScreen.id);
        setSelectedElement(null);
      } catch (error) {
        console.error("Error creando pantalla:", error);
      }
    },
    [currentProject, user]
  );

  const deleteScreen = useCallback(
    async (id: string) => {
      if (screens.length <= 1) return;

      try {
        await screenService.deleteScreen(id);

        const newScreens = screens.filter((screen) => screen.id !== id);
        setScreens(newScreens);

        if (id === currentScreenId) {
          setCurrentScreenId(newScreens[0].id);
        }

        setHistory((prevHistory) => {
          const newHistory = { ...prevHistory };
          delete newHistory[id];
          return newHistory;
        });

        setHistoryIndex((prevIndices) => {
          const newIndices = { ...prevIndices };
          delete newIndices[id];
          return newIndices;
        });
      } catch (error) {
        console.error("Error eliminando pantalla:", error);
      }
    },
    [screens, currentScreenId]
  );

  const renameScreen = useCallback(async (id: string, name: string) => {
    try {
      await screenService.updateScreen(id, { name });
      setScreens((prevScreens) =>
        prevScreens.map((screen) =>
          screen.id === id ? { ...screen, name } : screen
        )
      );
    } catch (error) {
      console.error("Error renombrando pantalla:", error);
    }
  }, []);

  // Resto de funciones sin cambios (undo, redo, etc.)
  const undo = useCallback(() => {
    const screenId = currentScreenIdRef.current;
    const screenHistoryIndex = historyIndex[screenId] || 0;
    const screenHistory = history[screenId] || [[]];

    if (screenHistoryIndex > 0) {
      const newIndex = screenHistoryIndex - 1;
      const elementsToRestore = screenHistory[newIndex];

      setHistoryIndex((prevIndices) => ({
        ...prevIndices,
        [screenId]: newIndex,
      }));

      setScreens((prevScreens) => {
        const currentScreenIndex = prevScreens.findIndex(
          (s) => s.id === screenId
        );
        if (currentScreenIndex === -1) return prevScreens;

        const updatedScreens = [...prevScreens];
        const currentScreen = { ...updatedScreens[currentScreenIndex] };
        currentScreen.elements = [...elementsToRestore];
        updatedScreens[currentScreenIndex] = currentScreen;

        return updatedScreens;
      });

      setSelectedElement(null);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    const screenId = currentScreenIdRef.current;
    const screenHistoryIndex = historyIndex[screenId] || 0;
    const screenHistory = history[screenId] || [[]];

    if (screenHistoryIndex < screenHistory.length - 1) {
      const newIndex = screenHistoryIndex + 1;
      const elementsToRestore = screenHistory[newIndex];

      setHistoryIndex((prevIndices) => ({
        ...prevIndices,
        [screenId]: newIndex,
      }));

      setScreens((prevScreens) => {
        const currentScreenIndex = prevScreens.findIndex(
          (s) => s.id === screenId
        );
        if (currentScreenIndex === -1) return prevScreens;

        const updatedScreens = [...prevScreens];
        const currentScreen = { ...updatedScreens[currentScreenIndex] };
        currentScreen.elements = [...elementsToRestore];
        updatedScreens[currentScreenIndex] = currentScreen;

        return updatedScreens;
      });

      setSelectedElement(null);
    }
  }, [history, historyIndex]);

  const generateCode = useCallback(() => {
    return generateFlutterCode(screens, isDarkMode);
  }, [screens, isDarkMode]);

  const togglePreview = useCallback(() => {
    setShowPreview((prev) => !prev);
    setShowExport(false);
    setShowChat(false);
  }, []);

  const toggleExport = useCallback(() => {
    setShowExport((prev) => !prev);
    setShowPreview(false);
    setShowChat(false);
  }, []);

  const toggleChat = useCallback(() => {
    setShowChat((prev) => !prev);
    setShowPreview(false);
    setShowExport(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const screenId = currentScreenIdRef.current;

    setScreens((prevScreens) => {
      const currentScreenIndex = prevScreens.findIndex(
        (s) => s.id === screenId
      );
      if (currentScreenIndex === -1) return prevScreens;

      const updatedScreens = [...prevScreens];
      const currentScreen = { ...updatedScreens[currentScreenIndex] };
      currentScreen.elements = [];
      updatedScreens[currentScreenIndex] = currentScreen;

      return updatedScreens;
    });

    setSelectedElement(null);
    addToHistory([]);
  }, [addToHistory]);

  const navigateToScreen = useCallback(
    (screenId: string) => {
      if (screens.some((screen) => screen.id === screenId)) {
        console.log("🧭 Navegando a pantalla:", screenId);
        setCurrentScreenId(screenId);
      }
    },
    [screens]
  );

  const addScreenIA = useCallback(
    async (name: string, elements: Omit<DesignElement, "id">[] = []) => {
      if (!currentProject || !user) return;

      try {
        const processedElements = elements.map((element) => ({
          ...element,
          id: `element-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 4)}`,
          children:
            element.children?.map((child) => ({
              ...child,
              id: `child-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 4)}`,
            })) || [],
        }));

        const screenData = {
          name,
          elements: processedElements,
          proyectoId: currentProject.id,
        };

        const response = await screenService.createScreen(screenData);
        const newScreen = response.screen;

        const screenForState: Screen = {
          id: newScreen.id,
          name: newScreen.name,
          elements: newScreen.elements || [],
        };

        setScreens((prevScreens) => [...prevScreens, screenForState]);

        setHistory((prevHistory) => ({
          ...prevHistory,
          [newScreen.id]: [newScreen.elements || []],
        }));

        setHistoryIndex((prevIndices) => ({
          ...prevIndices,
          [newScreen.id]: 0,
        }));

        setCurrentScreenId(newScreen.id);
        setSelectedElement(null);

        return newScreen.id;
      } catch (error) {
        console.error("❌ Error creando pantalla IA:", error);
      }
    },
    [currentProject, user]
  );

  const currentScreen =
    screens.find((s) => s.id === currentScreenId) || screens[0];

  useEffect(() => {
    setSelectedElement(null);
  }, [currentScreenId]);

  useEffect(() => {
    const screenId = currentScreenId;

    if (screenId && !history[screenId]) {
      setHistory((prevHistory) => ({
        ...prevHistory,
        [screenId]: [[]],
      }));
    }

    if (screenId && historyIndex[screenId] === undefined) {
      setHistoryIndex((prevIndices) => ({
        ...prevIndices,
        [screenId]: 0,
      }));
    }
  }, [currentScreenId, history, historyIndex]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error: No se pudo cargar el proyecto</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={undo}
              disabled={
                !historyIndex[currentScreenId] ||
                historyIndex[currentScreenId] === 0
              }
              className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              title="Undo"
            >
              <RotateCcw size={20} />
            </button>

            <button
              onClick={redo}
              disabled={
                !history[currentScreenId] ||
                !historyIndex[currentScreenId] ||
                historyIndex[currentScreenId] ===
                  history[currentScreenId].length - 1
              }
              className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              title="Redo"
            >
              <RotateCw size={20} />
            </button>

            <div className="h-4 w-px bg-gray-300" />

            <button
              onClick={clearCanvas}
              className="rounded p-1 text-gray-600 hover:bg-gray-100"
              title="Clear Canvas"
            >
              <Trash2 size={20} />
            </button>

            <button
              onClick={saveProject}
              disabled={isSaving || !hasUnsavedChanges}
              className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              title="Guardar proyecto"
            >
              {isSaving ? (
                <Cloud size={20} className="animate-pulse" />
              ) : (
                <Save size={20} />
              )}
            </button>

            <span className="text-sm text-gray-500">
              Elements: {currentScreen ? currentScreen.elements.length : 0}
              {hasUnsavedChanges && (
                <span className="text-orange-500 ml-2">• Sin guardar</span>
              )}
              {lastSaved && !hasUnsavedChanges && (
                <span className="text-green-500 ml-2 flex items-center">
                  <CheckCircle size={14} className="mr-1" />
                  Guardado {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {currentProject && (
              <span className="text-sm text-gray-600 mr-4">
                Proyecto: {currentProject.name}
              </span>
            )}

            <button
              onClick={togglePreview}
              className={`rounded px-3 py-1 text-sm ${
                showPreview
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Eye size={16} className="inline mr-1" />
              Preview
            </button>

            <button
              onClick={toggleExport}
              className={`rounded px-3 py-1 text-sm ${
                showExport
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Code size={16} className="inline mr-1" />
              Export
            </button>

            <button
              onClick={toggleChat}
              className={`rounded px-3 py-1 text-sm ${
                showChat
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <MessageSquare size={16} className="inline mr-1" />
              Chat
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="rounded p-1 text-gray-600 hover:bg-gray-100"
              title={
                isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
              }
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        <ScreensManager
          screens={screens}
          currentScreenId={currentScreenId}
          onAddScreen={addScreen}
          onRenameScreen={renameScreen}
          onDeleteScreen={deleteScreen}
          onSelectScreen={setCurrentScreenId}
        />

        {/* <IaExample addScreenIA={addScreenIA} /> */}
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => setShowAIPanel(true)}
            className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-4 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 group"
            title="Generar pantalla con IA"
          >
            <div className="flex items-center">
              <Wand2
                size={24}
                className="group-hover:rotate-12 transition-transform duration-200"
              />
              <Sparkles size={16} className="ml-1 opacity-75 animate-pulse" />
            </div>
          </button>
        </div>

        <AIDesignPanel
          addScreenIA={addScreenIA}
          isOpen={showAIPanel}
          onClose={() => setShowAIPanel(false)}
        />

        <div className="flex flex-1 overflow-hidden">
          <ComponentsSidebar onAddElement={addElement} />

          <div className="flex flex-1 flex-col">
            <DownloadZipButton flutterCode={generateCode()} />
            {showPreview ? (
              <PreviewPanel
                elements={currentScreen ? currentScreen.elements : []}
                device={previewDevice}
                isDarkMode={isDarkMode}
                onDeviceChange={(device) => {
                  setPreviewDevice(device);
                  setCanvasDevice(device);
                }}
              />
            ) : showExport ? (
              <ExportPanel
                code={generateCode()}
                elements={currentScreen ? currentScreen.elements : []}
              />
            ) : showChat ? (
              <ChatPanel
                messages={chatMessages}
                onSendMessage={sendChatMessage}
              />
            ) : (
              <DesignCanvas
                elements={currentScreen ? currentScreen.elements : []}
                selectedElement={selectedElement}
                onSelectElement={setSelectedElement}
                onUpdateElement={updateElement}
                onRemoveElement={removeElement}
                isDarkMode={isDarkMode}
                onAddElement={addElement}
                deviceType={canvasDevice}
                onDeviceChange={setCanvasDevice}
                currentScreen={currentScreen}
                onNavigate={navigateToScreen}
              />
            )}
          </div>

          {!showPreview && !showExport && !showChat && (
            <PropertiesPanel
              selectedElement={selectedElement}
              onUpdateElement={updateElement}
              onRemoveElement={removeElement}
              screens={screens}
            />
          )}
        </div>
      </div>
    </DndProvider>
  );
}
