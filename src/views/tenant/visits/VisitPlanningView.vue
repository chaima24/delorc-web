<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { approveVisitPlan, fetchPlanningProfessionals, fetchVisitCalendar, refuseVisitPlan, sendVisitPlan, type CalendarDay, type CalendarVisit, type PlanningProfessional, type VisitCalendar } from '@/api/tenant/visitPlanning'
import { approveVisit, createVisit, fetchVisitPeople, rejectVisit, updateVisit, type VisitPerson } from '@/api/tenant/visits'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { todayIso, useVisitText, visitState } from './visitDisplay'
import VisitNoteSheet from './VisitNoteSheet.vue'
import { addDays, dateOf, isoOf, usePlanningSave, weekStart } from './visitPlanning'

// Visites › Planning: the professionals of the person's cycle at the side, dropped on a day to plan a visit; a
// planned visit is dragged to another day (day view: onto an hour). Month, week and day views. The API checks each
// drop (holiday, day off, maximum of doctors, planning rule, weekend). Mockup: visits-mockups/Planning.html
const { t, n, d } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const toast = useToast()
const text = useVisitText()
const planning = usePlanningSave()
const canPlan = computed(() => auth.can('visits.create'))
const canMove = computed(() => auth.can('visits.update'))

// ── Whose calendar, which period ────────────────────────────────────────────
const people = ref<VisitPerson[]>([])
// "Plans à approuver" opens a person's Planning on a day of their cycle: `?user=12&date=2026-11-01`.
const userId = ref<number | null>(Number(route.query.user) || (auth.user?.id ?? null))
const userModel = computed({ get: () => userId.value, set: value => { userId.value = value == null ? null : Number(value) } })
const view = ref<'month' | 'week' | 'day'>('month')
const anchor = ref(/^\d{4}-\d{2}-\d{2}$/.test(String(route.query.date)) ? String(route.query.date) : todayIso())
const views = computed(() => (['month', 'week', 'day'] as const).map(value => ({ value, label: t(`visits.planning.view.${value}`) })))

const range = computed(() => {
  if (view.value === 'day') return { from: anchor.value, to: anchor.value }
  if (view.value === 'week') return { from: weekStart(anchor.value), to: addDays(weekStart(anchor.value), 6) }
  const first = `${anchor.value.slice(0, 7)}-01`
  const last = isoOf(new Date(dateOf(first).getFullYear(), dateOf(first).getMonth() + 1, 0))
  return { from: weekStart(first), to: addDays(weekStart(last), 6) }
})
const dates = computed(() => {
  const list: string[] = []
  for (let day = range.value.from; day <= range.value.to; day = addDays(day, 1)) list.push(day)
  return list
})
const periodLabel = computed(() => {
  if (view.value === 'day') return text.dayLong(anchor.value)
  if (view.value === 'week') return t('visits.planning.weekOf', { from: text.day(range.value.from), to: text.date(range.value.to) })
  return d(dateOf(anchor.value), { month: 'long', year: 'numeric' })
})
function step(direction: 1 | -1) {
  if (view.value === 'month') {
    const date = dateOf(`${anchor.value.slice(0, 7)}-01`)
    date.setMonth(date.getMonth() + direction)
    anchor.value = isoOf(date)
  }
  else anchor.value = addDays(anchor.value, direction * (view.value === 'week' ? 7 : 1))
}
function openDay(day: string) {
  anchor.value = day
  view.value = 'day'
}

// ── The calendar's data ─────────────────────────────────────────────────────
const calendar = ref<VisitCalendar | null>(null)
const loading = ref(true)
let request = 0
async function load() {
  const current = ++request
  try {
    const result = await fetchVisitCalendar({ user_id: userId.value ?? undefined, ...range.value })
    if (current === request) calendar.value = result
  }
  finally {
    if (current === request) loading.value = false
  }
}
const visitsOf = (day: string) => (calendar.value?.visits ?? []).filter(visit => visit.visit_date === day)
const markOf = (day: string): CalendarDay | undefined => calendar.value?.days.find(mark => mark.date === day)
const isWeekend = (day: string) => !!calendar.value?.weekend_days.includes(dateOf(day).getDay())
/** The cycle that holds the day shown (the first of the period otherwise). */
const cycle = computed(() => calendar.value?.cycles.find(row => row.start_date <= anchor.value && row.end_date >= anchor.value) ?? calendar.value?.cycles[0] ?? null)
const windowText = computed(() => {
  const window = cycle.value?.planning
  if (!window || window.state === 'free' || window.state === 'open') return null
  if (window.state === 'not_open') return t('visits.planning.window.notOpen', { date: text.date(window.opens_on) })
  return t(window.allowed ? 'visits.planning.window.closedAllowed' : 'visits.planning.window.closed', { date: text.date(window.closes_on) })
})

