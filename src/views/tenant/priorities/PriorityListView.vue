<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { createPriority, deletePriority, fetchPriorities, updatePriority, type Priority } from '@/api/tenant/customerSetup'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
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

const list = useStudioList<Priority, Record<string, never>>(
  ({ page, perPage, search, sort }) => fetchPriorities({ page, per_page: perPage, sort, 'filter[name]': search || undefined }),
  {},
)
const { page, perPage, search, sort, items, total, loading } = list
list.reload()

interface PriorityForm { name: string; order: string; color: string }

const panel = useRecordPanel<Priority, PriorityForm>({
  toForm: priority => ({
    name: priority?.name ?? '',
    order: priority ? String(priority.order) : String(total.value + 1),
    color: priority?.color ?? '',
  }),
  create: form => createPriority({ ...form, order: Number(form.order) }),
  update: (priority, form) => updatePriority(priority.id, { ...form, order: Number(form.order) }),
  remove: priority => deletePriority(priority.id),
  recordName: priority => priority.name,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel
const canEdit = computed(() => (record.value ? auth.can('priorities.update') : auth.can('priorities.create')))

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('customersSetup.columns.priority'), sortKey: 'name' },
  { key: 'order', label: t('customersSetup.columns.order'), align: 'end' as const, sortKey: 'order' },
  { key: 'campaigns_count', label: t('customersSetup.columns.campaigns'), align: 'end' as const },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="customersSection"
    :title="t('customersSetup.title.priorities')"
    :add-label="auth.can('priorities.create') ? t('customersSetup.add.priorities') : undefined"
    @add="panel.show(null)"
  >
    <DlInput
      v-model="search"
      type="search"
      icon="tabler-search"
      :label="t('customersSetup.search.priorities')"
      :placeholder="t('customersSetup.search.priorities')"
      hide-label
      class="w-full sm:max-w-xs"
    />

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('customersSetup.title.priorities')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search ? t('geo.empty.search') : t('customersSetup.empty.priorities')"
      @open="panel.show"
    >
      <template #cell-name="{ row }">
        <span class="flex items-center gap-2.5">
          <span aria-hidden="true" class="h-3.5 w-3.5 shrink-0 rounded-full border border-dl-line" :style="{ background: row.color }" />
          <strong class="font-semibold">{{ row.name }}</strong>
        </span>
      </template>
      <template #cell-campaigns_count="{ row }">{{ row.campaigns_count == null ? '—' : n(row.campaigns_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <span class="flex items-center gap-2.5">
          <span aria-hidden="true" class="h-3.5 w-3.5 shrink-0 rounded-full border border-dl-line" :style="{ background: row.color }" />
          <strong class="font-semibold">{{ row.name }}</strong>
        </span>
        <span class="text-xs text-dl-muted">{{ t('customersSetup.meta.order', { order: row.order }) }} · {{ t('customersSetup.meta.campaigns', row.campaigns_count ?? 0) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel
        v-model:open="open"
        :title="record?.name ?? t('customersSetup.add.priorities')"
        :description="record ? t('customersSetup.meta.order', { order: record.order }) : undefined"
      >
        <form id="priority-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" :disabled="!canEdit" required />
          <div class="grid grid-cols-2 gap-3">
            <DlInput v-model="form.order" type="number" min="0" :label="t('customersSetup.columns.order')" :error="errors.order" :disabled="!canEdit" />
            <ColorField v-model="form.color" :label="t('customersSetup.fields.color')" :error="errors.color" :disabled="!canEdit" />
          </div>
          <p class="-mt-2 text-xs text-dl-muted">{{ t('customersSetup.orderHint') }}</p>
          <div v-if="record" class="rounded-2xl bg-dl-mist px-4 py-3">
            <p class="text-xs text-dl-muted">{{ t('customersSetup.columns.campaigns') }}</p>
            <p class="text-sm font-semibold tabular-nums">{{ n(record.campaigns_count ?? 0) }}</p>
          </div>
        </form>
        <template v-if="canEdit || (record && auth.can('priorities.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="priority-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('customersSetup.add.priorities') }}
          </DlButton>
          <DlButton v-if="record && auth.can('priorities.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
