import { useI18n } from 'vue-i18n'

/** A language in the viewer's language when we have the word, otherwise its saved name. */
export function useLanguageName() {
  const { t, te } = useI18n()

  return (code: string, name?: string) => (te(`common.locale.${code}`) ? t(`common.locale.${code}`) : name ?? code)
}
