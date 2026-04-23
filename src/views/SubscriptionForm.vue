<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircle, Check } from 'lucide-vue-next'
import api from '@/api/axios'
import type { Activity, MethodePaiement, TypeForfait } from '@/types'
import { fmt, getLocalYmd } from '@/utils/helpers'

// ── Types locaux ──────────────────────────────────────────────────────────────

interface MemberSearchResult {
  id: number
  nom: string
  prenom: string
  email?: string
  initials?: string
}

type Mode = 'creation' | 'renewal'

interface RenewalContext {
  memberName: string
  activityName: string
  oldEndDate: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FORFAIT_DAYS: Record<TypeForfait, number> = {
  HEBDO: 7,
  MENSUEL: 30,
  TRIMESTRIEL: 90,
  ANNUEL: 365,
}

const FORFAIT_PRICE_KEY: Record<TypeForfait, keyof Activity> = {
  HEBDO: 'prix_hebdomadaire',
  MENSUEL: 'prix_mensuel',
  TRIMESTRIEL: 'prix_trimestriel',
  ANNUEL: 'prix_annuel',
}

const FORFAIT_LABEL: Record<TypeForfait, string> = {
  HEBDO: 'Hebdomadaire',
  MENSUEL: 'Mensuel',
  TRIMESTRIEL: 'Trimestriel',
  ANNUEL: 'Annuel',
}

const ALL_FORFAITS: TypeForfait[] = ['HEBDO', 'MENSUEL', 'TRIMESTRIEL', 'ANNUEL']

// ── Helpers locaux ────────────────────────────────────────────────────────────

function getQueryParam(val: string | string[] | null | undefined): string | null {
  if (Array.isArray(val)) return val[0] ?? null
  return val ?? null
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return getLocalYmd(d)
}

function calcEndDateFromForfait(start: string, type: TypeForfait): string {
  if (!start || !type) return ''
  const [y, m, d0] = start.split('-').map(Number)
  const d = new Date(y, m - 1, d0)
  d.setDate(d.getDate() + FORFAIT_DAYS[type])
  return getLocalYmd(d)
}

function memberInitials(m: MemberSearchResult): string {
  return ((m.prenom?.[0] ?? '') + (m.nom?.[0] ?? '')).toUpperCase()
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getForfaitPrice(activity: Activity, t: TypeForfait): number {
  return Number(activity[FORFAIT_PRICE_KEY[t]]) || 0
}

// ── Route / Router ────────────────────────────────────────────────────────────

const route = useRoute()
const router = useRouter()

const qMode: Mode = getQueryParam(route.query.mode) === 'renewal' ? 'renewal' : 'creation'
const qMemberKey: string | null =
  getQueryParam(route.query.member) ??
  getQueryParam(route.query.memberSlug) ??
  getQueryParam(route.query.memberId)
const qSubscriptionId: string | null = getQueryParam(route.query.subscriptionId)
const hasQueryParams = Boolean(qMemberKey || qSubscriptionId)

// ── State ─────────────────────────────────────────────────────────────────────

const mode = ref<Mode>(qMode)

const memberQuery = ref('')
const memberResults = ref<MemberSearchResult[]>([])
const memberSearching = ref(false)
const showDropdown = ref(false)
const selectedMember = ref<MemberSearchResult | null>(null)
const searchRef = ref<HTMLDivElement | null>(null)

const activities = ref<Activity[]>([])
const selectedActivityId = ref<number | ''>('')

const typeForfait = ref<TypeForfait | ''>('')

const startDate = ref(getLocalYmd())
const endDate = ref('')

const inscriptionFee = ref(0)
const fraisUniquement = ref(false)
const methodePaiement = ref<MethodePaiement | ''>('')

const renewalCtx = ref<RenewalContext | null>(null)
const renewalLoading = ref(false)

const activeSubWarning = ref(false)

const fieldErrors = ref<Record<string, string>>({})
const submitError = ref('')
const submitting = ref(false)
const toastMsg = ref<string | null>(null)

// ── Computed ──────────────────────────────────────────────────────────────────

const selectedActivity = computed<Activity | null>(() =>
  activities.value.find((a) => a.id === (selectedActivityId.value as number)) ?? null
)

const forfaitOptions = computed<TypeForfait[]>(() =>
  selectedActivity.value?.isMonthlyOnly
    ? ALL_FORFAITS.filter((t) => t !== 'HEBDO')
    : ALL_FORFAITS
)

const subscriptionAmount = computed<number>(() => {
  if (!selectedActivity.value || !typeForfait.value) return 0
  return getForfaitPrice(selectedActivity.value, typeForfait.value as TypeForfait)
})

const feeAmount = computed<number>(() =>
  mode.value === 'renewal' ? 0 : inscriptionFee.value
)

const montantTotal = computed<number>(() => {
  if (fraisUniquement.value) return feeAmount.value
  return subscriptionAmount.value + feeAmount.value
})

const isFormValid = computed<boolean>(() =>
  Boolean(selectedMember.value) &&
  Boolean(selectedActivityId.value) &&
  Boolean(typeForfait.value) &&
  Boolean(startDate.value)
)

const accentColor = computed(() => (mode.value === 'renewal' ? '#43A047' : '#1A73E8'))

const btnGradient = computed(() =>
  mode.value === 'renewal'
    ? 'linear-gradient(195deg, #66BB6A, #43A047)'
    : 'linear-gradient(195deg, #49a3f1, #1A73E8)'
)

const btnShadow = computed(() =>
  mode.value === 'renewal'
    ? '0 3px 12px rgba(67,160,71,0.35)'
    : '0 3px 12px rgba(26,115,232,0.35)'
)

const endDateDisplay = computed(() => {
  if (!endDate.value) return '—'
  return new Date(endDate.value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

const selectedForfaitLabel = computed(() =>
  typeForfait.value ? FORFAIT_LABEL[typeForfait.value as TypeForfait] : ''
)

// ── Watchers ──────────────────────────────────────────────────────────────────

watch([typeForfait, startDate], () => {
  if (!typeForfait.value || !startDate.value) {
    endDate.value = ''
    return
  }
  endDate.value = calcEndDateFromForfait(startDate.value, typeForfait.value as TypeForfait)
})

watch([selectedMember, selectedActivityId, mode], async () => {
  if (!selectedMember.value || !selectedActivityId.value || mode.value !== 'creation') {
    activeSubWarning.value = false
    return
  }
  try {
    const res = await api.get(
      `/subscriptions?memberId=${selectedMember.value.id}&activityId=${selectedActivityId.value}&status=active`
    )
    const data = res.data?.data ?? res.data
    activeSubWarning.value = Array.isArray(data) ? data.length > 0 : false
  } catch {
    activeSubWarning.value = false
  }
})

// ── Debounce recherche membre ─────────────────────────────────────────────────

let searchTimer: ReturnType<typeof setTimeout> | null = null

function handleMemberQueryChange(val: string) {
  memberQuery.value = val
  showDropdown.value = true
  if (searchTimer) clearTimeout(searchTimer)
  if (!val.trim()) {
    memberResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    memberSearching.value = true
    try {
      const res = await api.get(`/members?search=${encodeURIComponent(val)}`)
      const data = res.data?.data ?? res.data
      memberResults.value = Array.isArray(data) ? data.slice(0, 5) : []
    } catch {
      memberResults.value = []
    } finally {
      memberSearching.value = false
    }
  }, 350)
}

function selectMember(m: MemberSearchResult) {
  selectedMember.value = m
  memberQuery.value = ''
  memberResults.value = []
  showDropdown.value = false
  delete fieldErrors.value.member
}

function clearMember() {
  selectedMember.value = null
  memberQuery.value = ''
  memberResults.value = []
  activeSubWarning.value = false
  delete fieldErrors.value.member
}

// ── Click extérieur → fermer dropdown ────────────────────────────────────────

function onOutsideClick(e: MouseEvent) {
  if (searchRef.value && !searchRef.value.contains(e.target as Node)) {
    showDropdown.value = false
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

let cancelled = false

onUnmounted(() => {
  cancelled = true
  document.removeEventListener('mousedown', onOutsideClick)
})

onMounted(async () => {
  document.addEventListener('mousedown', onOutsideClick)

  try {
    const res = await api.get('/activities')
    const data = res.data?.data ?? res.data
    activities.value = Array.isArray(data) ? data : []
  } catch {
    // silently fail
  }

  if (mode.value === 'renewal' && qMemberKey && qSubscriptionId) {
    renewalLoading.value = true
    try {
      const [mRes, sRes] = await Promise.all([
        api.get(`/members/${encodeURIComponent(qMemberKey)}`),
        api.get(`/subscriptions/${qSubscriptionId}`),
      ])
      if (cancelled) return
      const member = mRes.data?.data ?? mRes.data
      const sub = sRes.data?.data ?? sRes.data

      selectedMember.value = {
        id: member.id,
        nom: member.nom,
        prenom: member.prenom,
        email: member.email,
        initials: member.initials,
      }

      const actId = sub.id_activity ?? sub.activity_id
      if (actId) selectedActivityId.value = actId
      if (sub.type_forfait) typeForfait.value = sub.type_forfait as TypeForfait

      const oldEnd: string = sub.date_prochain_paiement ?? sub.end_date ?? sub.date_fin ?? ''
      let newStart: string
      if (oldEnd) {
        const ancienneExpiration = new Date(oldEnd)
        const aujourdHui = new Date()
        aujourdHui.setHours(0, 0, 0, 0)
        ancienneExpiration.setHours(0, 0, 0, 0)
        newStart = ancienneExpiration < aujourdHui ? getLocalYmd() : addDays(oldEnd, 1)
      } else {
        newStart = getLocalYmd()
      }
      startDate.value = newStart
      inscriptionFee.value = 0

      const actNested = (sub.activity ?? sub.Activity) as { nom?: string } | undefined
      renewalCtx.value = {
        memberName: `${member.prenom} ${member.nom}`,
        activityName: actNested?.nom ?? '',
        oldEndDate: oldEnd,
      }
    } catch {
      // silently fail
    } finally {
      if (!cancelled) renewalLoading.value = false
    }
    return
  }

  if (mode.value === 'creation' && qMemberKey && !qSubscriptionId) {
    renewalLoading.value = true
    try {
      const res = await api.get(`/members/${encodeURIComponent(qMemberKey)}`)
      if (cancelled) return
      const member = res.data?.data ?? res.data
      selectedMember.value = {
        id: member.id,
        nom: member.nom,
        prenom: member.prenom,
        email: member.email,
        initials: member.initials,
      }
    } catch {
      // silently fail
    } finally {
      if (!cancelled) renewalLoading.value = false
    }
  }
})

// ── Mode switch ───────────────────────────────────────────────────────────────

function switchMode(m: Mode) {
  if (m === mode.value) return
  mode.value = m
  if (!hasQueryParams) {
    selectedMember.value = null
    memberQuery.value = ''
    memberResults.value = []
    selectedActivityId.value = ''
    typeForfait.value = ''
    startDate.value = getLocalYmd()
    endDate.value = ''
    inscriptionFee.value = 0
    fraisUniquement.value = false
    methodePaiement.value = ''
    activeSubWarning.value = false
    renewalCtx.value = null
    fieldErrors.value = {}
    submitError.value = ''
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(): boolean {
  const errs: Record<string, string> = {}
  if (!selectedMember.value) errs.member = 'Veuillez sélectionner un membre'
  if (!selectedActivityId.value) errs.activity = 'Veuillez sélectionner une activité'
  if (!typeForfait.value) errs.typeForfait = 'Veuillez sélectionner un forfait'
  if (!startDate.value) errs.startDate = 'La date de début est requise'
  fieldErrors.value = errs
  return Object.keys(errs).length === 0
}

// ── Soumission ────────────────────────────────────────────────────────────────

async function handleSubmit() {
  if (!validate()) return
  submitError.value = ''
  submitting.value = true
  try {
    const body: Record<string, unknown> = {
      id_membre: selectedMember.value!.id,
      id_activity: Number(selectedActivityId.value),
      type_forfait: typeForfait.value,
      date_debut: startDate.value,
      frais_inscription_payes: mode.value === 'renewal' ? 0 : inscriptionFee.value,
      frais_uniquement: fraisUniquement.value,
      methode_paiement: methodePaiement.value || 'CASH',
      montant_total: montantTotal.value,
    }
    await api.post('/subscriptions', body)
    const msg =
      mode.value === 'renewal'
        ? 'Abonnement renouvelé avec succès'
        : 'Abonnement créé avec succès'
    toastMsg.value = msg
    setTimeout(() => router.push('/subscriptions'), 1500)
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Une erreur est survenue. Veuillez réessayer.'
    submitError.value = msg
  } finally {
    submitting.value = false
  }
}

// ── Styles partagés ───────────────────────────────────────────────────────────

const S = {
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--gf-muted)',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box' as const,
    border: '1px solid var(--gf-border)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--gf-dark)',
    outline: 'none',
    background: 'var(--gf-white)',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  inputDisabled: {
    width: '100%',
    boxSizing: 'border-box' as const,
    border: '1px solid var(--gf-border)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--gf-muted)',
    background: '#f8f9fa',
    outline: 'none',
    fontFamily: 'inherit',
  },
  select: {
    width: '100%',
    boxSizing: 'border-box' as const,
    border: '1px solid var(--gf-border)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--gf-dark)',
    outline: 'none',
    background: 'var(--gf-white)',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237b809a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat' as const,
    backgroundPosition: 'right 12px center',
    paddingRight: '36px',
    fontFamily: 'inherit',
  },
}
</script>

<template>
  <!-- ── Chargement ─────────────────────────────────────────────────────────── -->
  <div
    v-if="renewalLoading"
    class="gf-page"
    style="align-items: center; justify-content: center; min-height: 100%;"
  >
    <div style="color: var(--gf-muted); font-size: 14px;">Chargement…</div>
  </div>

  <div v-else class="gf-page" style="min-height: 100%;">

    <!-- ── Switcher de mode ────────────────────────────────────────────────── -->
    <div style="display: flex;">
      <div style="display: flex; border: 1px solid var(--gf-border); border-radius: 8px; overflow: hidden;">
        <button
          v-for="m in (['creation', 'renewal'] as Mode[])"
          :key="m"
          type="button"
          :style="{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: mode === m ? '700' : '400',
            color: mode === m ? 'var(--gf-white)' : 'var(--gf-muted)',
            background: mode === m ? '#1A73E8' : 'var(--gf-white)',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s',
          }"
          @click="switchMode(m)"
        >
          {{ m === 'creation' ? 'Nouvel abonnement' : 'Renouvellement' }}
        </button>
      </div>
    </div>

    <!-- ── Card formulaire ────────────────────────────────────────────────── -->
    <div class="gf-card-outer">
      <div class="gf-card">

        <!-- En-tête -->
        <div
          :class="
            mode === 'renewal'
              ? 'gf-card-header gf-card-header--success'
              : 'gf-card-header gf-card-header--info'
          "
        >
          <div>
            <p class="gf-card-header__title">
              {{ mode === 'creation' ? 'Nouvel abonnement' : "Renouvellement d'abonnement" }}
            </p>
            <p class="gf-card-header__sub">
              {{
                mode === 'creation'
                  ? 'Créer un abonnement pour un membre'
                  : 'Prolonger un abonnement existant'
              }}
            </p>
          </div>
        </div>

        <form @submit.prevent="handleSubmit">
          <div
            class="gf-card-body"
            style="padding: 28px 24px 24px; display: flex; flex-direction: column; gap: 20px;"
          >

            <!-- ── Bannière renouvellement ──────────────────────────────────── -->
            <div
              v-if="mode === 'renewal' && renewalCtx"
              style="background: #eaf7ea; border-left: 4px solid #43A047; border-radius: 8px; padding: 12px 16px; display: flex; align-items: flex-start; gap: 10px;"
            >
              <CheckCircle :size="18" color="#43A047" style="flex-shrink: 0; margin-top: 1px;" />
              <div style="font-size: 13px; color: #2e7d32; line-height: 1.5;">
                Renouvellement de <strong>{{ renewalCtx.memberName }}</strong
                >{{ renewalCtx.activityName ? ` — ${renewalCtx.activityName}` : '' }}.
                <template v-if="renewalCtx.oldEndDate">
                  Ancien abonnement expiré le
                  <strong>{{ formatDateFR(renewalCtx.oldEndDate) }}</strong>.
                </template>
                La nouvelle date de début est calculée automatiquement.
              </div>
            </div>

            <!-- ── Membre ────────────────────────────────────────────────── -->
            <div>
              <label :style="S.label">Membre</label>

              <!-- Membre sélectionné -->
              <div
                v-if="selectedMember"
                style="display: flex; align-items: center; gap: 10px; padding: 8px 14px; border: 1px solid var(--gf-border); border-radius: 8px; background: #f8f9fa;"
              >
                <div
                  style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(195deg, #49a3f1, #1A73E8); display: flex; align-items: center; justify-content: center; color: var(--gf-white); font-size: 13px; font-weight: 700; flex-shrink: 0;"
                >
                  {{ memberInitials(selectedMember) }}
                </div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 13px; font-weight: 600; color: var(--gf-dark);">
                    {{ selectedMember.prenom }} {{ selectedMember.nom }}
                  </div>
                  <div
                    v-if="selectedMember.email"
                    style="font-size: 12px; color: var(--gf-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                  >
                    {{ selectedMember.email }}
                  </div>
                </div>
                <button
                  v-if="mode !== 'renewal'"
                  type="button"
                  style="background: none; border: none; cursor: pointer; font-size: 12px; color: #1A73E8; font-weight: 600; white-space: nowrap; padding: 2px 0;"
                  @click="clearMember"
                >
                  Changer →
                </button>
              </div>

              <!-- Champ recherche autocomplete -->
              <div v-else ref="searchRef" style="position: relative;">
                <input
                  type="text"
                  :value="memberQuery"
                  placeholder="Rechercher un membre…"
                  :style="{
                    ...S.input,
                    ...(fieldErrors.member ? { border: '1px solid #F44335' } : {}),
                  }"
                  @input="handleMemberQueryChange(($event.target as HTMLInputElement).value)"
                  @focus="(e) => { showDropdown = true; (e.target as HTMLElement).style.borderColor = accentColor }"
                  @blur="(e) => ((e.target as HTMLElement).style.borderColor = 'var(--gf-border)')"
                />
                <!-- Dropdown résultats -->
                <div
                  v-if="showDropdown && (memberResults.length > 0 || memberSearching)"
                  style="position: absolute; top: 100%; left: 0; right: 0; background: var(--gf-white); border: 1px solid var(--gf-border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 100; margin-top: 4px; overflow: hidden;"
                >
                  <div
                    v-if="memberSearching"
                    style="padding: 12px 14px; font-size: 13px; color: var(--gf-muted);"
                  >
                    Recherche…
                  </div>
                  <button
                    v-else
                    v-for="m in memberResults"
                    :key="m.id"
                    type="button"
                    style="width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: none; border: none; border-bottom: 1px solid var(--gf-bg); cursor: pointer; text-align: left;"
                    @mousedown="selectMember(m)"
                    @mouseenter="(e) => ((e.currentTarget as HTMLElement).style.background = '#f8faff')"
                    @mouseleave="(e) => ((e.currentTarget as HTMLElement).style.background = 'none')"
                  >
                    <div
                      style="width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(195deg, #49a3f1, #1A73E8); display: flex; align-items: center; justify-content: center; color: var(--gf-white); font-size: 11px; font-weight: 700; flex-shrink: 0;"
                    >
                      {{ memberInitials(m) }}
                    </div>
                    <div style="min-width: 0;">
                      <div style="font-size: 13px; font-weight: 600; color: var(--gf-dark);">
                        {{ m.prenom }} {{ m.nom }}
                      </div>
                      <div
                        v-if="m.email"
                        style="font-size: 11px; color: var(--gf-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                      >
                        {{ m.email }}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <p v-if="fieldErrors.member" style="font-size: 11px; color: #F44335; margin-top: 4px;">
                {{ fieldErrors.member }}
              </p>
            </div>

            <!-- ── Grille 2 colonnes ──────────────────────────────────────── -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">

              <!-- Activité -->
              <div>
                <label :style="S.label">Activité</label>
                <input
                  v-if="mode === 'renewal' && renewalCtx?.activityName"
                  type="text"
                  :value="renewalCtx.activityName"
                  disabled
                  :style="S.inputDisabled"
                />
                <select
                  v-else
                  :value="selectedActivityId"
                  :style="{
                    ...S.select,
                    ...(fieldErrors.activity ? { border: '1px solid #F44335' } : {}),
                  }"
                  @change="(e) => {
                    const v = (e.target as HTMLSelectElement).value
                    selectedActivityId = v === '' ? '' : (Number(v) as number)
                    typeForfait = ''
                    delete fieldErrors.activity
                  }"
                  @focus="(e) => ((e.target as HTMLElement).style.borderColor = accentColor)"
                  @blur="(e) => ((e.target as HTMLElement).style.borderColor = 'var(--gf-border)')"
                >
                  <option value="">Sélectionner une activité</option>
                  <option v-for="a in activities" :key="a.id" :value="a.id">{{ a.nom }}</option>
                </select>
                <p v-if="fieldErrors.activity" style="font-size: 11px; color: #F44335; margin-top: 4px;">
                  {{ fieldErrors.activity }}
                </p>
              </div>

              <!-- Forfait -->
              <div>
                <label :style="S.label">Forfait</label>
                <select
                  :value="typeForfait"
                  :disabled="!selectedActivityId"
                  :style="{
                    ...S.select,
                    ...(!selectedActivityId ? { opacity: '0.6', cursor: 'not-allowed' } : {}),
                    ...(fieldErrors.typeForfait ? { border: '1px solid #F44335' } : {}),
                  }"
                  @change="(e) => {
                    typeForfait = (e.target as HTMLSelectElement).value as TypeForfait | ''
                    delete fieldErrors.typeForfait
                  }"
                  @focus="(e) => ((e.target as HTMLElement).style.borderColor = accentColor)"
                  @blur="(e) => ((e.target as HTMLElement).style.borderColor = 'var(--gf-border)')"
                >
                  <option value="">Sélectionner un forfait</option>
                  <option v-for="t in forfaitOptions" :key="t" :value="t">
                    {{ FORFAIT_LABEL[t] }} —
                    {{ selectedActivity ? fmt(getForfaitPrice(selectedActivity, t)) : fmt(0) }}
                  </option>
                </select>
                <p v-if="fieldErrors.typeForfait" style="font-size: 11px; color: #F44335; margin-top: 4px;">
                  {{ fieldErrors.typeForfait }}
                </p>
              </div>

              <!-- Date de début -->
              <div>
                <label :style="S.label">Date de début</label>
                <input
                  type="date"
                  :value="startDate"
                  :disabled="mode === 'renewal'"
                  :style="{
                    ...(mode === 'renewal' ? S.inputDisabled : S.input),
                    ...(fieldErrors.startDate ? { border: '1px solid #F44335' } : {}),
                  }"
                  @input="(e) => {
                    startDate = (e.target as HTMLInputElement).value
                    delete fieldErrors.startDate
                  }"
                  @focus="(e) => ((e.target as HTMLElement).style.borderColor = accentColor)"
                  @blur="(e) => ((e.target as HTMLElement).style.borderColor = 'var(--gf-border)')"
                />
                <p v-if="fieldErrors.startDate" style="font-size: 11px; color: #F44335; margin-top: 4px;">
                  {{ fieldErrors.startDate }}
                </p>
              </div>

              <!-- Date de fin calculée -->
              <div>
                <label :style="S.label">Date de fin (calculée)</label>
                <input type="text" :value="endDateDisplay" disabled :style="S.inputDisabled" />
              </div>

              <!-- Frais d'inscription -->
              <div>
                <label :style="S.label">Frais d'inscription (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  :value="mode === 'renewal' ? 0 : inscriptionFee"
                  :disabled="mode === 'renewal'"
                  :style="mode === 'renewal' ? S.inputDisabled : S.input"
                  @input="(e) => (inscriptionFee = Math.max(0, Number((e.target as HTMLInputElement).value)))"
                  @focus="(e) => ((e.target as HTMLElement).style.borderColor = accentColor)"
                  @blur="(e) => ((e.target as HTMLElement).style.borderColor = 'var(--gf-border)')"
                />
              </div>

              <!-- Méthode de paiement -->
              <div>
                <label :style="S.label">Méthode de paiement</label>
                <select
                  :value="methodePaiement"
                  :style="S.select"
                  @change="(e) => (methodePaiement = (e.target as HTMLSelectElement).value as MethodePaiement | '')"
                  @focus="(e) => ((e.target as HTMLElement).style.borderColor = accentColor)"
                  @blur="(e) => ((e.target as HTMLElement).style.borderColor = 'var(--gf-border)')"
                >
                  <option value="">Sélectionner</option>
                  <option value="CASH">Cash</option>
                  <option value="WAVE">Wave</option>
                  <option value="ORANGE">Orange Money</option>
                </select>
              </div>

            </div>

            <!-- Frais uniquement -->
            <div>
              <label
                style="display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--gf-dark); cursor: pointer;"
              >
                <input
                  v-model="fraisUniquement"
                  type="checkbox"
                  :disabled="mode === 'renewal'"
                  style="width: 15px; height: 15px; accent-color: #1A73E8;"
                />
                Frais d'inscription uniquement (sans abonnement)
              </label>
            </div>

            <!-- ── Warning abonnement actif ──────────────────────────────── -->
            <div
              v-if="activeSubWarning"
              style="background: #fff8f0; border-left: 4px solid #fb8c00; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #e65100; line-height: 1.5;"
            >
              Ce membre a déjà un abonnement actif sur cette activité. Vous pouvez continuer pour en créer un nouveau.
            </div>

            <!-- ── Récapitulatif ─────────────────────────────────────────── -->
            <div
              v-if="typeForfait && selectedActivity"
              style="background: #f8f9fa; border-radius: 10px; padding: 16px 18px;"
            >
              <div
                style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--gf-muted); margin-bottom: 12px;"
              >
                Récapitulatif
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <div
                  style="display: flex; justify-content: space-between; font-size: 13px; color: var(--gf-dark);"
                >
                  <span>Abonnement {{ selectedActivity.nom }} ({{ selectedForfaitLabel }})</span>
                  <span style="font-weight: 600;">{{ fmt(subscriptionAmount) }}</span>
                </div>
                <div
                  style="display: flex; justify-content: space-between; font-size: 13px; color: var(--gf-dark);"
                >
                  <span>Frais d'inscription</span>
                  <span style="font-weight: 600;">{{ fmt(feeAmount) }}</span>
                </div>
                <div
                  style="border-top: 1px solid #e0e0e0; padding-top: 10px; margin-top: 2px; display: flex; justify-content: space-between; align-items: center;"
                >
                  <span style="font-size: 13px; font-weight: 700; color: var(--gf-dark);">Total à payer</span>
                  <span :style="{ fontSize: '16px', fontWeight: '700', color: accentColor }">
                    {{ fmt(montantTotal) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- ── Erreur de soumission ──────────────────────────────────── -->
            <p v-if="submitError" style="font-size: 12px; color: #F44335; margin: 0;">
              {{ submitError }}
            </p>

            <!-- ── Boutons ───────────────────────────────────────────────── -->
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
              <button
                type="button"
                style="padding: 10px 20px; font-size: 13px; font-weight: 600; color: var(--gf-muted); background: var(--gf-white); border: 1px solid var(--gf-border); border-radius: 8px; cursor: pointer; transition: background 0.2s;"
                @click="router.back()"
                @mouseenter="(e) => ((e.currentTarget as HTMLElement).style.background = '#f8f9fa')"
                @mouseleave="(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--gf-white)')"
              >
                Annuler
              </button>
              <button
                type="submit"
                :disabled="!isFormValid || submitting"
                :style="{
                  padding: '10px 22px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'var(--gf-white)',
                  background: btnGradient,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isFormValid && !submitting ? 'pointer' : 'not-allowed',
                  opacity: isFormValid && !submitting ? '1' : '0.6',
                  boxShadow: isFormValid && !submitting ? btnShadow : 'none',
                  transition: 'opacity 0.2s',
                }"
              >
                {{
                  submitting
                    ? 'Enregistrement…'
                    : mode === 'renewal'
                    ? "Renouveler l'abonnement"
                    : "Créer l'abonnement"
                }}
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>

    <!-- ── Toast ────────────────────────────────────────────────────────────── -->
    <div
      v-if="toastMsg"
      :style="{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: mode === 'renewal' ? '#43A047' : '#1A73E8',
        color: 'var(--gf-white)',
        borderRadius: '10px',
        padding: '14px 20px',
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        zIndex: '9999',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '320px',
      }"
    >
      <Check :size="18" color="var(--gf-white)" />
      {{ toastMsg }}
    </div>

  </div>
</template>
