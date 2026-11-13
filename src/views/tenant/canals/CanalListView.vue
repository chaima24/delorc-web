<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { createCanal, deleteCanal, fetchCanals, updateCanal, type Canal } from '@/api/tenant/fieldSetup'
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

const list = useStudioList<Canal, Record<string, never>>(
  ({ page, perPage, search, sort }) => fetchCanals({ page, per_page: perPage, sort, 'filter[name]': search || undefined }),
  {},
)
const { page, perPage, search, sort, items, total, loading } = list
list.reload()

const panel = useRecordPanel<Canal, { name: string }>({
  toForm: row => ({ name: row?.name ?? '' }),
  create: form => createCanal(form),
  update: (row, form) => updateCanal(row.id, form),
  remove: row => deleteCanal(row.id),
  recordName: row => row.name,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel
const canEdit = computed(() => (record.value ? auth.can('canals.update') : auth.can('canals.create')))

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('fieldSetup.columns.canal'), sortKey: 'name' },
  { key: 'visits_count', label: t('fieldSetup.columns.visits'), align: 'end' as const },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="fieldSection"
    :title="t('fieldSetup.title.canals')"
    :add-label="auth.can('canals.create') ? t('fieldSetup.add.canals') : undefined"
    @add="panel.show(null)"
  >
    <DlInput
      v-model="search"
      type="search"
      icon="tabler-search"
      :label="t('fieldSetup.search.canals')"
      :placeholder="t('fieldSetup.search.canals')"
      hide-label
      class="w-full sm:max-w-xs"
    />

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('fieldSetup.title.canals')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search ? t('geo.empty.search') : t('fieldSetup.empty.canals')"
      @open="panel.show"
    >
      <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
      <template #cell-visits_count="{ row }">{{ row.visits_count == null ? '—' : n(row.visits_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.name }}</strong>
        <span class="text-xs text-dl-muted">{{ t('fieldSetup.meta.visits', row.visits_count ?? 0) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel v-model:open="open" :title="record?.name ?? t('fieldSetup.add.canals')">
        <form id="canal-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" :disabled="!canEdit" required />
          <div v-if="record" class="rounded-2xl bg-dl-mist px-4 py-3">
            <p class="text-xs text-dl-muted">{{ t('fieldSetup.columns.visits') }}</p>
            <p class="text-sm font-semibold tabular-nums">{{ n(record.visits_count ?? 0) }}</p>
          </div>
        </form>
        <template v-if="canEdit || (record && auth.can('canals.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="canal-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('fieldSetup.add.canals') }}
          </DlButton>
          <DlButton v-if="record && auth.can('canals.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
