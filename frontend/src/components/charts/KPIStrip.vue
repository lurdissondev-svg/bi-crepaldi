<script setup lang="ts">
import { computed } from 'vue'
import { TrendingUp, TrendingDown, Minus } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'

export interface KPIItem {
  id: string
  label: string
  value: number
  previousValue?: number
  format?: 'currency' | 'number' | 'percentage' | 'days' | 'multiplier'
  color?: 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'info'
  subtitle?: string
  tooltip?: string
  icon?: any
}

const props = withDefaults(defineProps<{
  items: KPIItem[]
  layout?: 'row' | 'grid'
  primaryCount?: number // Number of primary (large) KPIs, rest are secondary
}>(), {
  layout: 'row',
  primaryCount: 1,
})

function formatValue(value: number, format: string = 'number'): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value)
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'days':
      return `${value.toFixed(0)} dias`
    case 'multiplier':
      return `${value.toFixed(2)}x`
    default:
      return value.toLocaleString('pt-BR')
  }
}

function calculateDelta(current: number, previous?: number): { value: number; type: 'positive' | 'negative' | 'neutral' } | null {
  if (previous === undefined || previous === 0) return null
  const delta = ((current - previous) / previous) * 100
  return {
    value: Math.abs(delta),
    type: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral'
  }
}

const colorClasses = {
  default: 'text-[var(--color-text-primary)]',
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
  accent: 'text-[var(--color-accent)]',
  info: 'text-[var(--color-info)]',
}

const primaryItems = computed(() => props.items.slice(0, props.primaryCount))
const secondaryItems = computed(() => props.items.slice(props.primaryCount))
</script>

<template>
  <div class="kpi-strip-container">
    <!-- Primary KPIs - Larger, more prominent -->
    <div v-if="primaryItems.length > 0" class="grid gap-4" :class="[
      primaryItems.length === 1 ? 'grid-cols-1' :
      primaryItems.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
      'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    ]">
      <div
        v-for="item in primaryItems"
        :key="item.id"
        class="kpi-primary"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <p class="kpi-primary-label">{{ item.label }}</p>
            <p :class="['kpi-primary-value', colorClasses[item.color || 'default']]">
              {{ formatValue(item.value, item.format) }}
            </p>
            <p v-if="item.subtitle" class="kpi-primary-subtitle">{{ item.subtitle }}</p>

            <!-- Delta chip -->
            <div v-if="calculateDelta(item.value, item.previousValue)" class="mt-3">
              <span :class="[
                'delta-chip',
                calculateDelta(item.value, item.previousValue)?.type === 'positive' ? 'delta-chip-positive' :
                calculateDelta(item.value, item.previousValue)?.type === 'negative' ? 'delta-chip-negative' :
                'delta-chip-neutral'
              ]">
                <TrendingUp v-if="calculateDelta(item.value, item.previousValue)?.type === 'positive'" class="w-3 h-3" />
                <TrendingDown v-else-if="calculateDelta(item.value, item.previousValue)?.type === 'negative'" class="w-3 h-3" />
                <Minus v-else class="w-3 h-3" />
                {{ calculateDelta(item.value, item.previousValue)?.value.toFixed(1) }}%
              </span>
              <span class="text-xs text-[var(--color-text-muted)] ml-2">vs período anterior</span>
            </div>
          </div>

          <div v-if="item.icon" class="p-3 rounded-xl bg-[var(--color-bg-tertiary)] ml-4">
            <component :is="item.icon" class="w-6 h-6 text-[var(--color-text-muted)]" />
          </div>
        </div>
      </div>
    </div>

    <!-- Secondary KPIs - Smaller, grid layout -->
    <div
      v-if="secondaryItems.length > 0"
      class="grid gap-4 mt-4"
      :class="[
        secondaryItems.length === 1 ? 'grid-cols-1' :
        secondaryItems.length === 2 ? 'grid-cols-2' :
        secondaryItems.length === 3 ? 'grid-cols-2 lg:grid-cols-3' :
        'grid-cols-2 lg:grid-cols-4'
      ]"
    >
      <div
        v-for="item in secondaryItems"
        :key="item.id"
        class="kpi-secondary"
      >
        <div class="flex items-center gap-2 mb-1">
          <component v-if="item.icon" :is="item.icon" class="w-4 h-4 text-[var(--color-text-muted)]" />
          <p class="kpi-secondary-label truncate">{{ item.label }}</p>
        </div>
        <p :class="['kpi-secondary-value', colorClasses[item.color || 'default']]">
          {{ formatValue(item.value, item.format) }}
        </p>

        <!-- Delta chip for secondary -->
        <div v-if="calculateDelta(item.value, item.previousValue)" class="mt-2">
          <span :class="[
            'delta-chip',
            calculateDelta(item.value, item.previousValue)?.type === 'positive' ? 'delta-chip-positive' :
            calculateDelta(item.value, item.previousValue)?.type === 'negative' ? 'delta-chip-negative' :
            'delta-chip-neutral'
          ]">
            <TrendingUp v-if="calculateDelta(item.value, item.previousValue)?.type === 'positive'" class="w-3 h-3" />
            <TrendingDown v-else-if="calculateDelta(item.value, item.previousValue)?.type === 'negative'" class="w-3 h-3" />
            {{ calculateDelta(item.value, item.previousValue)?.value.toFixed(1) }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kpi-strip-container {
  @apply w-full;
}
</style>
