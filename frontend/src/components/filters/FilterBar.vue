<script setup lang="ts">
import { ref, computed } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ChevronDown, Check, X, Calendar } from 'lucide-vue-next'
import { cn } from '@/utils/cn'
import type { FilterState, FilterOptions } from '@/types'

const props = withDefaults(defineProps<{
  filters: FilterState
  filterOptions?: FilterOptions | null
  showProfissional?: boolean
}>(), {
  showProfissional: true,
})

const emit = defineEmits<{
  (e: 'update:filters', filters: FilterState): void
}>()

const activeDropdown = ref<'estabelecimento' | 'profissional' | 'date' | null>(null)
const dropdownRef = ref<HTMLDivElement | null>(null)

onClickOutside(dropdownRef, () => {
  activeDropdown.value = null
})

const defaultEstabelecimentos = [
  { id: '1', nome: 'Dermato' },
  { id: '2', nome: 'SPA' },
  { id: '5', nome: 'Convenio' },
  { id: '10', nome: 'Drips' },
  { id: '11', nome: 'Estetica' },
  { id: '12', nome: 'Bela Laser' },
  { id: '14', nome: 'Nutrologia' },
]

const datePresets = [
  {
    label: 'Hoje',
    getValue: () => {
      const today = new Date().toISOString().split('T')[0]
      return { start: today, end: today }
    }
  },
  {
    label: 'Ontem',
    getValue: () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const date = yesterday.toISOString().split('T')[0]
      return { start: date, end: date }
    }
  },
  {
    label: 'Ultimos 7 dias',
    getValue: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 6)
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      }
    }
  },
  {
    label: 'Ultimos 30 dias',
    getValue: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 29)
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      }
    }
  },
  {
    label: 'Este mes',
    getValue: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      }
    }
  },
  {
    label: 'Mes passado',
    getValue: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      }
    }
  },
  {
    label: 'Este ano',
    getValue: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), 0, 1)
      const end = new Date(now.getFullYear(), 11, 31)
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      }
    }
  },
]

const estabelecimentos = computed(() => props.filterOptions?.centrosCusto || defaultEstabelecimentos)
const profissionais = computed(() => props.filterOptions?.profissionais || [])

const profissionalLabel = computed(() => {
  if (!props.filters.profissional) return 'Todos'
  return profissionais.value.find(p => p.id === props.filters.profissional)?.nome || 'Selecionado'
})

const dateLabel = computed(() => {
  for (const preset of datePresets) {
    const { start, end } = preset.getValue()
    if (props.filters.dataInicio === start && props.filters.dataFim === end) {
      return preset.label
    }
  }
  const formatDate = (d: string) => {
    const [, m, day] = d.split('-')
    return `${day}/${m}`
  }
  return `${formatDate(props.filters.dataInicio)} - ${formatDate(props.filters.dataFim)}`
})

const hasFilters = computed(() => props.filters.centrosCusto.length > 0 || props.filters.profissional)

function handleEstabelecimentoToggle(id: string) {
  const newList = props.filters.centrosCusto.includes(id)
    ? props.filters.centrosCusto.filter(c => c !== id)
    : [...props.filters.centrosCusto, id]
  emit('update:filters', { ...props.filters, centrosCusto: newList })
}

function handleProfissionalChange(id: string) {
  emit('update:filters', { ...props.filters, profissional: id || undefined })
  activeDropdown.value = null
}

function handleDatePreset(preset: typeof datePresets[0]) {
  const { start, end } = preset.getValue()
  emit('update:filters', { ...props.filters, dataInicio: start, dataFim: end })
  activeDropdown.value = null
}

function handleDateChange(field: 'dataInicio' | 'dataFim', value: string) {
  emit('update:filters', { ...props.filters, [field]: value })
}

function selectAllEstabelecimentos() {
  emit('update:filters', { ...props.filters, centrosCusto: estabelecimentos.value.map(e => e.id) })
}

function clearEstabelecimentos() {
  emit('update:filters', { ...props.filters, centrosCusto: [] })
}

function clearFilters() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  emit('update:filters', {
    dataInicio: start,
    dataFim: end,
    centrosCusto: [],
    profissional: undefined,
  })
}

function isDatePresetActive(preset: typeof datePresets[0]): boolean {
  const { start, end } = preset.getValue()
  return props.filters.dataInicio === start && props.filters.dataFim === end
}
</script>

