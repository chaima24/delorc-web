<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { validationRulesApi, type ValidationRule } from '@/api/tenant/rules'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlMenu from '@/components/DlMenu.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import RuleCoverage from '@/views/tenant/settings/rules/RuleCoverage.vue'
import RuleWho from '@/views/tenant/settings/rules/RuleWho.vue'
import RuleWhoFields from '@/views/tenant/settings/rules/RuleWhoFields.vue'
import { useAppliesTo, useRulePage, type RuleForm } from '@/views/tenant/settings/rules/useRulePage'
import ValidationDelay from '@/views/tenant/settings/rules/ValidationDelay.vue'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { rulesSection } from '@/views/tenant/settings/shared/studioSections'
import { STUDIO_DEFAULT_SORT, useAddedColumn } from '@/views/tenant/settings/shared/useStudioList'

// How long after a visit's planned time a rep can still validate it.
// Mockup: docs/design/studio-mockups/RulesPlatform.html
interface ValidationRuleForm extends RuleForm {
  duration_hours: string | number
}

const { t, n } = useI18n()
const appliesTo = useAppliesTo()

const page = useRulePage<ValidationRule, ValidationRuleForm, { duration_hours: number }>({
  kind: 'validation-rules',
  toForm: rule => ({ duration_hours: rule?.duration_hours ?? 24 }),
  toPayload: form => ({ duration_hours: Number(form.duration_hours) }),
  api: validationRulesApi,
})
const { list, panel, editing, menuItems, coverage, roles, teams, users, statusFilter, statusOptions, canAdd, canEdit } = page
const { page: pageNumber, perPage, search, sort, filters, items, total, loading } = list
const { open, record, form, errors, saving } = panel

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('geo.fields.name'), sortKey: 'name' },
  { key: 'applies', label: t('fieldSetup.columns.appliesTo') },
  { key: 'duration_hours', label: t('rulesSetup.columns.delay'), sortKey: 'duration_hours', align: 'end' as const },
  { key: 'users_count', label: t('rulesSetup.columns.people'), align: 'end' as const, secondary: true },
  { key: 'is_active', label: t('fieldSetup.columns.status'), secondary: true },
  { ...added.column, secondary: true },
]
</script>

