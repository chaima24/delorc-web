import { createI18n } from 'vue-i18n'
import ar from '@/locales/ar.json'
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'

export const LOCALES = ['fr', 'en', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

const STORAGE_KEY = 'delorc.locale'

function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale)
}

function savedLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)

  return isLocale(saved) ? saved : 'fr'
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

/** The central console reads its texts from these JSON files. Lab texts will come from the database, with the Labs module. */
export const i18n = createI18n({
  legacy: false,
  locale: savedLocale(),
  fallbackLocale: 'fr',
  missingWarn: false,
  fallbackWarn: false,
  messages: { fr, en, ar },
  pluralRules: { ar: arabicPlural },
})

export function currentLocale(): Locale {
  return i18n.global.locale.value as Locale
}

/** Changes the language everywhere: texts, API answers, and the page direction (Arabic reads right to left). */
export function setLocale(locale: string): void {
  if (!isLocale(locale)) {
    return
  }

  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
}

setLocale(savedLocale())
