<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { changeObjective, deleteObjective, type Objective, type ObjectiveNumbers } from '@/api/tenant/objectives'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlMenu from '@/components/DlMenu.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useUserText } from '@/views/tenant/users/userDisplay'
import { dayAfter, nextMonthStart, numbersFor, numbersOf, objectiveState, useObjectiveText } from './objectiveDisplay'
import ObjectiveNumbersFields from './ObjectiveNumbersFields.vue'

// An objective in the side panel: numbers a day, what they give for a month, who uses it and
// the history. Numbers are never edited in place once in use: "Change from a date".
// Mockup: docs/design/plan-mockups/ObjectivesFrequencies.html (frames 3–4)
const props = defineProps<{ objective: Objective }>()
const emit = defineEmits<{ changed: [objective: Objective]; deleted: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n, d } = useI18n()
const text = useObjectiveText()
const dates = useUserText()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const canDelete = (resource: string) => auth.can(`${resource}.delete`)

const mode = ref<'read' | 'change'>('read')
const PEOPLE_PREVIEW = 4
const showAllPeople = ref(false)
watch(() => props.objective.id, () => {
  mode.value = 'read'
  showAllPeople.value = false
})

const state = computed(() => objectiveState(props.objective))
const numbers = computed(() => numbersFor(props.objective.role?.visits))
const versions = computed(() => props.objective.versions ?? [])
/** Changes start from the latest version only. */
const isLatest = computed(() => !versions.value.some(row => row.start_date > props.objective.start_date))
const canChange = computed(() => canUpdate('objectives') && isLatest.value && state.value !== 'ended')

const stateTone = { current: 'success', upcoming: 'info', ended: 'neutral' } as const
const sinceLine = computed(() => props.objective.end_date
  ? t('objectives.period.range', { range: dates.range(props.objective.start_date, props.objective.end_date) })
  : t('objectives.period.since', { date: dates.date(props.objective.start_date) }))

const month = computed(() => props.objective.next_month)
const monthLabel = computed(() => month.value ? d(new Date(`${month.value.start}T12:00:00`), { month: 'long', year: 'numeric' }) : '')
const people = computed(() => props.objective.people ?? [])

function versionLine(row: Objective) {
  return numbers.value
    .filter(number => row[number])
    .map(number => `${n(row[number])} ${t(`objectives.numbers.${number}Short`, row[number])}`)
    .join(' · ') || t('objectives.read.allZero')
}

// ── Change from a date ──────────────────────────────────────
const from = ref('')
const draft = ref<ObjectiveNumbers>(numbersOf(props.objective))
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function startChange() {
  // Running: from next month. Not started yet: the same day (a correction, no new version).
  const start = props.objective.start_date.slice(0, 10)
  const next = nextMonthStart()
  from.value = state.value === 'upcoming' ? start : next > start ? next : dayAfter(start)
  draft.value = numbersOf(props.objective)
  errors.value = {}
  mode.value = 'change'
}
const sameDay = computed(() => from.value === props.objective.start_date.slice(0, 10))

async function saveChange() {
  saving.value = true
  errors.value = {}
  try {
    const changed = await changeObjective(props.objective.id, { from: from.value, ...draft.value })
    toast.success(t('objectives.change.done', { date: dates.date(from.value) }))
    mode.value = 'read'
    emit('changed', changed)
  }
  catch (error) {
    // The API's messages come translated.
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}

// ── Delete ──────────────────────────────────────────────────
const menuItems = computed(() => canDelete('objectives')
  ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: remove }]
  : [])
