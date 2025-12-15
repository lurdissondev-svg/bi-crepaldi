export interface DateRange {
  start: string;
  end: string;
}

export interface FilterState {
  dataInicio: string;
  dataFim: string;
  centrosCusto: string[];
  profissional?: string;
  confirmado?: string;
  tipo?: string;
  fonte?: string;
  origem?: string;
  faseLead?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

// Dashboard Resumo
export interface ResumoData {
  faturamento: {
    total: number;
    totalFormatado: string;
    variacao: string;
    mesAnterior: number;
  };
  pacienteNovo: {
    leadsNovos: number;
    leadsAgendados: number;
    pacientesVenda: number;
    ticketMedio: number;
    ticketMedioFormatado: string;
  };
  pacienteRecorrente: {
    leads: number;
    leadsAgendados: number;
    pacientes: number;
    ticketMedio: number;
    ticketMedioFormatado: string;
  };
  desempenhoDezena: Array<{
    dezena: string;
    mes_atual: number;
    mes_anterior: number;
  }>;
  procedimentosPorCategoria: Array<{
    nome: string;
    quantidade: number;
    valor: number;
  }>;
}

// Dashboard Faturamento
export interface FaturamentoData {
  mensal: {
    valor: number;
    valorFormatado: string;
    variacao: string;
    mesAnterior: number;
    mesAnteriorFormatado: string;
    pacientesNovosPercentual: number;
  };
  anual: {
    valor: number;
    valorFormatado: string;
    variacao: string;
    anoAnterior: number;
    anoAnteriorFormatado: string;
    pacientesNovosPercentual: number;
  };
  crescimentoMensal: {
    mesPassadoAnoAnterior: number;
    mesAtual: number;
    percentual: number;
  };
  crescimentoAnual: {
    anoAnterior: number;
    anoAtual: number;
    percentual: number;
  };
  vendasHoje: {
    valor: number;
    valorFormatado: string;
    quantidade: number;
  } | null;
  faturamentoDiario: Array<{
    data: string;
    valor: number;
  }>;
  faturamentoMensalHistorico: Array<{
    mes: string;
    valor: number;
  }>;
}

// Conversion Funnel Stage
export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  conversionFromPrevious?: number;
}

// Dashboard Marketing
export interface MarketingData {
  horarioChegada: Array<{
    hora: string;
    leads: number;
  }>;
  origemLead: {
    taxaConversaoPorOrigem: Array<{
      origem: string;
      leads: number;
      emAtendimento: number;
      desqualificados: number;
      retencaoFutura: number;
      agendou: number;
      taxaConversao: string;
    }>;
    totalLeads: {
      total: number;
      semPreenchimento: number;
      iniciativaInterna: number;
      outro: number;
    };
  };
  leadsEmAtendimento: {
    total: number;
  };
  leadsDesqualificados: {
    total: number;
  };
  conversionFunnel?: FunnelStage[];
  byUtmSource: Array<{
    source: string;
    total: number;
    converted: number;
    disqualified: number;
    inProgress: number;
    campaigns: Record<string, { total: number; converted: number; disqualified: number }>;
  }>;
  byUtmMedium: Array<{
    medium: string;
    total: number;
    converted: number;
    disqualified: number;
    inProgress: number;
  }>;
  byUtmCampaign: Array<{
    campaign: string;
    total: number;
    converted: number;
    disqualified: number;
    inProgress: number;
    sources: Record<string, { total: number; converted: number }>;
  }>;
  bySource: Array<{
    id: string;
    name: string;
    total: number;
    converted: number;
    disqualified: number;
    inProgress: number;
    value: number;
  }>;
  statusDistribution: Array<{
    id: string;
    name: string;
    count: number;
    semantic: string;
    avgDaysInStatus: number;
  }>;
  conversionRate: string;
  heatmap?: Array<{
    dayOfWeek: number;
    hour: number;
    count: number;
  }>;
  metrics?: {
    avgConversionDays: number;
    avgInProgressDays: number;
    totalConverted: number;
    totalDisqualified: number;
  };
}

// Dashboard Comercial
export interface ComercialData {
  conversaoVendaPorOrigem: Array<{
    origem: string;
    negocios: number;
    valor: number;
    valorFormatado: string;
    vendas: number;
    faturado: number;
    faturadoFormatado: string;
    taxaConversao: string;
  }>;
  procedimentosPorCentro: {
    clinicaSpa: Array<{ nome: string; quantidade: number; valor: number }>;
    belaLaser: Array<{ nome: string; quantidade: number; valor: number }>;
    convenios: Array<{ nome: string; quantidade: number; valor: number }>;
  };
  procedimentosPacienteNovo: {
    labels: string[];
    vendas: number[];
    faturamento: number[];
  };
  metas: {
    spa: { atual: number; meta: number };
    convenios: { atual: number; meta: number };
    belaLaser: { atual: number; meta: number };
  };
  profissionais: Array<{
    nome: string;
    vendas: number;
    valor: number;
  }>;
}

// Dashboard Atendimento
export interface AtendimentoData {
  desempenho: Array<{
    responsavel: string;
    totalOrcamentos: number;
    valorTotalOrcado: number;
    aprovados: number;
    valorTotalAprovado: number;
    percentual: number;
  }>;
  ticketMedioPorProcedimento: Array<{
    procedimento: string;
    ticketMedio: number;
    ticketMedioFormatado: string;
    vendas: number;
    faturamentoTotal: number;
    faturamentoTotalFormatado: string;
  }>;
  pareto8020: Array<{
    procedimento: string;
    ticketMedio: number;
    faturamentoTotal: number;
    percentualAcumulado: string;
  }>;
  totalFaturamento: number;
  totalFaturamentoFormatado: string;
}

