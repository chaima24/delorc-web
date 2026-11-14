<script setup lang="ts">
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchUsers, type TenantUser } from '@/api/tenant/users'
import DlAvatar from '@/components/DlAvatar.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlSelect from '@/components/DlSelect.vue'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { currentTeams } from '@/views/tenant/users/userDisplay'

// Pick several people: a role filter, then a search select, both full width; each person picked becomes a chip with ✕.
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
onMountedAndFocus(async () => {
  try {
    const rows: typeof users.value = []
    for (let page = 1; ; page++) {
      const result = await fetchUsers({ page, per_page: 100, sort: 'first_name', 'filter[account]': 'current' })
      rows.push(...result.items)
      if (!result.items.length || rows.length >= result.total) break
    }
    users.value = rows
  }
  finally {
    loading.value = false
  }
})

const ALL = 'all'
const role = ref<string | number | null>(ALL)

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

// The search select offers the people of the chosen role not picked yet; its second line (role · teams) is searched too.
const options = computed(() => people.value
  .filter(person => (role.value === ALL || person.role === role.value) && !model.value.includes(person.id))
  .map(person => ({ value: person.id, label: person.name, hint: `${roleLabel(person.role)} · ${person.teams || t('teams.people.noTeam')}` })))
const picked = computed({
  get: () => null as number | null,
  set: value => { if (value != null) model.value = [...model.value, Number(value)] },
})
const chosen = computed(() => model.value.map(id => people.value.find(person => person.id === id)).filter(person => person !== undefined))
const remove = (id: number) => { model.value = model.value.filter(value => value !== id) }
</script>

<template>
  <fieldset class="flex min-w-0 flex-col gap-2.5">
    <legend class="mb-1 flex w-full items-baseline justify-between text-[13px] font-semibold">
      {{ t('teams.people.legend') }}
      <span class="font-normal text-dl-muted">{{ t('teams.people.chosen', { count: model.length }, model.length) }}</span>
    </legend>
    <DlSelect v-model="role" :label="t('users.columns.role')" :options="roleOptions" />
    <DlCombobox
      v-model="picked"
      :label="t('teams.people.button')"
      :placeholder="loading ? t('common.modal.loading') : t('teams.people.button')"
      :options="options"
      :disabled="loading"
    />
    <div v-if="chosen.length" class="flex flex-wrap gap-1.5">
      <span v-for="person in chosen" :key="person.id" class="inline-flex items-center gap-1.5 rounded-full bg-dl-line-soft py-0.5 ps-0.5 pe-0.5 text-xs font-semibold">
        <DlAvatar :name="person.name" :src="person.avatar" size="sm" />
        {{ person.name }}
        <DlIconButton icon="tabler-x" variant="ghost" :size="26" :label="t('coaching.picks.remove', { name: person.name })" @click="remove(person.id)" />
      </span>
    </div>
    <p v-if="error" class="text-xs text-dl-rejected">{{ error }}</p>
  </fieldset>
</template>
