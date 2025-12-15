<script setup lang="ts">
import StatusIndicator from '@/components/ui/StatusIndicator.vue'
import SyncTimer from '@/components/ui/SyncTimer.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

defineProps<{
  title: string
}>()
</script>

<template>
  <header class="h-16 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border-primary)] flex items-center justify-between px-6 sticky top-0 z-30 backdrop-blur-sm bg-opacity-90">
    <div class="flex items-center gap-4">
      <h1 class="text-xl font-semibold text-[var(--color-text-primary)]">{{ title }}</h1>
    </div>

    <div class="flex items-center gap-3">
      <!-- Sync Timer -->
      <SyncTimer />

      <!-- System Status -->
      <StatusIndicator />

      <!-- Divider -->
      <div class="w-px h-6 bg-[var(--color-border-primary)]" />

      <!-- Theme Toggle -->
      <ThemeToggle />
    </div>
  </header>
</template>
