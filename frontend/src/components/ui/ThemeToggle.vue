<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'
import { storeToRefs } from 'pinia'

const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)
</script>

<template>
  <button
    @click="themeStore.toggleTheme"
    class="relative p-2 rounded-lg transition-all duration-200 hover:bg-[var(--color-bg-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)]"
    :aria-label="theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'"
  >
    <div class="relative w-5 h-5">
      <Sun
        :size="20"
        :class="[
          'absolute inset-0 transition-all duration-300',
          theme === 'dark'
            ? 'opacity-0 rotate-90 scale-50'
            : 'opacity-100 rotate-0 scale-100 text-amber-500'
        ]"
      />
      <Moon
        :size="20"
        :class="[
          'absolute inset-0 transition-all duration-300',
          theme === 'dark'
            ? 'opacity-100 rotate-0 scale-100 text-indigo-400'
            : 'opacity-0 -rotate-90 scale-50'
        ]"
      />
    </div>
  </button>
</template>
