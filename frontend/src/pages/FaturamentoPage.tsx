import { useState, useEffect, useCallback } from 'react';
import { FilterBar } from '../components/filters/FilterBar';
import { BarChartCard } from '../components/charts/BarChartCard';
import { AreaChartCard } from '../components/charts/AreaChartCard';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrency, formatPercentage } from '../utils/format';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { RevalidatingIndicator } from '../components/ui/Skeleton';

// Mock data
const mockFaturamentoDiario = [
  { name: 'dezembro 1, 2025', value: 12312.50 },
  { name: 'dezembro 2, 2025', value: 57471.50 },
  { name: 'dezembro 3, 2025', value: 41893.70 },
  { name: 'dezembro 4, 2025', value: 56234.10 },
  { name: 'dezembro 5, 2025', value: 10744.00 },
  { name: 'dezembro 6, 2025', value: 54487.38 },
  { name: 'dezembro 9, 2025', value: 37419.20 },
  { name: 'dezembro 10, 2025', value: 32740.16 },
  { name: 'dezembro 11, 2025', value: 40976.00 },
];

const mockFaturamentoAnual = [
  { name: 'jan', faturamento_2024: 320000, faturamento_2025: 380000 },
  { name: 'fev', faturamento_2024: 310000, faturamento_2025: 420000 },
  { name: 'mar', faturamento_2024: 340000, faturamento_2025: 450000 },
  { name: 'abr', faturamento_2024: 380000, faturamento_2025: 480000 },
  { name: 'mai', faturamento_2024: 400000, faturamento_2025: 520000 },
  { name: 'jun', faturamento_2024: 420000, faturamento_2025: 490000 },
  { name: 'jul', faturamento_2024: 410000, faturamento_2025: 510000 },
  { name: 'ago', faturamento_2024: 390000, faturamento_2025: 530000 },
  { name: 'set', faturamento_2024: 380000, faturamento_2025: 540000 },
  { name: 'out', faturamento_2024: 400000, faturamento_2025: 560000 },
  { name: 'nov', faturamento_2024: 420000, faturamento_2025: 580000 },
  { name: 'dez', faturamento_2024: 450000, faturamento_2025: 244278.54 },
];

