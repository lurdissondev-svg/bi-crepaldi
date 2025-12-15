<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RefreshCw, Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-vue-next'
import api from '@/services/api'

interface SyncStatus {
  isRunning: boolean
  lastSyncAt: string | null
  nextSyncAt: string | null
  lastSyncStatus: 'success' | 'partial' | 'error' | null
  intervalMinutes: number
}

const syncStatus = ref<SyncStatus | null>(null)
const countdown = ref<string>('--:--')
const showDetails = ref(false)

let statusInterval: ReturnType<typeof setInterval> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null

async function fetchSyncStatus() {
  try {
    const status = await api.getSyncStatus()
    syncStatus.value = status
  } catch (error) {
    console.error('Failed to fetch sync status:', error)
  }
}

const statusIcon = computed(() => {
  if (syncStatus.value?.isRunning) return { component: RefreshCw, class: 'animate-spin text-[var(--color-accent)]' }

  switch (syncStatus.value?.lastSyncStatus) {
    case 'success':
      return { component: CheckCircle, class: 'text-emerald-500' }
    case 'partial':
      return { component: AlertTriangle, class: 'text-amber-500' }
    case 'error':
      return { component: XCircle, class: 'text-red-500' }
    default:
      return { component: Clock, class: 'text-[var(--color-text-muted)]' }
  }
})

const statusLabel = computed(() => {
  if (syncStatus.value?.isRunning) return 'Em andamento'
  switch (syncStatus.value?.lastSyncStatus) {
    case 'success': return 'Sucesso'
    case 'partial': return 'Parcial'
    case 'error': return 'Erro'
    default: return 'Aguardando'
  }
})

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function updateCountdown() {
  if (!syncStatus.value?.nextSyncAt) {
    countdown.value = '--:--'
    return
  }

  const now = new Date()
  const next = new Date(syncStatus.value.nextSyncAt)
  const diff = next.getTime() - now.getTime()

  if (diff <= 0) {
    countdown.value = 'Atualizando...'
    setTimeout(fetchSyncStatus, 5000)
    return
  }

  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  countdown.value = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function handleRefresh(e: Event) {
  e.stopPropagation()
  fetchSyncStatus()
}

watch(
  () => syncStatus.value?.nextSyncAt,
  () => {
    if (countdownInterval) clearInterval(countdownInterval)
    updateCountdown()
    countdownInterval = setInterval(updateCountdown, 1000)
  }
)

onMounted(() => {
  fetchSyncStatus()
  statusInterval = setInterval(fetchSyncStatus, 30000)
})

onUnmounted(() => {
  if (statusInterval) clearInterval(statusInterval)
  if (countdownInterval) clearInterval(countdownInterval)
})
</script>

<template>
  <div class="relative">
    <button
      @click="showDetails = !showDetails"
      class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
      title="Status da sincronizacao"
    >
      <component :is="statusIcon.component" :size="14" :class="statusIcon.class" />
      <div class="flex flex-col items-start">
        <span class="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
          Prox. Atualizacao
        </span>
        <span class="text-sm font-mono text-[var(--color-text-primary)]">
          {{ syncStatus?.isRunning ? 'Sincronizando...' : countdown }}
        </span>
      </div>
    </button>

    <div
      v-if="showDetails"
      class="absolute right-0 top-full mt-2 w-64 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-xl shadow-lg z-50 p-4 animate-scale-in"
    >
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-semibold text-[var(--color-text-primary)]">Sincronizacao</h4>
        <button
          @click="handleRefresh"
          class="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <RefreshCw :size="14" class="text-[var(--color-text-muted)]" />
        </button>
      </div>

      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-xs text-[var(--color-text-muted)]">Status</span>
          <span class="text-xs text-[var(--color-text-primary)] flex items-center gap-1">
            <component :is="statusIcon.component" :size="14" :class="statusIcon.class" />
            {{ statusLabel }}
          </span>
        </div>

        <div class="flex justify-between items-center">
          <span class="text-xs text-[var(--color-text-muted)]">Ultima Sync</span>
          <span class="text-xs text-[var(--color-text-primary)]">
            {{ formatDateTime(syncStatus?.lastSyncAt || null) }}
          </span>
        </div>

        <div class="flex justify-between items-center">
          <span class="text-xs text-[var(--color-text-muted)]">Proxima Sync</span>
          <span class="text-xs text-[var(--color-text-primary)]">
            {{ formatDateTime(syncStatus?.nextSyncAt || null) }}
          </span>
        </div>

        <div class="flex justify-between items-center">
          <span class="text-xs text-[var(--color-text-muted)]">Intervalo</span>
          <span class="text-xs text-[var(--color-text-primary)]">
            {{ syncStatus?.intervalMinutes || '--' }} minutos
          </span>
        </div>
      </div>

      <div class="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
        <p class="text-[10px] text-[var(--color-text-muted)]">
          Os dados sao atualizados automaticamente a cada {{ syncStatus?.intervalMinutes || 15 }} minutos.
        </p>
      </div>
    </div>
  </div>
</template>
