<script setup lang="ts">
import { onMounted } from 'vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

onMounted(() => {
  // Initialize theme on mount
  themeStore.initTheme()
})
</script>

<template>
  <router-view />
</template>
