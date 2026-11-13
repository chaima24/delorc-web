<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchHoliday, fetchHolidays, type Holiday, type HolidayListMeta } from '@/api/tenant/fieldSetup'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { fieldSection } from '@/views/tenant/settings/shared/studioSections'
import { useStudioCounts } from '@/views/tenant/settings/shared/useStudioList'
import HolidayAddPanel from './HolidayAddPanel.vue'
import HolidayCopyPanel from './HolidayCopyPanel.vue'
import HolidayDateBox from './HolidayDateBox.vue'
import WorkingWeekPanel from './WorkingWeekPanel.vue'
import HolidayPanel from './HolidayPanel.vue'
import { useHolidayText } from './holidayDisplay'

// Studio › Settings › Field › Public holidays: the lab's days off, one year at a time.
// Mockup: docs/design/studio-mockups/Holidays.html
const { t, n } = useI18n()
const toast = useToast()
const text = useHolidayText()
const auth = useAuthStore()
const { refresh: refreshCounts } = useStudioCounts()

const year = ref(new Date().getFullYear())
const items = ref<Holiday[]>([])
const meta = ref<HolidayListMeta | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const body = await fetchHolidays(year.value)
    items.value = body.data
    meta.value = body.meta
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
watch(year, load, { immediate: true })

// Panel: a holiday, "Add a holiday" or "Copy from last year".
const open = ref(false)
const mode = ref<'read' | 'add' | 'copy' | 'week'>('read')
const selected = ref<Holiday | null>(null)
// A new key each time "Add" or "Copy" opens, so the form starts empty.
const formKey = ref(0)

async function show(row: Holiday) {
  mode.value = 'read'
  selected.value = row
  open.value = true
  const full = await fetchHoliday(row.id)
  if (selected.value?.id === row.id) selected.value = full
}
function add() {
  selected.value = null
  formKey.value++
  mode.value = 'add'
  open.value = true
}
function copy() {
  selected.value = null
  formKey.value++
  mode.value = 'copy'
  open.value = true
}
/** "Modifier" next to the weekend: the lab's working week. */
function editWeek() {
  selected.value = null
  formKey.value++
  mode.value = 'week'
  open.value = true
}
function changed() {
  load()
  refreshCounts()
}
function onAdded(added: Holiday[]) {
  const first = added[0]
  if (first && Number(first.date.slice(0, 4)) !== year.value) year.value = Number(first.date.slice(0, 4))
  else changed()
  refreshCounts()
  open.value = false
}
function onChanged(holiday: Holiday) {
  selected.value = holiday
  if (Number(holiday.date.slice(0, 4)) !== year.value) year.value = Number(holiday.date.slice(0, 4))
  else changed()
}
function onDeleted() {
  open.value = false
  changed()
}

const weekend = computed(() => meta.value?.weekend ?? [])
const columns = computed(() => [
  { key: 'date', label: t('holidays.columns.date') },
  { key: 'name', label: t('holidays.columns.name') },
  { key: 'every_year', label: t('holidays.columns.everyYear'), secondary: true },
  { key: 'effect', label: t('holidays.columns.effect') },
])
const canCopy = computed(() => auth.can('holidays.create') && (meta.value?.previous_year_count ?? 0) > 0)
</script>

