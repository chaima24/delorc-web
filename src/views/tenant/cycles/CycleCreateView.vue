<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  createCycles,
  fetchCycleCandidates,
  fetchWholeBoard,
  previewCycles,
  type CycleCandidate,
  type CycleFill,
  type CyclePreviewRow,
} from '@/api/tenant/cycles'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSteps from '@/components/DlSteps.vue'
import { useToast } from '@/composables/useToast'
import { roleLabel, useRolesAndTeams, useTeamOptions } from '@/views/tenant/settings/shared/lookups'
import { today } from '@/views/tenant/users/userDisplay'
import { monthRange, shiftMonth, useCycleText } from './cycleDisplay'

// "Create cycles" (own page, 3 steps): period, people, how each cycle is filled. "Prepare next month"
// opens it with the people whose cycle ends this month. Mockup: docs/design/plan-mockups/Cycles.html (frames 3–5)
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const text = useCycleText()
const { roles } = useRolesAndTeams()
const { teams } = useTeamOptions()

const isMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)
const prepare = isMonth(route.query.prepare) ? route.query.prepare : null
const step = ref(0)

// Step 1: period
const periodKind = ref<'month' | 'dates'>('month')
const month = ref(prepare ? shiftMonth(prepare, 1) : isMonth(route.query.month) ? route.query.month : shiftMonth(today().slice(0, 7), 1))
const dates = reactive({ start: '', end: '' })
const period = computed(() => periodKind.value === 'month'
  ? { start: monthRange(month.value).from, end: monthRange(month.value).to }
  : { start: dates.start, end: dates.end })
const periodValid = computed(() => !!period.value.start && !!period.value.end && period.value.end >= period.value.start)
const periodItems = computed(() => [{ value: 'month', label: t('cycles.create.aMonth') }, { value: 'dates', label: t('cycles.create.otherDates') }])

// Step 2: people
const ALL = 'all'
const filters = reactive({ role: ALL as string | number, team: ALL as string | number, q: '' })
const people = ref<CycleCandidate[]>([])
const workingDays = ref<number | null>(null)
const loadingPeople = ref(false)
const picked = ref(new Set<number>())
const wanted = ref<number[] | null>(typeof route.query.users === 'string' && route.query.users ? route.query.users.split(',').map(Number).filter(Boolean) : null)

async function loadPeople() {
  if (!periodValid.value) return
  loadingPeople.value = true
  try {
    const body = await fetchCycleCandidates({
      start_date: period.value.start,
      end_date: period.value.end,
      role_id: filters.role === ALL ? undefined : Number(filters.role),
      team_id: filters.team === ALL ? undefined : Number(filters.team),
      q: filters.q.trim() || undefined,
    })
    people.value = body.people
    workingDays.value = body.working_days
    // Keep picks that are still possible; first load picks everyone possible (or the people asked for).
    const possible = new Set(body.people.filter(person => !person.blocked).map(person => person.id))
    if (wanted.value) {
      picked.value = new Set(wanted.value.filter(id => possible.has(id)))
      wanted.value = null
    }
    else if (!picked.value.size && !touched.value) picked.value = possible
    else picked.value = new Set([...picked.value].filter(id => possible.has(id) || !body.people.some(person => person.id === id)))
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    loadingPeople.value = false
  }
}
const touched = ref(false)
watch([() => period.value.start, () => period.value.end], () => { workingDays.value = null; if (periodValid.value) loadPeople() }, { immediate: true })
watch(() => ({ ...filters }), loadPeople, { deep: true })

function toggle(person: CycleCandidate) {
  if (person.blocked) return
  touched.value = true
  const next = new Set(picked.value)
  next.has(person.id) ? next.delete(person.id) : next.add(person.id)
  picked.value = next
}
const possible = computed(() => people.value.filter(person => !person.blocked))
const allPicked = computed(() => possible.value.length > 0 && possible.value.every(person => picked.value.has(person.id)))
function toggleAll() {
  touched.value = true
  const next = new Set(picked.value)
  for (const person of possible.value) allPicked.value ? next.delete(person.id) : next.add(person.id)
  picked.value = next
}
const blockedCount = computed(() => people.value.filter(person => person.blocked).length)
const roleOptions = computed(() => [{ value: ALL, label: t('users.filter.allRoles') }, ...roles.value])
const teamOptions = computed(() => [{ value: ALL, label: t('users.filter.allTeams') }, ...teams.value])

