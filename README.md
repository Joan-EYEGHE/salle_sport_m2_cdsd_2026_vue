<div align="center">

# 🏋️ GymFlow — Frontend (Vue.js)

**Interface utilisateur GymFlow** — dashboard, membres, planning/activités, abonnements & statistiques (consommation de l’API GymFlow).

![Vue.js](https://img.shields.io/badge/Vue.js-3.x-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Axios](https://img.shields.io/badge/HTTP-Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-00D4FF?style=for-the-badge)

</div>

---

## ✨ Accroche

La version Vue.js de GymFlow vise une expérience **fluide et moderne** pour gérer les membres, activités/cours, abonnements et statistiques via l’API Node.

> 📸 **Screenshot / GIF** : (placeholder) ajoute une capture du dashboard / une démo (login → members → transactions).

---

## 📚 Table des matières

- [🚀 Features](#-features)
- [🧱 Stack technique](#-stack-technique)
- [📁 Architecture du projet](#-architecture-du-projet)
- [⚙️ Installation & Lancement](#️-installation--lancement)
- [🌐 Variables d'environnement](#-variables-denvironnement)
- [🔗 Dépôts liés](#-dépôts-liés)
- [👤 Auteur](#-auteur)
- [📜 License](#-license)

---

## 🚀 Features

- 🔐 Authentification (JWT) + gestion de session
- 👤 Gestion des membres (liste, détail, update)
- 📅 Activités / cours (liste, détail, CRUD admin)
- 💳 Abonnements & transactions (listing, exports)
- 📊 Dashboard & indicateurs

> Selon l’état actuel du dépôt, certaines features peuvent être en cours d’implémentation.

---

## 🧱 Stack technique

| Catégorie | Tech |
|---|---|
| Framework | Vue 3 |
| Build | Vite |
| Langage | TypeScript |
| HTTP | Axios |
| Routing/State | Vue Router / Pinia *(selon implémentation)* |

---

## 📁 Architecture du projet

```txt
salle_sport_m2_cdsd_2026_vue/
├─ src/
│  ├─ assets/
│  ├─ components/
│  ├─ pages/ (ou views/)
│  ├─ router/   (si utilisé)
│  ├─ store/    (pinia/vuex si utilisé)
│  └─ services/ (api client axios)
└─ package.json
```

---

## ⚙️ Installation & Lancement

### Prérequis

- Node.js 18+ recommandé

### Installation

```bash
npm install
```

### Lancer en dev

```bash
npm run dev
```

---

## 🌐 Variables d'environnement

Recommandé : utiliser un `.env` (non commité) avec une variable Vite :

| Variable | Exemple | Description |
|---|---:|---|
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | URL de base de l’API GymFlow |

---

## 🔗 Dépôts liés

- Backend Node.js : `https://github.com/Joan-EYEGHE/salle_sport_m2_cdsd_2026_node`
- Frontend React.js : `https://github.com/Joan-EYEGHE/salle_sport_m2_cdsd_2026_react`
- Frontend Vue.js : `https://github.com/Joan-EYEGHE/salle_sport_m2_cdsd_2026_vue`

---

## 👤 Auteur

**Joan EYEGHE** — Master 2 CDSD 2026

---

## 📜 License

MIT
