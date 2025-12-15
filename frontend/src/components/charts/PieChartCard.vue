<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { formatCurrency, formatCompactNumber } from '@/utils/format'

interface DataPoint {
  name: string
  value: number
}

const props = withDefaults(defineProps<{
  title: string
  data: DataPoint[]
  colors?: string[]
  height?: number
  format?: 'currency' | 'number' | 'compact' | 'percentage'
}>(), {
  height: 300,
  format: 'number',
})

const themeStore = useThemeStore()

const defaultColors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6']

const formatValue = (value: number) => {
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

const series = computed(() => props.data.map(item => item.value))
const labels = computed(() => props.data.map(item => item.name))

const chartOptions = computed(() => ({
  chart: {
    type: 'pie',
    background: 'transparent',
  },
  labels: labels.value,
  colors: props.colors || defaultColors,
  legend: {
    position: 'bottom',
    labels: {
      colors: themeStore.theme === 'dark' ? '#94a3b8' : '#475569',
    },
  },
  tooltip: {
    theme: themeStore.theme,
    y: {
      formatter: (val: number) => formatValue(val),
    },
  },
  dataLabels: {
    enabled: true,
    formatter: (val: number) => `${val.toFixed(1)}%`,
    style: {
      fontSize: '12px',
      fontWeight: 'bold',
    },
  },
  theme: {
    mode: themeStore.theme,
  },
}))
</script>

<template>
  <div class="card">
    <h3 class="card-header">{{ title }}</h3>
    <apexchart
      type="pie"
      :height="height"
      :options="chartOptions"
      :series="series"
    />
  </div>
</template>
