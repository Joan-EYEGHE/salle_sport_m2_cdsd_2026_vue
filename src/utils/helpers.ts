/**
 * Retourne la date locale au format YYYY-MM-DD (jamais UTC).
 * Critique pour les KPI du dashboard — ne pas remplacer par new Date().toISOString()
 */
export function getLocalYmd(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Retourne les 7 derniers jours au format YYYY-MM-DD (du plus ancien au plus récent) */
export function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return getLocalYmd(d)
  })
}

/** Formate un montant en FCFA */
export function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

/** Formate un montant compact (ex: 1 250 FCFA) */
export function fmtCompact(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(n) + ' FCFA'
}

/** Formate une date YYYY-MM-DD en dd/mm/yyyy */
export function fmtDate(s: string): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}
