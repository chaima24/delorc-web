<script setup lang="ts">
import { useLabTexts } from './useLabTexts'

/** The lab's logo, or its initials when it has none. */
withDefaults(defineProps<{ name: string; url: string | null; size?: 'sm' | 'lg' }>(), { size: 'sm' })

const { initials } = useLabTexts()
</script>

<template>
  <img v-if="url" :src="url" alt="" class="shrink-0 object-contain" :class="size === 'lg' ? 'size-14 rounded-2xl' : 'size-[34px] rounded-[10px]'">
  <span
    v-else
    class="inline-flex shrink-0 items-center justify-center bg-dl-ink-2 font-bold text-dl-signal"
    :class="size === 'lg' ? 'size-14 rounded-2xl text-lg' : 'size-[34px] rounded-[10px] text-xs'"
    aria-hidden="true"
  >{{ initials(name) }}</span>
</template>
