import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/axios'
import type { AuthUser, Role } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  // ── State ──────────────────────────────────────────────────────────────
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<AuthUser | null>(
    (() => {
      try {
        const raw = localStorage.getItem('user')
        return raw ? (JSON.parse(raw) as AuthUser) : null
      } catch {
        return null
      }
    })()
  )

  // ── Getters ────────────────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const role = computed<Role | null>(() => user.value?.role ?? null)

  /** Retourne la route home selon le rôle */
  const homeRoute = computed<string>(() => {
    if (role.value === 'CONTROLLER') return '/qr-control'
    if (role.value === 'CASHIER') return '/members'
    return '/dashboard'
  })

  // ── Actions ────────────────────────────────────────────────────────────
  async function login(email: string, password: string): Promise<void> {
    const res = await api.post('/auth/login', { email, password })
    const data = res.data?.data ?? res.data

    token.value = data.token
    user.value = data.user

    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore — on déconnecte quoi qu'il arrive
    } finally {
      token.value = null
      user.value = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }

  async function fetchMe(): Promise<void> {
    const res = await api.get('/auth/me')
    const data = res.data?.data ?? res.data
    user.value = data
    localStorage.setItem('user', JSON.stringify(data))
  }

  return {
    token,
    user,
    isAuthenticated,
    role,
    homeRoute,
    login,
    logout,
    fetchMe,
  }
})
