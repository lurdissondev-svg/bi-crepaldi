import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Extend RouteMeta to include our custom properties
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    pageSlug?: string
    requiresUserManagement?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  // Public route - Login
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { requiresAuth: false },
  },

  // Protected routes
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'resumo',
        component: () => import('@/pages/ResumoPage.vue'),
        meta: { pageSlug: 'resumo' },
      },
      {
        path: 'faturamento',
        name: 'faturamento',
        component: () => import('@/pages/FaturamentoPage.vue'),
        meta: { pageSlug: 'faturamento' },
      },
      {
        path: 'marketing',
        name: 'marketing',
        component: () => import('@/pages/MarketingPage.vue'),
        meta: { pageSlug: 'marketing' },
      },
      {
        path: 'comercial',
        name: 'comercial',
        component: () => import('@/pages/ComercialPage.vue'),
        meta: { pageSlug: 'comercial' },
      },
      {
        path: 'atendimento',
        name: 'atendimento',
        component: () => import('@/pages/AtendimentoPage.vue'),
        meta: { pageSlug: 'atendimento' },
      },
      {
        path: 'metas',
        name: 'metas',
        component: () => import('@/pages/MetasPage.vue'),
        meta: { pageSlug: 'metas' },
      },
      {
        path: 'pacientes',
        name: 'pacientes',
        component: () => import('@/pages/PacientesPage.vue'),
        meta: { pageSlug: 'pacientes' },
      },
      {
        path: 'config/meta-ads',
        name: 'meta-ads',
        component: () => import('@/pages/MetaAdsConfigPage.vue'),
        meta: { pageSlug: 'meta-ads' },
      },
      {
        path: 'como-funciona',
        name: 'como-funciona',
        component: () => import('@/pages/ComoFuncionaPage.vue'),
        meta: { pageSlug: 'como-funciona' },
      },
      {
        path: 'usuarios',
        name: 'usuarios',
        component: () => import('@/pages/UsuariosPage.vue'),
        meta: { pageSlug: 'usuarios', requiresUserManagement: true },
      },
    ],
  },

  // Catch-all redirect
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // Initialize auth state on first load
  if (!authStore.isInitialized) {
    await authStore.initialize()
  }

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth !== false)
  const pageSlug = to.meta.pageSlug as string | undefined
  const requiresUserManagement = to.meta.requiresUserManagement as boolean | undefined

  // Redirect to login if authentication required but not authenticated
  if (requiresAuth && !authStore.isAuthenticated) {
    return next({
      name: 'login',
      query: { redirect: to.fullPath },
    })
  }

  // Redirect to home if already authenticated and trying to access login
  if (to.name === 'login' && authStore.isAuthenticated) {
    return next({ name: 'resumo' })
  }

  // Check user management permission
  if (requiresUserManagement && !authStore.canManageUsers) {
    return next({ name: 'resumo' })
  }

  // Check page permission
  if (pageSlug && authStore.isAuthenticated && !authStore.canViewPage(pageSlug)) {
    return next({ name: 'resumo' })
  }

  next()
})

export default router
