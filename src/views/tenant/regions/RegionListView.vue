<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type Country, type Region, type Wilaya, createRegion, deleteRegion, fetchCountries, fetchRegions, fetchWilayas, updateRegion } from '@/api/tenant/geography'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { useLabStore } from '@/stores/lab'
import RecordChildren from '@/views/tenant/settings/shared/RecordChildren.vue'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { geographySection } from '@/views/tenant/settings/shared/studioSections'
import { STUDIO_DEFAULT_SORT, useStudioList, useRecordPanel, useStudioCounts, useAddedColumn } from '@/views/tenant/settings/shared/useStudioList'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'

const { t, n } = useI18n()
const auth = useAuthStore()
const { refresh: refreshCounts } = useStudioCounts()


const list = useStudioList<Region, Record<string, never>>(
  ({ page, perPage, search, sort }) => fetchRegions({
    page,
    per_page: perPage,
    sort,
    'filter[name]': search || undefined,
  }),
  {},
)
const { page, perPage, search, sort, items, total, loading } = list
list.reload()

// A lab has one country: every region is in it, so there is no country to choose or filter on.
const countries = ref<Country[]>([])
onMountedAndFocus(async () => {
  countries.value = await fetchCountries()
})
const countryName = computed(() => countries.value[0]?.name ?? '—')
const labStore = useLabStore()
/** "Nom en arabe" is required only when the lab's default language is Arabic. */
const arabicRequired = computed(() => labStore.lab?.default_language === 'ar')

const panel = useRecordPanel<Region, { name: string; arabic_name: string }>({
  toForm: region => ({ name: region?.name ?? '', arabic_name: region?.arabic_name ?? '' }),
  create: form => createRegion({ name: form.name, arabic_name: form.arabic_name || null }),
  update: (region, form) => updateRegion(region.id, { name: form.name, arabic_name: form.arabic_name || null }),
  remove: region => deleteRegion(region.id),
  recordName: region => region.name,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel

const wilayas = ref<Wilaya[]>([])
const wilayasLoading = ref(false)
watch(record, async region => {
  wilayas.value = []
  if (!region) return
  wilayasLoading.value = true
  try {
    const response = await fetchWilayas({ 'filter[region_id]': region.id, per_page: 100, sort: 'name', include: 'region' })
    wilayas.value = response.items
  }
  finally {
    wilayasLoading.value = false
  }
})

const canEdit = computed(() => (record.value ? auth.can('regions.update') : auth.can('regions.create')))

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('geo.columns.region'), sortKey: 'name' },
  { key: 'country', label: t('geo.columns.country') },
  { key: 'wilayas_count', label: t('geo.columns.wilayas'), align: 'end' as const },
  { key: 'communes_count', label: t('geo.columns.communes'), align: 'end' as const, secondary: true },
  added.column,
]
const count = (value?: number) => (value == null ? '—' : n(value))
</script>

<template>
  <StudioListPage
    :section="geographySection"
    :title="t('geo.title.regions')"
    :add-label="auth.can('regions.create') ? t('geo.add.regions') : undefined"
    @add="panel.show(null)"
  >
    <div class="flex flex-wrap gap-2.5">
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('geo.search.regions')"
        :placeholder="t('geo.search.regions')"
        hide-label
        class="w-full sm:max-w-xs"
      />
    </div>

    <DlDataList
      :label="t('geo.title.regions')"
      :columns="columns"
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search ? t('geo.empty.search') : t('geo.empty.regions')"
      @open="panel.show"
    >
      <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
      <template #cell-country>{{ countryName }}</template>
      <template #cell-wilayas_count="{ row }">{{ count(row.wilayas_count) }}</template>
      <template #cell-communes_count="{ row }">{{ count(row.communes_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.name }}</strong>
        <span class="text-xs text-dl-muted">{{ countryName }} · {{ t('geo.meta.wilayas', row.wilayas_count ?? 0) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel
        v-model:open="open"
        :title="record?.name ?? t('geo.add.regions')"
        :description="record ? t('geo.record.region') : undefined"
      >
        <form id="region-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" :disabled="!canEdit" required />
          <DlInput v-model="form.arabic_name" :label="t('geo.fields.arabicName')" dir="rtl" :error="errors.arabic_name" :disabled="!canEdit" :required="arabicRequired" />
          <RecordChildren
            v-if="record"
            :title="t('geo.contains.region', { name: record.name })"
            icon="tabler-map-pin"
            :loading="wilayasLoading"
            :empty-text="t('geo.empty.wilayas')"
            :open-label="t('geo.open.wilayas')"
            :open-to="{ name: 'tenant-wilayas', query: { region: record.id } }"
            :items="wilayas.map(wilaya => ({
              id: wilaya.id,
              name: wilaya.name,
              meta: t('geo.meta.communes', wilaya.communes_count ?? 0),
              to: { name: 'tenant-communes', query: { wilaya: wilaya.id } },
            }))"
          />
        </form>
        <template v-if="canEdit || (record && auth.can('regions.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="region-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('geo.add.regions') }}
          </DlButton>
          <DlButton v-if="record && auth.can('regions.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