// Dashboard Metas
export interface MetaInfo {
  expectativa: number;
  realidade: number;
  diaria: number;
  metaValor: number;
  metaValorFormatado: string;
  faturamentoAtual: number;
  faturamentoAtualFormatado: string;
  diasRestantes: number;
}

export interface MetaEstabelecimento {
  nome: string;
  faturamentoAtual: number;
  faturamentoAtualFormatado: string;
  meta1: MetaInfo;
  meta2: MetaInfo;
  meta3: MetaInfo;
}

export interface MetasData {
  metaSpa: MetaEstabelecimento;
  metaConvenios: MetaEstabelecimento;
  metaBelaLaser: MetaEstabelecimento;
  metaNutrologia: MetaEstabelecimento;
  progressoGeral: {
    faturamentoTotal: number;
    faturamentoTotalFormatado: string;
    diasPassados: number;
    diasRestantes: number;
    totalDias: number;
    expectativaPct: number;
  };
}

// Dashboard Pacientes
export interface PacientesData {
  faturamentoPaciente: Array<{
    cliente: string;
    clienteId: string | number;
    investimento: number;
    quantidadeVendas: number;
  }>;
  potenciaisMais4Meses: Array<{
    cliente: string;
    clienteId: string | number;
    diasSemVir: number;
    investimento: number;
  }>;
  potenciaisMenos4Meses: Array<{
    cliente: string;
    clienteId: string | number;
    diasSemVir: number;
    investimento: number;
  }>;
  totalClientes: number;
}

// Meta Ads Configuration
export interface MetaAdsConfig {
  appId: string;
  appSecret: string;
  accessToken: string;
  adAccountId: string;
  pixelId?: string;
  status: 'pending' | 'configured' | 'error';
  lastSync?: string;
  errorMessage?: string;
}

export interface MetaAdsValidationResult {
  valid: boolean;
  message: string;
  accountName?: string;
  permissions?: string[];
}

// Filter Options
export interface FilterOptions {
  leadStatuses: Array<{ STATUS_ID: string; NAME: string }>;
  leadSources: Array<{ STATUS_ID: string; NAME: string }>;
  dealStages: Array<{ STATUS_ID: string; NAME: string }>;
  dealCategories: Array<{ id: number; name: string }>;
  centrosCusto: Array<{ id: string; nome: string }>;
  profissionais: Array<{ id: string; nome: string }>;
}

// Customer Analytics (Phase 2)
export interface ConversionMetrics {
  total_leads: number;
  converted: number;
  disqualified: number;
  in_progress: number;
  conversion_rate: number;
  avg_conversion_days: number | null;
  avg_in_progress_days: number | null;
}

export interface ConversionFunnelStage {
  stage: string;
  stageId: string;
  semantic: string | null;
  count: number;
  percentage: number;
  avgDaysInStage: number;
  dropOffRate: number;
}

export interface ReturningCustomerStats {
  returning_leads: number;
  new_leads: number;
  total_leads: number;
  returning_rate: number;
}

export interface RFMSegment {
  rfm_segment: string;
  count: number;
  avg_ltv: number;
  avg_purchases: number;
  avg_ticket: number;
}

export interface TopCustomerByLTV {
  cliente_id: number;
  cliente_nome: string;
  total_compras: number;
  total_gasto: number;
  ticket_medio: number;
  dias_como_cliente: number;
  frequencia_mensal: number;
  lifetime_value: number;
  predicted_ltv: number;
  rfm_segment: string;
}

// Marketing ROI (Phase 4)
export interface MarketingROIBySource {
  source: string;
  total_leads: number;
  converted_leads: number;
  total_revenue: number;
  total_spend: number;
  roas: number | null;
  cpl: number | null;
  conversion_rate: number;
}

export interface MarketingROITotals {
  totalLeads: number;
  convertedLeads: number;
  totalRevenue: number;
  totalSpend: number;
  roas: string | null;
  cpl: string | null;
  conversionRate: string;
}

export interface MarketingROIData {
  bySource: MarketingROIBySource[];
  totals: MarketingROITotals;
}

export interface SpendTrendData {
  date: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
}

export interface MetaAdsSummary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalLeads: number;
  totalReach: number;
  avgCpc: number;
  avgCpm: number;
  avgCtr: number;
  costPerLead: number | null;
}

// Paciente Inativo (mais de X dias sem vir)
export interface InactivePatient {
  cliente_id: number;
  cliente_nome: string;
  ultima_visita: string;
  dias_sem_vir: number;
  total_investido: number;
  total_compras: number;
  ticket_medio: number;
}

// Pacientes Inativos - Endpoint Dinâmico (percentile-based)
export interface InactivePatientsDynamicStats {
  min_dias: number;
  max_dias: number;
  avg_dias: number;
  total_pacientes: number;
  percentile_used: number;
}

export interface InactivePatientsDynamicResponse {
  threshold_days: number;
  stats: InactivePatientsDynamicStats;
  patients: InactivePatient[];
}

// Pacientes com atraso baseado em frequência
export interface PatientOverdue {
  cliente_id: number;
  cliente_nome: string;
  ultima_visita: string;
  dias_desde_ultima: number;
  total_visitas: number;
  intervalo_medio_dias: number;
  dias_atraso: number;
  urgencia: 'critico' | 'alto' | 'medio' | 'baixo';
  total_investido: number;
}

export interface PatientsOverdueResponse {
  multiplier_used: number;
  patients: PatientOverdue[];
}

// Resumo de risco de churn
export interface ChurnRiskLevel {
  nivel_risco: 'critico' | 'alto' | 'medio' | 'ativo';
  quantidade: number;
  valor_em_risco: number;
}

export type ChurnRiskSummaryResponse = ChurnRiskLevel[];
