<script setup lang="ts">
import { useHolidayText } from './holidayDisplay'

// The little calendar leaf in front of a holiday: month over day, faded on the weekend.
defineProps<{ date: string; faded?: boolean }>()
const text = useHolidayText()
</script>

<template>
  <span
    class="inline-flex h-[50px] w-[46px] shrink-0 flex-col items-center justify-center rounded-xl bg-dl-mist leading-tight"
    :class="faded && 'opacity-50'"
    aria-hidden="true"
  >
    <small class="text-[10.5px] font-bold uppercase text-dl-muted">{{ text.month(date) }}</small>
    <b class="text-[17px]">{{ text.day(date) }}</b>
  </span>
</template>
