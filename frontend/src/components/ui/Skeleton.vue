<script setup lang="ts">
import { cn } from '@/utils/cn'

withDefaults(defineProps<{
  class?: string
  height?: number
}>(), {
  class: '',
})
</script>

<template>
  <div
    :class="cn('animate-pulse bg-[var(--color-bg-tertiary)] rounded', $props.class)"
    :style="height ? { height: `${height}px` } : undefined"
  />
</template>
