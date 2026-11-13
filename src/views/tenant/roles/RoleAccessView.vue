<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, RouterLink } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { rolesApi } from '@/api/tenant/roles'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { MAIN_ACTIONS, areaIds, resourceIds, type AccessResource, type MainAction } from '@/views/tenant/settings/access/accessCatalog'
import { useAccessLabels, useAccessOverview } from '@/views/tenant/settings/access/useAccess'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

// A role's access on a full page: one row per resource, grouped by area, with View / Add /
// Edit / Delete. Changes collect in the bar at the bottom until "Save access".
// Mockup: docs/design/studio-mockups/AccessSecurity.html
const props = defineProps<{ id: string }>()

const { t, n } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const { overview, areas, failed, load } = useAccessOverview()
const labels = useAccessLabels()

const role = computed(() => overview.value?.roles.find(r => r.id === Number(props.id)) ?? null)
const isAdmin = computed(() => role.value?.name === 'admin')
const editable = computed(() => !!role.value && !isAdmin.value && auth.can('roles.update'))

const saved = ref(new Set<string>())
const granted = ref(new Set<string>())
watch(role, value => {
  saved.value = new Set(value?.permission_ids ?? [])
  granted.value = new Set(saved.value)
}, { immediate: true })

// ── Editing ─────────────────────────────────────────────────────────────────
function set(ids: string[], on: boolean) {
  const next = new Set(granted.value)
  for (const id of ids) {
    if (on) next.add(id)
    else next.delete(id)
  }
  granted.value = next
}

/** Any change needs View; removing View removes everything else on the resource. */
function toggle(resource: AccessResource, id: string, action: string) {
  const on = !granted.value.has(id)
  const view = resource.main.show
  if (action === 'show' && !on) return set(resourceIds(resource), false)
  set(on && view != null ? [id, view] : [id], on)
}

const search = ref('')
const areaFilter = ref<string | number>('all')
const areaOptions = computed(() => [
  { value: 'all', label: t('access.filter.allAreas') },
  ...areas.value.map(area => ({ value: area.key, label: labels.area(area.key) })),
])
const visibleAreas = computed(() => {
  const term = search.value.trim().toLowerCase()
  return areas.value
    .filter(area => areaFilter.value === 'all' || area.key === areaFilter.value)
    .map(area => ({
      ...area,
      resources: term ? area.resources.filter(r => labels.resource(r.key).toLowerCase().includes(term)) : area.resources,
    }))
    .filter(area => area.resources.length)
})

const copyFrom = ref<string | number | null>(null)
const copyOptions = computed(() => (overview.value?.roles ?? [])
  .filter(r => r.id !== role.value?.id && r.name !== 'admin')
  .map(r => ({ value: r.id, label: roleLabel(r.name) })))
watch(copyFrom, async value => {
  const source = overview.value?.roles.find(r => r.id === Number(value))
  if (!source) return
  const ok = await confirm({
    title: t('access.copy.title', { name: roleLabel(source.name) }),
    text: t('access.copy.text'),
    confirmButtonText: t('access.copy.confirm'),
  })
  if (ok) granted.value = new Set(source.permission_ids)
  copyFrom.value = null
})

// ── Changes and save ────────────────────────────────────────────────────────
const changes = computed(() => {
  const added = [...granted.value].filter(id => !saved.value.has(id))
  const removed = [...saved.value].filter(id => !granted.value.has(id))
  return { added, removed, count: added.length + removed.length }
})
/** "Expense notes: can now edit" for the first change. */
const firstChange = computed(() => {
  const id = changes.value.added[0] ?? changes.value.removed[0]
  const name = id // a permission is its name: `expenses.update`
  if (!name) return ''
  const [resource, ...rest] = name.split('.')
  const action = rest.join('.')
  return t(changes.value.added[0] != null ? 'access.change.added' : 'access.change.removed', {
    resource: labels.resource(resource ?? ''),
    action: labels.action(action).toLowerCase(),
  })
})

