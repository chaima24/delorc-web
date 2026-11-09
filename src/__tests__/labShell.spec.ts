import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/plugins/i18n'
import LabTopBar from '@/layouts/lab/LabTopBar.vue'
import { useLabStore } from '@/stores/lab'

// The theme follows the system's dark mode, which the test browser does not have.
vi.hoisted(() => {
  window.matchMedia = () => ({ matches: false, addEventListener: () => undefined }) as unknown as MediaQueryList
})

const lab = { id: 'demo', name: 'Demo Pharma', logo_url: null, default_language: 'fr', languages: [{ code: 'fr', native_name: 'Français', direction: 'ltr' as const }] }

function mountTopBar() {
  const page = { template: '<div />' }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'home', component: page }] })

  return mount(LabTopBar, { global: { plugins: [router, i18n] } })
}

describe('lab top bar', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it("shows the lab's name, with its first letter when it has no logo", () => {
    useLabStore().lab = lab

    const wrapper = mountTopBar()

    expect(wrapper.text()).toContain('Demo Pharma')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('D')
  })

  it("shows the lab's logo when central uploaded one", () => {
    useLabStore().lab = { ...lab, logo_url: 'https://files.test/demo.png' }

    expect(mountTopBar().find('img').attributes('src')).toBe('https://files.test/demo.png')
  })
})

describe('search shortcut', () => {
  it("jumps into the field with its key, but not while typing elsewhere", async () => {
    const { default: DlInput } = await import('@/components/DlInput.vue')
    const wrapper = mount(DlInput, { props: { label: 'Chercher', shortcut: '/' }, attachTo: document.body })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    expect(document.activeElement).toBe(wrapper.find('input').element)
    expect(wrapper.find('kbd').text()).toBe('/')
    wrapper.unmount()
  })
})
