import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { activityLogApi, type ActivityLine } from '@/api/central/activityLog'
import { i18n } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'
import { groupByDay, periodStart, recentDay } from '@/views/central/activity/activity'
import ActivityLogView from '@/views/central/activity/ActivityLogView.vue'

const owner = { type: 'person', id: 1, name: 'Mehdi Cherif', initials: 'MC', role: 'owner' } as const
const nobody = { id: null, name: null, initials: null, role: null }

function line(values: Partial<ActivityLine>): ActivityLine {
  return {
    id: 1,
    record_type: 'person',
    action: 'updated',
    record: { id: '12', name: 'Karim Toumi', exists: true },
    author: owner,
    changes: [],
    attempt: null,
    import: null,
    created_at: '2026-11-06T10:42:07+00:00',
    ...values,
  }
}

async function mountLog(lines: ActivityLine[], permissions = ['users.show', 'roles.show', 'activity-log.show']) {
  vi.spyOn(activityLogApi, 'list').mockResolvedValue({ data: lines, meta: { total: lines.length } })
  vi.spyOn(activityLogApi, 'people').mockResolvedValue([{ id: 1, name: 'Mehdi Cherif' }])
  vi.spyOn(useAuthStore(), 'can').mockImplementation((permission) => permissions.includes(permission))
  const page = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/activity', name: 'central-activity', component: ActivityLogView },
      { path: '/users', name: 'central-users', component: page },
      { path: '/roles', name: 'central-roles', component: page },
      { path: '/languages', name: 'central-languages', component: page },
    ],
  })
  await router.push('/activity')
  const wrapper = mount(ActivityLogView, { global: { plugins: [router, i18n] } })
  await flushPromises()

  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'en'
  vi.restoreAllMocks()
})

describe('dates', () => {
  const now = new Date(2026, 10, 6, 9, 0)

  it('counts today in the last 7 days', () => {
    expect(periodStart(7, now)).toBe('2026-10-31')
  })

  it('names today and yesterday only', () => {
    expect(recentDay('2026-11-06', now)).toBe('today')
    expect(recentDay('2026-11-05', now)).toBe('yesterday')
    expect(recentDay('2026-11-04', now)).toBeNull()
  })

  it('groups lines of the same day', () => {
    const days = groupByDay([
      line({ id: 3, created_at: new Date(2026, 10, 6, 10).toISOString() }),
      line({ id: 2, created_at: new Date(2026, 10, 6, 9).toISOString() }),
      line({ id: 1, created_at: new Date(2026, 10, 5, 9).toISOString() }),
    ])

    expect(days.map((day) => day.lines.length)).toEqual([2, 1])
  })
})

describe('the activity log page', () => {
  it('asks for the last 7 days without automatic changes when it opens', async () => {
    await mountLog([])

    expect(activityLogApi.list).toHaveBeenCalledWith(expect.objectContaining({ from: periodStart(7), hideAutomatic: true, sort: '-id' }), 1, 25)
  })

  it('writes a role change as a sentence with a chip', async () => {
    const wrapper = await mountLog([line({ action: 'role_changed', changes: [{ field: 'role', before: 'support', after: 'billing' }] })])

    expect(wrapper.text()).toContain('Mehdi Cherif changed the role of Karim Toumi')
    expect(wrapper.text()).toContain('Role: Support → Billing')
  })

  it('writes each right in the words of the access page', async () => {
    const wrapper = await mountLog([line({
      record_type: 'role',
      action: 'access_changed',
      record: { id: '2', name: 'support', exists: true },
      changes: [{ field: 'translations.update', before: false, after: true }, { field: 'labs.export', before: true, after: false }],
    })])

    expect(wrapper.text()).toContain('changed the access of Support')
    expect(wrapper.text()).toContain('Translations, edit: added')
    expect(wrapper.text()).toContain('Labs, export: removed')
  })

  it('names System as the author of a command', async () => {
    const wrapper = await mountLog([line({ action: 'second_factor_reset', author: { type: 'system', ...nobody }, changes: [{ field: 'second_factor', before: 'app', after: 'none' }] })])

    expect(wrapper.text()).toContain('System reset the second factor of Karim Toumi')
    expect(wrapper.text()).toContain('Second factor: App → None')
  })

  it('shows a failed sign-in with its reason', async () => {
    const wrapper = await mountLog([line({
      record_type: 'sign_in',
      action: 'failed',
      record: null,
      author: { type: 'none', ...nobody },
      attempt: { email: 'sara@delorc.test', step: 'password', reason: 'wrong_password', ip: '41.111.20.8' },
    })])

    expect(wrapper.text()).toContain('Failed sign-in for sara@delorc.test')
    expect(wrapper.text()).toContain('Wrong password')
  })

  it('links a record only when it exists and the person may see it', async () => {
    const lines = [line({ id: 2 }), line({ id: 1, record_type: 'role', action: 'deleted', record: { id: '5', name: 'audit', exists: false } })]

    expect((await mountLog(lines)).findAll('a').map((link) => link.attributes('href'))).toEqual(['/users?open=12'])
    expect((await mountLog(lines, ['activity-log.show'])).findAll('a')).toHaveLength(0)
  })

  it('writes a file import with its counts', async () => {
    const wrapper = await mountLog([line({
      record_type: 'translations',
      action: 'imported',
      record: null,
      import: { languages_added: 0, keys_added: 6, texts_added: 18, texts_unchanged: 147 },
    })])

    expect(wrapper.text()).toContain('Mehdi Cherif imported a texts file')
    expect(wrapper.text()).toContain('6 keys, 18 texts added')
  })

  it('links a language to its page', async () => {
    const wrapper = await mountLog([line({
      record_type: 'language',
      action: 'updated',
      record: { id: '3', name: 'Arabic', exists: true },
      changes: [{ field: 'fallback', before: 'fr', after: 'en' }],
    })], ['languages.show'])

    expect(wrapper.text()).toContain('Mehdi Cherif edited the language Arabic')
    expect(wrapper.text()).toContain('Falls back to: French → English')
    expect(wrapper.find('a').attributes('href')).toBe('/languages?open=3')
  })

  it('says so when nothing matches', async () => {
    const wrapper = await mountLog([])

    expect(wrapper.text()).toContain('No matching activity')
  })
})