<template>
  <div ref="dropdownRef" class="flex flex-wrap items-center gap-2">
    <!-- Estabelecimento Filter -->
    <div class="relative">
      <button
        @click="activeDropdown = activeDropdown === 'estabelecimento' ? null : 'estabelecimento'"
        :class="cn(
          'inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all duration-200',
          filters.centrosCusto.length > 0
            ? 'bg-[var(--color-accent-light)] border-[var(--color-accent)] text-[var(--color-accent)]'
            : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-primary)] text-[var(--color-text-primary)] hover:border-[var(--color-border-secondary)]'
        )"
      >
        <span>Estabelecimento</span>
        <span
          v-if="filters.centrosCusto.length > 0"
          class="px-1.5 py-0.5 text-xs bg-[var(--color-accent)] text-white rounded-full"
        >
          {{ filters.centrosCusto.length }}
        </span>
        <ChevronDown
          :size="14"
          :class="cn('transition-transform', activeDropdown === 'estabelecimento' && 'rotate-180')"
        />
      </button>

      <div
        v-if="activeDropdown === 'estabelecimento'"
        class="absolute top-full left-0 mt-2 w-56 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-xl shadow-lg z-50 overflow-hidden animate-scale-in"
      >
        <div class="p-2 border-b border-[var(--color-border-subtle)] flex justify-between text-xs">
          <button @click="selectAllEstabelecimentos" class="text-[var(--color-accent)] hover:underline">
            Selecionar todos
          </button>
          <button @click="clearEstabelecimentos" class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            Limpar
          </button>
        </div>
        <div class="max-h-48 overflow-y-auto">
          <button
            v-for="item in estabelecimentos"
            :key="item.id"
            @click="handleEstabelecimentoToggle(item.id)"
            class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <div
              :class="cn(
                'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                filters.centrosCusto.includes(item.id)
                  ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                  : 'border-[var(--color-border-secondary)]'
              )"
            >
              <Check v-if="filters.centrosCusto.includes(item.id)" :size="12" class="text-white" />
            </div>
            <span class="text-[var(--color-text-primary)]">{{ item.nome }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Date Filter -->
    <div class="relative">
      <button
        @click="activeDropdown = activeDropdown === 'date' ? null : 'date'"
        class="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border bg-[var(--color-bg-elevated)] border-[var(--color-border-primary)] text-[var(--color-text-primary)] hover:border-[var(--color-border-secondary)] transition-all duration-200"
      >
        <Calendar :size="14" class="text-[var(--color-text-muted)]" />
        <span class="text-[var(--color-accent)] font-medium">{{ dateLabel }}</span>
        <ChevronDown
          :size="14"
          :class="cn('transition-transform', activeDropdown === 'date' && 'rotate-180')"
        />
      </button>

      <div
        v-if="activeDropdown === 'date'"
        class="absolute top-full left-0 mt-2 w-80 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-xl shadow-lg z-50 overflow-hidden animate-scale-in"
      >
        <div class="p-3 border-b border-[var(--color-border-subtle)]">
          <div class="grid grid-cols-2 gap-1">
            <button
              v-for="preset in datePresets"
              :key="preset.label"
              @click="handleDatePreset(preset)"
              :class="cn(
                'px-3 py-2 text-xs rounded-lg transition-colors text-left',
                isDatePresetActive(preset)
                  ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium'
                  : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
              )"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>
        <div class="p-3 space-y-2">
          <p class="text-xs text-[var(--color-text-muted)] uppercase tracking-wide font-medium">Personalizado</p>
          <div class="grid grid-cols-2 gap-2">
            <input
              type="date"
              :value="filters.dataInicio"
              @input="handleDateChange('dataInicio', ($event.target as HTMLInputElement).value)"
              class="w-full px-2 py-2 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-light)]"
            />
            <input
              type="date"
              :value="filters.dataFim"
              @input="handleDateChange('dataFim', ($event.target as HTMLInputElement).value)"
              class="w-full px-2 py-2 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-light)]"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Profissional Filter -->
    <div v-if="showProfissional" class="relative">
      <button
        @click="activeDropdown = activeDropdown === 'profissional' ? null : 'profissional'"
        :class="cn(
          'inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all duration-200',
          filters.profissional
            ? 'bg-[var(--color-accent-light)] border-[var(--color-accent)] text-[var(--color-accent)]'
            : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-primary)] text-[var(--color-text-primary)] hover:border-[var(--color-border-secondary)]'
        )"
      >
        <span>Profissional</span>
        <span v-if="filters.profissional" class="max-w-24 truncate text-xs opacity-80">
          {{ profissionalLabel }}
        </span>
        <ChevronDown
          :size="14"
          :class="cn('transition-transform', activeDropdown === 'profissional' && 'rotate-180')"
        />
      </button>

      <div
        v-if="activeDropdown === 'profissional'"
        class="absolute top-full left-0 mt-2 w-56 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-xl shadow-lg z-50 overflow-hidden animate-scale-in"
      >
        <div class="max-h-48 overflow-y-auto">
          <button
            @click="handleProfissionalChange('')"
            :class="cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
              !filters.profissional ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
            )"
          >
            <div
              :class="cn(
                'w-4 h-4 rounded-full border flex items-center justify-center',
                !filters.profissional ? 'bg-[var(--color-accent)] border-[var(--color-accent)]' : 'border-[var(--color-border-secondary)]'
              )"
            >
              <div v-if="!filters.profissional" class="w-2 h-2 bg-white rounded-full" />
            </div>
            <span>Todos os profissionais</span>
          </button>
          <button
            v-for="item in profissionais"
            :key="item.id"
            @click="handleProfissionalChange(item.id)"
            :class="cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
              filters.profissional === item.id ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]' : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
            )"
          >
            <div
              :class="cn(
                'w-4 h-4 rounded-full border flex items-center justify-center',
                filters.profissional === item.id ? 'bg-[var(--color-accent)] border-[var(--color-accent)]' : 'border-[var(--color-border-secondary)]'
              )"
            >
              <div v-if="filters.profissional === item.id" class="w-2 h-2 bg-white rounded-full" />
            </div>
            <span>{{ item.nome }}</span>
          </button>
          <div v-if="profissionais.length === 0" class="px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
            Nenhum profissional disponivel
          </div>
        </div>
      </div>
    </div>

    <!-- Clear Filters -->
    <button
      v-if="hasFilters"
      @click="clearFilters"
      class="inline-flex items-center gap-1 px-2 py-2 text-xs text-[var(--color-text-muted)] hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
    >
      <X :size="14" />
      <span>Limpar filtros</span>
    </button>
  </div>
</template>
