import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// ── Définition des routes ───────────────────────────────────────────────
const routes: RouteRecordRaw[] = [
  // ── Pages publiques (sans layout) ──────────────────────────────────
  {
    path: '/',
    name: 'Landing',
    component: () => import('@/views/LandingPage.vue'),
    meta: { public: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginPage.vue'),
    meta: { public: true },
  },

  // ── Pages protégées (avec MainLayout) ──────────────────────────────
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/DashboardPage.vue'),
        meta: { roles: ['ADMIN'] },
      },
      {
        path: 'activities',
        name: 'Activities',
        component: () => import('@/views/ActivitiesPage.vue'),
        meta: { roles: ['ADMIN', 'CASHIER'] },
      },
      {
        path: 'activities/new',
        name: 'ActivityNew',
        component: () => import('@/views/ActivityFormPage.vue'),
        meta: { roles: ['ADMIN', 'CASHIER'] },
      },
      {
        path: 'activities/:id/edit',
        name: 'ActivityEdit',
        component: () => import('@/views/ActivityFormPage.vue'),
        meta: { roles: ['ADMIN', 'CASHIER'] },
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/UsersPage.vue'),
        meta: { roles: ['ADMIN'] },
      },
      {
        path: 'subscriptions',
        name: 'Subscriptions',
        component: () => import('@/views/SubscriptionsPage.vue'),
        meta: { roles: ['ADMIN', 'CASHIER'] },
      },
      {
        path: 'subscriptions/new',
        name: 'SubscriptionNew',
        component: () => import('@/views/SubscriptionForm.vue'),
        meta: { roles: ['ADMIN', 'CASHIER'] },
      },
      {
        path: 'members',
        name: 'Members',
        component: () => import('@/views/MembersPage.vue'),
        meta: { roles: ['ADMIN', 'CASHIER'] },
      },
      {
        path: 'members/new',
        name: 'MemberNew',
        component: () => import('@/views/MemberFormPage.vue'),
        meta: { roles: ['ADMIN', 'CASHIER'] },
      },
      {
        path: 'members/:slug/edit',
        name: 'MemberEdit',
        component: () => import('@/views/MemberFormPage.vue'),
        meta: { roles: ['ADMIN', 'CASHIER'] },
      },
      {
        path: 'members/:id',
        name: 'MemberDetail',
        component: () => import('@/views/MemberDetailPage.vue'),
        meta: { roles: ['ADMIN', 'CASHIER'] },
      },
      {
        path: 'tickets',
        name: 'Tickets',
        component: () => import('@/views/TicketsPage.vue'),
        meta: { roles: ['ADMIN', 'CASHIER'] },
      },
      {
        path: 'transactions',
        name: 'Transactions',
        component: () => import('@/views/TransactionsPage.vue'),
        meta: { roles: ['ADMIN', 'CASHIER'] },
      },
      {
        path: 'qr-control',
        name: 'QrControl',
        component: () => import('@/views/QrControlPage.vue'),
        meta: { roles: ['ADMIN', 'CONTROLLER'] },
      },
    ],
  },

  // ── 404 ────────────────────────────────────────────────────────────
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
  },
]

// ── Création du router ──────────────────────────────────────────────────
const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ── Helper : route home selon le rôle ──────────────────────────────────
function homeForRole(role: string | null): string {
  if (role === 'CONTROLLER') return '/qr-control'
  if (role === 'CASHIER') return '/members'
  return '/dashboard'
}

// ── Guards de navigation ────────────────────────────────────────────────
router.beforeEach((to) => {
  const auth = useAuthStore()
  const isPublic = to.meta.public === true
  const requiredRoles = to.meta.roles as string[] | undefined

  // 1. Page publique + déjà authentifié → redirige vers home du rôle
  if (isPublic && auth.isAuthenticated) {
    return homeForRole(auth.role)
  }

  // 2. Page protégée + non authentifié → login
  if (!isPublic && !auth.isAuthenticated) {
    return '/login'
  }

  // 3. Page protégée + rôle insuffisant → home du rôle
  if (requiredRoles && auth.role && !requiredRoles.includes(auth.role)) {
    return homeForRole(auth.role)
  }
})

export default router
