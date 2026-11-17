<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { fetchEvents, type LabEvent } from '@/api/tenant/events'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlDateRangePicker from '@/components/DlDateRangePicker.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import EventAddPanel from './EventAddPanel.vue'
import { STATUS_TONE, useEventText } from './eventDisplay'
import { useEventLookups } from './useEventLookups'

// Engager › Événements (docs/api/events.md): the events the viewer may see. Search, « À valider » for who decides,
// upcoming / past, type, campaign, wilaya, period; every column sorts; a click opens the event. Mockup frames 1 to 4.
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const text = useEventText()
const canAdd = computed(() => auth.can('events.create'))
const manage = computed(() => auth.can('events.manage'))
const { types, campaigns, wilayas } = useEventLookups(false)

const ALL = 'all'
const search = ref('')
const view = ref(ALL)
const typeId = ref<string | number>(ALL)
const campaignId = ref<string | number>(ALL)
const wilayaId = ref<string | number>(ALL)
const from = ref('')
const to = ref('')
const sort = ref('-start_at')
const page = ref(1)
const perPage = ref(25)
const rows = ref<LabEvent[]>([])
const total = ref(0)
const toValidate = ref(0)
const loading = ref(true)
const pick = (value: string | number) => (value === ALL || value === '' ? undefined : value)

