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
