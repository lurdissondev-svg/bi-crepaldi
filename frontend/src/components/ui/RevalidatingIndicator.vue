<script setup lang="ts">
import { cn } from '@/utils/cn'

defineProps<{
  isRevalidating: boolean
  class?: string
}>()
</script>

<template>
  <div v-if="isRevalidating" :class="cn('flex items-center gap-2 text-xs text-[var(--color-text-muted)]', $props.class)">
    <div class="w-2 h-2 bg-[var(--color-accent)] rounded-full animate-pulse" />
    <span>Atualizando...</span>
  </div>
</template>
