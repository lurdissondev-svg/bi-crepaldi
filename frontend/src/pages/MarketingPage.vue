<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import BarChartCard from '@/components/charts/BarChartCard.vue'
import PieChartCard from '@/components/charts/PieChartCard.vue'
import DataTable from '@/components/dashboard/DataTable.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import KPIStrip, { type KPIItem } from '@/components/charts/KPIStrip.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import { Users, UserCheck, UserX, Target, Clock, TrendingUp, DollarSign, Percent, Wallet, AlertTriangle, CheckCircle, XCircle, Activity, Zap } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'
import { api } from '@/services/api'
import type { CACCanal } from '@/types'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.marketing)
const isRevalidating = computed(() => revalidatingStates.value.marketing)

const marketingData = computed(() => data.value.marketing)

// ROAS/CPL metrics
interface ROASMetrics {
  bySource: Array<{
    source: string
    leads: number
    converted: number
    revenue: number
    spend: number
    cpl: number
    cpa: number
    roas: number
    conversionRate: number
  }>
  totals: {
    totalLeads: number
    convertedLeads: number
    revenue: number
    spend: number
    overallCPL: number
    overallCPA: number
    overallROAS: number
    overallConversionRate: number
  }
}

const roasMetrics = ref<ROASMetrics | null>(null)
const roasLoading = ref(false)

async function fetchROASMetrics() {
  roasLoading.value = true
  try {
    const response = await api.get<{ success: boolean; data: ROASMetrics }>('/dashboard/marketing-roas', {
      params: {
        data_inicio: filters.value.dataInicio,
        data_fim: filters.value.dataFim,
      },
    })
    if (response.data.success) {
      roasMetrics.value = response.data.data
    }
  } catch (error) {
    console.error('Erro ao buscar métricas ROAS:', error)
  } finally {
    roasLoading.value = false
  }
}

// Funnel comparison data
interface FunnelComparison {
  current: {
    funnel: Array<{ stage: string; count: number; percentage: number }>
    categories: Record<string, { label: string; count: number; percentage: number }>
    totalLeads: number
    conversionRate: number
  }
  previous: {
    funnel: Array<{ stage: string; count: number; percentage: number }>
    categories: Record<string, { label: string; count: number; percentage: number }>
    totalLeads: number
    conversionRate: number
  }
  delta: {
    totalLeads: number
    totalLeadsPercent: number
    converted: number
    convertedPercent: number
    conversionRate: number
  }
  periods: {
    current: { start: string; end: string }
    previous: { start: string; end: string }
  }
}

const funnelComparison = ref<FunnelComparison | null>(null)
const funnelLoading = ref(false)

// CAC por Canal
const cacCanal = ref<CACCanal[]>([])
const cacLoading = ref(false)

// 8Ps Saúde e Alertas
interface Alerta8Ps {
  indicador: string
  nome: string
  descricao: string
  valorAtual: number
  valorFormatado: string
  metaFormatada: string
  status: 'critico' | 'atencao' | 'ok'
  severidade: number
  acao: string
  departamento: 'FIN' | 'MKT' | 'COM1' | 'COM2'
  unidade: string
}

interface Saude8Ps {
  saudeGeral: 'verde' | 'amarelo' | 'vermelho' | 'sem_dados'
  saudePorDepartamento: Record<string, 'verde' | 'amarelo' | 'vermelho'>
  alertasPrioritarios: Array<{
    indicador: string
    departamento: string
    status: string
    valorAtual: string
    meta: string
    acao: string
  }>
  totalAlertas: number
  periodo: { inicio: string; fim: string }
}

interface Indicadores8Ps {
  financeiro: {
    faturamento: number
    investimento: number
    lucro: number
    roas: number
    margemLucro: number
  }
  marketing: {
    publicoAlcancado: number
    cliques: number
    leads: number
    leadsQualificados: number
    tx1: number
    ctr: number
    cpl: number
    taxaQualificacao: number
  }
  comercial1: {
    leads: number
    agendamentos: number
    atendimentos: number
    vendas: number
    faturamentoNovos: number
    ticketMedio: number
    cac: number
    tx2: number
    taxaComparecimento: number
    taxaFechamento: number
  }
  comercial2: {
    clientesAtivos: number
    clientesRecorrentes: number
    taxaRecompra: number
    ltv: number
    relacaoLtvCac: number
    churn: number
    ticketMedioRecorrente: number
    faturamentoRecorrente: number
  }
  metas: Record<string, any>
}

const saude8Ps = ref<Saude8Ps | null>(null)
const alertas8Ps = ref<Alerta8Ps[]>([])
const indicadores8Ps = ref<Indicadores8Ps | null>(null)
const loading8Ps = ref(false)

async function fetch8PsData() {
  loading8Ps.value = true
  try {
    const [saudeRes, alertasRes, indicadoresRes] = await Promise.all([
      api.get<{ success: boolean; data: Saude8Ps }>('/dashboard/8ps/saude', {
        params: {
          data_inicio: filters.value.dataInicio,
          data_fim: filters.value.dataFim,
        },
      }),
      api.get<{ success: boolean; data: { alertas: Alerta8Ps[] } }>('/dashboard/8ps/alertas', {
        params: {
          data_inicio: filters.value.dataInicio,
          data_fim: filters.value.dataFim,
        },
      }),
      api.get<{ success: boolean; data: Indicadores8Ps }>('/dashboard/8ps', {
        params: {
          data_inicio: filters.value.dataInicio,
          data_fim: filters.value.dataFim,
        },
      }),
    ])

    if (saudeRes.data.success) {
      saude8Ps.value = saudeRes.data.data
    }
    if (alertasRes.data.success) {
      alertas8Ps.value = alertasRes.data.data.alertas || []
    }
    if (indicadoresRes.data.success) {
      indicadores8Ps.value = indicadoresRes.data.data
    }
  } catch (error) {
    console.error('Erro ao buscar dados 8Ps:', error)
  } finally {
    loading8Ps.value = false
  }
}

async function fetchCACCanal() {
  cacLoading.value = true
  try {
    const response = await api.get<{ success: boolean; data: CACCanal[] }>('/dashboard/cac-canal', {
      params: {
        data_inicio: filters.value.dataInicio,
        data_fim: filters.value.dataFim,
      },
    })
    if (response.data.success) {
      cacCanal.value = response.data.data
    }
  } catch (error) {
    console.error('Erro ao buscar CAC por canal:', error)
  } finally {
    cacLoading.value = false
  }
}