// ── The cycle's plan, when the lab asks a manager to approve it (docs/api/visit-approval.md) ──
const plan = computed(() => (calendar.value?.plan_approval ? cycle.value?.plan ?? null : null))
/** The viewer decides on this person's plan: visits are approved or rejected instead of opened. */
const approving = computed(() => !!plan.value?.can_approve)
const planBusy = ref(false)
async function planAction(action: (cycleId: number) => Promise<unknown>, done: string) {
  if (!cycle.value) return
  planBusy.value = true
  try {
    await action(cycle.value.id)
    toast.success(done)
    await load()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    planBusy.value = false
  }
}
const sendPlan = () => planAction(sendVisitPlan, t('visits.approval.toast.sent'))
const approvePlan = () => planAction(approveVisitPlan, t('visits.approval.toast.approved'))
const refusing = ref(false)
const refusePlan = (reason: string) => refuseVisitPlan(cycle.value!.id, reason)
// One visit: the approver clicks it to approve or reject it.
const deciding = ref<CalendarVisit | null>(null)
const rejecting = ref(false)
async function approveOne() {
  if (!deciding.value) return
  await approveVisit(deciding.value.id).then(() => toast.success(t('visits.approval.toast.visitApproved'))).catch(error => toast.error(errorMessage(error) ?? t('studio.list.toast.failed')))
  deciding.value = null
  load()
}
const rejectOne = (note: string) => rejectVisit(deciding.value!.id, note)
const planBanner = computed(() => {
  const value = plan.value
  if (!value) return null
  const date = text.date(value.decided_at ?? value.sent_at)
  const by = value.decided_by?.full_name ?? ''
  if (value.status === 'refused') return { tone: 'bg-dl-rejected/8', title: t('visits.approval.banner.refused', { date, name: by }), text: value.reason ? `« ${value.reason} »` : '' }
  if (value.counts.waiting) {
    return value.status === 'approved'
      ? { tone: 'bg-dl-pending/8', title: t('visits.approval.banner.changes', { n: n(value.counts.waiting) }, value.counts.waiting), text: t('visits.approval.banner.approved', { date, name: by }) }
      : { tone: 'bg-dl-pending/8', title: t('visits.approval.banner.sent', { date: text.date(value.sent_at) }), text: t('visits.approval.banner.waiting', { n: n(value.counts.waiting) }, value.counts.waiting) }
  }
  if (value.status === 'approved') return { tone: 'bg-dl-signal-soft', title: t('visits.approval.banner.approved', { date, name: by }), text: value.counts.rejected ? t('visits.approval.banner.rejected', { n: n(value.counts.rejected) }, value.counts.rejected) : '' }
  return value.counts.draft ? { tone: 'bg-dl-paper', title: t('visits.approval.banner.draft'), text: t('visits.approval.banner.drafts', { n: n(value.counts.draft) }, value.counts.draft) } : null
})

// ── The side list ───────────────────────────────────────────────────────────
const pros = ref<PlanningProfessional[]>([])
const prosMeta = ref({ total: 0, left: 0, cycle_id: null as number | null })
const search = ref('')
const onlyLeft = ref(false)
let prosRequest = 0
async function loadPros() {
  if (!canPlan.value) return
  const current = ++prosRequest
  const result = await fetchPlanningProfessionals({ user_id: userId.value ?? undefined, date: anchor.value, q: search.value.trim() || undefined, left: onlyLeft.value ? 1 : undefined, per_page: 40 }).catch(() => null)
  if (result && current === prosRequest) {
    pros.value = result.items
    prosMeta.value = { total: result.total, left: result.left, cycle_id: result.cycle_id }
  }
}
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadPros, 300)
})
const reload = () => Promise.all([load(), loadPros()])

onMountedAndFocus(async () => {
  if (canPlan.value) people.value = await fetchVisitPeople().catch(() => [])
  reload()
})
watch([userId, () => range.value.from, () => range.value.to], reload)
watch(onlyLeft, loadPros)
// The side list follows the cycle of the day shown: asked again when the period lands in another one.
watch(() => cycle.value?.id, (id, before) => { if (id !== before && id !== prosMeta.value.cycle_id) loadPros() })

