import React, { useState, useRef, useEffect } from "react";
import { Upload, Type, Image, Wand2, X, Mic, MicOff } from "lucide-react";
import { DesignElement } from "@/lib/types";
import { GoogleGenerativeAI } from "@google/generative-ai";

type DesignElementWithoutId = Omit<DesignElement, "id">;

interface AIDesignPanelProps {
  addScreenIA: (name: string, elements?: DesignElementWithoutId[]) => string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AIDesignPanel({
  addScreenIA,
  isOpen,
  onClose,
}: AIDesignPanelProps) {
  const [activeTab, setActiveTab] = useState<"text" | "sketch">("text");
  const [loading, setLoading] = useState(false);
  const [textPrompt, setTextPrompt] = useState("");
  const [screenName, setScreenName] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para reconocimiento de voz
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Ejemplos de prompts predefinidos
  const promptExamples = [
    {
      title: "Login Screen",
      prompt:
        "Pantalla de login con logo, campos de email y contraseña, botón de iniciar sesión y enlace de registro",
    },
    {
      title: "Perfil de Usuario",
      prompt:
        "Pantalla de perfil con avatar circular, información personal, botones de editar y configuración",
    },
    {
      title: "Dashboard",
      prompt:
        "Dashboard con tarjetas de estadísticas, gráficos y lista de actividades recientes",
    },
    {
      title: "Lista de Productos",
      prompt:
        "Pantalla de e-commerce con lista de productos, filtros, barra de búsqueda y carrito",
    },
    {
      title: "Chat",
      prompt:
        "Interfaz de chat con lista de mensajes, input de texto y botón de envío",
    },
  ];

  // Cleanup recognition
  useEffect(() => {
    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [recognition]);

  // Función para iniciar/detener reconocimiento de voz
  const toggleSpeechRecognition = () => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      alert(
        "Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge."
      );
      return;
    }

    if (isListening) {
      // Detener reconocimiento
      if (recognition) {
        recognition.stop();
      }
      setIsListening(false);
    } else {
      // Iniciar reconocimiento
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const newRecognition = new SpeechRecognition();

      newRecognition.continuous = true;
      newRecognition.interimResults = true;
      newRecognition.lang = "es-ES"; // Español

      newRecognition.onstart = () => {
        setIsListening(true);
      };

      newRecognition.onresult = (event) => {
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setTextPrompt((prev) => {
            const newText = prev
              ? `${prev} ${finalTranscript}`
              : finalTranscript;
            return newText;
          });
        }
      };

      newRecognition.onerror = (event) => {
        console.error("Error de reconocimiento:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          alert(
            "Permiso denegado para el micrófono. Habilita el acceso en la configuración del navegador."
          );
        }
      };

      newRecognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(newRecognition);
      newRecognition.start();
    }
  };

  if (!isOpen) return null;

  const handleImageUpload = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleImageUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  // Función mejorada para extraer JSON
  const extractJsonFromString = (str: string): any => {
    try {
      // Limpiar la respuesta de markdown y otros caracteres
      let cleanStr = str.replace(/```json\n?/g, "").replace(/```\n?/g, "");

      // Buscar el array JSON
      const startIndex = cleanStr.indexOf("[");
      const endIndex = cleanStr.lastIndexOf("]");

      if (startIndex === -1 || endIndex === -1) {
        throw new Error("No se encontró un array JSON válido");
      }

      const jsonString = cleanStr.substring(startIndex, endIndex + 1);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error("Error extrayendo JSON:", error);
      throw error;
    }
  };

  // Función mejorada para llamar a Gemini con texto
  const generateFromText = async (prompt: string) => {
    const systemPrompt = `
  Eres un experto diseñador de interfaces móviles. Genera un array de elementos para una pantalla basándote en la descripción del usuario.

  **REGLAS CRÍTICAS:**
  1. **FORMATO:** Devuelve SOLO un array JSON válido, sin explicaciones ni markdown
  2. **TIPOS PERMITIDOS ÚNICAMENTE:** "button", "textField", "card", "icon", "container", "inputWithLabel"
  3. **SIN NESTING:** No uses la propiedad "children", todos los elementos son de nivel raíz
  4. **SIN ID:** No incluyas la propiedad "id"
  5. **NÚMEROS VÁLIDOS:** Todas las propiedades numéricas deben ser números enteros

  **COORDENADAS Y DIMENSIONES:**
  - x, y: Posición absoluta (0-360 ancho, 0-640 alto)
  - width, height: Dimensiones lógicas (mínimo 50x30)
  - Espaciado mínimo: 20px entre elementos

  **PROPIEDADES OBLIGATORIAS POR TIPO:**
  
  **BUTTON:**
  - text: string (ej: "Login")
  - color: string hex (ej: "#2196F3")
  - textColor: string hex (ej: "#FFFFFF")
  - padding: number (ej: 16)
  - rounded: boolean (ej: true)

  **TEXTFIELD/INPUTWITHLABEL:**
  - label: string (ej: "Email")
  - hint: string (ej: "Enter your email")
  - padding: number (ej: 16)

  **CARD:**
  - title: string (ej: "Card Title")
  - content: string (ej: "Card description")
  - padding: number (ej: 16)
  - color: string hex (ej: "#FFFFFF")
  - borderRadius: number (ej: 8)
  - elevation: number (ej: 2)

  **ICON:**
  - name: string (ej: "star", "home", "user", "mail")
  - size: number (ej: 24)
  - color: string hex (ej: "#000000")

  **CONTAINER:**
  - color: string hex (ej: "#F5F5F5")
  - padding: number (ej: 16)
  - borderRadius: number (ej: 8)

  **COLORES VÁLIDOS:** Solo formato hex (#RRGGBB)
  **ICONOS VÁLIDOS:** star, home, user, mail, phone, settings, search, heart, plus, minus

  **EJEMPLO PERFECTO:**
  [
    {
      "type": "container",
      "x": 20,
      "y": 50,
      "width": 320,
      "height": 400,
      "properties": {
        "color": "#FFFFFF",
        "padding": 20,
        "borderRadius": 12
      }
    },
    {
      "type": "icon",
      "x": 160,
      "y": 80,
      "width": 60,
      "height": 60,
      "properties": {
        "name": "user",
        "size": 48,
        "color": "#2196F3"
      }
    },
    {
      "type": "inputWithLabel",
      "x": 40,
      "y": 160,
      "width": 280,
      "height": 60,
      "properties": {
        "label": "Email",
        "hint": "Enter your email",
        "padding": 16
      }
    },
    {
      "type": "button",
      "x": 40,
      "y": 240,
      "width": 280,
      "height": 50,
      "properties": {
        "text": "Sign In",
        "color": "#2196F3",
        "textColor": "#FFFFFF",
        "padding": 16,
        "rounded": true
      }
    }
  ]

  **DESCRIPCIÓN DEL USUARIO:**
  ${prompt}
  
  **IMPORTANTE:** Devuelve SOLO el array JSON, nada más.
  `;

    try {
      const genAI = new GoogleGenerativeAI(
        process.env.NEXT_PUBLIC_API_KEY_IA ?? ""
      );
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const result = await model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();

      console.log("Respuesta de Gemini (texto):", text);
      return extractJsonFromString(text);
    } catch (error) {
      console.error("Error generando desde texto:", error);
      throw error;
    }
  };

  // Función para analizar boceto con Gemini Vision
  const generateFromSketch = async (
    imageBase64: string,
    description: string = ""
  ) => {
    const systemPrompt = `
Analiza este boceto/wireframe dibujado a mano y genera elementos de UI móvil correspondientes.

INSTRUCCIONES DE ANÁLISIS:

1. IDENTIFICAR ELEMENTOS:
   - Texto escrito = títulos, labels, placeholders
   - Rectángulos largos y delgados = textFields (campos de entrada)
   - Rectángulos con texto = buttons
   - Tablas/grids con líneas = dynamicTable
   - Rectángulos grandes = containers o cards
   - Círculos pequeños = icons

2. INTERPRETAR POSICIONES:
   - Parte superior = y: 50-150
   - Parte media = y: 150-400
   - Parte inferior = y: 400-600
   - Elementos alineados horizontalmente = mismo valor y
   - Elementos centrados = x alrededor de 180

3. RECONOCER PATRONES:
   - Si veo una tabla con columnas y filas → usar "dynamicTable"
   - Si veo un campo largo con texto → usar "textField"
   - Si veo texto grande solo → usar "card" con título
   - Si veo rectángulo con palabra → usar "button"

4. COORDENADAS: 
   - Pantalla: 360x640px
   - Márgenes: 20px a cada lado
   - Elementos principales: width entre 280-320px

5. PARA TABLAS:
   - Identificar nombres de columnas del boceto
   - Crear datos de ejemplo realistas
   - Usar showHeader: true y showBorder: true

TIPOS PERMITIDOS ÚNICAMENTE: "button", "textField", "card", "icon", "container", "dynamicTable"

EJEMPLO DE TABLA EN BOCETO:
Si veo columnas como Nombre, Apellido, Edad con filas de datos, generar un dynamicTable con:
- columns: formato JSON string con las columnas identificadas
- data: formato JSON string con datos de ejemplo
- showHeader: true
- showBorder: true

${description ? `CONTEXTO ADICIONAL: ${description}` : ""}

IMPORTANTE: 
- Lee EXACTAMENTE el texto visible en el boceto
- Usa esos textos como labels y títulos reales
- Si veo "Buscar" → hint: "Buscar..."
- Si veo "Home" → title: "Home"
- Mantén las proporciones del dibujo

Devuelve SOLO el array JSON, sin explicaciones.
`;

    try {
      const genAI = new GoogleGenerativeAI(
        process.env.NEXT_PUBLIC_API_KEY_IA ?? ""
      );
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Convertir imagen para Gemini
      const imagePart = {
        inlineData: {
          data: imageBase64.split(",")[1],
          mimeType: "image/jpeg",
        },
      };

      const result = await model.generateContent([systemPrompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      console.log("Respuesta de Gemini (boceto):", text);
      return extractJsonFromString(text);
    } catch (error) {
      console.error("Error generando desde boceto:", error);
      throw error;
    }
  };

  // Función para validar y limpiar elementos
  const parseAndValidateElements = (
    elements: any[]
  ): DesignElementWithoutId[] => {
    return elements.map((element: any, index: number) => {
      console.log(`🔍 Validando elemento ${index}:`, element);

      // Remover children si existe
      const { children, id, ...cleanElement } = element;

      // Validar y asegurar que tenemos un tipo válido
      const validTypes = [
        "button",
        "textField",
        "card",
        "icon",
        "container",
        "row",
        "column",
        "stack",
        "switch",
        "checkbox",
        "radio",
        "chatInput",
        "chatMessage",
        "dropdown",
        "inputWithLabel",
        "switchWithLabel",
        "radioWithLabel",
        "checkboxWithLabel",
        "dynamicTable",
      ];

      if (!validTypes.includes(cleanElement.type)) {
        console.warn(
          `⚠️ Tipo inválido "${cleanElement.type}" en elemento ${index}, usando "container"`
        );
        cleanElement.type = "container";
      }

      // Validar y corregir coordenadas (asegurar que son números)
      cleanElement.x = Math.max(0, Math.min(360, Number(cleanElement.x) || 20));
      cleanElement.y = Math.max(0, Math.min(640, Number(cleanElement.y) || 50));

      // Validar y corregir dimensiones (asegurar que son números)
      cleanElement.width = Math.max(50, Number(cleanElement.width) || 100);
      cleanElement.height = Math.max(30, Number(cleanElement.height) || 50);

      // Asegurar límites de pantalla
      if (cleanElement.x + cleanElement.width > 360) {
        cleanElement.width = 360 - cleanElement.x;
      }
      if (cleanElement.y + cleanElement.height > 640) {
        cleanElement.height = 640 - cleanElement.y;
      }

      // Inicializar propiedades si no existen
      if (
        !cleanElement.properties ||
        typeof cleanElement.properties !== "object"
      ) {
        cleanElement.properties = {};
      }

      // Agregar propiedades por defecto según el tipo
      switch (cleanElement.type) {
        case "button":
          cleanElement.properties = {
            text: "Button",
            color: "#2196F3",
            textColor: "#FFFFFF",
            padding: 16,
            rounded: true,
            variant: "primary",
            ...cleanElement.properties,
          };
          cleanElement.properties.padding =
            Number(cleanElement.properties.padding) || 16;
          break;

        case "textField":
        case "inputWithLabel":
          cleanElement.properties = {
            label: "Label",
            hint: "Enter text",
            padding: 16,
            hasIcon: false,
            validation: false,
            ...cleanElement.properties,
          };
          cleanElement.properties.padding =
            Number(cleanElement.properties.padding) || 16;
          break;

        case "container":
          cleanElement.properties = {
            color: "#F5F5F5",
            padding: 16,
            margin: 8,
            borderRadius: 8,
            ...cleanElement.properties,
          };
          cleanElement.properties.padding =
            Number(cleanElement.properties.padding) || 16;
          cleanElement.properties.margin =
            Number(cleanElement.properties.margin) || 8;
          cleanElement.properties.borderRadius =
            Number(cleanElement.properties.borderRadius) || 8;
          break;

        case "icon":
          cleanElement.properties = {
            name: "star",
            size: 24,
            color: "#000000",
            ...cleanElement.properties,
          };
          cleanElement.properties.size =
            Number(cleanElement.properties.size) || 24;
          break;

        case "card":
          cleanElement.properties = {
            title: "Card Title",
            content: "Card content",
            padding: 16,
            color: "#FFFFFF",
            borderRadius: 8,
            elevation: 2,
            showImage: false,
            imageHeight: 120,
            ...cleanElement.properties,
          };
          cleanElement.properties.padding =
            Number(cleanElement.properties.padding) || 16;
          cleanElement.properties.borderRadius =
            Number(cleanElement.properties.borderRadius) || 8;
          cleanElement.properties.elevation =
            Number(cleanElement.properties.elevation) || 2;
          cleanElement.properties.imageHeight =
            Number(cleanElement.properties.imageHeight) || 120;
          break;

        default:
          cleanElement.type = "container";
          cleanElement.properties = {
            color: "#F5F5F5",
            padding: 16,
            borderRadius: 8,
            ...cleanElement.properties,
          };
          cleanElement.properties.padding =
            Number(cleanElement.properties.padding) || 16;
          cleanElement.properties.borderRadius =
            Number(cleanElement.properties.borderRadius) || 8;
      }

      console.log(`✅ Elemento ${index} validado:`, cleanElement);
      return cleanElement;
    });
  };

  const handleGenerate = async () => {
    if (!screenName.trim()) {
      alert("Por favor ingresa un nombre para la pantalla");
      return;
    }

    if (activeTab === "text" && !textPrompt.trim()) {
      alert("Por favor ingresa una descripción");
      return;
    }

    if (activeTab === "sketch" && !uploadedImage) {
      alert("Por favor sube un boceto");
      return;
    }

    setLoading(true);
    try {
      let elements;

      if (activeTab === "text") {
        elements = await generateFromText(textPrompt);
      } else {
        elements = await generateFromSketch(uploadedImage!, textPrompt);
      }

      const validatedElements = parseAndValidateElements(elements);

      // Crear la pantalla
      await addScreenIA(screenName, validatedElements);

      // Limpiar formulario
      setTextPrompt("");
      setScreenName("");
      setUploadedImage(null);
      if (recognition) {
        recognition.stop();
      }
      setIsListening(false);

      // Cerrar panel
      onClose();
    } catch (error) {
      console.error("Error generando diseño:", error);
      alert("Error generando el diseño. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold flex items-center">
            <Wand2 className="mr-2" size={24} />
            Generar Pantalla con IA
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Nombre de la pantalla */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Nombre de la pantalla
            </label>
            <input
              type="text"
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
              placeholder="Ej: Login, Perfil, Dashboard..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tabs */}
          <div className="flex border-b mb-4">
            <button
              onClick={() => setActiveTab("text")}
              className={`flex items-center px-4 py-2 font-medium ${
                activeTab === "text"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Type className="mr-2" size={16} />
              Descripción de Texto
            </button>
            <button
              onClick={() => setActiveTab("sketch")}
              className={`flex items-center px-4 py-2 font-medium ${
                activeTab === "sketch"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Image className="mr-2" size={16} />
              Boceto / Imagen
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "text" ? (
            <div className="space-y-4">
              {/* Ejemplos de prompts */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Ejemplos rápidos
                </label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {promptExamples.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setTextPrompt(example.prompt);
                        setScreenName(example.title);
                      }}
                      className="p-2 text-left border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      <div className="font-medium">{example.title}</div>
                      <div className="text-gray-600 text-xs truncate">
                        {example.prompt.substring(0, 60)}...
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea para prompt con micrófono integrado */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Describe la pantalla que quieres crear
                </label>

                {/* Área de texto con micrófono */}
                <div className="relative">
                  <textarea
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    placeholder="Describe detalladamente la pantalla que quieres crear o presiona el micrófono para dictar..."
                    className="w-full h-32 px-3 py-2 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />

                  {/* Botón de micrófono */}
                  <button
                    onClick={toggleSpeechRecognition}
                    disabled={loading}
                    className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isListening
                        ? "bg-red-500 hover:bg-red-600 animate-pulse"
                        : "bg-blue-500 hover:bg-blue-600"
                    } text-white shadow-md`}
                    title={
                      isListening
                        ? "Detener dictado"
                        : "Iniciar dictado por voz"
                    }
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                </div>

                {/* Indicador de estado */}
                {isListening && (
                  <div className="flex items-center mt-2 text-red-600 text-sm">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                    Escuchando... Habla ahora
                  </div>
                )}

                <div className="text-xs text-gray-500 mt-1">
                  Tip: Presiona el micrófono para dictar directamente al texto o
                  escribe manualmente
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Upload area */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Sube tu boceto o wireframe
                </label>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragOver
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {uploadedImage ? (
                    <div className="relative">
                      <img
                        src={uploadedImage}
                        alt="Boceto subido"
                        className="max-w-full max-h-48 mx-auto rounded-lg"
                      />
                      <button
                        onClick={() => setUploadedImage(null)}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload
                        className="mx-auto mb-4"
                        size={48}
                        color="#6B7280"
                      />
                      <div className="text-lg font-medium mb-2">
                        Arrastra tu imagen aquí
                      </div>
                      <div className="text-gray-600 mb-4">
                        o haz click para seleccionar
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Seleccionar archivo
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Formatos soportados: JPG, PNG, GIF. La IA analizará tu boceto
                  y generará los elementos correspondientes.
                </div>
              </div>

              {/* Descripción opcional para bocetos */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Descripción adicional (opcional)
                </label>
                <textarea
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="Agrega contexto adicional sobre tu boceto si es necesario..."
                  className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={
              loading ||
              !screenName.trim() ||
              (activeTab === "text" && !textPrompt.trim()) ||
              (activeTab === "sketch" && !uploadedImage)
            }
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Generando...
              </>
            ) : (
              <>
                <Wand2 className="mr-2" size={16} />
                Generar Pantalla
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
