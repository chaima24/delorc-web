<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  addTeamMembers,
  deleteTeam,
  endTeamMember,
  fetchTeamMembers,
  updateTeam,
  type Team,
  type TeamMember,
  type TeamPayload,
} from '@/api/tenant/teams'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlMenu, { type DlMenuItem } from '@/components/DlMenu.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { today, useUserText } from '@/views/tenant/users/userDisplay'
import TeamPeoplePicker from './TeamPeoplePicker.vue'
import TeamTargetsFields from './TeamTargetsFields.vue'

// A team in the side panel: reading mode with one Edit per section, then the members
// (now / past, end a membership on a date) and "Add people" in the same panel.
// Mockup: docs/design/studio-mockups/Teams.html
const props = defineProps<{ team: Team }>()
const emit = defineEmits<{ changed: [team: Team]; deleted: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const text = useUserText()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canUpdate = computed(() => auth.can('teams.update'))

type Mode = 'read' | 'members' | 'add' | 'end'
const mode = ref<Mode>('read')
const MEMBER_PREVIEW = 6
const editing = reactive({ about: false, specialities: false, brands: false })

/** After any change: the list refreshes. */
function changed(team: Team) {
  emit('changed', team)
}

// ── Members ─────────────────────────────────────────────────
const members = ref<TeamMember[]>([])
const pastMembers = ref<TeamMember[] | null>(null)
const membersLoading = ref(false)
const memberView = ref<'now' | 'past'>('now')
const memberSearch = ref('')
async function loadMembers() {
  membersLoading.value = true
  try {
    members.value = await fetchTeamMembers(props.team.id)
    pastMembers.value = null
  }
  finally {
    membersLoading.value = false
  }
}
watch(() => props.team.id, () => {
  mode.value = 'read'
  memberView.value = 'now'
  memberSearch.value = ''
  editing.about = editing.specialities = editing.brands = false
  loadMembers()
}, { immediate: true })

watch(memberView, async view => {
  if (view === 'past' && !pastMembers.value) pastMembers.value = await fetchTeamMembers(props.team.id, 'past')
})
const memberViewItems = computed(() => [
  { value: 'now', label: t('teams.members.now', { count: n(props.team.members_count ?? members.value.length) }) },
  { value: 'past', label: t('teams.members.past', { count: n(props.team.past_members_count ?? 0) }) },
])

/** Members grouped by role, for reading only (no rule behind the order). */
function byRole(rows: TeamMember[]) {
  const groups = new Map<string, TeamMember[]>()
  for (const row of rows) {
    const label = roleLabel(row.user.role)
    groups.set(label, [...(groups.get(label) ?? []), row])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([role, rows]) => ({ role, rows }))
}
const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const listedMembers = computed(() => {
  const rows = memberView.value === 'past' ? pastMembers.value ?? [] : members.value
  const words = normalize(memberSearch.value.trim()).split(/\s+/).filter(Boolean)
  return byRole(rows.filter(row => words.every(word => normalize(row.user.full_name).includes(word))))
})
const previewGroups = computed(() => byRole(members.value.slice(0, MEMBER_PREVIEW)))

function period(member: TeamMember) {
  return text.period({ id: member.id, name: member.user.full_name, start: member.start_date, end: member.end_date, isPrimary: member.is_primary })
}

// ── Sections (reading mode) ─────────────────────────────────
const form = reactive({ name: '', description: '', specialities: [] as number[], brands: [] as number[] })
const errors = ref<Record<string, string>>({})
const saving = ref(false)
function resetForm() {
  Object.assign(form, {
    name: props.team.name,
    description: props.team.description ?? '',
    specialities: props.team.specialities?.map(row => row.id) ?? [],
    brands: props.team.brands?.map(row => row.id) ?? [],
  })
  errors.value = {}
}
watch(() => props.team, resetForm, { immediate: true })

async function save(payload: TeamPayload, section?: keyof typeof editing) {
  saving.value = true
  errors.value = {}
  try {
    const team = await updateTeam(props.team.id, payload)
    toast.success(t('studio.list.toast.saved'))
    if (section) editing[section] = false
    changed(team)
    return true
  }
  catch (error) {
    errors.value = Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, message]) => [key.split('.')[0]!, message]))
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
    return false
  }
  finally {
    saving.value = false
  }
}
function saveAbout() {
  if (!form.name.trim()) {
    errors.value = { name: t('users.add.required') }
    return
  }
  save({ name: form.name.trim(), description: form.description.trim() || null }, 'about')
}
function saveSpecialities() {
  if (!form.specialities.length) {
    errors.value = { specialities: t('teams.fields.specialitiesRequired') }
    return
  }
  save({ specialities: form.specialities }, 'specialities')
}
function cancel(section: keyof typeof editing) {
  editing[section] = false
  resetForm()
}