async function fetchFunnelComparison() {
  funnelLoading.value = true
  try {
    const response = await api.get<{ success: boolean; data: FunnelComparison }>('/dashboard/funnel-comparison', {
      params: {
        data_inicio: filters.value.dataInicio,
        data_fim: filters.value.dataFim,
      },
    })
    if (response.data.success) {
      funnelComparison.value = response.data.data
    }
  } catch (error) {
    console.error('Erro ao buscar comparativo de funil:', error)
  } finally {
    funnelLoading.value = false
  }
}

// Fetch data on mount and when filters change
onMounted(() => {
  fetchROASMetrics()
  fetchFunnelComparison()
  fetchCACCanal()
  fetch8PsData()
})

// Tab para análise UTM
const utmTab = ref<'source' | 'medium' | 'campaign'>('source')

// Colunas para tabelas UTM (traduzidas)
const utmSourceColumns = [
  { key: 'source', header: 'Fonte' },
  { key: 'total', header: 'Total' },
  { key: 'converted', header: 'Agendados' },
  { key: 'disqualified', header: 'Desqualificados' },
  { key: 'inProgress', header: 'Em Andamento' },
  { key: 'conversionRate', header: 'Taxa Agendamento' },
]

const utmMediumColumns = [
  { key: 'medium', header: 'Meio' },
  { key: 'total', header: 'Total' },
  { key: 'converted', header: 'Agendados' },
  { key: 'disqualified', header: 'Desqualificados' },
  { key: 'inProgress', header: 'Em Andamento' },
  { key: 'conversionRate', header: 'Taxa Agendamento' },
]

const utmCampaignColumns = [
  { key: 'campaign', header: 'Campanha' },
  { key: 'total', header: 'Total' },
  { key: 'converted', header: 'Agendados' },
  { key: 'disqualified', header: 'Desqualificados' },
  { key: 'inProgress', header: 'Em Andamento' },
  { key: 'conversionRate', header: 'Taxa Agendamento' },
]

// Dados UTM com taxa de conversão calculada
const utmSourceData = computed(() => {
  if (!marketingData.value?.byUtmSource) return []
  return marketingData.value.byUtmSource.map((item: any) => ({
    ...item,
    conversionRate: item.total > 0 ? ((item.converted / item.total) * 100).toFixed(1) + '%' : '0%',
  }))
})

const utmMediumData = computed(() => {
  if (!marketingData.value?.byUtmMedium) return []
  return marketingData.value.byUtmMedium.map((item: any) => ({
    ...item,
    conversionRate: item.total > 0 ? ((item.converted / item.total) * 100).toFixed(1) + '%' : '0%',
  }))
})

const utmCampaignData = computed(() => {
  if (!marketingData.value?.byUtmCampaign) return []
  return marketingData.value.byUtmCampaign.map((item: any) => ({
    ...item,
    conversionRate: item.total > 0 ? ((item.converted / item.total) * 100).toFixed(1) + '%' : '0%',
  }))
})

// Análise cruzada Origem x Campanha Bitrix
const origemCampanhaData = computed(() => {
  if (!marketingData.value?.rawLeads) return []

  const crossAnalysis: Record<string, {
    origem: string,
    campanha: string,
    total: number,
    emAtendimento: number,
    agendados: number,
    convertidos: number,
    desqualificados: number,
    taxaAgendamento: string,
    taxaConversao: string,
  }> = {}

  const leads = marketingData.value.rawLeads as any[]
  const origemMap = marketingData.value.origemLeadMap || {}
  const campanhaMap = marketingData.value.campanhaMap || {}
  // Mapa de leads que viraram negócios fechados
  const leadsConvertidos = new Set(marketingData.value.leadsComDealWon || [])

  leads.forEach((lead: any) => {
    // Origem do lead
    const origemId = lead.custom_fields?.UF_CRM_1692640693814 || lead.UF_CRM_1692640693814 || 'NAO_PREENCHIDO'
    const origemName = origemMap[origemId] || 'Não preenchido'
    // Campanha Bitrix (campo customizado UF_CRM_1729176132205)
    const campanhaId = lead.custom_fields?.UF_CRM_1729176132205 || lead.UF_CRM_1729176132205 || 'NAO_PREENCHIDO'
    const campanhaName = campanhaMap[campanhaId] || 'Sem Campanha'
    const key = `${origemId}-${campanhaId}`

    if (!crossAnalysis[key]) {
      crossAnalysis[key] = {
        origem: origemName,
        campanha: campanhaName,
        total: 0,
        emAtendimento: 0,
        agendados: 0,
        convertidos: 0,
        desqualificados: 0,
        taxaAgendamento: '0%',
        taxaConversao: '0%',
      }
    }

    crossAnalysis[key].total++

    // Verificar status
    const statusId = lead.status_id || lead.STATUS_ID
    const statusSemantica = lead.status_semantica
    const leadId = lead.bitrix_id || lead.id || lead.ID

    // Agendados = CONVERTED (virou agendamento)
    if (statusId === 'CONVERTED' || statusSemantica === 'success') {
      crossAnalysis[key].agendados++
    }
    // Desqualificados
    else if (statusId === 'JUNK' || statusSemantica === 'failure') {
      crossAnalysis[key].desqualificados++
    }
    // Em Atendimento (não é agendado nem desqualificado)
    else {
      crossAnalysis[key].emAtendimento++
    }

    // Convertidos = Deal WON (negócio fechado)
    if (leadsConvertidos.has(String(leadId))) {
      crossAnalysis[key].convertidos++
    }
  })

  // Calcular taxas
  Object.values(crossAnalysis).forEach((item) => {
    item.taxaAgendamento = item.total > 0
      ? ((item.agendados / item.total) * 100).toFixed(1) + '%'
      : '0%'
    item.taxaConversao = item.total > 0
      ? ((item.convertidos / item.total) * 100).toFixed(1) + '%'
      : '0%'
  })

  return Object.values(crossAnalysis).sort((a, b) => b.total - a.total)
})

const origemCampanhaColumns = [
  { key: 'origem', header: 'Origem' },
  { key: 'campanha', header: 'Campanha' },
  { key: 'total', header: 'Total' },
  { key: 'emAtendimento', header: 'Em Atendimento' },
  { key: 'agendados', header: 'Agendados' },
  { key: 'convertidos', header: 'Convertidos' },
  { key: 'desqualificados', header: 'Desqualificados' },
  { key: 'taxaAgendamento', header: 'Taxa Agendamento' },
  { key: 'taxaConversao', header: 'Taxa Conversão' },
]

