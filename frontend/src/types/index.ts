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
  byUtmSource: Array<{
    source: string;
    total: number;
    converted: number;
    disqualified: number;
    campaigns: Record<string, { total: number; converted: number }>;
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
  conversionRate: string;
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
export interface MetasData {
  metaSpa: {
    meta1: { expectativa: number; realidade: number; diaria: number };
    meta2: { expectativa: number; realidade: number; diaria: number };
    meta3: { expectativa: number; realidade: number; diaria: number };
  };
  metasGerais: Array<{
    nome: string;
    valor: number;
    meta: number;
    percentual: number;
  }>;
  progressoGeral: {
    faturamentoAtual: number;
    faturamentoAtualFormatado: string;
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

// Filter Options
export interface FilterOptions {
  leadStatuses: Array<{ STATUS_ID: string; NAME: string }>;
  leadSources: Array<{ STATUS_ID: string; NAME: string }>;
  dealStages: Array<{ STATUS_ID: string; NAME: string }>;
  dealCategories: Array<{ id: number; name: string }>;
  centrosCusto: Array<{ id: string; nome: string }>;
  profissionais: Array<{ id: string; nome: string }>;
}
