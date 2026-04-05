// Database types for Database Management System
export type UserRole = 'SUPER_ADMIN' | 'CRO' | 'EMPLOYEE'
export type ShareStatus = 'ACTIVE' | 'REVOKED'
export type LeadStatus = 'NEW' | 'IN_PROGRESS' | 'CONVERTED' | 'LOST'
export type FileStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface DatabaseFile {
  id: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  uploaded_by: string
  status: FileStatus
  category?: string
  uploaded_at: string
}

export interface Category {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
}

export interface Contact {
  id: string
  full_name?: string
  email?: string
  phone?: string
  company?: string
  location?: string
  category_id?: string
  source_file_id?: string
  created_by?: string
  created_at: string
  updated_at: string
  dedupe_key?: string
}

export interface DataShare {
  id: string
  contact_id: string
  shared_to_user_id: string
  shared_by_admin_id: string
  shared_at: string
  status: ShareStatus
}

export interface Lead {
  id: string
  contact_id?: string
  created_by_user_id: string
  lead_status: LeadStatus
  customer_name: string
  customer_phone?: string
  customer_email?: string
  customer_requirements?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: number
  user_id?: string
  action: string
  entity_type: string
  entity_id?: string
  details?: Record<string, any>
  created_at: string
}

export interface ContactWithDetails extends Contact {
  category?: Category
  source_file?: DatabaseFile
  shared_to?: DataShare[]
}
