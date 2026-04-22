<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Users, DollarSign, Ticket, TrendingUp } from 'lucide-vue-next'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import api from '@/api/axios'
import type { Transaction } from '@/types'
import { getLocalYmd, getLast7Days, fmt } from '@/utils/helpers'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

// ── Types locaux ──────────────────────────────────────────────────────────────

interface WeeklyEntry {
  day: string
  revenue: number
}

interface ExpiringSub {
  id: number
  membre?: { nom: string; prenom: string }
  date_prochain_paiement: string
  daysLeft: number
}

// ── État ──────────────────────────────────────────────────────────────────────

const membresActifs = ref<number | null>(null)
const revenusJour   = ref<number | null>(null)
const ticketsJour   = ref<number | null>(null)
const entreesJour   = ref<number | null>(null)
const kpiLoading    = ref(true)
const recentTx      = ref<Transaction[]>([])
const weeklyData    = ref<WeeklyEntry[]>([])
const weeklyLoading = ref(true)
const expirations   = ref<ExpiringSub[]>([])
const expirLoading  = ref(true)
const expirError    = ref(false)

const router = useRouter()

// ── Helpers locaux ────────────────────────────────────────────────────────────

/** Compact Y-axis ticks for the chart (K/M) */
function axisCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return Math.round(n / 1_000) + 'K'
  return String(n)
}

function fmtTableDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  })
}

function countTicketsVendusToday(rows: unknown, todayYmd: string): number {
  if (!Array.isArray(rows)) return 0
  let n = 0
  for (const raw of rows) {
    const t = raw as Record<string, unknown>
    if (t.status !== 'VENDU') continue
    const updated = (t.updatedAt ?? t.updated_at) as string | undefined
    if (!updated) continue
    if (getLocalYmd(new Date(updated)) === todayYmd) n += 1
  }
  return n
}

/**
 * Construit from/to/labels/dates pour le graphique 7 jours.
 * Utilise getLast7Days() et parse chaque date en local (évite le décalage UTC).
 */
function getWeeklyInfo(): { from: string; to: string; labels: string[]; dates: string[] } {
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const dates = getLast7Days()
  const labels = dates.map(d => {
    const [y, mo, da] = d.split('-').map(Number)
    return dayNames[new Date(y, mo - 1, da).getDay()]
  })
  return { from: dates[0], to: dates[dates.length - 1], labels, dates }
}

function normalizeTransactionRow(raw: unknown): Transaction {
  const r = raw as Transaction & { Member?: { nom: string; prenom: string } }
  return { ...r, member: r.member ?? r.Member }
}

function normalizeDashboardExpiring(raw: Record<string, unknown>): ExpiringSub {
  const m = (raw.membre ?? raw.member ?? raw.Member) as
    | { nom: string; prenom: string }
    | undefined
  const date_prochain_paiement = String(raw.date_prochain_paiement ?? '')
  return {
    id: Number(raw.id),
    membre: m,
    date_prochain_paiement,
    daysLeft: Math.max(
      0,
      Math.ceil((new Date(date_prochain_paiement).getTime() - Date.now()) / 86400000)
    ),
  }
}

function getTxCategory(libelle: string): { label: string; badgeClass: string } {
  const l = libelle.toLowerCase()
  if (l.includes('ticket'))      return { label: 'Ticket',      badgeClass: 'pending' }
  if (l.includes('inscription')) return { label: 'Inscription', badgeClass: 'active'  }
  return                                { label: 'Abonnement',  badgeClass: 'info'    }
}

// ── KPI defs ──────────────────────────────────────────────────────────────────

const kpiDefs = computed(() => [
  {
    label:    'Membres actifs',
    value:    membresActifs.value !== null ? String(membresActifs.value) : null,
    Icon:     Users,
    colorKey: 'info',
    footer:   'Abonnements en cours',
  },
  {
    label:    'Revenus du jour',
    value:    revenusJour.value !== null ? fmt(revenusJour.value) : null,
    Icon:     DollarSign,
    colorKey: 'success',
    footer:   'Revenus (transactions du jour)',
  },
  {
    label:    'Tickets vendus',
    value:    ticketsJour.value !== null ? String(ticketsJour.value) : null,
    Icon:     Ticket,
    colorKey: 'warning',
    footer:   "Passés en « Vendu » aujourd'hui",
  },
  {
    label:    'Entrées du jour',
    value:    entreesJour.value !== null ? String(entreesJour.value) : null,
    Icon:     TrendingUp,
    colorKey: 'primary',
    footer:   'Scans réussis (jour)',
  },
])

