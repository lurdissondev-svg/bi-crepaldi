<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import DataTable from '@/components/dashboard/DataTable.vue'
import KPIStrip, { type KPIItem } from '@/components/charts/KPIStrip.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { Users, DollarSign, Clock, AlertTriangle, TrendingUp, Target, Award, RefreshCcw, UserCheck } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'
import api from '@/services/api'
import type { RetentionRescueData } from '@/types'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.pacientes)
const isRevalidating = computed(() => revalidatingStates.value.pacientes)

const pacientesData = computed(() => data.value.pacientes)

// Métricas avançadas: RFM e LTV
const rfmSegments = ref<any[]>([])
const topLtvCustomers = ref<any[]>([])
const retentionRescue = ref<RetentionRescueData | null>(null)
const loadingMetrics = ref(false)

async function loadMetrics() {
  loadingMetrics.value = true
  try {
    const [rfmData, ltvData, retRescueData] = await Promise.all([
      api.getRFMSegmentation(),
      api.getTopCustomersByLTV(10),
      api.getRetentionRescue(filters.value),
    ])
    rfmSegments.value = rfmData || []
    topLtvCustomers.value = ltvData || []
    retentionRescue.value = retRescueData
  } catch (err) {
    console.error('Erro ao carregar métricas:', err)
  } finally {
    loadingMetrics.value = false
  }
}

onMounted(() => {
  loadMetrics()
})

watch(filters, () => {
  loadMetrics()
}, { deep: true })

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

// KPI Items para o KPIStrip - Agora inclui Retenção e Resgate
const kpiItems = computed<KPIItem[]>(() => {
  const items: KPIItem[] = [
    {
      id: 'total-clientes',
      label: 'Total Clientes',
      value: pacientesData.value?.totalClientes || 0,
      format: 'number',
      color: 'accent',
      icon: Users,
    },
    {
      id: 'total-investido',
      label: 'Total Investido',
      value: totalInvestimento.value,
      format: 'currency',
      color: 'success',
      icon: DollarSign,
      subtitle: `${totalVendas.value.toLocaleString('pt-BR')} vendas`,
    },
  ]

  // Adicionar Taxa de Retenção se disponível
  if (retentionRescue.value) {
    items.push(
      {
        id: 'taxa-retencao',
        label: 'Taxa de Retenção (90d)',
        value: retentionRescue.value.retencao.taxa,
        format: 'percentage',
        color: retentionRescue.value.retencao.taxa >= 60 ? 'success' : retentionRescue.value.retencao.taxa >= 40 ? 'warning' : 'danger',
        icon: UserCheck,
        subtitle: `${retentionRescue.value.retencao.retornaram90Dias} de ${retentionRescue.value.retencao.totalAtendidos} retornaram`,
      },
      {
        id: 'taxa-resgate',
        label: 'Taxa de Resgate',
        value: retentionRescue.value.resgate.taxa,
        format: 'percentage',
        color: retentionRescue.value.resgate.taxa >= 20 ? 'success' : retentionRescue.value.resgate.taxa >= 10 ? 'warning' : 'danger',
        icon: RefreshCcw,
        subtitle: `${retentionRescue.value.resgate.reativados} reativados`,
      }
    )
  }

  items.push(
    {
      id: 'potenciais-menos-4',
      label: 'Potenciais (-4 meses)',
      value: potenciaisMenos4.value,
      format: 'number',
      color: 'warning',
      icon: Clock,
      subtitle: 'pacientes para reativar',
    },
    {
      id: 'potenciais-mais-4',
      label: 'Potenciais (+4 meses)',
      value: potenciaisMais4.value,
      format: 'number',
      color: 'danger',
      icon: AlertTriangle,
      subtitle: 'pacientes inativos',
    }
  )

  return items
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
      <!-- KPIs com KPIStrip -->
      <KPIStrip
        :items="kpiItems"
        :primary-count="3"
        layout="grid"
      />

      <!-- Taxa de Retenção e Resgate Detalhada -->
      <div v-if="retentionRescue" class="card p-6">
        <SectionHeader
          title="Retenção e Resgate de Pacientes"
          subtitle="Indicadores de fidelização e reativação"
          :icon="UserCheck"
        />

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <!-- Taxa de Retenção -->
          <div class="p-6 bg-[var(--color-bg-tertiary)] rounded-xl">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                Taxa de Retenção (90 dias)
              </h4>
              <div class="relative w-20 h-20">
                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke="var(--color-bg-secondary)"
                    stroke-width="8"
                  />
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    :stroke="retentionRescue.retencao.taxa >= 60 ? 'var(--color-success)' : retentionRescue.retencao.taxa >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'"
                    stroke-width="8"
                    stroke-linecap="round"
                    :stroke-dasharray="`${retentionRescue.retencao.taxa * 2.51} 251`"
                  />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-lg font-bold text-[var(--color-text-primary)]">
                    {{ retentionRescue.retencao.taxa.toFixed(0) }}%
                  </span>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                <span class="text-sm text-[var(--color-text-muted)]">Total Atendidos</span>
                <span class="text-lg font-bold text-[var(--color-text-primary)]">
                  {{ retentionRescue.retencao.totalAtendidos.toLocaleString('pt-BR') }}
                </span>
              </div>
              <div class="flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                <span class="text-sm text-[var(--color-text-muted)]">Retornaram em 90 dias</span>
                <span class="text-lg font-bold text-[var(--color-success)]">
                  {{ retentionRescue.retencao.retornaram90Dias.toLocaleString('pt-BR') }}
                </span>
              </div>
            </div>

            <p class="mt-4 text-xs text-[var(--color-text-muted)]">
              Pacientes que voltaram dentro de 90 dias após a primeira visita no período
            </p>
          </div>

          <!-- Taxa de Resgate -->
          <div class="p-6 bg-[var(--color-bg-tertiary)] rounded-xl">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                Taxa de Resgate
              </h4>
              <div class="relative w-20 h-20">
                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke="var(--color-bg-secondary)"
                    stroke-width="8"
                  />
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    :stroke="retentionRescue.resgate.taxa >= 20 ? 'var(--color-success)' : retentionRescue.resgate.taxa >= 10 ? 'var(--color-warning)' : 'var(--color-danger)'"
                    stroke-width="8"
                    stroke-linecap="round"
                    :stroke-dasharray="`${retentionRescue.resgate.taxa * 2.51} 251`"
                  />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-lg font-bold text-[var(--color-text-primary)]">
                    {{ retentionRescue.resgate.taxa.toFixed(0) }}%
                  </span>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                <span class="text-sm text-[var(--color-text-muted)]">Total Contactados</span>
                <span class="text-lg font-bold text-[var(--color-text-primary)]">
                  {{ retentionRescue.resgate.totalContactados.toLocaleString('pt-BR') }}
                </span>
              </div>
              <div class="flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                <span class="text-sm text-[var(--color-text-muted)]">Reativados</span>
                <span class="text-lg font-bold text-[var(--color-success)]">
                  {{ retentionRescue.resgate.reativados.toLocaleString('pt-BR') }}
                </span>
              </div>
              <div class="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                <span class="text-sm text-[var(--color-text-muted)]">Valor Resgatado</span>
                <span class="text-lg font-bold text-green-500">
                  {{ formatCurrency(retentionRescue.resgate.valorResgatado) }}
                </span>
              </div>
            </div>

            <p class="mt-4 text-xs text-[var(--color-text-muted)]">
              Pacientes inativos contactados que retornaram
            </p>
          </div>
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
