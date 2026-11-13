<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * The planning window drawn on a line before the cycle start, with a real example: the next
 * cycle starting on a Monday. Mockup: docs/design/studio-mockups/RulesPlatform.html
 */
const props = defineProps<{
  open: number | string
  close: number | string
}>()

const { t, d } = useI18n()

const days = computed(() => {
  const open = Number(props.open)
  const close = Number(props.close)
  return Number.isInteger(open) && Number.isInteger(close) && open > close && close >= 0 ? { open, close } : null
})

// The window always spans the same width: opens at 10%, the cycle starts at 82%.
const START = 82
const at = (day: number) => START - day * ((START - 10) / days.value!.open)

const example = computed(() => {
  if (!days.value) return null
  const start = new Date()
  start.setHours(12, 0, 0, 0)
  start.setDate(start.getDate() + (((8 - start.getDay()) % 7) || 7))
  const shift = (from: Date, by: number) => new Date(from.getTime() - by * 86_400_000)
  const format = (date: Date) => d(date, { weekday: 'short', day: 'numeric', month: 'short' })
  return { start: format(start), opens: format(shift(start, days.value.open)), closes: format(shift(start, days.value.close)) }
})
</script>

<template>
  <figure class="m-0 flex flex-col gap-1.5 rounded-2xl bg-dl-mist px-4 pb-3 pt-4">
    <template v-if="days && example">
      <div class="relative mx-1.5 h-4 text-[11.5px] leading-tight text-dl-muted" aria-hidden="true">
        <span class="absolute end-0 whitespace-nowrap">
          <b class="text-xs text-dl-fg">{{ t('rulesSetup.window.cycleStarts') }}</b> · {{ example.start }}
        </span>
      </div>
      <div class="relative mx-1.5 h-8" aria-hidden="true">
        <span class="absolute inset-x-0 top-[14px] h-1 rounded-full bg-dl-line" />
        <span
          class="absolute top-2.5 h-3 rounded-full bg-dl-cobalt"
          :style="{ insetInlineStart: `${at(days.open)}%`, width: `${at(days.close) - at(days.open)}%` }"
        />
        <span class="absolute top-1 h-[26px] w-0.5 bg-dl-fg" :style="{ insetInlineStart: `${START}%` }" />
      </div>
      <div class="relative mx-1.5 h-9 text-[11.5px] leading-tight text-dl-muted" aria-hidden="true">
        <span class="absolute -translate-x-1/2 text-center whitespace-nowrap rtl:translate-x-1/2" :style="{ insetInlineStart: `${at(days.open)}%` }">
          <b class="block text-xs text-dl-fg">{{ t('rulesSetup.window.opens') }}</b>{{ t('rulesSetup.window.daysBefore', days.open) }}
        </span>
        <!-- Too close to "Opens" to fit: the sentence below gives the date. -->
        <span v-if="at(days.close) - at(days.open) >= 24" class="absolute -translate-x-1/2 text-center whitespace-nowrap rtl:translate-x-1/2" :style="{ insetInlineStart: `${at(days.close)}%` }">
          <b class="block text-xs text-dl-fg">{{ t('rulesSetup.window.closes') }}</b>{{ days.close ? t('rulesSetup.window.daysBefore', days.close) : t('rulesSetup.window.atStart') }}
        </span>
      </div>
      <figcaption class="text-xs text-dl-muted">
        {{ t('rulesSetup.window.example', { start: example.start, opens: example.opens, closes: example.closes }) }}
      </figcaption>
    </template>
    <p v-else class="text-xs text-dl-muted">{{ t('rulesSetup.window.invalid') }}</p>
  </figure>
</template>
