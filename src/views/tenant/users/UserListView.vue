<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { rolesApi } from '@/api/tenant/roles'
import { fetchUser, fetchUsers, type TenantUser } from '@/api/tenant/users'
import type { ListParams } from '@/api/tenant/geography'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import { exportToXlsx } from '@/composables/exportXlsx'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { STUDIO_DEFAULT_SORT, useAddedColumn, useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import UserCreatePanel from './UserCreatePanel.vue'
import UserReadPanel from './UserReadPanel.vue'
import { STATUS_TONES, accountStatus, today, useUserText } from './userDisplay'

// Studio › Users: list, reading panel, "Add a user". Everything else on the full page.
// The team filter, the hierarchy view and the team, manager and territory columns come with their modules.
const { t } = useI18n()
const auth = useAuthStore()
const text = useUserText()
const toast = useToast()

const ALL = 'all'
type Filters = { role: string | null; account: string; added: string; from: string; to: string }

/** The "Added" filter as API dates: one day, or a range typed in any order. */
function addedDates(f: Filters): { from?: string; to?: string } {
  if (f.added === 'day' && f.from) return { from: f.from, to: f.from }
  if (f.added === 'range' && (f.from || f.to)) {
    const [from, to] = [f.from, f.to].sort((a, b) => (a && b ? a.localeCompare(b) : 0))
    return { from: from || undefined, to: to || undefined }
  }
  return {}
}

function queryOf(search: string, filters: Filters): ListParams {
  const { from, to } = addedDates(filters)
  return {
    'filter[q]': search || undefined,
    'filter[role]': filters.role ?? undefined,
    'filter[account]': filters.account === ALL ? undefined : filters.account,
    'filter[created_from]': from,
    'filter[created_to]': to,
  }
}

const list = useStudioList<TenantUser, Filters>(
  ({ page, perPage, search, sort, filters }) => fetchUsers({ page, per_page: perPage, sort, ...queryOf(search, filters) }),
  { role: null, account: 'current', added: ALL, from: '', to: '' },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const roles = ref<string[]>([])
onMounted(async () => {
  roles.value = (await rolesApi.list()).map(role => role.name)
})

const roleFilter = computed({
  get: () => filters.role ?? ALL,
  set: value => { filters.role = value === ALL || value == null ? null : String(value) },
})
const roleOptions = computed(() => [
  { value: ALL, label: t('users.filter.allRoles') },
  ...roles.value.map(name => ({ value: name, label: roleLabel(name) })).sort((a, b) => a.label.localeCompare(b.label)),
])
const accountOptions = computed(() => ['current', 'active', 'invited', 'not_invited', 'inactive', ALL].map(value => ({
  value,
  label: t(`users.filter.account.${value}`),
})))
const addedFilter = computed({
  get: () => filters.added,
  set: value => {
    const added = String(value ?? ALL)
    // One day starts on today; a range on the last 30 days. Both can be changed right after.
    if (added === 'day') Object.assign(filters, { added, from: today(), to: '' })
    else if (added === 'range') Object.assign(filters, { added, from: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10), to: today() })
    else Object.assign(filters, { added, from: '', to: '' })
  },
})
const addedOptions = computed(() => [
  { value: ALL, label: t('users.filter.anyDate') },
  { value: 'day', label: t('access.log.filter.oneDay') },
  { value: 'range', label: t('access.log.filter.range') },
])
const filtered = computed(() => !!(search.value || filters.role || filters.account !== 'current' || filters.added !== ALL))

// Panel: a person (reading mode) or "Add a user".
const open = ref(false)
const selected = ref<TenantUser | null>(null)
const adding = ref(false)

async function show(row: TenantUser) {
  adding.value = false
  selected.value = row
  open.value = true
  // The row has the list's fields; the panel also shows language and commune.
  const full = await fetchUser(row.id)
  if (selected.value?.id === row.id) selected.value = full
}
function add() {
  selected.value = null
  adding.value = true
  open.value = true
}
async function onCreated(user: TenantUser) {
  list.reload()
  await show(user)
}
function onPanelChange() {
  list.reload()
  if (selected.value) show(selected.value)
}

const added = useAddedColumn()
const columns = [
  { key: 'person', label: t('users.columns.person'), sortKey: 'first_name' },
  { key: 'role', label: t('users.columns.role') },
  { key: 'status', label: t('users.columns.status') },
  { ...added.column, secondary: true },
]

/** Every page of the list, 100 rows at a time. */
async function allRows(): Promise<TenantUser[]> {
  const rows: TenantUser[] = []
  for (let pageNumber = 1; ; pageNumber++) {
    const result = await fetchUsers({ page: pageNumber, per_page: 100, sort: sort.value || STUDIO_DEFAULT_SORT, ...queryOf(search.value.trim(), filters) })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) return rows
  }
}

