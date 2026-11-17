<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import type { Campaign } from '@/api/tenant/campaigns'
import { fetchCampaignActions, type MarketingAction, type Progress } from '@/api/tenant/marketingActions'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useCampaignText } from '@/views/tenant/campaigns/campaignDisplay'
import ActionMarketingSheet from './ActionMarketingSheet.vue'
import ActionProgress from './ActionProgress.vue'

// A campaign's « Actions marketing » tab (docs/api/marketing-actions.md, mockup frame 1): five figures, then one row
// per action with planned / done (on the people the viewer sees). A row opens the action's page.
const props = defineProps<{ campaign: Campaign }>()
const emit = defineEmits<{ changed: [] }>()
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const text = useCampaignText()

const search = ref('')
const sort = ref('start_date')
const rows = ref<MarketingAction[]>([])
const figures = ref<(Progress & { actions: number; budget: number }) | null>(null)
const loading = ref(true)
async function load() {
  loading.value = true
  try {
    const answer = await fetchCampaignActions(props.campaign.id, { sort: sort.value, 'filter[search]': search.value || undefined })
    rows.value = answer.items
    figures.value = answer.figures
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
watch([search, sort], load, { immediate: true })

const money = (value: number) => `${n(value, { maximumFractionDigits: 2 })} DA`
const tiles = computed(() => {
  const f = figures.value
  return f ? [
    { value: n(f.actions), label: t('actions.tiles.actions') },
    { value: n(f.planned), label: t('actions.tiles.planned') },
    { value: n(f.done), label: t('actions.tiles.done') },
    { value: `${f.rate} %`, label: t('actions.tiles.rate') },
    { value: money(f.budget), label: t('actions.tiles.budget') },
  ] : []
})
const columns = computed(() => [
  { key: 'activity_type', label: t('actions.columns.type'), sortKey: 'activity_type' },
  { key: 'wilaya', label: t('actions.columns.wilaya'), sortKey: 'wilaya' },
  { key: 'specialities', label: t('actions.columns.specialities'), secondary: true },
  { key: 'start_date', label: t('actions.columns.dates'), sortKey: 'start_date' },
  { key: 'objective', label: t('actions.columns.objective'), sortKey: 'objective', align: 'end' as const, secondary: true },
  { key: 'people_count', label: t('actions.columns.people'), sortKey: 'people_count', align: 'end' as const },
  { key: 'done', label: t('actions.columns.progress'), sortKey: 'done' },
  { key: 'budget', label: t('actions.columns.budget'), sortKey: 'budget', align: 'end' as const, secondary: true },
])
const adding = ref(false)
const openRow = (row: MarketingAction) => router.push({ name: 'tenant-marketing-action', params: { id: props.campaign.id, actionId: row.id } })
function saved(row: MarketingAction) {
  adding.value = false
  emit('changed')
  openRow(row)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div v-for="tile in tiles" :key="tile.label" class="flex flex-col gap-1 rounded-3xl bg-dl-paper p-4">
        <strong class="font-display text-[22px] leading-none">{{ tile.value }}</strong>
        <span class="text-xs text-dl-muted">{{ tile.label }}</span>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2.5">
      <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('actions.filter.search')" :placeholder="t('actions.filter.search')" icon="tabler-search" hide-label /></div>
      <DlButton v-if="auth.can('campaigns.update')" variant="primary" icon="tabler-plus" class="ms-auto" @click="adding = true">{{ t('actions.sheet.addTitle') }}</DlButton>
    </div>
    <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
      <DlDataList v-model:sort="sort" default-sort="start_date" :label="t('campaigns.tabs.actions')" :columns="columns" :rows="rows" :row-key="row => row.id" :loading="loading"
        :empty-title="t('actions.list.emptyTitle')" :empty-text="t('actions.list.emptyText')" @open="openRow">
        <template #cell-activity_type="{ row }"><strong class="font-semibold">{{ row.activity_type.name }}</strong></template>
        <template #cell-wilaya="{ row }">{{ row.wilaya?.name ?? '—' }}</template>
        <template #cell-specialities="{ row }"><span class="text-dl-muted">{{ row.specialities.map(s => s.name).join(', ') || '—' }}</span></template>
        <template #cell-start_date="{ row }"><span class="whitespace-nowrap">{{ text.period(row.start_date, row.end_date) }}</span></template>
        <template #cell-objective="{ row }"><span class="tabular-nums">{{ n(row.objective) }}</span></template>
        <template #cell-people_count="{ row }"><span class="tabular-nums">{{ n(row.people_count ?? 0) }}</span></template>
        <template #cell-done="{ row }"><ActionProgress :done="row.done ?? 0" :planned="row.planned ?? 0" /></template>
        <template #cell-budget="{ row }"><span class="whitespace-nowrap tabular-nums">{{ money(row.budget) }}</span></template>
        <template #card="{ row }">
          <strong class="block font-semibold">{{ row.activity_type.name }}</strong>
          <span class="text-xs text-dl-muted">{{ text.period(row.start_date, row.end_date) }} · {{ n(row.done ?? 0) }} / {{ n(row.planned ?? 0) }}</span>
        </template>
      </DlDataList>
      <p class="text-xs text-dl-muted">{{ t('actions.list.note') }}</p>
    </div>
    <ActionMarketingSheet v-if="adding" v-model:open="adding" :campaign="campaign" @saved="saved" />
  </div>
</template>
