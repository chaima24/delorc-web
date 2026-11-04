import { describe, expect, it } from 'vitest'
import { apiBaseUrl, resolveSpace } from '@/space'

describe('space', () => {
  it('reads central or the lab from the address', () => {
    expect(resolveSpace('localhost', 'localhost')).toEqual({ isCentral: true, labId: null })
    expect(resolveSpace('demo.localhost', 'localhost')).toEqual({ isCentral: false, labId: 'demo' })
  })

  it('builds the API address on the same host', () => {
    const lab = { protocol: 'http:', hostname: 'demo.localhost' }

    expect(apiBaseUrl(lab, '8000', false)).toBe('http://demo.localhost:8000/api/v1')
    expect(apiBaseUrl({ protocol: 'https:', hostname: 'delorc.com' }, '', true)).toBe('https://delorc.com/api/v1/central')
  })
})
