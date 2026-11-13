<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createExpenseSetting,
  deleteExpenseSetting,
  fetchExpenseSetting,
  fetchExpenseSettingCoverage,
  fetchExpenseSettings,
  resolveExpenseSetting,
  updateExpenseSetting,
  type ExpenseSetting,
  type ExpenseSettingMatch,
  type ExpenseSettingPayload,
} from '@/api/tenant/expenseSettings'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlMenu from '@/components/DlMenu.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSteps from '@/components/DlSteps.vue'
import { useAuthStore } from '@/stores/auth'
import { roleLabel, useRolesAndTeams, useTeamOptions } from '@/views/tenant/settings/shared/lookups'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { fieldSection } from '@/views/tenant/settings/shared/studioSections'
import {
  STUDIO_DEFAULT_SORT,
  useAddedColumn,
  useRecordPanel,
  useStudioCounts,
  useStudioList,
} from '@/views/tenant/settings/shared/useStudioList'
import { useUsers } from '@/views/tenant/territories/useTerritoryLookups'
import ExpenseSettingFields, { type ExpenseSettingForm } from './ExpenseSettingFields.vue'

// Reimbursement rates and ceilings, for a role and/or team, or one user, from a start date.
// A setting opens in reading mode; each part is edited on its own; "Add" goes in 3 steps.
// Mockup: docs/design/studio-mockups/RecordPanelFlow.html
const { t, n, d } = useI18n()
const auth = useAuthStore()
const canStore = (resource: string) => auth.can(`${resource}.create`)
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const canDelete = (resource: string) => auth.can(`${resource}.delete`)
const { refresh: refreshCounts } = useStudioCounts()
const { roles } = useRolesAndTeams()
const { teams } = useTeamOptions()

const ALL = 'all'
const today = () => new Date().toISOString().slice(0, 10)

const people = useUsers()
people.ensureLoaded()
const users = computed(() => people.items.value
  .map(user => ({ value: user.id, label: user.full_name }))
  .sort((a, b) => a.label.localeCompare(b.label)))

type StatusFilter = 'in_force' | 'upcoming' | 'ended'

const list = useStudioList<ExpenseSetting, {
  role: number | null
  team: number | null
  user: number | null
  status: string | null
  target: string | null
}>(
  ({ page, perPage, sort, filters }) => fetchExpenseSettings({
    page,
    per_page: perPage,
    sort,
    'filter[role_id]': filters.role ?? undefined,
    'filter[team_id]': filters.team ?? undefined,
    'filter[user_id]': filters.user ?? undefined,
    'filter[status]': (filters.status as StatusFilter | null) ?? undefined,
    'filter[target]': (filters.target as ExpenseSettingMatch | null) ?? undefined,
  }),
  { role: null, team: null, user: null, status: null, target: null },
)
const { page, perPage, sort, filters, items, total, loading } = list
list.reload()

const roleFilter = computed({
  get: () => filters.role ?? ALL,
  set: value => { filters.role = value === ALL || value == null ? null : Number(value) },
})
const teamFilter = computed({
  get: () => filters.team ?? ALL,
  set: value => { filters.team = value === ALL || value == null ? null : Number(value) },
})
const userFilter = computed({
  get: () => filters.user ?? ALL,
  set: value => { filters.user = value === ALL || value == null ? null : Number(value) },
})
const statusFilter = computed({
  get: () => filters.status ?? ALL,
  set: value => { filters.status = value === ALL || value == null ? null : String(value) },
})
const targetFilter = computed({
  get: () => filters.target ?? ALL,
  set: value => { filters.target = value === ALL || value == null ? null : String(value) },
})
const statusOptions = computed(() => [
  { value: ALL, label: t('fieldSetup.filter.allStatuses') },
  { value: 'in_force', label: t('fieldSetup.status.inForce') },
  { value: 'upcoming', label: t('fieldSetup.status.upcoming') },
  { value: 'ended', label: t('fieldSetup.status.ended') },
])
const targetOptions = computed(() => [
  { value: ALL, label: t('fieldSetup.filter.allKinds') },
  ...(['user', 'role_team', 'role', 'team', 'everyone'] as const).map(kind => ({ value: kind, label: t(`fieldSetup.match.${kind}`) })),
])
const filtering = computed(() => Object.values(filters).some(value => value != null))
function clearFilters() {
  Object.assign(filters, { role: null, team: null, user: null, status: null, target: null })
}

