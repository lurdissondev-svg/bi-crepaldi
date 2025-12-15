<script setup lang="ts">
import Skeleton from './Skeleton.vue'

withDefaults(defineProps<{
  height?: number
}>(), {
  height: 300,
})
</script>

<template>
  <div class="card p-6">
    <Skeleton class="h-6 w-1/4 mb-4" />
    <Skeleton class="w-full" :height="height" />
  </div>
</template>
