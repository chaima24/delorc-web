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
  // Each module adds its step, in this order: geography, roles, teams, users, products, customers, rules.
  { key: 'roles', to: { name: 'tenant-roles' }, done: c => (c.roles ?? 0) > 0 },
]
