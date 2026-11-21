import type { RouteLocationRaw } from 'vue-router'
import { settingsPages } from '@/views/tenant/settings/settingsGroups'

/** A menu entry: text key, route and Tabler icon. `resource` hides it without `{resource}.show`. */
export interface NavLink {
  title: string
  to: RouteLocationRaw
  icon: string
  resource?: string
  /** A full permission the entry needs when it is not `{resource}.show` (`visits.validate`). */
  permission?: string
  /** Other pages that belong to this entry (detail pages, sub-pages). */
  matches?: string[]
  /** The lab's plan switch it needs (`module.expenses`): hidden without it. */
  feature?: string
}

export interface Workspace {
  id: string
  /** Text key. */
  title: string
  icon: string
  links: NavLink[]
}

/**
 * The lab's workspaces, in workflow order. Only built pages appear here: each module adds its links
 * (2b Users, 2c Teams and Brands, organisations). A workspace with no link the person may open is not shown.
 */
export const workspaces: Workspace[] = [
  {
    id: 'studio',
    title: 'nav.workspaces.studio',
    icon: 'tabler-adjustments',
    links: [
      // Paramètres: the Studio home and every settings page it opens.
      { title: 'nav.settings', to: { name: 'tenant-settings' }, icon: 'tabler-settings', matches: settingsPages },
      { title: 'nav.organization.users', to: { name: 'tenant-users' }, icon: 'tabler-user-cog', resource: 'users', matches: ['tenant-user-detail'] },
      { title: 'nav.organization.teams', to: { name: 'tenant-teams' }, icon: 'tabler-users-group', resource: 'teams' },
      { title: 'nav.catalog.brands', to: { name: 'tenant-brands' }, icon: 'tabler-tags', resource: 'brands' },
      { title: 'nav.catalog.products', to: { name: 'tenant-products' }, icon: 'tabler-pill', resource: 'products', matches: ['tenant-product-detail'] },
    ],
  },
  {
    // Planifier: territories, cycles, activities, objectives, frequencies.
    id: 'plan',
    title: 'nav.workspaces.plan',
    icon: 'tabler-calendar-stats',
    links: [
      { title: 'nav.plan.territories', to: { name: 'tenant-territories' }, icon: 'tabler-map-pins', resource: 'territories', matches: ['tenant-territory-detail', 'tenant-territory-new', 'tenant-territory-covers'] },
      { title: 'nav.plan.cycles', to: { name: 'tenant-cycles' }, icon: 'tabler-rotate-clockwise-2', resource: 'cycles', matches: ['tenant-cycle-detail', 'tenant-cycle-create'] },
      { title: 'nav.plan.activities', to: { name: 'tenant-activities' }, icon: 'tabler-calendar-event', resource: 'activities' },
      { title: 'nav.plan.objectives', to: { name: 'tenant-objectives' }, icon: 'tabler-target-arrow', resource: 'objectives' },
      { title: 'nav.plan.frequencies', to: { name: 'tenant-frequencies' }, icon: 'tabler-repeat', resource: 'frequencies' },
    ],
  },
  {
    // Professionnels de santé.
    id: 'customers',
    title: 'nav.workspaces.customers',
    icon: 'tabler-users',
    links: [
      { title: 'nav.organization.hcps', to: { name: 'tenant-hcps' }, icon: 'tabler-stethoscope', resource: 'hcps', matches: ['tenant-hcp-detail', 'tenant-hcp-import', 'tenant-hcp-duplicates', 'tenant-hcp-merge', 'tenant-hcp-requests', 'tenant-hcp-proposals'] },
      { title: 'nav.organization.hcos', to: { name: 'tenant-hcos' }, icon: 'tabler-building-hospital', resource: 'hcos' },
      { title: 'nav.organization.consents', to: { name: 'tenant-consents' }, icon: 'tabler-shield-check', resource: 'consents' },
    ],
  },
  {
    // Visites (docs/api/visits.md) and their planning calendar (docs/api/visit-planning.md).
    id: 'visits',
    title: 'nav.workspaces.visits',
    icon: 'tabler-map-pin-check',
    links: [
      { title: 'nav.visits.visits', to: { name: 'tenant-visits' }, icon: 'tabler-map-pin-check', resource: 'visits', matches: ['tenant-visit-new', 'tenant-visit-detail', 'tenant-visit-report'] },
      { title: 'nav.visits.planning', to: { name: 'tenant-visit-planning' }, icon: 'tabler-calendar-week', resource: 'visits' },
      // The approval of the cycles' plans (docs/api/visit-approval.md): for the people who approve.
      { title: 'nav.visits.plans', to: { name: 'tenant-visit-plans' }, icon: 'tabler-checklist', permission: 'visits.validate' },
    ],
  },
  {
    // Engager: what reps show and hand out (docs/api/advs.md), the campaigns (docs/api/campaigns.md), their email and SMS
    // templates (docs/api/campaign-messages.md), materials (docs/api/materials.md), events (docs/api/events.md), marketing actions (docs/api/marketing-actions.md).
    id: 'engage',
    title: 'nav.workspaces.engage',
    icon: 'tabler-presentation',
    links: [
      { title: 'nav.catalog.advs', to: { name: 'tenant-advs' }, icon: 'tabler-presentation', resource: 'advs' },
      { title: 'nav.engage.campaigns', to: { name: 'tenant-campaigns' }, icon: 'tabler-speakerphone', resource: 'campaigns', matches: ['tenant-campaign', 'tenant-campaign-message', 'tenant-campaign-sending', 'tenant-campaign-sending-new', 'tenant-campaign-material', 'tenant-marketing-action'] },
      { title: 'nav.engage.materials', to: { name: 'tenant-material-stocks' }, icon: 'tabler-gift', resource: 'campaigns' },
      { title: 'nav.engage.events', to: { name: 'tenant-events' }, icon: 'tabler-calendar-event', resource: 'events', matches: ['tenant-event'] },
      { title: 'nav.engage.actions', to: { name: 'tenant-marketing-actions' }, icon: 'tabler-target-arrow', resource: 'campaigns' },
      { title: 'nav.engage.templates', to: { name: 'tenant-mail-templates' }, icon: 'tabler-template', resource: 'mail-templates', matches: ['tenant-mail-template'] },
    ],
  },
  {
    // Coaching: the sessions (docs/api/coaching-sessions.md) and their setup (docs/api/coaching-setup.md).
    id: 'coaching',
    title: 'nav.workspaces.coaching',
    icon: 'tabler-school',
    links: [
      { title: 'nav.coaching.sessions', to: { name: 'tenant-coaching-sessions' }, icon: 'tabler-school', resource: 'coaching-sessions', matches: ['tenant-coaching-session', 'tenant-coaching-session-fill'] },
      { title: 'nav.coaching.programs', to: { name: 'tenant-coachings' }, icon: 'tabler-calendar-user', resource: 'coaching-setup', matches: ['tenant-coaching-detail'] },
      { title: 'nav.coaching.grid', to: { name: 'tenant-coaching-grid' }, icon: 'tabler-list-check', resource: 'coaching-setup' },
      { title: 'nav.coaching.settings', to: { name: 'tenant-coaching-settings' }, icon: 'tabler-settings', resource: 'coaching-setup' },
    ],
  },
  {
    // Commandes: the orders (docs/api/orders.md), offers, packs and settings (docs/api/orders-setup.md); plan switch module.orders.
    id: 'orders',
    title: 'nav.workspaces.orders',
    icon: 'tabler-shopping-cart',
    links: [
      { title: 'nav.orders.orders', to: { name: 'tenant-orders' }, icon: 'tabler-file-invoice', resource: 'orders', feature: 'module.orders', matches: ['tenant-order', 'tenant-order-new'] },
      { title: 'nav.orders.packs', to: { name: 'tenant-packs' }, icon: 'tabler-discount', resource: 'orders-setup', feature: 'module.orders', matches: ['tenant-pack'] },
      { title: 'nav.orders.packCommandes', to: { name: 'tenant-pack-commandes' }, icon: 'tabler-package', resource: 'orders-setup', feature: 'module.orders', matches: ['tenant-pack-commande'] },
      { title: 'nav.orders.settings', to: { name: 'tenant-order-settings' }, icon: 'tabler-settings', resource: 'orders-setup', feature: 'module.orders' },
    ],
  },
  {
    // Veille concurrentielle: notes on competitors and the lists they pick from (docs/api/competitive-informations.md); plan switch module.competitive.
    id: 'competitive',
    title: 'nav.workspaces.competitive',
    icon: 'tabler-binoculars',
    links: [
      { title: 'nav.competitive.notes', to: { name: 'tenant-competitive-informations' }, icon: 'tabler-notes', resource: 'competitive-informations', feature: 'module.competitive', matches: ['tenant-competitive-information'] },
      { title: 'nav.competitive.settings', to: { name: 'tenant-competitive-settings' }, icon: 'tabler-settings', resource: 'competitive-types', feature: 'module.competitive' },
    ],
  },
  {
    // Enquêtes: surveys and their questions (docs/api/surveys.md); plan switch module.surveys. 19b–19d add their pages.
    id: 'surveys',
    title: 'nav.workspaces.surveys',
    icon: 'tabler-clipboard-list',
    links: [
      { title: 'nav.surveys.surveys', to: { name: 'tenant-surveys' }, icon: 'tabler-clipboard-list', resource: 'surveys', feature: 'module.surveys', matches: ['tenant-survey'] },
      { title: 'nav.surveys.mine', to: { name: 'tenant-my-surveys' }, icon: 'tabler-clipboard-check', resource: 'surveys', feature: 'module.surveys' },
    ],
  },
  {
    // Réclamations: complaints about work, handled by complaints.handle, never by the hierarchy (docs/api/complaints.md); plan switch module.complaints.
    id: 'complaints',
    title: 'nav.workspaces.complaints',
    icon: 'tabler-message-report',
    links: [
      { title: 'nav.complaints.mine', to: { name: 'tenant-complaints' }, icon: 'tabler-message-report', feature: 'module.complaints', matches: ['tenant-complaint'] },
      { title: 'nav.complaints.inbox', to: { name: 'tenant-complaints-inbox' }, icon: 'tabler-inbox', permission: 'complaints.handle', feature: 'module.complaints' },
      { title: 'nav.complaints.settings', to: { name: 'tenant-complaint-settings' }, icon: 'tabler-settings', permission: 'complaints.handle', feature: 'module.complaints' },
    ],
  },
  {
    // Équipe: expenses (docs/api/expenses.md).
    id: 'team',
    title: 'nav.workspaces.team',
    icon: 'tabler-users-group',
    links: [
      { title: 'nav.expenses.expenses', to: { name: 'tenant-expenses' }, icon: 'tabler-receipt-tax', resource: 'expenses', feature: 'module.expenses', matches: ['tenant-expense-mine', 'tenant-expense-month', 'tenant-expense-new', 'tenant-expense-edit'] },
    ],
  },
]

export function routeName(link: NavLink): string | undefined {
  const to = link.to as { name?: string } | undefined

  return typeof to?.name === 'string' ? to.name : undefined
}
