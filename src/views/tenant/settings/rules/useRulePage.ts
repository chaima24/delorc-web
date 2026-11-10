import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ListParams, Page } from '@/api/tenant/geography'
import { fetchRuleCoverage, type RuleCoverage, type RuleKind, type RuleWho, type RuleWhoPayload } from '@/api/tenant/rules'
import { fetchAllTeams } from '@/api/tenant/teams'
import { fetchUsers } from '@/api/tenant/users'
import { useAuthStore } from '@/stores/auth'
import { roleLabel, useRolesAndTeams } from '@/views/tenant/settings/shared/lookups'
import { useRecordPanel, useStudioCounts, useStudioList } from '@/views/tenant/settings/shared/useStudioList'

/** A planning or validation rule as the pages need it. */
export interface Rule extends RuleWho {
  id: number
  name: string
  description?: string | null
  is_active: boolean
  created_by?: { id: number; full_name?: string } | null
  created_at?: string | null
}

/** Who follows the rule: roles and teams, or chosen people. */
export interface RuleWhoForm {
  mode: 'groups' | 'people'
  roles: number[]
  teams: number[]
  users: number[]
}

export interface RuleForm extends RuleWhoForm {
  name: string
  description: string
  is_active: boolean
}

/** What every rule sends besides its own values. */
type RuleBasePayload = { name: string; description: string | null; is_active: boolean } & Partial<RuleWhoPayload>

/** The parts of a rule edited one at a time in reading mode. */
export type RulePart = 'rule' | 'who' | 'about'

interface RulePageOptions<T extends Rule, F extends RuleForm, P> {
  kind: RuleKind
  /** The rule's own values (window, delay) for the form. */
  toForm: (rule: T | null) => Omit<F, keyof RuleForm>
  /** The rule's own values for the API. */
  toPayload: (form: F) => P
  api: {
    list: (params: ListParams) => Promise<Page<T>>
    show: (id: number) => Promise<T>
    create: (payload: P & RuleBasePayload) => Promise<T>
    update: (id: number, payload: P & RuleBasePayload) => Promise<unknown>
    remove: (id: number) => Promise<unknown>
  }
}

/** The who-payload of a form: roles and teams, or chosen people. */
export function whoPayload(form: RuleWhoForm): RuleWhoPayload {
  return form.mode === 'people'
    ? { roles: [], teams: [], users: form.users }
    : { roles: form.roles, teams: form.teams, users: [] }
}

/**
 * The list, panel and coverage of a rules page. Each person follows at most one rule of each
 * kind; the API moves people from their old rule when a rule is given to them.
 */
