<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { errorMessage, fieldErrors } from '@/api/errors'
import { syncUserManagers, syncUserTeams, type TenantUser } from '@/api/tenant/users'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useToast } from '@/composables/useToast'
import PersonTree from '../hierarchy/PersonTree.vue'
import { useOrgTree } from '../hierarchy/useOrgTree'
import { useAuthStore } from '@/stores/auth'
import { useUserLookups } from '../useUserLookups'
import { type Stint, isOpen, stints, today, useUserText } from '../userDisplay'

// Teams and managers as timelines. A change ends the old link and starts a new one,
// so reports for past months keep the right team and manager. The territory joins with its module.
const props = defineProps<{ user: TenantUser }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const text = useUserText()
const auth = useAuthStore()
const can = (permission: string) => auth.can(permission)
const lookups = useUserLookups()
const org = useOrgTree()


const teams = computed(() => stints(props.user.teams))
const managers = computed(() => stints(props.user.managers))
const openTeams = computed(() => teams.value.filter(isOpen))

type Kind = 'add-team' | 'end-team' | 'add-manager' | 'end-manager'
const panel = reactive({ open: false, kind: 'add-team' as Kind, target: null as Stint | null })
const form = reactive({ id: null as number | null, date: today(), until: '', main: false })
const errors = ref<Record<string, string>>({})
const saving = ref(false)

function start(kind: Kind, target: Stint | null = null) {
  Object.assign(panel, { open: true, kind, target })
  Object.assign(form, { id: null, date: today(), until: '', main: false })
  errors.value = {}
}

const titles = computed(() => ({
  'add-team': t('users.assign.addTeam'),
  'end-team': t('users.assign.endTeam', { name: panel.target?.name ?? '' }),
  'add-manager': t('users.assign.addManager'),
  'end-manager': t('users.assign.endManager', { name: panel.target?.name ?? '' }),
}))
const choosing = computed(() => panel.kind.startsWith('add'))
const options = computed(() => {
  if (panel.kind === 'add-team') return lookups.teams.value.filter(team => !openTeams.value.some(open => open.id === team.value))
  return lookups.people.value.filter(person => person.value !== props.user.id && !managers.value.some(m => isOpen(m) && m.id === person.value))
})
const dateHint = computed(() => (panel.kind.startsWith('end') ? t('users.assign.endHint') : undefined))

