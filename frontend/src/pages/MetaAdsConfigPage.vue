<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Settings, Save, CheckCircle, AlertCircle } from 'lucide-vue-next'
import api from '@/services/api'

const config = ref({
  accessToken: '',
  adAccountId: '',
})

const loading = ref(false)
const saving = ref(false)
const message = ref<{ type: 'success' | 'error', text: string } | null>(null)

async function loadConfig() {
  try {
    loading.value = true
    const data = await api.getMetaAdsConfig()
    if (data) {
      config.value = {
        accessToken: data.accessToken || '',
        adAccountId: data.adAccountId || '',
      }
    }
  } catch (error) {
    console.error('Erro ao carregar configuração:', error)
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  try {
    saving.value = true
    message.value = null
    await api.saveMetaAdsConfig(config.value)
    message.value = { type: 'success', text: 'Configuração salva com sucesso!' }
  } catch (error) {
    message.value = { type: 'error', text: 'Erro ao salvar configuração.' }
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <div class="p-3 bg-blue-500/20 rounded-lg">
        <Settings class="w-6 h-6 text-blue-500" />
      </div>
      <div>
        <h1 class="text-xl font-bold text-[var(--color-text-primary)]">Configuração Meta Ads</h1>
        <p class="text-sm text-[var(--color-text-muted)]">Configure a integração com o Facebook/Meta Ads</p>
      </div>
    </div>

    <div class="card p-6">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]"></div>
      </div>

      <form v-else @submit.prevent="saveConfig" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Access Token
          </label>
          <input
            v-model="config.accessToken"
            type="password"
            class="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-light)]"
            placeholder="Digite o Access Token do Meta Ads"
          />
          <p class="mt-1 text-xs text-[var(--color-text-muted)]">
            Obtenha o token em developers.facebook.com
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            ID da Conta de Anúncios
          </label>
          <input
            v-model="config.adAccountId"
            type="text"
            class="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-light)]"
            placeholder="act_123456789"
          />
          <p class="mt-1 text-xs text-[var(--color-text-muted)]">
            Formato: act_XXXXXXXX
          </p>
        </div>

        <div v-if="message" :class="['p-4 rounded-lg flex items-center gap-2', message.type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500']">
          <CheckCircle v-if="message.type === 'success'" class="w-5 h-5" />
          <AlertCircle v-else class="w-5 h-5" />
          <span>{{ message.text }}</span>
        </div>

        <button
          type="submit"
          :disabled="saving"
          class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
        >
          <Save class="w-5 h-5" />
          {{ saving ? 'Salvando...' : 'Salvar Configuração' }}
        </button>
      </form>
    </div>
  </div>
</template>
