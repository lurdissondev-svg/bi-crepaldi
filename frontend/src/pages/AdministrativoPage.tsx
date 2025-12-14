import { useEffect } from 'react';
import { FilterBar } from '../components/filters/FilterBar';
import { DataTable } from '../components/dashboard/DataTable';
import { PieChartCard } from '../components/charts/PieChartCard';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrency } from '../utils/format';

// Mock data - same as Atendimento for now
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
  { procedimento: 'AVALIACAO DE PROCEDIMENTO', ticket_medio: 382.05, vendas: 39, faturamento_total: 14900.00 },
  { procedimento: 'FOTONA', ticket_medio: 3375.00, vendas: 4, faturamento_total: 13500.00 },
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
  { name: 'Radiesse - 1 ampola', value: 9500.00 },
  { name: 'EMSCULPT NEO', value: 8500.00 },
];

export function AdministrativoPage() {
  const { loading, filters, setFilters, filterOptions, fetchAtendimento } = useDashboard();

  useEffect(() => {
    fetchAtendimento();
  }, [fetchAtendimento]);

  const desempenhoColumns = [
    { key: 'responsavel', header: 'responsavel', className: 'text-primary-400' },
    { key: 'total_orcamentos', header: 'Total de Orçamentos', className: 'text-primary-400' },
    { key: 'valor_total_orcado', header: 'Valor total Orçado (R$)', render: (v: string | number) => formatCurrency(Number(v)), className: 'text-primary-400' },
    { key: 'aprovados', header: 'Aprovados', className: 'text-primary-400' },
    { key: 'valor_total_aprovado', header: 'Valor Total Aprovado (R$)', render: (v: string | number) => formatCurrency(Number(v)), className: 'text-primary-400' },
    {
      key: 'percentual',
      header: '%',
      render: (v: string | number) => (
        <div className="flex items-center gap-2">
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
    { key: 'ticket_medio', header: 'Ticket Medio (R$)', render: (v: string | number) => formatCurrency(Number(v)), className: 'text-primary-400' },
    { key: 'vendas', header: 'Venda', className: 'text-primary-400' },
    { key: 'faturamento_total', header: 'Faturamento Total (R$)', render: (v: string | number) => formatCurrency(Number(v)), className: 'text-primary-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-lg font-semibold text-dark-text">DESEMPENHO</h2>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterOptions={filterOptions}
        showProfissional
      />

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
