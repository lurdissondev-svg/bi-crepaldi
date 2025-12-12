import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Users,
  Target,
  UserCheck,
  FolderOpen,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { prefetchRoute } from '../../services/prefetch';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { name: 'Resumo', path: '/', icon: <LayoutDashboard size={20} /> },
  { name: 'Faturamento', path: '/faturamento', icon: <DollarSign size={20} /> },
  { name: 'Marketing', path: '/marketing', icon: <TrendingUp size={20} /> },
  { name: 'Comercial', path: '/comercial', icon: <ShoppingCart size={20} /> },
  { name: 'Atendimento', path: '/atendimento', icon: <UserCheck size={20} /> },
  { name: 'Administrativo Financeiro', path: '/administrativo', icon: <FolderOpen size={20} /> },
  { name: 'Quadro de Metas', path: '/metas', icon: <Target size={20} /> },
  { name: 'Pacientes', path: '/pacientes', icon: <Users size={20} /> },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-dark-card border-r border-dark-border transition-all duration-300',
        isOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-dark-border">
        {isOpen && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">GC</span>
            </div>
            <span className="font-semibold text-dark-text">GRUPO CREPALDI</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-dark-border transition-colors"
        >
          <ChevronRight
            size={20}
            className={cn('transition-transform', isOpen && 'rotate-180')}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onMouseEnter={() => prefetchRoute(item.path)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-primary-600/20 text-primary-400 border-l-2 border-primary-500'
                  : 'text-dark-muted hover:bg-dark-border hover:text-dark-text'
              )
            }
          >
            {item.icon}
            {isOpen && <span className="text-sm font-medium">{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {isOpen && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-dark-border">
          <div className="text-xs text-dark-muted text-center">
            <p>1.Diretoria</p>
            <p className="mt-1">v1.0.0</p>
          </div>
        </div>
      )}
    </aside>
  );
}