/** "Amine Kaci" · "VM · Cardio" · "VM · All teams" · "All roles · Cardio" · "Everyone". */
function appliesTo(row: ExpenseSetting): { name: string; kind: ExpenseSettingMatch } {
  if (row.user_id) {
    return { name: row.user?.full_name || t('fieldSetup.scope.user'), kind: 'user' }
  }
  if (row.role_id && row.team_id) return { name: `${roleLabel(row.role?.name)} · ${row.team?.name ?? ''}`, kind: 'role_team' }
  if (row.role_id) return { name: `${roleLabel(row.role?.name)} · ${t('fieldSetup.filter.allTeams')}`, kind: 'role' }
  if (row.team_id) return { name: `${t('fieldSetup.filter.allRoles')} · ${row.team?.name ?? ''}`, kind: 'team' }
  return { name: t('fieldSetup.scope.everyone'), kind: 'everyone' }
}

const day = (value?: string | null) => (value ? d(new Date(`${value}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }) : '')
function period(row: ExpenseSetting) {
  if (row.start_date && row.end_date) return `${day(row.start_date)} → ${day(row.end_date)}`
  if (row.start_date) return t('fieldSetup.period.from', { date: day(row.start_date) })
  return '—'
}
const amount = (value?: number | string | null) => (value == null || value === '' ? '—' : n(Number(value), { maximumFractionDigits: 2 }))

/** In force / upcoming / ended, from the dates. */
function status(row: ExpenseSetting): { tone: 'success' | 'info' | 'neutral'; label: string } {
  const now = today()
  if (row.start_date && row.start_date > now) return { tone: 'info', label: t('fieldSetup.status.upcoming') }
  if (row.end_date && row.end_date < now) return { tone: 'neutral', label: t('fieldSetup.status.ended') }
  return { tone: 'success', label: t('fieldSetup.status.inForce') }
}

// "24.00" from the API shows as "24".
const str = (value?: number | string | null) => (value == null || value === '' ? '' : String(Number(value)))
// Number inputs hand back numbers once typed in, strings when untouched.
const num = (value: string | number | null) => (value == null || String(value).trim() === '' ? null : Number(value))

function toPayload(form: ExpenseSettingForm): ExpenseSettingPayload {
  return {
    role_id: form.target === 'group' ? form.role_id : null,
    team_id: form.target === 'group' ? form.team_id : null,
    user_id: form.target === 'user' ? form.user_id : null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    restitution_price_per_km_in: num(form.restitution_price_per_km_in) ?? 0,
    restitution_price_per_km_out: num(form.restitution_price_per_km_out) ?? 0,
    max_km_in: num(form.max_km_in),
    max_km_out: num(form.max_km_out),
    max_night: num(form.max_night),
    price_per_night: num(form.price_per_night) ?? 0,
    price_per_meal: num(form.price_per_meal) ?? 0,
    max_meals_per_night: num(form.max_meals_per_night) ?? 2,
  }
}

const panel = useRecordPanel<ExpenseSetting, ExpenseSettingForm>({
  toForm: row => ({
    target: row?.user_id ? 'user' : 'group',
    role_id: row?.role_id ?? null,
    team_id: row?.team_id ?? null,
    user_id: row?.user_id ?? null,
    start_date: row?.start_date ?? today(),
    end_date: row?.end_date ?? '',
    restitution_price_per_km_in: str(row?.restitution_price_per_km_in),
    restitution_price_per_km_out: str(row?.restitution_price_per_km_out),
    max_km_in: str(row?.max_km_in),
    max_km_out: str(row?.max_km_out),
    max_night: str(row?.max_night),
    price_per_night: str(row?.price_per_night),
    price_per_meal: str(row?.price_per_meal),
    max_meals_per_night: str(row?.max_meals_per_night ?? 2),
  }),
  create: form => createExpenseSetting(toPayload(form)),
  update: (row, form) => updateExpenseSetting(row.id, toPayload(form)),
  remove: row => deleteExpenseSetting(row.id),
  recordName: row => appliesTo(row).name,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
  reload: row => fetchExpenseSetting(row.id),
})
const { open, record, form, errors, saving } = panel
const canEdit = computed(() => canUpdate('expense-settings'))

// ── Reading mode: one section edited at a time ──────────────────────────────
type Part = 'who' | 'km' | 'stays'
const editing = ref<Part | null>(null)
watch(record, () => { editing.value = null })

function edit(part: Part) {
  panel.reset()
  editing.value = part
}
async function saveSection() {
  if (await panel.save()) editing.value = null
}
function cancelSection() {
  panel.reset()
  editing.value = null
}

const coverage = ref<{ matching: number; winning: number } | null>(null)
watch(record, async row => {
  coverage.value = row ? await fetchExpenseSettingCoverage({ setting_id: row.id }) : null
})

const createdBy = computed(() => record.value?.created_by?.full_name ?? null)

const menuItems = computed(() => [
  ...(canStore('expense-settings')
    ? [{ label: t('fieldSetup.menu.duplicate'), icon: 'tabler-copy', onSelect: duplicate }]
    : []),
  ...(canEdit.value && record.value && !record.value.end_date
    ? [{ label: t('fieldSetup.menu.endToday'), icon: 'tabler-calendar-off', onSelect: endToday }]
    : []),
  ...(canDelete('expense-settings')
    ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: () => panel.destroy() }]
    : []),
])

/** Same rates, ready for another team or user: opens "Add" with the values filled in. */
function duplicate() {
  const values = { ...form.value }
  startAdd()
  form.value = { ...values, team_id: null, user_id: null, start_date: today(), end_date: '' }
}

function endToday() {
  panel.reset()
  form.value.end_date = today()
  panel.save()
}

// ── Add: 3 steps ────────────────────────────────────────────────────────────
const STEP_PARTS: Part[] = ['who', 'km', 'stays']
const step = ref(0)
const stepLabels = computed(() => STEP_PARTS.map(part => t(`fieldSetup.part.${part}`)))

function startAdd() {
  step.value = 0
  panel.show(null)
}

const PART_FIELDS: Record<Part, string[]> = {
  who: ['role_id', 'team_id', 'user_id', 'start_date', 'end_date'],
  km: ['restitution_price_per_km_in', 'restitution_price_per_km_out', 'max_km_in', 'max_km_out'],
  stays: ['price_per_night', 'max_night', 'price_per_meal', 'max_meals_per_night'],
}

async function addSetting() {
  if (await panel.save()) return
  // Back to the first step holding an error.
  const index = STEP_PARTS.findIndex(part => PART_FIELDS[part].some(field => errors.value[field]))
  if (index >= 0) step.value = index
}

// "N people will get this setting", while choosing who it is for.
const preview = ref<{ matching: number; winning: number } | null>(null)
let previewTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => [open.value && !record.value, form.value.target, form.value.role_id, form.value.team_id, form.value.user_id, form.value.start_date] as const,
  ([adding]) => {
    clearTimeout(previewTimer)
    if (!adding) {
      preview.value = null
      return
    }
    previewTimer = setTimeout(async () => {
      const group = form.value.target === 'group'
      preview.value = await fetchExpenseSettingCoverage({
        role_id: group ? form.value.role_id : null,
        team_id: group ? form.value.team_id : null,
        user_id: group ? null : form.value.user_id,
        start_date: form.value.start_date,
        date: form.value.start_date && form.value.start_date > today() ? form.value.start_date : today(),
      })
    }, 300)
  },
)

const draftName = computed(() => {
  const f = form.value
  if (f.target === 'user') return users.value.find(u => u.value === f.user_id)?.label ?? t('fieldSetup.scope.user')
  const role = roles.value.find(r => r.value === f.role_id)?.label ?? t('fieldSetup.filter.allRoles')
  const team = teams.value.find(r => r.value === f.team_id)?.label ?? t('fieldSetup.filter.allTeams')
  return f.role_id || f.team_id ? `${role} · ${team}` : t('fieldSetup.scope.everyone')
})

/** "Which setting applies?" checker: pick a person and a date, see the setting that wins. */
const check = ref<{ user: number | null; date: string }>({ user: null, date: today() })
const checkResult = ref<{ setting: ExpenseSetting | null; match: ExpenseSettingMatch | null } | null>(null)
const checkUser = computed({
  get: () => check.value.user,
  set: value => { check.value.user = value == null ? null : Number(value) },
})
watch([check, items], async () => {
  if (!check.value.user || !check.value.date) {
    checkResult.value = null
    return
  }
  checkResult.value = await resolveExpenseSetting(check.value.user, check.value.date)
}, { deep: true })

const added = useAddedColumn()
const columns = [
  { key: 'applies', label: t('fieldSetup.columns.appliesTo') },
  { key: 'start_date', label: t('fieldSetup.columns.period'), sortKey: 'start_date' },
  { key: 'km', label: t('fieldSetup.columns.km'), align: 'end' as const },
  { key: 'price_per_night', label: t('fieldSetup.columns.night'), align: 'end' as const, secondary: true },
  { key: 'price_per_meal', label: t('fieldSetup.columns.meal'), align: 'end' as const, secondary: true },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="fieldSection"
    :title="t('fieldSetup.title.expenseSettings')"
    :add-label="canStore('expense-settings') ? t('fieldSetup.add.expenseSettings') : undefined"
    @add="startAdd"
  >
    <section :aria-label="t('fieldSetup.check.title')" class="flex flex-col gap-3 rounded-2xl bg-dl-mist p-4">
      <div class="flex flex-wrap items-end gap-2.5">
        <div class="flex min-w-0 flex-col gap-0.5">
          <h2 class="text-sm font-bold">{{ t('fieldSetup.check.title') }}</h2>
          <p class="text-xs text-dl-muted">{{ t('fieldSetup.check.hint') }}</p>
        </div>
        <div class="ms-auto flex flex-wrap gap-2.5">
          <DlSelect v-model="checkUser" :label="t('fieldSetup.scope.user')" :options="users" :placeholder="t('fieldSetup.check.pickRep')" appearance="filter" />
          <DlInput v-model="check.date" type="date" :label="t('fieldSetup.check.date')" hide-label class="w-44" />
        </div>
      </div>
      <p v-if="checkResult" class="text-sm" aria-live="polite">
        <template v-if="checkResult.setting">
          <button type="button" class="font-semibold text-dl-cobalt hover:underline" @click="panel.show(checkResult.setting)">{{ appliesTo(checkResult.setting).name }}</button>
          · {{ t(`fieldSetup.match.${checkResult.match}`) }}
          · {{ t('fieldSetup.check.rates', { in: amount(checkResult.setting.restitution_price_per_km_in), out: amount(checkResult.setting.restitution_price_per_km_out), meal: amount(checkResult.setting.price_per_meal), night: amount(checkResult.setting.price_per_night) }) }}
        </template>
        <span v-else class="text-dl-pending">{{ t('fieldSetup.check.none') }}</span>
      </p>
    </section>

    <div class="flex flex-wrap gap-2.5">
      <DlSelect
        v-model="roleFilter"
        :label="t('fieldSetup.columns.role')"
        :options="[{ value: ALL, label: t('fieldSetup.filter.allRoles') }, ...roles]"
        appearance="filter"
      />
      <DlSelect
        v-model="teamFilter"
        :label="t('fieldSetup.columns.team')"
        :options="[{ value: ALL, label: t('fieldSetup.filter.allTeams') }, ...teams]"
        appearance="filter"
      />
      <DlSelect
        v-model="userFilter"
        :label="t('fieldSetup.scope.user')"
        :options="[{ value: ALL, label: t('fieldSetup.filter.allUsers') }, ...users]"
        appearance="filter"
      />
      <DlSelect v-model="statusFilter" :label="t('fieldSetup.columns.status')" :options="statusOptions" appearance="filter" />
      <DlSelect v-model="targetFilter" :label="t('fieldSetup.columns.kind')" :options="targetOptions" appearance="filter" />
      <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="clearFilters">{{ t('common.actions.resetFilters') }}</DlButton>
    </div>

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('fieldSetup.title.expenseSettings')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="filtering ? t('geo.empty.search') : t('fieldSetup.empty.expenseSettings')"
      @open="panel.show"
    >
      <template #cell-applies="{ row }">
        <span class="flex flex-col">
          <strong class="font-semibold">{{ appliesTo(row).name }}</strong>
          <span class="text-xs text-dl-muted">{{ t(`fieldSetup.match.${appliesTo(row).kind}`) }}</span>
        </span>
      </template>
      <template #cell-start_date="{ row }"><span class="whitespace-nowrap">{{ period(row) }}</span></template>
      <template #cell-km="{ row }">
        <span class="whitespace-nowrap">{{ amount(row.restitution_price_per_km_in) }} / {{ amount(row.restitution_price_per_km_out) }}</span>
      </template>
      <template #cell-price_per_night="{ row }">{{ amount(row.price_per_night) }}</template>
      <template #cell-price_per_meal="{ row }">{{ amount(row.price_per_meal) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ appliesTo(row).name }}</strong>
        <span class="text-xs text-dl-muted">{{ period(row) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <!-- Reading mode -->
      <DlRecordPanel
        v-if="record"
        v-model:open="open"
        :title="appliesTo(record).name"
      >
        <template #badges>
          <span class="mt-1 flex flex-wrap items-center gap-1.5">
            <DlBadge size="sm">{{ t(`fieldSetup.match.${appliesTo(record).kind}`) }}</DlBadge>
            <DlBadge size="sm" :tone="status(record).tone" dot>{{ status(record).label }}</DlBadge>
          </span>
        </template>
        <template v-if="menuItems.length" #actions>
          <DlMenu :label="t('fieldSetup.menu.label')" :items="menuItems" />
        </template>

        <div class="flex flex-col gap-3.5">
          <dl class="grid grid-cols-2 gap-2">
            <div class="flex flex-col rounded-2xl bg-dl-mist px-3.5 py-2.5">
              <dt class="order-2 text-[11.5px] text-dl-muted">{{ t('fieldSetup.read.inside', { max: amount(record.max_km_in) }) }}</dt>
              <dd class="font-display text-[22px] font-extrabold tracking-[-0.02em]">{{ amount(record.restitution_price_per_km_in) }} <small class="font-sans text-xs font-semibold text-dl-muted">{{ t('fieldSetup.read.perKm') }}</small></dd>
            </div>
            <div class="flex flex-col rounded-2xl bg-dl-mist px-3.5 py-2.5">
              <dt class="order-2 text-[11.5px] text-dl-muted">{{ t('fieldSetup.read.outside', { max: amount(record.max_km_out) }) }}</dt>
              <dd class="font-display text-[22px] font-extrabold tracking-[-0.02em]">{{ amount(record.restitution_price_per_km_out) }} <small class="font-sans text-xs font-semibold text-dl-muted">{{ t('fieldSetup.read.perKm') }}</small></dd>
            </div>
            <div class="flex flex-col rounded-2xl bg-dl-mist px-3.5 py-2.5">
              <dt class="order-2 text-[11.5px] text-dl-muted">{{ t('fieldSetup.read.perMeal') }}</dt>
              <dd class="font-display text-[22px] font-extrabold tracking-[-0.02em]">{{ amount(record.price_per_meal) }} <small class="font-sans text-xs font-semibold text-dl-muted">DA</small></dd>
            </div>
            <div class="flex flex-col rounded-2xl bg-dl-mist px-3.5 py-2.5">
              <dt class="order-2 text-[11.5px] text-dl-muted">{{ t('fieldSetup.read.perNight', { max: amount(record.max_night) }) }}</dt>
              <dd class="font-display text-[22px] font-extrabold tracking-[-0.02em]">{{ amount(record.price_per_night) }} <small class="font-sans text-xs font-semibold text-dl-muted">DA</small></dd>
            </div>
          </dl>

          <DlRecordSection
            :editing="editing === 'who'"
            :title="t('fieldSetup.part.who')"
            icon="tabler-users"
            :can-edit="canEdit && editing === null"
            :saving="saving"
            :save-label="t('fieldSetup.save.who')"
            @update:editing="edit('who')"
            @save="saveSection"
            @cancel="cancelSection"
          >
            {{ appliesTo(record).name }} · {{ period(record) }}
            <template v-if="coverage"> · {{ t('fieldSetup.read.coverage', coverage.winning) }}</template>
            <template #edit>
              <ExpenseSettingFields v-model="form" part="who" :errors="errors" :roles="roles" :teams="teams" :users="users" />
            </template>
          </DlRecordSection>

          <DlRecordSection
            :editing="editing === 'km'"
            :title="t('fieldSetup.part.km')"
            icon="tabler-road"
            :can-edit="canEdit && editing === null"
            :saving="saving"
            :save-label="t('fieldSetup.save.km')"
            @update:editing="edit('km')"
            @save="saveSection"
            @cancel="cancelSection"
          >
            {{ t('fieldSetup.read.kmLine', { in: amount(record.restitution_price_per_km_in), out: amount(record.restitution_price_per_km_out), maxIn: amount(record.max_km_in), maxOut: amount(record.max_km_out) }) }}
            <template #edit>
              <ExpenseSettingFields v-model="form" part="km" :errors="errors" :roles="roles" :teams="teams" :users="users" />
            </template>
          </DlRecordSection>

          <DlRecordSection
            :editing="editing === 'stays'"
            :title="t('fieldSetup.part.stays')"
            icon="tabler-bed"
            :can-edit="canEdit && editing === null"
            :saving="saving"
            :save-label="t('fieldSetup.save.stays')"
            @update:editing="edit('stays')"
            @save="saveSection"
            @cancel="cancelSection"
          >
            {{ t('fieldSetup.read.staysLine', { night: amount(record.price_per_night), max: amount(record.max_night), meal: amount(record.price_per_meal), meals: amount(record.max_meals_per_night ?? 2) }) }}
            <template #edit>
              <ExpenseSettingFields v-model="form" part="stays" :errors="errors" :roles="roles" :teams="teams" :users="users" />
            </template>
          </DlRecordSection>

          <p class="flex items-center gap-1.5 pt-1 text-xs text-dl-muted">
            <span>{{ createdBy ? t('fieldSetup.read.addedBy', { name: createdBy, date: added.format(record.created_at) }) : t('fieldSetup.read.added', { date: added.format(record.created_at) }) }}</span>
            <span v-if="record.expenses_count != null">· {{ t('fieldSetup.read.notes', record.expenses_count) }}</span>
          </p>
        </div>
      </DlRecordPanel>

      <!-- Add: 3 steps -->
      <DlRecordPanel
        v-else
        v-model:open="open"
        :title="t('fieldSetup.add.title')"
        :description="t('fieldSetup.add.stepOf', { step: step + 1, total: 3, name: stepLabels[step] })"
      >
        <form id="expense-setting-add" class="flex flex-col gap-4" @submit.prevent="step < 2 ? step++ : addSetting()">
          <DlSteps :steps="stepLabels" :current="step" />
          <ExpenseSettingFields v-model="form" :part="STEP_PARTS[step]!" :errors="errors" :roles="roles" :teams="teams" :users="users" />

          <div v-if="step === 0 && preview" class="flex gap-2.5 rounded-2xl bg-dl-signal-soft px-3.5 py-3 text-[13px]" aria-live="polite">
            <span aria-hidden="true">✓</span>
            <span>
              <strong>{{ t('fieldSetup.preview.people', preview.winning) }}</strong>
              <span v-if="preview.matching > preview.winning" class="block text-xs text-dl-muted">
                {{ t('fieldSetup.preview.overridden', preview.matching - preview.winning) }}
              </span>
            </span>
          </div>

          <div v-if="step === 2" class="flex flex-col gap-1 rounded-2xl border border-dl-line px-3.5 py-3 text-[13px] text-dl-body">
            <strong class="text-dl-fg">{{ t('fieldSetup.add.summary') }}</strong>
            <span>{{ draftName }} · {{ form.start_date ? t('fieldSetup.period.from', { date: day(form.start_date) }) : '' }}</span>
            <span>{{ t('fieldSetup.read.kmLine', { in: amount(form.restitution_price_per_km_in), out: amount(form.restitution_price_per_km_out), maxIn: amount(form.max_km_in), maxOut: amount(form.max_km_out) }) }}</span>
            <span>{{ t('fieldSetup.read.staysLine', { night: amount(form.price_per_night), max: amount(form.max_night), meal: amount(form.price_per_meal), meals: amount(form.max_meals_per_night) }) }}</span>
          </div>
        </form>
        <template #footer>
          <DlButton v-if="step > 0" variant="outline" icon="tabler-arrow-left" @click="step--">{{ t('fieldSetup.add.back') }}</DlButton>
          <DlButton v-else variant="outline" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton
            type="submit"
            form="expense-setting-add"
            :variant="step < 2 ? 'dark' : 'primary'"
            :loading="saving"
            class="flex-1"
          >
            {{ step < 2 ? t('fieldSetup.add.next', { name: stepLabels[step + 1] }) : t('fieldSetup.add.save') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