const tiles = computed(() => [
  { label: t('teams.columns.members'), value: props.team.members_count ?? 0 },
  { label: t('teams.columns.specialities'), value: props.team.specialities?.length ?? 0 },
  { label: t('teams.columns.brands'), value: props.team.brands?.length ?? 0 },
])
const uses = computed(() => Object.entries(props.team.uses ?? {}).filter(([, count]) => count > 0))
const addedLine = computed(() => {
  const date = text.date(props.team.created_at)
  return props.team.created_by ? t('teams.read.addedBy', { date, name: props.team.created_by.full_name }) : t('teams.read.added', { date })
})

// ── ⋯ menu ──────────────────────────────────────────────────
async function setActive(active: boolean) {
  if (!active) {
    const ok = await confirm({
      title: t('teams.actions.deactivateTitle', { name: props.team.name }),
      text: t('teams.actions.deactivateText'),
      confirmButtonText: t('teams.actions.deactivate'),
      icon: 'warning',
    })
    if (!ok) return
  }
  save({ status: active })
}
async function remove() {
  const ok = await confirm({
    title: t('studio.list.delete.title', { name: props.team.name }),
    text: t('teams.actions.deleteText'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteTeam(props.team.id)
    toast.success(t('studio.list.toast.deleted'))
    emit('deleted')
  }
  catch (error) {
    // The API's reason ("Des personnes ont fait partie de cette équipe : désactivez-la plutôt.").
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const menuItems = computed<DlMenuItem[]>(() => {
  const items: DlMenuItem[] = []
  if (canUpdate.value) {
    items.push(props.team.status
      ? { label: t('teams.actions.deactivate'), icon: 'tabler-circle-off', onSelect: () => setActive(false) }
      : { label: t('teams.actions.reactivate'), icon: 'tabler-circle-check', onSelect: () => setActive(true) })
  }
  if (auth.can('teams.delete')) items.push({ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: remove })
  return items
})

// ── Add people / end a membership ───────────────────────────
const adding = reactive({ users: [] as number[], start_date: today() })
const ending = reactive({ member: null as TeamMember | null, end_date: today() })
const memberErrors = ref<Record<string, string>>({})
const memberSaving = ref(false)

function startAdd() {
  Object.assign(adding, { users: [], start_date: today() })
  memberErrors.value = {}
  mode.value = 'add'
}
function startEnd(member: TeamMember) {
  // Last day defaults to today, or the start day for someone who starts later.
  Object.assign(ending, { member, end_date: member.start_date > today() ? member.start_date : today() })
  memberErrors.value = {}
  mode.value = 'end'
}
const currentUserIds = computed(() => members.value.map(row => row.user.id))

async function runMemberChange(request: () => Promise<Team>, done: string, back: Mode) {
  memberSaving.value = true
  memberErrors.value = {}
  try {
    const team = await request()
    toast.success(done)
    await loadMembers()
    changed(team)
    mode.value = back
  }
  catch (error) {
    memberErrors.value = Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, message]) => [key.split('.')[0]!, message]))
    if (!Object.keys(memberErrors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    memberSaving.value = false
  }
}
function saveAdd() {
  if (!adding.users.length) {
    memberErrors.value = { users: t('teams.people.pickOne') }
    return
  }
  runMemberChange(
    () => addTeamMembers(props.team.id, { users: adding.users, start_date: adding.start_date }),
    t('teams.people.added', { count: n(adding.users.length) }, adding.users.length),
    'read',
  )
}
function saveEnd() {
  const member = ending.member
  if (!member) return
  runMemberChange(
    () => endTeamMember(props.team.id, member.id, ending.end_date),
    t('teams.end.done', { name: member.user.full_name }),
    'members',
  )
}

const title = computed(() => ({
  read: props.team.name,
  members: t('teams.members.title', { name: props.team.name }),
  add: t('teams.people.title', { name: props.team.name }),
  end: t('teams.end.title'),
})[mode.value])
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="title">
    <template #badges>
      <span v-if="mode === 'read'" class="mt-1 flex flex-wrap items-center gap-1.5">
        <DlBadge size="sm" dot :tone="team.status ? 'success' : 'neutral'">{{ t(team.status ? 'teams.status.active' : 'teams.status.inactive') }}</DlBadge>
        <span class="text-xs text-dl-muted">{{ addedLine }}</span>
      </span>
      <span v-else-if="mode === 'end' && ending.member" class="mt-1 flex flex-wrap gap-1.5">
        <DlBadge size="sm">{{ ending.member.user.full_name }}</DlBadge>
        <DlBadge size="sm">{{ team.name }}</DlBadge>
      </span>
    </template>
    <template v-if="mode === 'read' && menuItems.length" #actions>
      <DlMenu :label="t('fieldSetup.menu.label')" :items="menuItems" always-menu />
    </template>

    <!-- Reading mode -->
    <div v-if="mode === 'read'" class="flex flex-col gap-3.5">
      <dl class="grid grid-cols-3 gap-2">
        <div v-for="tile in tiles" :key="tile.label" class="flex flex-col gap-0.5 rounded-2xl bg-dl-mist px-3.5 py-2.5">
          <dt class="text-[11.5px] text-dl-muted">{{ tile.label }}</dt>
          <dd class="font-display text-lg font-extrabold">{{ n(tile.value) }}</dd>
        </div>
      </dl>

      <DlRecordSection
        v-model:editing="editing.about"
        :title="t('teams.read.about')"
        :can-edit="canUpdate"
        :saving="saving"
        @save="saveAbout"
        @cancel="cancel('about')"
      >
        <dl class="grid grid-cols-[100px_1fr] gap-x-2.5 gap-y-1.5">
          <dt class="text-dl-muted">{{ t('teams.fields.name') }}</dt><dd>{{ team.name }}</dd>
          <dt class="text-dl-muted">{{ t('teams.fields.descriptionShort') }}</dt><dd>{{ team.description || '—' }}</dd>
        </dl>
        <template #edit>
          <DlInput v-model="form.name" :label="t('teams.fields.name')" :error="errors.name" />
          <DlInput v-model="form.description" :label="t('teams.fields.description')" :placeholder="t('teams.fields.descriptionPlaceholder')" :error="errors.description" />
        </template>
      </DlRecordSection>

      <DlRecordSection
        v-model:editing="editing.specialities"
        :title="t('teams.fields.specialities')"
        :can-edit="canUpdate"
        :saving="saving"
        @save="saveSpecialities"
        @cancel="cancel('specialities')"
      >
        <ul class="flex flex-wrap gap-1.5">
          <li v-for="row in team.specialities" :key="row.id"><DlBadge size="sm">{{ row.name }}</DlBadge></li>
        </ul>
        <template #edit>
          <TeamTargetsFields v-model:specialities="form.specialities" only="specialities" :errors="errors" />
        </template>
      </DlRecordSection>

      <DlRecordSection
        v-model:editing="editing.brands"
        :title="t('teams.fields.brands')"
        :can-edit="canUpdate"
        :saving="saving"
        @save="save({ brands: form.brands }, 'brands')"
        @cancel="cancel('brands')"
      >
        <ul v-if="team.brands?.length" class="flex flex-wrap gap-1.5">
          <li v-for="row in team.brands" :key="row.id"><DlBadge size="sm">{{ row.name }}</DlBadge></li>
        </ul>
        <p v-else>{{ t('teams.read.noBrands') }}</p>
        <template #edit>
          <TeamTargetsFields v-model:brands="form.brands" only="brands" :errors="errors" />
        </template>
      </DlRecordSection>

      <section class="rounded-2xl border border-dl-line" :aria-label="t('teams.columns.members')">
        <header class="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
          <h3 class="flex-1 text-sm font-semibold">{{ t('teams.read.members', { count: n(team.members_count ?? 0) }) }}</h3>
          <DlButton v-if="canUpdate" variant="dark" size="sm" icon="tabler-plus" @click="startAdd">{{ t('teams.people.button') }}</DlButton>
        </header>
        <p v-if="!membersLoading && !members.length" class="px-3.5 pb-3 text-[13px] text-dl-body">{{ t('teams.read.nobody') }}</p>
        <div v-for="group in previewGroups" :key="group.role" class="pb-1">
          <p class="px-3.5 pt-1 text-[11.5px] font-bold uppercase tracking-wide text-dl-muted">{{ group.role }}</p>
          <ul>
            <li v-for="member in group.rows" :key="member.id" class="flex items-center gap-2.5 px-3.5 py-1.5 text-[13px]">
              <DlAvatar :name="member.user.full_name" :src="member.user.avatar?.url" size="sm" :tone="member.user.is_active ? 'cobalt' : 'neutral'" />
              <span class="flex min-w-0 flex-1 flex-col">
                <strong class="truncate font-semibold">{{ member.user.full_name }}</strong>
                <span class="text-xs text-dl-muted">{{ period(member) }}</span>
              </span>
              <DlBadge v-if="member.is_primary" size="sm">{{ t('teams.members.mainTeam') }}</DlBadge>
            </li>
          </ul>
        </div>
        <p v-if="members.length || team.past_members_count" class="flex flex-wrap gap-x-3 px-3.5 pb-3 pt-1 text-[13px]">
          <button v-if="members.length" type="button" class="font-semibold text-dl-cobalt hover:underline" @click="memberView = 'now'; mode = 'members'">
            {{ t('teams.read.seeAll', { count: n(members.length) }, members.length) }}
          </button>
          <button v-if="team.past_members_count" type="button" class="font-semibold text-dl-cobalt hover:underline" @click="memberView = 'past'; mode = 'members'">
            {{ t('teams.read.pastMembers', { count: n(team.past_members_count) }) }}
          </button>
        </p>
      </section>

      <section v-if="uses.length" class="rounded-2xl border border-dl-line px-3.5 py-3">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('teams.read.usedBy') }}</h3>
        <dl class="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-1 text-[13px]">
          <template v-for="[kind, count] in uses" :key="kind">
            <dt>{{ t(`teams.uses.${kind}`) }}</dt><dd class="text-dl-muted tabular-nums">{{ n(count) }}</dd>
          </template>
        </dl>
      </section>
    </div>

    <!-- All members: now / past -->
    <div v-else-if="mode === 'members'" class="flex flex-col gap-3">
      <DlSegmented v-model="memberView" :label="t('teams.columns.members')" :items="memberViewItems" block />
      <DlInput v-model="memberSearch" type="search" icon="tabler-search" :label="t('teams.people.search')" :placeholder="t('teams.people.search')" hide-label />
      <section class="rounded-2xl border border-dl-line py-1.5">
        <p v-if="!listedMembers.length" class="px-3.5 py-2 text-[13px] text-dl-muted">{{ t('teams.people.none') }}</p>
        <div v-for="group in listedMembers" :key="group.role" class="pb-1">
          <p class="px-3.5 pt-1.5 text-[11.5px] font-bold uppercase tracking-wide text-dl-muted">{{ group.role }} · {{ n(group.rows.length) }}</p>
          <ul>
            <li v-for="member in group.rows" :key="member.id" class="flex items-center gap-2.5 px-3.5 py-1.5 text-[13px]">
              <DlAvatar :name="member.user.full_name" :src="member.user.avatar?.url" size="sm" :tone="member.user.is_active ? 'cobalt' : 'neutral'" />
              <span class="flex min-w-0 flex-1 flex-col">
                <strong class="truncate font-semibold">{{ member.user.full_name }}</strong>
                <span class="text-xs text-dl-muted">{{ period(member) }}</span>
              </span>
              <DlBadge v-if="member.is_primary && memberView === 'now'" size="sm">{{ t('teams.members.mainTeam') }}</DlBadge>
              <DlButton v-if="memberView === 'now' && canUpdate" variant="outline" size="sm" @click="startEnd(member)">{{ t('teams.end.button') }}</DlButton>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <!-- Add people -->
    <form v-else-if="mode === 'add'" id="team-add-people" class="flex flex-col gap-4" @submit.prevent="saveAdd">
      <TeamPeoplePicker v-model="adding.users" :exclude="currentUserIds" :error="memberErrors.users" />
      <DlInput v-model="adding.start_date" type="date" :label="t('teams.members.from')" :hint="t('teams.people.keepOthers')" :error="memberErrors.start_date" />
    </form>

    <!-- End a membership -->
    <form v-else-if="mode === 'end' && ending.member" id="team-end-member" class="flex flex-col gap-4" @submit.prevent="saveEnd">
      <DlInput
        v-model="ending.end_date"
        type="date"
        :min="ending.member.start_date"
        :label="t('teams.end.lastDay')"
        :hint="t('teams.end.hint', { name: ending.member.user.full_name, from: text.date(ending.member.start_date), to: text.date(ending.end_date) })"
        :error="memberErrors.end_date"
      />
    </form>

    <template v-if="mode !== 'read'" #footer>
      <template v-if="mode === 'members'">
        <DlButton variant="ghost" icon="tabler-chevron-left" @click="mode = 'read'">{{ t('teams.members.back') }}</DlButton>
        <DlButton v-if="canUpdate" variant="dark" icon="tabler-plus" class="ms-auto" @click="startAdd">{{ t('teams.people.button') }}</DlButton>
      </template>
      <template v-else-if="mode === 'add'">
        <DlButton variant="ghost" @click="mode = 'read'">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton type="submit" form="team-add-people" variant="primary" class="ms-auto" :loading="memberSaving">
          {{ adding.users.length ? t('teams.people.save', { count: n(adding.users.length) }, adding.users.length) : t('teams.people.button') }}
        </DlButton>
      </template>
      <template v-else>
        <DlButton variant="ghost" @click="mode = 'members'">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton type="submit" form="team-end-member" variant="dark" class="ms-auto" :loading="memberSaving">{{ t('teams.end.save') }}</DlButton>
      </template>
    </template>
  </DlRecordPanel>
</template>
