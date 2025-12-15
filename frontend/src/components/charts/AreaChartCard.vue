<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { formatCurrency, formatCompactNumber } from '@/utils/format'

interface DataKey {
  key: string
  color: string
  name: string
}

interface DataPoint {
  name: string
  [key: string]: number | string
}

const props = withDefaults(defineProps<{
  title: string
  data: DataPoint[]
  dataKeys: DataKey[]
  height?: number
  formatYAxis?: 'currency' | 'number' | 'compact'
  showGrid?: boolean
}>(), {
  height: 300,
  formatYAxis: 'compact',
  showGrid: true,
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

const series = computed(() =>
  props.dataKeys.map(dk => ({
    name: dk.name,
    data: props.data.map(item => item[dk.key] as number),
  }))
)

const chartOptions = computed(() => ({
  chart: {
    type: 'area',
    toolbar: { show: false },
    background: 'transparent',
  },
  colors: props.dataKeys.map(dk => dk.color),
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.4,
      opacityTo: 0.1,
      stops: [0, 100],
    },
  },
  stroke: {
    curve: 'smooth',
    width: 2,
  },
  grid: {
    show: props.showGrid,
    borderColor: themeStore.theme === 'dark' ? '#334155' : '#e2e8f0',
    strokeDashArray: 3,
  },
  xaxis: {
    categories: props.data.map(item => item.name),
    labels: {
      style: {
        colors: themeStore.theme === 'dark' ? '#64748b' : '#475569',
        fontSize: '11px',
      },
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
  legend: {
    position: 'top',
    horizontalAlign: 'right',
    labels: {
      colors: themeStore.theme === 'dark' ? '#94a3b8' : '#475569',
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
      type="area"
      :height="height"
      :options="chartOptions"
      :series="series"
    />
  </div>
</template>
