<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { labsApi } from '@/api/central/labs'
import { ticketsApi, type CentralCounts, type Ticket, type TicketListItem } from '@/api/central/tickets'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import DlTabs from '@/components/DlTabs.vue'
import { TICKET_TONE, useTicketText } from '@/views/shared/tickets/ticketDisplay'
import TicketPanel from './TicketPanel.vue'
import TicketSettings from './TicketSettings.vue'

// Central › Tickets: every lab's tickets, waiting ones first by due time (late in red); a click opens the panel beside
// the list. Tab « Settings »: the lists and delays. Mockup: support-mockups/ETickets.html frames 5 and 8.
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const text = useTicketText()

const tab = computed({
  get: () => (route.query.tab === 'settings' ? 'settings' : 'tickets'),
  set: (value: string) => router.replace({ query: value === 'settings' ? { tab: 'settings' } : {} }),
})
const tabs = computed(() => [{ value: 'tickets', label: t('central.tickets.title') }, { value: 'settings', label: t('central.tickets.settings.title') }])

const ALL = 'all'
const rows = ref<Ticket[]>([])
const total = ref(0)
const counts = ref<Partial<CentralCounts>>({})
const page = ref(1)
const perPage = ref(25)
const search = ref('')
const status = ref('waiting')
const lab = ref(ALL)
const category = ref<number | string>(ALL)
const priority = ref<number | string>(ALL)
const late = ref(false)
const sort = ref<string | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const answer = await ticketsApi.list({
      page: page.value,
      per_page: perPage.value,
      sort: sort.value || undefined,
      'filter[search]': search.value || undefined,
      'filter[status]': status.value === ALL ? undefined : status.value,
      'filter[tenant_id]': lab.value === ALL ? undefined : lab.value,
      'filter[category_id]': category.value === ALL ? undefined : category.value,
      'filter[priority_id]': priority.value === ALL ? undefined : priority.value,
      'filter[late]': late.value ? 1 : undefined,
    })
    rows.value = answer.items
    total.value = answer.total
    counts.value = answer.counts
  }
  catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
  finally {
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
watch([status, lab, category, priority, late, sort, perPage], reloadFromFirstPage)
watch(page, load)

// The filters' lists.
const labs = ref<{ value: string; label: string }[]>([])
const categories = ref<TicketListItem[]>([])
const priorities = ref<TicketListItem[]>([])
onMounted(async () => {
  load()
  labs.value = (await labsApi.list().catch(() => [])).map(item => ({ value: item.id, label: item.name }))
  categories.value = await ticketsApi.items('ticket-categories').catch(() => [])
  priorities.value = await ticketsApi.items('ticket-priorities').catch(() => [])
})
const allOf = (items: { value: string | number; label: string }[]) => [{ value: ALL, label: t('common.list.all') }, ...items]
const statusItems = computed(() => (['waiting', 'open', 'in_progress', 'resolved', 'closed', ALL] as const)
  .map(key => ({ value: key, label: `${key === 'waiting' ? t('tickets.list.waiting') : key === ALL ? t('tickets.list.all') : text.status(key)} · ${counts.value[key] ?? 0}` })))

const columns = computed(() => [
  { key: 'number', label: t('tickets.fields.number'), sortKey: 'number' },
  { key: 'lab', label: t('central.tickets.lab'), sortKey: 'lab' },
  { key: 'title', label: t('tickets.fields.title'), sortKey: 'title' },
  { key: 'category', label: t('tickets.fields.category'), sortKey: 'category', secondary: true },
  { key: 'priority', label: t('tickets.fields.priority'), sortKey: 'priority', secondary: true },
  { key: 'user', label: t('tickets.fields.author'), sortKey: 'user', secondary: true },
  { key: 'status', label: t('tickets.fields.status'), sortKey: 'status' },
  { key: 'due_at', label: t('tickets.fields.due'), sortKey: 'due_at' },
  { key: 'created_at', label: t('common.list.createdAt'), sortKey: 'created_at', secondary: true },
])

const selected = ref<Ticket | null>(null)
const panelOpen = computed({ get: () => selected.value !== null, set: open => { if (!open) selected.value = null } })
function onChanged(ticket: Ticket) {
  selected.value = ticket
  load()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.tickets.title') }}</h1>
    <DlTabs v-model="tab" :label="t('central.tickets.title')" :items="tabs">
      <template #tickets>
        <div class="flex items-start gap-5">
          <div class="flex min-w-0 flex-1 flex-col gap-4">
            <DlAlert v-if="error">{{ error }}</DlAlert>
            <div class="flex flex-wrap items-end gap-2.5">
              <DlInput v-model="search" :label="t('central.tickets.search')" :placeholder="t('central.tickets.search')" hide-label icon="tabler-search" class="w-full sm:w-64" />
              <DlSegmented v-model="status" :label="t('tickets.fields.status')" :items="statusItems" />
            </div>
            <div class="flex flex-wrap items-center gap-2.5">
              <DlSelect v-model="lab" :label="t('central.tickets.lab')" :options="allOf(labs)" appearance="filter" />
              <DlSelect v-model="category" :label="t('tickets.fields.category')" :options="allOf(categories.map(item => ({ value: item.id, label: item.name })))" appearance="filter" />
              <DlSelect v-model="priority" :label="t('tickets.fields.priority')" :options="allOf(priorities.map(item => ({ value: item.id, label: item.name })))" appearance="filter" />
              <DlSwitch v-model="late" :label="t('central.tickets.lateOnly')" />
            </div>
            <div class="rounded-3xl bg-dl-paper p-4">
              <DlDataList
                v-model:sort="sort"
                :label="t('central.tickets.title')"
                :columns="columns"
                :rows="rows"
                :row-key="row => row.id"
                :selected-key="selected?.id"
                :loading="loading"
                :compact="panelOpen"
                :empty-title="t('central.tickets.empty')"
                @open="row => (selected = row)"
              >
                <template #cell-number="{ row }"><strong class="font-semibold">{{ row.number }}</strong></template>
                <template #cell-lab="{ row }">{{ row.lab?.name }}</template>
                <template #cell-category="{ row }">{{ row.category.name }}</template>
                <template #cell-priority="{ row }">{{ row.priority.name }}</template>
                <template #cell-user="{ row }">{{ row.user.name }}</template>
                <template #cell-status="{ row }"><DlBadge size="sm" :tone="TICKET_TONE[row.status]" dot>{{ text.status(row.status) }}</DlBadge></template>
                <template #cell-due_at="{ row }">
                  <span v-if="row.status === 'open' || row.status === 'in_progress'" class="whitespace-nowrap" :class="row.late && 'font-semibold text-dl-rejected'">
                    {{ row.late ? t('tickets.late', { date: text.time(row.due_at) }) : text.time(row.due_at) }}
                  </span>
                  <span v-else>—</span>
                </template>
                <template #cell-created_at="{ row }"><span class="whitespace-nowrap">{{ text.date(row.created_at) }}</span></template>
                <template #card="{ row }">
                  <strong class="block font-semibold">{{ row.number }} · {{ row.title }}</strong>
                  <span class="text-xs text-dl-muted">{{ [row.lab?.name, text.status(row.status), row.priority.name].join(' · ') }}</span>
                </template>
              </DlDataList>
              <p class="pt-2 text-xs text-dl-muted">{{ t('central.tickets.order') }}</p>
              <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
            </div>
          </div>
          <TicketPanel v-if="selected" v-model:open="panelOpen" :ticket="selected" @changed="onChanged" />
        </div>
      </template>
      <template #settings>
        <TicketSettings />
      </template>
    </DlTabs>
  </div>
</template>
