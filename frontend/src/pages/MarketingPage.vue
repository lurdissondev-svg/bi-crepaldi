<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import BarChartCard from '@/components/charts/BarChartCard.vue'
import PieChartCard from '@/components/charts/PieChartCard.vue'
import KPICard from '@/components/charts/KPICard.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { Users, Target, TrendingUp, DollarSign } from 'lucide-vue-next'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.marketing)
const isRevalidating = computed(() => revalidatingStates.value.marketing)

const marketingData = computed(() => data.value.marketing)

const origemData = computed(() => {
  if (!marketingData.value?.porOrigem) return []
  return marketingData.value.porOrigem.map((item: any) => ({
    name: item.origem,
    value: item.quantidade,
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

    <PageSkeleton v-if="isLoading && !marketingData" />

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Leads"
          :value="marketingData?.totalLeads || 0"
          format="number"
          :icon="Users"
          color="blue"
        />
        <KPICard
          title="Taxa de Conversão"
          :value="marketingData?.taxaConversao || 0"
          format="percentage"
          :icon="Target"
          color="green"
        />
        <KPICard
          title="Custo por Lead"
          :value="marketingData?.custoLead || 0"
          format="currency"
          :icon="DollarSign"
          color="yellow"
        />
        <KPICard
          title="ROI"
          :value="marketingData?.roi || 0"
          format="percentage"
          :icon="TrendingUp"
          color="purple"
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChartCard
          title="Leads por Origem"
          :data="origemData"
          color="#60a5fa"
          format-y-axis="number"
          :height="300"
        />
        <PieChartCard
          title="Distribuição por Origem"
          :data="origemData"
          :height="300"
        />
      </div>
    </template>
  </div>
</template>
