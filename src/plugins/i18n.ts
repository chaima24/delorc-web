import { createI18n } from 'vue-i18n'
import ar from '@/locales/ar.json'
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'

export const LOCALES = ['fr', 'en', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

const STORAGE_KEY = 'delorc.locale'

/** On a lab: its own languages, and how to fetch one language's texts (set by the lab store). */
interface LabLanguages {
  codes: string[]
  load: (code: string) => Promise<{ direction: 'ltr' | 'rtl'; texts: Record<string, string> }>
}

let lab: LabLanguages | null = null

function isLocale(value: unknown): value is string {
  return typeof value === 'string' && (lab ? lab.codes.includes(value) : LOCALES.includes(value as Locale))
}

/** The language this browser used last time, if it is still allowed here. */
export function savedLocale(): string | null {
  const saved = localStorage.getItem(STORAGE_KEY)

  return isLocale(saved) ? saved : null
}

/** `{ "auth.login.title": "Bon retour" }` → `{ auth: { login: { title: "Bon retour" } } }`, the shape vue-i18n reads. */
export function nestTexts(texts: Record<string, string>): Record<string, unknown> {
  const nested: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(texts)) {
    const parts = key.split('.')
    let node = nested
    for (const part of parts.slice(0, -1)) {
      node = (node[part] ??= {}) as Record<string, unknown>
    }
    node[parts[parts.length - 1]!] = value
  }

  return nested
}

/**
 * Arabic has six plural forms: zero | one | two | few (3–10) | many (11–99) | other (100, 101…).
 * A text with fewer forms keeps vue-i18n's usual choice. Example: 2 → "يومان", 11 → "11 يومًا".
 */
function arabicPlural(count: number, forms: number): number {
  if (forms < 6) {
    return forms === 2 ? (count === 1 ? 0 : 1) : Math.min(Math.abs(count), 2)
  }

  const lastTwo = Math.abs(count) % 100

  if (count === 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (lastTwo >= 3 && lastTwo <= 10) return 3
  if (lastTwo >= 11) return 4

  return 5
}

/** The central console reads its texts from these JSON files. A lab replaces them with its own texts, from its database. */
export const i18n = createI18n({
  legacy: false,
  locale: savedLocale() ?? 'fr',
  fallbackLocale: 'fr',
  missingWarn: false,
  fallbackWarn: false,
  messages: { fr, en, ar },
  pluralRules: { ar: arabicPlural },
})

export function currentLocale(): string {
  return i18n.global.locale.value
}

/** From now on, texts come from the lab: only its languages, each fetched when chosen. */
export function useLabLanguages(languages: LabLanguages): void {
  lab = languages
}

/**
 * Changes the language everywhere: texts, API answers, and the page direction (Arabic reads right to left).
 * On a lab, it first fetches that language's texts (the browser answers from its cache when they did not change).
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) {
    return
  }

  let direction = locale === 'ar' ? 'rtl' : 'ltr'
  if (lab) {
    const bundle = await lab.load(locale)
    i18n.global.setLocaleMessage(locale as Locale, nestTexts(bundle.texts) as typeof fr) // same keys as the JSON files
    direction = bundle.direction
  }

  i18n.global.locale.value = locale as Locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale
  document.documentElement.dir = direction
}

void setLocale(savedLocale() ?? 'fr')
