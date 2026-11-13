<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  activityTypeRoles,
  createActivityType,
  deleteActivityType,
  fetchActivityTypes,
  updateActivityType,
  type ActivityType,
} from '@/api/tenant/fieldSetup'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import { roleLabel, useRolesAndTeams } from '@/views/tenant/settings/shared/lookups'
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

// What reps log besides visits: the kind of day it takes, what it is linked to, and who may log it.
const { t, n } = useI18n()
const auth = useAuthStore()
const { refresh: refreshCounts } = useStudioCounts()
const { roles } = useRolesAndTeams()

const ALL = 'all'
const DAY_TYPES = ['field_days', 'off_field_work_days', 'non_working_days'] as const
const LINKS = ['cycle_target', 'pharmacy', 'wholesaler_pharmacy', 'wholesaler', 'territory', 'medical_representative'] as const
const dayOptions = computed(() => DAY_TYPES.map(v => ({ value: v, label: t(`fieldSetup.dayType.${v}`) })))
const linkOptions = computed(() => LINKS.map(v => ({ value: v, label: t(`fieldSetup.linkedTo.${v}`) })))
const dayLabel = (v: string) => ((DAY_TYPES as readonly string[]).includes(v) ? t(`fieldSetup.dayType.${v}`) : v)
const linkLabel = (v: string) => ((LINKS as readonly string[]).includes(v) ? t(`fieldSetup.linkedTo.${v}`) : v)

const list = useStudioList<ActivityType, { day: string | null; role: number | null }>(
  ({ page, perPage, search, sort, filters }) => fetchActivityTypes({
    page,
    per_page: perPage,
    include: 'roles',
    sort,
    'filter[activity]': search || undefined,
    'filter[type]': filters.day ?? undefined,
    'filter[role_id]': filters.role ?? undefined,
  }),
  { day: null, role: null },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const dayFilter = computed({
  get: () => filters.day ?? ALL,
  set: value => { filters.day = value === ALL || value == null ? null : String(value) },
})
const roleFilter = computed({
  get: () => filters.role ?? ALL,
  set: value => { filters.role = value === ALL || value == null ? null : Number(value) },
})

interface ActivityTypeForm { activity: string; type: string; value: string; role_ids: number[] }

const panel = useRecordPanel<ActivityType, ActivityTypeForm>({
  toForm: row => ({
    activity: row?.activity ?? '',
    type: row?.type ?? filters.day ?? 'off_field_work_days',
    value: row?.value ?? 'cycle_target',
    role_ids: row ? activityTypeRoles(row).map(r => r.id) : [],
  }),
  create: form => createActivityType(form),
  update: (row, form) => updateActivityType(row.id, form),
  remove: row => deleteActivityType(row.id),
  recordName: row => row.activity,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel
const canEdit = computed(() => (record.value ? auth.can('activity-types.update') : auth.can('activity-types.create')))

const roleNames = (row: ActivityType) => activityTypeRoles(row).map(r => roleLabel(r.name)).join(', ')

const added = useAddedColumn()
const columns = [
  { key: 'activity', label: t('fieldSetup.columns.activityType'), sortKey: 'activity' },
  { key: 'type', label: t('fieldSetup.columns.dayType') },
  { key: 'value', label: t('fieldSetup.columns.linkedTo'), secondary: true },
  { key: 'roles', label: t('fieldSetup.columns.roles'), secondary: true },
  { key: 'activities_count', label: t('fieldSetup.columns.activities'), align: 'end' as const },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="fieldSection"
    :title="t('fieldSetup.title.activityTypes')"
    :add-label="auth.can('activity-types.create') ? t('fieldSetup.add.activityTypes') : undefined"
    @add="panel.show(null)"
  >
    <div class="flex flex-wrap gap-2.5">
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('fieldSetup.search.activityTypes')"
        :placeholder="t('fieldSetup.search.activityTypes')"
        hide-label
        class="w-full sm:max-w-xs"
      />
      <DlSelect
        v-model="dayFilter"
        :label="t('fieldSetup.columns.dayType')"
        :options="[{ value: ALL, label: t('fieldSetup.filter.allDayTypes') }, ...dayOptions]"
        appearance="filter"
      />
      <DlSelect
        v-model="roleFilter"
        :label="t('fieldSetup.columns.role')"
        :options="[{ value: ALL, label: t('fieldSetup.filter.allRoles') }, ...roles]"
        appearance="filter"
      />
    </div>

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('fieldSetup.title.activityTypes')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search || filters.day || filters.role ? t('geo.empty.search') : t('fieldSetup.empty.activityTypes')"
      @open="panel.show"
    >
      <template #cell-activity="{ row }"><strong class="font-semibold">{{ row.activity }}</strong></template>
      <template #cell-type="{ row }">
        <span class="rounded-full bg-dl-line-soft px-2.5 py-0.5 text-xs font-semibold">{{ dayLabel(row.type) }}</span>
      </template>
      <template #cell-value="{ row }">{{ linkLabel(row.value) }}</template>
      <template #cell-roles="{ row }"><span class="line-clamp-1 max-w-[240px] text-dl-muted">{{ roleNames(row) || '—' }}</span></template>
      <template #cell-activities_count="{ row }">{{ row.activities_count == null ? '—' : n(row.activities_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.activity }}</strong>
        <span class="text-xs text-dl-muted">{{ dayLabel(row.type) }} · {{ linkLabel(row.value) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel
        v-model:open="open"
        :title="record?.activity ?? t('fieldSetup.add.activityTypes')"
        :description="record ? dayLabel(record.type) : undefined"
      >
        <form id="activity-type-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.activity" :label="t('geo.fields.name')" :error="errors.activity" :disabled="!canEdit" required />
          <div class="flex flex-col gap-1">
            <DlSelect v-model="form.type" :label="t('fieldSetup.columns.dayType')" :options="dayOptions" :disabled="!canEdit" />
            <p v-if="errors.type" class="text-xs text-dl-rejected">{{ errors.type }}</p>
            <p class="text-xs text-dl-muted">{{ t('fieldSetup.dayTypeHint') }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <DlSelect v-model="form.value" :label="t('fieldSetup.columns.linkedTo')" :options="linkOptions" :disabled="!canEdit" />
            <p v-if="errors.value" class="text-xs text-dl-rejected">{{ errors.value }}</p>
            <p class="text-xs text-dl-muted">{{ t('fieldSetup.linkedToHint') }}</p>
          </div>
          <CheckList
            v-model="form.role_ids"
            :legend="t('fieldSetup.fields.roles')"
            :selected-label="t('geo.selected', { count: form.role_ids.length })"
            :search-label="t('fieldSetup.search.roles')"
            :items="roles"
            :empty-text="t('geo.empty.search')"
            :disabled="!canEdit"
            :error="errors.role_ids"
          />
          <div v-if="record" class="rounded-2xl bg-dl-mist px-4 py-3">
            <p class="text-xs text-dl-muted">{{ t('fieldSetup.columns.activities') }}</p>
            <p class="text-sm font-semibold tabular-nums">{{ n(record.activities_count ?? 0) }}</p>
          </div>
        </form>
        <template v-if="canEdit || (record && auth.can('activity-types.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="activity-type-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('fieldSetup.add.activityTypes') }}
          </DlButton>
          <DlButton v-if="record && auth.can('activity-types.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
