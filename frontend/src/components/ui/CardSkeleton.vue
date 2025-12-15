<script setup lang="ts">
import Skeleton from './Skeleton.vue'
</script>

<template>
  <div class="card p-6 space-y-4">
    <Skeleton class="h-6 w-1/3" />
    <Skeleton class="h-12 w-2/3" />
    <Skeleton class="h-4 w-1/2" />
  </div>
</template>
