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
  ChevronLeft,
  Settings,
  Sparkles,
  HelpCircle,
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
  { name: 'Adm. Financeiro', path: '/administrativo', icon: <FolderOpen size={20} /> },
  { name: 'Quadro de Metas', path: '/metas', icon: <Target size={20} /> },
  { name: 'Pacientes', path: '/pacientes', icon: <Users size={20} /> },
];

const configItems: NavItem[] = [
  { name: 'Meta Ads', path: '/config/meta-ads', icon: <Settings size={20} /> },
  { name: 'Como Funciona', path: '/como-funciona', icon: <HelpCircle size={20} /> },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-[var(--color-bg-elevated)] border-r border-[var(--color-border-primary)] transition-all duration-300 flex flex-col',
        isOpen ? 'w-64' : 'w-[72px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-[var(--color-border-primary)]">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
            <Sparkles size={20} className="text-white" />
          </div>
          {isOpen && (
            <div className="min-w-0 animate-fade-in">
              <h2 className="font-bold text-[var(--color-text-primary)] text-sm truncate">GRUPO CREPALDI</h2>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Business Intelligence</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className={cn(
            'p-1.5 rounded-lg transition-all duration-200 hover:bg-[var(--color-bg-hover)]',
            !isOpen && 'absolute -right-3 top-6 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] shadow-sm'
          )}
          aria-label={isOpen ? 'Recolher menu' : 'Expandir menu'}
        >
          <ChevronLeft
            size={16}
            className={cn(
              'text-[var(--color-text-tertiary)] transition-transform duration-300',
              !isOpen && 'rotate-180'
            )}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onMouseEnter={() => prefetchRoute(item.path)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
                isActive
                  ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--color-accent)] rounded-r-full" />
                )}
                <span className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'
                )}>
                  {item.icon}
                </span>
                {isOpen && (
                  <span className="text-sm font-medium truncate animate-fade-in">{item.name}</span>
                )}
                {!isOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                    <span className="text-sm text-[var(--color-text-primary)]">{item.name}</span>
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Config Section Divider */}
        <div className="pt-4 mt-4 border-t border-[var(--color-border-subtle)]">
          {isOpen && (
            <span className="px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Configuracoes
            </span>
          )}
        </div>

        {/* Config Items */}
        {configItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onMouseEnter={() => prefetchRoute(item.path)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative mt-2',
                isActive
                  ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--color-accent)] rounded-r-full" />
                )}
                <span className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'
                )}>
                  {item.icon}
                </span>
                {isOpen && (
                  <span className="text-sm font-medium truncate animate-fade-in">{item.name}</span>
                )}
                {!isOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                    <span className="text-sm text-[var(--color-text-primary)]">{item.name}</span>
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--color-border-subtle)]">
        {isOpen ? (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 px-2">
              <div className="w-2 h-2 rounded-full bg-[var(--color-success)] shadow-sm shadow-green-500/50 animate-pulse" />
              <span className="text-xs text-[var(--color-text-muted)]">Sistema online</span>
            </div>
            <div className="mt-2 px-2 flex items-center justify-between">
              <span className="text-[10px] text-[var(--color-text-muted)]">1.Diretoria</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">v2.0.0</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-2 h-2 rounded-full bg-[var(--color-success)] shadow-sm shadow-green-500/50 animate-pulse" />
          </div>
        )}
      </div>
    </aside>
  );
}