async function remove() {
  const previous = versions.value.find(row => row.end_date && dayAfter(row.end_date) === props.objective.start_date.slice(0, 10))
  const ok = await confirm({
    title: t('studio.list.delete.title', { name: text.name(props.objective) }),
    text: previous ? t('objectives.delete.previousRunsOn', { date: dates.date(previous.start_date) }) : t('objectives.delete.text'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteObjective(props.objective.id)
    toast.success(t('studio.list.toast.deleted'))
    emit('deleted')
  }
  catch (error) {
    // A row a cycle uses is refused (with cycles): the API says why.
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="mode === 'change' ? t('objectives.change.title') : text.name(objective)">
    <template #badges>
      <span class="mt-1 flex flex-wrap items-center gap-1.5">
        <template v-if="mode === 'read'">
          <DlBadge size="sm" dot :tone="stateTone[state]">{{ t(`objectives.state.${state}`) }}</DlBadge>
          <span class="text-xs text-dl-muted">{{ sinceLine }} · {{ t('objectives.peopleCount', { count: n(objective.people_count ?? 0) }, objective.people_count ?? 0) }}</span>
        </template>
        <span v-else class="text-xs text-dl-muted">{{ text.name(objective) }}</span>
      </span>
    </template>
    <template v-if="mode === 'read' && menuItems.length" #actions>
      <DlMenu :label="t('fieldSetup.menu.label')" :items="menuItems" />
    </template>

    <!-- Reading mode -->
    <div v-if="mode === 'read'" class="flex flex-col gap-3.5 text-[13px]">
      <section class="rounded-2xl border border-dl-line">
        <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
          <h3 class="flex-1 text-sm font-semibold">{{ t('objectives.read.aDay') }}</h3>
          <DlButton v-if="canChange" variant="outline" size="sm" icon="tabler-calendar-plus" @click="startChange">{{ t('objectives.change.button') }}</DlButton>
        </header>
        <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 px-3.5 pb-3">
          <template v-for="number in numbers" :key="number">
            <dt class="text-dl-muted">{{ text.number(number) }}</dt>
            <dd class="text-end font-semibold tabular-nums">{{ n(objective[number]) }}</dd>
          </template>
        </dl>
      </section>

      <section v-if="month && state !== 'ended'" class="rounded-2xl border border-dl-line">
        <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
          <h3 class="flex-1 text-sm font-semibold">{{ t('objectives.read.forAMonth') }}</h3>
          <span class="text-xs text-dl-muted">{{ t('objectives.read.monthDays', { month: monthLabel, days: n(month.working_days) }) }}</span>
        </header>
        <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 px-3.5 pb-3">
          <template v-for="number in numbers" :key="number">
            <dt class="text-dl-muted">{{ text.number(number) }}</dt>
            <dd class="text-end tabular-nums">{{ n(objective[number] * month.working_days) }}</dd>
          </template>
        </dl>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('objectives.read.people', { count: n(people.length) }) }}</h3>
        <p v-if="!people.length" class="text-dl-body">{{ state === 'ended' ? t('objectives.read.nobodyEnded') : t('objectives.read.nobody') }}</p>
        <ul v-else class="flex flex-col gap-1.5">
          <li v-for="person in (showAllPeople ? people : people.slice(0, PEOPLE_PREVIEW))" :key="person.id" class="flex items-center gap-2.5">
            <DlAvatar :name="person.full_name" :src="person.avatar?.url" size="sm" />
            <span class="truncate">{{ person.full_name }}</span>
          </li>
        </ul>
        <button v-if="people.length > PEOPLE_PREVIEW" type="button" class="mt-1.5 font-semibold text-dl-cobalt hover:underline" @click="showAllPeople = !showAllPeople">
          {{ showAllPeople ? t('rulesSetup.coverage.hide') : t('objectives.read.morePeople', { count: n(people.length - PEOPLE_PREVIEW) }) }}
        </button>
        <p class="mt-1.5 text-xs text-dl-muted">{{ objective.team ? t('objectives.read.whoTeam', { role: roleLabel(objective.role?.name), team: objective.team.name }) : t('objectives.read.whoAllTeams') }}</p>
      </section>

      <section class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-2 text-sm font-semibold">{{ t('objectives.read.history') }}</h3>
        <ol class="flex flex-col gap-2.5">
          <li v-for="row in versions" :key="row.id" class="grid grid-cols-[12px_1fr] gap-2.5">
            <span class="mt-1 h-2.5 w-2.5 rounded-full" :class="row.id === objective.id ? 'bg-dl-fg' : 'bg-dl-line'" />
            <span class="flex flex-col">
              <span :class="row.id === objective.id && 'font-semibold'">
                {{ row.end_date ? dates.range(row.start_date, row.end_date) : t('objectives.period.from', { date: dates.date(row.start_date) }) }}
                · {{ versionLine(row) }}
              </span>
              <span class="text-xs text-dl-muted">
                {{ t('objectives.read.usedByCycles', { count: n(row.cycles_count ?? 0) }, row.cycles_count ?? 0) }}<template v-if="row.id === objective.id && objective.created_by"> · {{ t('objectives.read.setBy', { name: objective.created_by.full_name }) }}</template>
              </span>
            </span>
          </li>
        </ol>
      </section>
    </div>

    <!-- Change from a date -->
    <form v-else id="objective-change" class="flex flex-col gap-4" @submit.prevent="saveChange">
      <DlInput
        v-model="from"
        type="date"
        :label="t('objectives.change.from')"
        :hint="sameDay ? t('objectives.change.sameDay') : t('objectives.change.endsBefore', { date: dates.date(objective.start_date) })"
        :error="errors.from"
      />
      <ObjectiveNumbersFields v-model="draft" :numbers="numbers" :previous="numbersOf(objective)" :errors="errors" />
      <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-body">{{ t('objectives.change.cycles') }}</p>
    </form>

    <template v-if="mode === 'change'" #footer>
      <DlButton variant="ghost" @click="mode = 'read'">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="objective-change" variant="primary" class="ms-auto" :loading="saving">{{ t('objectives.change.save', { date: from ? dates.date(from) : '' }) }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
