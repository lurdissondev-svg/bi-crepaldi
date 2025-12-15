<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import GaugeChart from '@/components/charts/GaugeChart.vue'
import KPICard from '@/components/charts/KPICard.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { Target, DollarSign, TrendingUp, Award } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.metas)
const isRevalidating = computed(() => revalidatingStates.value.metas)

const metasData = computed(() => data.value.metas)

const percentualAtingido = computed(() => {
  if (!metasData.value?.meta || !metasData.value?.realizado) return 0
  return (metasData.value.realizado / metasData.value.meta) * 100
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

    <PageSkeleton v-if="isLoading && !metasData" />

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Meta do Período"
          :value="metasData?.meta || 0"
          format="currency"
          :icon="Target"
          color="blue"
        />
        <KPICard
          title="Realizado"
          :value="metasData?.realizado || 0"
          format="currency"
          :icon="DollarSign"
          color="green"
        />
        <KPICard
          title="Faltando"
          :value="Math.max(0, (metasData?.meta || 0) - (metasData?.realizado || 0))"
          format="currency"
          :icon="TrendingUp"
          color="yellow"
        />
        <KPICard
          title="% Atingido"
          :value="percentualAtingido"
          format="percentage"
          :icon="Award"
          color="purple"
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GaugeChart
          title="Progresso da Meta"
          :value="metasData?.realizado || 0"
          :max="metasData?.meta || 100"
          color="#22c55e"
          label="Meta"
          :height="250"
        />

        <div class="card p-6">
          <h3 class="card-header">Detalhamento</h3>
          <div class="space-y-4 mt-4">
            <div class="flex items-center justify-between p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <span class="text-[var(--color-text-muted)]">Meta</span>
              <span class="text-xl font-bold text-[var(--color-text-primary)]">
                {{ formatCurrency(metasData?.meta || 0) }}
              </span>
            </div>
            <div class="flex items-center justify-between p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <span class="text-[var(--color-text-muted)]">Realizado</span>
              <span class="text-xl font-bold text-green-500">
                {{ formatCurrency(metasData?.realizado || 0) }}
              </span>
            </div>
            <div class="flex items-center justify-between p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <span class="text-[var(--color-text-muted)]">Diferença</span>
              <span :class="['text-xl font-bold', percentualAtingido >= 100 ? 'text-green-500' : 'text-yellow-500']">
                {{ formatCurrency(Math.abs((metasData?.meta || 0) - (metasData?.realizado || 0))) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
