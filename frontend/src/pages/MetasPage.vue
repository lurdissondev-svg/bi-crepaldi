<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import FilterBar from '@/components/filters/FilterBar.vue'
import TabNavigation from '@/components/navigation/TabNavigation.vue'
import GaugeChart from '@/components/charts/GaugeChart.vue'
import RevalidatingIndicator from '@/components/ui/RevalidatingIndicator.vue'
import PageSkeleton from '@/components/ui/PageSkeleton.vue'
import { Target, Calendar, TrendingUp, DollarSign, Settings, ChevronDown, ChevronUp, Save, RotateCcw } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'
import api from '@/services/api'
import type { MetaEstabelecimento, MetaInfo } from '@/types'

const store = useDashboardStore()
const { data, loadingStates, revalidatingStates, filters, filterOptions } = storeToRefs(store)

const isLoading = computed(() => loadingStates.value.metas)
const isRevalidating = computed(() => revalidatingStates.value.metas)

const metasData = computed(() => data.value.metas)

// Business Days Configuration
const showBusinessDaysConfig = ref(false)
const selectedYear = ref(new Date().getFullYear())
const businessDaysData = ref<Array<{
  year: number;
  month: number;
  business_days: number;
  calculated_days: number | null;
  notes: string | null;
  updated_at: string | null;
}>>([])
const editingMonth = ref<number | null>(null)
const editValue = ref(0)
const isSavingBusinessDays = ref(false)
const businessDaysError = ref('')

const monthNames = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

async function loadBusinessDays() {
  try {
    businessDaysError.value = ''
    businessDaysData.value = await api.getBusinessDays(selectedYear.value)
  } catch (e) {
    businessDaysError.value = 'Erro ao carregar dias uteis'
    console.error(e)
  }
}

function startEditing(month: number, currentValue: number) {
  editingMonth.value = month
  editValue.value = currentValue
}

function cancelEditing() {
  editingMonth.value = null
  editValue.value = 0
}

async function saveBusinessDays(month: number) {
  if (editValue.value < 0 || editValue.value > 31) {
    businessDaysError.value = 'Valor deve ser entre 0 e 31'
    return
  }

  isSavingBusinessDays.value = true
  businessDaysError.value = ''

  try {
    await api.updateBusinessDays(selectedYear.value, month, editValue.value)
    await loadBusinessDays()
    editingMonth.value = null
    // Refetch metas to reflect the change
    store.refetch()
  } catch (e) {
    businessDaysError.value = 'Erro ao salvar dias uteis'
    console.error(e)
  } finally {
    isSavingBusinessDays.value = false
  }
}

async function resetToCalculated(month: number, calculatedDays: number | null) {
  if (calculatedDays === null) return

  isSavingBusinessDays.value = true
  businessDaysError.value = ''

  try {
    await api.updateBusinessDays(selectedYear.value, month, calculatedDays)
    await loadBusinessDays()
    // Refetch metas to reflect the change
    store.refetch()
  } catch (e) {
    businessDaysError.value = 'Erro ao resetar dias uteis'
    console.error(e)
  } finally {
    isSavingBusinessDays.value = false
  }
}

watch(selectedYear, () => {
  loadBusinessDays()
})

onMounted(() => {
  if (showBusinessDaysConfig.value) {
    loadBusinessDays()
  }
})

watch(showBusinessDaysConfig, (newVal) => {
  if (newVal && businessDaysData.value.length === 0) {
    loadBusinessDays()
  }
})

// Helper para cor baseada no percentual
function getMetaColor(meta: MetaInfo | undefined): string {
  if (!meta) return '#64748b'
  const pct = meta.realidade
  if (pct >= 100) return '#22c55e'
  if (pct >= 80) return '#eab308'
  if (pct >= 50) return '#f97316'
  return '#ef4444'
}

