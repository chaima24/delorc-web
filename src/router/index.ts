import { createRouter, createWebHistory } from 'vue-router'
import { installGuards } from '@/router/guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
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