// ── Graphique ─────────────────────────────────────────────────────────────────

const chartData = computed<ChartData<'line'>>(() => ({
  labels: weeklyData.value.map(e => e.day),
  datasets: [
    {
      label:                'Revenus',
      data:                 weeklyData.value.map(e => e.revenue),
      borderColor:          '#1A73E8',
      borderWidth:          2,
      fill:                 true,
      backgroundColor:      'rgba(26,115,232,0.08)',
      tension:              0.4,
      pointRadius:          3,
      pointBackgroundColor: '#1A73E8',
    },
  ],
}))

const chartOptions: ChartOptions<'line'> = {
  responsive:          true,
  maintainAspectRatio: false,
  plugins: {
    legend:  { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => fmt(ctx.parsed.y),
      },
      cornerRadius: 8,
      borderColor:  '#e5e7eb',
      borderWidth:  1,
    },
  },
  scales: {
    x: {
      grid:   { display: false },
      border: { display: false },
      ticks:  { color: '#9ca3af', font: { size: 12 } },
    },
    y: {
      grid:   { color: '#f0f0f0' },
      border: { display: false },
      ticks: {
        color:    '#9ca3af',
        font:     { size: 12 },
        callback: (value) => axisCompact(Number(value)),
      },
    },
  },
}

// ── Chargement des données ────────────────────────────────────────────────────

onMounted(async () => {
  const today = getLocalYmd()

  // KPI + transactions récentes — tous parallèles
  kpiLoading.value = true
  const [membRes, sumRes, tkRes, accRes, txRes] = await Promise.allSettled([
    api.get('/members'),
    api.get(`/transactions/summary?date_debut=${today}&date_fin=${today}`),
    api.get('/tickets'),
    api.get(`/access-logs/stats?date_debut=${today}&date_fin=${today}&resultat=SUCCES`),
    api.get('/transactions?limit=5'),
  ])

  if (membRes.status === 'fulfilled') {
    const d = membRes.value.data?.data ?? membRes.value.data
    const arr = Array.isArray(d) ? d : []
    membresActifs.value = arr.filter((m: Record<string, unknown>) => {
      const subs = (m.subscriptions ?? []) as { date_prochain_paiement: string }[]
      if (!subs.length) return false
      return new Date(subs[0].date_prochain_paiement) >= new Date()
    }).length
  }
  if (sumRes.status === 'fulfilled') {
    const d = sumRes.value.data?.data ?? sumRes.value.data
    revenusJour.value = (d?.total_revenus as number | undefined) ?? null
  }
  if (tkRes.status === 'fulfilled') {
    const d = tkRes.value.data?.data ?? tkRes.value.data
    ticketsJour.value = countTicketsVendusToday(Array.isArray(d) ? d : [], today)
  }
  if (accRes.status === 'fulfilled') {
    const d = accRes.value.data?.data ?? accRes.value.data
    entreesJour.value = (d?.total_scans as number | undefined) ?? null
  }
  if (txRes.status === 'fulfilled') {
    const d = txRes.value.data?.data ?? txRes.value.data
    const slice: unknown[] = Array.isArray(d)
      ? d.slice(0, 5)
      : ((d?.items as unknown[] | undefined)?.slice(0, 5) ?? [])
    recentTx.value = slice.map(normalizeTransactionRow)
  }
  kpiLoading.value = false

  // Graphique 7 jours
  weeklyLoading.value = true
  try {
    const { from, to, labels, dates } = getWeeklyInfo()
    const res  = await api.get(`/transactions?date_debut=${from}&date_fin=${to}`)
    const rows: Transaction[] = (() => {
      const d = res.data?.data ?? res.data
      return Array.isArray(d) ? (d as Transaction[]) : []
    })()

    const revenueByDay: Record<string, number> = {}
    dates.forEach(date => { revenueByDay[date] = 0 })

    for (const tx of rows) {
      if (tx.type === 'REVENU') {
        const day = getLocalYmd(new Date(tx.createdAt))
        if (day in revenueByDay) revenueByDay[day] = (revenueByDay[day] ?? 0) + tx.montant
      }
    }

    weeklyData.value = labels.map((label, i) => ({
      day:     label,
      revenue: revenueByDay[dates[i]] ?? 0,
    }))
  } catch {
    // weeklyData reste vide — graphique plat
  } finally {
    weeklyLoading.value = false
  }

  // Expirations imminentes
  expirLoading.value = true
  try {
    const res = await api.get('/subscriptions/expiring-soon?days=3')
    const d   = res.data?.data ?? res.data
    const arr = (Array.isArray(d) ? d : []).map((s: unknown) =>
      normalizeDashboardExpiring(s as Record<string, unknown>)
    )
    expirations.value = arr.sort(
      (a: ExpiringSub, b: ExpiringSub) => a.daysLeft - b.daysLeft
    )
  } catch {
    expirError.value = true
  } finally {
    expirLoading.value = false
  }
})
</script>

