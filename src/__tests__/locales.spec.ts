import { describe, expect, it } from 'vitest'
import { i18n } from '@/plugins/i18n'
import ar from '@/locales/ar.json'
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'

type Texts = { [key: string]: string | Texts }

function flatten(texts: Texts, prefix = ''): Record<string, string> {
  return Object.entries(texts).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix + key

    return typeof value === 'string' ? { ...all, [path]: value } : { ...all, ...flatten(value, `${path}.`) }
  }, {})
}

/** The placeholders a text uses. Each name counts once: Arabic has more plural forms than French. */
const slots = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort()

describe('central texts', () => {
  const french = flatten(fr)

  it.each([['en', en], ['ar', ar]])('%s has the same keys and slots as French', (_, texts) => {
    const other = flatten(texts)

    expect(Object.keys(other).sort()).toEqual(Object.keys(french).sort())
    // The key is part of the compared value, so a failure names it.
    Object.keys(french).forEach((key) => expect({ key, slots: slots(other[key] ?? '') }).toEqual({ key, slots: slots(french[key] ?? '') }))
  })

  it('finds a key with a dash', () => {
    expect(i18n.global.t('access.resource.rule-types', 1, { locale: 'fr' })).toBe('Types de règles')
  })
})
