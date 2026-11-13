<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createSegmentation,
  deleteSegmentation,
  fetchSegmentations,
  updateSegmentation,
  type Segmentation,
} from '@/api/tenant/customerSetup'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import ColorField from '@/views/tenant/settings/shared/ColorField.vue'
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
const TYPES = ['cycle_target', 'survey'] as const
const typeOptions = computed(() => TYPES.map(type => ({ value: type, label: t(`customersSetup.segmentType.${type}`) })))
const typeLabel = (type: string) => (TYPES.includes(type as typeof TYPES[number]) ? t(`customersSetup.segmentType.${type}`) : type)

const list = useStudioList<Segmentation, { type: string | null }>(
  ({ page, perPage, search, sort, filters }) => fetchSegmentations({
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

interface SegmentForm { name: string; color: string; position: string; type: string }

const panel = useRecordPanel<Segmentation, SegmentForm>({
  toForm: segment => ({
    name: segment?.name ?? '',
    color: segment?.color ?? '',
    position: segment ? String(segment.position) : String(total.value + 1),
    type: segment?.type ?? filters.type ?? 'cycle_target',
  }),
  create: form => createSegmentation({ ...form, position: Number(form.position) }),
  update: (segment, form) => updateSegmentation(segment.id, { ...form, position: Number(form.position) }),
  remove: segment => deleteSegmentation(segment.id),
  recordName: segment => segment.name,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel
const canEdit = computed(() => (record.value ? auth.can('segmentations.update') : auth.can('segmentations.create')))

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('customersSetup.columns.segment'), sortKey: 'name' },
  { key: 'type', label: t('customersSetup.columns.usedFor') },
  { key: 'position', label: t('customersSetup.columns.position'), align: 'end' as const, sortKey: 'position' },
  { key: 'cycle_targets_count', label: t('customersSetup.columns.cycleTargets'), align: 'end' as const },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="customersSection"
    :title="t('customersSetup.title.segmentations')"
    :add-label="auth.can('segmentations.create') ? t('customersSetup.add.segmentations') : undefined"
    @add="panel.show(null)"
  >
    <div class="flex flex-wrap gap-2.5">
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('customersSetup.search.segmentations')"
        :placeholder="t('customersSetup.search.segmentations')"
        hide-label
        class="w-full sm:max-w-xs"
      />
      <DlSelect
        v-model="typeFilter"
        :label="t('customersSetup.columns.usedFor')"
        :options="[{ value: ALL, label: t('customersSetup.filter.allUses') }, ...typeOptions]"
        appearance="filter"
      />
    </div>

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('customersSetup.title.segmentations')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search || filters.type ? t('geo.empty.search') : t('customersSetup.empty.segmentations')"
      @open="panel.show"
    >
      <template #cell-name="{ row }">
        <span class="flex items-center gap-2.5">
          <span aria-hidden="true" class="h-3.5 w-3.5 shrink-0 rounded-full border border-dl-line" :style="{ background: row.color }" />
          <strong class="font-semibold">{{ row.name }}</strong>
        </span>
      </template>
      <template #cell-type="{ row }">
        <span class="rounded-full bg-dl-line-soft px-2.5 py-0.5 text-xs font-semibold">{{ typeLabel(row.type) }}</span>
      </template>
      <template #cell-cycle_targets_count="{ row }">{{ row.cycle_targets_count == null ? '—' : n(row.cycle_targets_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <span class="flex items-center gap-2.5">
          <span aria-hidden="true" class="h-3.5 w-3.5 shrink-0 rounded-full border border-dl-line" :style="{ background: row.color }" />
          <strong class="font-semibold">{{ row.name }}</strong>
        </span>
        <span class="text-xs text-dl-muted">{{ typeLabel(row.type) }} · {{ t('customersSetup.meta.targets', row.cycle_targets_count ?? 0) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel
        v-model:open="open"
        :title="record?.name ?? t('customersSetup.add.segmentations')"
        :description="record ? typeLabel(record.type) : undefined"
      >
        <form id="segment-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" :disabled="!canEdit" required />
          <div class="flex flex-col gap-1">
            <DlSelect v-model="form.type" :label="t('customersSetup.columns.usedFor')" :options="typeOptions" :disabled="!canEdit" />
            <p v-if="errors.type" class="text-xs text-dl-rejected">{{ errors.type }}</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <ColorField v-model="form.color" :label="t('customersSetup.fields.color')" :error="errors.color" :disabled="!canEdit" />
            <DlInput v-model="form.position" type="number" min="1" :label="t('customersSetup.columns.position')" :error="errors.position" :disabled="!canEdit" />
          </div>
          <p class="-mt-2 text-xs text-dl-muted">{{ t('customersSetup.positionHint') }}</p>
          <div v-if="record" class="rounded-2xl bg-dl-mist px-4 py-3">
            <p class="text-xs text-dl-muted">{{ t('customersSetup.columns.cycleTargets') }}</p>
            <p class="text-sm font-semibold tabular-nums">{{ n(record.cycle_targets_count ?? 0) }}</p>
          </div>
        </form>
        <template v-if="canEdit || (record && auth.can('segmentations.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="segment-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('customersSetup.add.segmentations') }}
          </DlButton>
          <DlButton v-if="record && auth.can('segmentations.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
