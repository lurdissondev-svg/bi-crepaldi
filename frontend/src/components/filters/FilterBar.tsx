import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, X, Calendar } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { FilterState, FilterOptions } from '../../types';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  filterOptions?: FilterOptions | null;
  showProfissional?: boolean;
}

const defaultEstabelecimentos = [
  { id: '1', nome: 'Dermato' },
  { id: '2', nome: 'SPA' },
  { id: '5', nome: 'Convenio' },
  { id: '10', nome: 'Drips' },
  { id: '11', nome: 'Estetica' },
  { id: '12', nome: 'Bela Laser' },
  { id: '14', nome: 'Nutrologia' },
];

const datePresets = [
  {
    label: 'Hoje',
    getValue: () => {
      const today = new Date().toISOString().split('T')[0];
      return { start: today, end: today };
    }
  },
  {
    label: 'Ontem',
    getValue: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const date = yesterday.toISOString().split('T')[0];
      return { start: date, end: date };
    }
  },
  {
    label: 'Ultimos 7 dias',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
    }
  },
  {
    label: 'Ultimos 30 dias',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
    }
  },
  {
    label: 'Este mes',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
    }
  },
  {
    label: 'Mes passado',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
    }
  },
  {
    label: 'Este ano',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
    }
  },
];

export function FilterBar({
  filters,
  onFilterChange,
  filterOptions,
  showProfissional = true,
}: FilterBarProps) {
  const [activeDropdown, setActiveDropdown] = useState<'estabelecimento' | 'profissional' | 'date' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const estabelecimentos = filterOptions?.centrosCusto || defaultEstabelecimentos;
  const profissionais = filterOptions?.profissionais || [];

  const handleEstabelecimentoToggle = (id: string) => {
    const newList = filters.centrosCusto.includes(id)
      ? filters.centrosCusto.filter(c => c !== id)
      : [...filters.centrosCusto, id];
    onFilterChange({ ...filters, centrosCusto: newList });
  };

  const handleProfissionalChange = (id: string) => {
    onFilterChange({ ...filters, profissional: id || undefined });
    setActiveDropdown(null);
  };

  const handleDatePreset = (preset: typeof datePresets[0]) => {
    const { start, end } = preset.getValue();
    onFilterChange({ ...filters, dataInicio: start, dataFim: end });
    setActiveDropdown(null);
  };

  const handleDateChange = (field: 'dataInicio' | 'dataFim', value: string) => {
    onFilterChange({ ...filters, [field]: value });
  };

  const getEstabelecimentoLabel = () => {
    if (filters.centrosCusto.length === 0) return 'Todos';
    if (filters.centrosCusto.length === 1) {
      return estabelecimentos.find(e => e.id === filters.centrosCusto[0])?.nome || '1 selecionado';
    }
    return `${filters.centrosCusto.length} selecionados`;
  };

  const getProfissionalLabel = () => {
    if (!filters.profissional) return 'Todos';
    return profissionais.find(p => p.id === filters.profissional)?.nome || 'Selecionado';
  };

  const getDateLabel = () => {
    for (const preset of datePresets) {
      const { start, end } = preset.getValue();
      if (filters.dataInicio === start && filters.dataFim === end) {
        return preset.label;
      }
    }
    const formatDate = (d: string) => {
      const [y, m, day] = d.split('-');
      return `${day}/${m}`;
    };
    return `${formatDate(filters.dataInicio)} - ${formatDate(filters.dataFim)}`;
  };

  const hasFilters = filters.centrosCusto.length > 0 || filters.profissional;

  const clearFilters = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    onFilterChange({
      dataInicio: start,
      dataFim: end,
      centrosCusto: [],
      profissional: undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
      {/* Estabelecimento Filter */}
      <div className="relative">
        <button
          onClick={() => setActiveDropdown(activeDropdown === 'estabelecimento' ? null : 'estabelecimento')}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all duration-200',
            filters.centrosCusto.length > 0
              ? 'bg-[var(--color-accent-light)] border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-primary)] text-[var(--color-text-primary)] hover:border-[var(--color-border-secondary)]'
          )}
        >
          <span>Estabelecimento</span>
          {filters.centrosCusto.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-[var(--color-accent)] text-white rounded-full">
              {filters.centrosCusto.length}
            </span>
          )}
          <ChevronDown size={14} className={cn(
            'transition-transform',
            activeDropdown === 'estabelecimento' && 'rotate-180'
          )} />
        </button>

        {activeDropdown === 'estabelecimento' && (
          <div className="absolute top-full left-0 mt-2 w-56 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-xl shadow-lg z-50 overflow-hidden animate-scale-in">
            <div className="p-2 border-b border-[var(--color-border-subtle)] flex justify-between text-xs">
              <button
                onClick={() => onFilterChange({ ...filters, centrosCusto: estabelecimentos.map(e => e.id) })}
                className="text-[var(--color-accent)] hover:underline"
              >
                Selecionar todos
              </button>
              <button
                onClick={() => onFilterChange({ ...filters, centrosCusto: [] })}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                Limpar
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {estabelecimentos.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleEstabelecimentoToggle(item.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <div className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                    filters.centrosCusto.includes(item.id)
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                      : 'border-[var(--color-border-secondary)]'
                  )}>
                    {filters.centrosCusto.includes(item.id) && <Check size={12} className="text-white" />}
                  </div>
                  <span className="text-[var(--color-text-primary)]">{item.nome}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Date Filter */}
      <div className="relative">
        <button
          onClick={() => setActiveDropdown(activeDropdown === 'date' ? null : 'date')}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border bg-[var(--color-bg-elevated)] border-[var(--color-border-primary)] text-[var(--color-text-primary)] hover:border-[var(--color-border-secondary)] transition-all duration-200"
        >
          <Calendar size={14} className="text-[var(--color-text-muted)]" />
          <span className="text-[var(--color-accent)] font-medium">{getDateLabel()}</span>
          <ChevronDown size={14} className={cn(
            'transition-transform',
            activeDropdown === 'date' && 'rotate-180'
          )} />
        </button>

        {activeDropdown === 'date' && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-xl shadow-lg z-50 overflow-hidden animate-scale-in">
            <div className="p-3 border-b border-[var(--color-border-subtle)]">
              <div className="grid grid-cols-2 gap-1">
                {datePresets.map((preset) => {
                  const { start, end } = preset.getValue();
                  const isActive = filters.dataInicio === start && filters.dataFim === end;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => handleDatePreset(preset)}
                      className={cn(
                        'px-3 py-2 text-xs rounded-lg transition-colors text-left',
                        isActive
                          ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium'
                          : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide font-medium">Personalizado</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.dataInicio}
                  onChange={(e) => handleDateChange('dataInicio', e.target.value)}
                  className="w-full px-2 py-2 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-light)]"
                />
                <input
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) => handleDateChange('dataFim', e.target.value)}
                  className="w-full px-2 py-2 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-light)]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profissional Filter */}
      {showProfissional && (
        <div className="relative">
          <button
            onClick={() => setActiveDropdown(activeDropdown === 'profissional' ? null : 'profissional')}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all duration-200',
              filters.profissional
                ? 'bg-[var(--color-accent-light)] border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-primary)] text-[var(--color-text-primary)] hover:border-[var(--color-border-secondary)]'
            )}
          >
            <span>Profissional</span>
            {filters.profissional && (
              <span className="max-w-24 truncate text-xs opacity-80">
                {getProfissionalLabel()}
              </span>
            )}
            <ChevronDown size={14} className={cn(
              'transition-transform',
              activeDropdown === 'profissional' && 'rotate-180'
            )} />
          </button>

          {activeDropdown === 'profissional' && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-xl shadow-lg z-50 overflow-hidden animate-scale-in">
              <div className="max-h-48 overflow-y-auto">
                <button
                  onClick={() => handleProfissionalChange('')}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                    !filters.profissional ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center',
                    !filters.profissional ? 'bg-[var(--color-accent)] border-[var(--color-accent)]' : 'border-[var(--color-border-secondary)]'
                  )}>
                    {!filters.profissional && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <span>Todos os profissionais</span>
                </button>
                {profissionais.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleProfissionalChange(item.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                      filters.profissional === item.id ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded-full border flex items-center justify-center',
                      filters.profissional === item.id ? 'bg-[var(--color-accent)] border-[var(--color-accent)]' : 'border-[var(--color-border-secondary)]'
                    )}>
                      {filters.profissional === item.id && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span>{item.nome}</span>
                  </button>
                ))}
                {profissionais.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
                    Nenhum profissional disponivel
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clear Filters */}
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="inline-flex items-center gap-1 px-2 py-2 text-xs text-[var(--color-text-muted)] hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
        >
          <X size={14} />
          <span>Limpar filtros</span>
        </button>
      )}
    </div>
  );
}