const saving = ref(false)
async function save() {
  if (!role.value) return
  saving.value = true
  try {
    // The API wants the whole role: read it, then send it back with the new rights.
    await rolesApi.update(await rolesApi.get(role.value.id), { permissions: [...granted.value] })
    toast.success(t('access.saved'))
    await load()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
function undo() {
  granted.value = new Set(saved.value)
}

onBeforeRouteLeave(async () => {
  if (!changes.value.count) return true
  return confirm({
    title: t('access.leave.title'),
    text: t('access.leave.text', changes.value.count),
    confirmButtonText: t('access.leave.confirm'),
    icon: 'warning',
  })
})

const ticked = (ids: string[]) => ids.filter(id => granted.value.has(id)).length
</script>

<template>
  <div class="flex w-full flex-col gap-5 pb-24">
    <div class="flex flex-col gap-1.5">
      <nav :aria-label="t('common.breadcrumb.ariaLabel')" class="flex flex-wrap items-center gap-1.5 text-sm text-dl-muted">
        <RouterLink :to="{ name: 'tenant-settings' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('nav.settings') }}</RouterLink>
        <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
        <span>{{ t('settings.groups.access.title') }}</span>
        <DlIcon icon="tabler-chevron-right" :size="14" class="rtl:-scale-x-100" />
        <RouterLink :to="{ name: 'tenant-roles' }" class="text-dl-muted no-underline hover:text-dl-fg">{{ t('access.title.roles') }}</RouterLink>
      </nav>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">
        {{ role ? t('access.page.title', { name: roleLabel(role.name) }) : t('access.title.roles') }}
      </h1>
    </div>

    <div v-if="!overview && !failed" class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-5" aria-hidden="true">
      <DlSkeleton v-for="i in 8" :key="i" class="h-10 rounded-xl" />
    </div>
    <p v-else-if="failed || !role" class="rounded-3xl bg-dl-paper p-5 text-sm text-dl-rejected">{{ t(failed ? 'studio.list.toast.failed' : 'access.page.notFound') }}</p>

    <div v-else class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
      <p v-if="isAdmin" class="rounded-2xl bg-dl-signal-soft px-4 py-3 text-sm">{{ t('access.read.adminHint') }}</p>

      <div class="flex flex-wrap items-center gap-2.5">
        <DlInput
          v-model="search"
          type="search"
          icon="tabler-search"
          :label="t('access.search.resources')"
          :placeholder="t('access.search.resources')"
          hide-label
          class="w-full sm:max-w-xs"
        />
        <DlSelect v-model="areaFilter" :label="t('access.columns.area')" :options="areaOptions" appearance="filter" />
        <DlSelect v-if="editable" v-model="copyFrom" :label="t('access.copy.label')" :options="copyOptions" :placeholder="'…'" appearance="filter" />
        <span class="ms-auto text-xs text-dl-muted">{{ t('access.peopleHave', { count: n(role.users_count ?? 0) }, role.users_count ?? 0) }}</span>
      </div>

      <div class="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table class="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th class="border-b border-dl-line px-3 py-2.5 text-start text-xs font-semibold text-dl-muted">{{ t('access.columns.resource') }}</th>
              <th v-for="action in MAIN_ACTIONS" :key="action" class="w-20 border-b border-dl-line px-2 py-2.5 text-center text-xs font-semibold text-dl-muted">{{ labels.action(action) }}</th>
            </tr>
          </thead>
          <tbody v-for="area in visibleAreas" :key="area.key">
            <tr>
              <th colspan="5" scope="colgroup" class="bg-dl-mist px-3 py-2.5 text-start">
                <span class="flex flex-wrap items-center gap-2">
                  <span class="text-[13px] font-bold">{{ labels.area(area.key) }}</span>
                  <span class="text-xs font-medium text-dl-muted">{{ t('access.page.ticked', { on: ticked(areaIds(area)), all: areaIds(area).length }) }}</span>
                  <span v-if="editable" class="ms-auto flex gap-3 text-xs font-semibold">
                    <button type="button" class="text-dl-cobalt hover:underline" @click="set(areaIds(area), true)">{{ t('access.page.tickAll') }}</button>
                    <button type="button" class="text-dl-muted hover:text-dl-fg hover:underline" @click="set(areaIds(area), false)">{{ t('access.page.clear') }}</button>
                  </span>
                </span>
              </th>
            </tr>
            <tr v-for="resource in area.resources" :key="resource.key">
              <th scope="row" class="border-b border-dl-line-soft px-3 py-2 text-start font-normal">
                {{ labels.resource(resource.key) }}
                <span v-if="resource.extra.length" class="mt-1 flex flex-wrap gap-1.5">
                  <label
                    v-for="extra in resource.extra"
                    :key="extra.id"
                    class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
                    :class="granted.has(extra.id) ? 'border-dl-fg bg-dl-ink text-dl-on-ink' : 'border-dl-line text-dl-body'"
                  >
                    <input type="checkbox" class="sr-only" :checked="granted.has(extra.id)" :disabled="!editable" @change="toggle(resource, extra.id, extra.action)">
                    {{ labels.action(extra.action) }}
                  </label>
                </span>
              </th>
              <td v-for="action in MAIN_ACTIONS" :key="action" class="border-b border-dl-line-soft px-2 py-2 text-center">
                <input
                  v-if="resource.main[action as MainAction] != null"
                  type="checkbox"
                  class="h-5 w-5 cursor-pointer accent-dl-ink disabled:cursor-default"
                  :aria-label="`${labels.resource(resource.key)} · ${labels.action(action)}`"
                  :checked="granted.has(resource.main[action as MainAction]!)"
                  :disabled="!editable"
                  :class="(granted.has(resource.main[action as MainAction]!) !== saved.has(resource.main[action as MainAction]!)) && 'outline-3 outline-offset-1 outline-dl-signal'"
                  @change="toggle(resource, resource.main[action as MainAction]!, action)"
                >
                <span v-else class="text-dl-line" aria-hidden="true">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!visibleAreas.length" class="px-3 py-4 text-sm text-dl-muted">{{ t('geo.empty.search') }}</p>
    </div>

    <!-- Unsaved changes -->
    <div
      v-if="changes.count"
      class="fixed inset-x-4 bottom-24 z-800 flex flex-wrap items-center gap-3 rounded-2xl bg-dl-ink py-2.5 ps-4 pe-2.5 text-sm text-dl-on-ink shadow-lg md:sticky md:inset-x-auto md:bottom-4"
      role="status"
    >
      <span class="min-w-0 flex-1">
        <strong>{{ t('access.change.count', changes.count) }}</strong>
        <span class="text-dl-on-ink-muted"> · {{ firstChange }}</span>
      </span>
      <DlButton variant="ghost" size="sm" class="text-dl-on-ink" @click="undo">{{ t('access.change.undo') }}</DlButton>
      <DlButton variant="primary" size="sm" :loading="saving" @click="save">{{ t('access.change.save') }}</DlButton>
    </div>
  </div>
</template>
