<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import api from '@/api/axios'
import type { User, Role } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

type ExtUser = User & { isActive?: boolean }

interface UserFormData {
  fullName: string
  email: string
  role: Role
  active: boolean
  password: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const ROLE_BADGE: Record<Role, { cls: string; label: string }> = {
  ADMIN:      { cls: 'gf-badge--purple', label: 'Admin' },
  CASHIER:    { cls: 'gf-badge--info',   label: 'Caissier' },
  CONTROLLER: { cls: 'gf-badge--active', label: 'Contrôleur' },
}

const EMPTY_FORM: UserFormData = {
  fullName: '',
  email: '',
  role: 'CASHIER',
  active: true,
  password: '',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function avatarGradient(role: Role): string {
  switch (role) {
    case 'ADMIN':      return 'linear-gradient(135deg,#CE93D8,#8e24aa)'
    case 'CASHIER':    return 'linear-gradient(135deg,#49a3f1,#1A73E8)'
    case 'CONTROLLER': return 'linear-gradient(135deg,#66BB6A,#43A047)'
  }
}

function getInitials(u: ExtUser): string {
  const name = (u.fullName ?? '').trim()
  if (!name) return u.email.charAt(0).toUpperCase()
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  return name.charAt(0).toUpperCase()
}

function displayFullName(u: ExtUser): string {
  return (u.fullName ?? '').trim() || u.email
}

// ── Store ──────────────────────────────────────────────────────────────────────

const auth    = useAuthStore()
const isAdmin = computed(() => auth.role === 'ADMIN')

// ── State ──────────────────────────────────────────────────────────────────────

const users      = ref<ExtUser[]>([])
const loading    = ref(true)
const error      = ref('')
const search     = ref('')
const page       = ref(1)
const modalOpen  = ref(false)
const editTarget = ref<ExtUser | null>(null)

// ── Modal form state ───────────────────────────────────────────────────────────

const form         = ref<UserFormData>({ ...EMPTY_FORM })
const saving       = ref(false)
const formErr      = ref('')
const showPassword = ref(false)

// ── Computed pagination ────────────────────────────────────────────────────────

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return users.value.filter(u => {
    const name = (u.fullName ?? '').toLowerCase()
    return name.includes(q) || u.email.toLowerCase().includes(q)
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const safePage   = computed(() => Math.min(page.value, totalPages.value))
const pageStart  = computed(() => (safePage.value - 1) * PAGE_SIZE)
const pageEnd    = computed(() => Math.min(pageStart.value + PAGE_SIZE, filtered.value.length))
const pageRows   = computed(() => filtered.value.slice(pageStart.value, pageEnd.value))
const isEdit     = computed(() => editTarget.value !== null)

watch(search, () => { page.value = 1 })

// ── Fetch ──────────────────────────────────────────────────────────────────────

async function fetchUsers() {
  loading.value = true
  error.value   = ''
  try {
    const res     = await api.get('/users')
    const payload = res.data?.data ?? res.data
    const list    = Array.isArray(payload) ? payload : (payload?.items ?? [])
    const arr     = Array.isArray(list) ? list : []
    users.value = arr.map((raw: ExtUser) => ({
      ...raw,
      active: raw.active ?? raw.isActive ?? true,
    }))
  } catch {
    error.value = 'Impossible de charger les utilisateurs.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsers)

// ── Modal helpers ──────────────────────────────────────────────────────────────

function openCreate() {
  editTarget.value  = null
  form.value        = { ...EMPTY_FORM }
  formErr.value     = ''
  showPassword.value = false
  modalOpen.value   = true
}

function openEdit(u: ExtUser) {
  editTarget.value = u
  form.value = {
    fullName: u.fullName ?? '',
    email:    u.email,
    role:     u.role,
    active:   u.active !== false,
    password: '',
  }
  formErr.value      = ''
  showPassword.value = false
  modalOpen.value    = true
}

function closeModal() {
  modalOpen.value = false
}

async function handleSubmit() {
  if (!form.value.email.trim())    { formErr.value = "L'email est obligatoire."; return }
  if (!form.value.fullName.trim()) { formErr.value = 'Le nom complet est obligatoire.'; return }
  if (!isEdit.value && !form.value.password.trim()) {
    formErr.value = 'Le mot de passe est obligatoire.'
    return
  }
  saving.value  = true
  formErr.value = ''
  try {
    if (isEdit.value && editTarget.value) {
      await api.put(`/users/${editTarget.value.id}`, {
        fullName: form.value.fullName.trim(),
        email:    form.value.email.trim(),
        role:     form.value.role,
        active:   form.value.active,
      })
    } else {
      await api.post('/users', {
        fullName: form.value.fullName.trim(),
        email:    form.value.email.trim(),
        role:     form.value.role,
        password: form.value.password,
        active:   form.value.active,
      })
    }
    closeModal()
    await fetchUsers()
  } catch {
    formErr.value = 'Impossible de sauvegarder les modifications.'
  } finally {
    saving.value = false
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────────

async function handleDelete(u: ExtUser) {
  if (u.id === auth.user?.id) {
    window.alert('Vous ne pouvez pas supprimer votre propre compte.')
    return
  }
  const name = displayFullName(u)
  if (!window.confirm(`Supprimer l'utilisateur "${name}" ? Cette action est irréversible.`)) return
  const deletedId = Number(u.id)
  try {
    await api.delete(`/users/${deletedId}`)
    users.value = users.value.filter(x => Number(x.id) !== deletedId)
  } catch {
    window.alert('Impossible de supprimer cet utilisateur.')
  }
}
</script>

<template>
  <div class="gf-page">
    <div class="gf-card-outer">
      <div class="gf-card">

        <!-- ── En-tête flottant ─────────────────────────────────────────────── -->
        <div class="gf-card-header gf-card-header--info">
          <div>
            <p class="gf-card-header__title">Utilisateurs</p>
            <p class="gf-card-header__sub">Gestion des comptes utilisateurs</p>
          </div>
          <button
            v-if="isAdmin"
            type="button"
            class="gf-btn-header"
            @click="openCreate"
          >
            <span style="font-size: 16px; line-height: 1;">+</span>
            Ajouter
          </button>
        </div>

        <!-- ── Toolbar ──────────────────────────────────────────────────────── -->
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
              placeholder="Rechercher un utilisateur…"
            />
          </div>
          <span class="gf-count-label">
            {{ filtered.length }} utilisateur{{ filtered.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <!-- ── Erreur ───────────────────────────────────────────────────────── -->
        <div
          v-if="error"
          style="
            margin: 12px 20px 0;
            background: #fde8e8;
            color: #F44335;
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 13px;
          "
        >
          {{ error }}
        </div>

        <!-- ── Tableau ──────────────────────────────────────────────────────── -->
        <div class="gf-card-body--table">
          <table class="gf-table" style="min-width: 760px;">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <!-- Squelettes -->
              <template v-if="loading">
                <tr v-for="i in 6" :key="i">
                  <td><div class="gf-skeleton" style="width: 200px;" /></td>
                  <td><div class="gf-skeleton" style="width: 110px;" /></td>
                  <td><div class="gf-skeleton" style="width: 80px;" /></td>
                </tr>
              </template>

              <!-- Aucun résultat -->
              <tr v-else-if="pageRows.length === 0">
                <td
                  colspan="3"
                  style="
                    text-align: center;
                    padding: 48px 0;
                    color: var(--gf-muted);
                    font-size: 13px;
                  "
                >
                  Aucun utilisateur trouvé.
                </td>
              </tr>

              <!-- Lignes -->
              <template v-else>
                <tr v-for="u in pageRows" :key="u.id">

                  <!-- Utilisateur -->
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div
                        :style="{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: avatarGradient(u.role),
                          color: 'var(--gf-white)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '700',
                          flexShrink: '0',
                        }"
                      >
                        {{ getInitials(u) }}
                      </div>
                      <div>
                        <div style="font-size: 13px; font-weight: 700; color: var(--gf-dark);">
                          {{ displayFullName(u) }}
                        </div>
                        <div style="font-size: 11px; color: var(--gf-muted);">{{ u.email }}</div>
                      </div>
                    </div>
                  </td>

                  <!-- Rôle -->
                  <td>
                    <span :class="`gf-badge ${ROLE_BADGE[u.role].cls}`">
                      {{ ROLE_BADGE[u.role].label }}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td>
                    <div v-if="isAdmin" style="display: flex; gap: 6px;">
                      <button
                        type="button"
                        class="gf-btn-action gf-btn-action--edit"
                        title="Modifier"
                        @click="openEdit(u)"
                      >
                        <svg
                          width="13" height="13" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor"
                          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="gf-btn-action gf-btn-action--delete"
                        :title="u.id === auth.user?.id ? 'Impossible de supprimer votre propre compte' : 'Supprimer'"
                        :disabled="u.id === auth.user?.id"
                        :style="u.id === auth.user?.id ? { opacity: '0.4', cursor: 'not-allowed' } : undefined"
                        @click="handleDelete(u)"
                      >
                        <svg
                          width="13" height="13" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor"
                          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                    <span v-else style="font-size: 11px; color: #c0c4cc;">—</span>
                  </td>

                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- ── Pagination ────────────────────────────────────────────────────── -->
        <div v-if="!loading && filtered.length > 0" class="gf-pagination">
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

  <!-- ── Modal création / édition ─────────────────────────────────────────────── -->
  <Teleport to="body">
    <div
      v-if="modalOpen"
      style="
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 24px;
      "
      @click.self="closeModal"
    >
      <div
        style="
          background: var(--gf-white);
          border-radius: 12px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.18);
          width: 100%;
          max-width: 440px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        "
      >
        <!-- En-tête modal -->
        <div
          style="
            background: linear-gradient(195deg, #EC407A, #D81B60);
            border-radius: 12px 12px 0 0;
            padding: 14px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          "
        >
          <div>
            <p style="color: var(--gf-white); font-size: 14px; font-weight: 700; margin: 0;">
              {{ isEdit ? "Modifier l'utilisateur" : 'Nouvel utilisateur' }}
            </p>
            <p style="color: rgba(255,255,255,0.75); font-size: 11px; margin: 3px 0 0;">
              {{ isEdit ? 'Mettre à jour le compte' : "Créer un compte d'accès GymFlow" }}
            </p>
          </div>
          <button
            type="button"
            style="
              background: rgba(255,255,255,0.2);
              border: 1px solid rgba(255,255,255,0.4);
              color: var(--gf-white);
              width: 28px;
              height: 28px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
            "
            @click="closeModal"
          >
            ✕
          </button>
        </div>

        <!-- Corps modal -->
        <div style="overflow-y: auto; flex: 1; min-height: 0;">
          <form
            style="padding: 20px; display: flex; flex-direction: column; gap: 14px;"
            @submit.prevent="handleSubmit"
          >
            <!-- Nom complet -->
            <div style="display: flex; flex-direction: column; gap: 5px;">
              <label style="font-size: 11px; font-weight: 700; color: var(--gf-muted); text-transform: uppercase; letter-spacing: 0.5px;">
                Nom complet <span style="color: #F44335;">*</span>
              </label>
              <input
                v-model="form.fullName"
                type="text"
                placeholder="Jean Dupont"
                style="
                  border: 1px solid var(--gf-border);
                  border-radius: 8px;
                  padding: 10px 14px;
                  font-size: 13px;
                  color: var(--gf-dark);
                  outline: none;
                  font-family: inherit;
                  width: 100%;
                  box-sizing: border-box;
                "
              />
            </div>

            <!-- Email -->
            <div style="display: flex; flex-direction: column; gap: 5px;">
              <label style="font-size: 11px; font-weight: 700; color: var(--gf-muted); text-transform: uppercase; letter-spacing: 0.5px;">
                Email <span style="color: #F44335;">*</span>
              </label>
              <input
                v-model="form.email"
                type="email"
                placeholder="jean.dupont@exemple.com"
                style="
                  border: 1px solid var(--gf-border);
                  border-radius: 8px;
                  padding: 10px 14px;
                  font-size: 13px;
                  color: var(--gf-dark);
                  outline: none;
                  font-family: inherit;
                  width: 100%;
                  box-sizing: border-box;
                "
              />
            </div>

            <!-- Mot de passe (création uniquement) -->
            <div v-if="!isEdit" style="display: flex; flex-direction: column; gap: 5px;">
              <label style="font-size: 11px; font-weight: 700; color: var(--gf-muted); text-transform: uppercase; letter-spacing: 0.5px;">
                Mot de passe <span style="color: #F44335;">*</span>
              </label>
              <div style="position: relative;">
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="••••••••"
                  style="
                    border: 1px solid var(--gf-border);
                    border-radius: 8px;
                    padding: 10px 42px 10px 14px;
                    font-size: 13px;
                    color: var(--gf-dark);
                    outline: none;
                    font-family: inherit;
                    width: 100%;
                    box-sizing: border-box;
                  "
                />
                <button
                  type="button"
                  style="
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    color: var(--gf-muted);
                    display: flex;
                    align-items: center;
                  "
                  :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="showPassword" :size="16" />
                  <Eye v-else :size="16" />
                </button>
              </div>
            </div>

            <!-- Rôle -->
            <div style="display: flex; flex-direction: column; gap: 5px;">
              <label style="font-size: 11px; font-weight: 700; color: var(--gf-muted); text-transform: uppercase; letter-spacing: 0.5px;">
                Rôle
              </label>
              <select
                v-model="form.role"
                style="
                  border: 1px solid var(--gf-border);
                  border-radius: 8px;
                  padding: 10px 14px;
                  font-size: 13px;
                  color: var(--gf-dark);
                  outline: none;
                  font-family: inherit;
                  width: 100%;
                  box-sizing: border-box;
                  cursor: pointer;
                  background: var(--gf-white);
                "
              >
                <option value="CASHIER">Caissier</option>
                <option value="ADMIN">Admin</option>
                <option value="CONTROLLER">Contrôleur</option>
              </select>
            </div>

            <!-- Compte actif -->
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--gf-dark); cursor: pointer;">
              <input
                v-model="form.active"
                type="checkbox"
                style="width: 15px; height: 15px; accent-color: #1A73E8;"
              />
              Compte actif
            </label>

            <!-- Erreur formulaire -->
            <p v-if="formErr" style="color: #F44335; font-size: 12px; margin: 0;">
              {{ formErr }}
            </p>

            <!-- Boutons -->
            <div style="display: flex; gap: 10px; padding-top: 8px; border-top: 1px solid var(--gf-bg);">
              <button
                type="button"
                style="
                  flex: 1;
                  padding: 10px 0;
                  border-radius: 8px;
                  border: 1px solid var(--gf-border);
                  background: var(--gf-white);
                  color: var(--gf-muted);
                  font-size: 13px;
                  font-weight: 600;
                  cursor: pointer;
                "
                @click="closeModal"
              >
                Annuler
              </button>
              <button
                type="submit"
                :disabled="saving"
                :style="{
                  flex: '1',
                  padding: '10px 0',
                  borderRadius: '8px',
                  border: 'none',
                  background: saving ? '#a0aec0' : 'linear-gradient(195deg, #EC407A, #D81B60)',
                  color: 'var(--gf-white)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: saving ? 'none' : '0 3px 10px rgba(233,30,99,0.3)',
                }"
              >
                {{ saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : "Créer l'utilisateur" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>
