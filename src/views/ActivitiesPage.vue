<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'
import type { Activity } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type ExtActivity = Omit<Activity, 'slug'> & {
  slug?: string
  description?: string
  capacite?: number
  nb_membres?: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const ICON_GRADIENTS = [
  'linear-gradient(135deg,#49a3f1,#1A73E8)',
  'linear-gradient(135deg,#66BB6A,#388E3C)',
  'linear-gradient(135deg,#FFA726,#F57C00)',
  'linear-gradient(135deg,#AB47BC,#7B1FA2)',
  'linear-gradient(135deg,#26C6DA,#0097A7)',
  'linear-gradient(135deg,#EF5350,#C62828)',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function activityPath(a: ExtActivity): string {
  return a.slug ?? String(a.id)
}

function fmtTarifCard(n: number | undefined | null): string {
  const v = n == null || Number.isNaN(Number(n)) ? 0 : Number(n)
  if (v === 0) return '0 FCFA'
  return new Intl.NumberFormat('fr-FR').format(v) + ' FCFA'
}

function iconGradient(id: number): string {
  return ICON_GRADIENTS[id % ICON_GRADIENTS.length]
}

function tarifRows(a: ExtActivity): { label: string; value: number }[] {
  return [
    { label: 'Inscription :',   value: a.frais_inscription },
    { label: 'Prix Ticket :',   value: a.prix_ticket },
    { label: 'Hebdomadaire :', value: a.prix_hebdomadaire },
    { label: 'Mensuelle :',     value: a.prix_mensuel },
    { label: 'Trimestrielle :', value: a.prix_trimestriel },
    { label: 'Annuelle :',      value: a.prix_annuel },
  ]
}

// ── Store / Router ────────────────────────────────────────────────────────────

const auth    = useAuthStore()
const router  = useRouter()
const isAdmin = computed(() => auth.role === 'ADMIN')

// ── State ─────────────────────────────────────────────────────────────────────

const activities = ref<ExtActivity[]>([])
const loading    = ref(true)
const error      = ref('')
const search     = ref('')
const page       = ref(1)

// ── Computed pagination ───────────────────────────────────────────────────────

const filtered   = computed(() =>
  activities.value.filter(a =>
    a.nom.toLowerCase().includes(search.value.toLowerCase())
  )
)
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const safePage   = computed(() => Math.min(page.value, totalPages.value))
const pageStart  = computed(() => (safePage.value - 1) * PAGE_SIZE)
const pageEnd    = computed(() => Math.min(pageStart.value + PAGE_SIZE, filtered.value.length))
const pageRows   = computed(() => filtered.value.slice(pageStart.value, pageEnd.value))

watch(search, () => { page.value = 1 })

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchActivities() {
  loading.value = true
  error.value   = ''
  try {
    const res  = await api.get('/activities')
    const data = res.data?.data ?? res.data
    const rows = Array.isArray(data) ? data : []
    activities.value = rows.map((row: unknown) => {
      const r = row as ExtActivity
      const t = r.slug
      return {
        ...r,
        slug: typeof t === 'string' && t.trim() !== '' ? t.trim() : undefined,
      }
    })
  } catch {
    error.value = 'Impossible de charger les activités.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchActivities)

// ── Actions ───────────────────────────────────────────────────────────────────

function openCreate() {
  if (auth.role !== 'ADMIN') return
  router.push('/activities/new')
}

function openEdit(a: ExtActivity) {
  router.push(`/activities/${encodeURIComponent(activityPath(a))}/edit`)
}

async function handleDelete(a: ExtActivity) {
  if (!window.confirm(`Supprimer l'activité "${a.nom}" ? Cette action est irréversible.`)) return
  const deletedId = Number(a.id)
  try {
    await api.delete(`/activities/${encodeURIComponent(activityPath(a))}`)
    activities.value = activities.value.filter(x => Number(x.id) !== deletedId)
  } catch {
    alert('Impossible de supprimer cette activité.')
  }
}
</script>

<template>
  <div class="gf-page">
    <div class="gf-card-outer">
      <div class="gf-card">

        <!-- ── En-tête flottant ───────────────────────────────────────────── -->
        <div class="gf-card-header gf-card-header--info">
          <div>
            <p class="gf-card-header__title">Activités</p>
            <p class="gf-card-header__sub">Gestion des activités proposées</p>
          </div>
          <button
            v-if="auth.role === 'ADMIN'"
            type="button"
            class="gf-btn-header"
            @click="openCreate"
          >
            <span style="font-size: 16px; line-height: 1;">+</span>
            Créer une activité
          </button>
        </div>

        <!-- ── Barre de recherche ─────────────────────────────────────────── -->
        <div class="gf-toolbar">
          <div class="gf-search-wrap">
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="var(--gf-muted)"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="gf-search-icon"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              v-model="search"
              type="text"
              placeholder="Rechercher une activité…"
            />
          </div>
          <span class="gf-count-label">
            {{ filtered.length }} activité{{ filtered.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <!-- ── Erreur ─────────────────────────────────────────────────────── -->
        <div
          v-if="error"
          style="
            margin: 12px 20px 0;
            background: var(--gf-alert-error-bg);
            color: var(--gf-alert-error-text);
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 13px;
          "
        >
          {{ error }}
        </div>

        <!-- ── Grille des cartes ──────────────────────────────────────────── -->
        <div
          style="
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            padding: 16px 20px 20px;
          "
        >
          <!-- Squelettes de chargement -->
          <template v-if="loading">
            <div
              v-for="i in 6"
              :key="i"
              style="
                border: 1px solid var(--gf-border);
                border-radius: var(--gf-radius-card);
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background: var(--gf-white);
                box-shadow: var(--gf-shadow-card);
              "
            >
              <div class="gf-skeleton" style="height: 14px; width: 60%;" />
              <div class="gf-skeleton" style="height: 10px; width: 40%;" />
              <div style="border-top: 1px solid var(--gf-border);" />
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div
                  v-for="j in 6"
                  :key="j"
                  class="gf-skeleton"
                  style="height: 10px; width: 100%;"
                />
              </div>
              <div class="gf-skeleton" style="height: 28px; width: 100%; margin-top: auto;" />
            </div>
          </template>

          <!-- Aucun résultat -->
          <div
            v-else-if="pageRows.length === 0"
            style="
              grid-column: 1 / -1;
              text-align: center;
              padding: 48px 0;
              color: var(--gf-muted);
              font-size: 13px;
            "
          >
            Aucune activité trouvée.
          </div>

          <!-- Cartes activités -->
          <template v-else>
            <div
              v-for="a in pageRows"
              :key="a.id"
              style="
                background: var(--gf-white);
                border-radius: var(--gf-radius-card);
                box-shadow: var(--gf-shadow-card);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid var(--gf-border);
              "
            >
              <!-- Barre colorée -->
              <div
                :style="{ height: '3px', width: '100%', background: iconGradient(a.id) }"
                aria-hidden="true"
              />

              <!-- Corps -->
              <div style="padding: 16px 16px 12px;">
                <div
                  style="
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 8px;
                  "
                >
                  <div
                    style="
                      font-size: 15px;
                      font-weight: 800;
                      color: var(--gf-dark);
                      line-height: 1.3;
                      word-break: break-word;
                    "
                  >
                    {{ a.nom.toUpperCase() }}
                  </div>
                  <div style="flex-shrink: 0;">
                    <span
                      :class="`gf-badge ${a.status ? 'gf-badge--active' : 'gf-badge--inactive'}`"
                    >
                      {{ a.status ? 'Actif' : 'Inactif' }}
                    </span>
                  </div>
                </div>

                <div style="border-top: 1px solid var(--gf-border); margin: 10px 0;" />

                <!-- Tarifs -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <div
                    v-for="row in tarifRows(a)"
                    :key="row.label"
                    style="
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      gap: 8px;
                    "
                  >
                    <span style="font-size: 12px; color: var(--gf-muted);">
                      {{ row.label }}
                    </span>
                    <span style="font-size: 12px; font-weight: 600; color: var(--gf-dark);">
                      {{ fmtTarifCard(row.value) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Pied — boutons -->
              <div
                style="
                  padding: 10px 12px;
                  border-top: 1px solid var(--gf-border);
                  display: flex;
                  gap: 6px;
                  align-items: center;
                "
              >
                <button
                  type="button"
                  style="
                    flex: 1;
                    background: var(--gf-grad-info);
                    color: var(--gf-white);
                    box-shadow: var(--gf-shadow-kpi-info);
                    border: none;
                    border-radius: 8px;
                    font-size: 11px;
                    font-weight: 700;
                    padding: 8px 10px;
                    cursor: pointer;
                  "
                  @click="router.push(`/members/new?activityId=${a.id}`)"
                >
                  Nouvel abonnement
                </button>

                <template v-if="isAdmin">
                  <button
                    type="button"
                    title="Modifier"
                    class="gf-btn-action gf-btn-action--edit"
                    @click="openEdit(a)"
                  >
                    <svg
                      width="13" height="13" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor"
                      stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title="Supprimer"
                    class="gf-btn-action gf-btn-action--delete"
                    @click="handleDelete(a)"
                  >
                    <svg
                      width="13" height="13" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor"
                      stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </template>
              </div>
            </div>
          </template>
        </div>

        <!-- ── Pagination ─────────────────────────────────────────────────── -->
        <div
          v-if="!loading && filtered.length > 0"
          class="gf-pagination"
        >
          <span class="gf-pagination__info">
            Affichage {{ pageStart + 1 }}–{{ pageEnd }} sur {{ filtered.length }}
          </span>
          <div class="gf-pagination__btns">
            <button
              v-for="p in totalPages"
              :key="p"
              type="button"
              :class="`gf-page-btn${p === safePage ? ' gf-page-btn--active' : ''}`"
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
