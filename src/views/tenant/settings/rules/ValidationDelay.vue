<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/** The validation delay in big, with an example: a visit planned next Tuesday at 10:00. */
const props = defineProps<{ hours: number | string }>()

const { t, n, d } = useI18n()

const value = computed(() => {
  const hours = Number(props.hours)
  return Number.isInteger(hours) && hours > 0 ? hours : null
})

const example = computed(() => {
  if (!value.value) return null
  const visit = new Date()
  visit.setDate(visit.getDate() + (((9 - visit.getDay()) % 7) || 7))
  visit.setHours(10, 0, 0, 0)
  const until = new Date(visit.getTime() + value.value * 3_600_000)
  const format = (date: Date) => d(date, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return { visit: format(visit), until: format(until) }
})
</script>

<template>
  <div class="flex flex-col gap-2 rounded-2xl bg-dl-mist px-4 py-3.5">
    <template v-if="value && example">
      <p class="flex items-baseline gap-2">
        <strong class="font-display text-[34px] font-extrabold leading-none tracking-[-0.02em]">{{ n(value) }} {{ t('rulesSetup.delay.unit') }}</strong>
        <span class="text-[13px] text-dl-muted">{{ t('rulesSetup.delay.after') }}</span>
      </p>
      <p class="text-xs text-dl-muted">{{ t('rulesSetup.delay.example', example) }}</p>
    </template>
    <p v-else class="text-xs text-dl-muted">{{ t('rulesSetup.delay.invalid') }}</p>
  </div>
</template>
