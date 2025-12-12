import { useState, useEffect, useRef } from 'react';
import { Calendar, Filter, X, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { FilterState, FilterOptions } from '../../types';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  filterOptions?: FilterOptions | null;
  showCentrosCusto?: boolean;
  showProfissional?: boolean;
  showConfirmado?: boolean;
  showTipo?: boolean;
  showFonte?: boolean;
  showOrigem?: boolean;
  showFaseLead?: boolean;
}

export function FilterBar({
  filters,
  onFilterChange,
  filterOptions,
  showCentrosCusto = true,
  showProfissional = false,
  showConfirmado = false,
  showTipo = false,
  showFonte = false,
  showOrigem = false,
  showFaseLead = false,
}: FilterBarProps) {
  const [showCentrosDropdown, setShowCentrosDropdown] = useState(false);
  const [showEstabelecimentoDropdown, setShowEstabelecimentoDropdown] = useState(false);
  const centrosRef = useRef<HTMLDivElement>(null);
  const estabelecimentoRef = useRef<HTMLDivElement>(null);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (centrosRef.current && !centrosRef.current.contains(event.target as Node)) {
        setShowCentrosDropdown(false);
      }
      if (estabelecimentoRef.current && !estabelecimentoRef.current.contains(event.target as Node)) {
        setShowEstabelecimentoDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const presetDates = [
    { label: 'Hoje', getValue: () => {
      const today = new Date().toISOString().split('T')[0];
      return { start: today, end: today };
    }},
    { label: 'Este mês', getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      return { start, end };
    }},
    { label: 'Mês passado', getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return { start, end };
    }},
    { label: 'Este ano', getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      return { start, end };
    }},
  ];

  const handleDatePreset = (preset: typeof presetDates[0]) => {
    const { start, end } = preset.getValue();
    onFilterChange({ ...filters, dataInicio: start, dataFim: end });
  };

  const handleCentroToggle = (centroId: string) => {
    const newCentros = filters.centrosCusto.includes(centroId)
      ? filters.centrosCusto.filter(id => id !== centroId)
      : [...filters.centrosCusto, centroId];
    onFilterChange({ ...filters, centrosCusto: newCentros });
  };

  const clearFilters = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    onFilterChange({
      dataInicio: start,
      dataFim: end,
      centrosCusto: [],
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Centro de Custo */}
      {showCentrosCusto && (
        <div className="relative" ref={centrosRef}>
          <button
            onClick={() => setShowCentrosDropdown(!showCentrosDropdown)}
            className={cn(
              'filter-button',
              filters.centrosCusto.length > 0 && 'filter-button-active'
            )}
          >
            <Filter size={16} />
            <span>Centro de Custo</span>
            {filters.centrosCusto.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                {filters.centrosCusto.length} seleções
              </span>
            )}
            <ChevronDown size={16} />
          </button>

          {showCentrosDropdown && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-dark-card border border-dark-border rounded-lg shadow-xl z-50">
              <div className="p-2 max-h-64 overflow-y-auto">
                {(filterOptions?.centrosCusto || [
                  { id: '1', nome: 'Dermato' },
                  { id: '2', nome: 'SPA' },
                  { id: '5', nome: 'Convênio' },
                  { id: '10', nome: 'Drips' },
                  { id: '11', nome: 'Estética' },
                  { id: '12', nome: 'Bela Laser' },
                  { id: '14', nome: 'Nutrologia' },
                ]).map((centro) => (
                  <label
                    key={centro.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-dark-border rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.centrosCusto.includes(centro.id)}
                      onChange={() => handleCentroToggle(centro.id)}
                      className="rounded border-dark-border bg-dark-bg text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm">{centro.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data da Venda - Label dinâmico */}
      <div className="flex items-center gap-2">
        <div className="filter-button">
          <Calendar size={16} />
          <span className="text-primary-400">
            {(() => {
              const now = new Date();
              const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
              const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
              const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
              const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
              const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
              const today = now.toISOString().split('T')[0];

              if (filters.dataInicio === today && filters.dataFim === today) return 'Hoje';
              if (filters.dataInicio === startOfThisMonth && filters.dataFim === endOfThisMonth) return 'Este mês';
              if (filters.dataInicio === startOfLastMonth && filters.dataFim === endOfLastMonth) return 'Mês passado';
              if (filters.dataInicio === startOfYear) return 'Este ano';
              return `${filters.dataInicio} - ${filters.dataFim}`;
            })()}
          </span>
          <X
            size={14}
            className="text-dark-muted hover:text-dark-text cursor-pointer"
            onClick={clearFilters}
          />
        </div>
      </div>

      {/* Date Inputs */}
      <div className="flex items-center gap-2">
        <div className="filter-button">
          <Calendar size={16} />
          <span>Data início</span>
          <input
            type="date"
            value={filters.dataInicio}
            onChange={(e) => onFilterChange({ ...filters, dataInicio: e.target.value })}
            className="bg-transparent border-none text-sm focus:outline-none w-28"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="filter-button">
          <Calendar size={16} />
          <span>Data fim</span>
          <input
            type="date"
            value={filters.dataFim}
            onChange={(e) => onFilterChange({ ...filters, dataFim: e.target.value })}
            className="bg-transparent border-none text-sm focus:outline-none w-28"
          />
        </div>
      </div>

      {/* Profissional Filter */}
      {showProfissional && (
        <div className="filter-button">
          <Filter size={16} />
          <span>Profissional</span>
          <ChevronDown size={16} />
        </div>
      )}

      {/* Tipo Filter */}
      {showTipo && (
        <div className="filter-button">
          <Filter size={16} />
          <span>Tipo</span>
          <ChevronDown size={16} />
        </div>
      )}

      {/* Fonte Filter */}
      {showFonte && (
        <div className="filter-button">
          <Filter size={16} />
          <span>Fonte</span>
          <ChevronDown size={16} />
        </div>
      )}

      {/* Origem Filter */}
      {showOrigem && (
        <div className="filter-button">
          <Filter size={16} />
          <span>Origem</span>
          <ChevronDown size={16} />
        </div>
      )}

      {/* Fase do Lead Filter */}
      {showFaseLead && (
        <div className="filter-button">
          <Filter size={16} />
          <span>Fase do lead</span>
          <ChevronDown size={16} />
        </div>
      )}

      {/* Estabelecimento Filter */}
      <div className="relative" ref={estabelecimentoRef}>
        <button
          onClick={() => setShowEstabelecimentoDropdown(!showEstabelecimentoDropdown)}
          className={cn(
            'filter-button',
            filters.centrosCusto.length > 0 && 'filter-button-active'
          )}
        >
          <Filter size={16} />
          <span>Estabelecimento</span>
          {filters.centrosCusto.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
              {filters.centrosCusto.length}
            </span>
          )}
          <ChevronDown size={16} />
        </button>

        {showEstabelecimentoDropdown && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-dark-card border border-dark-border rounded-lg shadow-xl z-50">
            <div className="p-2 max-h-64 overflow-y-auto">
              {(filterOptions?.centrosCusto || [
                { id: '1', nome: 'Dermato' },
                { id: '2', nome: 'SPA' },
                { id: '5', nome: 'Convênio' },
                { id: '10', nome: 'Drips' },
                { id: '11', nome: 'Estética' },
                { id: '12', nome: 'Bela Laser' },
                { id: '14', nome: 'Nutrologia' },
              ]).map((centro) => (
                <label
                  key={centro.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-dark-border rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.centrosCusto.includes(centro.id)}
                    onChange={() => handleCentroToggle(centro.id)}
                    className="rounded border-dark-border bg-dark-bg text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm">{centro.nome}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Date Presets */}
      <div className="flex items-center gap-2 ml-auto">
        {presetDates.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handleDatePreset(preset)}
            className="px-3 py-1 text-xs text-dark-muted hover:text-dark-text hover:bg-dark-border rounded transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