async function load() {
  loading.value = true
  try {
    const answer = await fetchEvents({
      page: page.value, per_page: perPage.value, sort: sort.value,
      'filter[search]': search.value || undefined,
      'filter[to_validate]': view.value === 'to_validate' ? 1 : undefined,
      'filter[when]': ['upcoming', 'past'].includes(view.value) ? view.value : undefined,
      'filter[event_type_id]': pick(typeId.value), 'filter[campaign_id]': pick(campaignId.value), 'filter[wilaya_id]': pick(wilayaId.value),
      'filter[from]': from.value || undefined, 'filter[to]': to.value || undefined,
    })
    rows.value = answer.items
    total.value = answer.total
    toValidate.value = answer.toValidate
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
watch([search, view, typeId, campaignId, wilayaId, from, to, sort], () => { page.value = 1 })
watch([search, view, typeId, campaignId, wilayaId, from, to, sort, page, perPage], load, { immediate: true })

const viewItems = computed(() => [
  { value: ALL, label: t('events.filter.all') },
  ...(toValidate.value || view.value === 'to_validate' ? [{ value: 'to_validate', label: `${t('events.filter.toValidate')} · ${n(toValidate.value)}` }] : []),
  { value: 'upcoming', label: t('events.filter.upcoming') },
  { value: 'past', label: t('events.filter.past') },
])
const withAll = (label: string, items: { value: number; label: string }[]) => [{ value: ALL, label }, ...items]
const filtering = computed(() => !!search.value || view.value !== ALL || [typeId.value, campaignId.value, wilayaId.value].some(v => v !== ALL) || !!from.value)
function reset() {
  search.value = ''; view.value = ALL; typeId.value = ALL; campaignId.value = ALL; wilayaId.value = ALL; from.value = ''; to.value = ''
}

const columns = computed(() => [
  { key: 'name', label: t('events.columns.event'), sortKey: 'name' },
  { key: 'start_at', label: t('events.columns.dates'), sortKey: 'start_at' },
  { key: 'wilaya', label: t('events.columns.wilaya'), sortKey: 'wilaya' },
  { key: 'campaign', label: t('events.columns.campaign'), sortKey: 'campaign', secondary: true },
  { key: 'organiser', label: t('events.columns.organiser'), sortKey: 'organiser', secondary: true },
  { key: 'participants', label: t('events.columns.participants'), sortKey: 'participants_count', align: 'end' as const, secondary: true },
  { key: 'invited', label: t('events.columns.invited'), align: 'end' as const },
  { key: 'costs', label: t('events.columns.budget'), sortKey: 'costs', align: 'end' as const },
  { key: 'status', label: t('events.columns.status'), sortKey: 'status' },
  { key: 'created_at', label: t('studio.list.added'), sortKey: 'created_at', secondary: true },
])

const adding = ref(false)
const openPage = (row: LabEvent) => router.push({ name: 'tenant-event', params: { id: row.id } })
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canAdd && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.engage') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('events.list.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('events.list.subtitle') }}</p>
        </div>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="adding = true">{{ manage ? t('events.add.titleCreate') : t('events.add.titlePropose') }}</DlButton>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('events.filter.search')" :placeholder="t('events.filter.search')" icon="tabler-search" hide-label /></div>
        <DlSegmented v-model="view" :label="t('events.columns.status')" :items="viewItems" />
        <DlSelect v-model="typeId" :label="t('events.fields.type')" :options="withAll(t('events.filter.allTypes'), types)" appearance="filter" />
        <DlSelect v-model="campaignId" :label="t('events.columns.campaign')" :options="withAll(t('events.filter.allCampaigns'), campaigns)" appearance="filter" />
        <DlSelect v-model="wilayaId" :label="t('events.columns.wilaya')" :options="withAll(t('events.filter.allWilayas'), wilayas)" appearance="filter" />
        <div class="w-60"><DlDateRangePicker v-model:start="from" v-model:end="to" :label="t('events.filter.period')" :placeholder="t('events.filter.period')" hide-label clearable /></div>
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="reset">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          default-sort="-start_at"
          :label="t('events.list.title')"
          :columns="columns"
          :rows="rows"
          :row-key="row => row.id"
          :loading="loading"
          :empty-title="filtering ? t('geo.empty.search') : t('events.list.emptyTitle')"
          :empty-text="filtering ? undefined : t('events.list.emptyText')"
          @open="openPage"
        >
          <template #cell-name="{ row }">
            <strong class="block font-semibold">{{ row.name }}</strong>
            <span class="text-xs text-dl-muted">{{ row.event_type.name }}</span>
          </template>
          <template #cell-start_at="{ row }"><span class="whitespace-nowrap">{{ text.period(row.start_at, row.end_at) }}</span></template>
          <template #cell-wilaya="{ row }">{{ row.wilaya.name }}</template>
          <template #cell-campaign="{ row }"><DlBadge v-if="row.campaign" size="sm">{{ row.campaign.name }}</DlBadge><span v-else class="text-dl-muted">—</span></template>
          <template #cell-organiser="{ row }">{{ row.organiser.full_name }}</template>
          <template #cell-participants="{ row }"><span class="tabular-nums">{{ n(row.counts?.participants ?? 0) }}</span></template>
          <template #cell-invited="{ row }"><span class="tabular-nums">{{ n(row.counts?.invited ?? 0) }} / {{ row.status === 'proposed' ? '—' : n(row.counts?.present ?? 0) }}</span></template>
          <template #cell-costs="{ row }">
            <span class="block whitespace-nowrap tabular-nums">{{ text.money(row.costs) }}</span>
            <small v-if="row.real_cost != null" class="block whitespace-nowrap text-xs" :class="row.real_cost > row.costs ? 'text-dl-rejected' : 'text-dl-muted'">{{ t('events.list.real', { amount: text.money(row.real_cost) }) }}</small>
          </template>
          <template #cell-status="{ row }"><DlBadge size="sm" :tone="STATUS_TONE[row.status]" dot>{{ text.status(row.status) }}</DlBadge></template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.day(row.created_at.slice(0, 10)) }}</span></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.name }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.period(row.start_at, row.end_at), row.wilaya.name, text.status(row.status)].join(' · ') }}</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>

      <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block @click="adding = true">{{ manage ? t('events.add.titleCreate') : t('events.add.titlePropose') }}</DlButton>
      </div>
    </div>

    <EventAddPanel v-if="adding" v-model:open="adding" @created="openPage" />
  </div>
</template>
