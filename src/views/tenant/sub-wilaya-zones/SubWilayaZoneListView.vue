<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { type Commune, type SubWilayaZone, type Wilaya, createSubWilayaZone, deleteSubWilayaZone, fetchCommunes, fetchSubWilayaZones, fetchWilayas, updateSubWilayaZone } from '@/api/tenant/geography'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAuthStore } from '@/stores/auth'
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

const list = useStudioList<SubWilayaZone, { wilaya: number | null }>(
  ({ page, perPage, search, sort, filters }) => fetchSubWilayaZones({
    page,
    per_page: perPage,
    include: 'parent,communes',
    sort,
    'filter[name]': search || undefined,
    'filter[wilaya_id]': filters.wilaya ?? undefined,
  }),
  { wilaya: queryId(route.query.wilaya) },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const wilayas = ref<Wilaya[]>([])
onMountedAndFocus(async () => {
  const response = await fetchWilayas({ per_page: 200, sort: 'name', include: 'region' })
  wilayas.value = response.items
})
const wilayaOptions = computed(() => wilayas.value.map(w => ({ value: w.id, label: w.name })))
const wilayaFilter = computed({
  get: () => filters.wilaya ?? ALL,
  set: value => { filters.wilaya = value === ALL || value == null ? null : Number(value) },
})

interface ZoneForm { name: string; wilaya_id: number | null; commune_ids: number[] }

const panel = useRecordPanel<SubWilayaZone, ZoneForm>({
  toForm: zone => ({
    name: zone?.name ?? '',
    wilaya_id: zone?.wilaya_id ?? filters.wilaya ?? null,
    commune_ids: zone?.communes?.map(c => c.id) ?? [],
  }),
  create: form => createSubWilayaZone({ name: form.name, wilaya_id: form.wilaya_id!, commune_ids: form.commune_ids }),
  update: (zone, form) => updateSubWilayaZone(zone.id, { name: form.name, wilaya_id: form.wilaya_id!, commune_ids: form.commune_ids }),
  remove: zone => deleteSubWilayaZone(zone.id),
  recordName: zone => zone.name,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel

// The communes to pick from: those of the chosen wilaya.
const communes = ref<Commune[]>([])
const communesLoading = ref(false)
const communeSearch = ref('')
watch(() => [open.value, form.value.wilaya_id] as const, async ([isOpen, wilayaId], previous) => {
  communeSearch.value = ''
  if (!isOpen || !wilayaId) {
    communes.value = []
    return
  }
  // Changing the wilaya of a zone clears communes from the old one.
  if (previous && previous[1] && previous[1] !== wilayaId) form.value.commune_ids = []
  communesLoading.value = true
  try {
    const response = await fetchCommunes({ 'filter[wilaya_id]': wilayaId, per_page: 200, sort: 'name', include: 'subWilayaZone' })
    communes.value = response.items
  }
  finally {
    communesLoading.value = false
  }
})

const visibleCommunes = computed(() => {
  const term = communeSearch.value.trim().toLowerCase()
  return term ? communes.value.filter(c => c.name.toLowerCase().includes(term)) : communes.value
})

/** A commune already in another zone of the wilaya would be moved to this one. */
const otherZone = (commune: Commune) =>
  commune.sub_wilaya_zone && commune.sub_wilaya_zone.id !== record.value?.id ? commune.sub_wilaya_zone.name : null

function toggle(id: number) {
  const ids = form.value.commune_ids
  form.value.commune_ids = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
}

const canEdit = computed(() => (record.value ? auth.can('sub-wilaya-zones.update') : auth.can('sub-wilaya-zones.create')))

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('geo.columns.zone'), sortKey: 'name' },
  { key: 'wilaya', label: t('geo.columns.wilaya'), sortKey: 'wilaya_id' },
  { key: 'communes_count', label: t('geo.columns.communes'), align: 'end' as const },
  { key: 'communes', label: t('geo.columns.communeNames'), secondary: true },
  added.column,
]
const communeNames = (zone: SubWilayaZone) => (zone.communes ?? []).map(c => c.name).join(', ')
</script>

<template>
  <StudioListPage
    :section="geographySection"
    :title="t('geo.title.zones')"
    :add-label="auth.can('sub-wilaya-zones.create') ? t('geo.add.zones') : undefined"
    @add="panel.show(null)"
  >
    <div class="flex flex-wrap gap-2.5">
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('geo.search.zones')"
        :placeholder="t('geo.search.zones')"
        hide-label
        class="w-full sm:max-w-xs"
      />
      <DlSelect
        v-model="wilayaFilter"
        :label="t('geo.columns.wilaya')"
        :options="[{ value: ALL, label: t('geo.filter.allWilayas') }, ...wilayaOptions]"
        appearance="filter"
      />
    </div>

    <DlDataList
      :label="t('geo.title.zones')"
      :columns="columns"
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search || filters.wilaya ? t('geo.empty.search') : t('geo.empty.zones')"
      @open="panel.show"
    >
      <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
      <template #cell-wilaya="{ row }">{{ row.parent?.name ?? '—' }}</template>
      <template #cell-communes_count="{ row }">{{ n(row.communes_count ?? row.communes?.length ?? 0) }}</template>
      <template #cell-communes="{ row }"><span class="line-clamp-1 max-w-[360px] text-dl-muted">{{ communeNames(row) || '—' }}</span></template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.name }}</strong>
        <span class="text-xs text-dl-muted">{{ row.parent?.name }} · {{ t('geo.meta.communes', row.communes_count ?? 0) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel
        v-model:open="open"
        :title="record?.name ?? t('geo.add.zones')"
        :description="record ? t('geo.record.zone', { wilaya: record.parent?.name ?? '—' }) : undefined"
      >
        <form id="zone-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" :disabled="!canEdit" required />
          <div class="flex flex-col gap-1">
            <DlSelect v-model="form.wilaya_id" :label="t('geo.fields.wilaya')" :options="wilayaOptions" :disabled="!canEdit" />
            <p v-if="errors.wilaya_id" class="text-xs text-dl-rejected">{{ errors.wilaya_id }}</p>
          </div>

          <fieldset v-if="form.wilaya_id" class="flex flex-col gap-2.5">
            <legend class="mb-1 flex w-full items-baseline justify-between text-[13px] font-semibold">
              {{ t('geo.fields.communes') }}
              <span class="font-normal text-dl-muted">{{ t('geo.selected', { count: form.commune_ids.length }) }}</span>
            </legend>
            <DlInput
              v-model="communeSearch"
              type="search"
              icon="tabler-search"
              :label="t('geo.search.communes')"
              :placeholder="t('geo.search.communes')"
              hide-label
            />
            <p v-if="communesLoading" class="text-sm text-dl-muted">{{ t('geo.loading') }}</p>
            <ul v-else class="flex max-h-72 flex-col overflow-y-auto rounded-2xl border border-dl-line">
              <li v-for="commune in visibleCommunes" :key="commune.id" class="border-b border-dl-line-soft last:border-b-0">
                <label class="flex min-h-11 cursor-pointer items-center gap-3 px-3.5 py-2 text-sm hover:bg-dl-mist">
                  <input
                    type="checkbox"
                    class="h-[18px] w-[18px] accent-dl-ink"
                    :checked="form.commune_ids.includes(commune.id)"
                    :disabled="!canEdit"
                    @change="toggle(commune.id)"
                  >
                  <span class="flex-1">{{ commune.name }}</span>
                  <span v-if="otherZone(commune)" class="text-xs text-dl-pending">{{ t('geo.inOtherZone', { zone: otherZone(commune) }) }}</span>
                </label>
              </li>
              <li v-if="!visibleCommunes.length" class="px-3.5 py-3 text-sm text-dl-muted">{{ t('geo.empty.search') }}</li>
            </ul>
            <p v-if="errors.commune_ids" class="text-xs text-dl-rejected">{{ errors.commune_ids }}</p>
          </fieldset>
          <p v-else class="rounded-2xl bg-dl-mist px-4 py-3 text-[13px] text-dl-body">{{ t('geo.pickWilayaFirst') }}</p>
        </form>
        <template v-if="canEdit || (record && auth.can('sub-wilaya-zones.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="zone-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('geo.add.zones') }}
          </DlButton>
          <DlButton v-if="record && auth.can('sub-wilaya-zones.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
