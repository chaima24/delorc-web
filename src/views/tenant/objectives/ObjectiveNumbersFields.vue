<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ObjectiveNumber, ObjectiveNumbers } from '@/api/tenant/objectives'

// The numbers a day, one per line: label (+ hint or the previous value) and a small box.
const props = defineProps<{
  numbers: ObjectiveNumber[]
  /** The values before the change, shown as "was 10". */
  previous?: ObjectiveNumbers
  errors?: Record<string, string>
}>()
const model = defineModel<ObjectiveNumbers>({ required: true })
const { t, n } = useI18n()

function set(number: ObjectiveNumber, value: string) {
  const parsed = Number.parseInt(value, 10)
  model.value = { ...model.value, [number]: Number.isNaN(parsed) || parsed < 0 ? 0 : parsed }
}
</script>

<template>
  <ul class="flex flex-col gap-2.5">
    <li v-for="number in props.numbers" :key="number" class="flex items-center gap-3">
      <label :for="`objective-${number}`" class="flex min-w-0 flex-1 flex-col text-[13.5px]">
        <span class="font-semibold">{{ t(`objectives.numbers.${number}`) }}</span>
        <span v-if="previous" class="text-xs text-dl-muted">{{ t('objectives.change.was', { value: n(previous[number]) }) }}</span>
        <span v-else class="text-xs text-dl-muted">{{ t(`objectives.numbers.${number}Hint`) }}</span>
        <span v-if="errors?.[number]" class="text-xs text-dl-rejected">{{ errors[number] }}</span>
      </label>
      <input
        :id="`objective-${number}`"
        :value="model[number]"
        type="number"
        inputmode="numeric"
        min="0"
        max="999"
        class="h-11 w-22 rounded-xl border bg-dl-paper text-center text-base font-semibold tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
        :class="previous && previous[number] !== model[number] ? 'border-2 border-dl-fg bg-dl-signal-soft' : 'border-dl-line'"
        @input="set(number, ($event.target as HTMLInputElement).value)"
      >
    </li>
  </ul>
</template>
