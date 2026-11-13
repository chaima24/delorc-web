<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import AccessTick from '@/views/tenant/settings/access/AccessTick.vue'
import { MAIN_ACTIONS, type AccessResource, type MainAction } from '@/views/tenant/settings/access/accessCatalog'
import { useAccessLabels, useAccessOverview } from '@/views/tenant/settings/access/useAccess'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import StudioListPage from '@/views/tenant/settings/shared/StudioListPage.vue'
import { accessSection } from '@/views/tenant/settings/shared/studioSections'

// "Who can do what": every resource against every role, read-only. Clicking a role opens its
// access page. Mockup: docs/design/studio-mockups/AccessSecurity.html
const { t } = useI18n()
const { overview, areas, failed } = useAccessOverview()
const labels = useAccessLabels()

// Roles nobody has are hidden unless asked: they only make the grid wider.
const showEmpty = ref(false)
const roles = computed(() => (overview.value?.roles ?? [])
  .filter(role => showEmpty.value || role.built_in || (role.users_count ?? 0) > 0)
  .map(role => ({ ...role, granted: new Set(role.permission_ids) })))
const hiddenRoles = computed(() => (overview.value?.roles.length ?? 0) - roles.value.length)

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
    .map(area => ({ ...area, resources: term ? area.resources.filter(r => labels.resource(r.key).toLowerCase().includes(term)) : area.resources }))
    .filter(area => area.resources.length)
})

/** Whether the role can do this action on the resource; admin can do everything. */
function allowed(resource: AccessResource, action: MainAction, role: { name: string; granted: Set<string> }) {
  const id = resource.main[action]
  return id != null && (role.name === 'admin' || role.granted.has(id))
}
</script>

<template>
  <StudioListPage :section="accessSection" :title="t('access.title.matrix')">
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
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-dl-mist px-4 py-3 text-[13px]">
      <span class="inline-flex items-center gap-1.5 font-semibold"><AccessTick action="show" on />{{ t('access.matrix.allowed') }}</span>
      <span class="inline-flex items-center gap-1.5 text-dl-muted"><AccessTick action="show" :on="false" />{{ t('access.matrix.notAllowed') }}</span>
      <span class="text-dl-body">
        <template v-for="(action, i) in MAIN_ACTIONS" :key="action">
          <template v-if="i"> · </template><strong>{{ t(`access.letter.${action}`) }}</strong> {{ labels.action(action).toLowerCase() }}
        </template>
      </span>
      <span class="inline-flex items-center gap-1.5 text-dl-body md:ms-auto">
        <DlIcon icon="tabler-pointer" :size="16" class="text-dl-cobalt" />
        {{ t('access.matrix.hint') }}
      </span>
    </div>

    <div v-if="!overview && !failed" class="flex flex-col gap-2" aria-hidden="true">
      <DlSkeleton v-for="i in 8" :key="i" class="h-10 rounded-xl" />
    </div>
    <p v-else-if="failed" class="text-sm text-dl-rejected">{{ t('studio.list.toast.failed') }}</p>

    <template v-else>
      <div class="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table class="w-full border-separate border-spacing-0 text-[13.5px]">
          <thead>
            <tr>
              <th class="sticky start-0 z-1 min-w-48 border-b border-dl-line bg-dl-paper px-3 pb-2 pt-3 text-start align-bottom text-xs font-semibold text-dl-muted">{{ t('access.columns.resource') }}</th>
              <th v-for="role in roles" :key="role.id" class="border-b border-s border-dl-line border-s-dl-line-soft px-4 pb-2 pt-3 text-center align-bottom text-xs font-semibold whitespace-nowrap">
                <RouterLink :to="{ name: 'tenant-role-access', params: { id: role.id } }" class="text-dl-fg no-underline hover:text-dl-cobalt hover:underline">
                  {{ roleLabel(role.name) }}
                </RouterLink>
                <span class="mt-2 flex justify-center gap-1.5 text-[11px] font-semibold text-dl-muted" aria-hidden="true">
                  <span v-for="action in MAIN_ACTIONS" :key="action" class="w-4 text-center">{{ t(`access.letter.${action}`) }}</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody v-for="area in visibleAreas" :key="area.key">
            <tr>
              <th :colspan="roles.length + 1" scope="colgroup" class="bg-dl-mist px-3 py-2.5 text-start text-[13px] font-bold">
                <span class="sticky start-3">{{ labels.area(area.key) }}</span>
              </th>
            </tr>
            <tr v-for="resource in area.resources" :key="resource.key">
              <th scope="row" class="sticky start-0 z-1 border-b border-dl-line-soft bg-dl-paper px-3 py-2 text-start font-normal">{{ labels.resource(resource.key) }}</th>
              <td v-for="role in roles" :key="role.id" class="border-b border-s border-dl-line-soft px-4 py-2 text-center">
                <span class="inline-flex gap-1.5">
                  <template v-for="action in MAIN_ACTIONS" :key="action">
                    <AccessTick v-if="resource.main[action] != null" :action="action" :on="allowed(resource, action, role)" />
                    <span v-else class="w-4" aria-hidden="true" />
                  </template>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!visibleAreas.length" class="px-3 py-4 text-sm text-dl-muted">{{ t('geo.empty.search') }}</p>
      <p v-if="hiddenRoles || showEmpty" class="text-xs text-dl-muted">
        <template v-if="!showEmpty">{{ t('access.matrix.hidden', hiddenRoles) }} ·</template>
        <button type="button" class="font-semibold text-dl-cobalt hover:underline" @click="showEmpty = !showEmpty">
          {{ t(showEmpty ? 'access.matrix.hideEmpty' : 'access.matrix.showEmpty') }}
        </button>
      </p>
    </template>
  </StudioListPage>
</template>
