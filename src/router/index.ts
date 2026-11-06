import { createRouter, createWebHistory } from 'vue-router'
import { installGuards } from '@/router/guards'
import { space } from '@/space'

const centralRoutes = [
  {
    path: '/',
    component: () => import('@/layouts/CentralLayout.vue'),
    children: [
      { path: 'users', name: 'central-users', component: () => import('@/views/central/users/UsersView.vue'), meta: { permission: 'users.show' } },
      { path: 'roles', name: 'central-roles', component: () => import('@/views/central/roles/RolesView.vue'), meta: { permission: 'roles.show' } },
      { path: 'roles/:id/access', name: 'central-role-access', component: () => import('@/views/central/roles/RoleAccessView.vue'), meta: { permission: 'roles.update' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    ...(space.isCentral ? centralRoutes : []),
    {
      path: '/',
      component: () => import('@/layouts/SignInLayout.vue'),
      meta: { public: true },
      children: [
        { path: 'login', name: 'login', component: () => import('@/views/auth/LoginView.vue') },
        { path: 'forgot-password', name: 'forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue') },
        { path: 'set-password', name: 'set-password', component: () => import('@/views/auth/SetPasswordView.vue') },
      ],
    },
  ],
})

installGuards(router)

export default router
