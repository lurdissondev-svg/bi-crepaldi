<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import BarChartCard from '@/components/charts/BarChartCard.vue'
import KPICard from '@/components/charts/KPICard.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { ShoppingCart, DollarSign, Target, TrendingUp } from 'lucide-vue-next'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.comercial)
const isRevalidating = computed(() => revalidatingStates.value.comercial)

const comercialData = computed(() => data.value.comercial)

const vendasPorOrigem = computed(() => {
  if (!comercialData.value?.vendasPorOrigem) return []
  return comercialData.value.vendasPorOrigem.map((item: any) => ({
    name: item.origem,
    value: item.valor,
  }))
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

    <PageSkeleton v-if="isLoading && !comercialData" />

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Vendas"
          :value="comercialData?.totalVendas || 0"
          format="currency"
          :icon="DollarSign"
          color="green"
        />
        <KPICard
          title="Quantidade de Vendas"
          :value="comercialData?.quantidadeVendas || 0"
          format="number"
          :icon="ShoppingCart"
          color="blue"
        />
        <KPICard
          title="Meta Atingida"
          :value="comercialData?.metaAtingida || 0"
          format="percentage"
          :icon="Target"
          color="purple"
        />
        <KPICard
          title="Crescimento"
          :value="comercialData?.crescimento || 0"
          format="percentage"
          :icon="TrendingUp"
          color="yellow"
        />
      </div>

      <BarChartCard
        title="Vendas por Origem"
        :data="vendasPorOrigem"
        color="#8b5cf6"
        format-y-axis="currency"
        :height="350"
      />
    </template>
  </div>
</template>
