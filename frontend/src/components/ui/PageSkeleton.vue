<script setup lang="ts">
import Skeleton from './Skeleton.vue'
import CardSkeleton from './CardSkeleton.vue'
import ChartSkeleton from './ChartSkeleton.vue'
import TableSkeleton from './TableSkeleton.vue'
</script>

<template>
  <div class="space-y-6">
    <Skeleton class="h-8 w-1/4" />
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
    <ChartSkeleton />
    <TableSkeleton />
  </div>
</template>
