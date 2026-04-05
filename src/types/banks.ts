// Bank/NBFC types for dynamic management

export type BankType = 'BANK' | 'NBFC' | 'FINTECH'

export interface Bank {
  id: string
  name: string
  display_name: string
  logo_url: string | null
  type: BankType
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  created_by: string | null
  website_url: string | null
  description: string | null
  contact_email: string | null
  contact_phone: string | null
}

export interface CreateBankRequest {
  name: string
  display_name: string
  type: BankType
  logo_url?: string | null
  website_url?: string | null
  description?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  is_active?: boolean
  sort_order?: number
}

export interface UpdateBankRequest extends Partial<CreateBankRequest> {
  id: string
}

export interface BankStatistics {
  total_banks: number
  active_banks: number
  inactive_banks: number
  banks_count: number
  nbfcs_count: number
  fintech_count: number
}
