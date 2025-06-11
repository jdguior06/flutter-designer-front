'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { projectService, Project } from '../../services/projectService';
import { Plus, FolderOpen, Trash2, Edit3, Share2, Copy, Check, MoreVertical } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Estados para modales
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newName, setNewName] = useState('');
  const [sharingProject, setSharingProject] = useState<Project | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  const loadProjects = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const projectsData = await projectService.getProjectsByUser(user.id);
      setProjects(projectsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: number, projectName: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar "${projectName}"?`)) {
      return;
    }

    try {
      await projectService.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err: any) {
      alert('Error al eliminar el proyecto: ' + err.message);
    }
  };

  const handleRenameProject = async (project: Project) => {
    setEditingProject(project);
    setNewName(project.name);
    setDropdownOpen(null);
  };

  const saveRename = async () => {
    if (!editingProject || !newName.trim()) return;

    try {
      await projectService.updateProject(editingProject.id, {
        name: newName.trim()
      });
      setProjects(projects.map(p => 
        p.id === editingProject.id 
          ? { ...p, name: newName.trim() }
          : p
      ));

      setEditingProject(null);
      setNewName('');
    } catch (err: any) {
      alert('Error al renombrar el proyecto: ' + err.message);
    }
  };

  const cancelRename = () => {
    setEditingProject(null);
    setNewName('');
  };

  // Función simplificada para compartir (solo genera link directo)
  const handleShareProject = (project: Project) => {
    setSharingProject(project);
    setDropdownOpen(null);
  };

  // Función para copiar link al portapapeles
  const copyToClipboard = async (projectId: number) => {
    try {
      const fullUrl = `${window.location.origin}/project/${projectId}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = `${window.location.origin}/project/${projectId}`;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Flutter Designer
                </h1>
                <p className="text-sm text-gray-500">
                  Bienvenido, {user?.name}
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/project/new')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Plus size={16} />
                  <span>Nuevo Proyecto</span>
                </button>
                
                <button
                  onClick={logout}
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando proyectos...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">Error: {error}</p>
              <button 
                onClick={loadProjects}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <FolderOpen className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Proyectos</p>
                      <p className="text-2xl font-semibold text-gray-900">{projects.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Edit3 className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Pantallas</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {projects.reduce((total, project) => total + project.screens.length, 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {user?.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Usuario Activo</p>
                      <p className="text-lg font-semibold text-gray-900">{user?.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Projects Grid */}
              {projects.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow">
                  <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No hay proyectos</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Comienza creando tu primer proyecto de Flutter.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={() => router.push('/project/new')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto"
                    >
                      <Plus size={16} />
                      <span>Crear Primer Proyecto</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <div key={project.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {project.name}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {project.deviceType}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {project.screens.length} pantalla{project.screens.length !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                              Creado: {formatDate(project.createdAt)}
                            </p>
                          </div>
                          
                          <div className="relative">
                            <button
                              onClick={() => setDropdownOpen(dropdownOpen === project.id ? null : project.id)}
                              className="text-gray-400 hover:text-gray-600 p-1"
                              title="Más opciones"
                            >
                              <MoreVertical size={16} />
                            </button>
                            
                            {dropdownOpen === project.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                                <div className="py-1">
                                  <button
                                    onClick={() => handleRenameProject(project)}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <Edit3 size={16} className="mr-2" />
                                    Renombrar
                                  </button>
                                  <button
                                    onClick={() => handleShareProject(project)}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <Share2 size={16} className="mr-2" />
                                    Compartir
                                  </button>
                                  <hr className="my-1" />
                                  <button
                                    onClick={() => {
                                      setDropdownOpen(null);
                                      handleDeleteProject(project.id, project.name);
                                    }}
                                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 size={16} className="mr-2" />
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-6">
                          <button
                            onClick={() => {
                              setDropdownOpen(null);
                              router.push(`/project/${project.id}`);
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                          >
                            Abrir Proyecto
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        {editingProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Renombrar Proyecto
              </h3>
              
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nuevo nombre del proyecto"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveRename();
                  if (e.key === 'Escape') cancelRename();
                }}
              />
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={cancelRename}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveRename}
                  disabled={!newName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {sharingProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Compartir Proyecto
              </h3>
              
              <p className="text-sm text-gray-600 mb-4">
                Comparte este enlace para que otros puedan ver tu proyecto:
              </p>
              
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="text"
                  value={`${window.location.origin}/project/${sharingProject.id}`}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                />
                <button
                  onClick={() => copyToClipboard(sharingProject.id)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                  title="Copiar enlace"
                >
                  {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              
              {copiedLink && (
                <p className="text-sm text-green-600 mb-4">
                  ¡Enlace copiado al portapapeles!
                </p>
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Nota:</strong> Cualquier persona con este enlace podrá ver tu proyecto.
                </p>
              </div>
              
              <button
                onClick={() => setSharingProject(null)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {dropdownOpen && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setDropdownOpen(null)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}