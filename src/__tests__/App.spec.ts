import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginView from '@/views/auth/LoginView.vue'

describe('LoginView', () => {
  it('renders the product name', () => {
    const wrapper = mount(LoginView)
    expect(wrapper.text()).toContain('delorc')
  })
})
