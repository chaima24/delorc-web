import { createRouter, createWebHistory } from 'vue-router'
import { installGuards } from '@/router/guards'
import { space } from '@/space'

const centralRoutes = [
  {
    path: '/',
    component: () => import('@/layouts/CentralLayout.vue'),
    children: [
      { path: 'labs', name: 'central-labs', component: () => import('@/views/central/labs/LabsView.vue'), meta: { permission: 'labs.show' } },
      { path: 'labs/new', name: 'central-lab-new', component: () => import('@/views/central/labs/NewLabView.vue'), meta: { permission: 'labs.create' } },
      { path: 'labs/:id', name: 'central-lab', component: () => import('@/views/central/labs/LabView.vue'), meta: { permission: 'labs.show' } },
      { path: 'usage', name: 'central-usage', component: () => import('@/views/central/usage/UsageView.vue'), meta: { permission: 'usage.show' } },
      { path: 'users', name: 'central-users', component: () => import('@/views/central/users/UsersView.vue'), meta: { permission: 'users.show' } },
      { path: 'roles', name: 'central-roles', component: () => import('@/views/central/roles/RolesView.vue'), meta: { permission: 'roles.show' } },
      { path: 'roles/:id/access', name: 'central-role-access', component: () => import('@/views/central/roles/RoleAccessView.vue'), meta: { permission: 'roles.update' } },
      { path: 'activity', name: 'central-activity', component: () => import('@/views/central/activity/ActivityLogView.vue'), meta: { permission: 'activity-log.show' } },
      { path: 'translations', name: 'central-translations', component: () => import('@/views/central/translations/TextsView.vue'), meta: { permission: 'translations.show' } },
      { path: 'geography', name: 'central-countries', component: () => import('@/views/central/geography/CountriesView.vue'), meta: { permission: 'geography.show' } },
      { path: 'geography/:code', name: 'central-country', component: () => import('@/views/central/geography/PlacesView.vue'), meta: { permission: 'geography.show' } },
      { path: 'plans', name: 'central-plans', component: () => import('@/views/central/plans/PlansView.vue'), meta: { permission: 'plans.show' } },
      { path: 'settings', name: 'central-settings', component: () => import('@/views/central/settings/SettingsView.vue'), meta: { permission: 'settings.show' } },
      { path: 'profile', name: 'central-profile', component: () => import('@/views/central/profile/ProfileView.vue') },
      { path: 'languages', name: 'central-languages', component: () => import('@/views/central/translations/LanguagesView.vue'), meta: { permission: 'languages.show' } },
    ],
  },
]

