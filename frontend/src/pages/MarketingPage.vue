<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import BarChartCard from '@/components/charts/BarChartCard.vue'
import PieChartCard from '@/components/charts/PieChartCard.vue'
import DataTable from '@/components/dashboard/DataTable.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { Users, UserCheck, UserX, Target, Clock, TrendingUp } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.marketing)
const isRevalidating = computed(() => revalidatingStates.value.marketing)

const marketingData = computed(() => data.value.marketing)

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

function handleFilterChange(newFilters: typeof filters.value) {
  store.setFilters(newFilters)
  store.refetch()
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
      <!-- KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-blue-500/20 rounded-lg">
              <Users class="w-5 h-5 text-blue-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Total Leads</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ totalLeads.toLocaleString('pt-BR') }}
          </p>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-yellow-500/20 rounded-lg">
              <Clock class="w-5 h-5 text-yellow-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Em Atendimento</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ (marketingData?.leadsEmAtendimento?.total || 0).toLocaleString('pt-BR') }}
          </p>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-red-500/20 rounded-lg">
              <UserX class="w-5 h-5 text-red-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Desqualificados</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ (marketingData?.leadsDesqualificados?.total || 0).toLocaleString('pt-BR') }}
          </p>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-green-500/20 rounded-lg">
              <Target class="w-5 h-5 text-green-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Taxa de Conversão</span>
          </div>
          <p class="text-2xl font-bold text-green-500">
            {{ typeof marketingData?.conversionRate === 'number'
              ? marketingData.conversionRate.toFixed(1) + '%'
              : (marketingData?.conversionRate || '0%') }}
          </p>
        </div>
      </div>

      <!-- Métricas extras -->
      <div v-if="marketingData?.metrics" class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="card p-4">
          <p class="text-sm text-[var(--color-text-muted)]">Tempo Médio Conversão</p>
          <p class="text-xl font-bold text-[var(--color-text-primary)] mt-1">
            {{ marketingData.metrics.avgConversionDays?.toFixed(1) || 0 }} dias
          </p>
        </div>
        <div class="card p-4">
          <p class="text-sm text-[var(--color-text-muted)]">Tempo Médio em Progresso</p>
          <p class="text-xl font-bold text-[var(--color-text-primary)] mt-1">
            {{ marketingData.metrics.avgInProgressDays?.toFixed(1) || 0 }} dias
          </p>
        </div>
        <div class="card p-4">
          <p class="text-sm text-[var(--color-text-muted)]">Total Convertidos</p>
          <p class="text-xl font-bold text-green-500 mt-1">
            {{ (marketingData.metrics.totalConverted || 0).toLocaleString('pt-BR') }}
          </p>
        </div>
        <div class="card p-4">
          <p class="text-sm text-[var(--color-text-muted)]">Total Desqualificados</p>
          <p class="text-xl font-bold text-red-500 mt-1">
            {{ (marketingData.metrics.totalDisqualified || 0).toLocaleString('pt-BR') }}
          </p>
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

        <div v-if="marketingData?.conversionFunnel?.length" class="card p-6">
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
              <p v-if="stage.conversionFromPrevious !== undefined" class="text-xs text-[var(--color-text-muted)] mt-1">
                Conversão do estágio anterior: {{ stage.conversionFromPrevious.toFixed(1) }}%
              </p>
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
