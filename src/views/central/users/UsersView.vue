<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { rolesApi, type Role } from '@/api/central/roles'
import { usersApi, type CentralUser } from '@/api/central/users'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import { useAccessLabels } from '@/composables/useAccessLabels'
import { useAuthStore } from '@/stores/auth'
import AddPersonPanel from './AddPersonPanel.vue'
import PersonPanel from './PersonPanel.vue'

const { t, d } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const { roleLabel } = useAccessLabels()

const users = ref<CentralUser[]>([])
const total = ref(0)
const roles = ref<Role[]>([])
const page = ref(1)
const perPage = ref(25)
const search = ref('')
const roleFilter = ref('all')
const statusFilter = ref('all')
const sort = ref('-created_at')
const error = ref<string | null>(null)
const loading = ref(true)

const selected = ref<CentralUser | null>(null)
const adding = ref(false)

const panelOpen = computed({
  get: () => selected.value !== null,
  set: (open) => {
    if (!open) selected.value = null
  },
})

const roleOptions = computed(() => [
  { value: 'all', label: t('common.list.all') },
  ...roles.value.map((role) => ({ value: role.name, label: roleLabel(role.name) })),
])
const statusOptions = computed(() => [
  { value: 'all', label: t('common.list.all') },
  { value: 'active', label: t('central.users.status.active') },
  { value: 'inactive', label: t('central.users.status.inactive') },
])

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const answer = await usersApi.list({
      search: search.value || undefined,
      role: roleFilter.value === 'all' ? undefined : roleFilter.value,
      is_active: statusFilter.value === 'all' ? undefined : statusFilter.value === 'active',
      sort: sort.value,
    }, page.value, perPage.value)
    users.value = answer.data
    total.value = answer.meta.total
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  } finally {
    loading.value = false
  }
}

function reloadFromFirstPage(): void {
  if (page.value === 1) load()
  else page.value = 1
}

let typing: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(typing)
  typing = setTimeout(reloadFromFirstPage, 300)
})
watch([roleFilter, statusFilter, sort, perPage], reloadFromFirstPage)
watch(page, load)

onMounted(async () => {
  load()
  // The activity log links here with ?open={id}.
  if (route.query.open) usersApi.get(String(route.query.open)).then(open).catch(() => {})
  if (auth.can('roles.show')) roles.value = await rolesApi.list().catch(() => [])
})

function open(user: CentralUser): void {
  adding.value = false
  selected.value = user
}

function startAdding(): void {
  selected.value = null
  adding.value = true
}

function onChanged(user: CentralUser): void {
  selected.value = user
  users.value = users.value.map((row) => (row.id === user.id ? user : row))
}

function onAdded(user: CentralUser): void {
  adding.value = false
  selected.value = user
  load()
}

function statusOf(user: CentralUser): { tone: 'success' | 'warning' | 'neutral'; key: string } {
  if (!user.is_active) return { tone: 'neutral', key: 'inactive' }

  return user.has_password ? { tone: 'success', key: 'active' } : { tone: 'warning', key: 'linkSent' }
}
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex items-end justify-between gap-3">
        <h1 class="font-display text-4xl font-extrabold tracking-[-0.03em]">{{ t('central.users.title') }}</h1>
        <DlButton v-if="auth.can('users.create')" variant="primary" icon="tabler-plus" @click="startAdding">{{ t('central.users.add') }}</DlButton>
      </div>
      <DlAlert v-if="error">{{ error }}</DlAlert>

      <div class="rounded-3xl bg-dl-paper p-4">
        <div class="mb-3 flex flex-wrap gap-2.5">
          <DlInput v-model="search" :label="t('central.users.search')" :placeholder="t('central.users.search')" hide-label icon="tabler-search" class="w-full sm:w-72" />
          <DlSelect v-if="roles.length" v-model="roleFilter" :label="t('central.users.role')" :options="roleOptions" appearance="filter" />
          <DlSelect v-model="statusFilter" :label="t('central.users.statusLabel')" :options="statusOptions" appearance="filter" />
        </div>

        <DlEmptyState v-if="!loading && !users.length" :title="t('central.users.empty')" icon="tabler-users" />
        <div v-else class="overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-dl-line text-start text-xs font-semibold text-dl-muted">
                <DlSortHeader v-model="sort" column="name" :label="t('central.users.person')" />
                <DlSortHeader v-model="sort" column="role" :label="t('central.users.role')" />
                <DlSortHeader v-model="sort" column="status" :label="t('central.users.statusLabel')" />
                <DlSortHeader v-model="sort" column="two_factor_method" :label="t('central.users.secondFactor')" :class="panelOpen || adding ? 'hidden' : 'hidden lg:table-cell'" />
                <DlSortHeader v-model="sort" column="last_login_at" :label="t('central.users.lastLogin')" :class="panelOpen || adding ? 'hidden' : 'hidden lg:table-cell'" />
                <DlSortHeader v-model="sort" column="created_at" :label="t('common.list.createdAt')" :class="panelOpen || adding ? 'hidden' : 'hidden lg:table-cell'" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="user in users"
                :key="user.id"
                class="cursor-pointer border-b border-dl-line-soft hover:bg-dl-line-soft"
                :class="[selected?.id === user.id && 'bg-dl-signal-soft', !user.is_active && 'opacity-55']"
                tabindex="0"
                @click="open(user)"
                @keydown.enter="open(user)"
              >
                <td class="p-3">
                  <span class="flex items-center gap-2.5">
                    <span class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-dl-ink text-xs font-bold text-dl-signal">{{ user.initials }}</span>
                    <span class="min-w-0"><strong class="block truncate">{{ user.name }}</strong><small class="block truncate text-xs text-dl-muted">{{ user.email }}</small></span>
                  </span>
                </td>
                <td class="p-3">{{ user.role ? roleLabel(user.role) : '—' }}</td>
                <td class="p-3"><DlBadge :tone="statusOf(user).tone" dot>{{ t(`central.users.status.${statusOf(user).key}`) }}</DlBadge></td>
                <td class="p-3 text-[13px] text-dl-muted" :class="panelOpen || adding ? 'hidden' : 'hidden lg:table-cell'">{{ t(`central.users.factor.${user.two_factor_method}`) }}</td>
                <td class="p-3 text-[13px] text-dl-muted" :class="panelOpen || adding ? 'hidden' : 'hidden lg:table-cell'">{{ user.last_login_at ? d(new Date(user.last_login_at)) : t('central.users.never') }}</td>
                <td class="p-3 text-[13px] text-dl-muted" :class="panelOpen || adding ? 'hidden' : 'hidden lg:table-cell'">{{ d(new Date(user.created_at)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>
    </div>

    <PersonPanel v-if="selected" v-model:open="panelOpen" :user="selected" :roles="roles" @changed="onChanged" />
    <AddPersonPanel v-if="adding" v-model:open="adding" :roles="roles" @added="onAdded" />
  </div>
</template>
