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

export const accessSection: StudioSection = {
  label: 'settings.groups.access.title',
  levels: [
    { route: 'tenant-roles', resource: 'roles', icon: 'tabler-user-shield', label: 'access.title.roles', count: 'roles' },
    { route: 'tenant-permissions', resource: 'roles', icon: 'tabler-table', label: 'access.title.matrix' },
    // Journal (tenant-logs) comes with the lab log, module 10.
  ],
}
