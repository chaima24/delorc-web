import { useI18n } from 'vue-i18n'

/** Readable names for roles and permissions. A role made on the screen has no translation: its own name shows. */
export function useAccessLabels() {
  const { t, te } = useI18n()
  const label = (key: string, fallback: string) => (te(key) ? t(key) : fallback)

  return {
    roleLabel: (name: string) => label(`access.role.${name}`, name),
    areaLabel: (name: string) => label(`access.area.${name}`, name),
    resourceLabel: (name: string) => label(`access.resource.${name}`, name),
    actionLabel: (name: string) => label(`access.action.${name}`, name),
  }
}
