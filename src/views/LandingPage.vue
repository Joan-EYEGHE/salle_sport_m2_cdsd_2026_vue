<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Dumbbell, Calendar, Users, DollarSign, ArrowRight } from 'lucide-vue-next'

const router = useRouter()

const modules = [
  {
    icon: Calendar,
    title: 'Activités',
    description: "Gérer les types d'activités et leur prix",
    gradient: 'linear-gradient(195deg, #49a3f1, #1A73E8)',
    iconShadow: '0 4px 15px rgba(0,0,0,0.14), 0 7px 10px rgba(26,115,232,0.3)',
  },
  {
    icon: Users,
    title: 'Membres',
    description: 'Suivre les adhésions et les données clients',
    gradient: 'linear-gradient(195deg, #66BB6A, #43A047)',
    iconShadow: '0 4px 15px rgba(0,0,0,0.14), 0 7px 10px rgba(76,175,80,0.3)',
  },
  {
    icon: DollarSign,
    title: 'Finances',
    description: 'Suivre les revenus et dépenses',
    gradient: 'linear-gradient(195deg, #FFA726, #fb8c00)',
    iconShadow: '0 4px 15px rgba(0,0,0,0.14), 0 7px 10px rgba(251,140,0,0.3)',
  },
]

function goToLogin() {
  router.push('/login')
}
</script>

<template>
  <div style="
    min-height: 100vh;
    background: var(--gf-bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
  ">
    <!-- Carte centrale -->
    <div style="
      background: var(--gf-white);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.08);
      max-width: 480px;
      width: 100%;
      padding: 48px 40px;
      text-align: center;
    ">
      <!-- Logo -->
      <div style="
        width: 64px; height: 64px;
        border-radius: 16px;
        background: linear-gradient(195deg, #EC407A, #D81B60);
        box-shadow: 0 4px 20px rgba(233,30,99,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
      ">
        <Dumbbell :size="32" color="var(--gf-white)" />
      </div>

      <h1 style="font-size:36px; font-weight:700; color:var(--gf-dark); margin:0 0 8px">
        GymFlow
      </h1>
      <p style="font-size:16px; color:var(--gf-muted); margin:0 0 32px">
        La gestion de salle, simplifiée.
      </p>

      <!-- Séparateur -->
      <div style="display:flex; align-items:center; gap:12px; margin:0 0 32px">
        <div style="flex:1; height:1px; background:#dee2e6" />
        <span style="
          font-size:11px;
          color:var(--gf-muted);
          font-weight:600;
          text-transform:uppercase;
          letter-spacing:0.6px;
          white-space:nowrap;
        ">
          Accès réservé au personnel
        </span>
        <div style="flex:1; height:1px; background:#dee2e6" />
      </div>

      <!-- Bouton -->
      <button
        type="button"
        @click="goToLogin"
        @mouseenter="(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.9')"
        @mouseleave="(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')"
        style="
          width: 100%;
          background: linear-gradient(195deg, #49a3f1, #1A73E8);
          border: none;
          border-radius: 8px;
          padding: 14px;
          color: var(--gf-white);
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(26,115,232,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s;
        "
      >
        Accéder à l'application
        <ArrowRight :size="18" />
      </button>
    </div>

    <!-- Grille des modules -->
    <div style="max-width:560px; width:100%; margin-top:24px">
      <div class="gf-kpi-grid-3">
        <div
          v-for="mod in modules"
          :key="mod.title"
          style="
            background: var(--gf-white);
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.05);
            padding: 20px 16px;
            text-align: center;
          "
        >
          <div
            :style="{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              margin: '0 auto 12px',
              background: mod.gradient,
              boxShadow: mod.iconShadow,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }"
          >
            <component :is="mod.icon" :size="22" color="var(--gf-white)" />
          </div>
          <h3 style="font-size:13px; font-weight:700; color:var(--gf-dark); margin:0 0 6px">
            {{ mod.title }}
          </h3>
          <p style="font-size:12px; color:var(--gf-muted); line-height:1.5; margin:0">
            {{ mod.description }}
          </p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <p style="font-size:12px; color:var(--gf-muted); margin-top:32px; text-align:center">
      © 2026 GymFlow. Tous droits réservés.
    </p>
  </div>
</template>