function reason(person: CycleCandidate) {
  if (person.blocked === 'has_cycle' && person.cycle) return t('cycles.create.reason.hasCycle', { date: text.day(person.cycle.start_date) })
  if (person.blocked === 'no_objective') return t('cycles.create.reason.noObjective', { name: text.roleTeam(person) })
  if (person.warning === 'no_territory') return t('cycles.create.reason.noTerritory')
  if (person.warning === 'no_grid') return t('cycles.create.reason.noGrid')
  return ''
}

// "Prepare next month": the people whose cycle ends in that month with no next one.
if (prepare) {
  fetchWholeBoard({ month: prepare }).then((rows) => {
    const { to } = monthRange(prepare)
    const ids = rows.filter(row => !row.has_next && row.end_date <= to).map(row => row.user?.id).filter((id): id is number => !!id)
    wanted.value = typeof route.query.users === 'string' && route.query.users ? route.query.users.split(',').map(Number) : ids
    step.value = 1
    loadPeople()
  }).catch(() => toast.error(t('studio.list.toast.failed')))
}

// Step 3: how each cycle is filled
const fill = ref<CycleFill>('previous')
const FILLS: CycleFill[] = ['previous', 'territory', 'none']
const preview = ref<CyclePreviewRow[]>([])
const loadingPreview = ref(false)
async function loadPreview() {
  if (!picked.value.size) return
  loadingPreview.value = true
  try {
    preview.value = await previewCycles({ start_date: period.value.start, user_ids: [...picked.value], fill: fill.value })
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    loadingPreview.value = false
  }
}
watch([fill, step], () => { if (step.value === 2) loadPreview() })
const kindsByRole = computed(() => {
  const byRole = new Map<string, string[]>()
  for (const person of people.value.filter(p => picked.value.has(p.id))) {
    if (person.role) byRole.set(roleLabel(person.role.name), person.role.visits)
  }
  return [...byRole.entries()].map(([role, kinds]) => `${role} → ${kinds.map(kind => text.kind(kind)).join(', ')}`).join(' · ')
})
const totals = computed(() => ({
  all: preview.value.reduce((sum, row) => sum + row.total, 0),
  noSegment: preview.value.reduce((sum, row) => sum + row.no_segment, 0),
}))

const saving = ref(false)
async function create() {
  saving.value = true
  try {
    const body = await createCycles({ start_date: period.value.start, end_date: period.value.end, user_ids: [...picked.value], fill: fill.value })
    toast.success(t('cycles.create.done', body.data.length))
    if (body.skipped?.length) toast.error(t('cycles.create.skipped', body.skipped.length))
    router.push({ name: 'tenant-cycles', query: { month: period.value.start.slice(0, 7) } })
  }
  catch {
    toast.error(t('cycles.create.failed'))
  }
  finally {
    saving.value = false
  }
}