<template>
  <StudioListPage
    :section="fieldSection"
    :title="t('holidays.title')"
    :add-label="auth.can('holidays.create') ? t('holidays.add.button') : undefined"
    @add="add"
  >
    <div class="flex flex-wrap items-center gap-2.5">
      <div class="inline-flex items-center gap-1 rounded-2xl border border-dl-line bg-dl-paper p-1">
        <DlIconButton icon="tabler-chevron-left" :label="t('holidays.year.previous')" variant="ghost" :size="34" class="rtl:-scale-x-100" @click="year--" />
        <span class="inline-flex h-[34px] min-w-[64px] items-center justify-center rounded-[10px] bg-dl-ink px-2.5 text-[13px] font-semibold text-dl-mist tabular-nums" aria-live="polite">{{ year }}</span>
        <DlIconButton icon="tabler-chevron-right" :label="t('holidays.year.next')" variant="ghost" :size="34" class="rtl:-scale-x-100" @click="year++" />
      </div>
      <span v-if="meta" class="inline-flex h-9 items-center gap-2 rounded-[11px] border border-dl-line bg-dl-paper px-3 text-[13px] font-semibold text-dl-body">
        {{ t('holidays.weekend') }} <b class="text-dl-fg">{{ text.weekend(meta.weekend) }}</b>
        <button v-if="auth.can('calendar.update')" type="button" class="ms-1 inline-flex items-center gap-1 font-semibold text-dl-cobalt hover:underline" @click="editWeek">
          <DlIcon icon="tabler-pencil" :size="14" />{{ t('common.actions.edit') }}
        </button>
      </span>
      <span v-if="items.length && meta" class="inline-flex h-9 items-center gap-1 rounded-[11px] border border-dl-line bg-dl-paper px-3 text-[13px] font-semibold text-dl-body">
        {{ t('holidays.summary', { days: n(items.length), working: n(meta.working_days_off) }) }}
      </span>
      <DlButton v-if="canCopy && items.length" variant="outline" size="sm" icon="tabler-copy" class="ms-auto" @click="copy">
        {{ t('holidays.copy.button', { year: year - 1 }) }}
      </DlButton>
    </div>

    <DlEmptyState
      v-if="!loading && !items.length"
      icon="tabler-calendar-off"
      :title="t('holidays.empty.title', { year })"
      :description="t('holidays.empty.text', { year })"
    >
      <DlButton v-if="canCopy" variant="dark" icon="tabler-copy" @click="copy">{{ t('holidays.copy.button', { year: year - 1 }) }}</DlButton>
      <DlButton v-if="auth.can('holidays.create')" variant="outline" icon="tabler-plus" @click="add">{{ t('holidays.add.button') }}</DlButton>
    </DlEmptyState>

    <DlDataList
      v-else
      :label="t('holidays.title')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="mode === 'read' && open ? selected?.id : null"
      :loading="loading"
      :compact="open"
      @open="show"
    >
      <template #cell-date="{ row }">
        <span class="flex items-center gap-3">
          <HolidayDateBox :date="row.date" :faded="row.on_weekend" />
          <strong class="whitespace-nowrap font-semibold">{{ text.short(row.date) }}</strong>
        </span>
      </template>
      <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
      <template #cell-every_year="{ row }">
        <span v-if="row.every_year" class="inline-flex items-center gap-1 text-xs text-dl-muted"><DlIcon icon="tabler-repeat" :size="14" />{{ t('holidays.everyYear.yes') }}</span>
        <span v-else class="text-xs text-dl-muted">{{ t('holidays.everyYear.no') }}</span>
      </template>
      <template #cell-effect="{ row }">
        <DlBadge v-if="row.on_weekend" size="sm">{{ t('holidays.effect.weekend') }}</DlBadge>
        <DlBadge v-else size="sm" tone="signal">{{ t('holidays.effect.dayOff') }}</DlBadge>
      </template>
      <template #card="{ row }">
        <span class="flex items-center gap-3">
          <HolidayDateBox :date="row.date" :faded="row.on_weekend" />
          <span class="min-w-0">
            <strong class="block font-semibold">{{ row.name }}</strong>
            <span class="text-xs text-dl-muted">{{ text.short(row.date) }}<template v-if="row.on_weekend"> · {{ t('holidays.effect.weekendShort') }}</template></span>
          </span>
        </span>
      </template>
    </DlDataList>

    <template #panel>
      <HolidayAddPanel v-if="mode === 'add'" :key="`add${formKey}`" v-model:open="open" :year="year" :weekend="weekend" @added="onAdded" />
      <HolidayCopyPanel v-else-if="mode === 'copy'" :key="`copy${formKey}`" v-model:open="open" :year="year" :taken="items.map(item => item.date)" @added="onAdded" />
      <WorkingWeekPanel v-else-if="mode === 'week'" :key="`week${formKey}`" v-model:open="open" :weekend="weekend" @saved="changed" />
      <HolidayPanel v-else-if="selected" v-model:open="open" :holiday="selected" @changed="onChanged" @deleted="onDeleted" />
    </template>
  </StudioListPage>
</template>
