<script setup lang="ts">
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchActivity,
  fetchActivityCalendar,
  fetchAllActivities,
  type Activity,
  type ActivityCalendar as Calendar,
} from '@/api/tenant/activities'
import { fetchActivityTypes, type ActivityType } from '@/api/tenant/fieldSetup'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useAuthStore } from '@/stores/auth'
import { useUsers } from '@/views/tenant/territories/useTerritoryLookups'
import { today } from '@/views/tenant/users/userDisplay'
import ActivityCalendar from './ActivityCalendar.vue'
import { KIND_DAY_TYPE, KIND_TONE, monthRange, shiftMonth, useActivityText } from './activityDisplay'
import ActivityFormPanel from './ActivityFormPanel.vue'
import ActivityPanel from './ActivityPanel.vue'

// Planifier › Activités (docs/api/activities.md): everything that is not a visit. One month at a time, as a list by day or a
// team calendar (people × working days). Mockup: docs/design/plan-mockups/Activities.html
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const canStore = (resource: string) => auth.can(`${resource}.create`)
const text = useActivityText()
const users = useUsers()
users.ensureLoaded()
const types = ref<ActivityType[]>([])
onMountedAndFocus(() => fetchActivityTypes({ per_page: 100, sort: 'activity' }).then(page => { types.value = page.items }))

const ALL = 'all'
const view = ref<'list' | 'calendar'>(route.query.view === 'calendar' ? 'calendar' : 'list')
const month = ref(typeof route.query.month === 'string' && /^\d{4}-\d{2}$/.test(route.query.month) ? route.query.month : today().slice(0, 7))
const filters = reactive({ person: null as number | null, type: ALL as string | number, kind: ALL as string })
watch([view, month], () => router.replace({ query: { ...route.query, view: view.value === 'list' ? undefined : view.value, month: month.value } }))

const viewItems = computed(() => [
  { value: 'list', label: t('activities.view.list') },
  { value: 'calendar', label: t('activities.view.calendar') },
])
const personOptions = computed(() => [
  { value: 0, label: t('activities.filter.everyone') },
  ...users.items.value.map(user => ({ value: user.id, label: user.full_name })).sort((a, b) => a.label.localeCompare(b.label)),
])
const personFilter = computed({ get: () => filters.person ?? 0, set: value => { filters.person = value ? Number(value) : null } })
const typeOptions = computed(() => [{ value: ALL, label: t('activities.filter.allTypes') }, ...types.value.map(type => ({ value: type.id, label: type.activity })).sort((a, b) => a.label.localeCompare(b.label))])
const kindOptions = computed(() => [{ value: ALL, label: t('activities.filter.allKinds') }, ...(['off', 'non', 'field'] as const).map(kind => ({ value: kind, label: text.kind(kind) }))])

const activities = ref<Activity[]>([])
const calendar = ref<Calendar | null>(null)
const loading = ref(true)
async function load() {
  loading.value = true
  const { from, to } = monthRange(month.value)
  const common = {
    'filter[user_id]': filters.person ?? undefined,
    'filter[activity_type_id]': filters.type === ALL ? undefined : Number(filters.type),
    'filter[day_type]': filters.kind === ALL ? undefined : KIND_DAY_TYPE[filters.kind as keyof typeof KIND_DAY_TYPE],
  }
  try {
    if (view.value === 'list') {
      activities.value = await fetchAllActivities({ 'filter[period]': `${from},${to}`, ...common })
    }
    else {
      calendar.value = await fetchActivityCalendar({ from, to, ...common })
    }
  }
  finally {
    loading.value = false
  }
}
watch([view, month, () => ({ ...filters })], load, { immediate: true, deep: true })

/** Grouped by the day they start, newest first. */
const groups = computed(() => {
  const byDay = new Map<string, Activity[]>()
  for (const activity of activities.value) {
    const day = activity.start_at?.slice(0, 10) ?? ''
    byDay.set(day, [...(byDay.get(day) ?? []), activity])
  }
  return [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, rows]) => ({ day, rows }))
})

function whoLine(activity: Activity) {
  const reps = activity.activity_type?.value === 'medical_representative' ? (activity.targets ?? []).length : 0
  const name = activity.user?.full_name ?? activity.created_by?.full_name ?? ''
  return reps ? t('activities.list.withReps', { name, count: n(reps) }, reps) : name
}
function linkedLine(activity: Activity) {
  const count = (activity.targets ?? []).length
  if (!count || activity.activity_type?.value === 'medical_representative') return ''
  return t(`activities.list.linked.${activity.activity_type?.value}`, { count: n(count) }, count)
}

