export type Role = 'ADMIN' | 'CASHIER' | 'CONTROLLER'

export interface User {
  id: number
  email: string
  role: Role
  fullName: string
  active: boolean
  createdAt?: string
}
export type TypeForfait = 'HEBDO' | 'MENSUEL' | 'TRIMESTRIEL' | 'ANNUEL'
export type TicketStatus = 'DISPONIBLE' | 'VENDU' | 'UTILISE' | 'EXPIRE'
export type TypeTransaction = 'REVENU' | 'DEPENSE'
export type MethodePaiement = 'CASH' | 'WAVE' | 'ORANGE'
export type ResultatScan = 'SUCCES' | 'ECHEC'

export interface AuthUser {
  id: number
  email: string
  role: Role
  fullName: string
  firstConnection: boolean
}

export interface Member {
  id: number
  nom: string
  prenom: string
  slug: string
  email?: string
  phone?: string
  adresse?: string
  date_naissance?: string
  lieu_naissance?: string
  uuid_qr: string
  active: boolean
}

export interface Activity {
  id: number
  nom: string
  slug: string
  status: boolean
  frais_inscription: number
  prix_ticket: number
  prix_hebdomadaire: number
  prix_mensuel: number
  prix_trimestriel: number
  prix_annuel: number
  isMonthlyOnly: boolean
  active: boolean
  tarifs_disponibles?: Tarif[]
}

export interface Tarif {
  type: TypeForfait
  label: string
  prix: number
}

export interface Subscription {
  id: number
  id_membre: number
  id_activity: number
  type_forfait: TypeForfait
  frais_inscription_payes: number
  frais_uniquement: boolean
  montant_total: number
  date_debut: string
  date_prochain_paiement: string
  active: boolean
  member?: Member
  activity?: Activity
}

export interface Ticket {
  id: number
  id_batch: number
  qr_code: string
  code_ticket: string
  status: TicketStatus
  date_expiration: string
  prix_unitaire: number
}

export interface Transaction {
  id: number
  id_membre?: number
  montant: number
  type: TypeTransaction
  methode_paiement?: MethodePaiement
  libelle: string
  createdAt: string
  member?: Member
}

export interface Batch {
  id: number
  id_activity: number
  quantite: number
  prix_unitaire_applique: number
  ticket_counts: Record<TicketStatus, number>
  activity?: Activity
}

export interface AccessLog {
  id: number
  id_ticket?: number
  id_membre?: number
  date_scan: string
  resultat: ResultatScan
  id_controller: number
  member?: Member
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
