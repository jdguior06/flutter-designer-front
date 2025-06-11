'use client';

import { useParams } from 'next/navigation';
import DesignerWorkspace from "@/components/designer-workspace";
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ProjectEditorPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <ProtectedRoute>
      <main className="flex min-h-screen flex-col">
        <header className="border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Flutter UI Designer</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Proyecto ID: {projectId}
              </span>
              <a
                href="/dashboard"
                className="text-sm text-blue-600 hover:text-blue-900"
              >
                ← Volver al Dashboard
              </a>
              <a
                href="https://github.com/yourusername/flutter-ui-designer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                GitHub
              </a>
            </div>
          </div>
        </header>

        <DesignerWorkspace projectId={projectId} />
      </main>
    </ProtectedRoute>
  );
}