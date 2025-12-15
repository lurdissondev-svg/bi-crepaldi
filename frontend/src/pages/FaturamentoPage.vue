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
import { DollarSign, TrendingUp, Calendar, CreditCard } from 'lucide-vue-next'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.faturamento)
const isRevalidating = computed(() => revalidatingStates.value.faturamento)

const faturamentoData = computed(() => data.value.faturamento)

const chartData = computed(() => {
  if (!faturamentoData.value?.historico) return []
  return faturamentoData.value.historico.map((item: any) => ({
    name: item.mes,
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

    <PageSkeleton v-if="isLoading && !faturamentoData" />

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Faturamento Total"
          :value="faturamentoData?.total || 0"
          format="currency"
          :icon="DollarSign"
          color="green"
        />
        <KPICard
          title="Ticket Médio"
          :value="faturamentoData?.ticketMedio || 0"
          format="currency"
          :icon="CreditCard"
          color="blue"
        />
        <KPICard
          title="Total Vendas"
          :value="faturamentoData?.totalVendas || 0"
          format="number"
          :icon="TrendingUp"
          color="purple"
        />
        <KPICard
          title="Dias no Período"
          :value="faturamentoData?.diasPeriodo || 0"
          format="number"
          :icon="Calendar"
          color="yellow"
        />
      </div>

      <BarChartCard
        title="Histórico de Faturamento"
        :data="chartData"
        color="#22c55e"
        format-y-axis="currency"
        :height="350"
      />
    </template>
  </div>
</template>