/** A lab: its layout, the welcome page (until the dashboard) and my profile. Each module adds its pages here. */
const labRoutes = [
  {
    path: '/',
    component: () => import('@/layouts/LabLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/views/tenant/HomeView.vue') },
      { path: 'profile', name: 'tenant-profile', component: () => import('@/views/tenant/ProfileView.vue') },
      // Studio › Paramètres, then its sections (Géographie, Accès)
      { path: 'countries', name: 'tenant-countries', component: () => import('@/views/tenant/countries/CountryListView.vue'), meta: { permission: 'countries.show' } },
      { path: 'regions', name: 'tenant-regions', component: () => import('@/views/tenant/regions/RegionListView.vue'), meta: { permission: 'regions.show' } },
      { path: 'wilayas', name: 'tenant-wilayas', component: () => import('@/views/tenant/wilayas/WilayaListView.vue'), meta: { permission: 'wilayas.show' } },
      { path: 'communes', name: 'tenant-communes', component: () => import('@/views/tenant/communes/CommuneListView.vue'), meta: { permission: 'communes.show' } },
      { path: 'specialities', name: 'tenant-specialities', component: () => import('@/views/tenant/specialities/SpecialityListView.vue'), meta: { permission: 'specialities.show' } },
      { path: 'segmentations', name: 'tenant-segmentations', component: () => import('@/views/tenant/segmentations/SegmentationListView.vue'), meta: { permission: 'segmentations.show' } },
      { path: 'priorities', name: 'tenant-priorities', component: () => import('@/views/tenant/priorities/PriorityListView.vue'), meta: { permission: 'priorities.show' } },
      { path: 'activity-types', name: 'tenant-activity-types', component: () => import('@/views/tenant/activity-types/ActivityTypeListView.vue'), meta: { permission: 'activity-types.show' } },
      { path: 'event-types', name: 'tenant-event-types', component: () => import('@/views/tenant/event-types/EventTypeListView.vue'), meta: { permission: 'event-types.show' } },
      { path: 'canals', name: 'tenant-canals', component: () => import('@/views/tenant/canals/CanalListView.vue'), meta: { permission: 'canals.show' } },
      { path: 'materiels', name: 'tenant-materiels', component: () => import('@/views/tenant/materiels/MaterielListView.vue'), meta: { permission: 'materiels.show' } },
      { path: 'expense-types', name: 'tenant-expense-types', component: () => import('@/views/tenant/expense-types/ExpenseTypeListView.vue'), meta: { permission: 'expense-types.show' } },
      { path: 'holidays', name: 'tenant-holidays', component: () => import('@/views/tenant/holidays/HolidayListView.vue'), meta: { permission: 'holidays.show' } },
      { path: 'hcps', name: 'tenant-hcps', component: () => import('@/views/tenant/hcps/HcpListView.vue'), meta: { permission: 'hcps.show' } },
      { path: 'hcps/duplicates', name: 'tenant-hcp-duplicates', component: () => import('@/views/tenant/hcps/duplicates/HcpDuplicatesView.vue'), meta: { permission: 'hcps.show' } },
      { path: 'hcps/merge/:keep/:other', name: 'tenant-hcp-merge', component: () => import('@/views/tenant/hcps/duplicates/HcpMergeView.vue'), props: true, meta: { permission: 'hcps.merge' } },
      { path: 'hcps/requests', name: 'tenant-hcp-requests', component: () => import('@/views/tenant/hcps/requests/HcpRequestsView.vue'), meta: { permission: 'hcp-requests.approve' } },
      { path: 'hcps/proposals', name: 'tenant-hcp-proposals', component: () => import('@/views/tenant/hcps/requests/HcpProposalsView.vue'), meta: { permission: 'hcp-requests.show' } },
      { path: 'hcps/import', name: 'tenant-hcp-import', component: () => import('@/views/tenant/hcps/import/HcpImportView.vue'), meta: { permission: 'hcps.import' } },
      { path: 'hcps/:id', name: 'tenant-hcp-detail', component: () => import('@/views/tenant/hcps/HcpDetailView.vue'), props: true, meta: { permission: 'hcps.show' } },
      { path: 'hcos', name: 'tenant-hcos', component: () => import('@/views/tenant/hcos/HcoListView.vue'), meta: { permission: 'hcos.show' } },
      { path: 'planning-rules', name: 'tenant-planning-rules', component: () => import('@/views/tenant/planning-rules/PlanningRuleListView.vue'), meta: { permission: 'planning-rules.show' } },
      { path: 'validation-rules', name: 'tenant-validation-rules', component: () => import('@/views/tenant/validation-rules/ValidationRuleListView.vue'), meta: { permission: 'validation-rules.show' } },
      { path: 'languages', name: 'tenant-languages', component: () => import('@/views/tenant/languages/LanguageListView.vue'), meta: { permission: 'languages.show' } },
      { path: 'sub-wilaya-zones', name: 'tenant-sub-wilaya-zones', component: () => import('@/views/tenant/sub-wilaya-zones/SubWilayaZoneListView.vue'), meta: { permission: 'sub-wilaya-zones.show' } },
      { path: 'rule-types', name: 'tenant-rule-types', component: () => import('@/views/tenant/rule-types/RuleTypeListView.vue'), meta: { permission: 'rule-types.show' } },
      // Professionnels › Consentements (docs/api/consents.md).
      { path: 'consents', name: 'tenant-consents', component: () => import('@/views/tenant/consents/ConsentListView.vue'), meta: { permission: 'consents.show' } },
      // Planifier › Territoires (docs/api/territories.md).
      { path: 'territories', name: 'tenant-territories', component: () => import('@/views/tenant/territories/TerritoryListView.vue'), meta: { permission: 'territories.show' } },
      { path: 'territories/new', name: 'tenant-territory-new', component: () => import('@/views/tenant/territories/TerritoryCreateView.vue'), meta: { permission: 'territories.create' } },
      { path: 'territories/:id(\\d+)/covers', name: 'tenant-territory-covers', component: () => import('@/views/tenant/territories/TerritoryCoversEditView.vue'), props: true, meta: { permission: 'territories.update' } },
      { path: 'territories/:id(\\d+)', name: 'tenant-territory-detail', component: () => import('@/views/tenant/territories/TerritoryDetailView.vue'), props: true, meta: { permission: 'territories.show' } },
      // Planifier › Activités (docs/api/activities.md).
      { path: 'activities', name: 'tenant-activities', component: () => import('@/views/tenant/activities/ActivityListView.vue'), meta: { permission: 'activities.show' } },
      // Planifier › Objectifs, Fréquences (docs/api/objectives-frequencies.md).
      { path: 'objectives', name: 'tenant-objectives', component: () => import('@/views/tenant/objectives/ObjectiveListView.vue'), meta: { permission: 'objectives.show' } },
      { path: 'frequencies', name: 'tenant-frequencies', component: () => import('@/views/tenant/frequencies/FrequencyListView.vue'), meta: { permission: 'frequencies.show' } },
      { path: 'settings', name: 'tenant-settings', component: () => import('@/views/tenant/settings/SettingsHubView.vue') },
      { path: 'roles', name: 'tenant-roles', component: () => import('@/views/tenant/roles/RoleListView.vue'), meta: { permission: 'roles.show' } },
      { path: 'roles/:id/access', name: 'tenant-role-access', component: () => import('@/views/tenant/roles/RoleAccessView.vue'), props: true, meta: { permission: 'roles.show' } },
      { path: 'users', name: 'tenant-users', component: () => import('@/views/tenant/users/UserListView.vue'), meta: { permission: 'users.show' } },
      { path: 'users/:id', name: 'tenant-user-detail', component: () => import('@/views/tenant/users/UserDetailView.vue'), props: true, meta: { permission: 'users.show' } },
      { path: 'teams', name: 'tenant-teams', component: () => import('@/views/tenant/teams/TeamListView.vue'), meta: { permission: 'teams.show' } },
      { path: 'brands', name: 'tenant-brands', component: () => import('@/views/tenant/brands/BrandListView.vue'), meta: { permission: 'brands.show' } },
      { path: 'products', name: 'tenant-products', component: () => import('@/views/tenant/products/ProductListView.vue'), meta: { permission: 'products.show' } },
      { path: 'products/:id', name: 'tenant-product-detail', component: () => import('@/views/tenant/products/ProductDetailView.vue'), props: true, meta: { permission: 'products.show' } },
      { path: 'logs', name: 'tenant-logs', component: () => import('@/views/tenant/logs/ActivityLogListView.vue'), meta: { permission: 'activity-log.show' } },
      { path: 'permissions', name: 'tenant-permissions', component: () => import('@/views/tenant/permissions/PermissionListView.vue'), meta: { permission: 'roles.show' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Central: `home` sends to the first page the person may see (guards). A lab: `home` is the welcome page.
    ...(space.isCentral ? [{ path: '/', name: 'home', component: () => import('@/views/HomeView.vue') }, ...centralRoutes] : labRoutes),
    // A lab's public page: a professional answers a consent from its link or QR code. No sign-in, no app shell.
    ...(space.isCentral ? [] : [{ path: '/consent/:token', name: 'public-consent', component: () => import('@/views/public/ConsentSignView.vue'), props: true, meta: { public: true } }]),
    {
      path: '/',
      component: () => import('@/layouts/SignInLayout.vue'),
      meta: { public: true },
      children: [
        { path: 'login', name: 'login', component: () => import('@/views/auth/LoginView.vue') },
        { path: 'forgot-password', name: 'forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue') },
        { path: 'set-password', name: 'set-password', component: () => import('@/views/auth/SetPasswordView.vue') },
        // Central only for now: lab users get My profile with the lab modules.
        ...(space.isCentral ? [{ path: 'email/confirm', name: 'confirm-email', component: () => import('@/views/auth/ConfirmEmailView.vue') }] : []),
        { path: 'lab-unavailable', name: 'lab-unavailable', component: () => import('@/views/auth/LabUnavailableView.vue') },
      ],
    },
  ],
})

installGuards(router)

export default router
