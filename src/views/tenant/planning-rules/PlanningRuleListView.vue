<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { planningRulesApi, type PlanningRule } from '@/api/tenant/rules'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlMenu from '@/components/DlMenu.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import PlanningWindow from '@/views/tenant/settings/rules/PlanningWindow.vue'
import RuleCoverage from '@/views/tenant/settings/rules/RuleCoverage.vue'
import RuleWho from '@/views/tenant/settings/rules/RuleWho.vue'
import RuleWhoFields from '@/views/tenant/settings/rules/RuleWhoFields.vue'
import { useAppliesTo, useRulePage, type RuleForm } from '@/views/tenant/settings/rules/useRulePage'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { rulesSection } from '@/views/tenant/settings/shared/studioSections'
import { STUDIO_DEFAULT_SORT, useAddedColumn } from '@/views/tenant/settings/shared/useStudioList'

// When reps may plan a cycle: from N days before it starts until M days before it starts.
// Mockup: docs/design/studio-mockups/RulesPlatform.html
interface PlanningRuleForm extends RuleForm {
  days_before_start_open: string | number
  days_before_start_close: string | number
}

const { t, n } = useI18n()
const appliesTo = useAppliesTo()

const page = useRulePage<PlanningRule, PlanningRuleForm, { days_before_start_open: number; days_before_start_close: number }>({
  kind: 'planning-rules',
  toForm: rule => ({
    days_before_start_open: rule?.days_before_start_open ?? 7,
    days_before_start_close: rule?.days_before_start_close ?? 2,
  }),
  toPayload: form => ({
    days_before_start_open: Number(form.days_before_start_open),
    days_before_start_close: Number(form.days_before_start_close),
  }),
  api: planningRulesApi,
})
const { list, panel, editing, menuItems, coverage, roles, teams, users, statusFilter, statusOptions, canAdd, canEdit } = page
const { page: pageNumber, perPage, search, sort, filters, items, total, loading } = list
const { open, record, form, errors, saving } = panel

/** "Opens 7 days before · closes 2 days before". */
const windowText = (rule: PlanningRule) => t('rulesSetup.window.short', {
  open: t('rulesSetup.window.daysBefore', rule.days_before_start_open),
  close: rule.days_before_start_close ? t('rulesSetup.window.daysBefore', rule.days_before_start_close) : t('rulesSetup.window.atStart'),
})

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('geo.fields.name'), sortKey: 'name' },
  { key: 'applies', label: t('fieldSetup.columns.appliesTo') },
  { key: 'window', label: t('rulesSetup.columns.window'), sortKey: 'days_before_start_open' },
  { key: 'users_count', label: t('rulesSetup.columns.people'), align: 'end' as const, secondary: true },
  { key: 'is_active', label: t('fieldSetup.columns.status'), secondary: true },
  { ...added.column, secondary: true },
]
</script>

<template>
  <StudioListPage
    :section="rulesSection"
    :title="t('rulesSetup.title.planningRules')"
    :add-label="canAdd ? t('rulesSetup.add.planningRules') : undefined"
    @add="page.startAdd"
  >
    <RuleCoverage
      v-if="coverage"
      :coverage="coverage"
      text-key="rulesSetup.coverage.planning"
      no-rule-key="rulesSetup.coverage.planningNone"
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
      :label="t('rulesSetup.title.planningRules')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search || filters.status ? t('geo.empty.search') : t('rulesSetup.empty.planningRules')"
      @open="panel.show"
    >
      <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
      <template #cell-applies="{ row }">{{ appliesTo(row).text }}</template>
      <template #cell-window="{ row }"><span class="whitespace-nowrap">{{ windowText(row) }}</span></template>
      <template #cell-users_count="{ row }">{{ n(row.users_count ?? 0) }}</template>
      <template #cell-is_active="{ row }">
        <DlBadge size="sm" :tone="row.is_active ? 'success' : 'neutral'" dot>{{ t(row.is_active ? 'rulesSetup.status.active' : 'rulesSetup.status.paused') }}</DlBadge>
      </template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.name }}</strong>
        <span class="text-xs text-dl-muted">{{ windowText(row) }} · {{ appliesTo(row).text }}</span>
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
          <PlanningWindow :open="record.days_before_start_open" :close="record.days_before_start_close" />
          <p v-if="!record.is_active" class="text-xs text-dl-muted">{{ t('rulesSetup.pausedHint') }}</p>

          <DlRecordSection
            :editing="editing === 'rule'"
            :title="t('rulesSetup.part.window')"
            icon="tabler-calendar-time"
            :can-edit="canEdit && editing === null"
            :saving="saving"
            @update:editing="page.edit('rule')"
            @save="page.saveSection"
            @cancel="page.cancelSection"
          >
            {{ windowText(record) }}
            <template #edit>
              <div class="grid grid-cols-2 gap-3">
                <DlInput v-model="form.days_before_start_open" type="number" min="1" :label="t('rulesSetup.fields.opens')" :hint="t('rulesSetup.fields.daysBeforeStart')" :error="errors.days_before_start_open" required />
                <DlInput v-model="form.days_before_start_close" type="number" min="0" :label="t('rulesSetup.fields.closes')" :hint="t('rulesSetup.fields.daysBeforeStart')" :error="errors.days_before_start_close" required />
              </div>
              <PlanningWindow :open="form.days_before_start_open" :close="form.days_before_start_close" />
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
              <RuleWhoFields v-model="form" kind="planning-rules" :rule-id="record.id" :roles="roles" :teams="teams" :users="users" :errors="errors" />
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
      <DlRecordPanel v-else v-model:open="open" :title="t('rulesSetup.add.planningTitle')" :description="t('rulesSetup.add.hint')">
        <form id="planning-rule-add" class="flex flex-col gap-4" @submit.prevent="page.add">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" required />
          <div class="grid grid-cols-2 gap-3">
            <DlInput v-model="form.days_before_start_open" type="number" min="1" :label="t('rulesSetup.fields.opens')" :hint="t('rulesSetup.fields.daysBeforeStart')" :error="errors.days_before_start_open" required />
            <DlInput v-model="form.days_before_start_close" type="number" min="0" :label="t('rulesSetup.fields.closes')" :hint="t('rulesSetup.fields.daysBeforeStart')" :error="errors.days_before_start_close" required />
          </div>
          <PlanningWindow :open="form.days_before_start_open" :close="form.days_before_start_close" />
          <RuleWhoFields v-model="form" kind="planning-rules" :roles="roles" :teams="teams" :users="users" :errors="errors" />
        </form>
        <template #footer>
          <DlButton variant="outline" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" form="planning-rule-add" variant="primary" :loading="saving" class="flex-1">{{ t('rulesSetup.add.planningSave') }}</DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
