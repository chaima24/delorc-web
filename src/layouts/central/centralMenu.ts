import { useAuthStore } from '@/stores/auth'

export interface MenuItem {
  to: string
  /** The pages that light up this item. */
  pages: string[]
  label: string
  icon: string
}

/** The sidebar items this person may open. Also the "Pages" of the search. Each module adds its line when it is built. */
export function centralMenu(): MenuItem[] {
  const auth = useAuthStore()

  return [
    { to: 'central-labs', pages: ['central-labs', 'central-lab-new', 'central-lab'], label: 'central.menu.labs', icon: 'tabler-building-factory-2', allowed: auth.can('labs.show') },
    { to: 'central-usage', pages: ['central-usage'], label: 'central.menu.usage', icon: 'tabler-chart-bar', allowed: auth.can('usage.show') },
    { to: 'central-users', pages: ['central-users'], label: 'central.users.title', icon: 'tabler-users', allowed: auth.can('users.show') },
    { to: 'central-roles', pages: ['central-roles', 'central-role-access'], label: 'central.roles.title', icon: 'tabler-shield-lock', allowed: auth.can('roles.show') },
    { to: 'central-activity', pages: ['central-activity'], label: 'central.menu.activity', icon: 'tabler-history', allowed: auth.can('activity-log.show') },
    {
      to: auth.can('translations.show') ? 'central-translations' : 'central-languages',
      pages: ['central-translations', 'central-languages'],
      label: 'central.menu.translations',
      icon: 'tabler-language',
      allowed: auth.can('translations.show') || auth.can('languages.show'),
    },
    { to: 'central-countries', pages: ['central-countries', 'central-country'], label: 'central.menu.geography', icon: 'tabler-map', allowed: auth.can('geography.show') },
    { to: 'central-plans', pages: ['central-plans'], label: 'central.menu.plans', icon: 'tabler-stack-2', allowed: auth.can('plans.show') },
    { to: 'central-settings', pages: ['central-settings'], label: 'central.menu.settings', icon: 'tabler-settings', allowed: auth.can('settings.show') },
  ]
    .filter((item) => item.allowed)
    .map(({ allowed: _allowed, ...item }) => item)
}