export function FaturamentoPage() {
  const { data, loadingStates, revalidatingStates, filters, setFilters, filterOptions, fetchFaturamento } = useDashboard();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Use specific loading state for faturamento
  const isLoading = loadingStates.faturamento;
  const isRevalidating = revalidatingStates.faturamento;

  const handleRefresh = useCallback(() => {
    fetchFaturamento();
    setLastUpdate(new Date());
  }, [fetchFaturamento]);

  const [localData, setLocalData] = useState({
    mensal: {
      valor: 0,
      variacao: 0 as number | string,
      mesAnterior: 0,
      pacientesNovosPercentual: 0,
    },
    anual: {
      valor: 0,
      variacao: 0 as number | string,
      anoAnterior: 0,
      pacientesNovosPercentual: 0,
    },
    crescimentoMensal: {
      mesPassadoAnoAnterior: 0,
      mesAtual: 0,
      percentual: 0,
    },
    crescimentoAnual: {
      anoAnterior: 0,
      anoAtual: 0,
      percentual: 0,
    },
  });

  // Auto-refresh a cada 5 minutos
  useEffect(() => {
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutos em milissegundos

    const interval = setInterval(() => {
      console.log('[Auto-refresh] Atualizando dados de faturamento...');
      handleRefresh();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [handleRefresh]);

  useEffect(() => {
    if (data.faturamento) {
      setLocalData({
        mensal: data.faturamento.mensal,
        anual: data.faturamento.anual,
        crescimentoMensal: data.faturamento.crescimentoMensal,
        crescimentoAnual: data.faturamento.crescimentoAnual,
      });
      setLastUpdate(new Date());
    }
  }, [data.faturamento]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-lg font-semibold text-dark-text">FATURAMENTO CREPALDI</h2>

      {/* Filters with revalidating indicator */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <FilterBar
            filters={filters}
            onFilterChange={setFilters}
            filterOptions={filterOptions}
          />
        </div>
        <RevalidatingIndicator isRevalidating={isRevalidating} />
      </div>

      {/* Main Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Faturamento Mensal */}
        <div className="card">
          <h3 className="card-header">Faturamento Mensal</h3>
          <div className="text-center py-6">
            <p className="text-5xl font-bold text-dark-text">
              {formatCurrency(localData.mensal.valor)}
            </p>
            <p className="text-sm text-dark-muted mt-2">dez 2025</p>
            <div className={`flex items-center justify-center gap-1 mt-2 ${Number(localData.mensal.variacao) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {Number(localData.mensal.variacao) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{formatPercentage(Math.abs(Number(localData.mensal.variacao)))}</span>
              <span className="text-dark-muted">vs. mes anterior: {formatCurrency(localData.mensal.mesAnterior)}</span>
            </div>
          </div>

          <div className="text-center py-6 border-t border-dark-border">
            <p className="text-5xl font-bold text-dark-text">
              {formatPercentage(localData.mensal.pacientesNovosPercentual)}
            </p>
            <p className="text-sm text-dark-muted mt-2">
              % Dos pacientes novos em relacao o faturamento total - <span className="text-primary-400">Mensal</span>
            </p>
          </div>

          <div className="border-t border-dark-border pt-4">
            <h4 className="text-sm font-medium text-dark-muted mb-3">Crescimento Mensal</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-primary-400">Total Mes Ano Passado (R$)</span>
                <span>{formatCurrency(localData.crescimentoMensal.mesPassadoAnoAnterior)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-primary-400">Total Mes Atual (R$)</span>
                <span>{formatCurrency(localData.crescimentoMensal.mesAtual)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-muted">Crescimento</span>
                <span className="text-green-500">{formatPercentage(localData.crescimentoMensal.percentual)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Faturamento Anual */}
        <div className="card">
          <h3 className="card-header">Faturamento Anual</h3>
          <div className="text-center py-6">
            <p className="text-5xl font-bold text-dark-text">
              {formatCurrency(localData.anual.valor)}
            </p>
            <p className="text-sm text-dark-muted mt-2">2025</p>
            <div className={`flex items-center justify-center gap-1 mt-2 ${Number(localData.anual.variacao) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {Number(localData.anual.variacao) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{formatPercentage(Math.abs(Number(localData.anual.variacao)))}</span>
              <span className="text-dark-muted">vs. ano anterior: {formatCurrency(localData.anual.anoAnterior)}</span>
            </div>
          </div>

          <div className="text-center py-6 border-t border-dark-border">
            <p className="text-5xl font-bold text-dark-text">
              {formatPercentage(localData.anual.pacientesNovosPercentual)}
            </p>
            <p className="text-sm text-dark-muted mt-2">
              % Dos pacientes novos em relacao o faturamento total - <span className="text-primary-400">Anual</span>
            </p>
          </div>

          <div className="border-t border-dark-border pt-4">
            <h4 className="text-sm font-medium text-dark-muted mb-3">Crescimento Anual</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-primary-400">Total 2024 (R$)</span>
                <span className="text-red-400">{formatCurrency(localData.crescimentoAnual.anoAnterior)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-primary-400">Total 2025 (R$)</span>
                <span className="text-red-400">{formatCurrency(localData.crescimentoAnual.anoAtual)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-muted">Crescimento</span>
                <span className="text-green-500">{formatPercentage(localData.crescimentoAnual.percentual)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vendas de Hoje */}
      <div className="card">
        <div className="flex items-center justify-between px-4 pt-2">
          <div className="text-xs text-dark-muted">
            Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        <div className="text-center py-8">
          <p className="text-6xl font-bold text-dark-text">
            {data.faturamento?.vendasHoje?.valorFormatado || formatCurrency(0)}
          </p>
          <p className="text-sm text-primary-400 mt-2">Vendas de Hoje</p>
          {data.faturamento?.vendasHoje?.quantidade !== undefined && (
            <p className="text-sm text-dark-muted mt-1">
              {data.faturamento.vendasHoje.quantidade} movimentos
            </p>
          )}
          <p className="text-xs text-dark-muted mt-3">
            Auto-atualiza a cada 5 minutos
          </p>
        </div>
      </div>

      {/* Charts */}
      <BarChartCard
        title="Faturamento Diario"
        data={data.faturamento?.faturamentoDiario?.map(item => ({
          name: item.data,
          value: item.valor,
        })) || mockFaturamentoDiario}
        color="#84cc16"
        height={350}
        formatYAxis="currency"
      />

      <AreaChartCard
        title="Faturamento 2025x2024"
        data={mockFaturamentoAnual}
        dataKeys={[
          { key: 'faturamento_2024', color: '#60a5fa', name: 'faturamento 2024' },
          { key: 'faturamento_2025', color: '#22c55e', name: 'faturamento 2025' },
        ]}
        formatYAxis="currency"
        height={350}
      />
    </div>
  );
}
