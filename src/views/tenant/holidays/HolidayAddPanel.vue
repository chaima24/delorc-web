<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldErrors } from '@/api/errors'
import { createHolidays, type Holiday } from '@/api/tenant/fieldSetup'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { useToast } from '@/composables/useToast'
import { addDays, isWeekend, useHolidayText } from './holidayDisplay'

// "Add a holiday": a name, its first day and how many days it lasts (one row per day).
// Mockup: docs/design/studio-mockups/Holidays.html (frame 3)
const props = defineProps<{ year: number; weekend: number[] }>()
const emit = defineEmits<{ added: [holidays: Holiday[]] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const text = useHolidayText()
const toast = useToast()

const MAX_DAYS = 10
const form = reactive({ name: '', date: '', every_year: false })
const lasts = ref('1')
const otherDays = ref<number | null>(4)
const errors = ref<Record<string, string>>({})
const saving = ref(false)

const lastsItems = computed(() => [
  { value: '1', label: t('holidays.add.days', 1) },
  { value: '2', label: t('holidays.add.days', 2) },
  { value: '3', label: t('holidays.add.days', 3) },
  { value: 'other', label: t('holidays.add.other') },
])
const days = computed(() => lasts.value === 'other'
  ? Math.min(MAX_DAYS, Math.max(1, Math.round(Number(otherDays.value) || 1)))
  : Number(lasts.value))
const preview = computed(() => form.date
  ? Array.from({ length: days.value }, (_, i) => addDays(form.date, i)).map(date => ({ date, weekend: isWeekend(date, props.weekend) }))
  : [])

async function save() {
  errors.value = {
    ...(!form.name.trim() && { name: t('users.add.required') }),
    ...(!form.date && { date: t('users.add.required') }),
  }
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    const added = (await createHolidays([{ name: form.name.trim(), date: form.date, days: days.value, every_year: form.every_year }]))
    toast.success(t('holidays.add.done', added.length))
    emit('added', added)
  }
  catch (error) {
    // The API says why, already translated ("Le 2026-03-22 a déjà un jour férié.").
    const list = fieldErrors(error)
    if (Object.keys(list).length) {
      errors.value = {
        ...(list['items.0.date'] && { date: list['items.0.date'] }),
        ...(list['items.0.name'] && { name: list['items.0.name'] }),
      }
    }
    else toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('holidays.add.title')">
    <form id="holiday-add" class="flex flex-col gap-4" @submit.prevent="save">
      <DlInput v-model="form.name" :label="t('holidays.fields.name')" :placeholder="t('holidays.add.namePlaceholder')" :error="errors.name" required />
      <DlInput v-model="form.date" type="date" :min="`${year}-01-01`" :label="t('holidays.add.firstDay')" :error="errors.date" required />

      <div class="flex flex-col gap-2">
        <span class="text-[13px] font-semibold">{{ t('holidays.add.lasts') }}</span>
        <DlSegmented v-model="lasts" :label="t('holidays.add.lasts')" :items="lastsItems" block />
        <DlInput v-if="lasts === 'other'" v-model.number="otherDays" type="number" min="1" :max="MAX_DAYS" :label="t('holidays.add.howMany')" />
        <ul v-if="preview.length" class="grid grid-cols-3 gap-1.5">
          <li
            v-for="day in preview"
            :key="day.date"
            class="rounded-xl border border-dl-line px-2.5 py-2 text-[12.5px]"
            :class="day.weekend && 'bg-dl-mist text-dl-muted'"
          >
            <b class="block text-sm" :class="day.weekend ? 'text-dl-muted' : 'text-dl-fg'">{{ text.short(day.date) }}</b>
            {{ day.weekend ? t('holidays.add.weekendDay') : t('holidays.add.workingDay') }}
          </li>
        </ul>
        <p class="text-xs text-dl-muted">{{ t('holidays.add.hint') }}</p>
      </div>

      <label class="flex items-start gap-2.5 text-[13px]">
        <input v-model="form.every_year" type="checkbox" class="mt-0.5 h-[18px] w-[18px] accent-dl-ink">
        <span>{{ t('holidays.fields.everyYear') }} <span class="text-xs text-dl-muted">{{ t('holidays.add.everyYearHint') }}</span></span>
      </label>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="holiday-add" variant="primary" :loading="saving" class="ms-auto">
        {{ t('holidays.add.submit', days) }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>
