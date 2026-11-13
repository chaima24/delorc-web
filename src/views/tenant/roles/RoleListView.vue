<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { rolesApi, type Role } from '@/api/tenant/roles'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlMenu from '@/components/DlMenu.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSelect from '@/components/DlSelect.vue'
import AccessLevelDots from '@/components/AccessLevelDots.vue'
import { summarize, useAccessLabels, useAccessOverview } from '@/views/tenant/settings/access/useAccess'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { accessSection } from '@/views/tenant/settings/shared/studioSections'
import {
  STUDIO_DEFAULT_SORT,
  useAddedColumn,
  useRecordPanel,
  useStudioCounts,
  useStudioList,
} from '@/views/tenant/settings/shared/useStudioList'

// Built-in roles (the starting roles) and the lab's own. The panel sums a role's access up by area;
// "Edit access" opens the full page. Mockup: docs/design/studio-mockups/AccessSecurity.html
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const { refresh: refreshCounts } = useStudioCounts()
const { overview, areas, load: reloadOverview } = useAccessOverview()
const labels = useAccessLabels()

// Every role at once (a lab has a few): search, filter and sort happen here.
const list = useStudioList<Role, { kind: string | null }>({
  load: rolesApi.list,
  matches: (role, search, filters) =>
    (!search || roleLabel(role.name).toLocaleLowerCase().includes(search) || role.name.includes(search))
    && (filters.kind == null || role.built_in === (filters.kind === 'built_in')),
  sortValues: { id: role => role.id, name: role => roleLabel(role.name) },
}, { kind: null })
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const kindFilter = computed({
  get: () => filters.kind ?? 'all',
  set: value => { filters.kind = value === 'all' || value == null ? null : String(value) },
})
const kindOptions = computed(() => [
  { value: 'all', label: t('access.filter.allKinds') },
  { value: 'built_in', label: t('access.kind.builtIn') },
  { value: 'lab', label: t('access.kind.lab') },
])

const isAdmin = (role: Role) => role.name === 'admin'
const summaryOf = (role: Role) => summarize(areas.value, new Set(role.permissions))
function accessText(role: Role) {
  if (isAdmin(role)) return t('access.level.everything')
  const summary = summaryOf(role)
  return summary.actions
    ? t('access.summary', { areas: t('access.areaCount', summary.areas), actions: t('access.actionCount', summary.actions) })
    : t('access.level.none')
}

const panel = useRecordPanel<Role, { name: string; copy_from: number | null }>({
  toForm: role => ({ name: role?.name ?? '', copy_from: null }),
  // A copy of the source role: same rights, what it sees and visits, with a new name.
  create: form => rolesApi.create({
    name: form.name,
    sees: source.value?.sees ?? 'own',
    is_field: source.value?.is_field ?? false,
    visits: source.value?.visits ?? [],
    permissions: overview.value?.roles.find(role => role.id === form.copy_from)?.permission_ids ?? [],
  }),
  update: (role, form) => rolesApi.update(role, { name: form.name }),
  remove: role => rolesApi.remove(role.id),
  recordName: role => roleLabel(role.name),
  onChange: () => {
    list.reload()
    refreshCounts()
    reloadOverview()
  },
  reload: role => rolesApi.get(role.id),
})
const { open, record, form, errors, saving } = panel

// New roles are made by duplicating one ("like VM, but…"): there is no empty "Add role".
// Built-in roles cannot be deleted; a role people still have is refused by the API (409).
const canDuplicate = computed(() => !!record.value && !isAdmin(record.value) && auth.can('roles.create'))
const menuItems = computed(() => record.value && !record.value.built_in && auth.can('roles.delete')
  ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: () => panel.destroy() }]
  : [])

/** Opens "Create role" with the same access as `role`. */
const source = ref<Role | null>(null)
function duplicate(role: Role) {
  source.value = role
  panel.show(null)
  form.value = { name: t('access.add.copyName', { name: roleLabel(role.name) }), copy_from: role.id }
}

const editingName = ref(false)
const showPeople = ref(false)
watch(record, () => {
  editingName.value = false
  showPeople.value = false
  editingVisits.value = false
})

// Visits: the kinds of professionals the role's people visit (objectives, filling cycles).
const KINDS = ['doctor', 'dentiste', 'pharmacie', 'wholestore', 'distributor']
const editingVisits = ref(false)
const visitsDraft = ref<string[]>([])
const savingVisits = ref(false)
watch(editingVisits, value => {
  if (value) visitsDraft.value = [...(record.value?.visits ?? [])]
})
const visitsText = computed(() => (record.value?.visits ?? []).map(kind => t(`objectives.kinds.${kind}`)).join(', '))
async function saveVisits() {
  if (!record.value) return
  savingVisits.value = true
  try {
    const visits = KINDS.filter(kind => visitsDraft.value.includes(kind))
    await rolesApi.update(record.value, { visits })
    record.value = { ...record.value, visits }
    editingVisits.value = false
    list.reload()
  }
  finally {
    savingVisits.value = false
  }
}
async function saveName() {
  if (await panel.save()) editingName.value = false
}
function cancelName() {
  panel.reset()
  editingName.value = false
}