async function save() {
  if (choosing.value && !form.id) {
    errors.value = { id: t('users.add.required') }
    return
  }
  saving.value = true
  errors.value = {}
  const id = props.user.id
  try {
    switch (panel.kind) {
      case 'add-team':
        await syncUserTeams(id, { new_teams: [{ id: form.id!, start_date: form.date, end_date: form.until || null, is_primary: form.main || !openTeams.value.length }] })
        break
      case 'end-team':
        await syncUserTeams(id, { existing_teams: [{ id: panel.target!.id, end_date: form.date }] })
        break
      case 'add-manager':
        await syncUserManagers(id, { new_managers: [{ id: form.id!, start_date: form.date, end_date: form.until || null }] })
        break
      case 'end-manager':
        await syncUserManagers(id, { existing_managers: [{ id: panel.target!.id, end_date: form.date }] })
        break
    }
    toast.success(t('studio.list.toast.saved'))
    panel.open = false
    org.refresh()
    emit('changed')
  }
  catch (error) {
    const first = Object.values(fieldErrors(error))[0]
    if (first) errors.value = { date: first }
    else toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}

async function makeMain(team: Stint) {
  try {
    await syncUserTeams(props.user.id, { existing_teams: [{ id: team.id, is_primary: true }] })
    toast.success(t('studio.list.toast.saved'))
    emit('changed')
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}

const sections = computed(() => [
  { key: 'teams', title: t('users.assign.teams'), rows: teams.value, add: 'add-team' as Kind, addLabel: t('users.assign.addTeam'), end: 'end-team' as Kind, can: can('users.update') },
  { key: 'managers', title: t('users.assign.managers'), rows: managers.value, add: 'add-manager' as Kind, addLabel: t('users.assign.addManager'), end: 'end-manager' as Kind, can: can('users.update') },
])
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="grid min-w-0 flex-1 items-start gap-4 xl:grid-cols-2">
      <section v-for="section in sections" :key="section.key" class="rounded-2xl border border-dl-line bg-dl-paper px-3.5 py-3" :aria-label="section.title">
        <header class="mb-1 flex items-center gap-2">
          <h3 class="flex-1 text-sm font-semibold">{{ section.title }}</h3>
          <DlButton v-if="section.can" variant="dark" size="sm" :icon="'tabler-plus'" @click="start(section.add)">
            {{ section.addLabel }}
          </DlButton>
        </header>
        <p v-if="!section.rows.length" class="py-2 text-[13px] text-dl-muted">{{ t('users.assign.none') }}</p>
        <ol v-else class="flex flex-col">
          <li v-for="(row, index) in section.rows" :key="`${row.id}-${row.start}`" class="relative grid grid-cols-[16px_1fr_auto] items-start gap-2.5 py-2 text-[13px]">
            <span
              v-if="index"
              aria-hidden="true"
              class="absolute start-[5px] -top-2 h-3.5 w-0.5 bg-dl-line"
            />
            <span aria-hidden="true" class="mt-1 h-2.5 w-2.5 rounded-full border-2" :class="isOpen(row) ? 'border-dl-fg bg-dl-signal' : 'border-dl-line bg-dl-paper'" />
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="flex flex-wrap items-center gap-1.5">
                <strong :class="!isOpen(row) && 'font-semibold text-dl-body'">{{ row.name }}</strong>
                <DlBadge v-if="section.key === 'teams' && row.isPrimary && isOpen(row) && openTeams.length > 1" size="sm">{{ t('users.history.main') }}</DlBadge>
              </span>
              <span class="text-xs text-dl-muted">{{ text.period(row) }}</span>
            </span>
            <span v-if="section.can && isOpen(row) && !row.end" class="flex gap-1">
              <button
                v-if="section.key === 'teams' && !row.isPrimary && openTeams.length > 1"
                type="button"
                class="rounded-lg px-2 py-1 text-xs font-semibold text-dl-cobalt hover:bg-dl-line-soft"
                @click="makeMain(row)"
              >{{ t('users.assign.makeMain') }}</button>
              <DlButton variant="outline" size="sm" icon="tabler-calendar-x" @click="start(section.end, row)">
                {{ t('users.assign.setEnd') }}
              </DlButton>
            </span>
          </li>
        </ol>
      </section>

      <!-- Hierarchy: managers above, the person, the people under them -->
      <section class="rounded-2xl border border-dl-line bg-dl-paper px-3.5 py-3 xl:col-span-2" :aria-label="t('users.hierarchy.title')">
        <header class="mb-3 flex items-center gap-2">
          <h3 class="flex-1 text-sm font-semibold">{{ t('users.hierarchy.title') }}</h3>
          <RouterLink :to="{ name: 'tenant-users', query: { view: 'hierarchy', focus: user.id } }" class="text-[13px] font-semibold text-dl-cobalt no-underline hover:underline">
            {{ t('users.hierarchy.seeInTree') }}
          </RouterLink>
        </header>
        <PersonTree :user-id="user.id" />
      </section>
    </div>

    <DlRecordPanel v-model:open="panel.open" :title="titles[panel.kind]" :description="user.full_name">
      <form id="assign-form" class="flex flex-col gap-3.5" novalidate @submit.prevent="save">
        <DlCombobox
          v-if="choosing"
          v-model="form.id"
          :label="panel.kind === 'add-team' ? t('users.columns.team') : t('users.columns.manager')"
          :options="options"
          :error="errors.id"
        />
        <label v-if="panel.kind === 'add-team' && openTeams.length" class="flex cursor-pointer items-center gap-2.5 text-[13px]">
          <input v-model="form.main" type="checkbox" class="h-[18px] w-[18px] accent-dl-ink">
          {{ t('users.assign.makeItMain') }}
        </label>
        <DlInput
          v-model="form.date"
          type="date"
          :min="panel.target?.start ?? undefined"
          :label="t(choosing ? 'users.assign.from' : 'users.assign.lastDay')"
          :hint="dateHint"
          :error="errors.date"
        />
        <DlInput
          v-if="panel.kind === 'add-team' || panel.kind === 'add-manager'"
          v-model="form.until"
          type="date"
          :min="form.date"
          :label="t('users.assign.until')"
          :hint="t('users.assign.untilHint')"
        />
      </form>
      <template #footer>
        <DlButton variant="ghost" @click="panel.open = false">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton type="submit" form="assign-form" variant="primary" class="ms-auto" :loading="saving">
          {{ choosing ? t('common.actions.save') : t('users.assign.setEnd') }}
        </DlButton>
      </template>
    </DlRecordPanel>
  </div>
</template>
