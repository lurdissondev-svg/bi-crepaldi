<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { formatCurrency, formatCompactNumber } from '@/utils/format'

interface DataPoint {
  name: string
  value: number
  [key: string]: number | string
}

const props = withDefaults(defineProps<{
  title: string
  data: DataPoint[]
  dataKey?: string
  xAxisKey?: string
  color?: string
  colors?: string[]
  showGrid?: boolean
  horizontal?: boolean
  height?: number
  formatYAxis?: 'currency' | 'number' | 'compact'
  showLabels?: boolean
}>(), {
  dataKey: 'value',
  xAxisKey: 'name',
  color: '#60a5fa',
  showGrid: true,
  horizontal: false,
  height: 300,
  formatYAxis: 'compact',
  showLabels: true,
})

const themeStore = useThemeStore()

const formatValue = (value: number) => {
  switch (props.formatYAxis) {
    case 'currency':
      return formatCurrency(value)
    case 'compact':
      return formatCompactNumber(value)
    default:
      return value.toLocaleString('pt-BR')
  }
}

const series = computed(() => [{
  name: props.title,
  data: props.data.map(item => item[props.dataKey] as number)
}])

const chartOptions = computed(() => ({
  chart: {
    type: props.horizontal ? 'bar' : 'bar',
    toolbar: { show: false },
    background: 'transparent',
  },
  plotOptions: {
    bar: {
      horizontal: props.horizontal,
      borderRadius: 4,
      columnWidth: '60%',
      dataLabels: {
        position: props.horizontal ? 'right' : 'top',
      },
    },
  },
  colors: props.colors || [props.color],
  dataLabels: {
    enabled: props.showLabels,
    formatter: (val: number) => formatValue(val),
    style: {
      fontSize: '11px',
      colors: ['#94a3b8'],
    },
    offsetY: props.horizontal ? 0 : -20,
  },
  grid: {
    show: props.showGrid,
    borderColor: themeStore.theme === 'dark' ? '#334155' : '#e2e8f0',
    strokeDashArray: 3,
  },
  xaxis: {
    categories: props.data.map(item => item[props.xAxisKey]),
    labels: {
      style: {
        colors: themeStore.theme === 'dark' ? '#64748b' : '#475569',
        fontSize: '11px',
      },
      rotate: props.horizontal ? 0 : -45,
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: {
        colors: themeStore.theme === 'dark' ? '#64748b' : '#475569',
        fontSize: '12px',
      },
      formatter: (val: number) => formatValue(val),
    },
  },
  tooltip: {
    theme: themeStore.theme,
    y: {
      formatter: (val: number) => formatValue(val),
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
      type="bar"
      :height="height"
      :options="chartOptions"
      :series="series"
    />
  </div>
</template>