export function useRulePage<T extends Rule, F extends RuleForm, P extends object>(options: RulePageOptions<T, F, P>) {
  const { t } = useI18n()
  const auth = useAuthStore()
  const can = (action: string) => auth.can(`${options.kind}.${action}`)
  const { refresh: refreshCounts } = useStudioCounts()
  const { roles } = useRolesAndTeams()

  const teams = ref<{ value: number; label: string }[]>([])
  const users = ref<{ value: number; label: string }[]>([])
  onMounted(async () => {
    teams.value = (await fetchAllTeams()).map(team => ({ value: team.id, label: team.name })).sort((a, b) => a.label.localeCompare(b.label))
    // Every person not deactivated, 100 at a time.
    const people: { value: number; label: string }[] = []
    for (let page = 1; ; page++) {
      const result = await fetchUsers({ page, per_page: 100, sort: 'first_name', 'filter[account]': 'current' })
      people.push(...result.items.map(user => ({ value: user.id, label: user.full_name })))
      if (!result.items.length || people.length >= result.total) break
    }
    users.value = people.sort((a, b) => a.label.localeCompare(b.label))
  })

  const coverage = ref<RuleCoverage | null>(null)
  async function refreshCoverage() {
    try {
      coverage.value = await fetchRuleCoverage(options.kind)
    }
    catch {
      coverage.value = null
    }
  }
  refreshCoverage()

  const list = useStudioList<T, { status: string | null }>(
    ({ page, perPage, search, sort, filters }) => options.api.list({
      page,
      per_page: perPage,
      sort,
      'filter[name]': search || undefined,
      'filter[is_active]': filters.status == null ? undefined : Number(filters.status === 'active'),
    }),
    { status: null },
  )
  list.reload()

  // Who is sent only when adding, or when saving the "Who" section: other saves keep the people.
  let sendWho = false
  const payload = (form: F): P & RuleBasePayload => ({
    ...options.toPayload(form),
    name: form.name,
    description: form.description || null,
    is_active: form.is_active,
    ...(sendWho ? whoPayload(form) : {}),
  })

  const panel = useRecordPanel<T, F>({
    toForm: rule => {
      const people = !rule?.roles?.length && !rule?.teams?.length && !!rule?.users?.length
      return {
        name: rule?.name ?? '',
        description: rule?.description ?? '',
        is_active: rule?.is_active ?? true,
        mode: people ? 'people' : 'groups',
        roles: rule?.roles?.map(role => role.id) ?? [],
        teams: rule?.teams?.map(team => team.id) ?? [],
        users: people ? rule!.users!.map(user => user.id) : [],
        ...options.toForm(rule),
      } as F
    },
    create: form => options.api.create(payload(form)),
    update: (rule, form) => options.api.update(rule.id, payload(form)),
    remove: rule => options.api.remove(rule.id),
    recordName: rule => rule.name,
    onChange: () => {
      list.reload()
      refreshCounts()
      refreshCoverage()
    },
    reload: rule => options.api.show(rule.id),
  })
  const { record, form } = panel

  const editing = ref<RulePart | null>(null)
  watch(record, () => { editing.value = null })

  function edit(part: RulePart) {
    panel.reset()
    editing.value = part
  }
  async function saveSection() {
    sendWho = editing.value === 'who'
    if (await panel.save()) editing.value = null
    sendWho = false
  }
  function cancelSection() {
    panel.reset()
    editing.value = null
  }
  function startAdd() {
    panel.show(null)
  }
  async function add() {
    sendWho = true
    await panel.save()
    sendWho = false
  }

  async function setActive(active: boolean) {
    panel.reset()
    form.value.is_active = active
    await panel.save()
  }

  const menuItems = computed(() => {
    const rule = record.value
    if (!rule) return []
    return [
      ...(can('update')
        ? [rule.is_active
            ? { label: t('rulesSetup.menu.pause'), icon: 'tabler-player-pause', onSelect: () => setActive(false) }
            : { label: t('rulesSetup.menu.resume'), icon: 'tabler-player-play', onSelect: () => setActive(true) }]
        : []),
      ...(can('delete')
        ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: () => panel.destroy() }]
        : []),
    ]
  })

  const statusFilter = computed({
    get: () => list.filters.status ?? 'all',
    set: value => { list.filters.status = value === 'all' || value == null ? null : String(value) },
  })
  const statusOptions = computed(() => [
    { value: 'all', label: t('rulesSetup.filter.allStatuses') },
    { value: 'active', label: t('rulesSetup.status.active') },
    { value: 'paused', label: t('rulesSetup.status.paused') },
  ])

  return {
    list,
    panel,
    editing,
    edit,
    saveSection,
    cancelSection,
    startAdd,
    add,
    menuItems,
    coverage,
    roles,
    teams,
    users,
    statusFilter,
    statusOptions,
    canAdd: computed(() => can('create')),
    canEdit: computed(() => can('update')),
  }
}

/** "VM, VP · All teams" · "All roles · Cardio" · "Amine Kaci, Nadia B. +3" · "Nobody". */
export function useAppliesTo() {
  const { t } = useI18n()

  return (rule: RuleWho): { text: string; kind: 'groups' | 'people' | 'nobody' } => {
    const roles = rule.roles ?? []
    const teams = rule.teams ?? []
    if (roles.length || teams.length) {
      const roleText = roles.length ? roles.map(role => roleLabel(role.name)).join(', ') : t('fieldSetup.filter.allRoles')
      const teamText = teams.length ? teams.map(team => team.name).join(', ') : t('fieldSetup.filter.allTeams')
      return { text: `${roleText} · ${teamText}`, kind: 'groups' }
    }
    const people = rule.users ?? []
    if (!people.length) return { text: t('rulesSetup.who.nobody'), kind: 'nobody' }
    const shown = people.slice(0, 2).map(user => user.full_name).join(', ')
    return { text: people.length > 2 ? `${shown} +${people.length - 2}` : shown, kind: 'people' }
  }
}
