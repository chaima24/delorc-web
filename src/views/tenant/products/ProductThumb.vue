<script setup lang="ts">
import DlIcon from '@/components/DlIcon.vue'

// A product's photo, or a pill icon when there is none.
withDefaults(defineProps<{ src?: string | null; size?: 'sm' | 'lg' }>(), { size: 'sm' })
</script>

<template>
  <span
    class="flex shrink-0 items-center justify-center overflow-hidden bg-dl-mist text-dl-muted"
    :class="size === 'lg' ? 'h-[72px] w-[72px] rounded-[18px]' : 'h-10 w-10 rounded-xl'"
  >
    <img v-if="src" :src="src" alt="" class="h-full w-full object-cover">
    <DlIcon v-else icon="tabler-pill" :size="size === 'lg' ? 30 : 18" />
  </span>
</template>
