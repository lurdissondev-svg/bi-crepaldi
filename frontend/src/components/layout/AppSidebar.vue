<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Users,
  Target,
  UserCheck,
  ChevronLeft,
  Settings,
  HelpCircle,
} from 'lucide-vue-next'
import { cn } from '@/utils/cn'
import { prefetchRoute } from '@/services/prefetch'

interface NavItem {
  name: string
  path: string
  icon: any
}

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
}>()

const route = useRoute()

const navItems: NavItem[] = [
  { name: 'Resumo', path: '/', icon: LayoutDashboard },
  { name: 'Faturamento', path: '/faturamento', icon: DollarSign },
  { name: 'Marketing', path: '/marketing', icon: TrendingUp },
  { name: 'Comercial', path: '/comercial', icon: ShoppingCart },
  { name: 'Atendimento', path: '/atendimento', icon: UserCheck },
  { name: 'Quadro de Metas', path: '/metas', icon: Target },
  { name: 'Pacientes', path: '/pacientes', icon: Users },
]

const configItems: NavItem[] = [
  { name: 'Meta Ads', path: '/config/meta-ads', icon: Settings },
  { name: 'Como Funciona', path: '/como-funciona', icon: HelpCircle },
]

function isActive(path: string): boolean {
  return route.path === path
}

function handleMouseEnter(path: string) {
  prefetchRoute(path)
}
</script>

<template>
  <aside
    :class="cn(
      'fixed left-0 top-0 z-40 h-screen bg-[var(--color-bg-elevated)] border-r border-[var(--color-border-primary)] transition-all duration-300 flex flex-col',
      isOpen ? 'w-64' : 'w-[72px]'
    )"
  >
    <!-- Logo -->
    <div class="flex items-center h-16 px-4 border-b border-[var(--color-border-primary)]">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img src="/logo.png" alt="Grupo Crepaldi" class="w-full h-full object-contain" />
        </div>
        <div v-if="isOpen" class="min-w-0 animate-fade-in">
          <h2 class="font-bold text-[var(--color-text-primary)] text-sm truncate">GRUPO CREPALDI</h2>
          <p class="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Business Intelligence</p>
        </div>
      </div>
      <button
        @click="emit('toggle')"
        :class="cn(
          'p-1.5 rounded-lg transition-all duration-200 hover:bg-[var(--color-bg-hover)]',
          !isOpen && 'absolute -right-3 top-6 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] shadow-sm'
        )"
        :aria-label="isOpen ? 'Recolher menu' : 'Expandir menu'"
      >
        <ChevronLeft
          :size="16"
          :class="cn(
            'text-[var(--color-text-tertiary)] transition-transform duration-300',
            !isOpen && 'rotate-180'
          )"
        />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-hide">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        @mouseenter="handleMouseEnter(item.path)"
        :class="cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
          isActive(item.path)
            ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
            : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
        )"
      >
        <div
          v-if="isActive(item.path)"
          class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--color-accent)] rounded-r-full"
        />
        <span
          :class="cn(
            'flex-shrink-0 transition-colors',
            isActive(item.path) ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'
          )"
        >
          <component :is="item.icon" :size="20" />
        </span>
        <span v-if="isOpen" class="text-sm font-medium truncate animate-fade-in">{{ item.name }}</span>
        <div
          v-if="!isOpen"
          class="absolute left-full ml-2 px-2 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50"
        >
          <span class="text-sm text-[var(--color-text-primary)]">{{ item.name }}</span>
        </div>
      </router-link>

      <!-- Config Section Divider -->
      <div class="pt-4 mt-4 border-t border-[var(--color-border-subtle)]">
        <span v-if="isOpen" class="px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          Configuracoes
        </span>
      </div>

      <!-- Config Items -->
      <router-link
        v-for="item in configItems"
        :key="item.path"
        :to="item.path"
        @mouseenter="handleMouseEnter(item.path)"
        :class="cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative mt-2',
          isActive(item.path)
            ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
            : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
        )"
      >
        <div
          v-if="isActive(item.path)"
          class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--color-accent)] rounded-r-full"
        />
        <span
          :class="cn(
            'flex-shrink-0 transition-colors',
            isActive(item.path) ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]'
          )"
        >
          <component :is="item.icon" :size="20" />
        </span>
        <span v-if="isOpen" class="text-sm font-medium truncate animate-fade-in">{{ item.name }}</span>
        <div
          v-if="!isOpen"
          class="absolute left-full ml-2 px-2 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-primary)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50"
        >
          <span class="text-sm text-[var(--color-text-primary)]">{{ item.name }}</span>
        </div>
      </router-link>
    </nav>

    <!-- Footer -->
    <div class="p-4 border-t border-[var(--color-border-subtle)]">
      <div v-if="isOpen" class="animate-fade-in">
        <div class="flex items-center gap-2 px-2">
          <div class="w-2 h-2 rounded-full bg-[var(--color-success)] shadow-sm shadow-green-500/50 animate-pulse" />
          <span class="text-xs text-[var(--color-text-muted)]">Sistema online</span>
        </div>
        <div class="mt-2 px-2 flex items-center justify-between">
          <span class="text-[10px] text-[var(--color-text-muted)]">1.Diretoria</span>
          <span class="text-[10px] text-[var(--color-text-muted)]">v2.0.0</span>
        </div>
      </div>
      <div v-else class="flex justify-center">
        <div class="w-2 h-2 rounded-full bg-[var(--color-success)] shadow-sm shadow-green-500/50 animate-pulse" />
      </div>
    </div>
  </aside>
</template>
