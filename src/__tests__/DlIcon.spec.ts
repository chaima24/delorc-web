import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DlIcon from '@/components/DlIcon.vue'

describe('DlIcon', () => {
  it('draws a Tabler icon from the local set', () => {
    const wrapper = mount(DlIcon, { props: { icon: 'tabler-eye-off' } })

    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
