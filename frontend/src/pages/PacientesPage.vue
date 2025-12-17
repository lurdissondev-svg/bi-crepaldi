<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import DataTable from '@/components/dashboard/DataTable.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { Users, DollarSign, Clock, AlertTriangle, TrendingUp, Target, Award } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'
import api from '@/services/api'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.pacientes)
const isRevalidating = computed(() => revalidatingStates.value.pacientes)

const pacientesData = computed(() => data.value.pacientes)

// Métricas avançadas: RFM e LTV
const rfmSegments = ref<any[]>([])
const topLtvCustomers = ref<any[]>([])
const loadingMetrics = ref(false)

onMounted(async () => {
  loadingMetrics.value = true
  try {
    const [rfmData, ltvData] = await Promise.all([
      api.getRFMSegmentation(),
      api.getTopCustomersByLTV(10)
    ])
    rfmSegments.value = rfmData || []
    topLtvCustomers.value = ltvData || []
  } catch (err) {
    console.error('Erro ao carregar métricas:', err)
  } finally {
    loadingMetrics.value = false
  }
})

// Cores para segmentos RFM
const segmentColors: Record<string, string> = {
  'Champions': 'bg-emerald-500',
  'Loyal': 'bg-blue-500',
  'Potential': 'bg-yellow-500',
  'At Risk': 'bg-red-500',
  'Low Value': 'bg-gray-500'
}

// Colunas para tabela de faturamento por paciente
const faturamentoColumns = [
  { key: 'cliente', header: 'Cliente' },
  { key: 'quantidadeVendas', header: 'Vendas' },
  { key: 'investimento', header: 'Investimento', render: (val: number) => formatCurrency(val) },
]

// Colunas para tabelas de potenciais
const potenciaisColumns = [
  { key: 'cliente', header: 'Cliente' },
  { key: 'diasSemVir', header: 'Dias sem vir' },
  { key: 'investimento', header: 'Investimento', render: (val: number) => formatCurrency(val) },
]

// Totais calculados
const totalInvestimento = computed(() => {
  if (!pacientesData.value?.faturamentoPaciente) return 0
  return pacientesData.value.faturamentoPaciente.reduce((acc, p) => acc + (p.investimento || 0), 0)
})

const totalVendas = computed(() => {
  if (!pacientesData.value?.faturamentoPaciente) return 0
  return pacientesData.value.faturamentoPaciente.reduce((acc, p) => acc + (p.quantidadeVendas || 0), 0)
})