function openAccess(role: Role) {
  router.push({ name: 'tenant-role-access', params: { id: role.id } })
}

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('access.columns.role'), sortKey: 'name' },
  { key: 'users_count', label: t('access.columns.people'), align: 'end' as const },
  { key: 'access', label: t('access.columns.access') },
  { ...added.column, secondary: true },
]
</script>

<template>
  <StudioListPage
    :section="accessSection"
    :title="t('access.title.roles')"
  >
    <div class="flex flex-wrap gap-2.5">
      <DlInput
        v-model="search"
        type="search"
        icon="tabler-search"
        :label="t('access.search.roles')"
        :placeholder="t('access.search.roles')"
        hide-label
        class="w-full sm:max-w-xs"
      />
      <DlSelect v-model="kindFilter" :label="t('access.columns.kind')" :options="kindOptions" appearance="filter" />
    </div>

    <DlDataList
      v-model:sort="sort"
      :default-sort="STUDIO_DEFAULT_SORT"
      :label="t('access.title.roles')"
      :columns="columns"
      :rows="items"
      :row-key="row => row.id"
      :selected-key="record?.id"
      :loading="loading"
      :compact="open"
      :empty-title="search || filters.kind ? t('geo.empty.search') : t('access.empty.roles')"
      @open="panel.show"
    >
      <template #cell-name="{ row }">
        <span class="flex flex-wrap items-center gap-2">
          <strong class="font-semibold">{{ roleLabel(row.name) }}</strong>
          <DlBadge size="sm" :tone="row.built_in ? 'neutral' : 'info'">{{ t(row.built_in ? 'access.kind.builtIn' : 'access.kind.lab') }}</DlBadge>
        </span>
      </template>
      <template #cell-users_count="{ row }">{{ n(row.users_count ?? 0) }}</template>
      <template #cell-access="{ row }">
        <span class="flex items-center gap-2.5 whitespace-nowrap">
          <AccessLevelDots :level="isAdmin(row) ? 'full' : summaryOf(row).level" :label="labels.level(isAdmin(row) ? 'full' : summaryOf(row).level)" />
          {{ accessText(row) }}
        </span>
      </template>
      <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
      <template #card="{ row }">
        <strong class="block font-semibold">{{ roleLabel(row.name) }}</strong>
        <span class="text-xs text-dl-muted">{{ t('access.peopleCount', { count: n(row.users_count ?? 0) }, row.users_count ?? 0) }} · {{ accessText(row) }}</span>
      </template>
    </DlDataList>

    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />

    <template #panel>
      <!-- Reading mode -->
      <DlRecordPanel v-if="record" v-model:open="open" :title="roleLabel(record.name)">
        <template #badges>
          <span class="mt-1 flex flex-wrap items-center gap-1.5">
            <DlBadge size="sm" :tone="record.built_in ? 'neutral' : 'info'">{{ t(record.built_in ? 'access.kind.builtIn' : 'access.kind.lab') }}</DlBadge>
          </span>
        </template>
        <template v-if="canDuplicate || menuItems.length" #actions>
          <button
            v-if="canDuplicate"
            type="button"
            class="flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-dl-line px-3 text-sm font-semibold hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
            @click="duplicate(record)"
          >
            <DlIcon icon="tabler-copy" :size="17" />{{ t('access.menu.duplicate') }}
          </button>
          <DlMenu v-if="menuItems.length" :label="t('fieldSetup.menu.label')" :items="menuItems" />
        </template>

        <div class="flex flex-col gap-3.5">
          <dl class="grid grid-cols-2 gap-2">
            <div class="flex flex-col rounded-2xl bg-dl-mist px-3.5 py-2.5">
              <dt class="order-2 text-[11.5px] text-dl-muted">{{ t('access.read.people') }}</dt>
              <dd class="font-display text-2xl font-extrabold">{{ n(record.users_count ?? 0) }}</dd>
            </div>
            <div class="flex flex-col rounded-2xl bg-dl-mist px-3.5 py-2.5">
              <dt class="order-2 text-[11.5px] text-dl-muted">{{ isAdmin(record) ? t('access.read.everything') : t('access.read.actions', { areas: summaryOf(record).areas }) }}</dt>
              <dd class="font-display text-2xl font-extrabold">{{ isAdmin(record) ? '∞' : n(summaryOf(record).actions) }}</dd>
            </div>
          </dl>

          <section class="rounded-2xl border border-dl-line" :aria-label="t('access.read.access')">
            <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
              <h3 class="flex-1 text-sm font-semibold">{{ t('access.read.access') }}</h3>
              <DlButton v-if="!isAdmin(record) && auth.can('roles.update')" variant="dark" size="sm" icon="tabler-arrow-up-right" @click="openAccess(record)">
                {{ t('access.read.editAccess') }}
              </DlButton>
            </header>
            <p v-if="isAdmin(record)" class="px-3.5 pb-3 text-[13px] text-dl-body">{{ t('access.read.adminHint') }}</p>
            <ul v-else class="pb-1.5">
              <li
                v-for="row in summaryOf(record).rows"
                :key="row.key"
                class="flex items-center gap-2.5 border-t border-dl-line-soft px-3.5 py-2 text-[13px]"
              >
                <span class="flex-1">{{ labels.area(row.key) }}</span>
                <AccessLevelDots :level="row.level" :label="labels.level(row.level)" />
                <span class="w-28 text-end text-xs text-dl-muted">{{ labels.level(row.level) }}</span>
              </li>
            </ul>
          </section>

          <section class="rounded-2xl border border-dl-line px-3.5 py-3" :aria-label="t('access.read.peopleTitle')">
            <h3 class="text-sm font-semibold">{{ t('access.read.peopleTitle') }}</h3>
            <p class="mt-1 text-[13px] text-dl-body">
              {{ t('access.peopleCount', { count: n(record.users_count ?? 0) }, record.users_count ?? 0) }}
              <template v-if="record.users?.length">
                ·
                <button type="button" class="font-semibold text-dl-cobalt hover:underline" :aria-expanded="showPeople" @click="showPeople = !showPeople">
                  {{ showPeople ? t('rulesSetup.coverage.hide') : t('rulesSetup.who.seeThem') }}
                </button>
              </template>
            </p>
            <ul v-if="showPeople" class="mt-2 flex flex-wrap gap-1.5">
              <li v-for="user in record.users" :key="user.id" class="rounded-full border border-dl-line px-2.5 py-1 text-xs">{{ user.name }}</li>
            </ul>
          </section>

          <DlRecordSection
            v-if="!isAdmin(record)"
            v-model:editing="editingVisits"
            :title="t('access.read.visits')"
            icon="tabler-stethoscope"
            :can-edit="auth.can('roles.update')"
            :saving="savingVisits"
            @save="saveVisits"
            @cancel="editingVisits = false"
          >
            <p>{{ visitsText || t('access.read.visitsNone') }}</p>
            <p class="mt-1 text-xs text-dl-muted">{{ t('access.read.visitsHint') }}</p>
            <template #edit>
              <fieldset class="flex flex-col gap-2">
                <legend class="sr-only">{{ t('access.read.visits') }}</legend>
                <label v-for="kind in KINDS" :key="kind" class="flex items-center gap-2.5 text-[13.5px]">
                  <input v-model="visitsDraft" type="checkbox" :value="kind" class="h-[18px] w-[18px] accent-[#0F1F1C] dark:accent-[#C8F03C]">
                  <span class="first-letter:uppercase">{{ t(`objectives.kinds.${kind}`) }}</span>
                </label>
              </fieldset>
            </template>
          </DlRecordSection>

          <DlRecordSection
            v-model:editing="editingName"
            :title="t('access.read.name')"
            icon="tabler-tag"
            :can-edit="!record.built_in && auth.can('roles.update')"
            :saving="saving"
            @save="saveName"
            @cancel="cancelName"
          >
            <template v-if="record.built_in">{{ t('access.read.builtInHint') }}</template>
            <template v-else>{{ record.name }}</template>
            <template #edit>
              <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" required />
            </template>
          </DlRecordSection>
        </div>
      </DlRecordPanel>

      <!-- Duplicate -->
      <DlRecordPanel
        v-else
        v-model:open="open"
        :title="t('access.add.duplicateTitle', { name: source ? roleLabel(source.name) : '' })"
        :description="t('access.add.duplicateHint')"
      >
        <form id="role-add" class="flex flex-col gap-4" @submit.prevent="panel.save">
          <DlInput v-model="form.name" :label="t('geo.fields.name')" :error="errors.name" required />
        </form>
        <template #footer>
          <DlButton variant="outline" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
          <DlButton type="submit" form="role-add" variant="primary" :loading="saving" class="flex-1">{{ t('access.add.save') }}</DlButton>
        </template>
      </DlRecordPanel>
    </template>
  </StudioListPage>
</template>
