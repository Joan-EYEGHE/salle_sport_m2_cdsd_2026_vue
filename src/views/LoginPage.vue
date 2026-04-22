<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Eye, EyeOff, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const loading = ref(false)

const DEMO_USERS = [
  { role: 'Admin',       email: 'admin@gymflow.com',      password: 'admin1234',      color: '#ef4444' },
  { role: 'Caissier',    email: 'cashier@gymflow.com',    password: 'cashier1234',    color: '#3b82f6' },
  { role: 'Contrôleur',  email: 'controller@gymflow.com', password: 'controller1234', color: '#22c55e' },
]

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push(auth.homeRoute)
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      (err as { message?: string })?.message ??
      'Identifiants incorrects. Veuillez réessayer.'
    error.value = msg
  } finally {
    loading.value = false
  }
}

function fillDemo(user: typeof DEMO_USERS[number]) {
  email.value = user.email
  password.value = user.password
  error.value = ''
}
</script>

<template>
  <div style="
    min-height: 100vh;
    background: linear-gradient(195deg, #42424a, #191919);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px 24px;
  ">
    <div style="
      width: 100%;
      max-width: 380px;
      background: var(--gf-white);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    ">
      <!-- En-tête carte bleue -->
      <div style="
        margin: -28px 20px 0;
        background: linear-gradient(195deg, #49a3f1, #1A73E8);
        border-radius: 10px;
        padding: 20px 24px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.14), 0 7px 10px rgba(26,115,232,0.4);
        text-align: center;
      ">
        <h1 style="color:var(--gf-white); font-size:18px; font-weight:700; margin:0">
          Connexion
        </h1>
        <p style="color:rgba(255,255,255,0.75); font-size:13px; margin:2px 0 0">
          Entrez vos identifiants pour accéder à GymFlow
        </p>
      </div>

      <!-- Formulaire -->
      <div style="padding: 24px 24px 20px">

        <!-- Email -->
        <div style="margin-bottom:18px">
          <label for="email" style="
            display: block;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--gf-muted);
            margin-bottom: 6px;
          ">
            Email
          </label>
          <input
            id="email"
            type="email"
            v-model="email"
            placeholder="admin@gymflow.com"
            @keyup.enter="handleSubmit"
            @focus="(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = '#1A73E8')"
            @blur="(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = 'var(--gf-border)')"
            style="
              width: 100%;
              box-sizing: border-box;
              border: 1px solid var(--gf-border);
              border-radius: 8px;
              padding: 10px 14px;
              font-size: 14px;
              color: var(--gf-dark);
              outline: none;
              transition: border-color 0.2s;
            "
          />
        </div>

        <!-- Mot de passe -->
        <div style="margin-bottom:20px">
          <label for="password" style="
            display: block;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--gf-muted);
            margin-bottom: 6px;
          ">
            Mot de passe
          </label>
          <div style="position:relative">
            <input
              id="password"
              :type="showPassword ? 'text' : 'password'"
              v-model="password"
              placeholder="••••••••"
              @keyup.enter="handleSubmit"
              @focus="(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = '#1A73E8')"
              @blur="(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = 'var(--gf-border)')"
              style="
                width: 100%;
                box-sizing: border-box;
                border: 1px solid var(--gf-border);
                border-radius: 8px;
                padding: 10px 42px 10px 14px;
                font-size: 14px;
                color: var(--gf-dark);
                outline: none;
                transition: border-color 0.2s;
              "
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
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
            >
              <EyeOff v-if="showPassword" :size="16" />
              <Eye v-else :size="16" />
            </button>
          </div>
        </div>

        <!-- Message d'erreur -->
        <div
          v-if="error"
          style="
            background: #fff5f5;
            border: 1px solid #fed7d7;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 16px;
            font-size: 13px;
            color: #c53030;
          "
        >
          {{ error }}
        </div>

        <!-- Bouton connexion -->
        <button
          type="button"
          :disabled="loading"
          @click="handleSubmit"
          :style="{
            width: '100%',
            background: loading ? '#a0aec0' : 'linear-gradient(195deg, #49a3f1, #1A73E8)',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            color: 'var(--gf-white)',
            fontSize: '14px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 3px 12px rgba(26,115,232,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'opacity 0.2s',
          }"
        >
          <template v-if="loading">
            <Loader2 :size="16" style="animation: spin 1s linear infinite" />
            Connexion en cours…
          </template>
          <template v-else>
            Se connecter
          </template>
        </button>
      </div>

      <!-- Comptes de démo -->
      <div style="padding: 16px 24px 20px; border-top: 1px solid var(--gf-bg)">
        <p style="
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--gf-muted);
          text-align: center;
          margin-bottom: 12px;
        ">
          Comptes de démonstration
        </p>
        <div style="display:flex; flex-direction:column; gap:8px">
          <button
            v-for="u in DEMO_USERS"
            :key="u.email"
            type="button"
            @click="fillDemo(u)"
            @mouseenter="(e) => { (e.currentTarget as HTMLElement).style.background = '#f8faff'; (e.currentTarget as HTMLElement).style.borderColor = '#d2e3fc' }"
            @mouseleave="(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--gf-bg)' }"
            style="
              display: flex;
              align-items: center;
              gap: 10px;
              width: 100%;
              background: none;
              border: 1px solid var(--gf-bg);
              border-radius: 8px;
              padding: 9px 12px;
              cursor: pointer;
              text-align: left;
              transition: background 0.15s, border-color 0.15s;
            "
          >
            <span :style="{ width: '8px', height: '8px', borderRadius: '50%', background: u.color, flexShrink: '0' }" />
            <span style="font-size:12px; font-weight:700; color:var(--gf-dark); min-width:68px">
              {{ u.role }}
            </span>
            <span style="font-size:12px; color:var(--gf-muted); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
              {{ u.email }}
            </span>
            <span style="font-size:11px; font-weight:600; color:#1A73E8; flex-shrink:0">
              Remplir →
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
