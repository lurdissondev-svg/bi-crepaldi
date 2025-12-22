<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RefreshCw, Clock, CheckCircle, AlertTriangle, XCircle, Zap } from 'lucide-vue-next'
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
const countdownSeconds = ref<number>(0)
const showDetails = ref(false)
const isTriggering = ref(false)
const triggerMessage = ref<string | null>(null)

let statusInterval: ReturnType<typeof setInterval> | null = null
let countdownInterval: ReturnType<typeof setInterval> | null = null
let lastSyncInterval: ReturnType<typeof setInterval> | null = null

async function fetchSyncStatus() {
  try {
    const status = await api.getSyncStatus()
    syncStatus.value = status

    // Limpa mensagem de sucesso quando o sync terminar
    if (!status.isRunning && triggerMessage.value) {
      setTimeout(() => {
        triggerMessage.value = null
      }, 3000)
    }
  } catch (error) {
    console.error('Failed to fetch sync status:', error)
  }
}

async function triggerManualSync() {
  if (isTriggering.value || syncStatus.value?.isRunning) return

  isTriggering.value = true
  triggerMessage.value = null

  try {
    await api.triggerManualSync()
    triggerMessage.value = 'Sincronizacao iniciada!'

    // Aguarda um pouco e busca o status atualizado
    setTimeout(async () => {
      await fetchSyncStatus()
      isTriggering.value = false
    }, 1000)

    // Poll mais frequente durante o sync
    const pollInterval = setInterval(async () => {
      await fetchSyncStatus()
      if (!syncStatus.value?.isRunning) {
        clearInterval(pollInterval)
        triggerMessage.value = 'Sincronizacao concluida!'
      }
    }, 2000)

    // Timeout de seguranca para parar o poll
    setTimeout(() => clearInterval(pollInterval), 120000)

  } catch (error) {
    console.error('Failed to trigger sync:', error)
    triggerMessage.value = 'Erro ao iniciar sincronizacao'
    isTriggering.value = false
  }
}

const statusIcon = computed(() => {
  if (syncStatus.value?.isRunning || isTriggering.value) {
    return { component: RefreshCw, class: 'animate-spin text-[var(--color-accent)]' }
  }

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
  if (isTriggering.value) return 'Iniciando...'
  if (syncStatus.value?.isRunning) return 'Sincronizando'
  switch (syncStatus.value?.lastSyncStatus) {
    case 'success': return 'Atualizado'
    case 'partial': return 'Parcial'
    case 'error': return 'Erro'
    default: return 'Aguardando'
  }
})