// Dados para gráfico de horário de chegada
const horarioChartData = computed(() => {
  if (!marketingData.value?.horarioChegada) return []
  return marketingData.value.horarioChegada.map((item) => ({
    name: item.hora,
    value: item.leads,
  }))
})

// Dados para gráfico de distribuição por status
const statusDistributionData = computed(() => {
  if (!marketingData.value?.statusDistribution) return []
  return marketingData.value.statusDistribution.map((item: any) => ({
    name: item.status,
    value: item.count,
  }))
})

// Dados para gráfico de origem (bySource)
const bySourceChartData = computed(() => {
  if (!marketingData.value?.bySource) return []
  return marketingData.value.bySource.slice(0, 10).map((item) => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    value: item.total,
  }))
})

// Total de leads
const totalLeads = computed(() => {
  return marketingData.value?.origemLead?.totalLeads?.total || 0
})

// KPI Items para o KPIStrip
// Conforme spec: Primary KPIs são Total Leads, Taxa de Conversão e ROAS (ou CPL quando ROAS indisponível)
const kpiItems = computed<KPIItem[]>(() => {
  const metrics = marketingData.value?.metrics
  const conversionRateNum = typeof marketingData.value?.conversionRate === 'number'
    ? marketingData.value.conversionRate
    : parseFloat(marketingData.value?.conversionRate || '0')

  const roas = roasMetrics.value?.totals?.overallROAS || 0
  const cpl = roasMetrics.value?.totals?.overallCPL || 0
  const hasRoas = roas > 0

  return [
    // 3 Primary KPIs (aparecem primeiro)
    {
      id: 'total-leads',
      label: 'Total Leads',
      value: totalLeads.value,
      format: 'number',
      color: 'accent',
      icon: Users,
    },
    {
      id: 'conversion-rate',
      label: 'Taxa de Conversão',
      value: conversionRateNum,
      format: 'percentage',
      color: 'success',
      icon: Target,
    },
    // ROAS ou CPL como terceiro KPI primário
    hasRoas ? {
      id: 'roas',
      label: 'ROAS',
      value: roas,
      format: 'multiplier',
      color: roas >= 1 ? 'success' : 'danger',
      icon: TrendingUp,
      tooltip: 'Retorno sobre investimento em anúncios',
    } : {
      id: 'cpl',
      label: 'CPL',
      value: cpl,
      format: 'currency',
      color: 'info',
      icon: DollarSign,
      tooltip: 'Custo por lead',
    },
    // KPIs secundários
    {
      id: 'cpl-secondary',
      label: 'Custo por Lead',
      value: cpl,
      format: 'currency',
      color: 'default',
      icon: DollarSign,
    },
    {
      id: 'em-atendimento',
      label: 'Em Atendimento',
      value: marketingData.value?.leadsEmAtendimento?.total || 0,
      format: 'number',
      color: 'warning',
      icon: Clock,
    },
    {
      id: 'desqualificados',
      label: 'Desqualificados',
      value: marketingData.value?.leadsDesqualificados?.total || 0,
      format: 'number',
      color: 'danger',
      icon: UserX,
    },
    {
      id: 'avg-conversion-days',
      label: 'Tempo Médio Conversão',
      value: metrics?.avgConversionDays || 0,
      format: 'days',
      color: 'default',
    },
    {
      id: 'total-converted',
      label: 'Total Convertidos',
      value: metrics?.totalConverted || 0,
      format: 'number',
      color: 'success',
      icon: UserCheck,
    },
  ]
})

// Motivos de desqualificação (do campo UF_CRM_1695041103 do Bitrix)
const motivosDesqualificacao = computed(() => {
  if (!marketingData.value?.byMotivoDesqualificacao) return []
  const totalDesqualificados = marketingData.value.byMotivoDesqualificacao
    .reduce((sum: number, m: any) => sum + (m.count || 0), 0)

  return marketingData.value.byMotivoDesqualificacao
    .map((m: any) => ({
      ...m,
      percentual: totalDesqualificados > 0
        ? ((m.count / totalDesqualificados) * 100).toFixed(1) + '%'
        : '0%'
    }))
})

// Procedimentos com maior FATURAMENTO
const procedimentosMaisVendidos = computed(() => {
  if (!marketingData.value?.procedimentosMaisVendidos) return []
  return marketingData.value.procedimentosMaisVendidos.slice(0, 10)
})

// Procedimentos mais vendidos por QUANTIDADE
const procedimentosMaisQuantidade = computed(() => {
  if (!marketingData.value?.procedimentosMaisQuantidade) return []
  return marketingData.value.procedimentosMaisQuantidade.slice(0, 10)
})

const procedimentosFaturamentoColumns = [
  { key: 'nome', header: 'Procedimento' },
  { key: 'valorFormatado', header: 'Faturamento' },
  { key: 'quantidade', header: 'Qtd' },
]

const procedimentosQuantidadeColumns = [
  { key: 'nome', header: 'Procedimento' },
  { key: 'quantidade', header: 'Quantidade' },
  { key: 'valorFormatado', header: 'Valor Total' },
]

const procedimentosFaturamentoData = computed(() => {
  return procedimentosMaisVendidos.value.map((p: any) => ({
    ...p,
    valorFormatado: formatCurrency(p.valor || 0),
  }))
})

const procedimentosQuantidadeData = computed(() => {
  return procedimentosMaisQuantidade.value.map((p: any) => ({
    ...p,
    valorFormatado: formatCurrency(p.valor || 0),
  }))
})

// Profissionais com mais vendas
const profissionaisMaisVendas = computed(() => {
  if (!marketingData.value?.profissionaisMaisVendas) return []
  return marketingData.value.profissionaisMaisVendas.slice(0, 10)
})

const profissionaisColumns = [
  { key: 'nome', header: 'Profissional' },
  { key: 'vendas', header: 'Vendas' },
  { key: 'valorFormatado', header: 'Valor Total' },
]

const profissionaisData = computed(() => {
  return profissionaisMaisVendas.value.map((p: any) => ({
    ...p,
    valorFormatado: formatCurrency(p.valor || 0),
  }))
})

