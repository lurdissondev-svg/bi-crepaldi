<script setup lang="ts">
import { formatCurrency, formatCompactNumber } from '@/utils/format'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{
  value: number
  label: string
  format?: 'number' | 'currency' | 'percentage' | 'compact'
  size?: 'sm' | 'md' | 'lg'
  class?: string
  clickable?: boolean
}>(), {
  format: 'number',
  size: 'md',
  clickable: false,
})

const emit = defineEmits<{
  (e: 'click'): void
}>()

function formatValue(value: number): string {
  switch (props.format) {
    case 'currency':
      return formatCurrency(value)
    case 'compact':
      return formatCompactNumber(value)
    case 'percentage':
      return `${value.toFixed(1)}%`
    default:
      return value.toLocaleString('pt-BR')
  }
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
}
</script>

<template>
  <div
    :class="cn(
      'p-4 rounded-lg bg-[var(--color-bg-tertiary)]',
      clickable && 'cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors',
      $props.class
    )"
    @click="clickable && emit('click')"
  >
    <p :class="['font-bold text-[var(--color-text-primary)]', sizeClasses[size]]">
      {{ formatValue(value) }}
    </p>
    <p class="text-sm text-[var(--color-text-muted)] mt-1">{{ label }}</p>
  </div>
</template>
