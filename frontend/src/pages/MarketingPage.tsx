import { useEffect, useMemo } from 'react';
import { FilterBar } from '../components/filters/FilterBar';
import { BarChartCard } from '../components/charts/BarChartCard';
import { PieChartCard } from '../components/charts/PieChartCard';
import { ConversionFunnel } from '../components/charts/ConversionFunnel';
import { UTMAnalytics } from '../components/charts/UTMAnalytics';
import { StatusDistribution } from '../components/charts/StatusDistribution';
import { DataTable } from '../components/dashboard/DataTable';
import { useDashboard } from '../hooks/useDashboard';
import { PageSkeleton } from '../components/ui/Skeleton';

export function MarketingPage() {
  const { data, loading, filters, setFilters, filterOptions, fetchMarketing } = useDashboard();

  useEffect(() => {
    fetchMarketing();
  }, [fetchMarketing]);

  // Transform API data for charts - derived from real data
  const horarioChegadaData = useMemo(() => {
    if (!data.marketing?.horarioChegada) return [];
    return data.marketing.horarioChegada.map(item => ({
      name: item.hora,
      value: item.leads,
    }));
  }, [data.marketing?.horarioChegada]);

  const taxaConversaoData = useMemo(() => {
    if (!data.marketing?.origemLead?.taxaConversaoPorOrigem) return [];
    return data.marketing.origemLead.taxaConversaoPorOrigem.map(item => ({
      origem_lead: item.origem || 'Sem Preenchimento',
      leads: item.leads,
      em_atendimento: item.emAtendimento,
      desqualificados: item.desqualificados,
      retencao_futura: item.retencaoFutura,
      agendou: item.agendou,
      taxa_conversao: item.taxaConversao,
    }));
  }, [data.marketing?.origemLead?.taxaConversaoPorOrigem]);

  const totalLeadsData = useMemo(() => {
    if (!data.marketing?.origemLead?.totalLeads) return [];
    const { total, semPreenchimento, iniciativaInterna, outro } = data.marketing.origemLead.totalLeads;
    if (total === 0) return [];

    const result = [];
    if (semPreenchimento > 0) {
      result.push({ name: 'Sem Preenchimento', value: semPreenchimento });
    }
    if (iniciativaInterna > 0) {
      result.push({ name: 'Iniciativa Interna', value: iniciativaInterna });
    }
    // Calculate "other" as total minus known categories
    const outroValue = total - semPreenchimento - iniciativaInterna;
    if (outroValue > 0) {
      result.push({ name: 'Outro', value: outroValue });
    }
    return result;
  }, [data.marketing?.origemLead?.totalLeads]);

  const localData = useMemo(() => ({
    totalLeads: data.marketing?.origemLead?.totalLeads?.total || 0,
    leadsEmAtendimento: data.marketing?.leadsEmAtendimento?.total || 0,
    leadsDesqualificados: data.marketing?.leadsDesqualificados?.total || 0,
  }), [data.marketing]);

  const conversionFunnelData = useMemo(() => {
    return data.marketing?.conversionFunnel || [];
  }, [data.marketing?.conversionFunnel]);

  const utmData = useMemo(() => ({
    bySource: data.marketing?.byUtmSource || [],
    byMedium: data.marketing?.byUtmMedium || [],
    byCampaign: data.marketing?.byUtmCampaign || [],
  }), [data.marketing?.byUtmSource, data.marketing?.byUtmMedium, data.marketing?.byUtmCampaign]);

  const statusDistributionData = useMemo(() => {
    return data.marketing?.statusDistribution || [];
  }, [data.marketing?.statusDistribution]);

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
      {horarioChegadaData.length > 0 ? (
        <BarChartCard
          title="Horário de chegada dos Leads"
          data={horarioChegadaData}
          color="#60a5fa"
          height={300}
          formatYAxis="number"
          showLabels={false}
        />
      ) : (
        <div className="card">
          <h3 className="card-header">Horário de chegada dos Leads</h3>
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-dark-muted text-sm">Nenhum dado encontrado para o período selecionado</p>
          </div>
        </div>
      )}

      {/* Origem do Lead Section */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-dark-text">Origem do Lead</h2>

        {/* Taxa de Conversão por Origem */}
        <DataTable
          title="Taxa de Conversão por Origem"
          columns={tableColumns}
          data={taxaConversaoData}
          showRowCount
        />

        {/* Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Total de Leads Pie Chart */}
          {totalLeadsData.length > 0 ? (
            <PieChartCard
              title="Total de Leads"
              data={totalLeadsData}
              showTotal
              totalLabel="TOTAL"
              height={300}
            />
          ) : (
            <div className="card">
              <h3 className="card-header">Total de Leads</h3>
              <div className="flex flex-col items-center justify-center h-64">
                <span className="text-3xl font-bold text-dark-text">{localData.totalLeads}</span>
                <span className="text-xs text-dark-muted">TOTAL</span>
              </div>
            </div>
          )}

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
                    strokeDasharray={`${localData.totalLeads > 0 ? (localData.leadsEmAtendimento / localData.totalLeads) * 352 : 0} 352`}
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
              {localData.leadsDesqualificados > 0 ? (
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
                      stroke="#ef4444"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${localData.totalLeads > 0 ? (localData.leadsDesqualificados / localData.totalLeads) * 352 : 0} 352`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-dark-text">{localData.leadsDesqualificados}</span>
                    <span className="text-xs text-dark-muted">TOTAL</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-24 h-24 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-16 h-16 text-dark-muted" fill="none" stroke="currentColor" strokeWidth="1">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <p className="text-dark-muted text-sm mt-4">Nenhum resultado!</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Funil de Conversão */}
      <ConversionFunnel
        data={conversionFunnelData}
        title="Funil de Conversão de Leads"
        showLabels
        height={400}
      />

      {/* Análise de UTM e Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UTMAnalytics
          bySource={utmData.bySource}
          byMedium={utmData.byMedium}
          byCampaign={utmData.byCampaign}
          title="Análise de Parâmetros UTM"
        />

        <StatusDistribution
          data={statusDistributionData}
          title="Distribuição de Status dos Leads"
          showDaysInStatus
        />
      </div>

    </div>
  );
}