<template>
  <StudioListPage
    :section="rulesSection"
    :title="t('rulesSetup.title.validationRules')"
    :add-label="canAdd ? t('rulesSetup.add.validationRules') : undefined"
    @add="page.startAdd"
  >
    <RuleCoverage
      v-if="coverage"
      :coverage="coverage"
      text-key="rulesSetup.coverage.validation"
      no-rule-key="rulesSetup.coverage.validationNone"
    />

    <div class="flex flex-wrap gap-2.5">
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('rulesSetup.search')"
        :placeholder="t('rulesSetup.search')"
        hide-label
        class="w-full sm:max-w-xs"
      />
      <DlSelect v-model="statusFilter" :label="t('fieldSetup.columns.status')" :options="statusOptions" appearance="filter" />
    </div>

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('rulesSetup.title.validationRules')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search || filters.status ? t('geo.empty.search') : t('rulesSetup.empty.validationRules')"
      @open="panel.show"
    >
      <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
      <template #cell-applies="{ row }">{{ appliesTo(row).text }}</template>
      <template #cell-duration_hours="{ row }"><span class="whitespace-nowrap">{{ t('rulesSetup.delay.hours', { count: n(row.duration_hours) }, row.duration_hours) }}</span></template>
      <template #cell-users_count="{ row }">{{ n(row.users_count ?? 0) }}</template>
      <template #cell-is_active="{ row }">
        <DlBadge size="sm" :tone="row.is_active ? 'success' : 'neutral'" dot>{{ t(row.is_active ? 'rulesSetup.status.active' : 'rulesSetup.status.paused') }}</DlBadge>
      </template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.name }}</strong>
        <span class="text-xs text-dl-muted">{{ t('rulesSetup.delay.hours', { count: n(row.duration_hours) }, row.duration_hours) }} · {{ appliesTo(row).text }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="pageNumber" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <!-- Reading mode -->
      <DlRecordPanel v-if="record" v-model:open="open" :title="record.name">
        <template #badges>
          <span class="mt-1 flex flex-wrap items-center gap-1.5">
            <DlBadge size="sm">{{ t(`rulesSetup.who.kind.${appliesTo(record).kind}`) }}</DlBadge>
            <DlBadge size="sm" :tone="record.is_active ? 'success' : 'neutral'" dot>{{ t(record.is_active ? 'rulesSetup.status.active' : 'rulesSetup.status.paused') }}</DlBadge>
          </span>
        </template>
        <template v-if="menuItems.length" #actions>
          <DlMenu :label="t('fieldSetup.menu.label')" :items="menuItems" />
        </template>

        <div class="flex flex-col gap-3.5">
          <ValidationDelay :hours="record.duration_hours" />
          <p v-if="!record.is_active" class="text-xs text-dl-muted">{{ t('rulesSetup.pausedHint') }}</p>

          <DlRecordSection
            :editing="editing === 'rule'"
            :title="t('rulesSetup.part.delay')"
            icon="tabler-clock-check"
            :can-edit="canEdit && editing === null"
            :saving="saving"
            @update:editing="page.edit('rule')"
            @save="page.saveSection"
            @cancel="page.cancelSection"
          >
            {{ t('rulesSetup.delay.long', { count: n(record.duration_hours) }, record.duration_hours) }}
            <template #edit>
              <DlInput v-model="form.duration_hours" type="number" min="1" :label="t('rulesSetup.fields.delay')" :hint="t('rulesSetup.fields.delayHint')" :error="errors.duration_hours" required />
              <ValidationDelay :hours="form.duration_hours" />
            </template>
          </DlRecordSection>

          <DlRecordSection
            :editing="editing === 'who'"
            :title="t('rulesSetup.part.who')"
            icon="tabler-users"
            :can-edit="canEdit && editing === null"
            :saving="saving"
            @update:editing="page.edit('who')"
            @save="page.saveSection"
            @cancel="page.cancelSection"
          >
            <RuleWho :rule="record" />
            <template #edit>
              <RuleWhoFields v-model="form" kind="validation-rules" :rule-id="record.id" :roles="roles" :teams="teams" :users="users" :errors="errors" />
            </template>
          </DlRecordSection>

          <DlRecordSection
            :editing="editing === 'about'"
            :title="t('rulesSetup.part.about')"
            icon="tabler-notes"
            :can-edit="canEdit && editing === null"
            :saving="saving"
            @update:editing="page.edit('about')"
            @save="page.saveSection"
            @cancel="page.cancelSection"
          >
            <span v-if="record.description">“{{ record.description }}”</span>
            <span v-else class="text-dl-muted">{{ t('rulesSetup.noNote') }}</span>
            <template #edit>
              <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" required />
              <DlInput v-model="form.description" :label="t('rulesSetup.fields.note')" :error="errors.description" />
            </template>
          </DlRecordSection>

          <p class="pt-1 text-xs text-dl-muted">
            {{ record.created_by?.full_name ? t('fieldSetup.read.addedBy', { name: record.created_by.full_name, date: added.format(record.created_at) }) : t('fieldSetup.read.added', { date: added.format(record.created_at) }) }}
          </p>
        </div>
      </DlRecordPanel>

      <!-- Add: one screen -->
      <DlRecordPanel v-else v-model:open="open" :title="t('rulesSetup.add.validationTitle')" :description="t('rulesSetup.add.hint')">
        <form id="validation-rule-add" class="flex flex-col gap-4" @submit.prevent="page.add">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" required />
          <DlInput v-model="form.duration_hours" type="number" min="1" :label="t('rulesSetup.fields.delay')" :hint="t('rulesSetup.fields.delayHint')" :error="errors.duration_hours" required />
          <ValidationDelay :hours="form.duration_hours" />
          <RuleWhoFields v-model="form" kind="validation-rules" :roles="roles" :teams="teams" :users="users" :errors="errors" />
        </form>
        <template #footer>
          <DlButton variant="outline" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" form="validation-rule-add" variant="primary" :loading="saving" class="flex-1">{{ t('rulesSetup.add.validationSave') }}</DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
