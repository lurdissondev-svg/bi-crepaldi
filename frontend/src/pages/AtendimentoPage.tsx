import { FilterBar } from '../components/filters/FilterBar';
import { DataTable } from '../components/dashboard/DataTable';
import { PieChartCard } from '../components/charts/PieChartCard';
import { TabNavigation } from '../components/navigation/TabNavigation';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrency } from '../utils/format';
import { PageSkeleton, RevalidatingIndicator } from '../components/ui/Skeleton';

// Mock data
const mockDesempenho = [
  { responsavel: 'Mayara Rubia', total_orcamentos: 53, valor_total_orcado: 234424.00, aprovados: 52, valor_total_aprovado: 226424.00, percentual: 98 },
  { responsavel: 'Suyane Cristhini', total_orcamentos: 201, valor_total_orcado: 644425.70, aprovados: 200, valor_total_aprovado: 642845.70, percentual: 100 },
];

const mockTicketMedio = [
  { procedimento: 'Voucher', ticket_medio: 1341.95, vendas: 40, faturamento_total: 53678.00 },
  { procedimento: 'MOUNJARO', ticket_medio: 15333.33, vendas: 3, faturamento_total: 46000.00 },
  { procedimento: 'ONDA COOLWAVES', ticket_medio: 5325.00, vendas: 6, faturamento_total: 31950.00 },
  { procedimento: 'MASSAGEM RELAXANTE', ticket_medio: 242.33, vendas: 114, faturamento_total: 27626.00 },
  { procedimento: 'Ultraformer - Boom de colágeno - Face e Pescoço - 3 sessões', ticket_medio: 9000.00, vendas: 3, faturamento_total: 27000.00 },
  { procedimento: 'Ácido Hialurônico - 1 ampola', ticket_medio: 6200.00, vendas: 4, faturamento_total: 24800.00 },
  { procedimento: 'Ultraformer MPT - Face e pescoço', ticket_medio: 7366.67, vendas: 3, faturamento_total: 22100.00 },
  { procedimento: 'VOLNEWMER', ticket_medio: 10665.00, vendas: 2, faturamento_total: 21330.00 },
  { procedimento: 'CONSULTA', ticket_medio: 1037.50, vendas: 20, faturamento_total: 20750.00 },
  { procedimento: 'PROTOCOLO CLARIFY - PICOSURE + FOTONA', ticket_medio: 15000.00, vendas: 1, faturamento_total: 15000.00 },
];

const mockPareto8020 = [
  { name: 'VOLNEWMER', value: 21330.00 },
  { name: 'Voucher', value: 53678.00 },
  { name: 'Ultraformer MPT', value: 22100.00 },
  { name: 'Ácido Hialurônico', value: 24800.00 },
  { name: 'MOUNJARO', value: 46000.00 },
  { name: 'Botox face', value: 18500.00 },
  { name: 'ONDA COOLWAVES', value: 31950.00 },
  { name: 'VOLFORMER', value: 15000.00 },
  { name: 'Botox face e pescoço', value: 12000.00 },
  { name: 'EMFACE - 4 sessões', value: 11000.00 },
];

export function AtendimentoPage() {
  const { data, loadingStates, revalidatingStates, filters, setFilters, filterOptions } = useDashboard();

  // Use specific loading state for atendimento
  const isLoading = loadingStates.atendimento;
  const isRevalidating = revalidatingStates.atendimento;


  const desempenhoColumns = [
    { key: 'responsavel', header: 'Responsável', className: 'text-primary-400' },
    { key: 'total_orcamentos', header: 'Total de Orçamentos', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    { key: 'valor_total_orcado', header: 'Valor Orçado (R$)', render: (v: string | number) => formatCurrency(Number(v)), className: 'text-primary-400 text-right', headerClassName: 'text-right' },
    { key: 'aprovados', header: 'Aprovados', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    { key: 'valor_total_aprovado', header: 'Valor Aprovado (R$)', render: (v: string | number) => formatCurrency(Number(v)), className: 'text-primary-400 text-right', headerClassName: 'text-right' },
    {
      key: 'percentual',
      header: '%',
      headerClassName: 'text-center',
      className: 'text-center',
      render: (v: string | number) => (
        <div className="flex items-center justify-center gap-2">
          <span>{v}%</span>
          <div className="w-20 h-2 bg-dark-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full"
              style={{ width: `${v}%` }}
            />
          </div>
        </div>
      ),
    },
  ];

  const ticketMedioColumns = [
    { key: 'procedimento', header: 'Procedimento', className: 'text-primary-400' },
    { key: 'ticket_medio', header: 'Ticket Médio (R$)', render: (v: string | number) => formatCurrency(Number(v)), className: 'text-primary-400 text-right', headerClassName: 'text-right' },
    { key: 'vendas', header: 'Vendas', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    { key: 'faturamento_total', header: 'Faturamento Total (R$)', render: (v: string | number) => formatCurrency(Number(v)), className: 'text-primary-400 text-right', headerClassName: 'text-right' },
  ];

  // Mostra skeleton enquanto carrega e não tem dados
  if (isLoading && !data.atendimento) {
    return (
      <div className="space-y-6">
        <TabNavigation />
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          filterOptions={filterOptions}
          showProfissional
        />
        <PageSkeleton />
      </div>
    );
  }

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
            showProfissional
          />
        </div>
        <RevalidatingIndicator isRevalidating={isRevalidating} />
      </div>

      {/* Desempenho Table */}
      <DataTable
        title="Desempenho"
        columns={desempenhoColumns}
        data={mockDesempenho}
      />

      {/* Ticket Médio por Procedimento Section */}
      <h2 className="text-lg font-semibold text-dark-text mt-8">TICKED MÉDIO POR PROCEDIMENTO</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Médio Table */}
        <DataTable
          title="Ticked Medio por Procedimento"
          columns={ticketMedioColumns}
          data={mockTicketMedio}
        />

        {/* Pareto 80/20 Pie Chart */}
        <PieChartCard
          title="Ticked Medio por Procedimento 80/20"
          data={mockPareto8020}
          showTotal
          totalLabel=""
          height={400}
          innerRadius={80}
          outerRadius={140}
        />
      </div>

    </div>
  );
}
