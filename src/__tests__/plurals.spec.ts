import { describe, expect, it } from 'vitest'
import { i18n } from '@/plugins/i18n'

describe('Arabic plurals', () => {
  const t = (key: string, count: number) => i18n.global.t(key, { count }, { locale: 'ar' })

  it('uses the six Arabic forms', () => {
    expect([0, 1, 2, 3, 10, 11, 99, 100, 103, 111].map((count) => t('central.plans.labsCount', count))).toEqual([
      'لا مختبر', 'مختبر واحد', 'مختبران', '3 مختبرات', '10 مختبرات', '11 مختبرًا', '99 مختبرًا', '100 مختبر', '103 مختبرات', '111 مختبرًا',
    ])
  })

  it('keeps the French and English forms', () => {
    expect(i18n.global.t('central.plans.labsCount', { count: 2 }, { locale: 'fr' })).toBe('2 laboratoires')
    expect(i18n.global.t('central.plans.labsCount', { count: 1 }, { locale: 'en' })).toBe('1 lab')
  })
})
