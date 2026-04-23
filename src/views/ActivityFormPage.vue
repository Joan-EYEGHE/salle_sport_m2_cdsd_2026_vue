<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '@/api/axios'
import type { Activity } from '@/types'

// ── Détection du mode ─────────────────────────────────────────────────────────

const route  = useRoute()
const router = useRouter()

const rawId   = route.params.id
const idParam = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined)
const isEdit  = !!idParam

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityForm {
  nom:               string
  status:            boolean
  isMonthlyOnly:     boolean
  frais_inscription: number
  prix_ticket:       number
  prix_hebdomadaire: number
  prix_mensuel:      number
  prix_trimestriel:  number
  prix_annuel:       number
}

// ── State ─────────────────────────────────────────────────────────────────────

const form = ref<ActivityForm>({
  nom:               '',
  status:            true,
  isMonthlyOnly:     false,
  frais_inscription: 0,
  prix_ticket:       0,
  prix_hebdomadaire: 0,
  prix_mensuel:      0,
  prix_trimestriel:  0,
  prix_annuel:       0,
})

const loadState = ref<'idle' | 'loading' | 'ready' | 'error'>(isEdit ? 'loading' : 'ready')
const saving    = ref(false)
const err       = ref('')

// ── Chargement en mode édition ────────────────────────────────────────────────

let cancelled = false
onUnmounted(() => { cancelled = true })

onMounted(async () => {
  if (!isEdit || !idParam) {
    loadState.value = 'ready'
    return
  }
  loadState.value = 'loading'
  try {
    const res = await api.get(`/activities/${encodeURIComponent(idParam)}`)
    if (cancelled) return
    const raw = (res.data?.data ?? res.data) as Activity
    form.value = {
      nom:               raw.nom               ?? '',
      status:            raw.status             ?? true,
      isMonthlyOnly:     Boolean(raw.isMonthlyOnly),
      frais_inscription: Number(raw.frais_inscription) || 0,
      prix_ticket:       Number(raw.prix_ticket)       || 0,
      prix_hebdomadaire: Number(raw.prix_hebdomadaire) || 0,
      prix_mensuel:      Number(raw.prix_mensuel)      || 0,
      prix_trimestriel:  Number(raw.prix_trimestriel)  || 0,
      prix_annuel:       Number(raw.prix_annuel)        || 0,
    }
    loadState.value = 'ready'

    // Redirige si le slug canonique diffère du paramètre utilisé
    const resolvedSlug =
      typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug.trim() : ''
    if (
      resolvedSlug &&
      idParam &&
      (idParam !== resolvedSlug || /^\d+$/.test(idParam))
    ) {
      router.replace(`/activities/${encodeURIComponent(resolvedSlug)}/edit`)
    }
  } catch {
    if (cancelled) return
    loadState.value = 'error'
  }
})

// ── Soumission ────────────────────────────────────────────────────────────────

async function handleSubmit() {
  if (!form.value.nom.trim()) {
    err.value = 'Le nom est obligatoire.'
    return
  }
  saving.value = true
  err.value    = ''
  try {
    if (isEdit && idParam) {
      await api.put(`/activities/${encodeURIComponent(idParam)}`, form.value)
    } else {
      await api.post('/activities', form.value)
    }
    router.push('/activities')
  } catch {
    err.value = 'Impossible de sauvegarder les modifications.'
  } finally {
    saving.value = false
  }
}

// ── Styles partagés ───────────────────────────────────────────────────────────

const fieldLabelStyle = {
  fontSize:      '11px',
  fontWeight:    '700',
  color:         'var(--gf-muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
}

const inputBaseStyle = {
  border:      '1px solid var(--gf-border)',
  borderRadius:'8px',
  padding:     '10px 14px',
  fontSize:    '13px',
  color:       'var(--gf-dark)',
  outline:     'none',
  fontFamily:  'inherit',
  width:       '100%',
  boxSizing:   'border-box' as const,
}
</script>

