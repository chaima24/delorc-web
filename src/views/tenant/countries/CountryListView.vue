<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type Country, type Region, fetchCountries, fetchRegions } from '@/api/tenant/geography'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import RecordChildren from '@/views/tenant/settings/shared/RecordChildren.vue'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { geographySection } from '@/views/tenant/settings/shared/studioSections'
import { STUDIO_DEFAULT_SORT, useStudioList, useAddedColumn } from '@/views/tenant/settings/shared/useStudioList'

// Countries are assigned to the lab by the central console: this page only reads them.
const { t, n } = useI18n()

// A lab has one country: the list comes at once and is searched here.
const list = useStudioList<Country, Record<string, never>>({
  load: fetchCountries,
  matches: (country, search) => !search || `${country.name} ${country.code}`.toLocaleLowerCase().includes(search),
  sortValues: { id: country => country.id, name: country => country.name, code: country => country.code },
}, {})
const { page, perPage, search, sort, items, total, loading } = list
list.reload()

const open = ref(false)
const selected = ref<Country | null>(null)
const regions = ref<Region[]>([])
const regionsLoading = ref(false)

function show(country: Country) {
  selected.value = country
  open.value = true
}

watch(selected, async country => {
  regions.value = []
  if (!country) return
  regionsLoading.value = true
  try {
    // Every region of the lab is in its country.
    const response = await fetchRegions({ per_page: 100, sort: 'name' })
    regions.value = response.items
  }
  finally {
    regionsLoading.value = false
  }
})
watch(open, value => { if (!value) selected.value = null })

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('geo.columns.country'), sortKey: 'name' },
  { key: 'code', label: t('geo.columns.code'), sortKey: 'code' },
  { key: 'regions_count', label: t('geo.columns.regions'), align: 'end' as const },
  { key: 'wilayas_count', label: t('geo.columns.wilayas'), align: 'end' as const, secondary: true },
  { key: 'communes_count', label: t('geo.columns.communes'), align: 'end' as const, secondary: true },
  added.column,
]

const count = (value?: number) => (value == null ? '—' : n(value))
</script>

<template>
  <StudioListPage
    :section="geographySection"
    :title="t('geo.title.countries')"
  >
    <DlInput
      v-model="search"
      type="search"
      icon="tabler-search"
      :label="t('geo.search.countries')"
      :placeholder="t('geo.search.countries')"
      hide-label
      class="w-full sm:max-w-xs"
    />

    <DlDataList
      :label="t('geo.title.countries')"
      :columns="columns"
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="selected?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search ? t('geo.empty.search') : t('geo.empty.countries')"
      @open="show"
    >
      <template #cell-name="{ row }">
        <span class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-dl-line-soft text-[11px] font-bold">{{ row.code }}</span>
          <strong class="font-semibold">{{ row.name }}</strong>
        </span>
      </template>
      <template #cell-code="{ row }">
        <span class="rounded-full bg-dl-line-soft px-2.5 py-0.5 text-xs font-semibold">{{ row.code }}</span>
      </template>
      <template #cell-regions_count="{ row }">{{ count(row.regions_count) }}</template>
      <template #cell-wilayas_count="{ row }">{{ count(row.wilayas_count) }}</template>
      <template #cell-communes_count="{ row }">{{ count(row.communes_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.name }}</strong>
        <span class="text-xs text-dl-muted">{{ t('geo.meta.country', { regions: count(row.regions_count), wilayas: count(row.wilayas_count) }) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel
        v-model:open="open"
        :title="selected?.name ?? ''"
        :description="t('geo.record.country')"
      >
        <div v-if="selected" class="flex flex-col gap-5">
          <p class="rounded-2xl bg-dl-line-soft px-4 py-3 text-[13px] text-dl-body">{{ t('geo.readOnlyCountries') }}</p>
          <DlInput :model-value="selected.name" :label="t('geo.fields.name')" disabled />
          <DlInput :model-value="selected.code" :label="t('geo.fields.code')" disabled class="max-w-40" />
          <RecordChildren
            :title="t('geo.contains.country', { name: selected.name })"
            icon="tabler-map"
            :loading="regionsLoading"
            :empty-text="t('geo.empty.regions')"
            :open-label="t('geo.open.regions')"
            :open-to="{ name: 'tenant-regions', query: { country: selected.id } }"
            :items="regions.map(region => ({
              id: region.id,
              name: region.name,
              meta: t('geo.meta.wilayas', region.wilayas_count ?? 0),
              to: { name: 'tenant-wilayas', query: { region: region.id } },
            }))"
          />
        </div>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
