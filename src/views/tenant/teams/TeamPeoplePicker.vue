<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchUsers, type TenantUser } from '@/api/tenant/users'
import DlAvatar from '@/components/DlAvatar.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { currentTeams } from '@/views/tenant/users/userDisplay'

// Pick several people: search, role filter, one row per person with their role and current teams.
const props = defineProps<{
  /** People already in the team: not offered. */
  exclude?: number[]
  error?: string
}>()
const model = defineModel<number[]>({ required: true })
const { t } = useI18n()

// Everyone not deactivated, 100 at a time.
const users = ref<TenantUser[]>([])
const loading = ref(true)
onMounted(async () => {
  try {
    for (let page = 1; ; page++) {
      const result = await fetchUsers({ page, per_page: 100, sort: 'first_name', 'filter[account]': 'current' })
      users.value.push(...result.items)
      if (!result.items.length || users.value.length >= result.total) break
    }
  }
  finally {
    loading.value = false
  }
})

const ALL = 'all'
const search = ref('')
const role = ref<string | number | null>(ALL)

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const people = computed(() => users.value
  .filter(user => user.is_active && !props.exclude?.includes(user.id))
  .map(user => ({
    id: user.id,
    name: user.full_name,
    avatar: user.avatar?.url,
    role: user.role,
    teams: currentTeams(user).map(team => team.name).join(', '),
  }))
  .sort((a, b) => a.name.localeCompare(b.name)))

const roleOptions = computed(() => [
  { value: ALL, label: t('users.filter.allRoles') },
  ...[...new Set(people.value.map(person => person.role).filter(Boolean) as string[])]
    .map(name => ({ value: name, label: roleLabel(name) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
])

const visible = computed(() => {
  const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean)
  return people.value.filter(person =>
    (role.value === ALL || person.role === role.value)
    && words.every(word => normalize(person.name).includes(word)))
})

function toggle(id: number) {
  model.value = model.value.includes(id) ? model.value.filter(value => value !== id) : [...model.value, id]
}
</script>

<template>
  <fieldset class="flex min-w-0 flex-col gap-2.5">
    <legend class="mb-1 flex w-full items-baseline justify-between text-[13px] font-semibold">
      {{ t('teams.people.legend') }}
      <span class="font-normal text-dl-muted">{{ t('teams.people.chosen', { count: model.length }, model.length) }}</span>
    </legend>
    <DlInput v-model="search" type="search" icon="tabler-search" :label="t('teams.people.search')" :placeholder="t('teams.people.search')" hide-label />
    <DlSelect v-model="role" :label="t('users.columns.role')" :options="roleOptions" />
    <ul class="flex max-h-80 flex-col overflow-y-auto rounded-2xl border border-dl-line">
      <li v-for="person in visible" :key="person.id" class="border-b border-dl-line-soft last:border-b-0">
        <label class="flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2 text-sm hover:bg-dl-mist">
          <input
            type="checkbox"
            class="h-[18px] w-[18px] shrink-0 accent-dl-ink"
            :checked="model.includes(person.id)"
            @change="toggle(person.id)"
          >
          <DlAvatar :name="person.name" :src="person.avatar" size="sm" />
          <span class="flex min-w-0 flex-col">
            <strong class="truncate font-semibold">{{ person.name }}</strong>
            <span class="truncate text-xs text-dl-muted">{{ roleLabel(person.role) }} · {{ person.teams || t('teams.people.noTeam') }}</span>
          </span>
        </label>
      </li>
      <li v-if="loading && !people.length" class="px-3.5 py-3 text-sm text-dl-muted">{{ t('common.modal.loading') }}</li>
      <li v-else-if="!visible.length" class="px-3.5 py-3 text-sm text-dl-muted">{{ t('teams.people.none') }}</li>
    </ul>
    <p v-if="error" class="text-xs text-dl-rejected">{{ error }}</p>
  </fieldset>
</template>
