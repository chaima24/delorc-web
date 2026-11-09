<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { type Commune, type Region, type SubWilayaZone, type Wilaya, createWilaya, deleteWilaya, fetchCommunes, fetchRegions, fetchSubWilayaZones, fetchWilayas, updateWilaya } from '@/api/tenant/geography'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { useLabStore } from '@/stores/lab'
import RecordChildren from '@/views/tenant/settings/shared/RecordChildren.vue'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { geographySection } from '@/views/tenant/settings/shared/studioSections'
import { STUDIO_DEFAULT_SORT, useStudioList, useRecordPanel, useStudioCounts, useAddedColumn } from '@/views/tenant/settings/shared/useStudioList'

const { t, n } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const { refresh: refreshCounts } = useStudioCounts()

const ALL = 'all'
const queryId = (value: unknown) => (value ? Number(value) : null)

const list = useStudioList<Wilaya, { region: number | null }>(
  ({ page, perPage, search, sort, filters }) => fetchWilayas({
    page,
    per_page: perPage,
    include: 'region',
    sort,
    'filter[name]': search || undefined,
    'filter[region_id]': filters.region ?? undefined,
  }),
  { region: queryId(route.query.region) },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const regions = ref<Region[]>([])
onMounted(async () => {
  const response = await fetchRegions({ per_page: 100, sort: 'name' })
  regions.value = response.items
})
const regionOptions = computed(() => regions.value.map(r => ({ value: r.id, label: r.name })))
const regionFilter = computed({
  get: () => filters.region ?? ALL,
  set: value => { filters.region = value === ALL || value == null ? null : Number(value) },
})

interface WilayaForm { name: string; arabic_name: string; region_id: number | null; latitude: string; longitude: string }
// Number inputs hand back numbers once typed in, strings when untouched.
const toNumber = (value: string | number | null) => (value == null || String(value).trim() === '' ? null : Number(value))

const labStore = useLabStore()
/** "Nom en arabe" is required only when the lab's default language is Arabic. */
const arabicRequired = computed(() => labStore.lab?.default_language === 'ar')

const panel = useRecordPanel<Wilaya, WilayaForm>({
  toForm: wilaya => ({
    name: wilaya?.name ?? '',
    arabic_name: wilaya?.arabic_name ?? '',
    region_id: wilaya?.region_id ?? filters.region ?? null,
    latitude: wilaya?.latitude != null ? String(wilaya.latitude) : '',
    longitude: wilaya?.longitude != null ? String(wilaya.longitude) : '',
  }),
  create: form => createWilaya({ name: form.name, arabic_name: form.arabic_name || null, region_id: form.region_id!, latitude: toNumber(form.latitude), longitude: toNumber(form.longitude) }),
  update: (wilaya, form) => updateWilaya(wilaya.id, { name: form.name, arabic_name: form.arabic_name || null, region_id: form.region_id!, latitude: toNumber(form.latitude), longitude: toNumber(form.longitude) }),
  remove: wilaya => deleteWilaya(wilaya.id),
  recordName: wilaya => wilaya.name,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel

const communes = ref<Commune[]>([])
const zones = ref<SubWilayaZone[]>([])
const childrenLoading = ref(false)
watch(record, async wilaya => {
  communes.value = []
  zones.value = []
  if (!wilaya) return
  childrenLoading.value = true
  try {
    const [communeRes, zoneRes] = await Promise.all([
      fetchCommunes({ 'filter[wilaya_id]': wilaya.id, per_page: 200, sort: 'name', include: 'subWilayaZone' }),
      fetchSubWilayaZones({ 'filter[wilaya_id]': wilaya.id, per_page: 100, sort: 'name', include: 'parent' }),
    ])
    communes.value = communeRes.items
    zones.value = zoneRes.items
  }
  finally {
    childrenLoading.value = false
  }
})

const canEdit = computed(() => (record.value ? auth.can('wilayas.update') : auth.can('wilayas.create')))

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('geo.columns.wilaya'), sortKey: 'name' },
  { key: 'region', label: t('geo.columns.region') },
  { key: 'communes_count', label: t('geo.columns.communes'), align: 'end' as const },
  { key: 'sub_zones_count', label: t('geo.columns.zones'), align: 'end' as const, secondary: true },
  { key: 'map', label: t('geo.columns.map'), secondary: true },
  added.column,
]
const count = (value?: number) => (value == null ? '—' : n(value))
const hasPosition = (wilaya: Wilaya) => wilaya.latitude != null && wilaya.longitude != null
</script>

<template>
  <StudioListPage
    :section="geographySection"
    :title="t('geo.title.wilayas')"
    :add-label="auth.can('wilayas.create') ? t('geo.add.wilayas') : undefined"
    @add="panel.show(null)"
  >
    <div class="flex flex-wrap gap-2.5">
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('geo.search.wilayas')"
        :placeholder="t('geo.search.wilayas')"
        hide-label
        class="w-full sm:max-w-xs"
      />
      <DlSelect
        v-model="regionFilter"
        :label="t('geo.columns.region')"
        :options="[{ value: ALL, label: t('geo.filter.allRegions') }, ...regionOptions]"
        appearance="filter"
      />
    </div>

    <DlDataList
      :label="t('geo.title.wilayas')"
      :columns="columns"
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search || filters.region ? t('geo.empty.search') : t('geo.empty.wilayas')"
      @open="panel.show"
    >
      <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
      <template #cell-region="{ row }">{{ row.region?.name ?? '—' }}</template>
      <template #cell-communes_count="{ row }">{{ count(row.communes_count) }}</template>
      <template #cell-sub_zones_count="{ row }">{{ count(row.sub_zones_count) }}</template>
      <template #cell-map="{ row }">
        <span v-if="hasPosition(row)" class="inline-flex items-center gap-1.5 text-[13px] text-dl-fg">
          <span aria-hidden="true" class="h-2 w-2 rounded-full bg-current" />{{ t('geo.map.placed') }}
        </span>
        <span v-else class="text-[13px] text-dl-muted">{{ t('geo.map.missing') }}</span>
      </template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.name }}</strong>
        <span class="text-xs text-dl-muted">{{ row.region?.name }} · {{ t('geo.meta.communes', row.communes_count ?? 0) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel
        v-model:open="open"
        :title="record?.name ?? t('geo.add.wilayas')"
        :description="record ? t('geo.record.wilaya', { region: record.region?.name ?? '—' }) : undefined"
      >
        <form id="wilaya-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" :disabled="!canEdit" required />
          <DlInput v-model="form.arabic_name" :label="t('geo.fields.arabicName')" dir="rtl" :error="errors.arabic_name" :disabled="!canEdit" :required="arabicRequired" />
          <div class="flex flex-col gap-1">
            <DlSelect v-model="form.region_id" :label="t('geo.fields.region')" :options="regionOptions" :disabled="!canEdit" />
            <p v-if="errors.region_id" class="text-xs text-dl-rejected">{{ errors.region_id }}</p>
          </div>
          <fieldset class="flex flex-col gap-2">
            <legend class="mb-1.5 text-[13px] font-semibold">{{ t('geo.fields.position') }}</legend>
            <div class="grid grid-cols-2 gap-3">
              <DlInput v-model="form.latitude" type="number" step="any" :label="t('geo.fields.latitude')" placeholder="36.47" :error="errors.latitude" :disabled="!canEdit" />
              <DlInput v-model="form.longitude" type="number" step="any" :label="t('geo.fields.longitude')" placeholder="2.83" :error="errors.longitude" :disabled="!canEdit" />
            </div>
            <p class="text-xs text-dl-muted">{{ t('geo.fields.positionHint') }}</p>
          </fieldset>
          <template v-if="record">
            <RecordChildren
              :title="t('geo.contains.wilayaZones', { name: record.name })"
              icon="tabler-hexagons"
              :loading="childrenLoading"
              :empty-text="t('geo.empty.zones')"
              :open-label="t('geo.open.zones')"
              :open-to="{ name: 'tenant-sub-wilaya-zones', query: { wilaya: record.id } }"
              :items="zones.map(zone => ({
                id: zone.id,
                name: zone.name,
                meta: t('geo.meta.communes', zone.communes_count ?? 0),
                to: { name: 'tenant-communes', query: { wilaya: record!.id, zone: zone.id } },
              }))"
            />
            <RecordChildren
              :title="t('geo.contains.wilaya', { name: record.name })"
              icon="tabler-building-community"
              :loading="childrenLoading"
              :empty-text="t('geo.empty.communes')"
              :open-label="t('geo.open.communes')"
              :open-to="{ name: 'tenant-communes', query: { wilaya: record.id } }"
              :items="communes.map(commune => ({
                id: commune.id,
                name: commune.name,
                meta: commune.sub_wilaya_zone?.name,
                to: { name: 'tenant-communes', query: { wilaya: record!.id, open: commune.id } },
              }))"
            />
          </template>
        </form>
        <template v-if="canEdit || (record && auth.can('wilayas.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="wilaya-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('geo.add.wilayas') }}
          </DlButton>
          <DlButton v-if="record && auth.can('wilayas.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
