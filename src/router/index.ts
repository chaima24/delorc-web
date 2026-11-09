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
      { path: 'holidays', name: 'tenant-holidays', component: () => import('@/views/tenant/holidays/HolidayListView.vue'), meta: { permission: 'holidays.show' } },
      { path: 'sub-wilaya-zones', name: 'tenant-sub-wilaya-zones', component: () => import('@/views/tenant/sub-wilaya-zones/SubWilayaZoneListView.vue'), meta: { permission: 'sub-wilaya-zones.show' } },
      { path: 'settings', name: 'tenant-settings', component: () => import('@/views/tenant/settings/SettingsHubView.vue') },
      { path: 'roles', name: 'tenant-roles', component: () => import('@/views/tenant/roles/RoleListView.vue'), meta: { permission: 'roles.show' } },
      { path: 'roles/:id/access', name: 'tenant-role-access', component: () => import('@/views/tenant/roles/RoleAccessView.vue'), props: true, meta: { permission: 'roles.show' } },
      { path: 'permissions', name: 'tenant-permissions', component: () => import('@/views/tenant/permissions/PermissionListView.vue'), meta: { permission: 'roles.show' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Central: `home` sends to the first page the person may see (guards). A lab: `home` is the welcome page.
    ...(space.isCentral ? [{ path: '/', name: 'home', component: () => import('@/views/HomeView.vue') }, ...centralRoutes] : labRoutes),
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
