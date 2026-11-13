<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { CONSENT_STATES, fetchConsent, fetchConsentStateCounts, fetchConsents, type Consent, type ConsentState } from '@/api/tenant/consents'
import type { ListParams } from '@/api/tenant/geography'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import { exportToXlsx } from '@/composables/exportXlsx'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { avatarName, useHcpText } from '@/views/tenant/hcps/hcpForm'
import { STUDIO_DEFAULT_SORT, useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import { useUsers } from '@/views/tenant/territories/useTerritoryLookups'
import { today } from '@/views/tenant/users/userDisplay'
import ConsentAskPanel from './ConsentAskPanel.vue'
import ConsentPanel from './ConsentPanel.vue'
import { STATE_TONES, useConsentText } from './consentText'

// Professionals › Consents: answer tabs with counts, search, side panel (QR + link while waiting,
// the answer kept as proof), "Ask for consent". ?state= opens a tab. Mockup: docs/design/customers-mockups/Consents.html
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const canStore = (resource: string) => auth.can(`${resource}.create`)
const text = useConsentText()
const hcpText = useHcpText()
const users = useUsers()
users.ensureLoaded()

const ALL = 'all'
type Filters = { state: string; requestedBy: string | number; added: string; from: string; to: string }
function addedDates(f: Filters): { from?: string; to?: string } {
  if (f.added === 'day' && f.from) return { from: f.from, to: f.from }
  if (f.added === 'range' && (f.from || f.to)) {
    const [from, to] = [f.from, f.to].sort((a, b) => (a && b ? a.localeCompare(b) : 0))
    return { from: from || undefined, to: to || undefined }
  }
  return {}
}
function baseQuery(search: string, f: Filters): ListParams {
  const { from, to } = addedDates(f)
  return {
    'filter[q]': search || undefined,
    'filter[requested_by]': f.requestedBy === ALL ? undefined : Number(f.requestedBy),
    'filter[created_from]': from,
    'filter[created_to]': to,
  }
}
const queryOf = (search: string, f: Filters): ListParams => ({ ...baseQuery(search, f), 'filter[state]': f.state === ALL ? undefined : f.state as ConsentState })

const list = useStudioList<Consent, Filters>(
  ({ page, perPage, search, sort, filters }) => fetchConsents({ page, per_page: perPage, sort, ...queryOf(search, filters) }),
  { state: CONSENT_STATES.includes(route.query.state as ConsentState) ? String(route.query.state) : ALL, requestedBy: ALL, added: ALL, from: '', to: '' },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const counts = ref<Record<string, number> | null>(null)
async function loadCounts() {
  try {
    counts.value = await fetchConsentStateCounts(baseQuery(search.value.trim(), filters))
  }
  catch {
    counts.value = null
  }
}
let countTimer: ReturnType<typeof setTimeout> | undefined
watch(() => JSON.stringify(baseQuery(search.value.trim(), filters)), () => {
  clearTimeout(countTimer)
  countTimer = setTimeout(loadCounts, 250)
}, { immediate: true })
const tabs = computed(() => [ALL, ...CONSENT_STATES].map(value => ({
  value,
  label: value === ALL ? t('hcps.filter.allTypes') : t(`consents.tabs.${value}`),
  count: counts.value?.[value],
})))
function setState(value: string) {
  filters.state = value
  router.replace({ query: { ...route.query, state: value === ALL ? undefined : value } })
}

const userOptions = computed(() => [
  { value: ALL, label: t('hcps.filter.all') },
  ...users.items.value.map(user => ({ value: user.id, label: user.full_name })).sort((a, b) => a.label.localeCompare(b.label)),
])
const addedFilter = computed({
  get: () => filters.added,
  set: value => {
    const added = String(value ?? ALL)
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
const filtered = computed(() => !!search.value || filters.state !== ALL || filters.requestedBy !== ALL || filters.added !== ALL)

const open = ref(false)
const selected = ref<Consent | null>(null)
const asking = ref(false)
async function show(id: number) {
  try {
    const full = await fetchConsent(id)
    asking.value = false
    selected.value = full
    open.value = true
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}
function ask() {
  selected.value = null
  asking.value = true
  open.value = true
}
function refresh() {
  list.reload()
  loadCounts()
}
async function onCreated(consent: Consent) {
  refresh()
  await show(consent.id)
}
async function onChanged() {
  refresh()
  if (selected.value) await show(selected.value.id)
}
function onDeleted() {
  open.value = false
  selected.value = null
  refresh()
}

const columns = [
  { key: 'hcp', label: t('hcps.columns.professional') },
  { key: 'state', label: t('consents.columns.answer') },
  { key: 'asked', label: t('consents.columns.asked'), sortKey: 'id' },
  { key: 'signed', label: t('consents.columns.answered'), secondary: true },
]

const exporting = ref(false)
async function exportList() {
  exporting.value = true
  try {
    const rows: Consent[] = []
    for (let pageNumber = 1; ; pageNumber++) {
      const result = await fetchConsents({ page: pageNumber, per_page: 100, sort: sort.value || STUDIO_DEFAULT_SORT, ...queryOf(search.value.trim(), filters) })
      rows.push(...result.items)
      if (!result.items.length || rows.length >= result.total) break
    }
    await exportToXlsx(rows.map(consent => ({
      [t('hcps.columns.professional')]: consent.hcp?.name ?? '',
      [t('consents.columns.answer')]: text.state(consent.state),
      [t('consents.columns.asked')]: consent.created_at?.slice(0, 10) ?? '',
      [t('consents.columns.askedBy')]: text.person(consent.requested_by) ?? '',
      [t('consents.columns.answered')]: consent.signed_at ?? '',
      [t('hcps.fields.email')]: consent.email ?? '',
      [t('hcps.fields.phone')]: consent.phone ?? '',
    })), `${t('consents.title')} ${today()}`, t('consents.title'))
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
  <div class="flex w-full flex-col gap-5" :class="canStore('consents') && 'max-md:pb-20'">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.customers') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('consents.title') }}</h1>
      </div>
      <div class="flex gap-2.5">
        <DlButton variant="outline" icon="tabler-file-spreadsheet" :loading="exporting" :disabled="!total" @click="exportList">{{ t('users.export') }}</DlButton>
        <DlButton v-if="canStore('consents')" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="ask">{{ t('consents.ask.button') }}</DlButton>
      </div>
    </div>

    <div role="tablist" :aria-label="t('consents.columns.answer')" class="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:self-start md:rounded-2xl md:bg-dl-paper md:p-1">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="filters.state === tab.value"
        class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
        :class="filters.state === tab.value ? 'bg-dl-ink text-dl-on-ink dark:bg-dl-fg dark:text-dl-mist' : 'text-dl-body hover:text-dl-fg max-md:bg-dl-paper'"
        @click="setState(tab.value)"
      >
        {{ tab.label }}<span v-if="tab.count !== undefined" class="text-[11.5px] tabular-nums opacity-70">{{ n(tab.count) }}</span>
      </button>
    </div>

    <div class="flex items-start gap-5">
      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <DlInput v-model="search" type="search" icon="tabler-search" :label="t('consents.search')" :placeholder="t('consents.search')" hide-label class="w-full sm:max-w-xs" />
          <DlSelect v-model="filters.requestedBy" :label="t('consents.columns.askedBy')" :options="userOptions" appearance="filter" />
          <DlSelect v-model="addedFilter" :label="t('consents.columns.asked')" :options="addedOptions" appearance="filter" />
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
          :label="t('consents.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="open ? selected?.id : null"
          :loading="loading"
          :compact="open"
          :empty-title="filtered ? t('geo.empty.search') : t('consents.empty')"
          @open="row => show(row.id)"
        >
          <template #cell-hcp="{ row }">
            <span class="flex items-center gap-2.5">
              <DlAvatar :name="avatarName(row.hcp?.name ?? '?')" size="sm" tone="neutral" />
              <span class="flex min-w-0 flex-col">
                <strong class="font-semibold">{{ row.hcp?.name ?? `#${row.id}` }}</strong>
                <span class="truncate text-xs text-dl-muted">{{ row.hcp ? [hcpText.type(row.hcp.type), row.hcp.commune].filter(Boolean).join(' · ') : '' }}</span>
              </span>
            </span>
          </template>
          <template #cell-state="{ row }"><DlBadge size="sm" :tone="STATE_TONES[row.state]" dot>{{ text.state(row.state) }}</DlBadge></template>
          <template #cell-asked="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.asked(row) }}</span></template>
          <template #cell-signed="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ row.signed_at ? text.dateTime(row.signed_at) : '—' }}</span></template>
          <template #card="{ row }">
            <span class="flex items-center gap-3">
              <DlAvatar :name="avatarName(row.hcp?.name ?? '?')" size="sm" tone="neutral" />
              <span class="flex min-w-0 flex-1 flex-col"><strong class="truncate font-semibold">{{ row.hcp?.name }}</strong><span class="truncate text-xs text-dl-muted">{{ text.asked(row) }}</span></span>
              <DlBadge size="sm" :tone="STATE_TONES[row.state]" dot>{{ text.state(row.state) }}</DlBadge>
            </span>
          </template>
        </DlDataList>

        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>

      <ConsentAskPanel v-if="asking" v-model:open="open" @created="onCreated" />
      <ConsentPanel v-else-if="selected" v-model:open="open" :consent="selected" @changed="onChanged" @deleted="onDeleted" />
    </div>

    <div v-if="canStore('consents')" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="ask">{{ t('consents.ask.button') }}</DlButton>
    </div>
  </div>
</template>
