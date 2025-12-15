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
import { UserCheck, Clock, Star, Users } from 'lucide-vue-next'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.atendimento)
const isRevalidating = computed(() => revalidatingStates.value.atendimento)

const atendimentoData = computed(() => data.value.atendimento)

const atendimentoPorProfissional = computed(() => {
  if (!atendimentoData.value?.porProfissional) return []
  return atendimentoData.value.porProfissional.map((item: any) => ({
    name: item.nome,
    value: item.atendimentos,
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

    <PageSkeleton v-if="isLoading && !atendimentoData" />

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Atendimentos"
          :value="atendimentoData?.totalAtendimentos || 0"
          format="number"
          :icon="UserCheck"
          color="blue"
        />
        <KPICard
          title="Tempo Médio"
          :value="atendimentoData?.tempoMedio || 0"
          format="number"
          :icon="Clock"
          color="yellow"
          subtitle="minutos"
        />
        <KPICard
          title="Satisfação"
          :value="atendimentoData?.satisfacao || 0"
          format="percentage"
          :icon="Star"
          color="green"
        />
        <KPICard
          title="Profissionais Ativos"
          :value="atendimentoData?.profissionaisAtivos || 0"
          format="number"
          :icon="Users"
          color="purple"
        />
      </div>

      <BarChartCard
        title="Atendimentos por Profissional"
        :data="atendimentoPorProfissional"
        color="#f59e0b"
        format-y-axis="number"
        :height="350"
        horizontal
      />
    </template>
  </div>
</template>
