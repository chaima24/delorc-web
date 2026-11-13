<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldErrors } from '@/api/errors'
import { createHolidays, fetchHolidays, type Holiday, type HolidayItem } from '@/api/tenant/fieldSetup'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useToast } from '@/composables/useToast'
import { addDays, inYear, useHolidayText } from './holidayDisplay'

// "Copy from last year": same-date holidays come with their new date; the others (religious
// holidays, whose date moves) are listed once per holiday, to tick and date by hand.
// Mockup: docs/design/studio-mockups/Holidays.html (frame 5)
const props = defineProps<{ year: number; taken: string[] }>()
const emit = defineEmits<{ added: [holidays: Holiday[]] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const text = useHolidayText()
const toast = useToast()

interface Line { key: string; name: string; date: string; days: number; picked: boolean; fixed: boolean }

const lines = ref<Line[]>([])
const loading = ref(false)
const saving = ref(false)
const failed = ref(false)

async function load() {
  loading.value = true
  try {
    const previous = (await fetchHolidays(props.year - 1)).data
    const fixed = previous.filter(h => h.every_year).map(h => {
      const date = inYear(h.date, props.year)
      return { key: `f${h.id}`, name: h.name, date, days: 1, picked: !props.taken.includes(date), fixed: true }
    })
    // Days in a row with the same name are one holiday (Aïd el-Fitr, 3 days).
    const moving: Line[] = []
    for (const h of previous.filter(h => !h.every_year)) {
      const last = moving[moving.length - 1]
      if (last && last.name === h.name && addDays(last.date, last.days) === h.date) last.days++
      else moving.push({ key: `m${h.id}`, name: h.name, date: h.date, days: 1, picked: false, fixed: false })
    }
    lines.value = [...fixed, ...moving.map(line => ({ ...line, date: '' }))]
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
watch(() => props.year, load, { immediate: true })

const fixed = computed(() => lines.value.filter(line => line.fixed))
const moving = computed(() => lines.value.filter(line => !line.fixed))
const picked = computed(() => lines.value.filter(line => line.picked && line.date))
const dayCount = computed(() => picked.value.reduce((sum, line) => sum + line.days, 0))

async function save() {
  failed.value = false
  saving.value = true
  try {
    const items: HolidayItem[] = picked.value.map(line => ({ name: line.name, date: line.date, days: line.days, every_year: line.fixed }))
    const added = await createHolidays(items)
    toast.success(t('holidays.add.done', added.length))
    emit('added', added)
  }
  catch (error) {
    if (Object.keys(fieldErrors(error)).length) failed.value = true
    else toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('holidays.copy.title', { year: year - 1 })" :description="t('holidays.copy.into', { year })">
    <div v-if="loading" class="text-sm text-dl-muted">{{ t('geo.loading') }}</div>
    <div v-else class="flex flex-col gap-3.5">
      <section v-if="fixed.length" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <header class="mb-2 flex items-center gap-2">
          <h3 class="flex-1 text-sm font-semibold">{{ t('holidays.copy.fixed', { n: n(fixed.length) }) }}</h3>
          <span class="text-xs text-dl-muted">{{ t('holidays.copy.datesSet') }}</span>
        </header>
        <ul class="flex flex-col gap-2">
          <li v-for="line in fixed" :key="line.key">
            <label class="flex items-center gap-2.5 text-[13px]">
              <input v-model="line.picked" type="checkbox" class="h-[18px] w-[18px] accent-dl-ink" :disabled="taken.includes(line.date)">
              <strong class="flex-1 font-semibold">{{ line.name }}</strong>
              <span class="text-dl-muted">{{ taken.includes(line.date) ? t('holidays.copy.already') : `${text.short(line.date)} ${year}` }}</span>
            </label>
          </li>
        </ul>
      </section>

      <section v-if="moving.length" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <header class="mb-2 flex items-center gap-2">
          <h3 class="flex-1 text-sm font-semibold">{{ t('holidays.copy.moving', { n: n(moving.length) }) }}</h3>
          <span class="text-xs text-dl-muted">{{ t('holidays.copy.enterDate', { year }) }}</span>
        </header>
        <ul class="flex flex-col gap-2.5">
          <li v-for="line in moving" :key="line.key" class="grid grid-cols-[18px_1fr_150px] items-center gap-2.5 text-[13px]">
            <input v-model="line.picked" type="checkbox" class="h-[18px] w-[18px] accent-dl-ink" :aria-label="line.name">
            <span>
              <strong class="block font-semibold">{{ line.name }}</strong>
              <small class="text-xs text-dl-muted">{{ t('holidays.copy.lastYear', { days: t('holidays.add.days', line.days), year: year - 1 }) }}</small>
            </span>
            <DlInput
              v-model="line.date"
              type="date"
              :min="`${year}-01-01`"
              :max="`${year}-12-31`"
              :label="t('holidays.copy.dateOf', { name: line.name })"
              hide-label
              @update:model-value="line.picked = !!line.date"
            />
          </li>
        </ul>
        <p class="mt-2.5 text-xs text-dl-muted">{{ t('holidays.copy.movingHint') }}</p>
      </section>

      <p v-if="!lines.length" class="text-sm text-dl-muted">{{ t('holidays.copy.nothing', { year: year - 1 }) }}</p>
      <p v-if="failed" class="rounded-xl bg-dl-pending/10 px-3 py-2 text-[12.5px] text-dl-pending">{{ t('holidays.copy.conflict') }}</p>
    </div>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton variant="primary" :loading="saving" :disabled="!dayCount" class="ms-auto" @click="save">
        {{ t('holidays.copy.submit', dayCount) }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>
