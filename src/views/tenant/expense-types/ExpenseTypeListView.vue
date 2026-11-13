<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createExpenseType,
  deleteExpenseType,
  EXPENSE_TYPE_CONTEXTS,
  fetchExpenseTypes,
  updateExpenseType,
  type ExpenseType,
} from '@/api/tenant/fieldSetup'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
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

const ALL = 'all'
const contextOptions = computed(() => EXPENSE_TYPE_CONTEXTS.map(c => ({ value: c, label: t(`fieldSetup.expenseContext.${c}`) })))
const contextLabel = (value: string) =>
  ((EXPENSE_TYPE_CONTEXTS as readonly string[]).includes(value) ? t(`fieldSetup.expenseContext.${value}`) : value)

const list = useStudioList<ExpenseType, { context: string | null }>(
  ({ page, perPage, search, sort, filters }) => fetchExpenseTypes({
    page,
    per_page: perPage,
    sort,
    'filter[content]': search || undefined,
    'filter[type]': filters.context ?? undefined,
  }),
  { context: null },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const contextFilter = computed({
  get: () => filters.context ?? ALL,
  set: value => { filters.context = value === ALL || value == null ? null : String(value) },
})

const panel = useRecordPanel<ExpenseType, { content: string; type: string }>({
  toForm: row => ({ content: row?.content ?? '', type: row?.type ?? filters.context ?? 'visit' }),
  create: form => createExpenseType(form),
  update: (row, form) => updateExpenseType(row.id, form),
  remove: row => deleteExpenseType(row.id),
  recordName: row => row.content,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel
const canEdit = computed(() => (record.value ? auth.can('expense-types.update') : auth.can('expense-types.create')))

const added = useAddedColumn()
const columns = [
  { key: 'content', label: t('fieldSetup.columns.expenseType') },
  { key: 'type', label: t('fieldSetup.columns.context'), sortKey: 'type' },
  { key: 'expenses_count', label: t('fieldSetup.columns.expenses'), align: 'end' as const },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="fieldSection"
    :title="t('fieldSetup.title.expenseTypes')"
    :add-label="auth.can('expense-types.create') ? t('fieldSetup.add.expenseTypes') : undefined"
    @add="panel.show(null)"
  >
    <div class="flex flex-wrap gap-2.5">
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('fieldSetup.search.expenseTypes')"
        :placeholder="t('fieldSetup.search.expenseTypes')"
        hide-label
        class="w-full sm:max-w-xs"
      />
      <DlSelect
        v-model="contextFilter"
        :label="t('fieldSetup.columns.context')"
        :options="[{ value: ALL, label: t('fieldSetup.filter.allContexts') }, ...contextOptions]"
        appearance="filter"
      />
    </div>

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('fieldSetup.title.expenseTypes')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search || filters.context ? t('geo.empty.search') : t('fieldSetup.empty.expenseTypes')"
      @open="panel.show"
    >
      <template #cell-content="{ row }"><strong class="font-semibold">{{ row.content }}</strong></template>
      <template #cell-type="{ row }">
        <span class="rounded-full bg-dl-line-soft px-2.5 py-0.5 text-xs font-semibold">{{ contextLabel(row.type) }}</span>
      </template>
      <template #cell-expenses_count="{ row }">{{ row.expenses_count == null ? '—' : n(row.expenses_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.content }}</strong>
        <span class="text-xs text-dl-muted">{{ contextLabel(row.type) }} · {{ t('fieldSetup.meta.expenses', row.expenses_count ?? 0) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel
        v-model:open="open"
        :title="record?.content ?? t('fieldSetup.add.expenseTypes')"
        :description="record ? contextLabel(record.type) : undefined"
      >
        <form id="expense-type-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.content" :label="t('geo.fields.name')" :error="errors.content" :disabled="!canEdit" required />
          <div class="flex flex-col gap-1">
            <DlSelect v-model="form.type" :label="t('fieldSetup.columns.context')" :options="contextOptions" :disabled="!canEdit" />
            <p v-if="errors.type" class="text-xs text-dl-rejected">{{ errors.type }}</p>
            <p class="text-xs text-dl-muted">{{ t('fieldSetup.contextHint') }}</p>
          </div>
          <div v-if="record" class="rounded-2xl bg-dl-mist px-4 py-3">
            <p class="text-xs text-dl-muted">{{ t('fieldSetup.columns.expenses') }}</p>
            <p class="text-sm font-semibold tabular-nums">{{ n(record.expenses_count ?? 0) }}</p>
          </div>
        </form>
        <template v-if="canEdit || (record && auth.can('expense-types.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="expense-type-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('fieldSetup.add.expenseTypes') }}
          </DlButton>
          <DlButton v-if="record && auth.can('expense-types.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
