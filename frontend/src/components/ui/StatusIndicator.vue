<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { CheckCircle, AlertCircle, XCircle, Settings, RefreshCw } from 'lucide-vue-next'
import api from '@/services/api'

interface IntegrationStatus {
  status: string
  message: string
}

interface HealthData {
  status: string
  timestamp: string
  uptime: number
  integrations: {
    bitrix24: IntegrationStatus
    belle: IntegrationStatus
    metaAds: IntegrationStatus
  }
}

const STATUS_CONFIG = {
  connected: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500' },
  warning: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500' },
  not_configured: { icon: Settings, color: 'text-[var(--color-text-muted)]', bg: 'bg-[var(--color-text-muted)]' },
  pending: { icon: Settings, color: 'text-amber-500', bg: 'bg-amber-500' },
  unknown: { icon: AlertCircle, color: 'text-[var(--color-text-muted)]', bg: 'bg-[var(--color-text-muted)]' },
}

const labels: Record<string, string> = {
  bitrix24: 'Bitrix24 CRM',
  belle: 'Belle Software',
  metaAds: 'Meta Ads',
}

const health = ref<HealthData | null>(null)
const loading = ref(true)
const showDetails = ref(false)
let interval: ReturnType<typeof setInterval> | null = null

async function fetchHealth() {
  try {
    loading.value = true
    const data = await api.getDetailedHealth()
    health.value = data
  } catch (error) {
    console.error('Failed to fetch health status:', error)
    health.value = null
  } finally {
    loading.value = false
  }
}

function getStatusIndicator(status: string) {
  return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.unknown
}

const overallStatusColor = computed(() => {
  if (!health.value) return 'bg-[var(--color-text-muted)]'
  if (health.value.status === 'healthy') return 'bg-emerald-500'
  if (health.value.status === 'degraded') return 'bg-amber-500'
  return 'bg-red-500'
})

const statusText = computed(() => {
  if (health.value?.status === 'healthy') return 'Sistema OK'
  if (health.value?.status === 'degraded') return 'Parcial'
  return 'Problema'
})

const integrationsList = computed(() => {
  if (!health.value?.integrations) return []
  return Object.entries(health.value.integrations).map(([key, value]) => ({
    key,
    label: labels[key] || key,
    ...value,
    config: getStatusIndicator(value.status),
  }))
})

function handleRefresh(e: Event) {
  e.stopPropagation()
  fetchHealth()
}

onMounted(() => {
  fetchHealth()
  interval = setInterval(fetchHealth, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<template>
  <div class="relative">
    <template v-if="loading && !health">
      <div class="flex items-center gap-2 px-2 py-1">
        <RefreshCw :size="14" class="animate-spin text-[var(--color-text-muted)]" />
      </div>
    </template>

    <template v-else>
      <button
        @click="showDetails = !showDetails"
        class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        <span :class="['w-2 h-2 rounded-full shadow-sm', overallStatusColor]" />
        <span class="text-xs text-[var(--color-text-secondary)]">{{ statusText }}</span>
      </button>

      <div
        v-if="showDetails && health"
        class="absolute right-0 top-full mt-2 w-72 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-xl shadow-lg z-50 p-4 animate-scale-in"
      >
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold text-[var(--color-text-primary)]">Status das Integracoes</h4>
          <button
            @click="handleRefresh"
            class="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <RefreshCw :size="14" :class="['text-[var(--color-text-muted)]', { 'animate-spin': loading }]" />
          </button>
        </div>

        <div class="space-y-1">
          <div
            v-for="item in integrationsList"
            :key="item.key"
            class="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <div class="flex items-center gap-2">
              <component :is="item.config.icon" :size="16" :class="item.config.color" />
              <span class="text-sm text-[var(--color-text-primary)]">{{ item.label }}</span>
            </div>
            <span class="text-xs text-[var(--color-text-muted)]">{{ item.message }}</span>
          </div>
        </div>

        <div class="mt-3 pt-3 border-t border-[var(--color-border-subtle)] text-xs text-[var(--color-text-muted)]">
          <p>Uptime: {{ Math.floor(health.uptime / 60) }} min</p>
          <p>Atualizado: {{ new Date(health.timestamp).toLocaleTimeString('pt-BR') }}</p>
        </div>
      </div>
    </template>
  </div>
</template>