<template>
  <!-- ── Chargement ──────────────────────────────────────────────────────────── -->
  <div v-if="isEdit && loadState === 'loading'" class="gf-page" style="padding: 20px 24px 24px;">
    <div class="gf-card-outer">
      <div class="gf-card">
        <div
          class="gf-card-body"
          style="display: flex; justify-content: center; padding: 80px 20px;"
        >
          <div class="gf-spinner" />
        </div>
      </div>
    </div>
  </div>

  <!-- ── Erreur (activité introuvable) ───────────────────────────────────────── -->
  <div v-else-if="isEdit && loadState === 'error'" class="gf-page" style="padding: 20px 24px 24px;">
    <div class="gf-card-outer">
      <div class="gf-card">
        <div
          class="gf-card-body"
          style="text-align: center; padding: 48px 24px;"
        >
          <p style="color: var(--gf-muted); margin-bottom: 16px;">Activité introuvable.</p>
          <button
            type="button"
            class="gf-btn-header"
            @click="router.push('/activities')"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Formulaire ──────────────────────────────────────────────────────────── -->
  <div v-else class="gf-page" style="padding: 20px 24px 24px;">
    <div class="gf-card-outer">
      <div class="gf-card">

        <!-- En-tête -->
        <div
          style="
            background: linear-gradient(195deg, #49a3f1, #1A73E8);
            border-radius: 12px 12px 0 0;
            padding: 14px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          "
        >
          <div>
            <p style="color: var(--gf-white); font-size: 14px; font-weight: 700; margin: 0;">
              {{ isEdit ? "Modifier l'activité" : 'Nouvelle activité' }}
            </p>
            <p style="color: rgba(255,255,255,0.75); font-size: 11px; margin: 3px 0 0;">
              {{ isEdit ? 'Mettre à jour les informations' : 'Ajouter une activité au catalogue' }}
            </p>
          </div>
          <button
            type="button"
            style="
              background: rgba(255,255,255,0.2);
              border: 1px solid rgba(255,255,255,0.4);
              color: var(--gf-white);
              padding: 6px 12px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 13px;
            "
            @click="router.push('/activities')"
          >
            Fermer
          </button>
        </div>

        <!-- Corps du formulaire -->
        <div class="gf-card-body">
          <form
            style="padding: 8px 0 0; display: flex; flex-direction: column; gap: 14px;"
            @submit.prevent="handleSubmit"
          >

            <!-- Nom -->
            <div style="display: flex; flex-direction: column; gap: 5px;">
              <label :style="fieldLabelStyle">
                Nom de l'activité <span style="color: #F44335;">*</span>
              </label>
              <input
                v-model="form.nom"
                type="text"
                placeholder="Ex : Musculation, Cardio..."
                :style="inputBaseStyle"
                @focus="($event.target as HTMLInputElement).style.borderColor = '#1A73E8'"
                @blur="($event.target as HTMLInputElement).style.borderColor = 'var(--gf-border)'"
              />
            </div>

            <!-- Grille 2 colonnes — champs prix -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">

              <!-- Frais d'inscription -->
              <div style="display: flex; flex-direction: column; gap: 5px;">
                <label :style="fieldLabelStyle">Frais d'inscription (FCFA)</label>
                <input
                  v-model.number="form.frais_inscription"
                  type="number" min="0"
                  :style="inputBaseStyle"
                  @focus="($event.target as HTMLInputElement).style.borderColor = '#1A73E8'"
                  @blur="($event.target as HTMLInputElement).style.borderColor = 'var(--gf-border)'"
                />
              </div>

              <!-- Prix ticket -->
              <div style="display: flex; flex-direction: column; gap: 5px;">
                <label :style="fieldLabelStyle">Prix ticket (FCFA)</label>
                <input
                  v-model.number="form.prix_ticket"
                  type="number" min="0"
                  :style="inputBaseStyle"
                  @focus="($event.target as HTMLInputElement).style.borderColor = '#1A73E8'"
                  @blur="($event.target as HTMLInputElement).style.borderColor = 'var(--gf-border)'"
                />
              </div>

              <!-- Tarif hebdomadaire (désactivé si isMonthlyOnly) -->
              <div style="display: flex; flex-direction: column; gap: 5px;">
                <label :style="fieldLabelStyle">Tarif hebdomadaire (FCFA)</label>
                <input
                  v-model.number="form.prix_hebdomadaire"
                  type="number" min="0"
                  :disabled="form.isMonthlyOnly"
                  :style="{ ...inputBaseStyle, opacity: form.isMonthlyOnly ? '0.5' : '1' }"
                  @focus="($event.target as HTMLInputElement).style.borderColor = '#1A73E8'"
                  @blur="($event.target as HTMLInputElement).style.borderColor = 'var(--gf-border)'"
                />
              </div>

              <!-- Tarif mensuel -->
              <div style="display: flex; flex-direction: column; gap: 5px;">
                <label :style="fieldLabelStyle">Tarif mensuel (FCFA)</label>
                <input
                  v-model.number="form.prix_mensuel"
                  type="number" min="0"
                  :style="inputBaseStyle"
                  @focus="($event.target as HTMLInputElement).style.borderColor = '#1A73E8'"
                  @blur="($event.target as HTMLInputElement).style.borderColor = 'var(--gf-border)'"
                />
              </div>

              <!-- Tarif trimestriel (désactivé si isMonthlyOnly) -->
              <div style="display: flex; flex-direction: column; gap: 5px;">
                <label :style="fieldLabelStyle">Tarif trimestriel (FCFA)</label>
                <input
                  v-model.number="form.prix_trimestriel"
                  type="number" min="0"
                  :disabled="form.isMonthlyOnly"
                  :style="{ ...inputBaseStyle, opacity: form.isMonthlyOnly ? '0.5' : '1' }"
                  @focus="($event.target as HTMLInputElement).style.borderColor = '#1A73E8'"
                  @blur="($event.target as HTMLInputElement).style.borderColor = 'var(--gf-border)'"
                />
              </div>

              <!-- Tarif annuel (désactivé si isMonthlyOnly) -->
              <div style="display: flex; flex-direction: column; gap: 5px;">
                <label :style="fieldLabelStyle">Tarif annuel (FCFA)</label>
                <input
                  v-model.number="form.prix_annuel"
                  type="number" min="0"
                  :disabled="form.isMonthlyOnly"
                  :style="{ ...inputBaseStyle, opacity: form.isMonthlyOnly ? '0.5' : '1' }"
                  @focus="($event.target as HTMLInputElement).style.borderColor = '#1A73E8'"
                  @blur="($event.target as HTMLInputElement).style.borderColor = 'var(--gf-border)'"
                />
              </div>

            </div>

            <!-- Checkboxes statut / mensuel uniquement -->
            <div style="display: flex; align-items: center; gap: 20px;">
              <label
                style="
                  display: flex; align-items: center; gap: 8px;
                  font-size: 13px; color: var(--gf-dark); cursor: pointer;
                "
              >
                <input
                  v-model="form.status"
                  type="checkbox"
                  style="width: 15px; height: 15px; accent-color: #1A73E8;"
                />
                Actif
              </label>
              <label
                style="
                  display: flex; align-items: center; gap: 8px;
                  font-size: 13px; color: var(--gf-dark); cursor: pointer;
                "
              >
                <input
                  v-model="form.isMonthlyOnly"
                  type="checkbox"
                  style="width: 15px; height: 15px; accent-color: #1A73E8;"
                />
                Forfait mensuel uniquement
              </label>
            </div>

            <!-- Message d'erreur -->
            <p v-if="err" style="color: #F44335; font-size: 12px; margin: 0;">{{ err }}</p>

            <!-- Boutons Annuler / Sauvegarder -->
            <div
              style="
                display: flex; gap: 10px;
                padding-top: 8px;
                border-top: 1px solid var(--gf-bg);
              "
            >
              <button
                type="button"
                style="
                  flex: 1; padding: 10px 0; border-radius: 8px;
                  border: 1px solid var(--gf-border);
                  background: var(--gf-white);
                  color: var(--gf-muted);
                  font-size: 13px; font-weight: 600; cursor: pointer;
                "
                @click="router.push('/activities')"
              >
                Annuler
              </button>
              <button
                type="submit"
                :disabled="saving"
                :style="{
                  flex:       '1',
                  padding:    '10px 0',
                  borderRadius:'8px',
                  border:     'none',
                  background: 'linear-gradient(195deg, #49a3f1, #1A73E8)',
                  color:      'var(--gf-white)',
                  fontSize:   '13px',
                  fontWeight: '600',
                  cursor:     saving ? 'not-allowed' : 'pointer',
                  opacity:    saving ? '0.7' : '1',
                  boxShadow:  saving ? 'none' : '0 3px 10px rgba(26,115,232,0.3)',
                }"
              >
                {{ saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : "Créer l'activité" }}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  </div>
</template>
