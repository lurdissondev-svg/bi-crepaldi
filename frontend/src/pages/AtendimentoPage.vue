<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import DataTable from '@/components/dashboard/DataTable.vue'
import BarChartCard from '@/components/charts/BarChartCard.vue'
import KPIStrip, { type KPIItem } from '@/components/charts/KPIStrip.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { DollarSign, Users, TrendingUp, Award, AlertTriangle, Phone, MessageCircle, Target, ClipboardCheck } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'
import api from '@/services/api'
import type { NoShowData, ConversaoCanal, ConversaoPropostasData } from '@/types'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.atendimento)
const isRevalidating = computed(() => revalidatingStates.value.atendimento)

const atendimentoData = computed(() => data.value.atendimento)

// Novos indicadores
const noShowData = ref<NoShowData | null>(null)
const conversaoCanal = ref<ConversaoCanal[]>([])
const conversaoPropostas = ref<ConversaoPropostasData | null>(null)
const loadingNovos = ref(false)

async function loadNovosIndicadores() {
  loadingNovos.value = true
  try {
    const [noShow, canal, propostas] = await Promise.all([
      api.getNoShow(filters.value),
      api.getConversaoCanal(filters.value),
      api.getConversaoPropostas(filters.value),
    ])
    noShowData.value = noShow
    conversaoCanal.value = canal
    conversaoPropostas.value = propostas
  } catch (error) {
    console.error('Erro ao carregar novos indicadores:', error)
  } finally {
    loadingNovos.value = false
  }
}

onMounted(() => {
  loadNovosIndicadores()
})

watch(filters, () => {
  loadNovosIndicadores()
}, { deep: true })

// Colunas para tabela de desempenho
const desempenhoColumns = [
  { key: 'responsavel', header: 'Responsável' },
  { key: 'totalOrcamentos', header: 'Orçamentos' },
  { key: 'valorTotalOrcado', header: 'Valor Orçado', render: (val: number) => formatCurrency(val) },
  { key: 'aprovados', header: 'Aprovados' },
  { key: 'valorTotalAprovado', header: 'Valor Aprovado', render: (val: number) => formatCurrency(val) },
  { key: 'percentual', header: '% Aprovação', render: (val: number) => `${val.toFixed(1)}%` },
]

// Colunas para tabela de ticket médio
const ticketColumns = [
  { key: 'procedimento', header: 'Procedimento' },
  { key: 'vendas', header: 'Vendas' },
  { key: 'ticketMedio', header: 'Ticket Médio', render: (val: number) => formatCurrency(val) },
  { key: 'faturamentoTotal', header: 'Faturamento', render: (val: number) => formatCurrency(val) },
]

// Dados para gráfico Pareto
const paretoChartData = computed(() => {
  if (!atendimentoData.value?.pareto8020) return []
  return atendimentoData.value.pareto8020.slice(0, 10).map((item) => ({
    name: item.procedimento.length > 20 ? item.procedimento.substring(0, 20) + '...' : item.procedimento,
    value: item.faturamentoTotal,
  }))
})

// Dados para gráfico de conversão por canal
const conversaoCanalChart = computed(() => {
  return conversaoCanal.value.map((item) => ({
    name: item.canal,
    value: item.taxaConversao,
  }))
})

// Totais calculados
const totalOrcamentos = computed(() => {
  if (!atendimentoData.value?.desempenho) return 0
  return atendimentoData.value.desempenho.reduce((acc, item) => acc + item.totalOrcamentos, 0)
})

const totalAprovados = computed(() => {
  if (!atendimentoData.value?.desempenho) return 0
  return atendimentoData.value.desempenho.reduce((acc, item) => acc + item.aprovados, 0)
})

const taxaAprovacaoGeral = computed(() => {
  if (totalOrcamentos.value === 0) return 0
  return (totalAprovados.value / totalOrcamentos.value) * 100
})

