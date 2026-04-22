<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  LayoutDashboard, Users, Activity, Ticket,
  CreditCard, Receipt, QrCode, LogOut, Dumbbell,
} from 'lucide-vue-next'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

// ── Navigation items par rôle ───────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'Dashboard',     path: '/dashboard',    icon: LayoutDashboard, roles: ['ADMIN'] },
  { label: 'Membres',       path: '/members',      icon: Users,           roles: ['ADMIN','CASHIER'] },
  { label: 'Activités',     path: '/activities',   icon: Activity,        roles: ['ADMIN'] },
  { label: 'Abonnements',   path: '/subscriptions',icon: CreditCard,      roles: ['ADMIN'] },
  { label: 'Tickets',       path: '/tickets',      icon: Ticket,          roles: ['ADMIN','CASHIER'] },
  { label: 'Transactions',  path: '/transactions', icon: Receipt,         roles: ['ADMIN','CASHIER'] },
  { label: 'Utilisateurs',  path: '/users',        icon: Users,           roles: ['ADMIN'] },
  { label: 'Contrôle QR',   path: '/qr-control',   icon: QrCode,          roles: ['ADMIN','CONTROLLER'] },
]

const visibleNav = computed(() =>
  NAV_ITEMS.filter(item =>
    auth.role && item.roles.includes(auth.role)
  )
)

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div style="display:flex; min-height:100vh; background:var(--gf-bg)">

    <!-- ── Sidebar ───────────────────────────────────────────────────── -->
    <aside style="
      width: 260px;
      min-height: 100vh;
      background: linear-gradient(195deg, #42424a, #191919);
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0; left: 0;
      z-index: 100;
      box-shadow: 4px 0 24px rgba(0,0,0,0.18);
    ">
      <!-- Logo -->
      <div style="
        padding: 28px 24px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.12);
        display: flex;
        align-items: center;
        gap: 12px;
      ">
        <div style="
          width: 36px; height: 36px;
          background: linear-gradient(195deg, #EC407A, #D81B60);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        ">
          <Dumbbell :size="20" color="white" />
        </div>
        <span style="color:white; font-size:18px; font-weight:700; letter-spacing:0.5px">
          GymFlow
        </span>
      </div>

      <!-- Navigation -->
      <nav style="flex:1; padding: 16px 12px; display:flex; flex-direction:column; gap:4px">
        <RouterLink
          v-for="item in visibleNav"
          :key="item.path"
          :to="item.path"
          style="text-decoration:none"
        >
          <div
            :style="{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: isActive(item.path)
                ? 'linear-gradient(195deg, #49a3f1, #1A73E8)'
                : 'transparent',
              color: isActive(item.path)
                ? 'white'
                : 'rgba(255,255,255,0.72)',
              boxShadow: isActive(item.path)
                ? '0 4px 20px rgba(26,115,232,0.38)'
                : 'none',
            }"
          >
            <component :is="item.icon" :size="18" />
            <span style="font-size:13px; font-weight:500">{{ item.label }}</span>
          </div>
        </RouterLink>
      </nav>

      <!-- Footer sidebar : user info -->
      <div style="
        padding: 16px 20px;
        border-top: 1px solid rgba(255,255,255,0.10);
        display: flex;
        align-items: center;
        gap: 10px;
      ">
        <div style="
          width: 32px; height: 32px;
          background: linear-gradient(195deg, #49a3f1, #1A73E8);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: white;
          flex-shrink: 0;
        ">
          {{ auth.user?.fullName?.charAt(0)?.toUpperCase() ?? '?' }}
        </div>
        <div style="flex:1; min-width:0">
          <div style="color:white; font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
            {{ auth.user?.fullName ?? '—' }}
          </div>
          <div style="color:rgba(255,255,255,0.5); font-size:10px">
            {{ auth.user?.role ?? '' }}
          </div>
        </div>
        <button
          @click="handleLogout"
          title="Déconnexion"
          style="
            background:none; border:none; cursor:pointer;
            color:rgba(255,255,255,0.5); padding:4px;
            border-radius:4px; display:flex; align-items:center;
            transition: color 0.2s;
          "
          @mouseenter="(e) => (e.currentTarget as HTMLElement).style.color='white'"
          @mouseleave="(e) => (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.5)'"
        >
          <LogOut :size="16" />
        </button>
      </div>
    </aside>

    <!-- ── Contenu principal ─────────────────────────────────────────── -->
    <div style="margin-left:260px; flex:1; display:flex; flex-direction:column; min-height:100vh">

      <!-- Header top bar -->
      <header style="
        height: 56px;
        background: white;
        border-bottom: 1px solid var(--gf-border);
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 0 28px;
        position: sticky;
        top: 0;
        z-index: 50;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      ">
        <span style="font-size:13px; color:var(--gf-muted)">
          Connecté en tant que
          <strong style="color:var(--gf-dark)">{{ auth.user?.fullName }}</strong>
          ({{ auth.user?.role }})
        </span>
      </header>

      <!-- Page content -->
      <main style="flex:1; padding: 24px 28px">
        <RouterView />
      </main>
    </div>
  </div>
</template>
