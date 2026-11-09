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

export const accessSection: StudioSection = {
  label: 'settings.groups.access.title',
  levels: [
    { route: 'tenant-roles', resource: 'roles', icon: 'tabler-user-shield', label: 'access.title.roles', count: 'roles' },
    { route: 'tenant-permissions', resource: 'roles', icon: 'tabler-table', label: 'access.title.matrix' },
    // Journal (tenant-logs) comes with the lab log, module 10.
  ],
}
