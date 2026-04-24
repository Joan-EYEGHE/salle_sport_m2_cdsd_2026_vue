<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import api from '@/api/axios'
import type { Activity, TypeForfait, MethodePaiement } from '@/types'
import { fmt, getLocalYmd } from '@/utils/helpers'

// ── Types locaux ──────────────────────────────────────────────────────────────

type PriceKey = 'prix_hebdomadaire' | 'prix_mensuel' | 'prix_trimestriel' | 'prix_annuel'
type FieldKey  = 'prenom' | 'nom' | 'email' | 'date_naissance'
type LoadState = 'idle' | 'loading' | 'error' | 'ready'
type LoadErrorKind = 'notfound' | 'network'

interface MemberFromApi {
  id: number
  prenom: string
  nom: string
  email?: string
  phone?: string
  date_naissance?: string
  lieu_naissance?: string | null
  adresse?: string | null
  date_inscription?: string
  createdAt?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const FORFAIT_PRICE_KEY: Record<TypeForfait, PriceKey> = {
  HEBDO:       'prix_hebdomadaire',
  MENSUEL:     'prix_mensuel',
  TRIMESTRIEL: 'prix_trimestriel',
  ANNUEL:      'prix_annuel',
}

const FORFAIT_CARD_LABEL: Record<TypeForfait, string> = {
  HEBDO:       'Hebdomadaire',
  MENSUEL:     'Mensuelle',
  TRIMESTRIEL: 'Trimestrielle',
  ANNUEL:      'Annuelle',
}

const AVATAR_COLORS = [
  'linear-gradient(135deg,#49a3f1,#1A73E8)',
  'linear-gradient(135deg,#66BB6A,#388E3C)',
  'linear-gradient(135deg,#FFA726,#F57C00)',
  'linear-gradient(135deg,#AB47BC,#7B1FA2)',
  'linear-gradient(135deg,#26C6Da,#0097A7)',
  'linear-gradient(135deg,#EF5350,#C62828)',
]

const GRAD_INFO = 'linear-gradient(195deg,#49a3f1,#1A73E8)'

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarGradientById(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function initialsFrom(prenom: string, nom: string): string {
  const p = (prenom.trim()[0] ?? '').toUpperCase()
  const n = (nom.trim()[0] ?? '').toUpperCase()
  return (p + n) || '?'
}

function inscriptionDateFromApi(m: Partial<MemberFromApi>): string {
  if (m.date_inscription) return m.date_inscription.slice(0, 10)
  if (m.createdAt) return String(m.createdAt).slice(0, 10)
  return getLocalYmd()
}

function fmtLongDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function forfaitOptionsFromActivity(a: Activity): { type: TypeForfait; label: string; price: number }[] {
  const out: { type: TypeForfait; label: string; price: number }[] = []
  const pushIf = (t: TypeForfait) => {
    const p = Number(a[FORFAIT_PRICE_KEY[t]]) || 0
    if (p > 0) out.push({ type: t, label: FORFAIT_CARD_LABEL[t], price: p })
  }
  pushIf('HEBDO')
  pushIf('MENSUEL')
  pushIf('TRIMESTRIEL')
  pushIf('ANNUEL')
  return out
}

// ── Route / Router ────────────────────────────────────────────────────────────

const route  = useRoute()
const router = useRouter()

const slugParam = computed(() => route.params.slug as string | undefined)
const isEdit    = computed(() => Boolean(slugParam.value))

// ── State — identité membre ───────────────────────────────────────────────────

const prenom         = ref('')
const nom            = ref('')
const email          = ref('')
const phone          = ref('')
const dateNaissance  = ref('')
const lieuNaissance  = ref('')
const adresse        = ref('')
const dateInscription = ref('')

// ── State — abonnement (création uniquement) ──────────────────────────────────

const activities          = ref<Activity[]>([])
const idActivity          = ref<number | ''>('')
const activityDetail      = ref<Activity | null>(null)
const activityLoading     = ref(false)
const typeForfait         = ref<TypeForfait | null>(null)
const dateDebut           = ref(getLocalYmd())
const useStandardFrais    = ref(true)
const fraisInscriptionField = ref('')
const fraisSeulement      = ref(false)
const methodePaiement     = ref<MethodePaiement>('CASH')

// ── State — chargement mode édition ──────────────────────────────────────────

const loadState      = ref<LoadState>('idle')
const loadErrorKind  = ref<LoadErrorKind>('notfound')
const loadedMemberId = ref<number | null>(null)

// ── State — soumission ────────────────────────────────────────────────────────

const submitting  = ref(false)
const submitError = ref('')
const toastMsg    = ref<string | null>(null)
const touched     = ref<Partial<Record<FieldKey, boolean>>>({})
const errors      = ref<Partial<Record<FieldKey, string>>>({})

// ── Computed ──────────────────────────────────────────────────────────────────

const forfaitOptions = computed(() =>
  activityDetail.value ? forfaitOptionsFromActivity(activityDetail.value) : [],
)

const nominalFraisInscription = computed(() =>
  activityDetail.value ? Number(activityDetail.value.frais_inscription) || 0 : 0,
)

const fraisInscriptionPayes = computed(() => {
  if (!activityDetail.value) return 0
  return Number(fraisInscriptionField.value.replace(/\s/g, '').replace(',', '.')) || 0
})

const prixForfait = computed(() => {
  if (!activityDetail.value || !typeForfait.value) return 0
  return Number(activityDetail.value[FORFAIT_PRICE_KEY[typeForfait.value]]) || 0
})

const total = computed(() =>
  fraisSeulement.value
    ? fraisInscriptionPayes.value
    : prixForfait.value + fraisInscriptionPayes.value,
)

const createSubmitBlocked = computed(() =>
  !prenom.value.trim() ||
  !nom.value.trim() ||
  idActivity.value === '' ||
  !activityDetail.value ||
  forfaitOptions.value.length === 0 ||
  typeForfait.value == null,
)

const editSubmitBlocked = computed(() => !prenom.value.trim() || !nom.value.trim())

const submitDisabled = computed(() =>
  submitting.value || (isEdit.value ? editSubmitBlocked.value : createSubmitBlocked.value),
)

const avatarBg = computed(() =>
  isEdit.value && loadedMemberId.value != null
    ? avatarGradientById(loadedMemberId.value)
    : GRAD_INFO,
)

const initials = computed(() => initialsFrom(prenom.value, nom.value))
const fullName = computed(() => `${prenom.value.trim()} ${nom.value.trim()}`.trim() || '—')

// ── Watchers ──────────────────────────────────────────────────────────────────

// Charger le détail de l'activité quand idActivity change
watch(idActivity, async (id, _old, onCleanup) => {
  let cancelled = false
  onCleanup(() => { cancelled = true })

  if (isEdit.value || id === '') {
    activityDetail.value = null
    activityLoading.value = false
    return
  }

  activityLoading.value = true
  try {
    const res = await api.get(`/activities/${id}`)
    if (cancelled) return
    const a = (res.data?.data ?? res.data) as Activity
    activityDetail.value = a
    const fi = Number(a.frais_inscription) || 0
    useStandardFrais.value = fi > 0
    fraisInscriptionField.value = fi > 0 ? String(fi) : ''
    fraisSeulement.value = false
  } catch {
    if (!cancelled) activityDetail.value = null
  } finally {
    if (!cancelled) activityLoading.value = false
  }
})

// Synchroniser typeForfait quand les options changent
watch([activityDetail, forfaitOptions], ([a, opts]) => {
  if (!a || opts.length === 0) {
    typeForfait.value = null
    return
  }
  const prev = typeForfait.value
  typeForfait.value = (prev && opts.some(o => o.type === prev)) ? prev : opts[0].type
})

// ── Fetch activités (mode création) ──────────────────────────────────────────

async function fetchActivities() {
  try {
    const res  = await api.get('/activities')
    const data = res.data?.data ?? res.data
    activities.value = Array.isArray(data) ? data : []
  } catch {
    activities.value = []
  }
}

// ── Charger membre (mode édition) ─────────────────────────────────────────────

async function loadMember(slug: string) {
  loadState.value = 'loading'
  loadedMemberId.value = null
  try {
    const res = await api.get(`/members/${encodeURIComponent(slug)}`)
    const m = (res.data?.data ?? res.data) as MemberFromApi
    loadedMemberId.value = m.id
    prenom.value        = m.prenom ?? ''
    nom.value           = m.nom ?? ''
    email.value         = m.email ?? ''
    phone.value         = m.phone ?? ''
    dateNaissance.value = m.date_naissance ? String(m.date_naissance).slice(0, 10) : ''
    lieuNaissance.value = m.lieu_naissance != null ? String(m.lieu_naissance) : ''
    adresse.value       = m.adresse != null ? String(m.adresse) : ''
    dateInscription.value = inscriptionDateFromApi(m)
    loadState.value = 'ready'
  } catch (e) {
    const nf = axios.isAxiosError(e) && e.response?.status === 404
    loadErrorKind.value = nf ? 'notfound' : 'network'
    loadState.value = 'error'
  }
}

onMounted(async () => {
  if (isEdit.value && slugParam.value) {
    await loadMember(slugParam.value)
  } else {
    loadState.value = 'ready'
    await fetchActivities()
    // Pré-sélectionner l'activité depuis le query param
    const raw = route.query.activityId
    const rawStr = Array.isArray(raw) ? raw[0] : raw
    if (rawStr) {
      const n = Number(rawStr)
      if (Number.isFinite(n) && n > 0) idActivity.value = n
    }
  }
})

// ── Validation ────────────────────────────────────────────────────────────────

function validateField(key: FieldKey) {
  const val = key === 'prenom' ? prenom.value
    : key === 'nom' ? nom.value
    : key === 'email' ? email.value
    : dateNaissance.value

  let msg = ''
  if (key === 'prenom' && !val.trim()) msg = 'Le prénom est obligatoire'
  else if (key === 'nom' && !val.trim()) msg = 'Le nom est obligatoire'
  else if (key === 'email' && val.trim() && !EMAIL_RE.test(val.trim())) msg = 'Format email invalide'

  errors.value = { ...errors.value, ...(msg ? { [key]: msg } : { [key]: undefined }) }
  if (!msg) {
    const next = { ...errors.value }
    delete next[key]
    errors.value = next
  }
}

function blur(key: FieldKey) {
  touched.value = { ...touched.value, [key]: true }
  validateField(key)
}

function runSubmitValidation(): boolean {
  const next: Partial<Record<FieldKey, string>> = {}
  if (!prenom.value.trim()) next.prenom = 'Le prénom est obligatoire'
  if (!nom.value.trim()) next.nom = 'Le nom est obligatoire'
  if (email.value.trim() && !EMAIL_RE.test(email.value.trim())) next.email = 'Format email invalide'
  errors.value = next
  touched.value = { prenom: true, nom: true, email: true, date_naissance: true }
  return Object.keys(next).length === 0
}

// ── Soumission ────────────────────────────────────────────────────────────────

async function handleSubmit() {
  if (!runSubmitValidation()) return
  submitError.value = ''
  submitting.value  = true

  try {
    if (isEdit.value && slugParam.value) {
      const body = {
        prenom:           prenom.value.trim(),
        nom:              nom.value.trim(),
        email:            email.value.trim() || null,
        phone:            phone.value.trim() || null,
        date_naissance:   dateNaissance.value.trim() || null,
        lieu_naissance:   lieuNaissance.value.trim() || null,
        adresse:          adresse.value.trim() || null,
        date_inscription: dateInscription.value.trim() || getLocalYmd(),
      }
      await api.put(`/members/${encodeURIComponent(slugParam.value)}`, body)
      toastMsg.value = 'Membre mis à jour avec succès'
    } else {
      if (idActivity.value === '' || !typeForfait.value || !activityDetail.value) {
        submitting.value = false
        return
      }
      const dateDebutYmd = dateDebut.value.trim().slice(0, 10)

      const membre: Record<string, string> = {
        nom:    nom.value.trim(),
        prenom: prenom.value.trim(),
      }
      const emailT = email.value.trim()
      if (emailT) membre.email = emailT
      const phoneT = phone.value.trim()
      if (phoneT) membre.phone = phoneT
      const dn = dateNaissance.value.trim().slice(0, 10)
      if (dn) membre.date_naissance = dn
      const addr = adresse.value.trim()
      if (addr) membre.adresse = addr
      const ln = lieuNaissance.value.trim()
      if (ln) membre.lieu_naissance = ln

      const body = {
        membre,
        abonnement: {
          id_activity:             idActivity.value,
          type_forfait:            typeForfait.value,
          date_debut:              dateDebutYmd,
          frais_inscription_payes: fraisInscriptionPayes.value,
          frais_uniquement:        fraisSeulement.value,
          methode_paiement:        methodePaiement.value,
          montant_total:           total.value,
        },
      }
      await api.post('/members/subscribe', body)
      toastMsg.value = 'Membre créé avec succès'
    }

    setTimeout(() => router.push('/members'), 1500)
  } catch (err: unknown) {
    const msg =
      axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object'
        ? String((err.response.data as { message?: string }).message ?? '')
        : ''
    submitError.value = msg || 'Une erreur est survenue. Veuillez réessayer.'
  } finally {
    submitting.value = false
  }
}

// ── Styles partagés ───────────────────────────────────────────────────────────

const S = {
  label: {
    display: 'block',
    fontSize: '13px',
    color: '#7b809a',
    marginBottom: '4px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d2d6da',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    outline: 'none',
    color: 'var(--gf-dark)',
    background: '#fff',
  },
  select: {
    width: '100%',
    padding: '8px 36px 8px 12px',
    border: '1px solid #d2d6da',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    outline: 'none',
    color: 'var(--gf-dark)',
    background: '#fff',
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237b809a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
  },
  errText: {
    fontSize: '11px',
    color: '#F44335',
    margin: '4px 0 0',
  },
  btnAction: {
    width: 'auto',
    minWidth: '120px',
    height: 'auto',
    minHeight: '40px',
    padding: '10px 20px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    borderRadius: '8px',
  },
}

function borderErr(hasErr: boolean): { border: string } {
  return { border: hasErr ? '1px solid #F44335' : '1px solid #d2d6da' }
}
</script>

<template>
  <!-- ── Chargement (mode édition) ────────────────────────────────────────── -->
  <div v-if="isEdit && loadState === 'loading'" class="gf-page" style="padding: 20px 24px 24px;">
    <div class="gf-card-outer">
      <div class="gf-card">
        <div class="gf-card-body" style="display: flex; justify-content: center; padding: 80px 20px;">
          <div style="width: 40px; height: 40px; border: 3px solid var(--gf-border); border-top-color: #1A73E8; border-radius: 50%; animation: spin 0.7s linear infinite;" />
        </div>
      </div>
    </div>
  </div>

  <!-- ── Erreur de chargement (mode édition) ──────────────────────────────── -->
  <div v-else-if="isEdit && loadState === 'error'" class="gf-page" style="padding: 20px 24px 24px;">
    <div class="gf-card-outer">
      <div class="gf-card">
        <div class="gf-card-body" style="text-align: center; padding: 48px 24px;">
          <p style="color: #F44335; font-size: 14px; margin-bottom: 16px;">
            {{ loadErrorKind === 'notfound' ? 'Membre introuvable.' : 'Impossible de charger le membre.' }}
          </p>
          <button type="button" class="gf-btn-header" style="background: #1A73E8; border: none;" @click="router.back()">
            ← Retour
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Formulaire principal ─────────────────────────────────────────────── -->
  <div v-else class="gf-page" style="padding: 20px 24px 24px;">
    <div class="gf-card-outer">
      <div class="gf-card">

        <!-- En-tête -->
        <div :class="`gf-card-header ${isEdit ? 'gf-card-header--success' : 'gf-card-header--info'}`">
          <div>
            <p class="gf-card-header__title">{{ isEdit ? 'Modifier le membre' : 'Nouveau membre' }}</p>
            <p class="gf-card-header__sub">
              {{
                isEdit
                  ? `Mettre à jour le profil de ${prenom.trim() || '…'} ${nom.trim() || '…'}`
                  : 'Créer un membre et son abonnement'
              }}
            </p>
          </div>
          <button type="button" class="gf-btn-header" @click="router.back()">← Retour</button>
        </div>

        <div class="gf-card-body">
          <form @submit.prevent="handleSubmit" novalidate>

            <!-- Avatar + nom -->
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--gf-bg);">
              <div
                :style="{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: avatarBg,
                  color: 'var(--gf-white)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: '700', flexShrink: '0',
                }"
              >
                {{ initials }}
              </div>
              <div>
                <div style="font-size: 16px; font-weight: 700; color: var(--gf-dark);">{{ fullName }}</div>
                <p v-if="isEdit && dateInscription" style="font-size: 12px; color: var(--gf-muted); margin: 6px 0 0;">
                  Membre depuis le {{ fmtLongDate(dateInscription) }}
                </p>
              </div>
            </div>

            <!-- ── Bloc 1 — Identité ───────────────────────────────────────── -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px;">
              <p style="grid-column: 1 / -1; font-size: 12px; font-weight: 700; color: var(--gf-dark); margin: 0 0 4px; letter-spacing: 0.02em;">
                Identité membre
              </p>

              <!-- Prénom -->
              <div>
                <label :style="S.label">Prénom *</label>
                <input
                  type="text"
                  :value="prenom"
                  :style="{ ...S.input, ...borderErr(Boolean(touched.prenom && errors.prenom)) }"
                  @input="prenom = ($event.target as HTMLInputElement).value"
                  @blur="blur('prenom')"
                />
                <p v-if="touched.prenom && errors.prenom" :style="S.errText">{{ errors.prenom }}</p>
              </div>

              <!-- Nom -->
              <div>
                <label :style="S.label">Nom *</label>
                <input
                  type="text"
                  :value="nom"
                  :style="{ ...S.input, ...borderErr(Boolean(touched.nom && errors.nom)) }"
                  @input="nom = ($event.target as HTMLInputElement).value"
                  @blur="blur('nom')"
                />
                <p v-if="touched.nom && errors.nom" :style="S.errText">{{ errors.nom }}</p>
              </div>

              <!-- Téléphone -->
              <div>
                <label :style="S.label">Téléphone</label>
                <input
                  type="tel"
                  :value="phone"
                  :style="S.input"
                  @input="phone = ($event.target as HTMLInputElement).value"
                />
              </div>

              <!-- Email -->
              <div>
                <label :style="S.label">Email</label>
                <input
                  type="email"
                  :value="email"
                  :style="{ ...S.input, ...borderErr(Boolean(touched.email && errors.email)) }"
                  @input="email = ($event.target as HTMLInputElement).value"
                  @blur="blur('email')"
                />
                <p v-if="touched.email && errors.email" :style="S.errText">{{ errors.email }}</p>
              </div>

              <!-- Date de naissance -->
              <div>
                <label :style="S.label">Date de naissance</label>
                <input
                  type="date"
                  :value="dateNaissance"
                  :style="S.input"
                  @input="dateNaissance = ($event.target as HTMLInputElement).value"
                />
              </div>

              <!-- Lieu de naissance -->
              <div>
                <label :style="S.label">Lieu de naissance</label>
                <input
                  type="text"
                  :value="lieuNaissance"
                  :style="S.input"
                  @input="lieuNaissance = ($event.target as HTMLInputElement).value"
                />
              </div>

              <!-- Adresse -->
              <div style="grid-column: 1 / -1;">
                <label :style="S.label">Adresse</label>
                <input
                  type="text"
                  :value="adresse"
                  :style="S.input"
                  @input="adresse = ($event.target as HTMLInputElement).value"
                />
              </div>
            </div>

            <!-- ── Blocs abonnement (création uniquement) ─────────────────── -->
            <template v-if="!isEdit">

              <!-- Bloc 2 — Abonnement -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; padding-top: 8px; border-top: 1px solid var(--gf-bg);">
                <p style="grid-column: 1 / -1; font-size: 12px; font-weight: 700; color: var(--gf-dark); margin: 0 0 4px; letter-spacing: 0.02em;">
                  Abonnement
                </p>

                <!-- Activité -->
                <div>
                  <label :style="S.label">Activité *</label>
                  <select
                    :value="idActivity === '' ? '' : String(idActivity)"
                    :style="S.select"
                    @change="(e) => {
                      const v = (e.target as HTMLSelectElement).value
                      idActivity = v === '' ? '' : Number(v)
                    }"
                  >
                    <option value="">Choisir une activité</option>
                    <option v-for="a in activities" :key="a.id" :value="a.id">{{ a.nom }}</option>
                  </select>
                </div>

                <!-- Date de début -->
                <div>
                  <label :style="S.label">Date de début *</label>
                  <input
                    type="date"
                    :value="dateDebut"
                    :style="S.input"
                    @input="dateDebut = ($event.target as HTMLInputElement).value"
                  />
                </div>

                <!-- Type de forfait -->
                <div style="grid-column: 1 / -1;">
                  <label :style="S.label">Type d'adhésion *</label>
                  <p v-if="activityLoading" style="font-size: 13px; color: var(--gf-muted);">Chargement des tarifs…</p>
                  <p v-else-if="!activityLoading && idActivity !== '' && forfaitOptions.length === 0" style="font-size: 13px; color: #F44335;">
                    Aucun tarif disponible pour cette activité.
                  </p>
                  <div
                    v-else-if="!activityLoading && forfaitOptions.length > 0"
                    style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-top: 8px;"
                  >
                    <button
                      v-for="opt in forfaitOptions"
                      :key="opt.type"
                      type="button"
                      :style="{
                        cursor: 'pointer',
                        textAlign: 'left',
                        padding: '14px 16px',
                        borderRadius: '8px',
                        border: typeForfait === opt.type ? '2px solid #e91e63' : '1px solid #d2d6da',
                        background: typeForfait === opt.type ? 'rgba(233,30,99,0.06)' : '#fff',
                        transition: 'border-color 0.15s, background 0.15s',
                      }"
                      @click="typeForfait = opt.type"
                    >
                      <div style="font-size: 13px; font-weight: 700; color: var(--gf-dark);">{{ opt.label }}</div>
                      <div style="font-size: 14px; color: #7b809a; margin-top: 6px;">{{ fmt(opt.price) }}</div>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Bloc 3 — Paiement -->
              <div style="margin-bottom: 28px; padding-top: 8px; border-top: 1px solid var(--gf-bg);">
                <p style="font-size: 12px; font-weight: 700; color: var(--gf-dark); margin: 0 0 12px; letter-spacing: 0.02em;">Paiement</p>
                <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;">

                  <!-- Frais d'inscription -->
                  <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px;">
                    <label
                      v-if="activityDetail"
                      style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--gf-muted); cursor: pointer;"
                    >
                      <input
                        type="checkbox"
                        :checked="useStandardFrais"
                        @change="(e) => {
                          const checked = (e.target as HTMLInputElement).checked
                          useStandardFrais = checked
                          fraisInscriptionField = checked ? String(nominalFraisInscription) : ''
                        }"
                      />
                      <span>Avec {{ fmt(nominalFraisInscription) }} Inscription</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      :value="fraisInscriptionField"
                      placeholder="Frais d'inscription"
                      :disabled="!activityDetail"
                      :style="{
                        ...S.input,
                        opacity: activityDetail ? '1' : '0.45',
                        cursor: activityDetail ? 'text' : 'not-allowed',
                        background: activityDetail ? 'var(--gf-white)' : 'var(--gf-bg)',
                      }"
                      @input="fraisInscriptionField = ($event.target as HTMLInputElement).value"
                    />
                  </div>

                  <!-- Méthode de paiement -->
                  <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px;">
                    <label :style="S.label">Méthode de paiement</label>
                    <select
                      :value="methodePaiement"
                      :style="S.select"
                      @change="methodePaiement = ($event.target as HTMLSelectElement).value as MethodePaiement"
                    >
                      <option value="CASH">Cash</option>
                      <option value="WAVE">Wave</option>
                      <option value="ORANGE">Orange</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Bloc 4 — Récapitulatif -->
              <div v-if="activityDetail && typeForfait" style="margin-bottom: 24px; padding-top: 8px; border-top: 1px solid var(--gf-bg);">
                <p style="font-size: 12px; font-weight: 700; color: var(--gf-dark); margin: 0 0 8px; letter-spacing: 0.02em;">Récapitulatif</p>
                <div style="background: #fff3e0; border-left: 4px solid #fb8c00; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; color: var(--gf-dark);">
                  Montant Total + Frais D'inscription ({{ fmt(nominalFraisInscription) }}) :
                  <strong>{{ fmt(total) }}</strong>
                </div>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: var(--gf-dark);">
                  <input v-model="fraisSeulement" type="checkbox" />
                  Prendre seulement les frais d'inscription
                </label>
              </div>

            </template>

            <!-- ── Boutons ────────────────────────────────────────────────── -->
            <div style="margin-top: 8px; padding-top: 16px; border-top: 1px solid var(--gf-bg); display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
              <button
                type="button"
                class="gf-btn-action gf-btn-action--view"
                :style="S.btnAction"
                @click="router.back()"
              >
                Annuler
              </button>
              <button
                type="submit"
                class="gf-btn-action gf-btn-action--edit"
                :style="{
                  ...S.btnAction,
                  cursor: submitDisabled ? 'not-allowed' : 'pointer',
                  opacity: submitDisabled ? '0.55' : '1',
                }"
                :disabled="submitDisabled"
              >
                {{ submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter un membre' }}
              </button>
            </div>

            <p v-if="submitError" :style="{ ...S.errText, marginTop: '12px', textAlign: 'right' }">
              {{ submitError }}
            </p>

          </form>
        </div>
      </div>
    </div>

    <!-- ── Toast ──────────────────────────────────────────────────────────── -->
    <div
      v-if="toastMsg"
      style="position: fixed; bottom: 24px; right: 24px; background: #43A047; color: var(--gf-white); border-radius: 10px; padding: 14px 20px; font-size: 14px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 9999; display: flex; align-items: center; gap: 10px; max-width: 360px;"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17L4 12" stroke="var(--gf-white)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {{ toastMsg }}
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
