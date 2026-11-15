<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { fetchEvents, type CampaignEventFigures, type LabEvent } from '@/api/tenant/events'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import EventAddPanel from './EventAddPanel.vue'
import { STATUS_TONE, useEventText } from './eventDisplay'

// A campaign's « Événements » tab (mockup frame 12): five figures and its events; « + Créer un événement » fills the
// campaign in. The events the viewer may see, as Engager › Événements.
const props = defineProps<{ campaignId: number }>()
const emit = defineEmits<{ changed: [] }>()
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const text = useEventText()

const search = ref('')
const sort = ref('-start_at')
const page = ref(1)
const perPage = ref(25)
const rows = ref<LabEvent[]>([])
const total = ref(0)
const figures = ref<CampaignEventFigures | null>(null)
const loading = ref(true)
async function load() {
  loading.value = true
  try {
    const answer = await fetchEvents({ page: page.value, per_page: perPage.value, sort: sort.value, 'filter[campaign_id]': props.campaignId, 'filter[search]': search.value || undefined })
    rows.value = answer.items
    total.value = answer.total
    figures.value = answer.figures ?? null
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
watch([search, sort], () => { page.value = 1 })
watch([search, sort, page, perPage], load, { immediate: true })

const tiles = computed(() => {
  const f = figures.value
  return f ? [
    { value: n(f.events), label: t('events.campaign.events', { count: n(f.closed) }) },
    { value: n(f.invited), label: t('events.tiles.invited') },
    { value: n(f.present), label: t('events.tiles.presentPlain') },
    { value: text.money(f.costs), label: t('events.tiles.budget') },
    { value: text.money(f.real), label: t('events.campaign.real') },
  ] : []
})
const columns = computed(() => [
  { key: 'name', label: t('events.columns.event'), sortKey: 'name' },
  { key: 'start_at', label: t('events.columns.dates'), sortKey: 'start_at' },
  { key: 'wilaya', label: t('events.columns.wilaya'), sortKey: 'wilaya' },
  { key: 'organiser', label: t('events.columns.organiser'), sortKey: 'organiser', secondary: true },
  { key: 'invited', label: t('events.columns.invited'), align: 'end' as const },
  { key: 'costs', label: t('events.columns.budget'), sortKey: 'costs', align: 'end' as const },
  { key: 'status', label: t('events.columns.status'), sortKey: 'status' },
])
const adding = ref(false)
const openRow = (row: LabEvent) => router.push({ name: 'tenant-event', params: { id: row.id } })
function created(row: LabEvent) {
  adding.value = false
  emit('changed')
  openRow(row)
}
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div v-for="tile in tiles" :key="tile.label" class="flex flex-col gap-1 rounded-3xl bg-dl-paper p-4">
          <strong class="font-display text-[22px] leading-none">{{ tile.value }}</strong>
          <span class="text-xs text-dl-muted">{{ tile.label }}</span>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('events.filter.search')" :placeholder="t('events.filter.search')" icon="tabler-search" hide-label /></div>
        <DlButton v-if="auth.can('events.create')" variant="primary" icon="tabler-plus" class="ms-auto" @click="adding = true">
          {{ auth.can('events.manage') ? t('events.add.titleCreate') : t('events.add.titlePropose') }}
        </DlButton>
      </div>
      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList v-model:sort="sort" default-sort="-start_at" :label="t('events.list.title')" :columns="columns" :rows="rows" :row-key="row => row.id" :loading="loading"
          :empty-title="t('events.campaign.emptyTitle')" :empty-text="t('events.campaign.emptyText')" @open="openRow">
          <template #cell-name="{ row }"><strong class="block font-semibold">{{ row.name }}</strong><span class="text-xs text-dl-muted">{{ row.event_type.name }}</span></template>
          <template #cell-start_at="{ row }"><span class="whitespace-nowrap">{{ text.period(row.start_at, row.end_at) }}</span></template>
          <template #cell-wilaya="{ row }">{{ row.wilaya.name }}</template>
          <template #cell-organiser="{ row }">{{ row.organiser.full_name }}</template>
          <template #cell-invited="{ row }"><span class="tabular-nums">{{ n(row.counts?.invited ?? 0) }} / {{ n(row.counts?.present ?? 0) }}</span></template>
          <template #cell-costs="{ row }">
            <span class="block whitespace-nowrap tabular-nums">{{ text.money(row.costs) }}</span>
            <small v-if="row.real_cost != null" class="block text-xs text-dl-muted">{{ t('events.list.real', { amount: text.money(row.real_cost) }) }}</small>
          </template>
          <template #cell-status="{ row }"><DlBadge size="sm" :tone="STATUS_TONE[row.status]" dot>{{ text.status(row.status) }}</DlBadge></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.name }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.period(row.start_at, row.end_at), row.wilaya.name, text.status(row.status)].join(' · ') }}</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
        <p class="text-xs text-dl-muted">{{ t('events.campaign.note') }}</p>
      </div>
    </div>
    <EventAddPanel v-if="adding" v-model:open="adding" :campaign-id="campaignId" @created="created" />
  </div>
</template>
