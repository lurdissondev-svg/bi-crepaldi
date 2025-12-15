import { useState, useEffect } from 'react';
import { FilterBar } from '../components/filters/FilterBar';
import { AreaChartCard } from '../components/charts/AreaChartCard';
import { TabNavigation } from '../components/navigation/TabNavigation';
import { useDashboard } from '../hooks/useDashboard';
import { RevalidatingIndicator } from '../components/ui/Skeleton';
import { formatCurrency } from '../utils/format';
import {
  DollarSign,
  Users,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Repeat,
  ShoppingBag,
  CreditCard,
} from 'lucide-react';

// Dados padrão (fallback enquanto carrega)
const defaultDesempenhoDezena = [
  { name: '1ª dezena', mes_atual: 0, mes_anterior: 0 },
  { name: '2ª dezena', mes_atual: 0, mes_anterior: 0 },
  { name: '3ª dezena', mes_atual: 0, mes_anterior: 0 },
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

  // Calcular taxa de conversão de leads
  const taxaConversaoNovos = localData.pacienteNovo.leadsNovos > 0
    ? ((localData.pacienteNovo.pacientesVenda / localData.pacienteNovo.leadsNovos) * 100).toFixed(1)
    : '0';

  const taxaAgendamentoNovos = localData.pacienteNovo.leadsNovos > 0
    ? ((localData.pacienteNovo.leadsAgendados / localData.pacienteNovo.leadsNovos) * 100).toFixed(1)
    : '0';

  // Total de pacientes
  const totalPacientes = localData.pacienteNovo.pacientesVenda + localData.pacienteRecorrente.pacientes;
  const ticketMedioGeral = totalPacientes > 0
    ? localData.faturamento.total / totalPacientes
    : 0;

  return (
    <div className="space-y-6">
      {/* Tabs - Navigation */}
      <TabNavigation />

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

      {/* Hero Section - Faturamento Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card Principal - Faturamento */}
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Faturamento Total
              </p>
              <p className="text-4xl font-bold mt-2">
                {formatCurrency(localData.faturamento.total)}
              </p>
              {localData.faturamento.variacao !== 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {localData.faturamento.variacao > 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-200" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-300" />
                  )}
                  <span className={`text-sm font-medium ${localData.faturamento.variacao > 0 ? 'text-emerald-200' : 'text-red-300'}`}>
                    {localData.faturamento.variacao > 0 ? '+' : ''}{localData.faturamento.variacao.toFixed(1)}% vs mês anterior
                  </span>
                </div>
              )}
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <DollarSign className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Cards Secundários */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Users className="w-4 h-4" />
              <span className="text-xs">Total Pacientes</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">
              {totalPacientes.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <CreditCard className="w-4 h-4" />
              <span className="text-xs">Ticket Médio</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">
              {formatCurrency(ticketMedioGeral)}
            </p>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Target className="w-4 h-4" />
              <span className="text-xs">Taxa Conversão</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500 mt-2">
              {taxaConversaoNovos}%
            </p>
          </div>
          <div className="card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Calendar className="w-4 h-4" />
              <span className="text-xs">Taxa Agendamento</span>
            </div>
            <p className="text-2xl font-bold text-blue-500 mt-2">
              {taxaAgendamentoNovos}%
            </p>
          </div>
        </div>
      </div>

      {/* Seção Pacientes - Layout Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pacientes Novos */}
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-4">
            <div className="flex items-center gap-3 text-white">
              <div className="bg-white/20 p-2 rounded-lg">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">Pacientes Novos</h3>
                <p className="text-blue-100 text-xs">Primeira vez na clínica</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Funil de Conversão Visual */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Leads</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Total de leads novos</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-[var(--color-text-primary)]">
                  {localData.pacienteNovo.leadsNovos.toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="flex items-center gap-2 pl-5">
                <div className="w-0.5 h-6 bg-blue-200 dark:bg-blue-800"></div>
                <span className="text-xs text-[var(--color-text-muted)]">↓ {taxaAgendamentoNovos}% agendaram</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Agendados</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Consultas marcadas</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-[var(--color-text-primary)]">
                  {localData.pacienteNovo.leadsAgendados.toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="flex items-center gap-2 pl-5">
                <div className="w-0.5 h-6 bg-emerald-200 dark:bg-emerald-800"></div>
                <span className="text-xs text-[var(--color-text-muted)]">↓ {taxaConversaoNovos}% converteram</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Vendas</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Pacientes que compraram</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {localData.pacienteNovo.pacientesVenda.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            {/* Ticket Médio */}
            <div className="pt-4 border-t border-[var(--color-border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Ticket Médio</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(localData.pacienteNovo.ticketMedio)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pacientes Recorrentes */}
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-5 py-4">
            <div className="flex items-center gap-3 text-white">
              <div className="bg-white/20 p-2 rounded-lg">
                <Repeat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">Pacientes Recorrentes</h3>
                <p className="text-purple-100 text-xs">Retornos e recompras</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Métricas de Recorrência */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Leads Retorno</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Pacientes que voltaram</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-[var(--color-text-primary)]">
                  {localData.pacienteRecorrente.leads.toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="flex items-center gap-2 pl-5">
                <div className="w-0.5 h-6 bg-purple-200 dark:bg-purple-800"></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Agendados</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Retornos agendados</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-[var(--color-text-primary)]">
                  {localData.pacienteRecorrente.leadsAgendados.toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="flex items-center gap-2 pl-5">
                <div className="w-0.5 h-6 bg-emerald-200 dark:bg-emerald-800"></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Recompras</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Pacientes que compraram</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {localData.pacienteRecorrente.pacientes.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            {/* Ticket Médio */}
            <div className="pt-4 border-t border-[var(--color-border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Ticket Médio</span>
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(localData.pacienteRecorrente.ticketMedio)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparativo Visual */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Comparativo: Novos vs Recorrentes
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--color-text-muted)]">Pacientes Novos</span>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {localData.pacienteNovo.pacientesVenda}
              </span>
            </div>
            <div className="h-3 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                style={{
                  width: totalPacientes > 0
                    ? `${(localData.pacienteNovo.pacientesVenda / totalPacientes) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--color-text-muted)]">Pacientes Recorrentes</span>
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                {localData.pacienteRecorrente.pacientes}
              </span>
            </div>
            <div className="h-3 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                style={{
                  width: totalPacientes > 0
                    ? `${(localData.pacienteRecorrente.pacientes / totalPacientes) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-8 mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {totalPacientes > 0
                ? ((localData.pacienteNovo.pacientesVenda / totalPacientes) * 100).toFixed(0)
                : 0}%
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Novos</p>
          </div>
          <div className="w-px h-10 bg-[var(--color-border-subtle)]" />
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {totalPacientes > 0
                ? ((localData.pacienteRecorrente.pacientes / totalPacientes) * 100).toFixed(0)
                : 0}%
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Recorrentes</p>
          </div>
        </div>
      </div>

      {/* Gráfico de Desempenho */}
      <AreaChartCard
        title="Desempenho por Dezena"
        data={data.resumo?.desempenhoDezena?.map((d: any) => ({
          name: d.dezena,
          mes_atual: d.mes_atual || 0,
          mes_anterior: d.mes_anterior || 0,
        })) || defaultDesempenhoDezena}
        dataKeys={[
          { key: 'mes_anterior', color: '#60a5fa', name: 'Mês Anterior' },
          { key: 'mes_atual', color: '#22c55e', name: 'Mês Atual' },
        ]}
        formatYAxis="currency"
      />
    </div>
  );
}
