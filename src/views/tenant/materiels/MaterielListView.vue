<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { createMateriel, deleteMateriel, fetchMateriels, updateMateriel, type Materiel } from '@/api/tenant/fieldSetup'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
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

// A material is for the role that hands it out (reps, KAMs…), or for every field role (docs/api/materials.md).
const { t, n } = useI18n()
const auth = useAuthStore()
const { refresh: refreshCounts } = useStudioCounts()
const { roles } = useRolesAndTeams()

const ALL = 'all'
/** « Tous les rôles de terrain »: no role. A select can't hold null, so 0 stands for it. */
const EVERY = 0

const list = useStudioList<Materiel, { role: number | 'none' | null }>(
  ({ page, perPage, search, sort, filters }) => fetchMateriels({
    page,
    per_page: perPage,
    include: 'role',
    sort,
    'filter[name]': search || undefined,
    'filter[role_id]': filters.role ?? undefined,
  }),
  { role: null },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const roleFilter = computed({
  get: () => (filters.role === 'none' ? EVERY : filters.role ?? ALL),
  set: value => { filters.role = value === ALL || value == null ? null : Number(value) === EVERY ? 'none' : Number(value) },
})

const panel = useRecordPanel<Materiel, { name: string; role_id: number }>({
  toForm: row => ({ name: row?.name ?? '', role_id: row ? row.role_id ?? EVERY : typeof filters.role === 'number' ? filters.role : EVERY }),
  create: form => createMateriel({ name: form.name, role_id: form.role_id || null }),
  update: (row, form) => updateMateriel(row.id, { name: form.name, role_id: form.role_id || null }),
  remove: row => deleteMateriel(row.id),
  recordName: row => row.name,
  onChange: () => {
    list.reload()
    refreshCounts()
  },
})
const { open, record, form, errors, saving } = panel
const canEdit = computed(() => (record.value ? auth.can('materiels.update') : auth.can('materiels.create')))

const roleOptions = computed(() => [{ value: EVERY, label: t('fieldSetup.allFieldRoles') }, ...roles.value])
const roleOf = (row: Materiel) => (row.role ? roleLabel(row.role.name) : t('fieldSetup.allFieldRoles'))
const used = computed(() => (record.value?.distributions_count ?? 0) > 0)
const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('fieldSetup.columns.materiel'), sortKey: 'name' },
  { key: 'role', label: t('fieldSetup.columns.role') },
  { key: 'distributions_count', label: t('fieldSetup.columns.distributions'), align: 'end' as const },
  added.column,
]
</script>

<template>
  <StudioListPage
    :section="fieldSection"
    :title="t('fieldSetup.title.materiels')"
    :add-label="auth.can('materiels.create') ? t('fieldSetup.add.materiels') : undefined"
    @add="panel.show(null)"
  >
    <div class="flex flex-wrap gap-2.5">
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('fieldSetup.search.materiels')"
        :placeholder="t('fieldSetup.search.materiels')"
        hide-label
        class="w-full sm:max-w-xs"
      />
      <DlSelect
        v-model="roleFilter"
        :label="t('fieldSetup.columns.role')"
        :options="[{ value: ALL, label: t('fieldSetup.filter.allRoles') }, ...roleOptions]"
        appearance="filter"
      />
    </div>

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('fieldSetup.title.materiels')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search || filters.role != null ? t('geo.empty.search') : t('fieldSetup.empty.materiels')"
      @open="panel.show"
    >
      <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
      <template #cell-role="{ row }"><span :class="!row.role && 'font-semibold text-dl-fg'">{{ roleOf(row) }}</span></template>
      <template #cell-distributions_count="{ row }">{{ row.distributions_count == null ? '—' : n(row.distributions_count) }}</template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ row.name }}</strong>
        <span class="text-xs text-dl-muted">{{ roleOf(row) }} · {{ t('fieldSetup.meta.distributions', row.distributions_count ?? 0) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <DlRecordPanel
        v-model:open="open"
        :title="record?.name ?? t('fieldSetup.add.materiels')"
        :description="record ? roleOf(record) : undefined"
      >
        <form id="materiel-form" class="flex flex-col gap-5" @submit.prevent="panel.save">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" :disabled="!canEdit" required />
          <div class="flex flex-col gap-1">
            <DlSelect v-model="form.role_id" :label="t('fieldSetup.columns.role')" :options="roleOptions" :disabled="!canEdit" />
            <p v-if="errors.role_id" class="text-xs text-dl-rejected">{{ errors.role_id }}</p>
            <p class="text-xs text-dl-muted">{{ t('fieldSetup.roleHint') }}</p>
          </div>
          <div v-if="record" class="rounded-2xl bg-dl-mist px-4 py-3">
            <p class="text-xs text-dl-muted">{{ t('fieldSetup.columns.distributions') }}</p>
            <p class="text-sm font-semibold tabular-nums">{{ n(record.distributions_count ?? 0) }}</p>
            <p v-if="used" class="mt-1 text-xs text-dl-muted">{{ t('fieldSetup.materielUsed') }}</p>
          </div>
        </form>
        <template v-if="canEdit || (record && auth.can('materiels.delete'))" #footer>
          <DlButton v-if="canEdit" type="submit" form="materiel-form" variant="dark" :loading="saving" class="flex-1">
            {{ record ? t('geo.save') : t('fieldSetup.add.materiels') }}
          </DlButton>
          <DlButton v-if="record && auth.can('materiels.delete')" variant="outline" @click="panel.destroy">
            {{ t('common.actions.delete') }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