const steps = computed(() => [t('cycles.create.steps.period'), t('cycles.create.steps.people'), t('cycles.create.steps.professionals')])
const canNext = computed(() => (step.value === 0 ? periodValid.value : step.value === 1 ? picked.value.size > 0 : true))
function next() {
  if (step.value < 2) step.value++
  else create()
}
function back() {
  if (step.value) step.value--
  else router.push({ name: 'tenant-cycles' })
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex flex-col gap-1.5">
      <nav class="flex items-center gap-1.5 text-sm text-dl-muted" :aria-label="t('common.breadcrumb.ariaLabel')">
        <RouterLink :to="{ name: 'tenant-cycles' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('cycles.title') }}</RouterLink>
        <span aria-hidden="true">›</span><span>{{ t('cycles.create.title') }}</span>
      </nav>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">{{ t('cycles.create.title') }}</h1>
    </div>

    <div class="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
      <div class="flex flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-6">
        <DlSteps :steps="steps" :current="step" />

        <!-- 1 Period -->
        <template v-if="step === 0">
          <div class="flex flex-col gap-1.5">
            <span class="text-[13px] font-semibold">{{ t('cycles.create.period') }}</span>
            <DlSegmented v-model="periodKind" :label="t('cycles.create.period')" :items="periodItems" class="w-max" />
          </div>
          <div v-if="periodKind === 'month'" class="flex flex-col gap-1.5">
            <span class="text-[13px] font-semibold">{{ t('cycles.create.month') }}</span>
            <span class="flex w-max items-center gap-1 rounded-2xl border border-dl-line bg-dl-paper p-1">
              <DlIconButton icon="tabler-chevron-left" variant="ghost" :size="34" :label="t('activities.month.previous')" class="rtl:-scale-x-100" @click="month = shiftMonth(month, -1)" />
              <strong class="min-w-36 px-2 text-center text-[13px] first-letter:uppercase">{{ text.month(month) }}</strong>
              <DlIconButton icon="tabler-chevron-right" variant="ghost" :size="34" :label="t('activities.month.next')" class="rtl:-scale-x-100" @click="month = shiftMonth(month, 1)" />
            </span>
          </div>
          <div v-else class="grid max-w-md grid-cols-2 gap-2.5">
            <DlInput v-model="dates.start" type="date" :label="t('cycles.dates.start')" />
            <DlInput v-model="dates.end" type="date" :min="dates.start" :label="t('cycles.dates.end')" />
          </div>
          <p v-if="periodValid" class="text-xs text-dl-muted">
            {{ text.period(period.start, period.end) }}<template v-if="workingDays != null"> · {{ t('cycles.goal.workingDays', workingDays) }} {{ t('cycles.create.workingHint') }}</template>
          </p>
          <p class="rounded-xl bg-dl-mist px-3 py-2 text-[12.5px] text-dl-body">{{ t('cycles.create.periodWhy') }}</p>
        </template>

        <!-- 2 People -->
        <template v-else-if="step === 1">
          <div class="flex flex-wrap gap-2.5">
            <DlSelect v-model="filters.role" :label="t('cycles.filter.role')" :options="roleOptions" appearance="filter" />
            <DlSelect v-model="filters.team" :label="t('cycles.filter.team')" :options="teamOptions" appearance="filter" />
            <DlInput v-model="filters.q" type="search" icon="tabler-search" :label="t('cycles.create.name')" :placeholder="t('cycles.create.name')" hide-label class="min-w-48 flex-1" />
          </div>
          <div v-if="loadingPeople && !people.length" class="flex flex-col gap-2"><DlSkeleton v-for="i in 4" :key="i" class="h-12 rounded-xl" /></div>
          <p v-else-if="!people.length" class="py-6 text-center text-sm text-dl-muted">{{ t('cycles.create.nobody') }}</p>
          <table v-else class="w-full border-collapse text-sm">
            <thead>
              <tr class="text-start text-xs text-dl-muted">
                <th class="w-8 border-b border-dl-line px-2 py-2.5"><input type="checkbox" class="h-[18px] w-[18px] accent-dl-ink" :checked="allPicked" :aria-label="t('cycles.create.pickAll')" @change="toggleAll"></th>
                <th class="border-b border-dl-line px-2 py-2.5 text-start font-semibold">{{ t('cycles.columns.person') }}</th>
                <th class="border-b border-dl-line px-2 py-2.5 text-start font-semibold max-md:hidden">{{ t('cycles.columns.territory') }}</th>
                <th class="border-b border-dl-line px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="person in people" :key="person.id" class="border-b border-dl-line-soft" :class="!person.blocked && 'cursor-pointer hover:bg-dl-mist'" @click="toggle(person)">
                <td class="px-2 py-2.5"><input type="checkbox" class="h-[18px] w-[18px] accent-dl-ink" :checked="picked.has(person.id)" :disabled="!!person.blocked" :aria-label="person.full_name" @click.stop="toggle(person)"></td>
                <td class="px-2 py-2.5">
                  <span class="flex items-center gap-2.5">
                    <DlAvatar :name="person.full_name" size="sm" :tone="person.blocked ? 'neutral' : 'cobalt'" />
                    <span><strong class="block font-semibold" :class="person.blocked && 'text-dl-muted'">{{ person.full_name }}</strong><small class="block text-xs text-dl-muted">{{ text.roleTeam(person) }}</small></span>
                  </span>
                </td>
                <td class="px-2 py-2.5 max-md:hidden">{{ person.territory?.name ?? '—' }}</td>
                <td class="px-2 py-2.5 text-[12.5px]" :class="person.blocked ? 'text-dl-muted' : 'text-dl-pending'">{{ reason(person) }}</td>
              </tr>
            </tbody>
          </table>
          <p class="text-xs text-dl-muted">{{ t('cycles.create.pickedHint', { picked: n(picked.size), total: n(people.length) }) }}<template v-if="blockedCount">&nbsp;{{ t('cycles.create.greyHint') }}</template></p>
        </template>

        <!-- 3 Professionals -->
        <template v-else>
          <div class="flex flex-col gap-2">
            <span class="text-[13px] font-semibold">{{ t('cycles.create.fillWith') }}</span>
            <label
              v-for="option in FILLS"
              :key="option"
              class="flex cursor-pointer items-start gap-3 rounded-2xl px-3.5 py-3 text-[13px]"
              :class="fill === option ? 'border-2 border-dl-fg bg-dl-signal-soft' : 'border border-dl-line'"
            >
              <input v-model="fill" type="radio" name="fill" :value="option" class="mt-0.5 h-[18px] w-[18px] accent-dl-ink">
              <span><b class="block text-sm">{{ t(`cycles.create.fill.${option}.title`) }}</b><small class="text-dl-muted">{{ t(`cycles.create.fill.${option}.text`) }}</small></span>
            </label>
          </div>
          <div v-if="kindsByRole" class="flex flex-col gap-1.5">
            <span class="text-[13px] font-semibold">{{ t('cycles.create.kinds') }}</span>
            <p class="rounded-xl bg-dl-mist px-3 py-2 text-[12.5px] text-dl-body">{{ t('cycles.create.kindsWhy', { list: kindsByRole }) }}</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="text-xs text-dl-muted">
                  <th class="border-b border-dl-line px-2 py-2.5 text-start font-semibold">{{ t('cycles.columns.person') }}</th>
                  <th class="border-b border-dl-line px-2 py-2.5 text-end font-semibold">{{ t('cycles.create.fromLast') }}</th>
                  <th class="border-b border-dl-line px-2 py-2.5 text-end font-semibold">{{ t('cycles.create.newInTerritory') }}</th>
                  <th class="border-b border-dl-line px-2 py-2.5 text-end font-semibold">{{ t('cycles.create.noSegment') }}</th>
                  <th class="border-b border-dl-line px-2 py-2.5 text-end font-semibold">{{ t('cycles.create.total') }}</th>
                </tr>
              </thead>
              <tbody :class="loadingPreview && 'opacity-50'">
                <tr v-for="row in preview" :key="row.user_id" class="border-b border-dl-line-soft tabular-nums">
                  <td class="px-2 py-2.5">{{ row.full_name }}</td>
                  <td class="px-2 py-2.5 text-end">{{ n(row.from_last) }}</td>
                  <td class="px-2 py-2.5 text-end">{{ n(row.new_in_territory) }}</td>
                  <td class="px-2 py-2.5 text-end" :class="row.no_segment ? 'text-dl-pending' : ''">{{ n(row.no_segment) }}</td>
                  <td class="px-2 py-2.5 text-end"><b>{{ n(row.total) }}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <div class="flex justify-between gap-2.5">
          <DlButton variant="outline" @click="back">{{ step ? t('cycles.create.back') : t('common.actions.cancel') }}</DlButton>
          <DlButton :variant="step === 2 ? 'primary' : 'dark'" :disabled="!canNext" :loading="saving" @click="next">
            {{ step === 2 ? t('cycles.create.submit', picked.size) : t('cycles.create.next') }}
          </DlButton>
        </div>
      </div>

      <aside class="rounded-[20px] bg-dl-paper px-4 py-3.5" :aria-label="t('cycles.create.summary')">
        <h2 class="mb-2 text-[15px] font-semibold">{{ t('cycles.create.summary') }}</h2>
        <dl class="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
          <dt class="text-dl-muted">{{ t('cycles.create.steps.period') }}</dt><dd>{{ periodValid ? text.period(period.start, period.end) : '—' }}</dd>
          <dt class="text-dl-muted">{{ t('cycles.create.steps.people') }}</dt>
          <dd>{{ step >= 1 ? t('cycles.create.summaryPeople', { picked: n(picked.size), blocked: n(blockedCount) }) : t('cycles.create.notYet') }}</dd>
          <dt class="text-dl-muted">{{ t('cycles.create.steps.professionals') }}</dt>
          <dd>{{ step === 2 && preview.length ? t('cycles.create.summaryPros', { total: n(totals.all), none: n(totals.noSegment) }) : '—' }}</dd>
        </dl>
        <p v-if="step === 2 && totals.noSegment" class="mt-3 rounded-xl bg-dl-pending/10 px-3 py-2 text-[12.5px] text-dl-pending">{{ t('cycles.create.noSegmentWarn') }}</p>
      </aside>
    </div>
  </div>
</template>
