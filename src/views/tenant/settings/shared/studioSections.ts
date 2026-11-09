/** A page of a Studio section, shown in the strip above its list. */
export interface StudioLevel {
  route: string
  /** Permission resource (`{resource}.show`). */
  resource: string
  icon: string
  /** i18n key */
  label: string
  /** Key in GET /studio/summary counts (no number shown without it). */
  count?: string
}

export interface StudioSection {
  /** i18n key of the section (breadcrumb). */
  label: string
  levels: StudioLevel[]
}

export const geographySection: StudioSection = {
  label: 'settings.groups.geography.title',
  levels: [
    { route: 'tenant-countries', resource: 'countries', icon: 'tabler-world', label: 'geo.title.countries', count: 'countries' },
    { route: 'tenant-regions', resource: 'regions', icon: 'tabler-map', label: 'geo.title.regions', count: 'regions' },
    { route: 'tenant-wilayas', resource: 'wilayas', icon: 'tabler-map-pin', label: 'geo.title.wilayas', count: 'wilayas' },
    { route: 'tenant-communes', resource: 'communes', icon: 'tabler-building-community', label: 'geo.title.communes', count: 'communes' },
    { route: 'tenant-sub-wilaya-zones', resource: 'sub-wilaya-zones', icon: 'tabler-hexagons', label: 'geo.title.zones', count: 'sub_wilaya_zones' },
  ],
}

export const customersSection: StudioSection = {
  label: 'settings.groups.customers.title',
  levels: [
    { route: 'tenant-specialities', resource: 'specialities', icon: 'tabler-stethoscope', label: 'customersSetup.title.specialities', count: 'specialities' },
    { route: 'tenant-segmentations', resource: 'segmentations', icon: 'tabler-chart-pie', label: 'customersSetup.title.segmentations', count: 'segmentations' },
    { route: 'tenant-priorities', resource: 'priorities', icon: 'tabler-flag-3', label: 'customersSetup.title.priorities', count: 'priorities' },
  ],
}

export const fieldSection: StudioSection = {
  label: 'settings.groups.field.title',
  levels: [
    { route: 'tenant-activity-types', resource: 'activity-types', icon: 'tabler-run', label: 'fieldSetup.title.activityTypes', count: 'activity_types' },
    { route: 'tenant-event-types', resource: 'event-types', icon: 'tabler-calendar-event', label: 'fieldSetup.title.eventTypes', count: 'event_types' },
    { route: 'tenant-canals', resource: 'canals', icon: 'tabler-broadcast', label: 'fieldSetup.title.canals', count: 'canals' },
    { route: 'tenant-materiels', resource: 'materiels', icon: 'tabler-gift', label: 'fieldSetup.title.materiels', count: 'materiels' },
    // Expense types and expense settings come with the Expenses module.
    { route: 'tenant-holidays', resource: 'holidays', icon: 'tabler-calendar-off', label: 'holidays.title', count: 'holidays' },
  ],
}

export const rulesSection: StudioSection = {
  label: 'settings.groups.rules.title',
  levels: [
    // Planning rules and validation rules come with teams and people.
    { route: 'tenant-languages', resource: 'languages', icon: 'tabler-language', label: 'rulesSetup.title.languages', count: 'languages' },
  ],
}

export const accessSection: StudioSection = {
  label: 'settings.groups.access.title',
  levels: [
    { route: 'tenant-roles', resource: 'roles', icon: 'tabler-user-shield', label: 'access.title.roles', count: 'roles' },
    { route: 'tenant-permissions', resource: 'roles', icon: 'tabler-table', label: 'access.title.matrix' },
    { route: 'tenant-logs', resource: 'activity-log', icon: 'tabler-history', label: 'access.title.logs' },
  ],
}