// ── Drag and drop ───────────────────────────────────────────────────────────
type Dragged = { kind: 'pro'; pro: PlanningProfessional } | { kind: 'visit'; visit: CalendarVisit }
const dragged = ref<Dragged | null>(null)
const over = ref<string | null>(null)
const movable = (visit: CalendarVisit) => canMove.value && visit.status === 'planned' && !visit.locked
function start(event: DragEvent, item: Dragged) {
  dragged.value = item
  event.dataTransfer?.setData('text/plain', item.kind) // Firefox starts a drag only with some data
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function end() {
  dragged.value = null
  over.value = null
}
/** Dropped on a day (`time` in the day view): a professional is planned, a planned visit moves. */
async function drop(day: string, time?: string) {
  const item = dragged.value
  end()
  if (!item) return
  if (item.kind === 'pro') {
    const saved = await planning.save(createVisit, {
      user_id: userId.value ?? undefined, visitable_type: 'hcp', visitable_id: item.pro.hcp.id,
      visit_date: day, visit_time: time ?? null, status: 'planned',
    })
    if (saved) toast.success(t('visits.planning.planned', { name: item.pro.hcp.name, day: text.dayLong(day) }))
  }
  else {
    if (item.visit.visit_date === day && (time === undefined || item.visit.visit_time === time)) return
    const saved = await planning.save(payload => updateVisit(item.visit.id, payload), { visit_date: day, ...(time === undefined ? {} : { visit_time: time }) })
    if (saved) toast.success(t('visits.planning.moved', { name: item.visit.target.name ?? '', day: text.dayLong(day) }))
  }
  reload()
}
const dropZone = (key: string) => ({
  onDragover: (event: DragEvent) => { if (dragged.value) { event.preventDefault(); over.value = key } },
  onDragleave: () => { if (over.value === key) over.value = null },
})

const HOURS = Array.from({ length: 11 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`)
const APPROVAL_CLASS = { draft: 'border border-dashed border-dl-muted text-dl-body', waiting: 'bg-dl-pending/12 text-dl-pending', approved: 'bg-dl-cobalt/10 text-dl-cobalt', rejected: 'bg-dl-rejected/10 text-dl-rejected' }
const chipClass = (visit: CalendarVisit) => [
  // A planned visit takes the colour of its place in the plan when the lab asks for an approval.
  visit.status === 'planned' && !visit.late && visit.approval && calendar.value?.plan_approval
    ? APPROVAL_CLASS[visit.approval]
    : { planned: 'bg-dl-cobalt/10 text-dl-cobalt', done: 'bg-dl-teal/12 text-dl-teal', late: 'bg-dl-pending/12 text-dl-pending', cancelled: 'bg-dl-mist text-dl-muted line-through' }[visitState(visit)],
  visit.after_deadline && 'border border-dashed border-dl-cobalt',
]
/** A click opens the visit; for the approver, a waiting or rejected visit opens the decision instead. */
function openVisit(visit: CalendarVisit) {
  if (approving.value && visit.status === 'planned' && (visit.approval === 'waiting' || visit.approval === 'rejected')) deciding.value = visit
  else router.push({ name: 'tenant-visit-detail', params: { id: visit.id } })
}
const dayClass = (day: string) => [
  over.value === day ? 'border-2 border-dashed border-dl-fg bg-dl-signal-soft' : day === todayIso() ? 'border-2 border-dl-fg' : 'border border-dl-line-soft',
  markOf(day)?.kind === 'holiday' ? 'bg-dl-pending/8' : markOf(day)?.kind === 'activity' ? 'bg-dl-cobalt/8' : isWeekend(day) ? 'bg-dl-mist' : '',
]
const weekdays = computed(() => dates.value.slice(0, 7).map(day => d(dateOf(day), { weekday: 'short' })))
</script>

<template>
  <div class="flex w-full items-start gap-4 max-lg:flex-col">
    <aside v-if="canPlan" class="flex w-full shrink-0 flex-col gap-2.5 rounded-3xl bg-dl-paper p-3.5 lg:sticky lg:top-4 lg:w-[300px]">
      <h2 class="text-sm font-bold">{{ t('visits.planning.list.title') }}</h2>
      <DlInput v-model="search" type="search" icon="tabler-search" :label="t('visits.planning.list.search')" :placeholder="t('visits.planning.list.search')" hide-label />
      <div class="flex flex-wrap gap-1.5">
        <button type="button" class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="onlyLeft ? 'bg-dl-fg text-dl-bg' : 'bg-dl-mist text-dl-body'" :aria-pressed="onlyLeft" @click="onlyLeft = !onlyLeft">{{ t('visits.planning.list.left', { n: n(prosMeta.left) }) }}</button>
        <span class="rounded-full bg-dl-mist px-2.5 py-1 text-xs font-semibold text-dl-body">{{ t('visits.planning.list.all', { n: n(prosMeta.total) }) }}</span>
      </div>
      <p v-if="!prosMeta.cycle_id && !search" class="rounded-xl bg-dl-mist px-3 py-2.5 text-xs text-dl-muted">{{ t('visits.planning.list.noCycle') }}</p>
      <ul class="flex max-h-[62vh] flex-col gap-1.5 overflow-y-auto">
        <li
          v-for="pro in pros"
          :key="pro.hcp.id"
          draggable="true"
          class="flex cursor-grab items-center gap-2 rounded-xl border border-dl-line px-2.5 py-1.5 text-[13px]"
          :class="[pro.left === 0 && 'opacity-55', dragged?.kind === 'pro' && dragged.pro.hcp.id === pro.hcp.id && 'border-dl-fg']"
          @dragstart="start($event, { kind: 'pro', pro })"
          @dragend="end"
        >
          <i class="h-[9px] w-[9px] shrink-0 rounded-[3px]" :style="{ background: pro.segment?.color ?? 'rgb(var(--dl-line))' }" :title="pro.segment?.name ?? undefined" />
          <span class="min-w-0 flex-1">
            <span class="block truncate">{{ pro.hcp.name }}</span>
            <small class="block truncate text-[11.5px] text-dl-muted">{{ [pro.hcp.speciality, pro.hcp.commune].filter(Boolean).join(' · ') }}</small>
          </span>
          <DlBadge v-if="pro.off_list" size="sm" tone="warning">{{ t('visits.offList') }}</DlBadge>
          <span v-else class="whitespace-nowrap text-[11.5px] font-semibold" :class="pro.left ? 'text-dl-fg' : 'text-dl-muted'">{{ pro.left ? t('visits.planning.list.leftOf', { left: pro.left, toDo: pro.to_do ?? 0 }) : t('visits.planning.list.allPlanned') }}</span>
        </li>
      </ul>
      <p class="text-xs text-dl-muted">{{ t('visits.planning.list.hint') }}</p>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col gap-4 max-lg:w-full">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.visits') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[36px]">{{ t('visits.planning.title') }}</h1>
          <p class="text-[13px] text-dl-muted">
            <template v-if="cycle">{{ t('visits.planning.cycleLine', { from: text.date(cycle.start_date), to: text.date(cycle.end_date), done: n(cycle.done), planned: n(cycle.planned), toDo: n(cycle.to_do) }) }}</template>
            <template v-else>{{ t('visits.planning.noCycle') }}</template>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <DlSelect v-if="people.length > 1" v-model="userModel" :label="t('visits.fields.person')" :options="people.map(person => ({ value: person.id, label: person.full_name }))" appearance="filter" />
          <DlIconButton icon="tabler-chevron-left" variant="outline" :size="38" :label="t('visits.planning.previous')" @click="step(-1)" />
          <strong class="min-w-36 text-center text-sm first-letter:uppercase">{{ periodLabel }}</strong>
          <DlIconButton icon="tabler-chevron-right" variant="outline" :size="38" :label="t('visits.planning.next')" @click="step(1)" />
          <DlButton variant="outline" size="sm" @click="anchor = todayIso()">{{ t('visits.planning.today') }}</DlButton>
          <DlSegmented v-model="view" :label="t('visits.planning.viewLabel')" :items="views" />
        </div>
      </div>
      <p v-if="windowText" class="rounded-2xl px-4 py-2.5 text-[13px]" :class="cycle?.planning.allowed ? 'bg-dl-pending/8 text-dl-pending' : 'bg-dl-rejected/8 text-dl-rejected'">{{ windowText }}</p>

      <div v-if="planBanner" class="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-[13.5px]" :class="planBanner.tone">
        <span class="min-w-0 flex-1"><strong class="block">{{ planBanner.title }}</strong><small v-if="planBanner.text" class="text-[12.5px] text-dl-muted">{{ planBanner.text }}</small></span>
        <DlButton v-if="plan?.can_send" variant="primary" :loading="planBusy" @click="sendPlan">{{ t(plan.status === 'draft' ? 'visits.approval.send' : 'visits.approval.sendAgain') }}</DlButton>
        <template v-if="approving && plan?.counts.waiting">
          <DlButton variant="outline" :disabled="planBusy" @click="refusing = true">{{ t('visits.approval.refuse') }}</DlButton>
          <DlButton variant="primary" :loading="planBusy" @click="approvePlan">{{ t('visits.approval.approve') }}</DlButton>
        </template>
      </div>
      <p v-if="approving && plan?.counts.waiting" class="-mt-2 text-xs text-dl-muted">{{ t('visits.approval.clickHint') }}</p>

      <DlSkeleton v-if="loading" class="h-[520px] rounded-3xl" />
      <section v-else class="rounded-3xl bg-dl-paper p-3.5" :aria-label="t('visits.planning.title')">
        <!-- Month and week: one cell per day. -->
        <template v-if="view !== 'day'">
          <div class="mb-1.5 grid grid-cols-7 gap-1.5">
            <span v-for="(name, index) in weekdays" :key="index" class="px-1.5 text-xs font-semibold text-dl-muted first-letter:uppercase">{{ name }}</span>
          </div>
          <div class="grid grid-cols-7 gap-1.5">
            <div
              v-for="day in dates"
              :key="day"
              class="flex flex-col gap-1 rounded-xl p-1.5 text-[11.5px]"
              :class="[dayClass(day), view === 'month' ? 'min-h-[96px]' : 'min-h-[380px]', view === 'month' && day.slice(0, 7) !== anchor.slice(0, 7) && 'opacity-40']"
              v-bind="dropZone(day)"
              @drop.prevent="drop(day)"
            >
              <button type="button" class="self-start rounded px-1 text-[12.5px] font-bold hover:bg-dl-mist" :aria-label="text.dayLong(day)" @click="openDay(day)">{{ Number(day.slice(8)) }}</button>
              <span v-if="markOf(day)" class="truncate text-dl-muted">{{ markOf(day)!.name ?? t(`visits.planning.mark.${markOf(day)!.kind}`) }}<template v-if="markOf(day)!.kind === 'half'"> · ½</template></span>
              <span v-else-if="isWeekend(day)" class="text-dl-muted">{{ t('visits.planning.mark.weekend') }}</span>
              <button
                v-for="visit in visitsOf(day).slice(0, view === 'month' ? 3 : undefined)"
                :key="visit.id"
                type="button"
                class="truncate rounded-md px-1.5 py-0.5 text-start font-semibold"
                :class="[chipClass(visit), view === 'week' && 'whitespace-normal py-1.5']"
                :draggable="movable(visit)"
                :title="`${visit.target.name} · ${text.state(visit)}${visit.after_deadline ? ` · ${t('visits.planning.afterDeadline')}` : ''}`"
                @dragstart="start($event, { kind: 'visit', visit })"
                @dragend="end"
                @click="openVisit(visit)"
              >
                <template v-if="visit.visit_time">{{ visit.visit_time }} · </template>{{ visit.target.name }}
                <small v-if="view === 'week'" class="block font-normal opacity-80">{{ visit.after_deadline ? t('visits.planning.afterDeadline') : (visit.target.commune ?? '') }}</small>
              </button>
              <button v-if="view === 'month' && visitsOf(day).length > 3" type="button" class="self-start px-1 text-dl-muted hover:underline" @click="openDay(day)">{{ t('visits.planning.more', { n: visitsOf(day).length - 3 }) }}</button>
            </div>
          </div>
        </template>

        <!-- Day: the visits with no hour on top, then one row per hour. -->
        <template v-else>
          <p v-if="markOf(anchor) || isWeekend(anchor)" class="mb-2 rounded-xl bg-dl-mist px-3 py-2 text-[13px] text-dl-muted">
            {{ markOf(anchor)?.name ?? t(`visits.planning.mark.${markOf(anchor)?.kind ?? 'weekend'}`) }}
          </p>
          <div class="flex min-h-12 flex-wrap items-center gap-2 border-b border-dl-line px-1 pb-2.5" :class="over === 'none' && 'bg-dl-signal-soft'" v-bind="dropZone('none')" @drop.prevent="drop(anchor)">
            <strong class="w-24 text-[13px]">{{ t('visits.planning.noTime') }}</strong>
            <button v-for="visit in visitsOf(anchor).filter(row => !row.visit_time)" :key="visit.id" type="button" class="rounded-lg px-2.5 py-1.5 text-xs font-semibold" :class="chipClass(visit)" :draggable="movable(visit)" @dragstart="start($event, { kind: 'visit', visit })" @dragend="end" @click="openVisit(visit)">{{ visit.target.name }}</button>
            <span class="text-xs text-dl-muted">{{ t('visits.planning.noTimeHint') }}</span>
          </div>
          <div v-for="hour in HOURS" :key="hour" class="grid min-h-11 grid-cols-[56px_1fr] border-b border-dl-line-soft text-xs" :class="over === hour && 'bg-dl-signal-soft'" v-bind="dropZone(hour)" @drop.prevent="drop(anchor, hour)">
            <span class="px-1 py-1.5 text-dl-muted">{{ hour }}</span>
            <span class="flex flex-wrap items-center gap-1.5 py-1">
              <button v-for="visit in visitsOf(anchor).filter(row => row.visit_time?.slice(0, 2) === hour.slice(0, 2))" :key="visit.id" type="button" class="rounded-lg px-2.5 py-1.5 font-semibold" :class="chipClass(visit)" :draggable="movable(visit)" @dragstart="start($event, { kind: 'visit', visit })" @dragend="end" @click="openVisit(visit)">
                {{ visit.visit_time }} · {{ visit.target.name }}<template v-if="visit.target.commune"> · {{ visit.target.commune }}</template>
              </button>
            </span>
          </div>
        </template>

        <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dl-muted">
          <li><span class="rounded-md bg-dl-cobalt/10 px-1.5 py-0.5 font-semibold text-dl-cobalt">{{ t('visits.state.planned') }}</span></li>
          <li><span class="rounded-md bg-dl-teal/12 px-1.5 py-0.5 font-semibold text-dl-teal">{{ t('visits.state.done') }}</span></li>
          <li><span class="rounded-md bg-dl-pending/12 px-1.5 py-0.5 font-semibold text-dl-pending">{{ t('visits.state.late') }}</span></li>
          <li><span class="rounded-md border border-dashed border-dl-cobalt px-1.5 py-0.5 font-semibold text-dl-cobalt">{{ t('visits.planning.afterDeadline') }}</span></li>
          <template v-if="plan">
            <li v-for="state in (['draft', 'waiting', 'approved', 'rejected'] as const)" :key="state"><span class="rounded-md px-1.5 py-0.5 font-semibold" :class="APPROVAL_CLASS[state]">{{ t(`visits.approval.state.${state}`) }}</span></li>
          </template>
        </ul>
      </section>
    </div>

    <!-- The approver's decision on one visit, and the reason of a refused plan. -->
    <div v-if="deciding && !rejecting" class="fixed inset-0 z-900 flex items-center justify-center bg-dl-fg/40 p-4" @click.self="deciding = null">
      <div class="flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-dl-paper p-5 text-[13.5px]" role="dialog" :aria-label="deciding.target.name ?? ''">
        <strong class="text-base">{{ deciding.target.name }}</strong>
        <span class="text-dl-muted first-letter:uppercase">{{ text.dayLong(deciding.visit_date) }} · {{ t(`visits.approval.state.${deciding.approval}`) }}</span>
        <p v-if="deciding.approval_note" class="rounded-xl bg-dl-rejected/8 px-3 py-2 text-xs text-dl-rejected">« {{ deciding.approval_note }} »</p>
        <div class="flex gap-2">
          <DlButton v-if="deciding.approval === 'waiting'" variant="outline" class="flex-1" @click="rejecting = true">{{ t('visits.approval.rejectVisit') }}</DlButton>
          <DlButton variant="primary" class="flex-1" @click="approveOne">{{ t('visits.approval.approveVisit') }}</DlButton>
        </div>
        <DlButton variant="ghost" size="sm" :to="{ name: 'tenant-visit-detail', params: { id: deciding.id } }">{{ t('visits.open') }}</DlButton>
      </div>
    </div>
    <VisitNoteSheet v-if="deciding" v-model:open="rejecting" :title="t('visits.approval.rejectVisit')" :description="`${deciding.target.name ?? ''} · ${text.dayLong(deciding.visit_date)}`" :label="t('visits.approval.note')" :confirm-label="t('visits.approval.rejectVisit')" :run="rejectOne" @done="deciding = null; load()" />
    <VisitNoteSheet v-model:open="refusing" :title="t('visits.approval.refuse')" :description="calendar?.user.full_name" :label="t('visits.approval.reason')" :hint="t('visits.approval.refuseHint')" :confirm-label="t('visits.approval.refuse')" :run="refusePlan" @done="load()" />
  </div>
</template>
