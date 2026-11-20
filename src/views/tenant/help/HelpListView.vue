<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { Ticket } from '@/api/central/tickets'
import { fetchTicketForm, fetchTickets, type LabCounts, type TicketFormLists } from '@/api/tenant/tickets'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useAuthStore } from '@/stores/auth'
import { useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import { TICKET_TONE, useTicketText } from '@/views/shared/tickets/ticketDisplay'
import HelpNewPanel from './HelpNewPanel.vue'

// Aide › Mes tickets: the person's tickets (and those of the people below them, read only), opened from the « ? »
// button on any screen; that screen comes as `?from=` and goes with a new ticket. Mockup: support-mockups/ETickets.html 1, 4.
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const text = useTicketText()

const ALL = 'all'
const counts = ref<Partial<LabCounts>>({})
const list = useStudioList<Ticket, { status: string; who: string }>(
  async ({ page, perPage, search, sort, filters }) => {
    const answer = await fetchTickets({
      page,
      per_page: perPage,
      sort,
      'filter[search]': search || undefined,
      'filter[status]': filters.status === ALL ? undefined : filters.status,
      'filter[who]': filters.who === ALL ? undefined : filters.who,
    })
    counts.value = answer.counts
    if (answer.items.some(row => row.user.id !== auth.user?.id)) seesOthers.value = true
    return answer
  },
  { status: ALL, who: ALL },
  '-created_at',
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

// Someone with people below them gets « Tickets » with the author column and the who filter.
const seesOthers = ref(false)
const statusItems = computed(() => {
  const all = (counts.value.waiting ?? 0) + (counts.value.resolved ?? 0) + (counts.value.closed ?? 0)
  return [
    { value: ALL, label: `${t('tickets.list.all')} · ${all}` },
    ...(['waiting', 'resolved', 'closed'] as const).map(key => ({ value: key, label: `${t(`tickets.list.${key}`)} · ${counts.value[key] ?? 0}` })),
  ]
})
const whoItems = computed(() => [ALL, 'mine', 'team'].map(value => ({ value, label: t(`tickets.list.who.${value}`) })))
const columns = computed(() => [
  { key: 'number', label: t('tickets.fields.number'), sortKey: 'number' },
  { key: 'title', label: t('tickets.fields.title'), sortKey: 'title' },
  { key: 'category', label: t('tickets.fields.category'), sortKey: 'category', secondary: true },
  { key: 'priority', label: t('tickets.fields.priority'), sortKey: 'priority', secondary: true },
  ...(seesOthers.value ? [{ key: 'user', label: t('tickets.fields.author'), sortKey: 'user', secondary: true }] : []),
  { key: 'status', label: t('tickets.fields.status'), sortKey: 'status' },
  { key: 'due_at', label: t('tickets.fields.due'), sortKey: 'due_at', secondary: true },
  { key: 'created_at', label: t('tickets.fields.opened'), sortKey: 'created_at' },
])

// The form's lists, reloaded on open and when the tab comes back.
const lists = ref<TicketFormLists | null>(null)
onMountedAndFocus(async () => { lists.value = await fetchTicketForm() })
const fromPage = computed(() => (typeof route.query.from === 'string' ? route.query.from : null))
const adding = ref(false)
const openTicket = (ticket: Ticket) => router.push({ name: 'tenant-help-ticket', params: { id: ticket.id } })
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('tickets.help') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ seesOthers ? t('tickets.list.titleTeam') : t('tickets.list.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('tickets.list.subtitle') }}</p>
        </div>
        <DlButton variant="primary" icon="tabler-plus" @click="adding = true">{{ t('tickets.new.title') }}</DlButton>
      </div>

      <div class="flex flex-wrap items-end gap-2.5">
        <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('tickets.list.search')" :placeholder="t('tickets.list.search')" icon="tabler-search" hide-label /></div>
        <DlSegmented v-model="filters.status" :label="t('tickets.fields.status')" :items="statusItems" />
        <DlSegmented v-if="seesOthers" v-model="filters.who" :label="t('tickets.fields.author')" :items="whoItems" />
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          default-sort="-created_at"
          :label="t('tickets.list.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :loading="loading"
          :compact="adding"
          :empty-title="t('tickets.list.emptyTitle')"
          :empty-text="t('tickets.list.emptyText')"
          @open="openTicket"
        >
          <template #cell-number="{ row }">
            <span class="inline-flex items-center gap-1.5">
              <span v-if="row.unread" class="h-2 w-2 rounded-full bg-dl-rejected" :title="t('tickets.list.unread')" />
              <strong class="font-semibold">{{ row.number }}</strong>
            </span>
          </template>
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
            <span class="text-xs text-dl-muted">{{ [text.status(row.status), row.category.name, row.priority.name, text.date(row.created_at)].join(' · ') }}</span>
          </template>
        </DlDataList>
        <div class="flex flex-wrap items-center justify-end gap-3">
          <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
        </div>
      </div>
    </div>

    <HelpNewPanel v-if="adding" v-model:open="adding" :lists="lists" :page="fromPage" @created="openTicket" />
  </div>
</template>
