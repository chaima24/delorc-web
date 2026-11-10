import type { RouteLocationRaw } from 'vue-router'
import type { StudioCounts } from '@/api/tenant/studio'

export interface StudioSetupStep {
  key: string
  /** Opens the page where the step is done. */
  to: RouteLocationRaw
  done: (counts: StudioCounts) => boolean
}

/** What a lab needs before reps can work, in dependency order. */
export const studioSetupSteps: StudioSetupStep[] = [
  { key: 'geography', to: { name: 'tenant-wilayas' }, done: c => (c.wilayas ?? 0) > 0 && (c.communes ?? 0) > 0 },
  { key: 'roles', to: { name: 'tenant-roles' }, done: c => (c.roles ?? 0) > 0 },
  { key: 'teams', to: { name: 'tenant-teams' }, done: c => (c.teams ?? 0) > 0 },
  // The lab's first admin always exists: users are set up once someone else is added.
  { key: 'users', to: { name: 'tenant-users' }, done: c => (c.users ?? 0) > 1 },
  { key: 'products', to: { name: 'tenant-products' }, done: c => (c.products ?? 0) > 0 },
  { key: 'customers', to: { name: 'tenant-specialities' }, done: c => (c.specialities ?? 0) > 0 && (c.cycle_segmentations ?? 0) > 0 },
  { key: 'rules', to: { name: 'tenant-planning-rules' }, done: c => (c.validation_rules ?? 0) > 0 && (c.planning_rules ?? 0) > 0 },
]