// KPI Items para o KPIStrip - Agora incluindo No-Show
const kpiItems = computed<KPIItem[]>(() => {
  const items: KPIItem[] = [
    {
      id: 'total-faturamento',
      label: 'Total Faturamento',
      value: atendimentoData.value?.totalFaturamento || 0,
      format: 'currency',
      color: 'success',
      icon: DollarSign,
    },
    {
      id: 'taxa-aprovacao',
      label: 'Taxa de Aprovação',
      value: taxaAprovacaoGeral.value,
      format: 'percentage',
      color: 'accent',
      icon: Award,
    },
  ]

  // Adicionar No-Show se disponível
  if (noShowData.value) {
    items.push({
      id: 'taxa-no-show',
      label: 'Taxa de No-Show',
      value: noShowData.value.taxaNoShow,
      format: 'percentage',
      color: noShowData.value.taxaNoShow > 15 ? 'danger' : 'warning',
      icon: AlertTriangle,
      subtitle: `${noShowData.value.faltas} faltas de ${noShowData.value.totalAgendados} agendados`,
    })
  }

  // Adicionar Conversão de Propostas se disponível
  if (conversaoPropostas.value) {
    items.push({
      id: 'conversao-propostas',
      label: 'Conversão de Propostas',
      value: conversaoPropostas.value.taxaConversao,
      format: 'percentage',
      color: conversaoPropostas.value.taxaConversao >= 70 ? 'success' : 'warning',
      icon: ClipboardCheck,
      subtitle: `${conversaoPropostas.value.propostasFechadas}/${conversaoPropostas.value.totalPropostas} fechadas`,
    })
  }

  items.push(
    {
      id: 'total-orcamentos',
      label: 'Total Orçamentos',
      value: totalOrcamentos.value,
      format: 'number',
      color: 'default',
      icon: Users,
    },
    {
      id: 'aprovados',
      label: 'Aprovados',
      value: totalAprovados.value,
      format: 'number',
      color: 'success',
      icon: TrendingUp,
    }
  )

  return items
})

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

    <PageSkeleton v-if="isLoading && !atendimentoData" />

    <template v-else>
      <!-- KPIs com KPIStrip -->
      <KPIStrip
        :items="kpiItems"
        :primary-count="3"
        layout="grid"
      />

      <!-- Taxa de No-Show Detalhada -->
      <div v-if="noShowData" class="card p-6">
        <SectionHeader
          title="Taxa de No-Show (Faltas)"
          subtitle="Consultas agendadas vs comparecimentos"
          :icon="AlertTriangle"
        />

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <!-- Gauge visual -->
          <div class="flex flex-col items-center justify-center p-6 bg-[var(--color-bg-tertiary)] rounded-xl">
            <div class="relative w-32 h-32">
              <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke="var(--color-bg-secondary)"
                  stroke-width="10"
                />
                <circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  :stroke="noShowData.taxaNoShow > 15 ? 'var(--color-danger)' : noShowData.taxaNoShow > 10 ? 'var(--color-warning)' : 'var(--color-success)'"
                  stroke-width="10"
                  stroke-linecap="round"
                  :stroke-dasharray="`${noShowData.taxaNoShow * 2.83} 283`"
                />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-2xl font-bold text-[var(--color-text-primary)]">
                  {{ noShowData.taxaNoShow.toFixed(1) }}%
                </span>
                <span class="text-xs text-[var(--color-text-muted)]">No-Show</span>
              </div>
            </div>
          </div>

          <!-- Estatísticas -->
          <div class="space-y-4">
            <div class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <p class="text-sm text-[var(--color-text-muted)]">Total Agendados</p>
              <p class="text-2xl font-bold text-[var(--color-text-primary)]">{{ noShowData.totalAgendados }}</p>
            </div>
            <div class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <p class="text-sm text-[var(--color-text-muted)]">Compareceram</p>
              <p class="text-2xl font-bold text-[var(--color-success)]">{{ noShowData.compareceram }}</p>
            </div>
            <div class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <p class="text-sm text-[var(--color-text-muted)]">Faltaram</p>
              <p class="text-2xl font-bold text-[var(--color-danger)]">{{ noShowData.faltas }}</p>
            </div>
          </div>

          <!-- Impacto -->
          <div class="space-y-4">
            <h4 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Impacto Estimado
            </h4>
            <div class="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p class="text-sm text-[var(--color-text-muted)]">Faturamento Perdido</p>
              <p class="text-xl font-bold text-red-500">{{ formatCurrency(noShowData.impacto.faturamentoPerdido) }}</p>
            </div>
            <div class="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p class="text-sm text-[var(--color-text-muted)]">Agenda Falsa</p>
              <p class="text-xl font-bold text-yellow-500">{{ noShowData.impacto.agendaFalsa }} horários</p>
            </div>
            <div class="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <p class="text-sm text-[var(--color-text-muted)]">Médico Ocioso (estimado)</p>
              <p class="text-xl font-bold text-orange-500">{{ noShowData.impacto.medicoOcioso }}h</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Conversão por Canal (WhatsApp vs Ligação) -->
      <div v-if="conversaoCanal.length > 0" class="card p-6">
        <SectionHeader
          title="Conversão por Canal de Atendimento"
          subtitle="Taxa de agendamento por canal de contato"
          :icon="MessageCircle"
        />

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <!-- Gráfico de barras -->
          <BarChartCard
            v-if="conversaoCanalChart.length > 0"
            title="Taxa de Conversão por Canal"
            :data="conversaoCanalChart"
            color="#22c55e"
            format-y-axis="percentage"
            :height="300"
          />

          <!-- Cards de destaque -->
          <div class="grid grid-cols-1 gap-4">
            <div
              v-for="canal in conversaoCanal"
              :key="canal.canal"
              class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-subtle)] flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <div :class="[
                  'p-2 rounded-lg',
                  canal.canal === 'WhatsApp' ? 'bg-green-500/20' :
                  canal.canal === 'Ligação' ? 'bg-blue-500/20' :
                  canal.canal === 'Instagram' ? 'bg-pink-500/20' : 'bg-gray-500/20'
                ]">
                  <component
                    :is="canal.canal === 'WhatsApp' ? MessageCircle :
                         canal.canal === 'Ligação' ? Phone : Target"
                    :class="[
                      'w-5 h-5',
                      canal.canal === 'WhatsApp' ? 'text-green-500' :
                      canal.canal === 'Ligação' ? 'text-blue-500' :
                      canal.canal === 'Instagram' ? 'text-pink-500' : 'text-gray-500'
                    ]"
                  />
                </div>
                <div>
                  <p class="text-sm font-medium text-[var(--color-text-primary)]">{{ canal.canal }}</p>
                  <p class="text-xs text-[var(--color-text-muted)]">{{ canal.totalMensagens }} contatos</p>
                </div>
              </div>
              <div class="text-right">
                <p :class="[
                  'text-xl font-bold',
                  canal.taxaConversao >= 50 ? 'text-[var(--color-success)]' :
                  canal.taxaConversao >= 30 ? 'text-[var(--color-warning)]' : 'text-[var(--color-danger)]'
                ]">
                  {{ canal.taxaConversao.toFixed(1) }}%
                </p>
                <p class="text-xs text-[var(--color-text-muted)]">{{ canal.agendamentos }} agendamentos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Conversão de Propostas (Pós-consulta) -->
      <div v-if="conversaoPropostas" class="card p-6">
        <SectionHeader
          title="Conversão de Propostas (Pós-consulta)"
          subtitle="Quanto do prescrito/orçado foi efetivamente vendido"
          :icon="ClipboardCheck"
        />

        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
          <div class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
            <p class="text-sm text-[var(--color-text-muted)]">Total Propostas</p>
            <p class="text-2xl font-bold text-[var(--color-text-primary)]">{{ conversaoPropostas.totalPropostas }}</p>
          </div>
          <div class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
            <p class="text-sm text-[var(--color-text-muted)]">Fechadas</p>
            <p class="text-2xl font-bold text-[var(--color-success)]">{{ conversaoPropostas.propostasFechadas }}</p>
          </div>
          <div class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
            <p class="text-sm text-[var(--color-text-muted)]">Taxa Conversão</p>
            <p :class="[
              'text-2xl font-bold',
              conversaoPropostas.taxaConversao >= 70 ? 'text-[var(--color-success)]' :
              conversaoPropostas.taxaConversao >= 50 ? 'text-[var(--color-warning)]' : 'text-[var(--color-danger)]'
            ]">
              {{ conversaoPropostas.taxaConversao.toFixed(1) }}%
            </p>
          </div>
          <div class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg text-center">
            <p class="text-sm text-[var(--color-text-muted)]">Conv. por Valor</p>
            <p :class="[
              'text-2xl font-bold',
              conversaoPropostas.taxaConversaoValor >= 70 ? 'text-[var(--color-success)]' :
              conversaoPropostas.taxaConversaoValor >= 50 ? 'text-[var(--color-warning)]' : 'text-[var(--color-danger)]'
            ]">
              {{ conversaoPropostas.taxaConversaoValor.toFixed(1) }}%
            </p>
          </div>
        </div>

        <!-- Valores -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div class="p-6 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p class="text-sm text-[var(--color-text-muted)]">Valor Prescrito/Orçado</p>
            <p class="text-2xl font-bold text-blue-500">{{ formatCurrency(conversaoPropostas.valorPrescrito) }}</p>
          </div>
          <div class="p-6 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p class="text-sm text-[var(--color-text-muted)]">Valor Vendido</p>
            <p class="text-2xl font-bold text-green-500">{{ formatCurrency(conversaoPropostas.valorVendido) }}</p>
          </div>
        </div>
      </div>

      <!-- Tabela de Desempenho -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Desempenho por Responsável
        </h3>
        <DataTable
          :columns="desempenhoColumns"
          :data="atendimentoData?.desempenho || []"
          :max-rows="10"
          empty-message="Nenhum dado de desempenho disponível"
        />
      </div>

      <!-- Ticket Médio e Pareto -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Ticket Médio por Procedimento
          </h3>
          <DataTable
            :columns="ticketColumns"
            :data="atendimentoData?.ticketMedioPorProcedimento || []"
            :max-rows="10"
            empty-message="Nenhum dado de ticket médio disponível"
          />
        </div>

        <BarChartCard
          v-if="paretoChartData.length > 0"
          title="Top 10 Procedimentos (Pareto 80/20)"
          :data="paretoChartData"
          color="#8b5cf6"
          format-y-axis="currency"
          :height="350"
          horizontal
        />
      </div>

      <!-- Tabela Pareto Detalhada -->
      <div v-if="atendimentoData?.pareto8020?.length" class="card p-6">
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Análise Pareto 80/20 - Procedimentos
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--color-border-primary)]">
                <th class="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">Procedimento</th>
                <th class="text-right py-3 px-4 text-[var(--color-text-muted)] font-medium">Ticket Médio</th>
                <th class="text-right py-3 px-4 text-[var(--color-text-muted)] font-medium">Faturamento</th>
                <th class="text-right py-3 px-4 text-[var(--color-text-muted)] font-medium">% Acumulado</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, index) in atendimentoData.pareto8020.slice(0, 15)"
                :key="index"
                class="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-tertiary)]"
              >
                <td class="py-3 px-4 text-[var(--color-text-primary)]">{{ item.procedimento }}</td>
                <td class="py-3 px-4 text-right text-[var(--color-text-secondary)]">{{ formatCurrency(item.ticketMedio) }}</td>
                <td class="py-3 px-4 text-right text-[var(--color-text-primary)] font-medium">{{ formatCurrency(item.faturamentoTotal) }}</td>
                <td class="py-3 px-4 text-right">
                  <span
                    :class="[
                      'px-2 py-1 rounded text-xs font-medium',
                      parseFloat(item.percentualAcumulado) <= 80
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-yellow-500/20 text-yellow-500'
                    ]"
                  >
                    {{ item.percentualAcumulado }}
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
