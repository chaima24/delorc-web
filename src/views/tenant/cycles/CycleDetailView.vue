<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { deleteCycle, fetchCycle, type CycleDay, type CycleDetail } from '@/api/tenant/cycles'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlTabs from '@/components/DlTabs.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import CycleActivitiesTab from './CycleActivitiesTab.vue'
import CycleAddPanel from './CycleAddPanel.vue'
import CycleDatesSection from './CycleDatesSection.vue'
import CycleDaysStrip from './CycleDaysStrip.vue'
import CycleGoalSection from './CycleGoalSection.vue'
import CycleHistoryTab from './CycleHistoryTab.vue'
import CycleProfessionalsTab from './CycleProfessionalsTab.vue'
import CycleTerritoryPanel from './CycleTerritoryPanel.vue'
import { STATE_TONE, useCycleText } from './cycleDisplay'

// A cycle as a full page: four figures, the days strip (live), then tabs; the visit figures and the Visites tab come
// with visits. The side panel holds
// "Add professionals", "Check territory", a day, or the dates. Mockup: docs/design/plan-mockups/Cycles.html (frames 6–7)
const props = defineProps<{ id: string }>()
const { t, n } = useI18n()
const router = useRouter()
const text = useCycleText()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canDelete = (resource: string) => auth.can(`${resource}.delete`)
const canStore = (resource: string) => auth.can(`${resource}.create`)
const canUpdate = (resource: string) => auth.can(`${resource}.update`)

const cycle = ref<CycleDetail | null>(null)
const failed = ref(false)
async function load() {
  try {
    cycle.value = await fetchCycle(Number(props.id))
    failed.value = false
  }
  catch {
    failed.value = true
  }
}
watch(() => props.id, () => { cycle.value = null; load() }, { immediate: true })

const tab = ref('professionals')
const tabs = computed(() => [
  { value: 'professionals', label: `${t('cycles.tabs.professionals')} · ${n(cycle.value?.professionals ?? 0)}` },
  { value: 'visits', label: t('cycles.tabs.visits') },
  { value: 'activities', label: t('cycles.tabs.activities') },
  { value: 'history', label: t('cycles.tabs.history') },
])

// Side panel
const open = ref(false)
const panel = ref<'add' | 'check' | 'day' | 'dates' | null>(null)
const day = ref<CycleDay | null>(null)
function openPanel(kind: 'add' | 'check' | 'dates') {
  panel.value = kind
  open.value = true
}
function showDay(picked: CycleDay) {
  day.value = picked
  panel.value = 'day'
  open.value = true
}
const professionals = ref<InstanceType<typeof CycleProfessionalsTab> | null>(null)
function onAdded() {
  professionals.value?.reload()
  load()
}

