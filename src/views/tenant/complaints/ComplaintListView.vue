<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchComplaintForm, fetchComplaints, type Complaint, type ComplaintCounts, type ComplaintForm } from '@/api/tenant/complaints'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import { useTicketText } from '@/views/shared/tickets/ticketDisplay'
import ComplaintNewPanel from './ComplaintNewPanel.vue'
import { COMPLAINT_TONE, useComplaintText } from './complaintDisplay'

// Réclamations › Mes réclamations (everyone) or À traiter (`complaints.handle`: urgent and oldest first, « Anonyme »
// when the author hid their name). A click opens the complaint's page. Mockup: complaints-mockups/Complaints.html 1, 3.
const props = defineProps<{ inbox?: boolean }>()
const { t } = useI18n()
const router = useRouter()
const text = useComplaintText()
const time = useTicketText()

const ALL = 'all'
const counts = ref<Partial<ComplaintCounts>>({})
const list = useStudioList<Complaint, { status: string }>(
  async ({ page, perPage, search, sort, filters }) => {
    const answer = await fetchComplaints(!!props.inbox, {
      page,
      per_page: perPage,
      sort: props.inbox && sort === '-created_at' ? undefined : sort,
      'filter[search]': search || undefined,
      'filter[status]': filters.status === ALL ? undefined : filters.status,
    })
    counts.value = answer.counts
    return answer
  },
  { status: props.inbox ? 'waiting' : ALL },
  '-created_at',
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const statusItems = computed(() => {
  const all = (counts.value.waiting ?? 0) + (counts.value.resolved ?? 0) + (counts.value.closed ?? 0)
  return [
    ...(['waiting', 'resolved', 'closed'] as const).map(key => ({ value: key, label: `${t(`complaints.list.${key}`)} · ${counts.value[key] ?? 0}` })),
    { value: ALL, label: `${t('complaints.list.all')} · ${all}` },
  ]
})
const columns = computed(() => [
  { key: 'number', label: t('complaints.fields.number'), sortKey: 'number' },
  { key: 'title', label: t('complaints.fields.title'), sortKey: 'title' },
  { key: 'category', label: t('complaints.fields.category'), sortKey: 'category', secondary: true },
  { key: 'urgency', label: t('complaints.fields.urgency'), sortKey: 'urgency' },
  ...(props.inbox ? [{ key: 'user', label: t('complaints.fields.author') }] : []),
  { key: 'status', label: t('complaints.fields.status'), sortKey: 'status' },
  { key: 'created_at', label: t('complaints.fields.sentOn'), sortKey: 'created_at', secondary: true },
])

// The form's lists, reloaded on open and when the tab comes back.
const form = ref<ComplaintForm | null>(null)
onMountedAndFocus(async () => { if (!props.inbox) form.value = await fetchComplaintForm() })
const adding = ref(false)
const openComplaint = (complaint: Complaint) => router.push({ name: 'tenant-complaint', params: { id: complaint.id } })
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.complaints') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ inbox ? t('complaints.list.inbox') : t('complaints.list.mine') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ inbox ? t('complaints.list.inboxSubtitle') : t('complaints.list.mineSubtitle') }}</p>
        </div>
        <DlButton v-if="!inbox" variant="primary" icon="tabler-plus" @click="adding = true">{{ t('complaints.new.title') }}</DlButton>
      </div>

      <div class="flex flex-wrap items-end gap-2.5">
        <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('complaints.list.search')" :placeholder="t('complaints.list.search')" icon="tabler-search" hide-label /></div>
        <DlSegmented v-model="filters.status" :label="t('complaints.fields.status')" :items="statusItems" />
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          :default-sort="inbox ? null : '-created_at'"
          :label="inbox ? t('complaints.list.inbox') : t('complaints.list.mine')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :loading="loading"
          :compact="adding"
          :empty-title="t('complaints.list.emptyTitle')"
          :empty-text="inbox ? undefined : t('complaints.list.emptyText')"
          @open="openComplaint"
        >
          <template #cell-number="{ row }"><strong class="font-semibold">{{ row.number }}</strong></template>
          <template #cell-category="{ row }">{{ row.category.name }}</template>
          <template #cell-urgency="{ row }">
            <DlBadge v-if="row.urgency === 'urgent'" size="sm" tone="danger">{{ t('complaints.urgency.urgent') }}</DlBadge>
            <span v-else class="text-xs text-dl-muted">{{ t('complaints.urgency.normal') }}</span>
          </template>
          <template #cell-user="{ row }"><span :class="!row.user && 'italic text-dl-muted'">{{ text.author(row.user) }}</span></template>
          <template #cell-status="{ row }"><DlBadge size="sm" :tone="COMPLAINT_TONE[row.status]" dot>{{ text.status(row.status) }}</DlBadge></template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap">{{ time.date(row.created_at) }}</span></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.number }} · {{ row.title }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.status(row.status), row.category.name, t(`complaints.urgency.${row.urgency}`)].join(' · ') }}</span>
          </template>
        </DlDataList>
        <div class="flex flex-wrap items-center justify-end gap-3">
          <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
        </div>
      </div>
    </div>

    <ComplaintNewPanel v-if="adding" v-model:open="adding" :form="form" @sent="openComplaint" />
  </div>
</template>
