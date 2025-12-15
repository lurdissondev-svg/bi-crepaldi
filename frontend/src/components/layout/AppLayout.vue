<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import { cn } from '@/utils/cn'

const route = useRoute()
const dashboardStore = useDashboardStore()

const sidebarOpen = ref(true)

const titleMap: Record<string, string> = {
  '/': 'Visao Geral',
  '/faturamento': 'Faturamento',
  '/marketing': 'Marketing',
  '/comercial': 'Comercial',
  '/atendimento': 'Atendimento',
  '/administrativo': 'Administrativo Financeiro',
  '/metas': 'Quadro de Metas',
  '/pacientes': 'Pacientes',
  '/config/meta-ads': 'Configuracao - Meta Ads',
  '/como-funciona': 'Como Funciona',
}

const title = computed(() => titleMap[route.path] || 'Dashboard')

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

onMounted(() => {
  dashboardStore.init()
})
</script>

<template>
  <div class="min-h-screen bg-[var(--color-bg-secondary)]">
    <AppSidebar :is-open="sidebarOpen" @toggle="toggleSidebar" />

    <div
      :class="cn(
        'transition-all duration-300 min-h-screen',
        sidebarOpen ? 'ml-64' : 'ml-[72px]'
      )"
    >
      <AppHeader :title="title" />

      <main class="p-6 animate-fade-in">
        <router-view />
      </main>
    </div>
  </div>
</template>
