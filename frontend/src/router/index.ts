import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'resumo',
        component: () => import('@/pages/ResumoPage.vue'),
      },
      {
        path: 'faturamento',
        name: 'faturamento',
        component: () => import('@/pages/FaturamentoPage.vue'),
      },
      {
        path: 'marketing',
        name: 'marketing',
        component: () => import('@/pages/MarketingPage.vue'),
      },
      {
        path: 'comercial',
        name: 'comercial',
        component: () => import('@/pages/ComercialPage.vue'),
      },
      {
        path: 'atendimento',
        name: 'atendimento',
        component: () => import('@/pages/AtendimentoPage.vue'),
      },
      {
        path: 'metas',
        name: 'metas',
        component: () => import('@/pages/MetasPage.vue'),
      },
      {
        path: 'pacientes',
        name: 'pacientes',
        component: () => import('@/pages/PacientesPage.vue'),
      },
      {
        path: 'config/meta-ads',
        name: 'meta-ads',
        component: () => import('@/pages/MetaAdsConfigPage.vue'),
      },
      {
        path: 'como-funciona',
        name: 'como-funciona',
        component: () => import('@/pages/ComoFuncionaPage.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
