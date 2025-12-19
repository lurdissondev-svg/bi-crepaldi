<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  icon?: any
  iconColor?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo'
}>()

const iconColorClasses = {
  blue: 'bg-blue-500/20 text-blue-500',
  green: 'bg-green-500/20 text-green-500',
  red: 'bg-red-500/20 text-red-500',
  yellow: 'bg-yellow-500/20 text-yellow-500',
  purple: 'bg-purple-500/20 text-purple-500',
  indigo: 'bg-indigo-500/20 text-indigo-500',
}
</script>

<template>
  <div class="section-header">
    <div class="flex items-center gap-3">
      <div v-if="icon" :class="['p-2 rounded-lg', iconColorClasses[iconColor || 'blue']]">
        <component :is="icon" class="w-5 h-5" />
      </div>
      <div>
        <h3 class="section-header-title">{{ title }}</h3>
        <p v-if="subtitle" class="section-header-subtitle">{{ subtitle }}</p>
      </div>
    </div>
    <div class="section-header-actions">
      <slot name="actions" />
    </div>
  </div>
</template>
