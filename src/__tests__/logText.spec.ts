import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import type { ActivityLog } from '@/api/tenant/logs'
import { i18n } from '@/plugins/i18n'
import { useLogText } from '@/views/tenant/logs/useLogText'

/** useLogText needs vue-i18n's setup context: read it from a tiny component. */
function withLogText<T>(read: (text: ReturnType<typeof useLogText>) => T): T {
  let result!: T
  mount(defineComponent({ setup() { result = read(useLogText()); return () => h('div') } }), { global: { plugins: [i18n] } })
  return result
}

describe('lab journal lines', () => {
  it('reads a failed sign-in with the email that was typed', () => {
    const log: ActivityLog = { id: 1, event: 'failed', properties: { attempt: { email: 'nobody@lab.dz' } } }

    const parts = withLogText(text => text.sentenceParts(log))
    expect(parts.keypath).toBe('access.log.event.failed')
    expect(parts.params.email).toBe('nobody@lab.dz')
  })

  it('names the working week, which has no record', () => {
    const log: ActivityLog = { id: 2, event: 'updated', log_name: 'working_week', attributes: { weekend_days: [0, 6] }, old: { weekend_days: [5, 6] } }

    const parts = withLogText(text => text.sentenceParts(log))
    expect(parts.params.name).toBe(i18n.global.t('workingWeek.title'))
    expect(withLogText(text => text.changes(log)).map(change => change.field)).toEqual(['weekend_days'])
  })
})
