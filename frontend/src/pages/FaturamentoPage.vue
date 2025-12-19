<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import BarChartCard from '@/components/charts/BarChartCard.vue'
import LineChartCard from '@/components/charts/LineChartCard.vue'
import DonutChartCard from '@/components/charts/DonutChartCard.vue'
import KPIStrip, { type KPIItem } from '@/components/charts/KPIStrip.vue'
import DataTable from '@/components/dashboard/DataTable.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { DollarSign, TrendingUp, Calendar, ShoppingBag, Users, Stethoscope, UserPlus, UserCheck } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'
import api from '@/services/api'
import type { FaturamentoMedico, FaturamentoServico, TicketMedioTipoData } from '@/types'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.faturamento)
const isRevalidating = computed(() => revalidatingStates.value.faturamento)

const faturamentoData = computed(() => data.value.faturamento)

// Novos dados
const faturamentoMedico = ref<FaturamentoMedico[]>([])
const faturamentoServico = ref<FaturamentoServico[]>([])
const ticketMedioTipo = ref<TicketMedioTipoData | null>(null)
const loadingNovosIndicadores = ref(false)

// Carregar novos indicadores
async function loadNovosIndicadores() {
  loadingNovosIndicadores.value = true
  try {
    const [medico, servico, ticketTipo] = await Promise.all([
      api.getFaturamentoMedico(filters.value),
      api.getFaturamentoServico(filters.value),
      api.getTicketMedioTipo(filters.value),
    ])
    faturamentoMedico.value = medico
    faturamentoServico.value = servico
    ticketMedioTipo.value = ticketTipo
  } catch (error) {
    console.error('Erro ao carregar novos indicadores:', error)
  } finally {
    loadingNovosIndicadores.value = false
  }
}

onMounted(() => {
  loadNovosIndicadores()
})

// Recarregar quando os filtros mudarem
watch(filters, () => {
  loadNovosIndicadores()
}, { deep: true })

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

// Dados para o gráfico de faturamento por serviço
const servicoChart = computed(() => {
  return faturamentoServico.value.map((item) => ({
    name: item.categoria,
    value: item.faturamento,
  }))
})

// Dados para o gráfico de faturamento por médico
const medicoChart = computed(() => {
  return faturamentoMedico.value.slice(0, 10).map((item) => ({
    name: item.medico,
    value: item.faturamento,
  }))
})

// Colunas da tabela de médicos
const medicoColumns = [
  { key: 'medico', label: 'Médico' },
  { key: 'totalAtendimentos', label: 'Atendimentos', align: 'center' as const },
  { key: 'faturamento', label: 'Faturamento', align: 'right' as const, format: 'currency' as const },
  { key: 'ticketMedio', label: 'Ticket Médio', align: 'right' as const, format: 'currency' as const },
]

// KPI Items para o KPIStrip
const kpiItems = computed<KPIItem[]>(() => {
  const items: KPIItem[] = [
    {
      id: 'faturamento-mensal',
      label: 'Faturamento Mensal',
      value: faturamentoData.value?.mensal?.valor || 0,
      previousValue: faturamentoData.value?.mensal?.mesAnterior,
      format: 'currency',
      color: 'success',
      icon: DollarSign,
      subtitle: faturamentoData.value?.mensal?.pacientesNovosPercentual
        ? `${faturamentoData.value.mensal.pacientesNovosPercentual.toFixed(1)}% de pacientes novos`
        : undefined,
    },
    {
      id: 'faturamento-anual',
      label: 'Faturamento Anual',
      value: faturamentoData.value?.anual?.valor || 0,
      previousValue: faturamentoData.value?.anual?.anoAnterior,
      format: 'currency',
      color: 'accent',
      icon: Calendar,
      subtitle: faturamentoData.value?.anual?.pacientesNovosPercentual
        ? `${faturamentoData.value.anual.pacientesNovosPercentual.toFixed(1)}% de pacientes novos`
        : undefined,
    },
    {
      id: 'crescimento-mensal',
      label: 'Crescimento Mensal',
      value: faturamentoData.value?.crescimentoMensal?.percentual || 0,
      format: 'percentage',
      color: 'default',
      icon: TrendingUp,
      subtitle: 'vs mesmo mês ano anterior',
    },
  ]

  // Vendas Hoje ou Crescimento Anual
  if (faturamentoData.value?.vendasHoje) {
    items.push({
      id: 'vendas-hoje',
      label: 'Vendas Hoje',
      value: faturamentoData.value.vendasHoje.valor,
      format: 'currency',
      color: 'warning',
      icon: ShoppingBag,
      subtitle: `${faturamentoData.value.vendasHoje.quantidade} venda(s)`,
    })
  } else {
    items.push({
      id: 'crescimento-anual',
      label: 'Crescimento Anual',
      value: faturamentoData.value?.crescimentoAnual?.percentual || 0,
      format: 'percentage',
      color: 'warning',
      icon: TrendingUp,
      subtitle: 'vs ano anterior',
    })
  }

  return items
})

