<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createSpeciality,
  deleteSpeciality,
  fetchSpecialities,
  updateSpeciality,
  type Speciality,
} from '@/api/tenant/customerSetup'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { useAuthStore } from '@/stores/auth'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { customersSection } from '@/views/tenant/settings/shared/studioSections'
import {
  STUDIO_DEFAULT_SORT,
  useAddedColumn,
  useRecordPanel,
  useStudioCounts,
  useStudioList,
} from '@/views/tenant/settings/shared/useStudioList'

const { t, n } = useI18n()
const auth = useAuthStore()
const { refresh: refreshCounts } = useStudioCounts()

const ALL = 'all'
const TYPES = ['medecin', 'pharmacie', 'grossiste'] as const
const typeOptions = computed(() => TYPES.map(type => ({ value: type, label: t(`customersSetup.specialityType.${type}`) })))
const typeLabel = (type: string) => (TYPES.includes(type as typeof TYPES[number]) ? t(`customersSetup.specialityType.${type}`) : type)

const list = useStudioList<Speciality, { type: string | null }>(
  ({ page, perPage, search, sort, filters }) => fetchSpecialities({
    page,
    per_page: perPage,
    sort,
    'filter[name]': search || undefined,
    'filter[type]': filters.type ?? undefined,
  }),
  { type: null },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const typeFilter = computed({
  get: () => filters.type ?? ALL,
  set: value => { filters.type = value === ALL || value == null ? null : String(value) },
})

const panel = useRecordPanel<Speciality, { name: string; type: string; is_generalist: boolean }>({
  toForm: speciality => ({ name: speciality?.name ?? '', type: speciality?.type ?? filters.type ?? 'medecin', is_generalist: speciality?.is_generalist ?? false }),
  // Only a medical speciality can be general medicine.
  create: form => createSpeciality({ ...form, is_generalist: form.type === 'medecin' && form.is_generalist }),
  update: (speciality, form) => updateSpeciality(speciality.id, { ...form, is_generalist: form.type === 'medecin' && form.is_generalist }),
  remove: speciality => deleteSpeciality(speciality.id),
  recordName: speciality => speciality.name,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel
const canEdit = computed(() => (record.value ? auth.can('specialities.update') : auth.can('specialities.create')))

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('customersSetup.columns.speciality'), sortKey: 'name' },
  { key: 'type', label: t('customersSetup.columns.type') },
  { key: 'customers_count', label: t('customersSetup.columns.customers'), align: 'end' as const },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="customersSection"
    :title="t('customersSetup.title.specialities')"
    :add-label="auth.can('specialities.create') ? t('customersSetup.add.specialities') : undefined"
    @add="panel.show(null)"
  >
    <div class="flex flex-wrap gap-2.5">
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('customersSetup.search.specialities')"
        :placeholder="t('customersSetup.search.specialities')"
        hide-label
        class="w-full sm:max-w-xs"
      />
      <DlSelect
        v-model="typeFilter"
        :label="t('customersSetup.columns.type')"
        :options="[{ value: ALL, label: t('customersSetup.filter.allTypes') }, ...typeOptions]"
        appearance="filter"
      />
    </div>

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('customersSetup.title.specialities')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search || filters.type ? t('geo.empty.search') : t('customersSetup.empty.specialities')"
      @open="panel.show"
    >
      <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
      <template #cell-type="{ row }">
        <span class="rounded-full bg-dl-line-soft px-2.5 py-0.5 text-xs font-semibold">{{ typeLabel(row.type) }}</span>
        <span v-if="row.is_generalist" class="ms-1 rounded-full bg-dl-signal-soft px-2.5 py-0.5 text-xs font-semibold">{{ t('customersSetup.generalist') }}</span>
      </template>
      <template #cell-customers_count="{ row }">{{ row.customers_count == null ? '—' : n(row.customers_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.name }}</strong>
        <span class="text-xs text-dl-muted">{{ typeLabel(row.type) }} · {{ t('customersSetup.meta.customers', row.customers_count ?? 0) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel
        v-model:open="open"
        :title="record?.name ?? t('customersSetup.add.specialities')"
        :description="record ? typeLabel(record.type) : undefined"
      >
        <form id="speciality-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" :disabled="!canEdit" required />
          <div class="flex flex-col gap-1">
            <DlSelect v-model="form.type" :label="t('customersSetup.columns.type')" :options="typeOptions" :disabled="!canEdit" />
            <p v-if="errors.type" class="text-xs text-dl-rejected">{{ errors.type }}</p>
            <p class="text-xs text-dl-muted">{{ t('customersSetup.typeHint') }}</p>
          </div>
          <div v-if="form.type === 'medecin'" class="flex flex-col gap-1">
            <DlSwitch v-model="form.is_generalist" :label="t('customersSetup.generalist')" :disabled="!canEdit" />
            <p class="text-xs text-dl-muted">{{ t('customersSetup.generalistHint') }}</p>
          </div>
          <div v-if="record" class="rounded-2xl bg-dl-mist px-4 py-3">
            <p class="text-xs text-dl-muted">{{ t('customersSetup.columns.customers') }}</p>
            <p class="text-sm font-semibold tabular-nums">{{ n(record.customers_count ?? 0) }}</p>
          </div>
        </form>
        <template v-if="canEdit || (record && auth.can('specialities.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="speciality-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('customersSetup.add.specialities') }}
          </DlButton>
          <DlButton v-if="record && auth.can('specialities.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
