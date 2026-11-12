<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { HCP_TYPES, fetchHcps, type Hcp, type HcpType } from '@/api/tenant/hcps'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useHcpText } from '@/views/tenant/hcps/hcpForm'
import { useStudioList } from '@/views/tenant/settings/shared/useStudioList'

// The professionals a territory covers (rules: docs/api/territories.md), with "Open in Professionals".
const props = defineProps<{ territoryId: number }>()
const { t } = useI18n()
const router = useRouter()
const text = useHcpText()

const ALL = 'all'
const list = useStudioList<Hcp, { type: string }>(
  ({ page, perPage, search, sort, filters }) => fetchHcps({
    page,
    per_page: perPage,
    sort: sort || 'name',
    'filter[in_territory]': props.territoryId,
    'filter[q]': search || undefined,
    'filter[type]': filters.type === ALL ? undefined : filters.type as HcpType,
  }),
  { type: ALL },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const typeOptions = computed(() => [{ value: ALL, label: t('hcps.filter.allTypes') }, ...HCP_TYPES.map(type => ({ value: type, label: t(`hcps.typesPlural.${type}`) }))])
const columns = [
  { key: 'name', label: t('hcps.columns.professional'), sortKey: 'name' },
  { key: 'speciality', label: t('hcps.workplaces.speciality') },
  { key: 'commune', label: t('hcps.fields.commune') },
]
</script>

<template>
  <div class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
    <div class="flex flex-wrap items-center gap-2.5">
      <DlInput v-model="search" type="search" icon="tabler-search" :label="t('hcps.search')" :placeholder="t('hcps.search')" hide-label class="w-full sm:max-w-xs" />
      <DlSelect v-model="filters.type" :label="t('hcps.fields.type')" :options="typeOptions" appearance="filter" />
      <DlButton :to="{ name: 'tenant-hcps', query: { territory: territoryId } }" variant="ghost" size="sm" class="ms-auto">{{ t('territories.page.openInHcps') }} ›</DlButton>
    </div>
    <DlDataList
      v-model:sort="sort"
      default-sort="name"
      :label="t('hcps.title')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :loading="loading"
      :empty-title="t('territories.page.noHcps')"
      @open="row => router.push({ name: 'tenant-hcp-detail', params: { id: row.id } })"
    >
      <template #cell-name="{ row }">
        <span class="flex min-w-0 flex-col">
          <strong class="font-semibold">{{ row.name }}</strong>
          <span class="text-xs text-dl-muted">{{ text.type(row.type) }}</span>
        </span>
      </template>
      <template #cell-speciality="{ row }">{{ text.mainWorkplace(row).speciality ?? '—' }}</template>
      <template #cell-commune="{ row }">{{ text.place(row) }}</template>
      <template #card="{ row }">
        <span class="flex min-w-0 flex-col">
          <strong class="truncate font-semibold">{{ row.name }}</strong>
          <span class="truncate text-xs text-dl-muted">{{ text.type(row.type) }} · {{ text.mainWorkplace(row).speciality ?? '—' }} · {{ row.commune?.name }}</span>
        </span>
      </template>
    </DlDataList>
    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
  </div>
</template>
