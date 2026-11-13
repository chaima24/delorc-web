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
  /** The lab's plan switch it needs (`module.expenses`): hidden without it. */
  feature?: string
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
      { title: 'settings.links.ruleTypes.title', description: 'settings.links.ruleTypes.description', to: { name: 'tenant-rule-types' }, icon: 'tabler-list-details', resource: 'rule-types' },
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
    title: 'settings.groups.field.title',
    subtitle: 'settings.groups.field.subtitle',
    icon: 'tabler-route',
    links: [
      { title: 'settings.links.activityTypes.title', description: 'settings.links.activityTypes.description', to: { name: 'tenant-activity-types' }, icon: 'tabler-run', resource: 'activity-types', count: 'activity_types' },
      { title: 'settings.links.eventTypes.title', description: 'settings.links.eventTypes.description', to: { name: 'tenant-event-types' }, icon: 'tabler-calendar-event', resource: 'event-types', count: 'event_types' },
      { title: 'settings.links.canals.title', description: 'settings.links.canals.description', to: { name: 'tenant-canals' }, icon: 'tabler-broadcast', resource: 'canals', count: 'canals' },
      { title: 'settings.links.cancelReasons.title', description: 'settings.links.cancelReasons.description', to: { name: 'tenant-cancel-reasons' }, icon: 'tabler-calendar-x', resource: 'cancel-reasons', count: 'cancel_reasons' },
      { title: 'settings.links.materiels.title', description: 'settings.links.materiels.description', to: { name: 'tenant-materiels' }, icon: 'tabler-gift', resource: 'materiels', count: 'materiels' },
      { title: 'settings.links.expenseTypes.title', description: 'settings.links.expenseTypes.description', to: { name: 'tenant-expense-types' }, icon: 'tabler-receipt', resource: 'expense-types', count: 'expense_types', feature: 'module.expenses' },
      { title: 'settings.links.expenseSettings.title', description: 'settings.links.expenseSettings.description', to: { name: 'tenant-expense-settings' }, icon: 'tabler-receipt-2', resource: 'expense-settings', count: 'expense_settings', feature: 'module.expenses' },
      { title: 'settings.links.holidays.title', description: 'settings.links.holidays.description', to: { name: 'tenant-holidays' }, icon: 'tabler-calendar-off', resource: 'holidays', count: 'holidays' },
    ],
  },
  {
    title: 'settings.groups.rules.title',
    subtitle: 'settings.groups.rules.subtitle',
    icon: 'tabler-settings',
    links: [
      { title: 'settings.links.planningRules.title', description: 'settings.links.planningRules.description', to: { name: 'tenant-planning-rules' }, icon: 'tabler-calendar-time', resource: 'planning-rules', count: 'planning_rules' },
      { title: 'settings.links.validationRules.title', description: 'settings.links.validationRules.description', to: { name: 'tenant-validation-rules' }, icon: 'tabler-shield-check', resource: 'validation-rules', count: 'validation_rules' },
      { title: 'settings.links.languages.title', description: 'settings.links.languages.description', to: { name: 'tenant-languages' }, icon: 'tabler-language', resource: 'languages', count: 'languages' },
    ],
  },
  {
    title: 'settings.groups.access.title',
    subtitle: 'settings.groups.access.subtitle',
    icon: 'tabler-shield-lock',
    links: [
      { title: 'settings.links.roles.title', description: 'settings.links.roles.description', to: { name: 'tenant-roles' }, icon: 'tabler-shield-lock', resource: 'roles', count: 'roles' },
      { title: 'settings.links.logs.title', description: 'settings.links.logs.description', to: { name: 'tenant-logs' }, icon: 'tabler-history', resource: 'activity-log' },
    ],
  },
]

/** Every page of the Studio home, for the rail: they all belong to "Paramètres". */
export const settingsPages = ['tenant-role-access', 'tenant-permissions', 'tenant-logs', ...settingsGroups.flatMap((group) => group.links.map((link) => String((link.to as { name: string }).name)))]