<template>
  <div class="gf-page">

    <!-- ── BLOC 1 — KPI cards ────────────────────────────────────────────────── -->
    <div class="gf-kpi-grid-4 gf-page-top">
      <div v-for="kpi in kpiDefs" :key="kpi.label" class="gf-kpi-card">
        <!-- Icône flottante -->
        <div :class="`gf-kpi-icon gf-kpi-icon--${kpi.colorKey}`">
          <component :is="kpi.Icon" :size="22" color="#fff" />
        </div>
        <!-- Label + valeur (alignés à droite) -->
        <p class="gf-kpi-label">{{ kpi.label }}</p>
        <p class="gf-kpi-value">{{ kpiLoading ? '--' : (kpi.value ?? '--') }}</p>
        <!-- Footer -->
        <p class="gf-kpi-footer">{{ kpi.footer }}</p>
      </div>
    </div>

    <!-- ── BLOC 2 — Graphique + expirations ─────────────────────────────────── -->
    <div
      style="
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
        gap: 16px;
      "
    >
      <!-- Gauche — Graphique revenus 7 jours -->
      <div class="gf-card-outer">
        <div class="gf-card">
          <div class="gf-card-header gf-card-header--info">
            <div>
              <p class="gf-card-header__title">Revenus — 7 derniers jours</p>
              <p class="gf-card-header__sub">Connecté à /api/transactions</p>
            </div>
          </div>
          <div class="gf-card-body">
            <div
              v-if="weeklyLoading"
              class="animate-pulse"
              style="height: 200px; background: #f3f4f6; border-radius: 8px;"
            />
            <div v-else style="height: 200px; position: relative;">
              <Line :data="chartData" :options="chartOptions" />
            </div>
          </div>
        </div>
      </div>

      <!-- Droite — Expirations imminentes -->
      <div class="gf-card-outer">
        <div class="gf-card">
          <div class="gf-card-header gf-card-header--warning">
            <div>
              <p class="gf-card-header__title">Expirations imminentes</p>
              <p class="gf-card-header__sub">Abonnements à renouveler</p>
            </div>
          </div>

          <div style="padding: 28px 16px 16px;">
            <!-- Chargement -->
            <div
              v-if="expirLoading"
              style="display: flex; flex-direction: column; gap: 8px;"
            >
              <div
                v-for="i in 3"
                :key="i"
                class="animate-pulse"
                style="height: 40px; background: #f3f4f6; border-radius: 6px;"
              />
            </div>

            <!-- Erreur -->
            <div
              v-else-if="expirError"
              style="
                background: #fff8f0;
                border-left: 3px solid #fb8c00;
                border-radius: 6px;
                padding: 10px 12px;
                margin-bottom: 12px;
              "
            >
              <p style="font-size: 12px; color: #fb8c00; font-weight: 600; margin: 0;">
                Impossible de charger les expirations
              </p>
              <p style="font-size: 11px; color: var(--gf-muted); margin: 2px 0 0;">
                GET /api/subscriptions/expiring-soon?days=30
              </p>
            </div>

            <!-- Aucune expiration -->
            <p
              v-else-if="expirations.length === 0"
              style="
                font-size: 12px;
                color: var(--gf-muted);
                margin: 0 0 12px;
                text-align: center;
              "
            >
              Aucune expiration dans les 30 prochains jours.
            </p>

            <!-- Liste des expirations -->
            <div
              v-else
              style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;"
            >
              <div
                v-for="sub in expirations.slice(0, 5)"
                :key="sub.id"
                :style="{
                  background:     sub.daysLeft <= 3 ? '#fff5f5' : '#fff8f0',
                  borderLeft:     `3px solid ${sub.daysLeft <= 3 ? '#F44335' : '#fb8c00'}`,
                  borderRadius:   '6px',
                  padding:        '8px 10px',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  gap:            '8px',
                }"
              >
                <div>
                  <p
                    style="
                      font-size: 12px;
                      font-weight: 600;
                      color: var(--gf-dark);
                      margin: 0;
                    "
                  >
                    {{
                      sub.membre
                        ? `${sub.membre.prenom} ${sub.membre.nom}`
                        : `Abonnement #${sub.id}`
                    }}
                  </p>
                  <p style="font-size: 11px; color: var(--gf-muted); margin: 2px 0 0;">
                    {{
                      sub.date_prochain_paiement
                        ? `Expire le ${fmtTableDate(sub.date_prochain_paiement)}`
                        : '—'
                    }}
                  </p>
                </div>
                <span
                  :style="{
                    display:     'inline-block',
                    padding:     '2px 7px',
                    borderRadius:'8px',
                    fontSize:    '10px',
                    fontWeight:  '700',
                    background:  sub.daysLeft <= 3 ? '#fff5f5' : '#fff8f0',
                    color:       sub.daysLeft <= 3 ? '#F44335' : '#fb8c00',
                    border:      `1px solid ${sub.daysLeft <= 3 ? '#F44335' : '#fb8c00'}`,
                    flexShrink:  '0',
                  }"
                >
                  {{ sub.daysLeft <= 3 ? '7j' : '30j' }}
                </span>
              </div>
            </div>

            <button
              type="button"
              style="
                width: 100%;
                background: linear-gradient(195deg, #FFA726, #fb8c00);
                border: none;
                border-radius: 8px;
                padding: 10px;
                color: var(--gf-white);
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 3px 10px rgba(251,140,0,0.3);
              "
              @click="router.push('/subscriptions?filter=bientot')"
            >
              Voir tous les renouvellements →
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── BLOC 3 — Transactions récentes ────────────────────────────────────── -->
    <div class="gf-card-outer">
      <div class="gf-card">
        <div class="gf-card-header gf-card-header--dark">
          <div>
            <p class="gf-card-header__title">Transactions récentes</p>
            <p class="gf-card-header__sub">Dernières ventes et activités</p>
          </div>
        </div>

        <div class="gf-card-body">
          <p
            v-if="recentTx.length === 0"
            style="text-align: center; color: var(--gf-muted); font-size: 13px; margin: 0;"
          >
            Aucune transaction récente.
          </p>

          <div v-else style="overflow-x: auto;">
            <table class="gf-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th style="text-align: right;">Montant</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tx in recentTx" :key="tx.id">
                  <td style="color: var(--gf-muted);">{{ fmtTableDate(tx.createdAt) }}</td>
                  <td>
                    <span :class="`gf-badge gf-badge--${getTxCategory(tx.libelle).badgeClass}`">
                      {{ getTxCategory(tx.libelle).label }}
                    </span>
                  </td>
                  <td>{{ tx.libelle }}</td>
                  <td
                    style="text-align: right; font-weight: 700;"
                    :style="{ color: tx.type === 'REVENU' ? '#059669' : '#dc2626' }"
                  >
                    {{ tx.type === 'DEPENSE' ? '−' : '+' }}{{ fmt(tx.montant) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Lien vers toutes les transactions -->
          <div
            style="
              margin-top: 14px;
              border-top: 1px solid var(--gf-bg);
              padding-top: 12px;
              text-align: right;
            "
          >
            <button
              type="button"
              style="
                background: none;
                border: none;
                padding: 0;
                font-size: 12px;
                font-weight: 600;
                color: #1A73E8;
                cursor: pointer;
              "
              @click="router.push('/transactions')"
            >
              Voir toutes les transactions →
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
