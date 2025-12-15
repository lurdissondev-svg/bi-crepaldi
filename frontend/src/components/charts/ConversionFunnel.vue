<script setup lang="ts">
import { computed } from 'vue'
import { formatCompactNumber } from '@/utils/format'

interface FunnelStage {
  name: string
  value: number
  conversion?: number
}

const props = withDefaults(defineProps<{
  title: string
  data: FunnelStage[]
  height?: number
  showLabels?: boolean
}>(), {
  height: 300,
  showLabels: true,
})

const maxValue = computed(() => Math.max(...props.data.map(d => d.value)))

function getPercentage(value: number): number {
  return (value / maxValue.value) * 100
}

function getConversionColor(conversion?: number): string {
  if (!conversion) return 'text-[var(--color-text-muted)]'
  if (conversion >= 80) return 'text-green-400'
  if (conversion >= 50) return 'text-yellow-400'
  return 'text-red-400'
}
</script>

<template>
  <div class="card">
    <h3 class="card-header">{{ title }}</h3>
    <div class="space-y-3 p-4" :style="{ minHeight: `${height}px` }">
      <div
        v-for="(stage, index) in data"
        :key="stage.name"
        class="relative"
      >
        <div class="flex items-center gap-4">
          <div class="w-32 text-sm text-[var(--color-text-secondary)] truncate">
            {{ stage.name }}
          </div>
          <div class="flex-1 relative">
            <div
              class="h-10 bg-[var(--color-accent)] rounded-r-lg transition-all duration-500"
              :style="{ width: `${getPercentage(stage.value)}%`, minWidth: '40px' }"
            >
              <span
                v-if="showLabels"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-white"
              >
                {{ formatCompactNumber(stage.value) }}
              </span>
            </div>
          </div>
          <div
            v-if="stage.conversion !== undefined"
            :class="['w-16 text-right text-sm font-medium', getConversionColor(stage.conversion)]"
          >
            {{ stage.conversion.toFixed(1) }}%
          </div>
        </div>

        <!-- Connection Arrow -->
        <div
          v-if="index < data.length - 1"
          class="flex justify-center py-1"
        >
          <svg class="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>
