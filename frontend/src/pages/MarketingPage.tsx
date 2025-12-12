import { useEffect, useState } from 'react';
import { FilterBar } from '../components/filters/FilterBar';
import { BarChartCard } from '../components/charts/BarChartCard';
import { PieChartCard } from '../components/charts/PieChartCard';
import { DataTable } from '../components/dashboard/DataTable';
import { useDashboard } from '../hooks/useDashboard';
import { formatPercentage } from '../utils/format';
import { PageSkeleton } from '../components/ui/Skeleton';

// Mock data
const mockHorarioChegada = [
  { name: '0:00', value: 52 },
  { name: '1:00', value: 81 },
  { name: '2:00', value: 34 },
  { name: '3:00', value: 22 },
  { name: '4:00', value: 16 },
  { name: '5:00', value: 3 },
  { name: '6:00', value: 4 },
  { name: '7:00', value: 6 },
  { name: '8:00', value: 27 },
  { name: '9:00', value: 41 },
  { name: '10:00', value: 95 },
  { name: '11:00', value: 147 },
  { name: '12:00', value: 195 },
  { name: '13:00', value: 249 },
  { name: '14:00', value: 212 },
  { name: '15:00', value: 175 },
  { name: '16:00', value: 177 },
  { name: '17:00', value: 205 },
  { name: '18:00', value: 177 },
  { name: '19:00', value: 175 },
  { name: '20:00', value: 245 },
  { name: '21:00', value: 72 },
  { name: '22:00', value: 60 },
];

const mockTaxaConversao = [
  { origem_lead: '', leads: 2477, em_atendimento: 0, desqualificados: 0, retencao_futura: 0, agendou: 0, taxa_conversao: '0%' },
  { origem_lead: 'Instagram - Perfil Bela Laser', leads: 1, em_atendimento: 0, desqualificados: 0, retencao_futura: 0, agendou: 0, taxa_conversao: '0%' },
  { origem_lead: 'Iniciativa Interna', leads: 81, em_atendimento: 51, desqualificados: 0, retencao_futura: 0, agendou: 0, taxa_conversao: '0%' },
  { origem_lead: 'Não identificado', leads: 30, em_atendimento: 0, desqualificados: 0, retencao_futura: 0, agendou: 0, taxa_conversao: '0%' },
  { origem_lead: 'Instagram - Perfil Dra Natasha', leads: 1, em_atendimento: 0, desqualificados: 0, retencao_futura: 0, agendou: 0, taxa_conversao: '0%' },
  { origem_lead: '3612', leads: 4, em_atendimento: 0, desqualificados: 0, retencao_futura: 0, agendou: 0, taxa_conversao: '0%' },
];

const mockTotalLeads = [
  { name: 'Sem Preenchimento', value: 96.4102 },
  { name: 'Iniciativa Interna', value: 3.3072 },
  { name: 'Outro', value: 0.0827 },
];

export function MarketingPage() {
  const { data, loading, filters, setFilters, filterOptions, fetchMarketing } = useDashboard();

  const [localData, setLocalData] = useState({
    totalLeads: 2419,
    leadsEmAtendimento: 81,
    leadsDesqualificados: 0,
  });

  useEffect(() => {
    fetchMarketing();
  }, [fetchMarketing]);

  useEffect(() => {
    if (data.marketing) {
      setLocalData({
        totalLeads: data.marketing.origemLead.totalLeads.total,
        leadsEmAtendimento: data.marketing.leadsEmAtendimento.total,
        leadsDesqualificados: data.marketing.leadsDesqualificados.total,
      });
    }
  }, [data.marketing]);

  const tableColumns = [
    { key: 'origem_lead', header: 'Origem Lead', className: 'text-primary-400' },
    { key: 'leads', header: 'Leads', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    { key: 'em_atendimento', header: 'Em Atendimento', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    { key: 'desqualificados', header: 'Desqualificados', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    { key: 'retencao_futura', header: 'Retenção Futura', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    { key: 'agendou', header: 'Agendou', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    { key: 'taxa_conversao', header: 'Taxa Conversão', className: 'text-primary-400 text-center', headerClassName: 'text-center' },
  ];

  // Mostra skeleton enquanto carrega e não tem dados
  if (loading && !data.marketing) {
    return (
      <div className="space-y-6">
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          filterOptions={filterOptions}
          showTipo
          showFonte
          showOrigem
          showFaseLead
        />
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterOptions={filterOptions}
        showTipo
        showFonte
        showOrigem
        showFaseLead
      />

      {/* Horário de Chegada dos Leads */}
      <BarChartCard
        title="Horário de chegada dos Leads"
        data={mockHorarioChegada}
        color="#60a5fa"
        height={300}
        formatYAxis="number"
        showLabels={false}
      />

      {/* Origem do Lead Section */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-dark-text">Origem do Lead</h2>

        {/* Taxa de Conversão por Origem */}
        <DataTable
          title="Taxa de Conversão por Origem"
          columns={tableColumns}
          data={mockTaxaConversao}
          showRowCount
        />

        {/* Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Total de Leads Pie Chart */}
          <PieChartCard
            title="Total de Leads"
            data={mockTotalLeads.map(item => ({
              name: item.name,
              value: (item.value / 100) * localData.totalLeads,
            }))}
            showTotal
            totalLabel="TOTAL"
            height={300}
          />

          {/* Leads em Atendimento */}
          <div className="card">
            <h3 className="card-header">Leads em Atendimento</h3>
            <div className="flex flex-col items-center justify-center h-64">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#334155"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#60a5fa"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(localData.leadsEmAtendimento / localData.totalLeads) * 352} 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-dark-text">{localData.leadsEmAtendimento}</span>
                  <span className="text-xs text-dark-muted">TOTAL</span>
                </div>
              </div>
            </div>
          </div>

          {/* Leads Desqualificados */}
          <div className="card">
            <h3 className="card-header">Leads Desqualificados</h3>
            <div className="flex flex-col items-center justify-center h-64">
              <div className="w-24 h-24 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-16 h-16 text-dark-muted" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <p className="text-dark-muted text-sm mt-4">Nenhum resultado!</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