async function remove() {
  if (!cycle.value) return
  const ok = await confirm({
    title: t('cycles.delete.title', { name: cycle.value.user?.full_name ?? '' }),
    text: t('cycles.delete.text'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteCycle(cycle.value.id)
    toast.success(t('studio.list.toast.deleted'))
    router.push({ name: 'tenant-cycles', query: { month: cycle.value.start_date.slice(0, 7) } })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

const dayCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const d of cycle.value?.days ?? []) counts[d.kind] = (counts[d.kind] ?? 0) + 1
  return counts
})
/** Doctor + pharmacy + wholesaler visits a day: the goal's rate. */
const visitsPerDay = computed(() => (['doctor', 'pharmacy', 'wholesaler'] as const).reduce((sum, key) => sum + (cycle.value?.goal[key]?.per_day ?? 0), 0))
const daysWhy = computed(() => {
  if (!cycle.value) return ''
  const off = cycle.value.off.map(row => `${text.days(row.days)} ${row.name}`).join(', ')
  return t('cycles.days.why', {
    working: n(cycle.value.working_days),
    off: off ? ` − ${off}` : '',
    field: text.days(cycle.value.field_days),
    goal: n(cycle.value.goal_visits),
  })
})
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <DlEmptyState v-if="failed" icon="tabler-refresh-off" :title="t('cycles.page.notFound')">
      <DlButton variant="outline" :to="{ name: 'tenant-cycles' }">{{ t('cycles.page.back') }}</DlButton>
    </DlEmptyState>
    <template v-else-if="!cycle">
      <DlSkeleton class="h-20 rounded-2xl" />
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><DlSkeleton v-for="i in 4" :key="i" class="h-28 rounded-2xl" /></div>
      <DlSkeleton class="h-40 rounded-2xl" />
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
            <RouterLink :to="{ name: 'tenant-cycles', query: { month: cycle.start_date.slice(0, 7) } }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('cycles.title') }}</RouterLink>
            <span aria-hidden="true">›</span><span class="first-letter:uppercase">{{ text.month(cycle.start_date.slice(0, 7)) }}</span>
          </nav>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ cycle.user?.full_name }}</h1>
          <p class="flex flex-wrap items-center gap-2 text-[13px] text-dl-muted">
            <DlBadge size="sm" :tone="STATE_TONE[cycle.state]" :dot="cycle.state === 'running'">{{ text.state(cycle.state, cycle.start_date) }}</DlBadge>
            {{ text.period(cycle.start_date, cycle.end_date) }} · {{ text.roleTeam(cycle.user) }}
            <template v-if="cycle.territory">· <RouterLink :to="{ name: 'tenant-territory-detail', params: { id: cycle.territory.id } }" class="text-dl-cobalt no-underline hover:underline">{{ cycle.territory.name }}</RouterLink></template>
          </p>
        </div>
        <div class="flex flex-wrap gap-2.5">
          <DlButton v-if="canUpdate('cycles')" variant="outline" icon="tabler-pencil" @click="openPanel('dates')">{{ t('cycles.dates.edit') }}</DlButton>
          <DlButton v-if="canStore('cycles') && !cycle.next" variant="outline" icon="tabler-copy" :to="{ name: 'tenant-cycle-create', query: { prepare: cycle.end_date.slice(0, 7), users: String(cycle.user?.id ?? '') } }">{{ t('cycles.page.prepareNext') }}</DlButton>
          <DlButton v-if="canDelete('cycles')" variant="outline" icon="tabler-trash" class="text-dl-rejected" @click="remove">{{ t('common.actions.delete') }}</DlButton>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="flex flex-col gap-1.5 rounded-[20px] bg-dl-paper px-4 py-4">
          <span class="text-[12.5px] text-dl-muted">{{ t('cycles.columns.professionals') }}</span>
          <strong class="font-display text-[30px] font-extrabold tracking-[-0.02em]">{{ n(cycle.professionals) }}</strong>
          <small class="text-xs text-dl-muted">{{ t('cycles.figures.noSegment', { n: n(cycle.no_segment) }, cycle.no_segment) }}</small>
        </div>
        <div class="flex flex-col gap-1.5 rounded-[20px] bg-dl-paper px-4 py-4">
          <span class="text-[12.5px] text-dl-muted">{{ t('cycles.figures.toDo') }}</span>
          <strong class="font-display text-[30px] font-extrabold tracking-[-0.02em]">{{ n(cycle.to_do) }}</strong>
          <small class="text-xs text-dl-muted">{{ cycle.has_grid ? t('cycles.figures.toDoText') : t('cycles.figures.noGrid') }}</small>
        </div>
        <div class="flex flex-col gap-1.5 rounded-[20px] bg-dl-paper px-4 py-4">
          <span class="text-[12.5px] text-dl-muted">{{ t('cycles.figures.goalShort') }}</span>
          <strong class="font-display text-[30px] font-extrabold tracking-[-0.02em]">{{ n(cycle.goal_visits) }}</strong>
          <small class="text-xs text-dl-muted">{{ t('cycles.figures.goal', { perDay: n(visitsPerDay), days: text.days(cycle.field_days) }) }}</small>
        </div>
        <div class="flex flex-col gap-1.5 rounded-[20px] bg-dl-paper px-4 py-4">
          <span class="text-[12.5px] text-dl-muted">{{ t('cycles.columns.visits') }}</span>
          <strong class="font-display text-[20px] font-extrabold tracking-[-0.02em] text-dl-muted">—</strong>
          <small class="text-xs text-dl-muted">{{ t('cycles.laterVisits') }}</small>
        </div>
      </div>

      <div class="flex items-start gap-5">
        <div class="flex min-w-0 flex-1 flex-col gap-5">
          <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" :aria-label="t('cycles.days.title')">
            <header class="flex flex-wrap items-center gap-2.5">
              <h2 class="flex-1 text-[15px] font-semibold">{{ t('cycles.days.title') }}</h2>
              <span class="text-xs text-dl-muted">
                {{ t('cycles.days.summary', { activity: n(dayCounts.activity ?? 0), half: n(dayCounts.half ?? 0), future: n(dayCounts.future ?? 0) }) }}
              </span>
            </header>
            <CycleDaysStrip :days="cycle.days" legend @pick="showDay" />
            <p class="rounded-xl bg-dl-mist px-3 py-2 text-[12.5px] text-dl-body">{{ daysWhy }}</p>
          </section>

          <DlTabs v-model="tab" :label="cycle.user?.full_name ?? t('cycles.title')" :items="tabs">
            <template #professionals>
              <CycleProfessionalsTab ref="professionals" :cycle="cycle" @changed="load" @add="openPanel('add')" @check="openPanel('check')" />
            </template>
            <template #visits><p class="rounded-3xl bg-dl-paper p-6 text-center text-sm text-dl-muted">{{ t('cycles.laterVisits') }}</p></template>
            <template #activities><CycleActivitiesTab :cycle="cycle" /></template>
            <template #history><CycleHistoryTab :cycle="cycle" /></template>
          </DlTabs>
        </div>

        <CycleAddPanel v-if="panel === 'add'" v-model:open="open" :cycle="cycle" @added="onAdded" />
        <CycleTerritoryPanel v-else-if="panel === 'check'" v-model:open="open" :cycle="cycle" @added="onAdded" />
        <DlRecordPanel v-else-if="panel === 'dates'" v-model:open="open" :title="t('cycles.dates.title')">
          <div class="flex flex-col gap-3.5">
            <CycleDatesSection :cycle="cycle" @saved="value => { cycle = value; professionals?.reload() }" />
            <CycleGoalSection :cycle="cycle" />
          </div>
        </DlRecordPanel>
        <DlRecordPanel v-else-if="panel === 'day' && day" v-model:open="open" :title="text.dayLong(day.date)">
          <dl class="grid grid-cols-[120px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
            <dt class="text-dl-muted">{{ t('cycles.days.dayKind') }}</dt><dd>{{ t(`cycles.days.kind.${day.kind}`) }}</dd>
            <dt class="text-dl-muted">{{ t('cycles.tabs.activities') }}</dt><dd>{{ n(day.activity_ids.length) }}</dd>
          </dl>
          <p class="mt-3 text-xs text-dl-muted">{{ t('cycles.laterVisits') }}</p>
        </DlRecordPanel>
      </div>
    </template>
  </div>
</template>
