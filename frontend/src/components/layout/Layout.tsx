import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '../../utils/cn';

const titleMap: Record<string, string> = {
  '/': 'Visão Geral',
  '/faturamento': 'Faturamento',
  '/marketing': 'Marketing',
  '/comercial': 'Comercial',
  '/atendimento': 'Atendimento',
  '/administrativo': 'Administrativo Financeiro',
  '/metas': 'Quadro de Metas',
  '/pacientes': 'Pacientes',
};

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const title = titleMap[location.pathname] || 'Dashboard';

  return (
    <div className="min-h-screen bg-dark-bg">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div
        className={cn(
          'transition-all duration-300',
          sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        <Header title={title} />

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
