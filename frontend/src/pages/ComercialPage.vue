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
import { DollarSign, Target, TrendingUp, Users } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.comercial)
const isRevalidating = computed(() => revalidatingStates.value.comercial)

const comercialData = computed(() => data.value.comercial)

// Colunas para tabela de conversão por origem
// Backend retorna: origem, leads, emAtendimento, convertidos, desqualificados, valor, valorFormatado, taxaConversao
const conversaoColumns = [
  { key: 'origem', header: 'Origem' },
  { key: 'leads', header: 'Leads' },
  { key: 'emAtendimento', header: 'Em Atendimento' },
  { key: 'convertidos', header: 'Convertidos' },
  { key: 'valorFormatado', header: 'Valor Estimado' },
  { key: 'taxaConversao', header: 'Taxa Conversão' },
]

// Colunas para tabela de profissionais
const profissionaisColumns = [
  { key: 'nome', header: 'Profissional' },
  { key: 'vendas', header: 'Vendas' },
  { key: 'valor', header: 'Valor', render: (val: number) => formatCurrency(val) },
]

// Colunas para procedimentos
const procedimentosColumns = [
  { key: 'nome', header: 'Procedimento' },
  { key: 'quantidade', header: 'Qtd' },
  { key: 'valor', header: 'Valor', render: (val: number) => formatCurrency(val) },
]

// Dados para gráfico de procedimentos paciente novo
const procedimentosNovosChart = computed(() => {
  if (!comercialData.value?.procedimentosPacienteNovo?.labels) return []
  return comercialData.value.procedimentosPacienteNovo.labels.map((label, index) => ({
    name: label.length > 15 ? label.substring(0, 15) + '...' : label,
    value: comercialData.value?.procedimentosPacienteNovo?.faturamento?.[index] || 0,
  }))
})

// Calcula percentual de meta atingida
function calcMetaPercentual(atual: number, meta: number): number {
  if (!meta || meta === 0) return 0
  return (atual / meta) * 100
}

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
      <!-- Cards de Metas -->
      <div v-if="comercialData?.metas" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="card p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="p-2 bg-blue-500/20 rounded-lg">
                <Target class="w-5 h-5 text-blue-500" />
              </div>
              <span class="text-sm font-medium text-[var(--color-text-primary)]">Meta Spa</span>
            </div>
            <span class="text-xs text-[var(--color-text-muted)]">
              {{ calcMetaPercentual(comercialData.metas.spa?.atual || 0, comercialData.metas.spa?.meta || 0).toFixed(1) }}%
            </span>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-[var(--color-text-muted)]">Atual</span>
              <span class="font-medium text-[var(--color-text-primary)]">{{ formatCurrency(comercialData.metas.spa?.atual || 0) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-[var(--color-text-muted)]">Meta</span>
              <span class="text-[var(--color-text-secondary)]">{{ formatCurrency(comercialData.metas.spa?.meta || 0) }}</span>
            </div>
            <div class="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2 mt-2">
              <div
                class="bg-blue-500 h-2 rounded-full transition-all duration-500"
                :style="{ width: `${Math.min(100, calcMetaPercentual(comercialData.metas.spa?.atual || 0, comercialData.metas.spa?.meta || 0))}%` }"
              ></div>
            </div>
          </div>
        </div>

        <div class="card p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="p-2 bg-purple-500/20 rounded-lg">
                <Target class="w-5 h-5 text-purple-500" />
              </div>
              <span class="text-sm font-medium text-[var(--color-text-primary)]">Meta Convênios</span>
            </div>
            <span class="text-xs text-[var(--color-text-muted)]">
              {{ calcMetaPercentual(comercialData.metas.convenios?.atual || 0, comercialData.metas.convenios?.meta || 0).toFixed(1) }}%
            </span>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-[var(--color-text-muted)]">Atual</span>
              <span class="font-medium text-[var(--color-text-primary)]">{{ formatCurrency(comercialData.metas.convenios?.atual || 0) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-[var(--color-text-muted)]">Meta</span>
              <span class="text-[var(--color-text-secondary)]">{{ formatCurrency(comercialData.metas.convenios?.meta || 0) }}</span>
            </div>
            <div class="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2 mt-2">
              <div
                class="bg-purple-500 h-2 rounded-full transition-all duration-500"
                :style="{ width: `${Math.min(100, calcMetaPercentual(comercialData.metas.convenios?.atual || 0, comercialData.metas.convenios?.meta || 0))}%` }"
              ></div>
            </div>
          </div>
        </div>

        <div class="card p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="p-2 bg-pink-500/20 rounded-lg">
                <Target class="w-5 h-5 text-pink-500" />
              </div>
              <span class="text-sm font-medium text-[var(--color-text-primary)]">Meta Bela Laser</span>
            </div>
            <span class="text-xs text-[var(--color-text-muted)]">
              {{ calcMetaPercentual(comercialData.metas.belaLaser?.atual || 0, comercialData.metas.belaLaser?.meta || 0).toFixed(1) }}%
            </span>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-[var(--color-text-muted)]">Atual</span>
              <span class="font-medium text-[var(--color-text-primary)]">{{ formatCurrency(comercialData.metas.belaLaser?.atual || 0) }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-[var(--color-text-muted)]">Meta</span>
              <span class="text-[var(--color-text-secondary)]">{{ formatCurrency(comercialData.metas.belaLaser?.meta || 0) }}</span>
            </div>
            <div class="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2 mt-2">
              <div
                class="bg-pink-500 h-2 rounded-full transition-all duration-500"
                :style="{ width: `${Math.min(100, calcMetaPercentual(comercialData.metas.belaLaser?.atual || 0, comercialData.metas.belaLaser?.meta || 0))}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabela de Conversão por Origem -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Conversão de Vendas por Origem
        </h3>
        <DataTable
          :columns="conversaoColumns"
          :data="comercialData?.conversaoVendaPorOrigem || []"
          :max-rows="10"
          empty-message="Nenhum dado de conversão disponível"
        />
      </div>

      <!-- Gráfico e Profissionais -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChartCard
          v-if="procedimentosNovosChart.length > 0"
          title="Procedimentos - Paciente Novo"
          :data="procedimentosNovosChart"
          color="#22c55e"
          format-y-axis="currency"
          :height="300"
        />

        <div class="card p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Vendas por Profissional
          </h3>
          <DataTable
            :columns="profissionaisColumns"
            :data="comercialData?.profissionais || []"
            :max-rows="8"
            empty-message="Nenhum dado de profissional disponível"
          />
        </div>
      </div>

      <!-- Procedimentos por Centro de Custo -->
      <div v-if="comercialData?.procedimentosPorCentro" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="card p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Clínica Spa
          </h3>
          <DataTable
            :columns="procedimentosColumns"
            :data="comercialData.procedimentosPorCentro.clinicaSpa || []"
            :max-rows="8"
            empty-message="Nenhum procedimento"
          />
        </div>

        <div class="card p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Bela Laser
          </h3>
          <DataTable
            :columns="procedimentosColumns"
            :data="comercialData.procedimentosPorCentro.belaLaser || []"
            :max-rows="8"
            empty-message="Nenhum procedimento"
          />
        </div>

        <div class="card p-6">
          <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Convênios
          </h3>
          <DataTable
            :columns="procedimentosColumns"
            :data="comercialData.procedimentosPorCentro.convenios || []"
            :max-rows="8"
            empty-message="Nenhum procedimento"
          />
        </div>
      </div>
    </template>
  </div>
</template>