// Panel: an activity (read) or the form (add / edit).
const open = ref(false)
const mode = ref<'read' | 'form'>('read')
const selected = ref<Activity | null>(null)
async function show(id: number) {
  mode.value = 'read'
  open.value = true
  selected.value = activities.value.find(row => row.id === id) ?? selected.value
  selected.value = await fetchActivity(id)
}
function add() {
  selected.value = null
  mode.value = 'form'
  open.value = true
}
function edit() {
  mode.value = 'form'
}
async function onSaved(activity: Activity) {
  // Show the month it is in (the list follows the month switch).
  const saved = activity.start_at?.slice(0, 7)
  if (saved && saved !== month.value) month.value = saved
  else await load()
  await show(activity.id)
}
function onDeleted() {
  open.value = false
  selected.value = null
  load()
}
</script>

<template>
  <div class="flex w-full flex-col gap-5" :class="canStore('activities') && 'max-md:pb-20'">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.plan') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('activities.title') }}</h1>
        <p class="text-[13px] text-dl-muted">{{ t('activities.subtitle') }}</p>
      </div>
      <DlButton v-if="canStore('activities')" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('activities.form.addTitle') }}</DlButton>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <DlSegmented v-model="view" :label="t('activities.view.label')" :items="viewItems" class="max-md:hidden" />
      <span class="flex items-center gap-1 rounded-2xl bg-dl-paper p-1">
        <DlIconButton icon="tabler-chevron-left" :label="t('activities.month.previous')" @click="month = shiftMonth(month, -1)" />
        <strong class="min-w-32 px-2 text-center text-[13px] first-letter:uppercase">{{ text.month(month) }}</strong>
        <DlIconButton icon="tabler-chevron-right" :label="t('activities.month.next')" @click="month = shiftMonth(month, 1)" />
      </span>
      <div class="w-56"><DlCombobox v-model="personFilter" :label="t('activities.filter.person')" :options="personOptions" hide-label /></div>
      <DlSelect v-model="filters.type" :label="t('activities.filter.type')" :options="typeOptions" appearance="filter" />
      <DlSelect v-model="filters.kind" :label="t('activities.filter.kind')" :options="kindOptions" appearance="filter" />
    </div>

    <div class="flex items-start gap-5">
      <div class="flex min-w-0 flex-1 flex-col gap-1 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <template v-if="loading && !activities.length && !calendar">
          <DlSkeleton v-for="i in 4" :key="i" class="mb-2 h-14 rounded-xl" />
        </template>

        <!-- List by day -->
        <template v-else-if="view === 'list'">
          <DlEmptyState v-if="!groups.length" :title="t('activities.empty')" :description="t('activities.emptyText')" />
          <section v-for="group in groups" :key="group.day">
            <h2 class="px-1 pb-1.5 pt-3 text-xs font-bold uppercase tracking-wide text-dl-muted">{{ text.day(group.day) }}</h2>
            <ul class="flex flex-col gap-1.5">
              <li v-for="activity in group.rows" :key="activity.id">
                <button
                  type="button"
                  class="grid w-full grid-cols-[100px_1fr_auto] items-center gap-3.5 rounded-2xl border px-3.5 py-3 text-start text-[13.5px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt max-md:grid-cols-1 max-md:gap-1.5 max-md:bg-dl-paper"
                  :class="open && selected?.id === activity.id ? 'border-transparent bg-dl-signal-soft' : 'border-dl-line-soft hover:bg-dl-mist'"
                  @click="show(activity.id)"
                >
                  <span class="text-[12.5px] text-dl-body">{{ text.when(activity) }}</span>
                  <span class="flex min-w-0 flex-col">
                    <strong class="truncate font-semibold">{{ activity.title }}</strong>
                    <span class="truncate text-xs text-dl-muted">{{ [activity.activity_type?.activity, whoLine(activity), linkedLine(activity)].filter(Boolean).join(' · ') }}</span>
                  </span>
                  <DlBadge size="sm" :tone="KIND_TONE[activity.kind ?? 'field']" class="justify-self-start">{{ text.kind(activity.kind ?? 'field') }}</DlBadge>
                </button>
              </li>
            </ul>
          </section>
          <p v-if="groups.length" class="px-1 pt-3 text-xs text-dl-muted">{{ t('activities.list.count', { count: n(activities.length), month: text.month(month) }, activities.length) }}</p>
        </template>

        <!-- Team calendar -->
        <ActivityCalendar v-else-if="calendar" :calendar="calendar" @open="show" />
      </div>

      <ActivityFormPanel v-if="mode === 'form'" v-model:open="open" :activity="selected" @saved="onSaved" />
      <ActivityPanel v-else-if="selected" v-model:open="open" :activity="selected" @edit="edit" @deleted="onDeleted" />
    </div>

    <!-- Phone: "Add" sits at the bottom, in reach of the thumb -->
    <div v-if="canStore('activities')" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="add">{{ t('activities.form.addTitle') }}</DlButton>
    </div>
  </div>
</template>
