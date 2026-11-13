<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { type Commune, type SubWilayaZone, type Wilaya, createCommune, deleteCommune, fetchCommunes, fetchSubWilayaZones, fetchWilayas, updateCommune } from '@/api/tenant/geography'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { useLabStore } from '@/stores/lab'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { geographySection } from '@/views/tenant/settings/shared/studioSections'
import { STUDIO_DEFAULT_SORT, useStudioList, useRecordPanel, useStudioCounts, useAddedColumn } from '@/views/tenant/settings/shared/useStudioList'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'

const { t, n } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const { refresh: refreshCounts } = useStudioCounts()

const ALL = 'all'
const queryId = (value: unknown) => (value ? Number(value) : null)

const list = useStudioList<Commune, { wilaya: number | null; zone: number | null }>(
  ({ page, perPage, search, sort, filters }) => fetchCommunes({
    page,
    per_page: perPage,
    include: 'wilaya,subWilayaZone',
    sort,
    'filter[name]': search || undefined,
    'filter[wilaya_id]': filters.wilaya ?? undefined,
    'filter[sub_wilaya_zone_id]': filters.zone ?? undefined,
  }),
  { wilaya: queryId(route.query.wilaya), zone: queryId(route.query.zone) },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const wilayas = ref<Wilaya[]>([])
onMountedAndFocus(async () => {
  const response = await fetchWilayas({ per_page: 200, sort: 'name', include: 'region' })
  wilayas.value = response.items
})
const wilayaOptions = computed(() => wilayas.value.map(w => ({ value: w.id, label: w.name })))

// Zone filter: always available. With a wilaya chosen, only that wilaya's zones are offered.
const zones = ref<SubWilayaZone[]>([])
onMountedAndFocus(async () => {
  const response = await fetchSubWilayaZones({ per_page: 200, sort: 'name', include: 'parent' })
  zones.value = response.items
})
const zoneOptions = computed(() => zones.value
  .filter(zone => !filters.wilaya || zone.wilaya_id === filters.wilaya)
  // Without a wilaya, the wilaya name tells zones with the same name apart.
  .map(zone => ({ value: zone.id, label: filters.wilaya ? zone.name : `${zone.name} · ${zone.parent?.name ?? ''}` })))

const wilayaFilter = computed({
  get: () => filters.wilaya ?? ALL,
  set: value => {
    filters.wilaya = value === ALL || value == null ? null : Number(value)
    // Keep the chosen zone only if it belongs to the new wilaya.
    const zone = zones.value.find(z => z.id === filters.zone)
    if (zone && filters.wilaya && zone.wilaya_id !== filters.wilaya) filters.zone = null
  },
})
const zoneFilter = computed({
  get: () => filters.zone ?? ALL,
  set: value => { filters.zone = value === ALL || value == null ? null : Number(value) },
})

const labStore = useLabStore()
/** "Nom en arabe" is required only when the lab's default language is Arabic. */
const arabicRequired = computed(() => labStore.lab?.default_language === 'ar')

const panel = useRecordPanel<Commune, { name: string; arabic_name: string; wilaya_id: number | null }>({
  toForm: commune => ({ name: commune?.name ?? '', arabic_name: commune?.arabic_name ?? '', wilaya_id: commune?.wilaya_id ?? filters.wilaya ?? null }),
  create: form => createCommune({ name: form.name, arabic_name: form.arabic_name || null, wilaya_id: form.wilaya_id! }),
  update: (commune, form) => updateCommune(commune.id, { name: form.name, arabic_name: form.arabic_name || null, wilaya_id: form.wilaya_id! }),
  remove: commune => deleteCommune(commune.id),
  recordName: commune => commune.name,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel

// Arriving from a wilaya's panel with ?open=<id>: open that commune once the list is there.
const openId = queryId(route.query.open)
if (openId) {
  const stop = watch(items, rows => {
    const match = rows.find(row => row.id === openId)
    if (match) {
      panel.show(match)
      stop()
    }
  })
}

const canEdit = computed(() => (record.value ? auth.can('communes.update') : auth.can('communes.create')))

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('geo.columns.commune'), sortKey: 'name' },
  { key: 'wilaya', label: t('geo.columns.wilaya') },
  { key: 'zone', label: t('geo.columns.zone'), secondary: true },
  { key: 'hcps_count', label: t('geo.columns.customers'), align: 'end' as const },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="geographySection"
    :title="t('geo.title.communes')"
    :add-label="auth.can('communes.create') ? t('geo.add.communes') : undefined"
    @add="panel.show(null)"
  >
    <div class="flex flex-wrap gap-2.5">
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('geo.search.communes')"
        :placeholder="t('geo.search.communes')"
        hide-label
        class="w-full sm:max-w-xs"
      />
      <DlSelect
        v-model="wilayaFilter"
        :label="t('geo.columns.wilaya')"
        :options="[{ value: ALL, label: t('geo.filter.allWilayas') }, ...wilayaOptions]"
        appearance="filter"
      />
      <DlSelect
        v-model="zoneFilter"
        :label="t('geo.columns.zone')"
        :options="[{ value: ALL, label: t('geo.filter.allZones') }, ...zoneOptions]"
        appearance="filter"
      />
    </div>

    <DlDataList
      :label="t('geo.title.communes')"
      :columns="columns"
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search || filters.wilaya || filters.zone ? t('geo.empty.search') : t('geo.empty.communes')"
      @open="panel.show"
    >
      <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
      <template #cell-wilaya="{ row }">{{ row.wilaya?.name ?? '—' }}</template>
      <template #cell-zone="{ row }"><span :class="!row.sub_wilaya_zone && 'text-dl-muted'">{{ row.sub_wilaya_zone?.name ?? '—' }}</span></template>
      <template #cell-hcps_count="{ row }">{{ row.hcps_count == null ? '—' : n(row.hcps_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.name }}</strong>
        <span class="text-xs text-dl-muted">{{ row.wilaya?.name }}<template v-if="row.sub_wilaya_zone"> · {{ row.sub_wilaya_zone.name }}</template></span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel
        v-model:open="open"
        :title="record?.name ?? t('geo.add.communes')"
        :description="record ? t('geo.record.commune', { wilaya: record.wilaya?.name ?? '—' }) : undefined"
      >
        <form id="commune-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" :disabled="!canEdit" required />
          <DlInput v-model="form.arabic_name" :label="t('geo.fields.arabicName')" dir="rtl" :error="errors.arabic_name" :disabled="!canEdit" :required="arabicRequired" />
          <div class="flex flex-col gap-1">
            <DlSelect v-model="form.wilaya_id" :label="t('geo.fields.wilaya')" :options="wilayaOptions" :disabled="!canEdit" />
            <p v-if="errors.wilaya_id" class="text-xs text-dl-rejected">{{ errors.wilaya_id }}</p>
          </div>
          <dl v-if="record" class="grid grid-cols-2 gap-3">
            <div class="rounded-2xl bg-dl-mist px-4 py-3">
              <dt class="text-xs text-dl-muted">{{ t('geo.columns.zone') }}</dt>
              <dd class="text-sm font-semibold">{{ record.sub_wilaya_zone?.name ?? t('geo.noZone') }}</dd>
            </div>
            <div class="rounded-2xl bg-dl-mist px-4 py-3">
              <dt class="text-xs text-dl-muted">{{ t('geo.columns.customers') }}</dt>
              <dd class="text-sm font-semibold tabular-nums">{{ n(record.hcps_count ?? 0) }}</dd>
            </div>
          </dl>
          <p v-if="record" class="text-xs text-dl-muted">{{ t('geo.zoneHint') }}</p>
        </form>
        <template v-if="canEdit || (record && auth.can('communes.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="commune-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('geo.add.communes') }}
          </DlButton>
          <DlButton v-if="record && auth.can('communes.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
