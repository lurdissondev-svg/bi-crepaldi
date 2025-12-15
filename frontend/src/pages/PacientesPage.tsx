import { useState, useEffect } from 'react';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrency } from '../utils/format';
import { PageSkeleton, RevalidatingIndicator } from '../components/ui/Skeleton';
import { TabNavigation } from '../components/navigation/TabNavigation';
import api from '../services/api';
import type { TopCustomerByLTV, InactivePatient } from '../types';
import { TrendingUp, Users, DollarSign, Award, Clock, AlertTriangle, Info } from 'lucide-react';

export function PacientesPage() {
  const { data, loadingStates, revalidatingStates } = useDashboard();
  const [topCustomersLTV, setTopCustomersLTV] = useState<TopCustomerByLTV[]>([]);
  const [inactivePatients, setInactivePatients] = useState<InactivePatient[]>([]);
  const [loadingLTV, setLoadingLTV] = useState(true);
  const [loadingInactive, setLoadingInactive] = useState(true);

  // Fixed threshold: 4 months (120 days) as per user requirement
  const INACTIVE_THRESHOLD_DAYS = 120;

  // Use specific loading state for pacientes
  const isLoading = loadingStates.pacientes;
  const isRevalidating = revalidatingStates.pacientes;

  // Fetch LTV data
  useEffect(() => {
    async function fetchLTV() {
      try {
        setLoadingLTV(true);
        const ltvData = await api.getTopCustomersByLTV(50);
        setTopCustomersLTV(ltvData);
      } catch (error) {
        console.error('Erro ao buscar LTV:', error);
      } finally {
        setLoadingLTV(false);
      }
    }
    fetchLTV();
  }, []);

  // Fetch inactive patients using fixed 120 days threshold (4+ months without visiting)
  useEffect(() => {
    async function fetchInactive() {
      try {
        setLoadingInactive(true);
        // Fixed threshold: 120 days (4 months) - patients who haven't visited in 4+ months
        const patients = await api.getInactivePatients(INACTIVE_THRESHOLD_DAYS, 50);
        setInactivePatients(patients);
      } catch (error) {
        console.error('Erro ao buscar pacientes inativos:', error);
      } finally {
        setLoadingInactive(false);
      }
    }
    fetchInactive();
  }, []);

  // LTV columns
  const ltvColumns = [
    {
      key: 'cliente_nome',
      header: 'Cliente',
      className: 'text-[var(--color-text-primary)]',
      render: (v: string) => (
        <div className="max-w-[200px] truncate" title={v}>{v}</div>
      )
    },
    {
      key: 'lifetime_value',
      header: 'LTV Atual (R$)',
      render: (v: number) => formatCurrency(v),
      className: 'text-emerald-500 text-right font-semibold',
      headerClassName: 'text-right',
    },
    {
      key: 'predicted_ltv',
      header: 'LTV Previsto (R$)',
      render: (v: number) => formatCurrency(v),
      className: 'text-blue-400 text-right',
      headerClassName: 'text-right',
    },
    {
      key: 'total_compras',
      header: 'Compras',
      className: 'text-center',
      headerClassName: 'text-center',
    },
    {
      key: 'ticket_medio',
      header: 'Ticket Médio',
      render: (v: number) => formatCurrency(v),
      className: 'text-right',
      headerClassName: 'text-right',
    },
    {
      key: 'rfm_segment',
      header: 'Segmento',
      render: (v: string) => {
        const colors: Record<string, string> = {
          'Champions': 'bg-emerald-500/20 text-emerald-400',
          'Loyal': 'bg-blue-500/20 text-blue-400',
          'Potential': 'bg-amber-500/20 text-amber-400',
          'At Risk': 'bg-orange-500/20 text-orange-400',
          'Low Value': 'bg-gray-500/20 text-gray-400',
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[v] || 'bg-gray-500/20 text-gray-400'}`}>
            {v}
          </span>
        );
      },
      className: 'text-center',
      headerClassName: 'text-center',
    },
  ];

  // Calculate LTV stats
  const ltvStats = {
    totalLTV: topCustomersLTV.reduce((sum, c) => sum + (c.lifetime_value || 0), 0),
    avgLTV: topCustomersLTV.length > 0
      ? topCustomersLTV.reduce((sum, c) => sum + (c.lifetime_value || 0), 0) / topCustomersLTV.length
      : 0,
    champions: topCustomersLTV.filter(c => c.rfm_segment === 'Champions').length,
    avgTicket: topCustomersLTV.length > 0
      ? topCustomersLTV.reduce((sum, c) => sum + (c.ticket_medio || 0), 0) / topCustomersLTV.length
      : 0,
  };

  // Inactive patients calculated stats
  const inactiveCalcStats = {
    totalFaturamento: inactivePatients.reduce((sum, p) => sum + (p.total_investido || 0), 0),
    totalPacientes: inactivePatients.length,
    avgDiasSemVir: inactivePatients.length > 0
      ? Math.round(inactivePatients.reduce((sum, p) => sum + (p.dias_sem_vir || 0), 0) / inactivePatients.length)
      : 0,
  };

  // Mostra skeleton enquanto carrega e não tem dados
  if (isLoading && !data.pacientes && loadingLTV && loadingInactive) {
    return (
      <div className="space-y-6">
        <TabNavigation />
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs - Navigation */}
      <TabNavigation />

      {/* Header with revalidating indicator */}
      <div className="flex items-center justify-end">
        <RevalidatingIndicator isRevalidating={isRevalidating} />
      </div>

      {/* LTV Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">LTV Total (Top 50)</p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {formatCurrency(ltvStats.totalLTV)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">LTV Médio</p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {formatCurrency(ltvStats.avgLTV)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Award className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Champions</p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {ltvStats.champions} pacientes
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Ticket Médio</p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {formatCurrency(ltvStats.avgTicket)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* LTV Table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />
            <span>Top 50 Clientes por LTV (Lifetime Value)</span>
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">
            Ordenado por valor total gasto
          </span>
        </div>

        {loadingLTV ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]"></div>
          </div>
        ) : topCustomersLTV.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-[var(--color-text-muted)] mb-4" />
            <p className="text-[var(--color-text-muted)]">Nenhum dado de LTV disponível</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Execute a análise de clientes para gerar dados
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)]">
                  {ltvColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider ${col.headerClassName || ''}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {topCustomersLTV.map((customer) => (
                  <tr
                    key={customer.cliente_id}
                    className="hover:bg-[var(--color-bg-hover)] transition-colors"
                  >
                    {ltvColumns.map((col) => (
                      <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                        {col.render
                          ? col.render(customer[col.key as keyof TopCustomerByLTV] as never)
                          : customer[col.key as keyof TopCustomerByLTV]
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info about LTV calculation */}
      <div className="card p-4 bg-[var(--color-bg-subtle)]">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          Como é calculado o LTV?
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[var(--color-text-muted)]">
          <div>
            <p><strong className="text-[var(--color-text-secondary)]">LTV Atual:</strong> Soma de todo o valor que o cliente já gastou na clínica.</p>
          </div>
          <div>
            <p><strong className="text-[var(--color-text-secondary)]">LTV Previsto:</strong> Ticket médio × Frequência mensal × 12 meses.</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            <strong className="text-[var(--color-text-secondary)]">Segmentos RFM:</strong>{' '}
            <span className="text-emerald-400">Champions</span> (melhores clientes) → {' '}
            <span className="text-blue-400">Loyal</span> (fiéis) → {' '}
            <span className="text-amber-400">Potential</span> (potenciais) → {' '}
            <span className="text-orange-400">At Risk</span> (em risco) → {' '}
            <span className="text-gray-400">Low Value</span> (baixo valor)
          </p>
        </div>
      </div>

      {/* Seção de Pacientes Inativos (4+ meses sem visitar) */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          Pacientes Inativos
          <span className="text-sm font-normal text-[var(--color-text-muted)]">
            (+{INACTIVE_THRESHOLD_DAYS} dias sem visitar)
          </span>
        </h2>

        {/* Stats Cards for Inactive */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Users className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Pacientes Inativos</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">
                  {inactiveCalcStats.totalPacientes}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <DollarSign className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Valor em Risco</p>
                <p className="text-lg font-bold text-red-400">
                  {formatCurrency(inactiveCalcStats.totalFaturamento)}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Média de Dias Sem Vir</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">
                  {inactiveCalcStats.avgDiasSemVir} dias
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Info className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Limite de Inatividade</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">
                  {INACTIVE_THRESHOLD_DAYS} dias
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Inactive Patients Table */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <span>Pacientes sem visitar há mais de {INACTIVE_THRESHOLD_DAYS} dias (4+ meses)</span>
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">
              Ordenado por valor investido
            </span>
          </div>

          {loadingInactive ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]"></div>
            </div>
          ) : inactivePatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-[var(--color-text-muted)] mb-4" />
              <p className="text-[var(--color-text-muted)]">Nenhum paciente inativo encontrado</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Todos os pacientes estão ativos!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Paciente
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Dias sem vir
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Total Investido
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Compras
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Ticket Médio
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Última Visita
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {inactivePatients.map((patient) => (
                    <tr
                      key={patient.cliente_id}
                      className="hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                      <td className="px-4 py-3 text-[var(--color-text-primary)]">
                        <div className="max-w-[200px] truncate" title={patient.cliente_nome}>
                          {patient.cliente_nome}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          patient.dias_sem_vir > 180
                            ? 'bg-red-500/20 text-red-400'
                            : patient.dias_sem_vir > 150
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {patient.dias_sem_vir} dias
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-400">
                        {formatCurrency(patient.total_investido)}
                      </td>
                      <td className="px-4 py-3 text-center text-[var(--color-text-secondary)]">
                        {patient.total_compras}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                        {formatCurrency(patient.ticket_medio)}
                      </td>
                      <td className="px-4 py-3 text-center text-[var(--color-text-muted)] text-xs">
                        {new Date(patient.ultima_visita).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info about inactive patients */}
        <div className="card p-4 bg-orange-500/5 border-orange-500/20 mt-4">
          <h4 className="text-sm font-semibold text-orange-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Ação Recomendada
          </h4>
          <p className="text-xs text-[var(--color-text-muted)]">
            Estes pacientes não visitam a clínica há mais de {INACTIVE_THRESHOLD_DAYS} dias (4 meses). Considere entrar em contato
            para reagendamento, ofertas especiais ou verificar se há alguma insatisfação.
            O valor em risco representa o potencial de receita recorrente que pode ser recuperado.
          </p>
          <div className="mt-3 pt-3 border-t border-orange-500/20">
            <p className="text-xs text-[var(--color-text-muted)]">
              <Info className="w-3 h-3 inline mr-1" />
              <strong className="text-[var(--color-text-secondary)]">Critério:</strong>{' '}
              Pacientes são considerados inativos quando não visitam a clínica há mais de 4 meses ({INACTIVE_THRESHOLD_DAYS} dias).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