// Procedimentos por ESTABELECIMENTO
const procedimentosPorEstabelecimento = computed(() => {
  if (!marketingData.value?.procedimentosPorEstabelecimento) return {}
  return marketingData.value.procedimentosPorEstabelecimento
})

const estabelecimentosList = computed(() => {
  const data = procedimentosPorEstabelecimento.value
  if (!data || typeof data !== 'object') return []
  return Object.keys(data).sort()
})

const procedimentosEstabColumns = [
  { key: 'nome', header: 'Procedimento' },
  { key: 'valorFormatado', header: 'Valor' },
  { key: 'quantidade', header: 'Qtd' },
]

// Colunas e dados para tabela de performance por fonte
const sourcePerformanceColumns = [
  { key: 'source', header: 'Fonte' },
  { key: 'leads', header: 'Leads', emphasis: true },
  { key: 'converted', header: 'Convertidos' },
  { key: 'conversionRateFormatted', header: 'Taxa Conv.' },
  { key: 'cplFormatted', header: 'CPL' },
  { key: 'roasFormatted', header: 'ROAS' },
  { key: 'revenueFormatted', header: 'Receita' },
]

const sourcePerformanceData = computed(() => {
  if (!roasMetrics.value?.bySource) return []
  return roasMetrics.value.bySource.map(source => ({
    ...source,
    source: source.source || 'Direto',
    conversionRateFormatted: `${source.conversionRate.toFixed(1)}%`,
    cplFormatted: source.cpl > 0 ? formatCurrency(source.cpl) : '-',
    roasFormatted: source.roas > 0 ? `${source.roas.toFixed(2)}x` : '-',
    revenueFormatted: formatCurrency(source.revenue),
  }))
})

// Dados para gráfico de CAC por Canal
const cacChartData = computed(() => {
  return cacCanal.value.map((item) => ({
    name: item.canal,
    value: item.cac,
  }))
})

// Colunas da tabela de CAC
const cacColumns = [
  { key: 'canal', header: 'Canal' },
  { key: 'investimentoFormatado', header: 'Investimento' },
  { key: 'novosPacientes', header: 'Novos Pacientes' },
  { key: 'cacFormatado', header: 'CAC' },
]

const cacTableData = computed(() => {
  return cacCanal.value.map((item) => ({
    ...item,
    investimentoFormatado: formatCurrency(item.investimento),
    cacFormatado: formatCurrency(item.cac),
  }))
})

function handleFilterChange(newFilters: typeof filters.value) {
  store.setFilters(newFilters)
  store.refetch()
  // Também atualizar métricas ROAS, funil, CAC e 8Ps com os novos filtros
  fetchROASMetrics()
  fetchFunnelComparison()
  fetchCACCanal()
  fetch8PsData()
}

// Helpers para cores de status 8Ps
const getSaudeColor = (saude: string) => {
  switch (saude) {
    case 'verde': return 'text-green-500'
    case 'amarelo': return 'text-yellow-500'
    case 'vermelho': return 'text-red-500'
    default: return 'text-gray-400'
  }
}

const getSaudeBgColor = (saude: string) => {
  switch (saude) {
    case 'verde': return 'bg-green-500/20'
    case 'amarelo': return 'bg-yellow-500/20'
    case 'vermelho': return 'bg-red-500/20'
    default: return 'bg-gray-500/20'
  }
}

const getAlertaStatusColor = (status: string) => {
  switch (status) {
    case 'critico': return 'bg-red-500/20 text-red-500 border-red-500/30'
    case 'atencao': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
    default: return 'bg-green-500/20 text-green-500 border-green-500/30'
  }
}

const getDepartamentoLabel = (dept: string) => {
  switch (dept) {
    case 'FIN': return 'Financeiro'
    case 'MKT': return 'Marketing'
    case 'COM1': return 'Comercial 1'
    case 'COM2': return 'Comercial 2'
    default: return dept
  }
}
</script>

