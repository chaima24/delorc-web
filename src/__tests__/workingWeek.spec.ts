import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fieldSetup from '@/api/tenant/fieldSetup'
import { i18n } from '@/plugins/i18n'
import WorkingWeekPanel from '@/views/tenant/holidays/WorkingWeekPanel.vue'

// The panel is a side panel on desktop and a sheet on phones: the test browser has no screen size.
vi.hoisted(() => {
  window.matchMedia = () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList
})

describe('working week', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('saves the chosen weekend days and allows only 1 to 3', async () => {
    const save = vi.spyOn(fieldSetup, 'updateWorkingWeek').mockResolvedValue({ weekend_days: [0, 6] })
    const wrapper = mount(WorkingWeekPanel, { props: { open: true, weekend: [5, 6] }, global: { plugins: [i18n] }, attachTo: document.body })
    const day = (number: number) => document.body.querySelectorAll<HTMLButtonElement>('[aria-pressed]')[[1, 2, 3, 4, 5, 6, 0].indexOf(number)]!

    expect(day(5).getAttribute('aria-pressed')).toBe('true')
    day(5).click() // Friday off the weekend
    day(0).click() // Sunday on
    await flushPromises()
    const saveButton = [...document.body.querySelectorAll('button')].find(button => button.textContent?.includes('common.actions.save') || button.textContent?.includes('Enregistrer'))!
    saveButton.click()
    await flushPromises()

    expect(save).toHaveBeenCalledWith([6, 0])
    expect(wrapper.emitted('saved')?.[0]).toEqual([[0, 6]])
    wrapper.unmount()
  })
})