// Export: every person matching the filters (all pages), in the viewer's language.
const exporting = ref(false)
async function exportList() {
  exporting.value = true
  try {
    const rows = await allRows()
    await exportToXlsx(rows.map(user => ({
      [t('users.fields.firstName')]: user.first_name,
      [t('users.fields.lastName')]: user.last_name,
      [t('users.fields.email')]: user.email,
      [t('users.fields.phone')]: user.phone ?? '',
      [t('users.columns.role')]: text.role(user),
      [t('users.columns.status')]: text.status(user),
      [t('studio.list.added')]: user.created_at?.slice(0, 10) ?? '',
    })), `${t('users.title')} ${today()}`, t('users.title'))
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    exporting.value = false
  }
}
</script>

<template>
  <!-- As the mockup (studio-mockups/Users.html): the panel sits beside the whole column (title + list), from the top. -->
  <div class="flex w-full items-start gap-5" :class="auth.can('users.create') && 'max-md:pb-20'">
    <div class="flex min-w-0 flex-1 flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.studio') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('users.title') }}</h1>
        </div>
        <div class="flex gap-2.5">
          <DlButton variant="outline" icon="tabler-file-spreadsheet" :loading="exporting" :disabled="!total" @click="exportList">{{ t('users.export') }}</DlButton>
          <DlButton v-if="auth.can('users.create')" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('users.add.button') }}</DlButton>
        </div>
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <DlInput
            v-model="search"
            type="search"
            icon="tabler-search"
            :label="t('users.search')"
            :placeholder="t('users.search')"
            hide-label
            class="w-full sm:max-w-xs"
          />
          <DlSelect v-model="roleFilter" :label="t('users.columns.role')" :options="roleOptions" appearance="filter" />
          <DlSelect v-model="filters.account" :label="t('users.columns.status')" :options="accountOptions" appearance="filter" />
          <DlSelect v-model="addedFilter" :label="t('studio.list.added')" :options="addedOptions" appearance="filter" />
          <DlInput v-if="filters.added === 'day'" v-model="filters.from" type="date" :max="today()" :label="t('access.log.filter.day')" hide-label class="w-44" />
          <template v-if="filters.added === 'range'">
            <DlInput v-model="filters.from" type="date" :max="filters.to || today()" :label="t('access.log.filter.from')" hide-label class="w-44" />
            <span class="inline-block text-sm text-dl-muted rtl:-scale-x-100" aria-hidden="true">→</span>
            <DlInput v-model="filters.to" type="date" :min="filters.from" :max="today()" :label="t('access.log.filter.to')" hide-label class="w-44" />
          </template>
        </div>

        <DlDataList
          v-model:sort="sort"
          :default-sort="STUDIO_DEFAULT_SORT"
          :label="t('users.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selected?.id"
          :loading="loading"
          :compact="open"
          :empty-title="filtered ? t('geo.empty.search') : t('users.empty')"
          @open="show"
        >
          <template #cell-person="{ row }">
            <span class="flex items-center gap-2.5">
              <DlAvatar :name="row.full_name" :src="row.avatar?.url" size="sm" :tone="accountStatus(row) === 'inactive' ? 'neutral' : 'cobalt'" />
              <span class="flex min-w-0 flex-col">
                <strong class="truncate font-semibold">{{ row.full_name }}</strong>
                <span v-if="!open" class="truncate text-xs text-dl-muted">{{ row.email }}</span>
              </span>
            </span>
          </template>
          <template #cell-role="{ row }">{{ text.role(row) }}</template>
          <template #cell-status="{ row }">
            <DlBadge size="sm" dot :tone="STATUS_TONES[accountStatus(row)]">{{ text.status(row) }}</DlBadge>
          </template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
          <template #card="{ row }">
            <span class="flex items-center gap-3">
              <DlAvatar :name="row.full_name" :src="row.avatar?.url" size="sm" :tone="accountStatus(row) === 'inactive' ? 'neutral' : 'cobalt'" />
              <span class="flex min-w-0 flex-1 flex-col">
                <strong class="truncate font-semibold">{{ row.full_name }}</strong>
                <span class="truncate text-xs text-dl-muted">{{ text.role(row) }}</span>
              </span>
              <DlBadge size="sm" dot :tone="STATUS_TONES[accountStatus(row)]">{{ text.status(row) }}</DlBadge>
            </span>
          </template>
        </DlDataList>

        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>
    </div>

    <UserCreatePanel v-if="adding" v-model:open="open" @created="onCreated" />
    <UserReadPanel v-else-if="selected" v-model:open="open" :user="selected" @changed="onPanelChange" />

    <!-- Phone: "Add" sits at the bottom, in reach of the thumb -->
    <div v-if="auth.can('users.create')" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="add">{{ t('users.add.button') }}</DlButton>
    </div>
  </div>
</template>
