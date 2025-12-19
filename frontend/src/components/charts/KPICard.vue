<script setup lang="ts">
import { computed } from 'vue'
import { TrendingUp, TrendingDown } from 'lucide-vue-next'
import { formatCurrency } from '@/utils/format'

const props = withDefaults(defineProps<{
  title: string
  value: number
  previousValue?: number
  format?: 'number' | 'currency' | 'percentage' | 'days'
  icon?: any
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple'
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
}>(), {
  format: 'number',
  color: 'blue',
})

const colorClasses = {
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-green-500/20 text-green-400',
  red: 'bg-red-500/20 text-red-400',
  yellow: 'bg-yellow-500/20 text-yellow-400',
  purple: 'bg-purple-500/20 text-purple-400',
}

function formatKPIValue(value: number, format: string = 'number'): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value)
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'days':
      return `${value.toFixed(0)} dias`
    default:
      return value.toLocaleString('pt-BR')
  }
}

const variation = computed(() => {
  if (props.previousValue === undefined || props.previousValue === 0) return null
  return ((props.value - props.previousValue) / props.previousValue) * 100
})

const isPositive = computed(() => {
  if (variation.value !== null) return variation.value >= 0
  return props.trend === 'up'
})

const showVariation = computed(() => variation.value !== null || props.trend)
</script>

<template>
  <div class="card p-4">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <p class="text-sm text-[var(--color-text-muted)] mb-1">{{ title }}</p>
        <p class="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
          {{ formatKPIValue(value, format) }}
        </p>
        <p v-if="subtitle" class="text-xs text-[var(--color-text-muted)] mt-1">{{ subtitle }}</p>
      </div>

      <div v-if="icon" :class="['p-3 rounded-lg', colorClasses[color]]">
        <component :is="icon" :size="24" />
      </div>
    </div>

    <div v-if="showVariation" class="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
      <div class="flex items-center justify-between">
        <span class="text-xs text-[var(--color-text-muted)]">
          {{ previousValue !== undefined ? 'vs período anterior' : 'tendência' }}
        </span>
        <span
          :class="[
            'flex items-center text-sm font-medium',
            isPositive ? 'text-green-400' : 'text-red-400'
          ]"
        >
          <TrendingUp v-if="isPositive" :size="16" class="mr-1" />
          <TrendingDown v-else :size="16" class="mr-1" />
          {{ variation !== null ? `${Math.abs(variation).toFixed(1)}%` : (isPositive ? 'Alta' : 'Baixa') }}
        </span>
      </div>
      <p v-if="previousValue !== undefined" class="text-xs text-[var(--color-text-muted)] mt-1">
        Anterior: {{ formatKPIValue(previousValue, format) }}
      </p>
    </div>
  </div>
</template>
