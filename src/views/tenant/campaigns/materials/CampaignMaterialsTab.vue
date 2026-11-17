<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import type { Campaign } from '@/api/tenant/campaigns'
import { fetchMaterialDistributions, type MaterialDistribution, type TabFigures } from '@/api/tenant/materials'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import MaterialDistributeSheet from './MaterialDistributeSheet.vue'

// A campaign's « Matériels » tab: five figures, then one line per distribution (material and its role, type, brand,
// specialities, people, given, handed out / left, unit cost, budget). Mockup frame 1.
const props = defineProps<{ campaign: Campaign }>()
const emit = defineEmits<{ changed: [] }>()
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const canGive = computed(() => auth.can('campaigns.update') && props.campaign.state !== 'ended')

const ALL = 'all'
const type = ref(ALL)
const search = ref('')
const rows = ref<MaterialDistribution[]>([])
const figures = ref<TabFigures | null>(null)
const loading = ref(true)
let timer: ReturnType<typeof setTimeout> | undefined
async function load() {
  loading.value = true
  try {
    const answer = await fetchMaterialDistributions(props.campaign.id, { 'filter[type]': type.value === ALL ? undefined : type.value, 'filter[search]': search.value.trim() || undefined })
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
watch(type, load, { immediate: true })
watch(search, () => { clearTimeout(timer); timer = setTimeout(load, 300) })

const money = (value: number | null) => (value == null ? '—' : `${n(value, { maximumFractionDigits: 2 })} DA`)
const typeItems = computed(() => [ALL, 'visit', 'event'].map(value => ({ value, label: value === ALL ? t('campaignMessages.filter.all') : t(`materials.type.${value}`) })))
const tiles = computed(() => {
  const f = figures.value
  if (!f) return []
  const given = f.quantity + f.carried
  return [
    { value: n(given), label: f.carried ? t('materials.tiles.givenCarried', { count: n(f.carried) }) : t('materials.tiles.given') },
    { value: n(f.handed_out), label: t('materials.tiles.handedOut', { percent: given ? Math.round((f.handed_out / given) * 100) : 0 }) },
    { value: n(f.left), label: t('materials.tiles.left') },
    { value: money(f.budget_given), label: t('materials.tiles.budgetGiven') },
    { value: money(f.budget_handed_out), label: t('materials.tiles.budgetHandedOut') },
  ]
})
const columns = computed(() => [
  { key: 'materiel', label: t('materials.columns.materiel') },
  { key: 'type', label: t('materials.columns.type') },
  { key: 'brand', label: t('materials.columns.brand') },
  { key: 'specialities', label: t('materials.columns.specialities'), secondary: true },
  { key: 'people', label: t('materials.columns.people'), align: 'end' as const },
  { key: 'quantity', label: t('materials.columns.given'), align: 'end' as const },
  { key: 'progress', label: t('materials.columns.progress') },
  { key: 'unit_cost', label: t('materials.columns.unitCost'), align: 'end' as const, secondary: true },
  { key: 'budget', label: t('materials.columns.budget'), align: 'end' as const, secondary: true },
])
const share = (row: MaterialDistribution) => {
  const all = row.counts.quantity + row.counts.carried
  return all ? (row.counts.handed_out / all) * 100 : 0
}
const adding = ref(false)
const openRow = (row: MaterialDistribution) => router.push({ name: 'tenant-campaign-material', params: { id: props.campaign.id, distributionId: row.id } })
function created(row: MaterialDistribution) {
  adding.value = false
  emit('changed')
  openRow(row)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div v-for="tile in tiles" :key="tile.label" class="flex flex-col gap-1 rounded-3xl bg-dl-paper p-4">
        <strong class="font-display text-[24px] leading-none">{{ tile.value }}</strong>
        <span class="text-xs text-dl-muted">{{ tile.label }}</span>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2.5">
      <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('materials.filter.search')" :placeholder="t('materials.filter.search')" icon="tabler-search" hide-label /></div>
      <DlSegmented v-model="type" :label="t('materials.columns.type')" :items="typeItems" />
      <DlButton v-if="canGive" variant="primary" icon="tabler-plus" class="ms-auto" @click="adding = true">{{ t('materials.distribute.button') }}</DlButton>
    </div>
    <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
      <DlDataList :label="t('campaigns.tabs.materials')" :columns="columns" :rows="rows" :row-key="row => row.id" :loading="loading"
        :empty-title="t('materials.list.emptyTitle')" :empty-text="t('materials.list.emptyText')" @open="openRow">
        <template #cell-materiel="{ row }">
          <strong class="font-semibold">{{ row.materiel.name }}</strong>
          <DlBadge size="sm" class="ms-1.5">{{ row.materiel.role ? roleLabel(row.materiel.role.name) : t('fieldSetup.allFieldRoles') }}</DlBadge>
        </template>
        <template #cell-type="{ row }"><DlBadge size="sm" :tone="row.type === 'visit' ? 'success' : 'info'">{{ t(`materials.type.${row.type}`) }}</DlBadge></template>
        <template #cell-brand="{ row }">{{ row.brand.name }}</template>
        <template #cell-specialities="{ row }"><span class="text-dl-muted">{{ row.specialities.map(s => s.name).join(', ') }}</span></template>
        <template #cell-people="{ row }"><span class="tabular-nums">{{ n(row.counts.people) }}</span></template>
        <template #cell-quantity="{ row }">
          <span class="tabular-nums">{{ n(row.counts.quantity) }}</span>
          <span v-if="row.counts.carried" class="ms-1 rounded-full bg-dl-cobalt/10 px-2 py-0.5 text-[11.5px] font-bold text-dl-cobalt">+{{ n(row.counts.carried) }}</span>
        </template>
        <template #cell-progress="{ row }">
          <span class="flex items-center gap-2">
            <span class="flex h-2 w-24 overflow-hidden rounded-full bg-dl-line-soft"><span class="h-full bg-dl-teal" :style="{ width: `${share(row)}%` }" /></span>
            <span class="whitespace-nowrap text-xs text-dl-muted">{{ n(row.counts.handed_out) }} / {{ n(row.counts.left) }}</span>
          </span>
        </template>
        <template #cell-unit_cost="{ row }"><span class="tabular-nums">{{ money(row.unit_cost) }}</span></template>
        <template #cell-budget="{ row }"><span class="tabular-nums">{{ money(row.budget.given) }}</span></template>
        <template #card="{ row }">
          <strong class="block font-semibold">{{ row.materiel.name }} · {{ row.brand.name }}</strong>
          <span class="text-xs text-dl-muted">{{ [t(`materials.type.${row.type}`), t('materials.list.cardCounts', { given: n(row.counts.quantity + row.counts.carried), out: n(row.counts.handed_out) })].join(' · ') }}</span>
        </template>
      </DlDataList>
      <p class="text-xs text-dl-muted">{{ t('materials.list.note') }}</p>
    </div>
    <MaterialDistributeSheet v-if="adding" v-model:open="adding" :campaign="campaign" @created="created" />
  </div>
</template>
