<script setup lang="ts" generic="T extends Record<string, any>">
import { computed } from 'vue'
import { cn } from '@/utils/cn'

interface Column<T> {
  key: keyof T | string
  header: string
  render?: (value: any, row: T) => string
  class?: string
  headerClass?: string
  emphasis?: boolean // Highlight this column value
}

const props = withDefaults(defineProps<{
  columns: Column<T>[]
  data: T[]
  maxRows?: number
  showRowCount?: boolean
  emptyMessage?: string
  clickable?: boolean
  density?: 'compact' | 'normal' | 'comfortable'
  stickyHeader?: boolean
  maxHeight?: string
}>(), {
  maxRows: 10,
  showRowCount: true,
  emptyMessage: 'Nenhum dado disponível',
  clickable: false,
  density: 'normal',
  stickyHeader: false,
  maxHeight: 'auto',
})

const densityClasses = computed(() => {
  switch (props.density) {
    case 'compact':
      return { header: 'px-3 py-2', cell: 'px-3 py-2' }
    case 'comfortable':
      return { header: 'px-5 py-4', cell: 'px-5 py-4' }
    default:
      return { header: 'px-4 py-3', cell: 'px-4 py-3' }
  }
})

const emit = defineEmits<{
  (e: 'row-click', row: T): void
}>()

const displayData = computed(() => {
  return props.data.slice(0, props.maxRows)
})

function getValue(row: T, key: string | keyof T): any {
  const keys = String(key).split('.')
  let value: any = row
  for (const k of keys) {
    value = value?.[k]
  }
  return value
}
</script>

<template>
  <div class="card overflow-hidden">
    <div v-if="showRowCount" class="px-4 py-2.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-tertiary)]">
      <span class="text-xs text-[var(--color-text-muted)]">
        Mostrando {{ displayData.length }} de {{ data.length }} registros
      </span>
    </div>

    <div
      class="overflow-x-auto"
      :style="{ maxHeight: maxHeight !== 'auto' ? maxHeight : undefined }"
      :class="{ 'overflow-y-auto': maxHeight !== 'auto' }"
    >
      <table class="w-full">
        <thead :class="{ 'sticky top-0 z-10': stickyHeader }">
          <tr class="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
            <th
              v-for="column in columns"
              :key="String(column.key)"
              :class="cn(
                densityClasses.header,
                'text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap',
                stickyHeader && 'bg-[var(--color-bg-elevated)]',
                column.headerClass
              )"
            >
              {{ column.header }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--color-border-subtle)]">
          <tr
            v-for="(row, index) in displayData"
            :key="index"
            :class="cn(
              'transition-colors',
              clickable && 'cursor-pointer',
              'hover:bg-[var(--color-bg-hover)]'
            )"
            @click="clickable && emit('row-click', row)"
          >
            <td
              v-for="column in columns"
              :key="String(column.key)"
              :class="cn(
                densityClasses.cell,
                'text-sm',
                column.emphasis
                  ? 'text-[var(--color-text-primary)] font-semibold tabular-nums'
                  : 'text-[var(--color-text-secondary)]',
                column.class
              )"
            >
              <template v-if="column.render">
                {{ column.render(getValue(row, column.key), row) }}
              </template>
              <template v-else>
                {{ getValue(row, column.key) }}
              </template>
            </td>
          </tr>
          <tr v-if="displayData.length === 0">
            <td
              :colspan="columns.length"
              class="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]"
            >
              {{ emptyMessage }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