// Helper para status da meta
function getMetaStatus(meta: MetaInfo | undefined): string {
  if (!meta) return 'N/A'
  const pct = meta.realidade
  if (pct >= 100) return 'Atingida'
  if (pct >= 80) return 'Próximo'
  if (pct >= 50) return 'Em andamento'
  return 'Atrasado'
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

    <PageSkeleton v-if="isLoading && !metasData" />

    <template v-else>
      <!-- Progresso Geral -->
      <div v-if="metasData?.progressoGeral" class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp class="w-5 h-5 text-green-500" />
            </div>
            <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">Progresso Geral</h3>
          </div>
          <button
            @click="showBusinessDaysConfig = !showBusinessDaysConfig"
            class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <Settings class="w-4 h-4" />
            Dias Uteis
            <ChevronDown v-if="!showBusinessDaysConfig" class="w-4 h-4" />
            <ChevronUp v-else class="w-4 h-4" />
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
            <p class="text-sm text-[var(--color-text-muted)]">Faturamento Total</p>
            <p class="text-xl font-bold text-[var(--color-text-primary)] mt-1">
              {{ metasData.progressoGeral.faturamentoTotalFormatado || formatCurrency(metasData.progressoGeral.faturamentoTotal) }}
            </p>
          </div>
          <div class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
            <p class="text-sm text-[var(--color-text-muted)]">Dias Uteis Passados</p>
            <p class="text-xl font-bold text-[var(--color-text-primary)] mt-1">
              {{ metasData.progressoGeral.diasPassados }} / {{ metasData.progressoGeral.totalDias }}
            </p>
          </div>
          <div class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
            <p class="text-sm text-[var(--color-text-muted)]">Dias Uteis Restantes</p>
            <p class="text-xl font-bold text-[var(--color-text-primary)] mt-1">
              {{ metasData.progressoGeral.diasRestantes }}
            </p>
          </div>
          <div class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
            <p class="text-sm text-[var(--color-text-muted)]">Expectativa</p>
            <p class="text-xl font-bold text-[var(--color-text-primary)] mt-1">
              {{ metasData.progressoGeral.expectativaPct.toFixed(1) }}%
            </p>
          </div>
        </div>

        <!-- Business Days Configuration Panel -->
        <div v-if="showBusinessDaysConfig" class="mt-6 pt-6 border-t border-[var(--color-border-primary)]">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h4 class="font-semibold text-[var(--color-text-primary)]">Configurar Dias Uteis por Mes</h4>
              <p class="text-sm text-[var(--color-text-muted)]">Edite a quantidade de dias uteis de cada mes (exclui finais de semana e feriados)</p>
            </div>
            <select
              v-model="selectedYear"
              class="px-3 py-2 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              <option v-for="year in [2024, 2025, 2026, 2027]" :key="year" :value="year">{{ year }}</option>
            </select>
          </div>

          <!-- Error message -->
          <div v-if="businessDaysError" class="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {{ businessDaysError }}
          </div>

          <!-- Months Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div
              v-for="(item, index) in businessDaysData"
              :key="item.month"
              class="p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]"
            >
              <p class="text-sm font-medium text-[var(--color-text-primary)] mb-2">{{ monthNames[item.month - 1] }}</p>

              <!-- View Mode -->
              <div v-if="editingMonth !== item.month" class="flex items-center justify-between">
                <div>
                  <span class="text-xl font-bold text-[var(--color-text-primary)]">{{ item.business_days }}</span>
                  <span class="text-xs text-[var(--color-text-muted)] ml-1">dias</span>
                </div>
                <button
                  @click="startEditing(item.month, item.business_days)"
                  class="p-1.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                  title="Editar"
                >
                  <Settings class="w-4 h-4" />
                </button>
              </div>

              <!-- Edit Mode -->
              <div v-else class="space-y-2">
                <input
                  v-model.number="editValue"
                  type="number"
                  min="0"
                  max="31"
                  class="w-full px-2 py-1 text-center rounded border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <div class="flex gap-1">
                  <button
                    @click="saveBusinessDays(item.month)"
                    :disabled="isSavingBusinessDays"
                    class="flex-1 p-1.5 rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
                    title="Salvar"
                  >
                    <Save class="w-3 h-3 mx-auto" />
                  </button>
                  <button
                    @click="cancelEditing"
                    class="flex-1 p-1.5 rounded border border-[var(--color-border-primary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    title="Cancelar"
                  >
                    &times;
                  </button>
                </div>
              </div>

              <!-- Calculated value indicator -->
              <div v-if="item.calculated_days !== null && item.business_days !== item.calculated_days" class="mt-2 flex items-center justify-between">
                <span class="text-xs text-[var(--color-text-muted)]">
                  Auto: {{ item.calculated_days }}
                </span>
                <button
                  @click="resetToCalculated(item.month, item.calculated_days)"
                  :disabled="isSavingBusinessDays"
                  class="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                  title="Restaurar valor calculado"
                >
                  <RotateCcw class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cards de Metas por Estabelecimento -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Meta Spa -->
        <div v-if="metasData?.metaSpa" class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-blue-500/20 rounded-lg">
                <Target class="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">{{ metasData.metaSpa.nome }}</h3>
                <p class="text-sm text-[var(--color-text-muted)]">
                  {{ metasData.metaSpa.faturamentoAtualFormatado || formatCurrency(metasData.metaSpa.faturamentoAtual) }}
                </p>
              </div>
            </div>
          </div>
          <div class="space-y-4">
            <div v-for="(meta, key) in [metasData.metaSpa.meta1, metasData.metaSpa.meta2, metasData.metaSpa.meta3]" :key="key" class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-[var(--color-text-primary)]">Meta {{ key + 1 }}</span>
                <span :class="['text-xs px-2 py-1 rounded', meta?.realidade >= 100 ? 'bg-green-500/20 text-green-500' : meta?.realidade >= 80 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500']">
                  {{ getMetaStatus(meta) }}
                </span>
              </div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-[var(--color-text-muted)]">Meta: {{ meta?.metaValorFormatado || formatCurrency(meta?.metaValor || 0) }}</span>
                <span class="font-medium" :style="{ color: getMetaColor(meta) }">{{ (meta?.realidade || 0).toFixed(1) }}%</span>
              </div>
              <div class="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
                <div class="h-2 rounded-full transition-all duration-500" :style="{ width: `${Math.min(100, meta?.realidade || 0)}%`, backgroundColor: getMetaColor(meta) }"></div>
              </div>
              <div class="flex justify-between text-xs text-[var(--color-text-muted)] mt-2">
                <span>Meta diária: {{ formatCurrency(meta?.diaria || 0) }}</span>
                <span>{{ meta?.diasRestantes || 0 }} dias restantes</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Meta Convênios -->
        <div v-if="metasData?.metaConvenios" class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-purple-500/20 rounded-lg">
                <Target class="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">{{ metasData.metaConvenios.nome }}</h3>
                <p class="text-sm text-[var(--color-text-muted)]">
                  {{ metasData.metaConvenios.faturamentoAtualFormatado || formatCurrency(metasData.metaConvenios.faturamentoAtual) }}
                </p>
              </div>
            </div>
          </div>
          <div class="space-y-4">
            <div v-for="(meta, key) in [metasData.metaConvenios.meta1, metasData.metaConvenios.meta2, metasData.metaConvenios.meta3]" :key="key" class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-[var(--color-text-primary)]">Meta {{ key + 1 }}</span>
                <span :class="['text-xs px-2 py-1 rounded', meta?.realidade >= 100 ? 'bg-green-500/20 text-green-500' : meta?.realidade >= 80 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500']">
                  {{ getMetaStatus(meta) }}
                </span>
              </div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-[var(--color-text-muted)]">Meta: {{ meta?.metaValorFormatado || formatCurrency(meta?.metaValor || 0) }}</span>
                <span class="font-medium" :style="{ color: getMetaColor(meta) }">{{ (meta?.realidade || 0).toFixed(1) }}%</span>
              </div>
              <div class="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
                <div class="h-2 rounded-full transition-all duration-500" :style="{ width: `${Math.min(100, meta?.realidade || 0)}%`, backgroundColor: getMetaColor(meta) }"></div>
              </div>
              <div class="flex justify-between text-xs text-[var(--color-text-muted)] mt-2">
                <span>Meta diária: {{ formatCurrency(meta?.diaria || 0) }}</span>
                <span>{{ meta?.diasRestantes || 0 }} dias restantes</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Meta Bela Laser -->
        <div v-if="metasData?.metaBelaLaser" class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-pink-500/20 rounded-lg">
                <Target class="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">{{ metasData.metaBelaLaser.nome }}</h3>
                <p class="text-sm text-[var(--color-text-muted)]">
                  {{ metasData.metaBelaLaser.faturamentoAtualFormatado || formatCurrency(metasData.metaBelaLaser.faturamentoAtual) }}
                </p>
              </div>
            </div>
          </div>
          <div class="space-y-4">
            <div v-for="(meta, key) in [metasData.metaBelaLaser.meta1, metasData.metaBelaLaser.meta2, metasData.metaBelaLaser.meta3]" :key="key" class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-[var(--color-text-primary)]">Meta {{ key + 1 }}</span>
                <span :class="['text-xs px-2 py-1 rounded', meta?.realidade >= 100 ? 'bg-green-500/20 text-green-500' : meta?.realidade >= 80 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500']">
                  {{ getMetaStatus(meta) }}
                </span>
              </div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-[var(--color-text-muted)]">Meta: {{ meta?.metaValorFormatado || formatCurrency(meta?.metaValor || 0) }}</span>
                <span class="font-medium" :style="{ color: getMetaColor(meta) }">{{ (meta?.realidade || 0).toFixed(1) }}%</span>
              </div>
              <div class="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
                <div class="h-2 rounded-full transition-all duration-500" :style="{ width: `${Math.min(100, meta?.realidade || 0)}%`, backgroundColor: getMetaColor(meta) }"></div>
              </div>
              <div class="flex justify-between text-xs text-[var(--color-text-muted)] mt-2">
                <span>Meta diária: {{ formatCurrency(meta?.diaria || 0) }}</span>
                <span>{{ meta?.diasRestantes || 0 }} dias restantes</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Meta Nutrologia -->
        <div v-if="metasData?.metaNutrologia" class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-green-500/20 rounded-lg">
                <Target class="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">{{ metasData.metaNutrologia.nome }}</h3>
                <p class="text-sm text-[var(--color-text-muted)]">
                  {{ metasData.metaNutrologia.faturamentoAtualFormatado || formatCurrency(metasData.metaNutrologia.faturamentoAtual) }}
                </p>
              </div>
            </div>
          </div>
          <div class="space-y-4">
            <div v-for="(meta, key) in [metasData.metaNutrologia.meta1, metasData.metaNutrologia.meta2, metasData.metaNutrologia.meta3]" :key="key" class="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-[var(--color-text-primary)]">Meta {{ key + 1 }}</span>
                <span :class="['text-xs px-2 py-1 rounded', meta?.realidade >= 100 ? 'bg-green-500/20 text-green-500' : meta?.realidade >= 80 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500']">
                  {{ getMetaStatus(meta) }}
                </span>
              </div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-[var(--color-text-muted)]">Meta: {{ meta?.metaValorFormatado || formatCurrency(meta?.metaValor || 0) }}</span>
                <span class="font-medium" :style="{ color: getMetaColor(meta) }">{{ (meta?.realidade || 0).toFixed(1) }}%</span>
              </div>
              <div class="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
                <div class="h-2 rounded-full transition-all duration-500" :style="{ width: `${Math.min(100, meta?.realidade || 0)}%`, backgroundColor: getMetaColor(meta) }"></div>
              </div>
              <div class="flex justify-between text-xs text-[var(--color-text-muted)] mt-2">
                <span>Meta diária: {{ formatCurrency(meta?.diaria || 0) }}</span>
                <span>{{ meta?.diasRestantes || 0 }} dias restantes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
