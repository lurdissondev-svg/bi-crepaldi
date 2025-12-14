import { useState, useEffect } from 'react';
import { FilterBar } from '../components/filters/FilterBar';
import { AreaChartCard } from '../components/charts/AreaChartCard';
import { BarChartCard } from '../components/charts/BarChartCard';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrency } from '../utils/format';
import { RevalidatingIndicator } from '../components/ui/Skeleton';

// Dados padrão (fallback enquanto carrega)
const defaultDesempenhoDezena = [
  { name: '1a dezena', mes_atual: 0, mes_anterior: 0 },
  { name: '2a dezena', mes_atual: 0, mes_anterior: 0 },
  { name: '3a dezena', mes_atual: 0, mes_anterior: 0 },
];

export function ResumoPage() {
  const { data, revalidatingStates, filters, setFilters, filterOptions } = useDashboard();

  // Use specific loading state for resumo
  const isRevalidating = revalidatingStates.resumo;

  const [localData, setLocalData] = useState({
    faturamento: {
      total: 0,
      variacao: 0,
    },
    pacienteNovo: {
      leadsNovos: 0,
      leadsAgendados: 0,
      pacientesVenda: 0,
      ticketMedio: 0,
    },
    pacienteRecorrente: {
      leads: 0,
      leadsAgendados: 0,
      pacientes: 0,
      ticketMedio: 0,
    },
  });

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
              <p className="text-xs text-dark-muted mt-1">Ticket Medio</p>
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
              <p className="text-xs text-dark-muted mt-1">Ticket Medio</p>
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

        {/* Proporcao de Vendas por Procedimento */}
        <BarChartCard
          title="Proporcao de Vendas por Procedimento"
          data={data.resumo?.procedimentosPorCategoria?.slice(0, 5).map((p: any) => ({
            name: p.nome || 'Outros',
            value: p.quantidade || 0,
          })) || []}
          color="#60a5fa"
          height={300}
          formatYAxis="number"
        />
      </div>
    </div>
  );
}
