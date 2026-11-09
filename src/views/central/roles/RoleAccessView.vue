<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { rolesApi, type PermissionCatalog, type Role } from '@/api/central/roles'
import DlAlert from '@/components/DlAlert.vue'
import DlButton from '@/components/DlButton.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAccessLabels } from '@/composables/useAccessLabels'
import { useAuthStore } from '@/stores/auth'
import { MAIN_ACTIONS, permissionsOf, toggle } from './access'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { roleLabel, areaLabel, resourceLabel, actionLabel } = useAccessLabels()

const role = ref<Role | null>(null)
const roles = ref<Role[]>([])
const catalog = ref<PermissionCatalog>({})
const granted = ref<string[]>([])
const copyFrom = ref<number | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)

const saved = computed(() => role.value?.permissions ?? [])
const changes = computed(() =>
  granted.value.filter((name) => !saved.value.includes(name)).length + saved.value.filter((name) => !granted.value.includes(name)).length,
)
const copyOptions = computed(() =>
  roles.value.filter((item) => !item.is_super && item.id !== role.value?.id).map((item) => ({ value: item.id, label: roleLabel(item.name) })),
)

/** You can only give rights you have yourself; a right the role already has may stay or go. */
function mayTick(permission: string): boolean {
  return auth.can(permission) || saved.value.includes(permission)
}

onMounted(async () => {
  try {
    const id = String(route.params.id)
    ;[role.value, roles.value, catalog.value] = await Promise.all([rolesApi.get(id), rolesApi.list(), rolesApi.catalog()])
    granted.value = [...saved.value]
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
})

function tick(permission: string, actions: string[]): void {
  granted.value = toggle(granted.value, permission, actions)
}

function setArea(resources: PermissionCatalog[string], on: boolean): void {
  const names = permissionsOf(resources).filter(mayTick)
  granted.value = on ? [...new Set([...granted.value, ...names])] : granted.value.filter((name) => !names.includes(name))
}

function applyCopy(id: number | string | null | undefined): void {
  const source = roles.value.find((item) => item.id === id)
  if (source) granted.value = source.permissions.filter(mayTick)
}

async function save(): Promise<void> {
  if (!role.value) return
  busy.value = true
  error.value = null
  try {
    await rolesApi.update(role.value.id, { name: role.value.name, permissions: granted.value })
    router.push({ name: 'central-roles' })
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="role" class="flex flex-col gap-4 pb-4">
    <div>
      <RouterLink :to="{ name: 'central-roles' }" class="text-sm text-dl-muted no-underline">{{ t('central.roles.title') }}</RouterLink>
      <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ roleLabel(role.name) }}</h1>
    </div>
    <DlAlert v-if="error">{{ error }}</DlAlert>

    <div class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <DlSelect v-model="copyFrom" :label="t('central.roles.copyFrom')" :options="copyOptions" appearance="filter" @update:model-value="applyCopy" />
        <span v-if="!auth.user?.is_super" class="text-xs text-dl-muted">{{ t('central.roles.onlyYourRights') }}</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] border-collapse text-[13.5px]">
          <thead>
            <tr class="border-b border-dl-line text-xs text-dl-muted">
              <th class="w-1/4 p-2.5 text-start font-semibold">{{ t('central.roles.resource') }}</th>
              <th v-for="action in MAIN_ACTIONS" :key="action" class="p-2.5 font-semibold">{{ actionLabel(action) }}</th>
              <th class="p-2.5 text-start font-semibold">{{ t('central.roles.otherActions') }}</th>
            </tr>
          </thead>
          <tbody v-for="(resources, area) in catalog" :key="area">
            <tr class="bg-dl-mist">
              <td colspan="6" class="p-2.5 text-[13px] font-bold">
                <span class="flex justify-between">
                  {{ areaLabel(String(area)) }}
                  <span class="flex gap-3 text-xs font-medium text-dl-muted">
                    <button type="button" @click="setArea(resources, true)">{{ t('central.roles.tickAll') }}</button>
                    <button type="button" @click="setArea(resources, false)">{{ t('central.roles.clear') }}</button>
                  </span>
                </span>
              </td>
            </tr>
            <tr v-for="(actions, resource) in resources" :key="resource" class="border-b border-dl-line-soft">
              <td class="p-2.5">{{ resourceLabel(String(resource)) }}</td>
              <td v-for="action in MAIN_ACTIONS" :key="action" class="p-2.5 text-center">
                <input
                  v-if="actions.includes(action)"
                  type="checkbox"
                  class="h-5 w-5 accent-dl-ink"
                  :aria-label="`${resourceLabel(String(resource))}: ${actionLabel(action)}`"
                  :checked="granted.includes(`${resource}.${action}`)"
                  :disabled="!mayTick(`${resource}.${action}`)"
                  @change="tick(`${resource}.${action}`, actions)"
                >
                <span v-else class="text-dl-line">—</span>
              </td>
              <td class="p-2.5">
                <span class="flex flex-wrap gap-1">
                  <button
                    v-for="action in actions.filter((item) => !MAIN_ACTIONS.includes(item))"
                    :key="action"
                    type="button"
                    :aria-pressed="granted.includes(`${resource}.${action}`)"
                    :disabled="!mayTick(`${resource}.${action}`)"
                    class="rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                    :class="granted.includes(`${resource}.${action}`) ? 'bg-dl-signal-soft text-dl-fg' : 'bg-dl-line-soft text-dl-body'"
                    @click="tick(`${resource}.${action}`, actions)"
                  >{{ actionLabel(action) }}</button>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="changes" class="sticky bottom-3 flex items-center gap-3 rounded-[18px] bg-dl-ink py-2.5 pe-3 ps-[18px] text-sm text-dl-on-ink">
        <span>{{ t('central.roles.changes', { count: changes }) }}</span>
        <DlButton variant="ghost" size="sm" class="ms-auto text-dl-on-ink! hover:bg-dl-ink-2!" @click="granted = [...saved]">{{ t('central.roles.undo') }}</DlButton>
        <DlButton variant="primary" size="sm" :loading="busy" @click="save">{{ t('central.roles.save') }}</DlButton>
      </div>
    </div>
  </div>
  <DlAlert v-else-if="error">{{ error }}</DlAlert>
</template>
