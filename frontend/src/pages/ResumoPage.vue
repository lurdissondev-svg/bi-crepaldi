<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import AreaChartCard from '@/components/charts/AreaChartCard.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { formatCurrency } from '@/utils/format'
import {
  DollarSign,
  Users,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Repeat,
  ShoppingBag,
  CreditCard,
} from 'lucide-vue-next'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.resumo)
const isRevalidating = computed(() => revalidatingStates.value.resumo)

const localData = ref({
  faturamento: { total: 0, variacao: 0 },
  pacienteNovo: { leadsNovos: 0, leadsAgendados: 0, pacientesVenda: 0, ticketMedio: 0 },
  pacienteRecorrente: { leads: 0, leadsAgendados: 0, pacientes: 0, ticketMedio: 0 },
})

watch(() => data.value.resumo, (resumo) => {
  if (resumo) {
    localData.value = {
      faturamento: {
        total: resumo.faturamento.total,
        variacao: parseFloat(String(resumo.faturamento.variacao)),
      },
      pacienteNovo: resumo.pacienteNovo,
      pacienteRecorrente: resumo.pacienteRecorrente,
    }
  }
}, { immediate: true })

const taxaConversaoNovos = computed(() => {
  if (localData.value.pacienteNovo.leadsNovos <= 0) return '0'
  return ((localData.value.pacienteNovo.pacientesVenda / localData.value.pacienteNovo.leadsNovos) * 100).toFixed(1)
})

const taxaAgendamentoNovos = computed(() => {
  if (localData.value.pacienteNovo.leadsNovos <= 0) return '0'
  return ((localData.value.pacienteNovo.leadsAgendados / localData.value.pacienteNovo.leadsNovos) * 100).toFixed(1)
})

const totalPacientes = computed(() =>
  localData.value.pacienteNovo.pacientesVenda + localData.value.pacienteRecorrente.pacientes
)

const ticketMedioGeral = computed(() => {
  if (totalPacientes.value <= 0) return 0
  return localData.value.faturamento.total / totalPacientes.value
})

