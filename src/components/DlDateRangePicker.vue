<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger,
  RangeCalendarCell, RangeCalendarCellTrigger, RangeCalendarGrid, RangeCalendarGridBody, RangeCalendarGridHead,
  RangeCalendarGridRow, RangeCalendarHeadCell, RangeCalendarHeader, RangeCalendarHeading, RangeCalendarNext,
  RangeCalendarPrev, RangeCalendarRoot,
} from 'reka-ui'
import type { DateRange } from 'reka-ui'
import DlIcon from './DlIcon.vue'
import { DAY, FIELD, HEAD_CELL, NAV, POPUP, toDateValue, toIso } from './datePicker'

/**
 * A "from → to" period in one field: a click opens a two-month calendar; the first day clicked starts the period,
 * the second ends it, then the calendar closes. Values are 'YYYY-MM-DD' (v-model:start, v-model:end).
 */
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

const start = defineModel<string>('start', { default: '' })
const end = defineModel<string>('end', { default: '' })
const { t, d, locale } = useI18n()
const id = useId()
const open = ref(false)

const range = computed<DateRange>({
  get: () => ({ start: toDateValue(start.value), end: toDateValue(end.value) }),
  set: value => {
    // Only a full period is sent back; the first click alone just shows where it starts.
    if (value.start && value.end) {
      start.value = toIso(value.start)
      end.value = toIso(value.end)
      open.value = false
    }
  },
})
const filled = computed(() => !!start.value || !!end.value)
const clear = () => { start.value = ''; end.value = '' }
const day = (value: string) => d(new Date(`${value}T00:00:00`), { day: 'numeric', month: 'short', year: 'numeric' })
const text = computed(() => (start.value && end.value ? `${day(start.value)} → ${day(end.value)}` : ''))
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
        <span class="min-w-0 flex-1 truncate" :class="!text && 'text-dl-muted'">{{ text || placeholder || t('common.dates.pickPeriod') }}</span>
        <DlIcon v-if="!(clearable && filled)" icon="tabler-chevron-down" :size="16" class="text-dl-muted" />
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent align="start" :side-offset="6" :collision-padding="16" :class="POPUP">
          <RangeCalendarRoot v-slot="{ weekDays, grid }" v-model="range" :locale="locale" :min-value="toDateValue(props.min)" :max-value="toDateValue(props.max)" :number-of-months="2" fixed-weeks>
            <RangeCalendarHeader class="mb-2 flex items-center gap-2">
              <RangeCalendarPrev :class="NAV" :aria-label="t('common.dates.previous')"><DlIcon icon="tabler-chevron-left" :size="18" class="rtl:-scale-x-100" /></RangeCalendarPrev>
              <RangeCalendarHeading class="flex-1 text-center text-sm font-semibold first-letter:uppercase" />
              <RangeCalendarNext :class="NAV" :aria-label="t('common.dates.next')"><DlIcon icon="tabler-chevron-right" :size="18" class="rtl:-scale-x-100" /></RangeCalendarNext>
            </RangeCalendarHeader>
            <div class="flex flex-col gap-4 sm:flex-row">
              <RangeCalendarGrid v-for="month in grid" :key="month.value.toString()" class="border-collapse">
                <RangeCalendarGridHead>
                  <RangeCalendarGridRow>
                    <RangeCalendarHeadCell v-for="weekDay in weekDays" :key="weekDay" :class="HEAD_CELL">{{ weekDay }}</RangeCalendarHeadCell>
                  </RangeCalendarGridRow>
                </RangeCalendarGridHead>
                <RangeCalendarGridBody>
                  <RangeCalendarGridRow v-for="(week, i) in month.rows" :key="i">
                    <RangeCalendarCell v-for="date in week" :key="date.toString()" :date="date" class="p-0">
                      <RangeCalendarCellTrigger :day="date" :month="month.value" :class="DAY" />
                    </RangeCalendarCell>
                  </RangeCalendarGridRow>
                </RangeCalendarGridBody>
              </RangeCalendarGrid>
            </div>
          </RangeCalendarRoot>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <button v-if="clearable && filled && !disabled" type="button" class="absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-dl-muted hover:bg-dl-mist hover:text-dl-fg" :aria-label="t('common.dates.clear')" @click="clear"><DlIcon icon="tabler-x" :size="16" /></button>
    </div>
    <p v-if="error || hint" :id="`${id}-help`" class="text-xs" :class="error ? 'text-dl-rejected' : 'text-dl-muted'">{{ error || hint }}</p>
  </div>
</template>
