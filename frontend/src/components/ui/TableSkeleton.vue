<script setup lang="ts">
import Skeleton from './Skeleton.vue'

withDefaults(defineProps<{
  rows?: number
}>(), {
  rows: 5,
})
</script>

<template>
  <div class="card p-6 space-y-4">
    <Skeleton class="h-6 w-1/4" />
    <div class="space-y-3">
      <div v-for="i in rows" :key="i" class="flex gap-4">
        <Skeleton class="h-10 flex-1" />
        <Skeleton class="h-10 w-24" />
        <Skeleton class="h-10 w-24" />
      </div>
    </div>
  </div>
</template>
