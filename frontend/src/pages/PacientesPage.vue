<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import KPICard from '@/components/charts/KPICard.vue'
import DataTable from '@/components/dashboard/DataTable.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { Users, UserPlus, UserMinus, DollarSign } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.pacientes)
const isRevalidating = computed(() => revalidatingStates.value.pacientes)

const pacientesData = computed(() => data.value.pacientes)

const columns = [
  { key: 'nome', header: 'Nome' },
  { key: 'ultimaVisita', header: 'Última Visita' },
  { key: 'totalGasto', header: 'Total Gasto', render: (val: number) => formatCurrency(val) },
  { key: 'visitas', header: 'Visitas' },
]

const tableData = computed(() => {
  if (!pacientesData.value?.lista) return []
  return pacientesData.value.lista
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

    <PageSkeleton v-if="isLoading && !pacientesData" />

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Pacientes"
          :value="pacientesData?.total || 0"
          format="number"
          :icon="Users"
          color="blue"
        />
        <KPICard
          title="Pacientes Novos"
          :value="pacientesData?.novos || 0"
          format="number"
          :icon="UserPlus"
          color="green"
        />
        <KPICard
          title="Pacientes Inativos"
          :value="pacientesData?.inativos || 0"
          format="number"
          :icon="UserMinus"
          color="red"
        />
        <KPICard
          title="LTV Médio"
          :value="pacientesData?.ltvMedio || 0"
          format="currency"
          :icon="DollarSign"
          color="purple"
        />
      </div>

      <DataTable
        :columns="columns"
        :data="tableData"
        :max-rows="10"
        empty-message="Nenhum paciente encontrado"
      />
    </template>
  </div>
</template>
