import { useEffect, useState } from 'react';
import { FilterBar } from '../components/filters/FilterBar';
import { AreaChartCard } from '../components/charts/AreaChartCard';
import { BarChartCard } from '../components/charts/BarChartCard';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrency } from '../utils/format';

// Dados padrão (fallback enquanto carrega)
const defaultDesempenhoDezena = [
  { name: '1ª dezena', mes_atual: 0, mes_anterior: 0 },
  { name: '2ª dezena', mes_atual: 0, mes_anterior: 0 },
  { name: '3ª dezena', mes_atual: 0, mes_anterior: 0 },
];

export function ResumoPage() {
  const { data, loading, filters, setFilters, filterOptions, fetchResumo } = useDashboard();
  const [localData, setLocalData] = useState({
    faturamento: {
      total: 1250415.05,
      variacao: -15.5,
    },
    pacienteNovo: {
      leadsNovos: 17,
      leadsAgendados: 0,
      pacientesVenda: 72,
      ticketMedio: 1342.69,
    },
    pacienteRecorrente: {
      leads: 24,
      leadsAgendados: 0,
      pacientes: 236,
      ticketMedio: 3937.62,
    },
  });

  // Refetch quando filtros mudarem
  useEffect(() => {
    fetchResumo();
  }, [filters.dataInicio, filters.dataFim, filters.centrosCusto]);

  useEffect(() => {
    if (data.resumo) {
      setLocalData({
        faturamento: {
          total: data.resumo.faturamento.total,
          variacao: parseFloat(data.resumo.faturamento.variacao),
        },
        pacienteNovo: data.resumo.pacienteNovo,
        pacienteRecorrente: data.resumo.pacienteRecorrente,
      });
    }
  }, [data.resumo]);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-dark-border">
        <button className="tab tab-active">Resumo</button>
        <button className="tab">Faturamento</button>
        <button className="tab">Marketing</button>
        <button className="tab">Comercial</button>
        <button className="tab">Atendimento</button>
        <button className="tab">Administrativo Financeiro</button>
        <button className="tab">Quadro de metas</button>
        <button className="tab">Pacientes</button>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterOptions={filterOptions}
      />

      {/* Main Metrics Row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Faturamento Card */}
        <div className="card xl:col-span-1">
          <h3 className="card-header">Faturamento</h3>
          <div className="flex flex-col items-center justify-center h-full py-4">
            <p className="text-3xl font-bold text-dark-text">
              {formatCurrency(localData.faturamento.total)}
            </p>
            <p className="text-sm text-dark-muted mt-2">Faturamento Total</p>
          </div>
        </div>

        {/* Paciente Novo */}
        <div className="card xl:col-span-2">
          <h3 className="card-header">Paciente Novo</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="text-center p-3">
              <p className="text-3xl font-bold text-dark-text">{localData.pacienteNovo.leadsNovos}</p>
              <p className="text-xs text-dark-muted mt-1">Leads Novos</p>
            </div>
            <div className="text-center p-3">
              <p className="text-3xl font-bold text-dark-text">{localData.pacienteNovo.leadsAgendados}</p>
              <p className="text-xs text-dark-muted mt-1">Leads Agendados</p>
            </div>
            <div className="text-center p-3">
              <p className="text-3xl font-bold text-dark-text">{localData.pacienteNovo.pacientesVenda}</p>
              <p className="text-xs text-dark-muted mt-1">Paciente Venda</p>
            </div>
            <div className="text-center p-3">
              <p className="text-xl font-bold text-dark-text">{formatCurrency(localData.pacienteNovo.ticketMedio)}</p>
              <p className="text-xs text-dark-muted mt-1">Ticket Médio</p>
            </div>
          </div>
        </div>

        {/* Paciente Recorrente */}
        <div className="card xl:col-span-2">
          <h3 className="card-header">Paciente Recorrente</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="text-center p-3">
              <p className="text-3xl font-bold text-dark-text">{localData.pacienteRecorrente.leads}</p>
              <p className="text-xs text-dark-muted mt-1">Leads Recorrente</p>
            </div>
            <div className="text-center p-3">
              <p className="text-3xl font-bold text-dark-text">{localData.pacienteRecorrente.leadsAgendados}</p>
              <p className="text-xs text-dark-muted mt-1">Leads Agendados</p>
            </div>
            <div className="text-center p-3">
              <p className="text-3xl font-bold text-dark-text">{localData.pacienteRecorrente.pacientes}</p>
              <p className="text-xs text-dark-muted mt-1">Paciente Recorrente</p>
            </div>
            <div className="text-center p-3">
              <p className="text-xl font-bold text-primary-400">{formatCurrency(localData.pacienteRecorrente.ticketMedio)}</p>
              <p className="text-xs text-dark-muted mt-1">Ticket Médio</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Desempenho Dezenal */}
        <AreaChartCard
          title="Desempenho dezenal"
          data={data.resumo?.desempenhoDezena?.map((d: any) => ({
            name: d.dezena,
            mes_atual: d.mes_atual || 0,
            mes_anterior: d.mes_anterior || 0,
          })) || defaultDesempenhoDezena}
          dataKeys={[
            { key: 'mes_anterior', color: '#60a5fa', name: '11/2025' },
            { key: 'mes_atual', color: '#22c55e', name: '12/2025' },
          ]}
          formatYAxis="currency"
        />

        {/* Proporção de Vendas por Procedimento */}
        <BarChartCard
          title="Proporção de Vendas por Procedimento"
          data={data.resumo?.procedimentosPorCategoria?.slice(0, 5).map((p: any) => ({
            name: p.nome || 'Outros',
            value: p.quantidade || 0,
          })) || []}
          color="#60a5fa"
          height={300}
          formatYAxis="number"
        />
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-dark-bg/50 flex items-center justify-center z-50">
          <div className="bg-dark-card p-6 rounded-xl shadow-xl">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-dark-muted mt-3">Carregando dados...</p>
          </div>
        </div>
      )}
    </div>
  );
}
