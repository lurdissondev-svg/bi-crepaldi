<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import DataTable from '@/components/dashboard/DataTable.vue'
import BarChartCard from '@/components/charts/BarChartCard.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { DollarSign, Users, TrendingUp, Award } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.atendimento)
const isRevalidating = computed(() => revalidatingStates.value.atendimento)

const atendimentoData = computed(() => data.value.atendimento)

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
      <!-- KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-green-500/20 rounded-lg">
              <DollarSign class="w-5 h-5 text-green-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Total Faturamento</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ atendimentoData?.totalFaturamentoFormatado || formatCurrency(atendimentoData?.totalFaturamento || 0) }}
          </p>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-blue-500/20 rounded-lg">
              <Users class="w-5 h-5 text-blue-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Total Orçamentos</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ totalOrcamentos.toLocaleString('pt-BR') }}
          </p>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp class="w-5 h-5 text-purple-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Aprovados</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ totalAprovados.toLocaleString('pt-BR') }}
          </p>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-yellow-500/20 rounded-lg">
              <Award class="w-5 h-5 text-yellow-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Taxa de Aprovação</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ taxaAprovacaoGeral.toFixed(1) }}%
          </p>
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
