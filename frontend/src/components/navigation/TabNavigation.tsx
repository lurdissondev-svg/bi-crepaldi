import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';

interface TabItem {
  name: string;
  path: string;
}

const tabs: TabItem[] = [
  { name: 'Resumo', path: '/' },
  { name: 'Faturamento', path: '/faturamento' },
  { name: 'Marketing', path: '/marketing' },
  { name: 'Comercial', path: '/comercial' },
  { name: 'Atendimento', path: '/atendimento' },
  { name: 'Quadro de Metas', path: '/metas' },
  { name: 'Pacientes', path: '/pacientes' },
];

export function TabNavigation() {
  return (
    <div className="flex items-center gap-1 border-b border-[var(--color-border-primary)] overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) =>
            cn(
              'px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 -mb-[1px]',
              isActive
                ? 'text-[var(--color-accent)] border-[var(--color-accent)] bg-[var(--color-accent-light)]'
                : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
            )
          }
        >
          {tab.name}
        </NavLink>
      ))}
    </div>
  );
}