const progressPercentage = computed(() => {
  if (!syncStatus.value?.intervalMinutes) return 0
  const totalSeconds = syncStatus.value.intervalMinutes * 60
  const remaining = countdownSeconds.value
  return Math.max(0, Math.min(100, ((totalSeconds - remaining) / totalSeconds) * 100))
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

const lastSyncRelative = ref<string>('--')

function updateLastSyncRelative() {
  if (!syncStatus.value?.lastSyncAt) {
    lastSyncRelative.value = '--'
    return
  }

  const now = new Date()
  const last = new Date(syncStatus.value.lastSyncAt)
  const diffMs = now.getTime() - last.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) {
    lastSyncRelative.value = 'agora'
  } else if (diffMin < 60) {
    lastSyncRelative.value = `ha ${diffMin} min`
  } else {
    const diffHours = Math.floor(diffMin / 60)
    lastSyncRelative.value = `ha ${diffHours}h`
  }
}

function updateCountdown() {
  if (!syncStatus.value?.nextSyncAt) {
    countdown.value = '--:--'
    countdownSeconds.value = 0
    return
  }

  const now = new Date()
  const next = new Date(syncStatus.value.nextSyncAt)
  const diff = next.getTime() - now.getTime()

  if (diff <= 0) {
    countdown.value = 'Atualizando...'
    countdownSeconds.value = 0
    setTimeout(fetchSyncStatus, 5000)
    return
  }

  countdownSeconds.value = Math.floor(diff / 1000)
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

watch(
  () => syncStatus.value?.lastSyncAt,
  () => {
    if (lastSyncInterval) clearInterval(lastSyncInterval)
    updateLastSyncRelative()
    // Update relative time every minute
    lastSyncInterval = setInterval(updateLastSyncRelative, 60000)
  }
)

onMounted(() => {
  fetchSyncStatus()
  statusInterval = setInterval(fetchSyncStatus, 30000)
})

onUnmounted(() => {
  if (statusInterval) clearInterval(statusInterval)
  if (countdownInterval) clearInterval(countdownInterval)
  if (lastSyncInterval) clearInterval(lastSyncInterval)
})
</script>

<template>
  <div class="relative">
    <button
      @click="showDetails = !showDetails"
      class="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
      title="Status da sincronizacao"
    >
      <component :is="statusIcon.component" :size="14" :class="statusIcon.class" />
      <div class="flex flex-col items-start">
        <span class="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
          {{ statusLabel }} {{ lastSyncRelative !== '--' ? lastSyncRelative : '' }}
        </span>
        <div class="flex items-center gap-2">
          <span class="text-xs text-[var(--color-text-secondary)]">
            {{ syncStatus?.isRunning ? 'Sincronizando...' : `Prox. em ${countdown}` }}
          </span>
        </div>
      </div>
    </button>

    <div
      v-if="showDetails"
      class="absolute right-0 top-full mt-2 w-72 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-xl shadow-lg z-50 p-4 animate-scale-in"
    >
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-semibold text-[var(--color-text-primary)]">Sincronizacao</h4>
        <button
          @click="handleRefresh"
          class="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
          title="Atualizar status"
        >
          <RefreshCw :size="14" class="text-[var(--color-text-muted)]" />
        </button>
      </div>

      <!-- Botao Atualizar Agora -->
      <button
        @click="triggerManualSync"
        :disabled="isTriggering || syncStatus?.isRunning"
        class="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all"
        :class="[
          isTriggering || syncStatus?.isRunning
            ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
            : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-sm hover:shadow-md'
        ]"
      >
        <Zap v-if="!isTriggering && !syncStatus?.isRunning" :size="16" />
        <RefreshCw v-else :size="16" class="animate-spin" />
        <span>
          {{ isTriggering ? 'Iniciando...' : syncStatus?.isRunning ? 'Sincronizando...' : 'Atualizar Agora' }}
        </span>
      </button>

      <!-- Mensagem de feedback -->
      <div
        v-if="triggerMessage"
        class="mb-3 px-3 py-2 rounded-lg text-xs font-medium text-center"
        :class="[
          triggerMessage.includes('Erro')
            ? 'bg-red-500/10 text-red-500'
            : 'bg-emerald-500/10 text-emerald-500'
        ]"
      >
        {{ triggerMessage }}
      </div>

      <!-- Progress bar -->
      <div v-if="!syncStatus?.isRunning && syncStatus?.intervalMinutes" class="mb-4">
        <div class="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
          <span>Proxima atualizacao</span>
          <span class="font-mono">{{ countdown }}</span>
        </div>
        <div class="h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <div
            class="h-full bg-[var(--color-accent)] transition-all duration-1000 ease-linear rounded-full"
            :style="{ width: `${progressPercentage}%` }"
          />
        </div>
      </div>

      <!-- Sync running indicator -->
      <div v-if="syncStatus?.isRunning" class="mb-4">
        <div class="flex items-center gap-2 text-xs text-[var(--color-accent)] mb-2">
          <RefreshCw :size="12" class="animate-spin" />
          <span>Sincronizando dados...</span>
        </div>
        <div class="h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <div class="h-full bg-[var(--color-accent)] rounded-full animate-pulse w-full" />
        </div>
        <p class="text-[10px] text-[var(--color-text-muted)] mt-2">
          A sincronizacao inicial pode levar alguns minutos. Os dados serao atualizados automaticamente.
        </p>
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
          Os dados sao atualizados automaticamente a cada {{ syncStatus?.intervalMinutes || 5 }} minutos.
          Use o botao acima para atualizar instantaneamente.
        </p>
      </div>
    </div>
  </div>
</template>
