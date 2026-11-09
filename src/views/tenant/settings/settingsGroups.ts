import type { RouteLocationRaw } from 'vue-router'

/** A card of the Studio home. `resource` hides it without `{resource}.show`. */
export interface SettingsLink {
  /** Text keys. */
  title: string
  description?: string
  to: RouteLocationRaw
  icon: string
  resource?: string
  /** Key in `GET studio/summary` counts (a table name) for the card's number. */
  count?: string
}

/** A section of the Studio home: related settings. */
export interface SettingsGroup {
  /** Text keys. */
  title: string
  subtitle: string
  icon: string
  links: SettingsLink[]
}

/**
 * Studio › Paramètres, in the order a lab sets itself up. Only built pages appear here:
 * each module adds its group or cards (geography, professionnels de santé, field setup, rules…).
 */
export const settingsGroups: SettingsGroup[] = [
  {
    title: 'settings.groups.geography.title',
    subtitle: 'settings.groups.geography.subtitle',
    icon: 'tabler-map-2',
    links: [
      { title: 'settings.links.countries.title', description: 'settings.links.countries.description', to: { name: 'tenant-countries' }, icon: 'tabler-world', resource: 'countries', count: 'countries' },
      { title: 'settings.links.regions.title', description: 'settings.links.regions.description', to: { name: 'tenant-regions' }, icon: 'tabler-map', resource: 'regions', count: 'regions' },
      { title: 'settings.links.wilayas.title', description: 'settings.links.wilayas.description', to: { name: 'tenant-wilayas' }, icon: 'tabler-map-pin', resource: 'wilayas', count: 'wilayas' },
      { title: 'settings.links.communes.title', description: 'settings.links.communes.description', to: { name: 'tenant-communes' }, icon: 'tabler-building-community', resource: 'communes', count: 'communes' },
      { title: 'settings.links.subWilayaZones.title', description: 'settings.links.subWilayaZones.description', to: { name: 'tenant-sub-wilaya-zones' }, icon: 'tabler-hexagons', resource: 'sub-wilaya-zones', count: 'sub_wilaya_zones' },
    ],
  },
  {
    title: 'settings.groups.customers.title',
    subtitle: 'settings.groups.customers.subtitle',
    icon: 'tabler-stethoscope',
    links: [
      { title: 'settings.links.specialities.title', description: 'settings.links.specialities.description', to: { name: 'tenant-specialities' }, icon: 'tabler-stethoscope', resource: 'specialities', count: 'specialities' },
      { title: 'settings.links.segmentations.title', description: 'settings.links.segmentations.description', to: { name: 'tenant-segmentations' }, icon: 'tabler-chart-pie', resource: 'segmentations', count: 'segmentations' },
      { title: 'settings.links.priorities.title', description: 'settings.links.priorities.description', to: { name: 'tenant-priorities' }, icon: 'tabler-flag-3', resource: 'priorities', count: 'priorities' },
    ],
  },
  {
    title: 'settings.groups.access.title',
    subtitle: 'settings.groups.access.subtitle',
    icon: 'tabler-shield-lock',
    links: [
      { title: 'settings.links.roles.title', description: 'settings.links.roles.description', to: { name: 'tenant-roles' }, icon: 'tabler-shield-lock', resource: 'roles', count: 'roles' },
      // Activity log comes with the lab log, module 10.
    ],
  },
]

/** Every page of the Studio home, for the rail: they all belong to "Paramètres". */
export const settingsPages = ['tenant-role-access', 'tenant-permissions', ...settingsGroups.flatMap((group) => group.links.map((link) => String((link.to as { name: string }).name)))]