const desempenhoDezena = computed(() => {
  if (!data.value.resumo?.desempenhoDezena) {
    return [
      { name: '1ª dezena', mes_atual: 0, mes_anterior: 0 },
      { name: '2ª dezena', mes_atual: 0, mes_anterior: 0 },
      { name: '3ª dezena', mes_atual: 0, mes_anterior: 0 },
    ]
  }
  return data.value.resumo.desempenhoDezena.map((d: any) => ({
    name: d.dezena,
    mes_atual: d.mes_atual || 0,
    mes_anterior: d.mes_anterior || 0,
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

    <PageSkeleton v-if="isLoading && !data.resumo" />

    <template v-else>
      <!-- Hero Section -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-emerald-100 text-sm font-medium flex items-center gap-2">
                <DollarSign class="w-4 h-4" />
                Faturamento Total
              </p>
              <p class="text-4xl font-bold mt-2">
                {{ formatCurrency(localData.faturamento.total) }}
              </p>
              <div v-if="localData.faturamento.variacao !== 0" class="flex items-center gap-2 mt-3">
                <TrendingUp v-if="localData.faturamento.variacao > 0" class="w-4 h-4 text-emerald-200" />
                <TrendingDown v-else class="w-4 h-4 text-red-300" />
                <span :class="['text-sm font-medium', localData.faturamento.variacao > 0 ? 'text-emerald-200' : 'text-red-300']">
                  {{ localData.faturamento.variacao > 0 ? '+' : '' }}{{ localData.faturamento.variacao.toFixed(1) }}% vs mês anterior
                </span>
              </div>
            </div>
            <div class="bg-white/20 p-3 rounded-xl">
              <DollarSign class="w-8 h-8" />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="card p-4 flex flex-col justify-between">
            <div class="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Users class="w-4 h-4" />
              <span class="text-xs">Total Pacientes</span>
            </div>
            <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-2">
              {{ totalPacientes.toLocaleString('pt-BR') }}
            </p>
          </div>
          <div class="card p-4 flex flex-col justify-between">
            <div class="flex items-center gap-2 text-[var(--color-text-muted)]">
              <CreditCard class="w-4 h-4" />
              <span class="text-xs">Ticket Médio</span>
            </div>
            <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-2">
              {{ formatCurrency(ticketMedioGeral) }}
            </p>
          </div>
          <div class="card p-4 flex flex-col justify-between">
            <div class="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Target class="w-4 h-4" />
              <span class="text-xs">Taxa Conversão</span>
            </div>
            <p class="text-2xl font-bold text-emerald-500 mt-2">
              {{ taxaConversaoNovos }}%
            </p>
          </div>
          <div class="card p-4 flex flex-col justify-between">
            <div class="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Calendar class="w-4 h-4" />
              <span class="text-xs">Taxa Agendamento</span>
            </div>
            <p class="text-2xl font-bold text-blue-500 mt-2">
              {{ taxaAgendamentoNovos }}%
            </p>
          </div>
        </div>
      </div>

      <!-- Pacientes Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Pacientes Novos -->
        <div class="card overflow-hidden">
          <div class="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-4">
            <div class="flex items-center gap-3 text-white">
              <div class="bg-white/20 p-2 rounded-lg">
                <UserPlus class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-semibold">Pacientes Novos</h3>
                <p class="text-blue-100 text-xs">Primeira vez na clínica</p>
              </div>
            </div>
          </div>
          <div class="p-5 space-y-4">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p class="text-sm font-medium text-[var(--color-text-primary)]">Leads</p>
                    <p class="text-xs text-[var(--color-text-muted)]">Total de leads novos</p>
                  </div>
                </div>
                <span class="text-xl font-bold text-[var(--color-text-primary)]">
                  {{ localData.pacienteNovo.leadsNovos.toLocaleString('pt-BR') }}
                </span>
              </div>

              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <ShoppingBag class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p class="text-sm font-medium text-[var(--color-text-primary)]">Vendas</p>
                    <p class="text-xs text-[var(--color-text-muted)]">Pacientes que compraram</p>
                  </div>
                </div>
                <span class="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {{ localData.pacienteNovo.pacientesVenda.toLocaleString('pt-BR') }}
                </span>
              </div>
            </div>

            <div class="pt-4 border-t border-[var(--color-border-subtle)]">
              <div class="flex items-center justify-between">
                <span class="text-sm text-[var(--color-text-muted)]">Ticket Médio</span>
                <span class="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {{ formatCurrency(localData.pacienteNovo.ticketMedio) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Pacientes Recorrentes -->
        <div class="card overflow-hidden">
          <div class="bg-gradient-to-r from-purple-500 to-purple-600 px-5 py-4">
            <div class="flex items-center gap-3 text-white">
              <div class="bg-white/20 p-2 rounded-lg">
                <Repeat class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-semibold">Pacientes Recorrentes</h3>
                <p class="text-purple-100 text-xs">Retornos e recompras</p>
              </div>
            </div>
          </div>
          <div class="p-5 space-y-4">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Users class="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p class="text-sm font-medium text-[var(--color-text-primary)]">Leads Retorno</p>
                    <p class="text-xs text-[var(--color-text-muted)]">Pacientes que voltaram</p>
                  </div>
                </div>
                <span class="text-xl font-bold text-[var(--color-text-primary)]">
                  {{ localData.pacienteRecorrente.leads.toLocaleString('pt-BR') }}
                </span>
              </div>

              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <ShoppingBag class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p class="text-sm font-medium text-[var(--color-text-primary)]">Recompras</p>
                    <p class="text-xs text-[var(--color-text-muted)]">Pacientes que compraram</p>
                  </div>
                </div>
                <span class="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {{ localData.pacienteRecorrente.pacientes.toLocaleString('pt-BR') }}
                </span>
              </div>
            </div>

            <div class="pt-4 border-t border-[var(--color-border-subtle)]">
              <div class="flex items-center justify-between">
                <span class="text-sm text-[var(--color-text-muted)]">Ticket Médio</span>
                <span class="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {{ formatCurrency(localData.pacienteRecorrente.ticketMedio) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chart -->
      <AreaChartCard
        title="Desempenho por Dezena"
        :data="desempenhoDezena"
        :data-keys="[
          { key: 'mes_anterior', color: '#60a5fa', name: 'Mês Anterior' },
          { key: 'mes_atual', color: '#22c55e', name: 'Mês Atual' },
        ]"
        format-y-axis="currency"
      />
    </template>
  </div>
</template>
