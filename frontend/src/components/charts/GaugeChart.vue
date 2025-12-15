<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'

const props = withDefaults(defineProps<{
  title: string
  value: number
  max?: number
  height?: number
  color?: string
  label?: string
}>(), {
  max: 100,
  height: 200,
  color: '#60a5fa',
})

const themeStore = useThemeStore()

const percentage = computed(() => Math.min((props.value / props.max) * 100, 100))

const series = computed(() => [percentage.value])

const chartOptions = computed(() => ({
  chart: {
    type: 'radialBar',
    background: 'transparent',
  },
  plotOptions: {
    radialBar: {
      startAngle: -135,
      endAngle: 135,
      hollow: {
        size: '70%',
      },
      track: {
        background: themeStore.theme === 'dark' ? '#334155' : '#e2e8f0',
        strokeWidth: '100%',
      },
      dataLabels: {
        name: {
          show: !!props.label,
          fontSize: '14px',
          color: themeStore.theme === 'dark' ? '#94a3b8' : '#475569',
          offsetY: 20,
        },
        value: {
          show: true,
          fontSize: '24px',
          fontWeight: 'bold',
          color: themeStore.theme === 'dark' ? '#f1f5f9' : '#1e293b',
          offsetY: -10,
          formatter: () => `${percentage.value.toFixed(0)}%`,
        },
      },
    },
  },
  colors: [props.color],
  labels: [props.label || ''],
  theme: {
    mode: themeStore.theme,
  },
}))
</script>

<template>
  <div class="card">
    <h3 class="card-header">{{ title }}</h3>
    <apexchart
      type="radialBar"
      :height="height"
      :options="chartOptions"
      :series="series"
    />
  </div>
</template>
