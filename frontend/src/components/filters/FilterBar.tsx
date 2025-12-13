import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { FilterState, FilterOptions } from '../../types';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  filterOptions?: FilterOptions | null;
  showProfissional?: boolean;
}

// Estabelecimentos padrão
const defaultEstabelecimentos = [
  { id: '1', nome: 'Dermato' },
  { id: '2', nome: 'SPA' },
  { id: '5', nome: 'Convênio' },
  { id: '10', nome: 'Drips' },
  { id: '11', nome: 'Estética' },
  { id: '12', nome: 'Bela Laser' },
  { id: '14', nome: 'Nutrologia' },
];

// Date presets inspirados no DataBox
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
    label: 'Últimos 7 dias',
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
    label: 'Últimos 30 dias',
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
    label: 'Este mês',
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
    label: 'Mês passado',
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

  // Fechar dropdown ao clicar fora
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

  // Handlers
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

  // Labels
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
    // Check if matches a preset
    for (const preset of datePresets) {
      const { start, end } = preset.getValue();
      if (filters.dataInicio === start && filters.dataFim === end) {
        return preset.label;
      }
    }
    // Custom range
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
            'inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-all',
            filters.centrosCusto.length > 0
              ? 'bg-primary-500/20 border-primary-500/50 text-primary-300'
              : 'bg-dark-card border-dark-border text-dark-text hover:border-dark-muted'
          )}
        >
          <span>Estabelecimento</span>
          {filters.centrosCusto.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-primary-500/30 rounded-full">
              {filters.centrosCusto.length}
            </span>
          )}
          <ChevronDown size={14} className={cn(
            'transition-transform',
            activeDropdown === 'estabelecimento' && 'rotate-180'
          )} />
        </button>

        {activeDropdown === 'estabelecimento' && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-dark-card border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="p-2 border-b border-dark-border flex justify-between text-xs">
              <button
                onClick={() => onFilterChange({ ...filters, centrosCusto: estabelecimentos.map(e => e.id) })}
                className="text-primary-400 hover:text-primary-300"
              >
                Selecionar todos
              </button>
              <button
                onClick={() => onFilterChange({ ...filters, centrosCusto: [] })}
                className="text-dark-muted hover:text-dark-text"
              >
                Limpar
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {estabelecimentos.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleEstabelecimentoToggle(item.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-dark-border/50 transition-colors"
                >
                  <div className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                    filters.centrosCusto.includes(item.id)
                      ? 'bg-primary-500 border-primary-500'
                      : 'border-dark-muted'
                  )}>
                    {filters.centrosCusto.includes(item.id) && <Check size={12} className="text-white" />}
                  </div>
                  <span className="text-dark-text">{item.nome}</span>
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
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border bg-dark-card border-dark-border text-dark-text hover:border-dark-muted transition-all"
        >
          <span className="text-primary-400">{getDateLabel()}</span>
          <ChevronDown size={14} className={cn(
            'transition-transform',
            activeDropdown === 'date' && 'rotate-180'
          )} />
        </button>

        {activeDropdown === 'date' && (
          <div className="absolute top-full left-0 mt-1 w-80 bg-dark-card border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Presets */}
            <div className="p-2 border-b border-dark-border">
              <div className="grid grid-cols-2 gap-1">
                {datePresets.map((preset) => {
                  const { start, end } = preset.getValue();
                  const isActive = filters.dataInicio === start && filters.dataFim === end;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => handleDatePreset(preset)}
                      className={cn(
                        'px-2 py-1.5 text-xs rounded transition-colors text-left',
                        isActive
                          ? 'bg-primary-500/20 text-primary-300'
                          : 'hover:bg-dark-border text-dark-text'
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Custom Date Range */}
            <div className="p-3 space-y-2">
              <p className="text-xs text-dark-muted uppercase tracking-wide">Personalizado</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.dataInicio}
                  onChange={(e) => handleDateChange('dataInicio', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-dark-bg border border-dark-border rounded text-dark-text focus:outline-none focus:border-primary-500"
                />
                <input
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) => handleDateChange('dataFim', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-dark-bg border border-dark-border rounded text-dark-text focus:outline-none focus:border-primary-500"
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
              'inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-all',
              filters.profissional
                ? 'bg-primary-500/20 border-primary-500/50 text-primary-300'
                : 'bg-dark-card border-dark-border text-dark-text hover:border-dark-muted'
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
            <div className="absolute top-full left-0 mt-1 w-56 bg-dark-card border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                <button
                  onClick={() => handleProfissionalChange('')}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                    !filters.profissional ? 'bg-primary-500/10 text-primary-300' : 'hover:bg-dark-border/50 text-dark-text'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center',
                    !filters.profissional ? 'bg-primary-500 border-primary-500' : 'border-dark-muted'
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
                      filters.profissional === item.id ? 'bg-primary-500/10 text-primary-300' : 'hover:bg-dark-border/50 text-dark-text'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded-full border flex items-center justify-center',
                      filters.profissional === item.id ? 'bg-primary-500 border-primary-500' : 'border-dark-muted'
                    )}>
                      {filters.profissional === item.id && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span>{item.nome}</span>
                  </button>
                ))}
                {profissionais.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-dark-muted">
                    Nenhum profissional disponível
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
          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-dark-muted hover:text-red-400 transition-colors"
        >
          <X size={12} />
          <span>Limpar</span>
        </button>
      )}
    </div>
  );
}
