<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { createCancelReason, deleteCancelReason, fetchCancelReasons, updateCancelReason, type CancelReason } from '@/api/tenant/fieldSetup'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useAuthStore } from '@/stores/auth'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { fieldSection } from '@/views/tenant/settings/shared/studioSections'
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

const list = useStudioList<CancelReason, Record<string, never>>(
  ({ page, perPage, search, sort }) => fetchCancelReasons({ page, per_page: perPage, sort, 'filter[name]': search || undefined }),
  {},
)
const { page, perPage, search, sort, items, total, loading } = list
list.reload()

const panel = useRecordPanel<CancelReason, { name: string }>({
  toForm: row => ({ name: row?.name ?? '' }),
  create: form => createCancelReason(form),
  update: (row, form) => updateCancelReason(row.id, form),
  remove: row => deleteCancelReason(row.id),
  recordName: row => row.name,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel
const canEdit = computed(() => (record.value ? auth.can('cancel-reasons.update') : auth.can('cancel-reasons.create')))

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('fieldSetup.columns.cancelReason'), sortKey: 'name' },
  { key: 'visits_count', label: t('fieldSetup.columns.cancelledVisits'), align: 'end' as const },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="fieldSection"
    :title="t('fieldSetup.title.cancelReasons')"
    :add-label="auth.can('cancel-reasons.create') ? t('fieldSetup.add.cancelReasons') : undefined"
    @add="panel.show(null)"
  >
    <DlInput
      v-model="search"
      type="search"
      icon="tabler-search"
      :label="t('fieldSetup.search.cancelReasons')"
      :placeholder="t('fieldSetup.search.cancelReasons')"
      hide-label
      class="w-full sm:max-w-xs"
    />

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('fieldSetup.title.cancelReasons')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search ? t('geo.empty.search') : t('fieldSetup.empty.cancelReasons')"
      @open="panel.show"
    >
      <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
      <template #cell-visits_count="{ row }">{{ row.visits_count == null ? '—' : n(row.visits_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.name }}</strong>
        <span class="text-xs text-dl-muted">{{ t('fieldSetup.meta.cancelledVisits', row.visits_count ?? 0) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel v-model:open="open" :title="record?.name ?? t('fieldSetup.add.cancelReasons')">
        <form id="cancel-reason-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" :disabled="!canEdit" required />
          <div v-if="record" class="rounded-2xl bg-dl-mist px-4 py-3">
            <p class="text-xs text-dl-muted">{{ t('fieldSetup.columns.cancelledVisits') }}</p>
            <p class="text-sm font-semibold tabular-nums">{{ n(record.visits_count ?? 0) }}</p>
          </div>
        </form>
        <template v-if="canEdit || (record && auth.can('cancel-reasons.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="cancel-reason-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('fieldSetup.add.cancelReasons') }}
          </DlButton>
          <DlButton v-if="record && auth.can('cancel-reasons.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
