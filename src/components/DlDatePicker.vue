<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CalendarCell, CalendarCellTrigger, CalendarGrid, CalendarGridBody, CalendarGridHead, CalendarGridRow, CalendarHeadCell,
  CalendarHeader, CalendarHeading, CalendarNext, CalendarPrev, CalendarRoot,
  PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger,
} from 'reka-ui'
import type { DateValue } from '@internationalized/date'
import DlIcon from './DlIcon.vue'
import { DAY, FIELD, HEAD_CELL, NAV, POPUP, toDateValue, toIso } from './datePicker'

/** One day in a field that looks like DlInput: a click opens a calendar, a day picked closes it. Value: 'YYYY-MM-DD'. */
const props = withDefaults(defineProps<{
  label: string
  hideLabel?: boolean
  placeholder?: string
  hint?: string
  error?: string
  disabled?: boolean
  /** First and last day that can be picked, 'YYYY-MM-DD'. */
  min?: string
  max?: string
  /** A ✕ empties the field (optional dates, filters). */
  clearable?: boolean
}>(), { hideLabel: false, disabled: false, clearable: false })

const model = defineModel<string>({ default: '' })
const { t, d, locale } = useI18n()
const id = useId()
const open = ref(false)

const date = computed<DateValue | undefined>({
  get: () => toDateValue(model.value),
  set: value => {
    model.value = toIso(value)
    open.value = false
  },
})
const filled = computed(() => !!model.value)
const clear = () => { model.value = '' }
const text = computed(() => (model.value ? d(new Date(`${model.value.slice(0, 10)}T00:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }) : ''))
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <label :for="id" class="text-[13px] font-semibold text-dl-fg" :class="hideLabel && 'sr-only'">{{ label }}</label>
    <div class="relative">
    <PopoverRoot v-model:open="open">
      <PopoverTrigger
        :id="id"
        type="button"
        :disabled="disabled"
        :class="[FIELD, error ? 'border-dl-rejected' : 'border-dl-line']"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error || hint ? `${id}-help` : undefined"
      >
        <DlIcon icon="tabler-calendar" :size="18" class="text-dl-muted" />
        <span class="min-w-0 flex-1 truncate" :class="!text && 'text-dl-muted'">{{ text || placeholder || t('common.dates.pickDay') }}</span>
        <DlIcon v-if="!(clearable && filled)" icon="tabler-chevron-down" :size="16" class="text-dl-muted" />
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent align="start" :side-offset="6" :collision-padding="16" :class="POPUP">
          <CalendarRoot v-slot="{ weekDays, grid }" v-model="date" :locale="locale" :min-value="toDateValue(props.min)" :max-value="toDateValue(props.max)" fixed-weeks>
            <CalendarHeader class="mb-2 flex items-center gap-2">
              <CalendarPrev :class="NAV" :aria-label="t('common.dates.previous')"><DlIcon icon="tabler-chevron-left" :size="18" class="rtl:-scale-x-100" /></CalendarPrev>
              <CalendarHeading class="flex-1 text-center text-sm font-semibold first-letter:uppercase" />
              <CalendarNext :class="NAV" :aria-label="t('common.dates.next')"><DlIcon icon="tabler-chevron-right" :size="18" class="rtl:-scale-x-100" /></CalendarNext>
            </CalendarHeader>
            <CalendarGrid v-for="month in grid" :key="month.value.toString()" class="border-collapse">
              <CalendarGridHead>
                <CalendarGridRow>
                  <CalendarHeadCell v-for="weekDay in weekDays" :key="weekDay" :class="HEAD_CELL">{{ weekDay }}</CalendarHeadCell>
                </CalendarGridRow>
              </CalendarGridHead>
              <CalendarGridBody>
                <CalendarGridRow v-for="(week, i) in month.rows" :key="i">
                  <CalendarCell v-for="day in week" :key="day.toString()" :date="day" class="p-0">
                    <CalendarCellTrigger :day="day" :month="month.value" :class="[DAY, 'data-[selected]:rounded-lg data-[selected]:bg-dl-ink data-[selected]:text-dl-on-ink']" />
                  </CalendarCell>
                </CalendarGridRow>
              </CalendarGridBody>
            </CalendarGrid>
          </CalendarRoot>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <button v-if="clearable && filled && !disabled" type="button" class="absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-dl-muted hover:bg-dl-mist hover:text-dl-fg" :aria-label="t('common.dates.clear')" @click="clear"><DlIcon icon="tabler-x" :size="16" /></button>
    </div>
    <p v-if="error || hint" :id="`${id}-help`" class="text-xs" :class="error ? 'text-dl-rejected' : 'text-dl-muted'">{{ error || hint }}</p>
  </div>
</template>
