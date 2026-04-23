<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Info, CircleCheck, XCircle, AlertTriangle } from 'lucide-vue-next'
import api from '@/api/axios'
import { useAuthStore } from '@/stores/auth'
import { fmtDate } from '@/utils/helpers'
import type { Subscription, Member, Activity } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

type RowStatus = 'ACTIF' | 'EXPIRE' | 'BIENTOT'
type StatusFilter = 'ALL' | RowStatus

interface RawRow extends Subscription {
  Member?: Member
  Activity?: Activity
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const AVATAR_COLORS = [
  'linear-gradient(135deg,#49a3f1,#1A73E8)',
  'linear-gradient(135deg,#66BB6A,#388E3C)',
  'linear-gradient(135deg,#FFA726,#F57C00)',
  'linear-gradient(135deg,#AB47BC,#7B1FA2)',
  'linear-gradient(135deg,#26C6DA,#0097A7)',
  'linear-gradient(135deg,#EF5350,#C62828)',
]

const FORFAIT_LABEL: Record<string, string> = {
  HEBDO: 'Hebdomadaire',
  MENSUEL: 'Mensuel',
  TRIMESTRIEL: 'Trimestriel',
  ANNUEL: 'Annuel',
}

// ── Helpers locaux ─────────────────────────────────────────────────────────────

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDaysYmd(base: string, days: number): string {
  const [y, mo, da] = base.split('-').map(Number)
  const d = new Date(y, mo - 1, da)
  d.setDate(d.getDate() + days)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function rowStatus(endDate: string): RowStatus {
  const t = todayYmd()
  if (endDate < t) return 'EXPIRE'
  const limit = addDaysYmd(t, 3)
  if (endDate <= limit) return 'BIENTOT'
  return 'ACTIF'
}

function normalizeRow(raw: RawRow): Subscription {
  const member = raw.member ?? raw.Member
  const activity = raw.activity ?? raw.Activity
  return { ...raw, member, activity }
}

function getMember(sub: Subscription): Member | null {
  return sub.member ?? null
}

function memberName(sub: Subscription): string {
  const m = getMember(sub)
  return m ? `${m.prenom} ${m.nom}` : `Membre #${sub.id_membre}`
}

function getInitials(sub: Subscription): string {
  const m = getMember(sub)
  if (!m) return '??'
  return `${(m.prenom ?? '?').charAt(0)}${(m.nom ?? '?').charAt(0)}`.toUpperCase()
}

function avatarGradient(sub: Subscription): string {
  const id = getMember(sub)?.id ?? sub.id_membre
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function forfaitBadgeClass(type: string): string {
  if (type === 'MENSUEL' || type === 'HEBDO') return 'gf-badge gf-badge--info'
  if (type === 'TRIMESTRIEL') return 'gf-badge gf-badge--purple'
  return 'gf-badge gf-badge--active'
}

function filterPillStyle(active: boolean, color: string): Record<string, string> {
  const base: Record<string, string> = {
    borderRadius: '20px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '700',
    border: '1px solid transparent',
    cursor: 'pointer',
    lineHeight: '1.2',
  }
  if (!active) {
    return { ...base, background: 'var(--gf-white)', borderColor: 'var(--gf-border)', color: 'var(--gf-muted)' }
  }
  return { ...base, background: color, borderColor: color, color: 'var(--gf-white)' }
}

// ── Auth & Router ──────────────────────────────────────────────────────────────

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const canRenew = computed(() => auth.role === 'ADMIN' || auth.role === 'CASHIER')
const canDelete = computed(() => auth.role === 'ADMIN')

// ── État ───────────────────────────────────────────────────────────────────────

const rows = ref<Subscription[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const statusFilter = ref<StatusFilter>('ALL')
const page = ref(1)

// ── Fetch ──────────────────────────────────────────────────────────────────────

async function fetchData(filterParam: string | null | string[] | undefined) {
  loading.value = true
  error.value = ''
  try {
    let res
    if (filterParam === 'bientot') {
      res = await api.get('/subscriptions/expiring-soon', { params: { days: 30 } })
      statusFilter.value = 'BIENTOT'
    } else {
      res = await api.get('/subscriptions')
      statusFilter.value = 'ALL'
    }
    const data = res.data?.data ?? res.data
    const arr = Array.isArray(data) ? data : []
    rows.value = arr.map((item: RawRow) => normalizeRow(item))
  } catch {
    error.value = 'Impossible de charger les abonnements.'
    rows.value = []
  } finally {
    loading.value = false
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

onMounted(() => {
  fetchData(route.query.filter)
})

watch(
  () => route.query.filter,
  (newFilter) => {
    fetchData(newFilter)
  },
)

watch([search, statusFilter], () => {
  page.value = 1
})

// ── KPI ────────────────────────────────────────────────────────────────────────

const kpi = computed(() => {
  let total = 0
  let actifs = 0
  let expires = 0
  let bientot = 0
  for (const s of rows.value) {
    const end = s.date_prochain_paiement
    if (!end) continue
    total += 1
    const st = rowStatus(end)
    if (st === 'EXPIRE') expires += 1
    else if (st === 'BIENTOT') bientot += 1
    else actifs += 1
  }
  return { total, actifs, expires, bientot }
})

// ── Filtrage & Pagination ──────────────────────────────────────────────────────

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return rows.value.filter((s) => {
    const end = s.date_prochain_paiement
    if (!end) return false
    const st = rowStatus(end)
    if (statusFilter.value !== 'ALL' && st !== statusFilter.value) return false
    if (!q) return true
    const m = getMember(s)
    if (!m) return false
    const hay = `${m.prenom} ${m.nom} ${m.email ?? ''}`.toLowerCase()
    return hay.includes(q)
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const safePage = computed(() => Math.min(page.value, totalPages.value))
const pageStart = computed(() => (safePage.value - 1) * PAGE_SIZE)
const pageEnd = computed(() => Math.min(pageStart.value + PAGE_SIZE, filtered.value.length))
const pageRows = computed(() => filtered.value.slice(pageStart.value, pageEnd.value))

// ── Actions ────────────────────────────────────────────────────────────────────

async function handleDelete(sub: Subscription) {
  const m = getMember(sub)
  const name = m ? `${m.prenom} ${m.nom}` : `abonnement #${sub.id}`
  if (!window.confirm(`Supprimer l'abonnement de ${name} ? Cette action est irréversible.`)) return
  const deletedId = Number(sub.id)
  try {
    await api.delete(`/subscriptions/${deletedId}`)
    rows.value = rows.value.filter((x) => Number(x.id) !== deletedId)
  } catch {
    alert('Impossible de supprimer cet abonnement.')
  }
}

function navigateToMember(sub: Subscription) {
  const m = getMember(sub)
  const seg = m?.slug ?? String(m?.id ?? sub.id_membre)
  router.push(`/members/${seg}`)
}

function navigateToRenewal(sub: Subscription) {
  const m = getMember(sub)
  const memberId = m?.id ?? sub.id_membre
  const memberSeg = m?.slug ?? String(memberId)
  router.push(
    `/subscriptions/new?mode=renewal&subscriptionId=${sub.id}&member=${encodeURIComponent(memberSeg)}`,
  )
}
</script>

<template>
  <div class="gf-page">
    <!-- ── KPI ──────────────────────────────────────────────────────────────── -->
    <div class="gf-kpi-grid-4 gf-page-top">
      <!-- Total -->
      <div class="gf-kpi-card kpi-mini">
        <div class="kpi-icon" style="background: linear-gradient(195deg, #49a3f1, #1A73E8)">
          <Info :size="18" color="var(--gf-white)" />
        </div>
        <div>
          <div class="kpi-label">Total</div>
          <div class="kpi-value">{{ kpi.total }}</div>
        </div>
      </div>

      <!-- Actifs -->
      <div class="gf-kpi-card kpi-mini">
        <div class="kpi-icon" style="background: linear-gradient(195deg, #66BB6A, #43A047)">
          <CircleCheck :size="18" color="var(--gf-white)" />
        </div>
        <div>
          <div class="kpi-label">Actifs</div>
          <div class="kpi-value">{{ kpi.actifs }}</div>
        </div>
      </div>

      <!-- Expirés -->
      <div class="gf-kpi-card kpi-mini">
        <div class="kpi-icon" style="background: linear-gradient(195deg, #ef5350, #F44335)">
          <XCircle :size="18" color="var(--gf-white)" />
        </div>
        <div>
          <div class="kpi-label">Expirés</div>
          <div class="kpi-value">{{ kpi.expires }}</div>
        </div>
      </div>

      <!-- Bientôt -->
      <div class="gf-kpi-card kpi-mini">
        <div class="kpi-icon" style="background: linear-gradient(195deg, #FFA726, #fb8c00)">
          <AlertTriangle :size="18" color="var(--gf-white)" />
        </div>
        <div>
          <div class="kpi-label">Expirent bientôt</div>
          <div class="kpi-value">{{ kpi.bientot }}</div>
        </div>
      </div>
    </div>

    <!-- ── Card principale ──────────────────────────────────────────────────── -->
    <div class="gf-card-outer">
      <div class="gf-card">
        <!-- Header -->
        <div class="gf-card-header gf-card-header--info">
          <div>
            <p class="gf-card-header__title">Abonnements</p>
            <p class="gf-card-header__sub">Gestion de tous les abonnements membres</p>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="gf-toolbar">
          <div class="toolbar-left">
            <div class="gf-search-wrap">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--gf-muted)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="gf-search-icon"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input v-model="search" type="text" placeholder="Rechercher un membre..." />
            </div>

            <div class="filter-pills">
              <button type="button" :style="filterPillStyle(statusFilter === 'ALL', 'var(--gf-dark)')" @click="statusFilter = 'ALL'">
                Tous
              </button>
              <button type="button" :style="filterPillStyle(statusFilter === 'ACTIF', '#43A047')" @click="statusFilter = 'ACTIF'">
                Actifs
              </button>
              <button type="button" :style="filterPillStyle(statusFilter === 'EXPIRE', '#F44335')" @click="statusFilter = 'EXPIRE'">
                Expirés
              </button>
              <button type="button" :style="filterPillStyle(statusFilter === 'BIENTOT', '#fb8c00')" @click="statusFilter = 'BIENTOT'">
                Bientôt
              </button>
            </div>
          </div>

          <span class="gf-count-label">
            {{ filtered.length }} abonnement{{ filtered.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <!-- Erreur -->
        <div v-if="error" class="fetch-error">{{ error }}</div>

        <!-- Tableau -->
        <div class="gf-card-body--table">
          <table class="gf-table" style="min-width: 880px">
            <thead>
              <tr>
                <th>Membre</th>
                <th>Activité</th>
                <th>Forfait</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <!-- Skeleton -->
              <template v-if="loading">
                <tr v-for="i in 6" :key="i">
                  <td v-for="w in [160, 120, 90, 80, 80, 80, 100]" :key="w" style="padding: 14px 14px">
                    <div class="gf-skeleton" :style="{ width: w + 'px', height: '14px', borderRadius: '4px' }" />
                  </td>
                </tr>
              </template>

              <!-- Vide -->
              <tr v-else-if="pageRows.length === 0">
                <td colspan="7" class="empty-cell">Aucun abonnement trouvé.</td>
              </tr>

              <!-- Lignes -->
              <template v-else>
                <tr v-for="sub in pageRows" :key="sub.id">
                  <!-- Membre -->
                  <td>
                    <div class="member-cell">
                      <div class="member-avatar" :style="{ background: avatarGradient(sub) }">
                        {{ getInitials(sub) }}
                      </div>
                      <div>
                        <div class="member-name">{{ memberName(sub) }}</div>
                        <div class="member-email">{{ getMember(sub)?.email ?? '—' }}</div>
                      </div>
                    </div>
                  </td>

                  <!-- Activité -->
                  <td>{{ sub.activity?.nom ?? '—' }}</td>

                  <!-- Forfait -->
                  <td>
                    <span
                      :class="forfaitBadgeClass(sub.type_forfait)"
                      :style="sub.type_forfait === 'ANNUEL' ? { color: '#2e7d32' } : {}"
                    >
                      {{ FORFAIT_LABEL[sub.type_forfait] }}
                    </span>
                  </td>

                  <!-- Début -->
                  <td>{{ fmtDate(sub.date_debut) }}</td>

                  <!-- Fin -->
                  <td>{{ fmtDate(sub.date_prochain_paiement) }}</td>

                  <!-- Statut -->
                  <td>
                    <span
                      :class="[
                        'gf-badge',
                        rowStatus(sub.date_prochain_paiement) === 'EXPIRE'
                          ? 'gf-badge--inactive'
                          : rowStatus(sub.date_prochain_paiement) === 'BIENTOT'
                            ? 'gf-badge--pending'
                            : 'gf-badge--active',
                      ]"
                    >
                      {{
                        rowStatus(sub.date_prochain_paiement) === 'EXPIRE'
                          ? 'Expiré'
                          : rowStatus(sub.date_prochain_paiement) === 'BIENTOT'
                            ? 'Bientôt'
                            : 'Actif'
                      }}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td>
                    <div class="action-btns">
                      <!-- Voir membre -->
                      <button
                        type="button"
                        class="gf-btn-action gf-btn-action--view"
                        title="Voir le membre"
                        @click="navigateToMember(sub)"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>

                      <!-- Renouveler -->
                      <button
                        v-if="canRenew"
                        type="button"
                        class="renew-btn"
                        title="Renouveler"
                        @click="navigateToRenewal(sub)"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                          <path d="M21 3v5h-5" />
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                          <path d="M3 21v-5h5" />
                        </svg>
                      </button>

                      <!-- Supprimer -->
                      <button
                        v-if="canDelete"
                        type="button"
                        class="gf-btn-action gf-btn-action--delete"
                        title="Supprimer"
                        @click="handleDelete(sub)"
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="!loading && filtered.length > 0" class="gf-pagination">
          <span class="gf-pagination__info">
            Affichage {{ pageStart + 1 }}–{{ pageEnd }} sur {{ filtered.length }}
          </span>
          <div class="gf-pagination__btns">
            <button
              v-for="p in totalPages"
              :key="p"
              type="button"
              :class="['gf-page-btn', { 'gf-page-btn--active': p === safePage }]"
              @click="page = p"
            >
              {{ p }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* KPI mini cards */
.kpi-mini {
  padding: 12px 14px;
  display: flex;
  gap: 12px;
  align-items: center;
  background: #f8f9fa;
  box-shadow: none;
}

.kpi-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpi-label {
  font-size: 11px;
  color: var(--gf-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.kpi-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--gf-dark);
}

/* Toolbar */
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-pills {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Erreur fetch */
.fetch-error {
  margin: 12px 20px 0;
  background: #fde8e8;
  color: #f44335;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
}

/* Cellule vide */
.empty-cell {
  text-align: center;
  padding: 48px 0;
  color: var(--gf-muted);
  font-size: 13px;
}

/* Cellule membre */
.member-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--gf-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.member-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--gf-dark);
}

.member-email {
  font-size: 11px;
  color: var(--gf-muted);
}

/* Actions */
.action-btns {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* Bouton Renouveler */
.renew-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fef3e2;
  color: #fb8c00;
  transition: background 0.15s, color 0.15s;
}

.renew-btn:hover {
  background: #fb8c00;
  color: var(--gf-white);
}
</style>