// KPI Items para Ticket Médio Novos vs Recorrentes
const ticketMedioKpis = computed<KPIItem[]>(() => {
  if (!ticketMedioTipo.value) return []

  return [
    {
      id: 'ticket-novos',
      label: 'Ticket Médio - Novos',
      value: ticketMedioTipo.value.novos.ticketMedio,
      format: 'currency',
      color: 'success',
      icon: UserPlus,
      subtitle: `${ticketMedioTipo.value.novos.totalClientes} pacientes novos`,
    },
    {
      id: 'ticket-recorrentes',
      label: 'Ticket Médio - Recorrentes',
      value: ticketMedioTipo.value.recorrentes.ticketMedio,
      format: 'currency',
      color: 'accent',
      icon: UserCheck,
      subtitle: `${ticketMedioTipo.value.recorrentes.totalClientes} pacientes recorrentes`,
    },
    {
      id: 'faturamento-novos',
      label: 'Faturamento Novos',
      value: ticketMedioTipo.value.novos.faturamento,
      format: 'currency',
      color: 'default',
      icon: DollarSign,
      subtitle: `${ticketMedioTipo.value.novos.totalVendas} vendas`,
    },
    {
      id: 'faturamento-recorrentes',
      label: 'Faturamento Recorrentes',
      value: ticketMedioTipo.value.recorrentes.faturamento,
      format: 'currency',
      color: 'warning',
      icon: DollarSign,
      subtitle: `${ticketMedioTipo.value.recorrentes.totalVendas} vendas`,
    },
  ]
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
      <!-- KPIs Principais com KPIStrip -->
      <KPIStrip
        :items="kpiItems"
        :primary-count="2"
        layout="grid"
      />

      <!-- Gráficos de Tendência -->
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

      <!-- Ticket Médio: Novos vs Recorrentes -->
      <SectionHeader
        v-if="ticketMedioTipo"
        title="Ticket Médio por Tipo de Cliente"
        subtitle="Comparativo entre pacientes novos e recorrentes"
        :icon="Users"
      />
      <KPIStrip
        v-if="ticketMedioKpis.length > 0"
        :items="ticketMedioKpis"
        :primary-count="2"
        layout="grid"
      />

      <!-- Faturamento por Serviço e Médico -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DonutChartCard
          v-if="servicoChart.length > 0"
          title="Faturamento por Categoria de Serviço"
          :data="servicoChart"
          :height="350"
        />

        <BarChartCard
          v-if="medicoChart.length > 0"
          title="Top 10 Médicos por Faturamento"
          :data="medicoChart"
          color="#8b5cf6"
          format-y-axis="currency"
          :height="350"
          :horizontal="true"
        />
      </div>

      <!-- Tabela de Médicos Detalhada -->
      <div v-if="faturamentoMedico.length > 0" class="card p-6">
        <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Stethoscope class="w-5 h-5" />
          Faturamento por Médico
        </h3>
        <DataTable
          :data="faturamentoMedico"
          :columns="medicoColumns"
          :max-items="15"
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
