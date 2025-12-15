<script setup lang="ts" generic="T extends Record<string, any>">
import { computed } from 'vue'
import { cn } from '@/utils/cn'

interface Column<T> {
  key: keyof T | string
  header: string
  render?: (value: any, row: T) => string
  class?: string
  headerClass?: string
}

const props = withDefaults(defineProps<{
  columns: Column<T>[]
  data: T[]
  maxRows?: number
  showRowCount?: boolean
  emptyMessage?: string
  clickable?: boolean
}>(), {
  maxRows: 10,
  showRowCount: true,
  emptyMessage: 'Nenhum dado disponível',
  clickable: false,
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
    <div v-if="showRowCount" class="px-4 py-3 border-b border-[var(--color-border-subtle)]">
      <span class="text-sm text-[var(--color-text-muted)]">
        Mostrando {{ displayData.length }} de {{ data.length }} registros
      </span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-[var(--color-border-subtle)]">
            <th
              v-for="column in columns"
              :key="String(column.key)"
              :class="cn(
                'px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider',
                column.headerClass
              )"
            >
              {{ column.header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in displayData"
            :key="index"
            :class="cn(
              'border-b border-[var(--color-border-subtle)] last:border-0',
              clickable && 'cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors'
            )"
            @click="clickable && emit('row-click', row)"
          >
            <td
              v-for="column in columns"
              :key="String(column.key)"
              :class="cn('px-4 py-3 text-sm text-[var(--color-text-primary)]', column.class)"
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
