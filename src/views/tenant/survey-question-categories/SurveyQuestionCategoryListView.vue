<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { createQuestionCategory, deleteQuestionCategory, fetchQuestionCategories, updateQuestionCategory, type QuestionCategory } from '@/api/tenant/surveys'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useAuthStore } from '@/stores/auth'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { fieldSection } from '@/views/tenant/settings/shared/studioSections'
import { useAddedColumn, useRecordPanel, useStudioCounts, useStudioList } from '@/views/tenant/settings/shared/useStudioList'

// Studio › Configuration terrain › Catégories de questions (docs/api/surveys.md), as the cancel reasons.
// A category used by a question can't be deleted. Mockup: surveys-mockups/Surveys.html frame 10.
const { t, n } = useI18n()
const auth = useAuthStore()
const { refresh: refreshCounts } = useStudioCounts()

const list = useStudioList<QuestionCategory, Record<string, never>>(
  ({ page, perPage, search, sort }) => fetchQuestionCategories({ page, per_page: perPage, sort, 'filter[search]': search || undefined }),
  {},
  'category',
)
const { page, perPage, search, sort, items, total, loading } = list
list.reload()

const panel = useRecordPanel<QuestionCategory, { category: string }>({
  toForm: row => ({ category: row?.category ?? '' }),
  create: form => createQuestionCategory(form),
  update: (row, form) => updateQuestionCategory(row.id, form),
  remove: row => deleteQuestionCategory(row.id),
  recordName: row => row.category,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel
const canEdit = computed(() => (record.value ? auth.can('survey-question-categories.update') : auth.can('survey-question-categories.create')))

const added = useAddedColumn()
const columns = [
  { key: 'category', label: t('surveyCategories.columns.name'), sortKey: 'category' },
  { key: 'questions_count', label: t('surveyCategories.columns.questions'), sortKey: 'questions_count', align: 'end' as const },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="fieldSection"
    :title="t('surveyCategories.title')"
    :add-label="auth.can('survey-question-categories.create') ? t('surveyCategories.add') : undefined"
    @add="panel.show(null)"
  >
    <p class="text-[13px] text-dl-muted">{{ t('surveyCategories.subtitle') }}</p>
    <DlInput v-model="search" type="search" icon="tabler-search" :label="t('surveyCategories.search')" :placeholder="t('surveyCategories.search')" hide-label class="w-full sm:max-w-xs" />

    <DlDataList
      v-model:sort="sort"
      default-sort="category"
      :label="t('surveyCategories.title')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search ? t('geo.empty.search') : t('surveyCategories.empty')"
      @open="panel.show"
    >
      <template #cell-category="{ row }"><strong class="font-semibold">{{ row.category }}</strong></template>
      <template #cell-questions_count="{ row }">{{ n(row.questions_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.category }}</strong>
        <span class="text-xs text-dl-muted">{{ t('surveyCategories.meta', { count: row.questions_count }, row.questions_count) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel v-model:open="open" :title="record?.category ?? t('surveyCategories.add')">
        <form id="survey-category-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.category" :label="t('geo.fields.name')" :error="errors.category" :disabled="!canEdit" required />
          <div v-if="record" class="rounded-2xl bg-dl-mist px-4 py-3">
            <p class="text-xs text-dl-muted">{{ t('surveyCategories.columns.questions') }}</p>
            <p class="text-sm font-semibold tabular-nums">{{ n(record.questions_count) }}</p>
          </div>
        </form>
        <template v-if="canEdit || (record && auth.can('survey-question-categories.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="survey-category-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('surveyCategories.add') }}
          </DlButton>
          <DlButton v-if="record && auth.can('survey-question-categories.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