<template>
  <div class="space-y-6">
    <TabNavigation />

    <div class="flex items-center justify-between gap-4">
      <div class="flex-1">
        <FilterBar
          :filters="filters"
          :filter-options="filterOptions"
          @update:filters="handleFilterChange"
        />
      </div>
      <RevalidatingIndicator :is-revalidating="isRevalidating" />
    </div>

    <PageSkeleton v-if="isLoading && !marketingData" />

    <template v-else>
      <!-- Overlay de revalidação -->
      <div
        v-if="isRevalidating"
        class="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-accent)] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse"
      >
        <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm font-medium">Atualizando dados...</span>
      </div>
      <!-- KPIs com KPIStrip - 3 KPIs primários: Total Leads, Taxa de Conversão, ROAS/CPL -->
      <KPIStrip
        :items="kpiItems"
        :primary-count="3"
        layout="grid"
      />

      <!-- Painel de Saúde 8Ps e Alertas -->
      <div v-if="saude8Ps || alertas8Ps.length > 0" class="card p-6">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div :class="['p-2 rounded-lg', getSaudeBgColor(saude8Ps?.saudeGeral || 'sem_dados')]">
              <Activity :class="['w-5 h-5', getSaudeColor(saude8Ps?.saudeGeral || 'sem_dados')]" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
                Saúde do Marketing (8Ps)
              </h3>
              <p class="text-sm text-[var(--color-text-muted)]">
                Monitoramento automático baseado na metodologia 8Ps
              </p>
            </div>
          </div>

          <!-- Indicador de saúde geral -->
          <div v-if="saude8Ps" class="flex items-center gap-4">
            <div class="text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">Saúde Geral</p>
              <div :class="['flex items-center gap-2 px-3 py-1 rounded-full', getSaudeBgColor(saude8Ps.saudeGeral)]">
                <CheckCircle v-if="saude8Ps.saudeGeral === 'verde'" class="w-4 h-4 text-green-500" />
                <AlertTriangle v-else-if="saude8Ps.saudeGeral === 'amarelo'" class="w-4 h-4 text-yellow-500" />
                <XCircle v-else-if="saude8Ps.saudeGeral === 'vermelho'" class="w-4 h-4 text-red-500" />
                <span :class="['text-sm font-medium capitalize', getSaudeColor(saude8Ps.saudeGeral)]">
                  {{ saude8Ps.saudeGeral === 'verde' ? 'Saudável' : saude8Ps.saudeGeral === 'amarelo' ? 'Atenção' : saude8Ps.saudeGeral === 'vermelho' ? 'Crítico' : 'Sem dados' }}
                </span>
              </div>
            </div>
            <div v-if="saude8Ps.totalAlertas > 0" class="text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">Alertas</p>
              <span class="text-xl font-bold text-[var(--color-danger)]">{{ saude8Ps.totalAlertas }}</span>
            </div>
          </div>
        </div>

        <!-- Saúde por Departamento -->
        <div v-if="saude8Ps?.saudePorDepartamento" class="grid grid-cols-4 gap-4 mb-6">
          <div
            v-for="(saude, dept) in saude8Ps.saudePorDepartamento"
            :key="dept"
            :class="['p-4 rounded-lg border', getSaudeBgColor(saude), 'border-[var(--color-border-subtle)]']"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ getDepartamentoLabel(dept) }}</span>
              <CheckCircle v-if="saude === 'verde'" class="w-4 h-4 text-green-500" />
              <AlertTriangle v-else-if="saude === 'amarelo'" class="w-4 h-4 text-yellow-500" />
              <XCircle v-else class="w-4 h-4 text-red-500" />
            </div>
            <p :class="['text-xs capitalize', getSaudeColor(saude)]">
              {{ saude === 'verde' ? 'OK' : saude === 'amarelo' ? 'Atenção' : 'Crítico' }}
            </p>
          </div>
        </div>

        <!-- Alertas Prioritários -->
        <div v-if="alertas8Ps.length > 0">
          <div class="flex items-center gap-2 mb-4">
            <Zap class="w-4 h-4 text-[var(--color-warning)]" />
            <h4 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Alertas e Ações Recomendadas
            </h4>
          </div>

          <div class="space-y-3">
            <div
              v-for="(alerta, index) in alertas8Ps.slice(0, 5)"
              :key="index"
              :class="['p-4 rounded-lg border', getAlertaStatusColor(alerta.status)]"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <AlertTriangle v-if="alerta.status === 'critico'" class="w-4 h-4" />
                    <AlertTriangle v-else class="w-4 h-4" />
                    <span class="font-medium">{{ alerta.nome }}</span>
                    <span class="text-xs px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)]">
                      {{ getDepartamentoLabel(alerta.departamento) }}
                    </span>
                  </div>
                  <p class="text-xs text-[var(--color-text-muted)] mb-2">{{ alerta.descricao }}</p>
                  <div class="flex items-center gap-4 text-sm">
                    <span>
                      Atual: <strong>{{ alerta.valorFormatado }}</strong>
                    </span>
                    <span class="text-[var(--color-text-muted)]">|</span>
                    <span>
                      Meta: <strong>{{ alerta.metaFormatada }}</strong>
                    </span>
                  </div>
                </div>
                <div class="text-right">
                  <span :class="['px-2 py-1 rounded text-xs font-medium uppercase', alerta.status === 'critico' ? 'bg-red-500/30 text-red-400' : 'bg-yellow-500/30 text-yellow-400']">
                    {{ alerta.status === 'critico' ? 'Crítico' : 'Atenção' }}
                  </span>
                </div>
              </div>
              <div class="mt-3 p-2 bg-[var(--color-bg-tertiary)] rounded text-xs">
                <strong class="text-[var(--color-accent)]">Ação sugerida:</strong>
                <span class="text-[var(--color-text-secondary)]"> {{ alerta.acao }}</span>
              </div>
            </div>

            <div v-if="alertas8Ps.length > 5" class="text-center py-2">
              <span class="text-sm text-[var(--color-text-muted)]">
                + {{ alertas8Ps.length - 5 }} alertas adicionais
              </span>
            </div>
          </div>
        </div>

        <!-- Indicadores 8Ps Resumidos -->
        <div v-if="indicadores8Ps" class="mt-6 pt-6 border-t border-[var(--color-border-subtle)]">
          <h4 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">
            Indicadores Chave 8Ps
          </h4>
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <!-- TX1 -->
            <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">TX1</p>
              <p class="text-lg font-bold text-[var(--color-text-primary)]">
                {{ (indicadores8Ps.marketing?.tx1 || 0).toFixed(1) }}%
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">Clique→Lead</p>
            </div>
            <!-- TX2 -->
            <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">TX2</p>
              <p class="text-lg font-bold text-[var(--color-text-primary)]">
                {{ (indicadores8Ps.comercial1?.tx2 || 0).toFixed(1) }}%
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">Lead→Venda</p>
            </div>
            <!-- CPL -->
            <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">CPL</p>
              <p class="text-lg font-bold text-[var(--color-text-primary)]">
                {{ formatCurrency(indicadores8Ps.marketing?.cpl || 0) }}
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">Custo/Lead</p>
            </div>
            <!-- CAC -->
            <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">CAC</p>
              <p class="text-lg font-bold text-[var(--color-text-primary)]">
                {{ formatCurrency(indicadores8Ps.comercial1?.cac || 0) }}
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">Custo/Cliente</p>
            </div>
            <!-- ROAS -->
            <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">ROAS</p>
              <p :class="['text-lg font-bold', (indicadores8Ps.financeiro?.roas || 0) >= 1 ? 'text-green-500' : 'text-red-500']">
                {{ (indicadores8Ps.financeiro?.roas || 0).toFixed(2) }}x
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">Retorno</p>
            </div>
            <!-- LTV:CAC -->
            <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">LTV:CAC</p>
              <p :class="['text-lg font-bold', (indicadores8Ps.comercial2?.relacaoLtvCac || 0) >= 3 ? 'text-green-500' : 'text-yellow-500']">
                {{ (indicadores8Ps.comercial2?.relacaoLtvCac || 0).toFixed(1) }}:1
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">Valor/Custo</p>
            </div>
            <!-- Taxa Recompra -->
            <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">Recompra</p>
              <p class="text-lg font-bold text-[var(--color-text-primary)]">
                {{ (indicadores8Ps.comercial2?.taxaRecompra || 0).toFixed(1) }}%
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">Recorrência</p>
            </div>
            <!-- Ticket Médio -->
            <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">Ticket</p>
              <p class="text-lg font-bold text-[var(--color-text-primary)]">
                {{ formatCurrency(indicadores8Ps.comercial1?.ticketMedio || 0) }}
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">Médio</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Gráficos: Horário e Origem -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChartCard
          v-if="horarioChartData.length > 0"
          title="Leads por Horário de Chegada"
          :data="horarioChartData"
          color="#60a5fa"
          format-y-axis="number"
          :height="300"
        />

        <BarChartCard
          v-if="bySourceChartData.length > 0"
          title="Leads por Origem (Top 10)"
          :data="bySourceChartData"
          color="#8b5cf6"
          format-y-axis="number"
          :height="300"
        />
      </div>

      <!-- CAC por Canal de Aquisição -->
      <div v-if="cacCanal.length > 0" class="card p-6">
        <SectionHeader
          title="CAC por Canal de Aquisição"
          subtitle="Custo de Aquisição de Cliente por canal de marketing"
          :icon="Wallet"
        />

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <!-- Gráfico de barras -->
          <BarChartCard
            v-if="cacChartData.length > 0"
            title="CAC por Canal"
            :data="cacChartData"
            color="#f59e0b"
            format-y-axis="currency"
            :height="300"
          />

          <!-- Tabela de CAC -->
          <div class="bg-[var(--color-bg-tertiary)] rounded-xl p-4">
            <h4 class="text-sm font-semibold text-[var(--color-text-secondary)] mb-4 uppercase tracking-wide">
              Detalhamento CAC
            </h4>
            <DataTable
              :columns="cacColumns"
              :data="cacTableData"
              :max-rows="10"
              density="compact"
              empty-message="Nenhum dado de CAC disponível"
            />
          </div>
        </div>

        <!-- Cards de destaque -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div
            v-for="item in cacCanal.slice(0, 4)"
            :key="item.canal"
            class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-subtle)]"
          >
            <p class="text-xs text-[var(--color-text-muted)] mb-1">{{ item.canal }}</p>
            <p class="text-xl font-bold text-[var(--color-text-primary)]">
              {{ formatCurrency(item.cac) }}
            </p>
            <p class="text-xs text-[var(--color-text-secondary)] mt-1">
              {{ item.novosPacientes }} novos pacientes
            </p>
          </div>
        </div>
      </div>

      <!-- Performance por Fonte - Comparativo ROAS/CPL -->
      <div v-if="roasMetrics?.bySource?.length" class="card p-6">
        <SectionHeader
          title="Performance por Fonte de Tráfego"
          subtitle="Comparativo de ROAS, CPL e taxa de conversão por fonte"
        />

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <!-- ROAS por Fonte -->
          <div class="bg-[var(--color-bg-tertiary)] rounded-xl p-4">
            <h4 class="text-sm font-semibold text-[var(--color-text-secondary)] mb-4 uppercase tracking-wide">
              ROAS por Fonte
            </h4>
            <div class="space-y-3">
              <div
                v-for="source in roasMetrics.bySource.filter(s => s.roas > 0).slice(0, 5)"
                :key="'roas-' + source.source"
                class="flex items-center justify-between"
              >
                <span class="text-sm text-[var(--color-text-secondary)] truncate flex-1 mr-2">
                  {{ source.source || 'Direto' }}
                </span>
                <span :class="[
                  'text-sm font-semibold tabular-nums',
                  source.roas >= 1 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                ]">
                  {{ source.roas.toFixed(2) }}x
                </span>
              </div>
              <div v-if="!roasMetrics.bySource.some(s => s.roas > 0)" class="text-sm text-[var(--color-text-muted)]">
                Sem dados de ROAS
              </div>
            </div>
          </div>

          <!-- CPL por Fonte -->
          <div class="bg-[var(--color-bg-tertiary)] rounded-xl p-4">
            <h4 class="text-sm font-semibold text-[var(--color-text-secondary)] mb-4 uppercase tracking-wide">
              CPL por Fonte
            </h4>
            <div class="space-y-3">
              <div
                v-for="source in roasMetrics.bySource.filter(s => s.cpl > 0).sort((a, b) => a.cpl - b.cpl).slice(0, 5)"
                :key="'cpl-' + source.source"
                class="flex items-center justify-between"
              >
                <span class="text-sm text-[var(--color-text-secondary)] truncate flex-1 mr-2">
                  {{ source.source || 'Direto' }}
                </span>
                <span class="text-sm font-semibold tabular-nums text-[var(--color-info)]">
                  {{ formatCurrency(source.cpl) }}
                </span>
              </div>
              <div v-if="!roasMetrics.bySource.some(s => s.cpl > 0)" class="text-sm text-[var(--color-text-muted)]">
                Sem dados de CPL
              </div>
            </div>
          </div>

          <!-- Conversão por Fonte -->
          <div class="bg-[var(--color-bg-tertiary)] rounded-xl p-4">
            <h4 class="text-sm font-semibold text-[var(--color-text-secondary)] mb-4 uppercase tracking-wide">
              Taxa de Conversão
            </h4>
            <div class="space-y-3">
              <div
                v-for="source in roasMetrics.bySource.filter(s => s.conversionRate > 0).sort((a, b) => b.conversionRate - a.conversionRate).slice(0, 5)"
                :key="'conv-' + source.source"
                class="flex items-center justify-between"
              >
                <span class="text-sm text-[var(--color-text-secondary)] truncate flex-1 mr-2">
                  {{ source.source || 'Direto' }}
                </span>
                <span class="text-sm font-semibold tabular-nums text-[var(--color-success)]">
                  {{ source.conversionRate.toFixed(1) }}%
                </span>
              </div>
              <div v-if="!roasMetrics.bySource.some(s => s.conversionRate > 0)" class="text-sm text-[var(--color-text-muted)]">
                Sem dados de conversão
              </div>
            </div>
          </div>
        </div>

        <!-- Tabela detalhada de performance por fonte -->
        <div class="mt-6">
          <DataTable
            :columns="sourcePerformanceColumns"
            :data="sourcePerformanceData"
            :max-rows="10"
            density="compact"
            empty-message="Nenhum dado de performance disponível"
          />
        </div>
      </div>

      <!-- Análise por Fonte de Tráfego (UTM) -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Análise por Fonte de Tráfego
        </h3>
        <p class="text-sm text-[var(--color-text-muted)] mb-4">
          Rastreamento de leads por parâmetros UTM do marketing digital
        </p>

        <!-- Tabs -->
        <div class="flex gap-2 mb-4">
          <button
            @click="utmTab = 'source'"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              utmTab === 'source'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
            ]"
          >
            Fonte
          </button>
          <button
            @click="utmTab = 'medium'"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              utmTab === 'medium'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
            ]"
          >
            Meio
          </button>
          <button
            @click="utmTab = 'campaign'"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              utmTab === 'campaign'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
            ]"
          >
            Campanha
          </button>
        </div>

        <!-- Tabelas UTM -->
        <DataTable
          v-if="utmTab === 'source'"
          :columns="utmSourceColumns"
          :data="utmSourceData"
          :max-rows="10"
          empty-message="Nenhum dado de fonte disponível"
        />
        <DataTable
          v-else-if="utmTab === 'medium'"
          :columns="utmMediumColumns"
          :data="utmMediumData"
          :max-rows="10"
          empty-message="Nenhum dado de meio disponível"
        />
        <DataTable
          v-else
          :columns="utmCampaignColumns"
          :data="utmCampaignData"
          :max-rows="10"
          empty-message="Nenhum dado de campanha disponível"
        />
      </div>

      <!-- Análise Cruzada: Origem x Campanha -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Análise Cruzada: Origem x Campanha
        </h3>
        <p class="text-sm text-[var(--color-text-muted)] mb-4">
          Performance por origem do lead e campanha Bitrix. Conversão = Negócio Fechado (WON).
        </p>
        <DataTable
          :columns="origemCampanhaColumns"
          :data="origemCampanhaData"
          :max-rows="20"
          empty-message="Nenhum dado disponível"
        />
      </div>

      <!-- Distribuição de Status e Funil -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PieChartCard
          v-if="statusDistributionData.length > 0"
          title="Distribuição por Status"
          :data="statusDistributionData"
          :height="300"
        />

        <!-- Funil de Conversão com Comparativo -->
        <div v-if="funnelComparison" class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
                Funil de Conversão
              </h3>
              <p class="text-sm text-[var(--color-text-muted)]">
                Comparativo: período atual vs período anterior
              </p>
            </div>
            <div class="flex items-center gap-4 text-xs">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded bg-[var(--color-accent)]"></div>
                <span class="text-[var(--color-text-muted)]">Atual</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded bg-[var(--color-bg-active)] border border-[var(--color-border-secondary)]"></div>
                <span class="text-[var(--color-text-muted)]">Anterior</span>
              </div>
            </div>
          </div>

          <!-- Resumo de deltas -->
          <div class="grid grid-cols-3 gap-4 mb-6 p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
            <div class="text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">Total Leads</p>
              <p class="text-lg font-bold text-[var(--color-text-primary)]">
                {{ funnelComparison.current.totalLeads.toLocaleString('pt-BR') }}
              </p>
              <span :class="[
                'text-xs font-medium',
                funnelComparison.delta.totalLeadsPercent >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
              ]">
                {{ funnelComparison.delta.totalLeadsPercent >= 0 ? '+' : '' }}{{ funnelComparison.delta.totalLeadsPercent.toFixed(1) }}%
              </span>
            </div>
            <div class="text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">Convertidos</p>
              <p class="text-lg font-bold text-[var(--color-text-primary)]">
                {{ funnelComparison.current.categories.converted?.count?.toLocaleString('pt-BR') || 0 }}
              </p>
              <span :class="[
                'text-xs font-medium',
                funnelComparison.delta.convertedPercent >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
              ]">
                {{ funnelComparison.delta.convertedPercent >= 0 ? '+' : '' }}{{ funnelComparison.delta.convertedPercent.toFixed(1) }}%
              </span>
            </div>
            <div class="text-center">
              <p class="text-xs text-[var(--color-text-muted)] mb-1">Taxa Conversão</p>
              <p class="text-lg font-bold text-[var(--color-text-primary)]">
                {{ funnelComparison.current.conversionRate.toFixed(1) }}%
              </p>
              <span :class="[
                'text-xs font-medium',
                funnelComparison.delta.conversionRate >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
              ]">
                {{ funnelComparison.delta.conversionRate >= 0 ? '+' : '' }}{{ funnelComparison.delta.conversionRate.toFixed(1) }}pp
              </span>
            </div>
          </div>

          <!-- Barras comparativas -->
          <div class="space-y-4">
            <div
              v-for="(stage, index) in funnelComparison.current.funnel"
              :key="index"
              class="relative"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ stage.stage }}</span>
                <div class="flex items-center gap-3 text-xs">
                  <span class="text-[var(--color-text-primary)] font-medium">
                    {{ stage.count.toLocaleString('pt-BR') }}
                  </span>
                  <span class="text-[var(--color-text-muted)]">
                    vs {{ funnelComparison.previous.funnel[index]?.count?.toLocaleString('pt-BR') || 0 }}
                  </span>
                </div>
              </div>
              <!-- Barra atual -->
              <div class="w-full bg-[var(--color-bg-tertiary)] rounded-full h-4 mb-1 relative overflow-hidden">
                <!-- Barra do período anterior (fundo) -->
                <div
                  class="absolute top-0 left-0 h-4 rounded-full bg-[var(--color-bg-active)] border border-[var(--color-border-secondary)]"
                  :style="{ width: `${funnelComparison.previous.funnel[index]?.percentage || 0}%` }"
                ></div>
                <!-- Barra do período atual (foreground) -->
                <div
                  class="absolute top-0 left-0 h-4 rounded-full transition-all duration-500"
                  :style="{
                    width: `${stage.percentage}%`,
                    backgroundColor: `hsl(${220 - index * 30}, 70%, 50%)`
                  }"
                ></div>
              </div>
              <div class="flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>{{ stage.percentage.toFixed(1) }}%</span>
                <span>anterior: {{ (funnelComparison.previous.funnel[index]?.percentage || 0).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Fallback: Funil simples se não tiver comparação -->
        <div v-else-if="marketingData?.conversionFunnel?.length" class="card p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Funil de Conversão
          </h3>
          <div class="space-y-3">
            <div
              v-for="(stage, index) in marketingData.conversionFunnel"
              :key="index"
              class="relative"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ stage.stage }}</span>
                <span class="text-sm text-[var(--color-text-muted)]">
                  {{ stage.count.toLocaleString('pt-BR') }} ({{ stage.percentage.toFixed(1) }}%)
                </span>
              </div>
              <div class="w-full bg-[var(--color-bg-tertiary)] rounded-full h-3">
                <div
                  class="h-3 rounded-full transition-all duration-500"
                  :style="{
                    width: `${stage.percentage}%`,
                    backgroundColor: `hsl(${220 - index * 30}, 70%, 50%)`
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Procedimentos - Dois Rankings -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Procedimentos por FATURAMENTO -->
        <div v-if="procedimentosMaisVendidos.length > 0" class="card p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp class="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
                Maior Faturamento
              </h3>
              <p class="text-sm text-[var(--color-text-muted)]">
                Top 10 procedimentos que mais trouxeram faturamento
              </p>
            </div>
          </div>
          <DataTable
            :columns="procedimentosFaturamentoColumns"
            :data="procedimentosFaturamentoData"
            :max-rows="10"
            empty-message="Nenhum procedimento encontrado"
          />
        </div>

        <!-- Procedimentos por QUANTIDADE -->
        <div v-if="procedimentosMaisQuantidade.length > 0" class="card p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp class="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
                Mais Vendidos
              </h3>
              <p class="text-sm text-[var(--color-text-muted)]">
                Top 10 procedimentos com maior quantidade de vendas
              </p>
            </div>
          </div>
          <DataTable
            :columns="procedimentosQuantidadeColumns"
            :data="procedimentosQuantidadeData"
            :max-rows="10"
            empty-message="Nenhum procedimento encontrado"
          />
        </div>

        <!-- Profissionais Mais Vendas -->
        <div v-if="profissionaisMaisVendas.length > 0" class="card p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-blue-500/20 rounded-lg">
              <UserCheck class="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
                Profissionais com Mais Vendas
              </h3>
              <p class="text-sm text-[var(--color-text-muted)]">
                Top 10 profissionais por faturamento
              </p>
            </div>
          </div>
          <DataTable
            :columns="profissionaisColumns"
            :data="profissionaisData"
            :max-rows="10"
            empty-message="Nenhum profissional encontrado"
          />
        </div>
      </div>

      <!-- Procedimentos por Estabelecimento -->
      <div v-if="estabelecimentosList.length > 0" class="card p-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="p-2 bg-indigo-500/20 rounded-lg">
            <TrendingUp class="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
              Procedimentos por Estabelecimento
            </h3>
            <p class="text-sm text-[var(--color-text-muted)]">
              Rankings de procedimentos por unidade de negócio
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <div
            v-for="estabName in estabelecimentosList"
            :key="estabName"
            class="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border-subtle)]"
          >
            <h4 class="text-base font-semibold text-[var(--color-text-primary)] mb-3 pb-2 border-b border-[var(--color-border-subtle)]">
              {{ estabName }}
            </h4>

            <!-- Top por Faturamento -->
            <div class="mb-4">
              <p class="text-xs text-green-500 font-medium mb-2 flex items-center gap-1">
                <TrendingUp class="w-3 h-3" />
                Maior Faturamento
              </p>
              <div class="space-y-1">
                <div
                  v-for="(proc, idx) in (procedimentosPorEstabelecimento[estabName]?.byValor || []).slice(0, 5)"
                  :key="'valor-' + idx"
                  class="flex items-center justify-between text-xs"
                >
                  <span class="text-[var(--color-text-secondary)] truncate flex-1 mr-2">{{ proc.nome }}</span>
                  <span class="text-[var(--color-text-primary)] font-medium whitespace-nowrap">{{ proc.valorFormatado }}</span>
                </div>
                <div v-if="!procedimentosPorEstabelecimento[estabName]?.byValor?.length" class="text-xs text-[var(--color-text-muted)]">
                  Sem dados
                </div>
              </div>
            </div>

            <!-- Top por Quantidade -->
            <div>
              <p class="text-xs text-purple-500 font-medium mb-2 flex items-center gap-1">
                <TrendingUp class="w-3 h-3" />
                Mais Vendidos
              </p>
              <div class="space-y-1">
                <div
                  v-for="(proc, idx) in (procedimentosPorEstabelecimento[estabName]?.byQuantidade || []).slice(0, 5)"
                  :key="'qtd-' + idx"
                  class="flex items-center justify-between text-xs"
                >
                  <span class="text-[var(--color-text-secondary)] truncate flex-1 mr-2">{{ proc.nome }}</span>
                  <span class="text-[var(--color-text-primary)] font-medium whitespace-nowrap">{{ proc.quantidade }} un</span>
                </div>
                <div v-if="!procedimentosPorEstabelecimento[estabName]?.byQuantidade?.length" class="text-xs text-[var(--color-text-muted)]">
                  Sem dados
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Motivos de Desqualificação -->
      <div v-if="motivosDesqualificacao.length > 0" class="card p-6">
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Motivos de Desqualificação
        </h3>
        <p class="text-sm text-[var(--color-text-muted)] mb-4">
          Distribuição dos leads desqualificados por motivo
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="motivo in motivosDesqualificacao"
            :key="motivo.id"
            class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-subtle)]"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ motivo.name }}</span>
              <span class="text-xs text-red-500 font-medium">{{ motivo.percentual }}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex-1 bg-[var(--color-bg-secondary)] rounded-full h-2">
                <div
                  class="h-2 rounded-full bg-red-500 transition-all duration-500"
                  :style="{ width: motivo.percentual }"
                ></div>
              </div>
              <span class="text-sm font-bold text-[var(--color-text-primary)]">
                {{ motivo.count.toLocaleString('pt-BR') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabela de Status Detalhada -->
      <div v-if="marketingData?.statusDistribution?.length" class="card p-6">
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Detalhamento por Status
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--color-border-primary)]">
                <th class="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">Status</th>
                <th class="text-right py-3 px-4 text-[var(--color-text-muted)] font-medium">Quantidade</th>
                <th class="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in marketingData.statusDistribution"
                :key="item.status"
                class="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-tertiary)]"
              >
                <td class="py-3 px-4 text-[var(--color-text-primary)]">{{ item.status }}</td>
                <td class="py-3 px-4 text-right text-[var(--color-text-primary)] font-medium">
                  {{ (item.count || 0).toLocaleString('pt-BR') }}
                </td>
                <td class="py-3 px-4">
                  <span
                    :class="[
                      'px-2 py-1 rounded text-xs font-medium',
                      item.semantica === 'success' ? 'bg-green-500/20 text-green-500' :
                      item.semantica === 'failure' ? 'bg-red-500/20 text-red-500' :
                      item.semantica === 'process' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-gray-500/20 text-gray-500'
                    ]"
                  >
                    {{ item.semantica === 'success' ? 'Convertido' : item.semantica === 'failure' ? 'Perdido' : 'Em Processo' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
