<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Phone, Printer, QrCode as QrCodeIcon } from 'lucide-vue-next'
import QRCode from 'qrcode'
import api from '@/api/axios'
import { useAuthStore } from '@/stores/auth'
import type { Member } from '@/types'
import { normalizeMemberFromApi } from '@/utils/memberApiNormalize'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

type MemberStatus = 'ACTIF' | 'INACTIF' | 'EN_ATTENTE'

const AVATAR_COLORS = [
  'linear-gradient(135deg,#49a3f1,#1A73E8)',
  'linear-gradient(135deg,#66BB6A,#388E3C)',
  'linear-gradient(135deg,#FFA726,#F57C00)',
  'linear-gradient(135deg,#AB47BC,#7B1FA2)',
  'linear-gradient(135deg,#26C6Da,#0097A7)',
  'linear-gradient(135deg,#EF5350,#C62828)',
]

const STATUS_MAP: Record<MemberStatus, { label: string; badgeClass: string }> = {
  ACTIF:      { label: 'Actif',      badgeClass: 'active' },
  INACTIF:    { label: 'Inactif',    badgeClass: 'inactive' },
  EN_ATTENTE: { label: 'En attente', badgeClass: 'pending' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMemberStatus(m: Member): MemberStatus {
  const subs = m.subscriptions ?? []
  if (subs.length === 0) return 'EN_ATTENTE'
  const last = subs[0]
  return new Date(last.date_prochain_paiement) >= new Date() ? 'ACTIF' : 'INACTIF'
}

function fmtDate(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getInitials(m: Member): string {
  if (m.initials) return m.initials
  return `${(m.prenom ?? '?').charAt(0)}${(m.nom ?? '?').charAt(0)}`.toUpperCase()
}

function avatarGradient(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function memberPath(m: Member): string {
  return m.slug ?? String(m.id)
}

function memberWhatsAppUrl(m: Member): string {
  const msg = `GymFlow — Carte membre\nNom : ${m.prenom} ${m.nom}\nTéléphone : ${m.phone ?? '—'}\nCode QR : ${m.uuid_qr}`
  const text = encodeURIComponent(msg)
  const digits = (m.phone ?? '').replace(/\D/g, '')
  if (digits.length >= 8) return `https://wa.me/${digits}?text=${text}`
  return `https://wa.me/?text=${text}`
}

// ── Store / Router ────────────────────────────────────────────────────────────

const auth   = useAuthStore()
const router = useRouter()

const canEditOrAdd = computed(() => auth.role === 'ADMIN' || auth.role === 'CASHIER')
const canDelete    = computed(() => auth.role === 'ADMIN')

// ── State ─────────────────────────────────────────────────────────────────────

const members    = ref<Member[]>([])
const loading    = ref(true)
const error      = ref('')
const search     = ref('')
const page       = ref(1)
const viewMember = ref<Member | null>(null)
const qrMini     = ref<Record<number, string>>({})
const qrModal    = ref('')

// ── Computed pagination ───────────────────────────────────────────────────────

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return members.value.filter(m =>
    m.prenom.toLowerCase().includes(q) ||
    m.nom.toLowerCase().includes(q) ||
    (m.email ?? '').toLowerCase().includes(q),
  )
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const safePage   = computed(() => Math.min(page.value, totalPages.value))
const pageStart  = computed(() => (safePage.value - 1) * PAGE_SIZE)
const pageEnd    = computed(() => Math.min(pageStart.value + PAGE_SIZE, filtered.value.length))
const pageRows   = computed(() => filtered.value.slice(pageStart.value, pageEnd.value))

watch(search, () => { page.value = 1 })

// ── QR generation ────────────────────────────────────────────────────────────

async function generateMiniQrs(list: Member[]) {
  const result: Record<number, string> = {}
  await Promise.all(
    list.map(async (m) => {
      try {
        result[m.id] = await QRCode.toDataURL(m.uuid_qr, { width: 90, margin: 1 })
      } catch {
        // ignore individual failures
      }
    }),
  )
  qrMini.value = result
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchMembers() {
  loading.value = true
  error.value   = ''
  try {
    const res  = await api.get('/members')
    const data = res.data?.data ?? res.data
    const list: Member[] = Array.isArray(data)
      ? data.map((row: unknown) => normalizeMemberFromApi(row))
      : []
    members.value = list
    generateMiniQrs(list)
  } catch {
    error.value = 'Impossible de charger les membres.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchMembers)

// ── Actions ───────────────────────────────────────────────────────────────────

async function openQrModal(m: Member) {
  viewMember.value = m
  qrModal.value = ''
  try {
    qrModal.value = await QRCode.toDataURL(m.uuid_qr, { width: 200, margin: 1 })
  } catch {
    // ignore
  }
}

function closeQrModal() {
  viewMember.value = null
  qrModal.value = ''
}

function printQr() {
  window.print()
}

async function handleDelete(m: Member) {
  if (!window.confirm(`Supprimer le membre "${m.prenom} ${m.nom}" ? Cette action est irréversible.`)) return
  const deletedId = Number(m.id)
  try {
    await api.delete(`/members/${encodeURIComponent(memberPath(m))}`)
    members.value = members.value.filter(x => Number(x.id) !== deletedId)
  } catch {
    alert('Impossible de supprimer ce membre.')
  }
}
</script>

<template>
  <div class="gf-page">
    <div class="gf-card-outer">
      <div class="gf-card">

        <!-- ── En-tête ───────────────────────────────────────────────────── -->
        <div class="gf-card-header gf-card-header--info">
          <div>
            <p class="gf-card-header__title">Liste des membres</p>
            <p class="gf-card-header__sub">Gestion des membres inscrits</p>
          </div>
          <button
            v-if="canEditOrAdd"
            type="button"
            class="gf-btn-header"
            @click="router.push('/members/new')"
          >
            <span style="font-size: 16px; line-height: 1;">+</span>
            Ajouter
          </button>
        </div>

        <!-- ── Barre de recherche ────────────────────────────────────────── -->
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
            <input v-model="search" type="text" placeholder="Rechercher un membre…" />
          </div>
          <span class="gf-count-label">
            {{ filtered.length }} membre{{ filtered.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <!-- ── Erreur ────────────────────────────────────────────────────── -->
        <div
          v-if="error"
          style="margin: 12px 20px 0; background: var(--gf-alert-error-bg); color: var(--gf-alert-error-text); border-radius: 8px; padding: 10px 14px; font-size: 13px;"
        >
          {{ error }}
        </div>

        <!-- ── Grille membres ────────────────────────────────────────────── -->
        <div class="gf-card-body--table">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">

            <!-- Squelettes -->
            <template v-if="loading">
              <div
                v-for="i in 6"
                :key="i"
                class="gf-card"
                style="padding: 14px; box-shadow: var(--gf-shadow-card); border: 1px solid var(--gf-border); background: var(--gf-white); display: flex; flex-direction: column; gap: 10px;"
              >
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                  <div class="gf-skeleton" style="width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;" />
                  <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px;">
                    <div class="gf-skeleton" style="width: 85%; height: 14px;" />
                    <div class="gf-skeleton" style="width: 64px; height: 18px; border-radius: 6px;" />
                    <div class="gf-skeleton" style="width: 55%; height: 10px;" />
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <div class="gf-skeleton" style="width: 100%; height: 12px;" />
                  <div class="gf-skeleton" style="width: 100%; height: 12px;" />
                </div>
                <div style="display: flex; justify-content: center; margin-top: 4px;">
                  <div class="gf-skeleton" style="width: 90px; height: 90px; border-radius: 8px;" />
                </div>
                <div class="gf-skeleton" style="width: 100%; height: 36px; border-radius: 8px;" />
              </div>
            </template>

            <!-- Aucun résultat -->
            <div
              v-else-if="pageRows.length === 0"
              style="grid-column: 1 / -1; text-align: center; padding: 48px 0; color: var(--gf-muted); font-size: 13px;"
            >
              Aucun membre trouvé.
            </div>

            <!-- Cartes membres -->
            <template v-else>
              <div
                v-for="m in pageRows"
                :key="m.id"
                class="gf-card"
                style="padding: 0; box-shadow: var(--gf-shadow-card); border: 1px solid var(--gf-border); background: var(--gf-white); display: flex; flex-direction: column; min-height: 0;"
              >
                <!-- Identité -->
                <div style="padding: 16px 14px 14px;">
                  <div style="display: flex; align-items: flex-start; gap: 10px; position: relative;">
                    <div
                      :style="{
                        width: '44px', height: '44px', borderRadius: '50%',
                        background: avatarGradient(m.id),
                        color: 'var(--gf-white)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: '700', flexShrink: '0',
                      }"
                    >
                      {{ getInitials(m) }}
                    </div>
                    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px;">
                      <div style="width: 100%; font-size: 13px; font-weight: 700; color: var(--gf-dark); line-height: 1.25; word-break: break-word;">
                        {{ `${m.prenom} ${m.nom}`.toUpperCase() }}
                      </div>
                      <div style="font-size: 10px; color: var(--gf-muted); margin-top: 3px;">
                        Membre depuis {{ fmtDate(m.date_inscription ?? m.createdAt) }}
                      </div>
                    </div>
                    <div style="position: absolute; top: -5px; right: 10px;">
                      <span :class="`gf-badge gf-badge--${STATUS_MAP[getMemberStatus(m)].badgeClass}`">
                        {{ STATUS_MAP[getMemberStatus(m)].label }}
                      </span>
                    </div>
                  </div>
                </div>

                <div style="border-top: 1px solid #f0f2f5; margin: 4px 0;" />

                <!-- Coordonnées -->
                <div style="display: flex; flex-direction: column; gap: 9px; padding: 12px 14px;">
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--gf-dark);">
                    <Phone :size="14" :stroke-width="2" style="flex-shrink: 0; color: var(--gf-muted);" aria-hidden="true" />
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ m.phone ?? '—' }}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--gf-dark);">
                    <Mail :size="14" :stroke-width="2" style="flex-shrink: 0; color: var(--gf-muted);" aria-hidden="true" />
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ m.email ?? '—' }}</span>
                  </div>
                  <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--gf-dark); line-height: 1.35;">
                    <svg
                      width="13" height="13" viewBox="0 0 24 24"
                      fill="none" stroke="#7b809a"
                      stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                      style="flex-shrink: 0; margin-top: 2px;" aria-hidden="true"
                    >
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9,22 9,12 15,12 15,22" />
                    </svg>
                    <span style="word-break: break-word;">{{ m.adresse ?? '—' }}</span>
                  </div>
                </div>

                <div style="border-top: 1px solid #f0f2f5; margin: 4px 0;" />

                <!-- QR miniature -->
                <div style="display: flex; justify-content: center; padding: 12px 14px 10px;">
                  <div style="background: var(--gf-white); padding: 6px; border-radius: 8px; border: 1px solid var(--gf-border); line-height: 0;">
                    <img
                      v-if="qrMini[m.id]"
                      :src="qrMini[m.id]"
                      width="90" height="90"
                      style="display: block;"
                      alt="QR Code"
                    />
                    <div v-else class="gf-skeleton" style="width: 90px; height: 90px;" />
                  </div>
                </div>

                <div style="border-top: 1px solid #f0f2f5; margin: 4px 0;" />

                <!-- Actions -->
                <div style="display: flex; gap: 8px; align-items: center; margin-top: auto; padding: 12px 14px 16px;">
                  <button
                    type="button"
                    title="Afficher"
                    style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 36px; padding: 0 10px; border-radius: 8px; border: none; background: var(--gf-grad-info); color: var(--gf-white); cursor: pointer;"
                    @click="router.push(`/members/${memberPath(m)}`)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title="QR Code"
                    style="width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: none; background: var(--gf-grad-info); color: var(--gf-white); cursor: pointer;"
                    @click="openQrModal(m)"
                  >
                    <QrCodeIcon :size="18" :stroke-width="2" aria-hidden="true" />
                  </button>
                  <button
                    v-if="canEditOrAdd"
                    type="button"
                    title="Modifier"
                    class="gf-btn-action gf-btn-action--edit"
                    style="width: 36px; height: 36px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px;"
                    @click="router.push(`/members/${memberPath(m)}/edit`)"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    v-if="canDelete"
                    type="button"
                    title="Supprimer"
                    class="gf-btn-action gf-btn-action--delete"
                    style="width: 36px; height: 36px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px;"
                    @click="handleDelete(m)"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- ── Pagination ────────────────────────────────────────────────── -->
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

  <!-- ── Portal (modal + impression) ──────────────────────────────────────── -->
  <Teleport to="body">

    <!-- Overlay modal QR Code -->
    <div
      v-if="viewMember"
      style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px;"
      @click.self="closeQrModal"
    >
      <div style="background: var(--gf-white); border-radius: 12px; padding: 24px; max-width: 340px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <!-- Titre modal -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--gf-dark);">QR Code membre</h3>
          <button type="button" style="background: none; border: none; cursor: pointer; color: var(--gf-muted); font-size: 22px; line-height: 1; padding: 0;" @click="closeQrModal">&times;</button>
        </div>
        <!-- Contenu -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
          <div style="background: var(--gf-white); padding: 12px; border-radius: 12px; border: 1px solid var(--gf-border); line-height: 0;">
            <img v-if="qrModal" :src="qrModal" width="200" height="200" style="display: block;" alt="QR Code" />
            <div v-else class="gf-skeleton" style="width: 200px; height: 200px;" />
          </div>
          <p style="font-family: monospace; font-size: 11px; color: var(--gf-muted); text-align: center; word-break: break-all; max-width: 260px; line-height: 1.5; margin: 0;">
            {{ viewMember.uuid_qr }}
          </p>
          <div style="font-weight: 700; text-align: center; color: var(--gf-dark); font-size: 15px;">
            {{ viewMember.prenom }} {{ viewMember.nom }}
          </div>
          <!-- WhatsApp -->
          <a
            :href="memberWhatsAppUrl(viewMember)"
            target="_blank"
            rel="noopener noreferrer"
            style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 16px; border-radius: 8px; border: none; background: var(--gf-whatsapp); color: var(--gf-white); font-size: 14px; font-weight: 600; text-decoration: none; box-sizing: border-box;"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.883 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </a>
          <!-- Imprimer -->
          <button
            type="button"
            style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 16px; border-radius: 8px; border: none; background: var(--gf-grad-warning); color: var(--gf-white); font-size: 14px; font-weight: 600; cursor: pointer;"
            @click="printQr"
          >
            <Printer :size="20" :stroke-width="2" aria-hidden="true" />
            Imprimer
          </button>
        </div>
      </div>
    </div>

    <!-- Zone d'impression -->
    <div
      v-if="viewMember"
      class="gf-member-qr-print--portal"
      aria-hidden="true"
    >
      <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
        <div style="background: white; padding: 12px; border-radius: 12px; border: 1px solid #e0e0e0; line-height: 0;">
          <img v-if="qrModal" :src="qrModal" width="200" height="200" style="display: block;" alt="QR Code" />
        </div>
        <div style="font-family: monospace; font-size: 11px; color: #666; text-align: center; word-break: break-all; max-width: 260px; line-height: 1.5;">
          {{ viewMember.uuid_qr }}
        </div>
        <div style="font-weight: 700; text-align: center; font-size: 15px;">
          {{ viewMember.prenom }} {{ viewMember.nom }}
        </div>
      </div>
    </div>

  </Teleport>
</template>
