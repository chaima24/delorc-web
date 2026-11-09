<script setup lang="ts">
import type { ActivityLine } from '@/api/central/activityLog'

/** Who made the line: initials, SYS for a command or a job, ! for a failed sign-in. */
defineProps<{ author: ActivityLine['author'] }>()
</script>

<template>
  <span
    class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-xs font-bold"
    :class="{
      'bg-dl-cobalt text-white': author.type === 'person',
      'bg-dl-line-soft text-dl-muted': author.type === 'system',
      'bg-dl-rejected/10 text-dl-rejected': author.type === 'none',
    }"
    aria-hidden="true"
  >{{ author.type === 'person' ? author.initials : author.type === 'system' ? 'SYS' : '!' }}</span>
</template>
