<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { activityLogApi, type ActivityLine, type ActivityPerson, type RecordType } from '@/api/central/activityLog'
import { errorMessage } from '@/api/errors'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { ACTIONS, groupByDay, periodStart } from './activity'
import ActivityAvatar from './ActivityAvatar.vue'
import ActivityPanel from './ActivityPanel.vue'
import { useActivityTexts } from './useActivityTexts'

const { t } = useI18n()
const { chips, dayLabel, recordLink, recordName, timeLabel } = useActivityTexts()

const lines = ref<ActivityLine[]>([])
const people = ref<ActivityPerson[]>([])
const total = ref(0)
const page = ref(1)
const perPage = ref(25)
const search = ref('')
const person = ref<string | number>('all')
const record = ref('all')
const action = ref('all')
const period = ref<string | number>(7)
const hideAutomatic = ref(true)
const sort = ref('-id')
const error = ref<string | null>(null)
const loading = ref(true)
const selected = ref<ActivityLine | null>(null)

const panelOpen = computed({
  get: () => selected.value !== null,
  set: (open) => {
    if (!open) selected.value = null
  },
})

const all = computed(() => ({ value: 'all', label: t('common.list.all') }))
const personOptions = computed(() => [all.value, ...people.value.map(({ id, name }) => ({ value: id, label: name }))])
const recordOptions = computed(() => [
  all.value,
  ...['person', 'role', 'language', 'translations', 'country', 'region', 'wilaya', 'commune', 'plan', 'lab', 'settings', 'sign_in'].map((value) => ({ value, label: t(`central.activity.recordType.${value}`) })),
])
const actionOptions = computed(() => [
  all.value,
  ...ACTIONS.map((value) => ({ value, label: t(`central.activity.action.${value}`) })),
])
const periodOptions = computed(() => [
  ...[7, 30, 90].map((value) => ({ value, label: t('central.activity.lastDays', { count: value }) })),
  { value: 'all', label: t('central.activity.allTime') },
])

const sortOptions = computed(() => [
  { value: '-id', label: t('central.activity.newestFirst') },
  { value: 'id', label: t('central.activity.oldestFirst') },
])

const days = computed(() => groupByDay(lines.value))

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const answer = await activityLogApi.list({
      search: search.value || undefined,
      person: person.value === 'all' ? undefined : Number(person.value),
      record: record.value === 'all' ? undefined : (record.value as RecordType),
      action: action.value === 'all' ? undefined : action.value,
      from: period.value === 'all' ? undefined : periodStart(Number(period.value)),
      hideAutomatic: hideAutomatic.value,
      sort: sort.value,
    }, page.value, perPage.value)
    lines.value = answer.data
    total.value = answer.meta.total
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    loading.value = false
  }
}

function reloadFromFirstPage(): void {
  if (page.value === 1) load()
  else page.value = 1
}

let typing: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(typing)
  typing = setTimeout(reloadFromFirstPage, 300)
})
watch([person, record, action, period, hideAutomatic, sort, perPage], reloadFromFirstPage)
watch(page, load)

onMounted(async () => {
  load()
  people.value = await activityLogApi.people().catch(() => [])
})
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.activity.pageTitle') }}</h1>
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <div class="rounded-3xl bg-dl-paper p-4">
        <div class="mb-1.5 flex flex-wrap items-center gap-2.5">
          <DlInput v-model="search" :label="t('central.activity.search')" :placeholder="t('central.activity.search')" hide-label icon="tabler-search" class="w-full sm:w-60" />
          <DlCombobox v-model="person" :label="t('central.activity.person')" :options="personOptions" appearance="filter" />
          <DlSelect v-model="record" :label="t('central.activity.record')" :options="recordOptions" appearance="filter" />
          <DlSelect v-model="action" :label="t('central.activity.actionLabel')" :options="actionOptions" appearance="filter" />
          <DlSelect v-model="period" :label="t('central.activity.period')" :options="periodOptions" appearance="filter" hide-label />
          <DlSelect v-model="sort" :label="t('central.activity.sort')" :options="sortOptions" appearance="filter" hide-label />
          <DlSwitch v-model="hideAutomatic" :label="t('central.activity.hideAutomatic')" class="ms-auto" />
        </div>

        <DlEmptyState
          v-if="!loading && !lines.length"
          :title="t('central.activity.empty')"
          :description="t('central.activity.emptyHint')"
          icon="tabler-history"
        />
        <template v-else>
          <section v-for="day in days" :key="day.day">
            <h2 class="px-1 pb-1.5 pt-3.5 text-xs font-bold uppercase tracking-[0.05em] text-dl-muted">{{ dayLabel(day.day) }}</h2>
            <div
              v-for="line in day.lines"
              :key="line.id"
              class="flex cursor-pointer items-start gap-3 rounded-[14px] p-3 hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
              :class="selected?.id === line.id && 'bg-dl-signal-soft hover:bg-dl-signal-soft'"
              tabindex="0"
              @click="selected = line"
              @keydown.enter="selected = line"
            >
              <ActivityAvatar :author="line.author" />
              <div class="min-w-0 flex-1">
                <i18n-t :keypath="`central.activity.sentence.${line.record_type}.${line.action}`" tag="p" class="text-sm">
                  <template #author>
                    <strong>{{ line.author.type === 'person' ? line.author.name : t('central.activity.system') }}</strong>
                  </template>
                  <template #record>
                    <RouterLink v-if="recordLink(line)" :to="recordLink(line)!" class="font-semibold text-dl-cobalt no-underline hover:underline" @click.stop>{{ recordName(line) }}</RouterLink>
                    <strong v-else>{{ recordName(line) }}</strong>
                  </template>
                </i18n-t>
                <div v-if="chips(line).length" class="mt-1.5 flex flex-wrap gap-1.5">
                  <DlBadge v-for="chip in chips(line)" :key="chip" size="sm">{{ chip }}</DlBadge>
                </div>
              </div>
              <time :datetime="line.created_at" class="whitespace-nowrap text-xs text-dl-muted">{{ timeLabel(line) }}</time>
            </div>
          </section>
        </template>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>
    </div>

    <ActivityPanel v-if="selected" v-model:open="panelOpen" :line="selected" />
  </div>
</template>
