<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import BarChartCard from '@/components/charts/BarChartCard.vue'
import LineChartCard from '@/components/charts/LineChartCard.vue'
import KPICard from '@/components/charts/KPICard.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { DollarSign, TrendingUp, Calendar, ShoppingBag } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.faturamento)
const isRevalidating = computed(() => revalidatingStates.value.faturamento)

const faturamentoData = computed(() => data.value.faturamento)

// Dados para o gráfico de faturamento diário
const faturamentoDiarioChart = computed(() => {
  if (!faturamentoData.value?.faturamentoDiario) return []
  return faturamentoData.value.faturamentoDiario.map((item) => ({
    name: item.data,
    value: item.valor,
  }))
})

// Dados para o gráfico de histórico mensal
const historicoMensalChart = computed(() => {
  if (!faturamentoData.value?.faturamentoMensalHistorico) return []
  return faturamentoData.value.faturamentoMensalHistorico.map((item) => ({
    name: item.mes,
    value: item.valor,
  }))
})

// Variação mensal formatada
const variacaoMensal = computed(() => {
  const variacao = faturamentoData.value?.mensal?.variacao
  if (!variacao) return null
  const num = parseFloat(variacao)
  return isNaN(num) ? null : num
})

// Variação anual formatada
const variacaoAnual = computed(() => {
  const variacao = faturamentoData.value?.anual?.variacao
  if (!variacao) return null
  const num = parseFloat(variacao)
  return isNaN(num) ? null : num
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

    <PageSkeleton v-if="isLoading && !faturamentoData" />

    <template v-else>
      <!-- KPIs Principais -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-green-500/20 rounded-lg">
              <DollarSign class="w-5 h-5 text-green-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Faturamento Mensal</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ faturamentoData?.mensal?.valorFormatado || formatCurrency(faturamentoData?.mensal?.valor || 0) }}
          </p>
          <div v-if="variacaoMensal !== null" class="flex items-center gap-1 mt-2">
            <TrendingUp v-if="variacaoMensal >= 0" class="w-4 h-4 text-green-500" />
            <TrendingUp v-else class="w-4 h-4 text-red-500 rotate-180" />
            <span :class="['text-sm', variacaoMensal >= 0 ? 'text-green-500' : 'text-red-500']">
              {{ variacaoMensal >= 0 ? '+' : '' }}{{ variacaoMensal.toFixed(1) }}% vs mês anterior
            </span>
          </div>
          <p v-if="faturamentoData?.mensal?.pacientesNovosPercentual" class="text-xs text-[var(--color-text-muted)] mt-1">
            {{ faturamentoData.mensal.pacientesNovosPercentual.toFixed(1) }}% de pacientes novos
          </p>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-blue-500/20 rounded-lg">
              <Calendar class="w-5 h-5 text-blue-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Faturamento Anual</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ faturamentoData?.anual?.valorFormatado || formatCurrency(faturamentoData?.anual?.valor || 0) }}
          </p>
          <div v-if="variacaoAnual !== null" class="flex items-center gap-1 mt-2">
            <TrendingUp v-if="variacaoAnual >= 0" class="w-4 h-4 text-green-500" />
            <TrendingUp v-else class="w-4 h-4 text-red-500 rotate-180" />
            <span :class="['text-sm', variacaoAnual >= 0 ? 'text-green-500' : 'text-red-500']">
              {{ variacaoAnual >= 0 ? '+' : '' }}{{ variacaoAnual.toFixed(1) }}% vs ano anterior
            </span>
          </div>
          <p v-if="faturamentoData?.anual?.pacientesNovosPercentual" class="text-xs text-[var(--color-text-muted)] mt-1">
            {{ faturamentoData.anual.pacientesNovosPercentual.toFixed(1) }}% de pacientes novos
          </p>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp class="w-5 h-5 text-purple-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Crescimento Mensal</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ (faturamentoData?.crescimentoMensal?.percentual || 0).toFixed(1) }}%
          </p>
          <p class="text-xs text-[var(--color-text-muted)] mt-2">
            vs mesmo mês ano anterior
          </p>
        </div>

        <div v-if="faturamentoData?.vendasHoje" class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-yellow-500/20 rounded-lg">
              <ShoppingBag class="w-5 h-5 text-yellow-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Vendas Hoje</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ faturamentoData.vendasHoje.valorFormatado || formatCurrency(faturamentoData.vendasHoje.valor) }}
          </p>
          <p class="text-xs text-[var(--color-text-muted)] mt-2">
            {{ faturamentoData.vendasHoje.quantidade }} venda(s)
          </p>
        </div>

        <div v-else class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-yellow-500/20 rounded-lg">
              <TrendingUp class="w-5 h-5 text-yellow-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Crescimento Anual</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ (faturamentoData?.crescimentoAnual?.percentual || 0).toFixed(1) }}%
          </p>
          <p class="text-xs text-[var(--color-text-muted)] mt-2">
            vs ano anterior
          </p>
        </div>
      </div>

      <!-- Gráficos -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineChartCard
          v-if="faturamentoDiarioChart.length > 0"
          title="Faturamento Diário"
          :data="faturamentoDiarioChart"
          color="#22c55e"
          format-y-axis="currency"
          :height="300"
        />

        <BarChartCard
          v-if="historicoMensalChart.length > 0"
          title="Histórico Mensal"
          :data="historicoMensalChart"
          color="#60a5fa"
          format-y-axis="currency"
          :height="300"
        />
      </div>

      <!-- Comparativos -->
      <div v-if="faturamentoData?.crescimentoMensal || faturamentoData?.crescimentoAnual" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div v-if="faturamentoData?.crescimentoMensal" class="card p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Comparativo Mensal</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
              <span class="text-[var(--color-text-muted)]">Mês Atual</span>
              <span class="text-lg font-bold text-[var(--color-text-primary)]">
                {{ formatCurrency(faturamentoData.crescimentoMensal.mesAtual) }}
              </span>
            </div>
            <div class="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
              <span class="text-[var(--color-text-muted)]">Mesmo Mês (Ano Anterior)</span>
              <span class="text-lg font-bold text-[var(--color-text-secondary)]">
                {{ formatCurrency(faturamentoData.crescimentoMensal.mesPassadoAnoAnterior) }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="faturamentoData?.crescimentoAnual" class="card p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Comparativo Anual</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
              <span class="text-[var(--color-text-muted)]">Ano Atual</span>
              <span class="text-lg font-bold text-[var(--color-text-primary)]">
                {{ formatCurrency(faturamentoData.crescimentoAnual.anoAtual) }}
              </span>
            </div>
            <div class="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
              <span class="text-[var(--color-text-muted)]">Ano Anterior</span>
              <span class="text-lg font-bold text-[var(--color-text-secondary)]">
                {{ formatCurrency(faturamentoData.crescimentoAnual.anoAnterior) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
