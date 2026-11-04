import { createI18n } from 'vue-i18n'

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

/** Texts will come from the API (translation bundles); until that module exists, the lists are empty. */
export const i18n = createI18n({
  legacy: false,
  locale: savedLocale(),
  fallbackLocale: 'fr',
  missingWarn: false,
  fallbackWarn: false,
  messages: { fr: {}, en: {}, ar: {} },
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
