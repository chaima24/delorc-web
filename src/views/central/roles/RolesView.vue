<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { rolesApi, type PermissionCatalog, type Role } from '@/api/central/roles'
import AccessLevelDots from '@/components/AccessLevelDots.vue'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useAccessLabels } from '@/composables/useAccessLabels'
import { useAuthStore } from '@/stores/auth'
import UsersRolesTabs from '../UsersRolesTabs.vue'
import { areaLevel } from './access'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const { roleLabel, areaLabel } = useAccessLabels()

const roles = ref<Role[]>([])
const catalog = ref<PermissionCatalog>({})
const selected = ref<Role | null>(null)
const adding = ref(false)
const name = ref('')
const renaming = ref(false)
const confirmingDelete = ref(false)
const nameError = ref<string | undefined>()
const error = ref<string | null>(null)
const busy = ref(false)

const panelOpen = computed({
  get: () => selected.value !== null,
  set: (open) => {
    if (!open) selected.value = null
  },
})

const overall = (role: Role) => {
  if (role.is_super) return 'full'
  const levels = Object.values(catalog.value).map((resources) => areaLevel(resources, role.permissions))
  if (levels.every((level) => level === 'none')) return 'none'

  return levels.some((level) => level === 'some' || level === 'full') ? 'some' : 'view'
}

async function load(): Promise<void> {
  error.value = null
  try {
    ;[roles.value, catalog.value] = await Promise.all([rolesApi.list(), rolesApi.catalog()])
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
}

onMounted(load)

function open(role: Role): void {
  adding.value = false
  selected.value = role
  name.value = role.name
  renaming.value = false
  confirmingDelete.value = false
  nameError.value = undefined
}

function startAdding(): void {
  selected.value = null
  adding.value = true
  name.value = ''
  nameError.value = undefined
}

async function add(): Promise<void> {
  busy.value = true
  nameError.value = undefined
  try {
    const role = await rolesApi.create({ name: name.value, permissions: [] })
    router.push({ name: 'central-role-access', params: { id: role.id } })
  } catch (failure) {
    nameError.value = fieldErrors(failure).name ?? errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}

async function rename(): Promise<void> {
  if (!selected.value) return
  busy.value = true
  nameError.value = undefined
  try {
    const role = await rolesApi.update(selected.value.id, { name: name.value, permissions: selected.value.permissions })
    await load()
    open(roles.value.find((item) => item.id === role.id) ?? role)
  } catch (failure) {
    nameError.value = fieldErrors(failure).name ?? errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}

async function remove(): Promise<void> {
  if (!selected.value) return
  busy.value = true
  try {
    await rolesApi.remove(selected.value.id)
    selected.value = null
    await load()
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex items-end justify-between gap-3">
        <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.roles.title') }}</h1>
        <DlButton v-if="auth.can('roles.create')" variant="primary" icon="tabler-plus" @click="startAdding">{{ t('central.roles.add') }}</DlButton>
      </div>
      <UsersRolesTabs />
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <div class="overflow-x-auto rounded-3xl bg-dl-paper p-4">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-dl-line text-xs text-dl-muted">
              <th class="p-3 text-start font-semibold">{{ t('central.roles.role') }}</th>
              <th class="p-3 text-end font-semibold">{{ t('central.roles.people') }}</th>
              <th class="p-3 text-start font-semibold">{{ t('central.roles.access') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="role in roles"
              :key="role.id"
              class="cursor-pointer border-b border-dl-line-soft hover:bg-dl-line-soft"
              :class="selected?.id === role.id && 'bg-dl-signal-soft'"
              tabindex="0"
              @click="open(role)"
              @keydown.enter="open(role)"
            >
              <td class="p-3"><strong>{{ roleLabel(role.name) }}</strong> <DlBadge v-if="role.is_super" tone="info" size="sm" class="ms-1.5">{{ t('central.roles.protected') }}</DlBadge></td>
              <td class="p-3 text-end tabular-nums">{{ role.users_count }}</td>
              <td class="p-3">
                <span class="flex items-center gap-2"><AccessLevelDots :level="overall(role)" />{{ role.is_super ? t('access.everything') : t('access.actionsCount', { count: role.permissions.length }) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <DlRecordPanel v-if="selected" v-model:open="panelOpen" :title="roleLabel(selected.name)">
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5"><b class="font-display text-2xl font-extrabold">{{ selected.users_count }}</b><span class="text-xs text-dl-muted">{{ t('central.roles.peopleHave') }}</span></div>
          <div class="flex flex-col rounded-2xl bg-dl-mist px-3 py-2.5"><b class="font-display text-2xl font-extrabold">{{ selected.is_super ? t('access.all') : selected.permissions.length }}</b><span class="text-xs text-dl-muted">{{ t('central.roles.actionsAllowed') }}</span></div>
        </div>

        <template v-if="selected.is_super">
          <p class="text-xs text-dl-muted">{{ t('central.roles.protectedHint') }}</p>
        </template>
        <template v-else>
          <section class="rounded-2xl border border-dl-line">
            <header class="flex items-center justify-between px-3.5 pb-1.5 pt-3">
              <h3 class="text-sm font-semibold">{{ t('central.roles.access') }}</h3>
              <DlButton v-if="auth.can('roles.update')" size="sm" icon-end="tabler-arrow-up-right" :to="{ name: 'central-role-access', params: { id: selected.id } }">{{ t('central.roles.editAccess') }}</DlButton>
            </header>
            <div v-for="(resources, area) in catalog" :key="area" class="flex items-center gap-2.5 border-t border-dl-line-soft px-3.5 py-2 text-[13px]">
              <span class="flex-1">{{ areaLabel(String(area)) }}</span>
              <AccessLevelDots :level="areaLevel(resources, selected.permissions)" />
            </div>
          </section>

          <DlRecordSection v-model:editing="renaming" :title="t('central.roles.name')" :can-edit="auth.can('roles.update')" :saving="busy" @save="rename" @cancel="renaming = false">
            {{ selected.name }}
            <template #edit><DlInput v-model="name" :label="t('central.roles.name')" hide-label :error="nameError" /></template>
          </DlRecordSection>

          <DlRecordSection v-if="auth.can('roles.delete')" :title="t('common.actions.delete')" :can-edit="false">
            <template v-if="selected.users_count > 0">{{ t('central.roles.inUse', { count: selected.users_count }) }}</template>
            <div v-else class="flex gap-2">
              <DlButton v-if="!confirmingDelete" variant="outline" size="sm" @click="confirmingDelete = true">{{ t('common.actions.delete') }}</DlButton>
              <template v-else>
                <DlButton variant="danger" size="sm" :loading="busy" @click="remove">{{ t('central.roles.deleteConfirm') }}</DlButton>
                <DlButton variant="ghost" size="sm" @click="confirmingDelete = false">{{ t('common.actions.cancel') }}</DlButton>
              </template>
            </div>
          </DlRecordSection>
        </template>
      </div>
    </DlRecordPanel>

    <DlRecordPanel v-if="adding" v-model:open="adding" :title="t('central.roles.add')">
      <form id="add-role" @submit.prevent="add">
        <DlInput v-model="name" :label="t('central.roles.name')" :error="nameError" required />
      </form>
      <template #footer>
        <DlButton type="submit" form="add-role" variant="primary" :loading="busy">{{ t('central.roles.addSubmit') }}</DlButton>
        <DlButton variant="ghost" @click="adding = false">{{ t('common.actions.cancel') }}</DlButton>
      </template>
    </DlRecordPanel>
  </div>
</template>