const potenciaisMais4 = computed(() => pacientesData.value?.potenciaisMais4Meses?.length || 0)
const potenciaisMenos4 = computed(() => pacientesData.value?.potenciaisMenos4Meses?.length || 0)

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
      <!-- KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-blue-500/20 rounded-lg">
              <Users class="w-5 h-5 text-blue-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Total Clientes</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ (pacientesData?.totalClientes || 0).toLocaleString('pt-BR') }}
          </p>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-green-500/20 rounded-lg">
              <DollarSign class="w-5 h-5 text-green-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Total Investido</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ formatCurrency(totalInvestimento) }}
          </p>
          <p class="text-xs text-[var(--color-text-muted)] mt-1">
            {{ totalVendas.toLocaleString('pt-BR') }} vendas
          </p>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-yellow-500/20 rounded-lg">
              <Clock class="w-5 h-5 text-yellow-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Potenciais (-4 meses)</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ potenciaisMenos4.toLocaleString('pt-BR') }}
          </p>
          <p class="text-xs text-[var(--color-text-muted)] mt-1">
            pacientes para reativar
          </p>
        </div>

        <div class="card p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-red-500/20 rounded-lg">
              <AlertTriangle class="w-5 h-5 text-red-500" />
            </div>
            <span class="text-sm text-[var(--color-text-muted)]">Potenciais (+4 meses)</span>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text-primary)]">
            {{ potenciaisMais4.toLocaleString('pt-BR') }}
          </p>
          <p class="text-xs text-[var(--color-text-muted)] mt-1">
            pacientes inativos
          </p>
        </div>
      </div>

      <!-- Segmentação RFM -->
      <div v-if="rfmSegments.length > 0" class="card p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 bg-purple-500/20 rounded-lg">
            <Target class="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
              Segmentação RFM
            </h3>
            <p class="text-xs text-[var(--color-text-muted)]">
              Recência, Frequência, Valor Monetário
            </p>
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            v-for="segment in rfmSegments"
            :key="segment.rfm_segment"
            class="p-4 rounded-lg bg-[var(--color-bg-tertiary)]"
          >
            <div class="flex items-center gap-2 mb-2">
              <div
                class="w-3 h-3 rounded-full"
                :class="segmentColors[segment.rfm_segment] || 'bg-gray-500'"
              ></div>
              <span class="text-sm font-medium text-[var(--color-text-primary)]">
                {{ segment.rfm_segment }}
              </span>
            </div>
            <p class="text-2xl font-bold text-[var(--color-text-primary)]">
              {{ parseInt(segment.count).toLocaleString('pt-BR') }}
            </p>
            <div class="mt-2 space-y-1">
              <p class="text-xs text-[var(--color-text-muted)]">
                LTV Médio: <span class="font-medium text-[var(--color-text-secondary)]">{{ formatCurrency(parseFloat(segment.avg_ltv)) }}</span>
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">
                Ticket Médio: <span class="font-medium text-[var(--color-text-secondary)]">{{ formatCurrency(parseFloat(segment.avg_ticket)) }}</span>
              </p>
              <p class="text-xs text-[var(--color-text-muted)]">
                Compras Média: <span class="font-medium text-[var(--color-text-secondary)]">{{ parseFloat(segment.avg_purchases).toFixed(1) }}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Clientes por LTV -->
      <div v-if="topLtvCustomers.length > 0" class="card p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 bg-amber-500/20 rounded-lg">
            <Award class="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
              Top Clientes por Lifetime Value
            </h3>
            <p class="text-xs text-[var(--color-text-muted)]">
              Clientes com maior valor acumulado
            </p>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--color-border-primary)]">
                <th class="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">Cliente</th>
                <th class="text-right py-3 px-4 text-[var(--color-text-muted)] font-medium">LTV</th>
                <th class="text-right py-3 px-4 text-[var(--color-text-muted)] font-medium">Ticket Médio</th>
                <th class="text-right py-3 px-4 text-[var(--color-text-muted)] font-medium">Compras</th>
                <th class="text-left py-3 px-4 text-[var(--color-text-muted)] font-medium">Segmento</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="customer in topLtvCustomers"
                :key="customer.cliente_id"
                class="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-tertiary)]"
              >
                <td class="py-3 px-4 text-[var(--color-text-primary)]">{{ customer.cliente_nome }}</td>
                <td class="py-3 px-4 text-right font-medium text-green-500">{{ formatCurrency(customer.lifetime_value) }}</td>
                <td class="py-3 px-4 text-right text-[var(--color-text-secondary)]">{{ formatCurrency(customer.ticket_medio) }}</td>
                <td class="py-3 px-4 text-right text-[var(--color-text-secondary)]">{{ customer.total_compras }}</td>
                <td class="py-3 px-4">
                  <span
                    class="px-2 py-1 rounded text-xs font-medium text-white"
                    :class="segmentColors[customer.rfm_segment] || 'bg-gray-500'"
                  >
                    {{ customer.rfm_segment }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top Faturamento -->
      <div class="card p-6">
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Top Faturamento por Paciente
        </h3>
        <DataTable
          :columns="faturamentoColumns"
          :data="pacientesData?.faturamentoPaciente || []"
          :max-rows="15"
          empty-message="Nenhum dado de faturamento disponível"
        />
      </div>

      <!-- Pacientes Potenciais -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-yellow-500/20 rounded-lg">
              <Clock class="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
                Potenciais - Menos de 4 Meses
              </h3>
              <p class="text-xs text-[var(--color-text-muted)]">
                Pacientes com potencial de reativação
              </p>
            </div>
          </div>
          <DataTable
            :columns="potenciaisColumns"
            :data="pacientesData?.potenciaisMenos4Meses || []"
            :max-rows="10"
            empty-message="Nenhum paciente nesta categoria"
          />
        </div>

        <div class="card p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-red-500/20 rounded-lg">
              <AlertTriangle class="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
                Potenciais - Mais de 4 Meses
              </h3>
              <p class="text-xs text-[var(--color-text-muted)]">
                Pacientes inativos há mais tempo
              </p>
            </div>
          </div>
          <DataTable
            :columns="potenciaisColumns"
            :data="pacientesData?.potenciaisMais4Meses || []"
            :max-rows="10"
            empty-message="Nenhum paciente nesta categoria"
          />
        </div>
      </div>
    </template>
  </div>
</template>
