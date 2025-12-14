import { useState, useEffect } from 'react';
import { FilterBar } from '../components/filters/FilterBar';
import { GaugeChart } from '../components/charts/GaugeChart';
import { BarChartCard } from '../components/charts/BarChartCard';
import { DataTable } from '../components/dashboard/DataTable';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrency } from '../utils/format';
import { PageSkeleton, RevalidatingIndicator } from '../components/ui/Skeleton';

// Mock data
const mockConversaoVenda = [
  { origem: 'Instagram - Perfil Dra Kelly', negocios: 5, valor: 850.00, vendas: 2, faturado: 850.00, taxa: '40,0%' },
  { origem: 'Agendamento Presencial', negocios: 11, valor: 55089.00, vendas: 2, faturado: 13800.00, taxa: '18,2%' },
  { origem: 'Iniciativa Interna', negocios: 276, valor: 1200649.53, vendas: 37, faturado: 34878.50, taxa: '13,4%' },
  { origem: 'Nao identificado', negocios: 48, valor: 285758.99, vendas: 5, faturado: 1321.00, taxa: '10,4%' },
  { origem: 'Iniciativa do paciente', negocios: 257, valor: 1318037.50, vendas: 24, faturado: 45423.90, taxa: '9,3%' },
  { origem: 'Instagram - Perfil SPA', negocios: 16, valor: 7051.00, vendas: 1, faturado: 150.00, taxa: '6,3%' },
  { origem: 'Instagram - Perfil Grupo Crepaldi', negocios: 41, valor: 165785.00, vendas: 1, faturado: 250.00, taxa: '2,4%' },
  { origem: 'Google', negocios: 45, valor: 179598.00, vendas: 0, faturado: 0, taxa: '0,0%' },
];

const mockProcedimentosSpa = [
  { procedimento: 'SUSPENSAO ELASTICA', vendas: 1, faturado: 25000.00 },
  { procedimento: 'ACIDO HIALURONICO', vendas: 3, faturado: 15300.00 },
  { procedimento: 'VIRTUE ABDOMEN', vendas: 1, faturado: 13000.00 },
  { procedimento: 'MASSAGEM RELAXANTE', vendas: 21, faturado: 4180.00 },
  { procedimento: 'CONSULTA MEDICA CRM 6492', vendas: 4, faturado: 2800.00 },
  { procedimento: 'DRA. NATASHA BOTOX FACE E PESCOCO', vendas: 1, faturado: 2600.00 },
  { procedimento: 'RINOMODELACAO', vendas: 1, faturado: 2500.00 },
  { procedimento: 'RADIESSE', vendas: 1, faturado: 1900.00 },
];

const mockProcedimentosBelaLaser = [
  { procedimento: 'Depilacao Motus - Virilha', vendas: 11, faturado: 7931.10 },
  { procedimento: 'Depilacao Motus - Perna Completa', vendas: 4, faturado: 5598.70 },
  { procedimento: 'Depilacao Motus - 1/2 perna', vendas: 4, faturado: 2976.60 },
  { procedimento: 'Depilacao Motus - Virilha completa', vendas: 3, faturado: 3526.20 },
  { procedimento: 'Depilacao Motus - Perianal', vendas: 9, faturado: 3450.61 },
  { procedimento: 'Depilacao Motus - Face lateral', vendas: 2, faturado: 1924.20 },
  { procedimento: 'ULTRAFORME III-FULL FACE', vendas: 1, faturado: 1920.00 },
];

const mockProfissionais = [
  { name: 'DRA NATASHA', value: 389170.00 },
  { name: 'DRA KELLY DACAS', value: 125650.00 },
  { name: 'EVELIN', value: 119350.00 },
  { name: 'CINTYA', value: 99028.00 },
  { name: 'THALITA', value: 47545.00 },
  { name: 'MAYRA RIBEIRO', value: 33000.00 },
  { name: 'MARIA APARECIDA ALICE DE SOUZA', value: 32777.40 },
  { name: 'LETYCIA OLIVEIRA', value: 24469.00 },
  { name: 'DRA PAULO', value: 20170.00 },
  { name: 'AMANDA RAFAELA FINNKLER', value: 14734.21 },
];

export function ComercialPage() {
  const { data, loadingStates, revalidatingStates, filters, setFilters, filterOptions } = useDashboard();

  // Use specific loading state for comercial
  const isLoading = loadingStates.comercial;
  const isRevalidating = revalidatingStates.comercial;

  const [metas, setMetas] = useState({
    spa: { atual: 0, meta: 1060000 },
    convenios: { atual: 0, meta: 210000 },
    belaLaser: { atual: 0, meta: 100000 },
  });

  useEffect(() => {
    if (data.comercial) {
      setMetas(data.comercial.metas);
    }
  }, [data.comercial]);

  const conversaoColumns = [
    { key: 'origem', header: 'Origem Lead', className: 'text-primary-400' },
    { key: 'negocios', header: 'Negocios', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    { key: 'valor', header: 'Valor (R$)', render: (v: string | number) => formatCurrency(Number(v)), className: 'text-primary-400 text-right', headerClassName: 'text-right' },
    { key: 'vendas', header: 'Vendas', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    { key: 'faturado', header: 'Faturado (R$)', render: (v: string | number) => formatCurrency(Number(v)), className: 'text-primary-400 text-right', headerClassName: 'text-right' },
    { key: 'taxa', header: 'Taxa Conversao', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
  ];

  const procedimentoColumns = [
    { key: 'procedimento', header: 'Procedimento' },
    { key: 'vendas', header: 'Vendas', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    { key: 'faturado', header: 'Faturado (R$)', render: (v: string | number) => formatCurrency(Number(v)), className: 'text-primary-400 text-right', headerClassName: 'text-right' },
  ];

  // Mostra skeleton enquanto carrega e nao tem dados
  if (isLoading && !data.comercial) {
    return (
      <div className="space-y-6">
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          filterOptions={filterOptions}
        />
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Conversao de Venda por Origem */}
      <DataTable
        title="Conversao de Venda por Origem"
        columns={conversaoColumns}
        data={mockConversaoVenda}
        maxRows={7}
      />

      {/* Procedimentos Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DataTable
          title="Procedimentos Clinica SPA"
          columns={procedimentoColumns}
          data={mockProcedimentosSpa}
          maxRows={29}
        />

        <DataTable
          title="Procedimentos Bela Laser"
          columns={procedimentoColumns}
          data={mockProcedimentosBelaLaser}
          maxRows={26}
        />
      </div>

      {/* Metas Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GaugeChart
          title="Meta SPA"
          value={metas.spa.atual}
          maxValue={metas.spa.meta}
        />
        <GaugeChart
          title="Meta Convenios"
          value={metas.convenios.atual}
          maxValue={metas.convenios.meta}
        />
        <GaugeChart
          title="Meta Bela Laser"
          value={metas.belaLaser.atual}
          maxValue={metas.belaLaser.meta}
        />
      </div>

      {/* Profissional Performance */}
      <BarChartCard
        title="PROFISSIONAL"
        data={mockProfissionais}
        color="#60a5fa"
        height={400}
        formatYAxis="currency"
      />

    </div>
  );
}
