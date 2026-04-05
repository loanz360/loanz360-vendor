/**
 * Database Types for LOANZ 360
 * Proper TypeScript types to replace 'as any' usage
 *
 * SECURITY FIX HIGH-06: Type safety
 */

export type UserRole = 'CUSTOMER' | 'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN'

export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'banned' | 'deleted' | 'pending'

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FUNDED'
  | 'CLOSED'

/**
 * User Profile from profiles table
 */
export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  status?: AccountStatus
  account_status?: AccountStatus
  avatar_url?: string
  phone_number?: string
  created_at?: string
  updated_at?: string
  last_login?: string
}

/**
 * Customer Profile from customer_profiles table
 */
export interface CustomerProfile {
  id: string
  user_id: string
  customer_code: string
  first_name: string
  last_name: string
  date_of_birth?: string
  phone_number?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  employment_status?: string
  annual_income?: number
  credit_score?: number
  credit_limit?: number
  risk_category?: string
  kyc_status?: string
  kyc_verified_at?: string
  created_at?: string
  updated_at?: string
}

/**
 * Super Admin from super_admins table
 */
export interface SuperAdmin {
  id: string
  email: string
  full_name: string
  role: 'SUPER_ADMIN'
  status: AccountStatus
  two_factor_enabled: boolean
  two_factor_secret?: string
  backup_codes?: string[]
  created_at: string
  updated_at: string
  last_login?: string
}

/**
 * Session data stored in super_admin_sessions
 */
export interface SuperAdminSession {
  id: string
  admin_id: string
  session_token: string
  ip_address: string
  user_agent: string
  expires_at: string
  created_at: string
  last_activity?: string
}

/**
 * Loan Application from loan_applications table
 */
export interface LoanApplication {
  id: string
  customer_id: string
  application_number: string
  loan_type: string
  requested_amount: number
  approved_amount?: number
  interest_rate?: number
  term_months: number
  purpose: string
  status: ApplicationStatus
  submitted_at?: string
  reviewed_at?: string
  approved_at?: string
  rejected_at?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

/**
 * Audit Log from audit_logs table
 */
export interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id?: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  ip_address: string
  user_agent: string
  timestamp: string
}

/**
 * Supabase Auth User type
 */
export interface SupabaseUser {
  id: string
  email: string
  email_confirmed_at?: string
  phone?: string
  created_at: string
  updated_at: string
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
}

/**
 * Supabase Session type
 */
export interface SupabaseSession {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at?: number
  token_type: string
  user: SupabaseUser
}

/**
 * Supabase Auth Response type
 */
export interface SupabaseAuthResponse {
  data: {
    user: SupabaseUser | null
    session: SupabaseSession | null
  }
  error: {
    message: string
    status?: number
  } | null
}

/**
 * Supabase Query Response type
 */
export interface SupabaseQueryResponse<T> {
  data: T | null
  error: {
    message: string
    details?: string
    hint?: string
    code?: string
  } | null
  count?: number | null
  status: number
  statusText: string
}

/**
 * Type-safe Supabase client operations
 */
export interface SupabaseClient {
  from<T = Record<string, unknown>>(table: string): {
    select(columns?: string): Promise<SupabaseQueryResponse<T[]>>
    insert(data: Partial<T> | Partial<T>[]): Promise<SupabaseQueryResponse<T>>
    update(data: Partial<T>): {
      eq(column: string, value: unknown): Promise<SupabaseQueryResponse<T>>
      match(query: Partial<T>): Promise<SupabaseQueryResponse<T>>
    }
    delete(): {
      eq(column: string, value: unknown): Promise<SupabaseQueryResponse<null>>
      match(query: Partial<T>): Promise<SupabaseQueryResponse<null>>
    }
  }
  auth: {
    signInWithPassword(credentials: {
      email: string
      password: string
    }): Promise<SupabaseAuthResponse>
    signUp(credentials: {
      email: string
      password: string
      options?: {
        data?: Record<string, unknown>
      }
    }): Promise<SupabaseAuthResponse>
    signOut(): Promise<{ error: Error | null }>
    getSession(): Promise<{
      data: {
        session: SupabaseSession | null
      }
      error: Error | null
    }>
    getUser(): Promise<{
      data: {
        user: SupabaseUser | null
      }
      error: Error | null
    }>
  }
}

/**
 * Rate Limit Entry from rate_limits table
 */
export interface RateLimitEntry {
  id: string
  identifier: string
  endpoint: string
  request_count: number
  window_start: string
  is_locked_out: boolean
  lockout_until?: string
  created_at: string
  updated_at: string
}

/**
 * Client Error Report from client_errors table
 */
export interface ClientError {
  id: string
  error_id: string
  error_type: string
  message: string
  stack?: string
  url?: string
  user_agent?: string
  ip_address?: string
  user_id?: string
  session_id?: string
  additional_data?: Record<string, unknown>
  occurred_at: string
  created_at: string
}

/**
 * Type guard to check if profile has required fields
 */
export function isValidUserProfile(profile: unknown): profile is UserProfile {
  if (!profile || typeof profile !== 'object') return false
  const p = profile as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.email === 'string' &&
    typeof p.full_name === 'string' &&
    typeof p.role === 'string'
  )
}

/**
 * Type guard to check if super admin has required fields
 */
export function isValidSuperAdmin(admin: unknown): admin is SuperAdmin {
  if (!admin || typeof admin !== 'object') return false
  const a = admin as Record<string, unknown>
  return (
    typeof a.id === 'string' &&
    typeof a.email === 'string' &&
    typeof a.role === 'string' &&
    a.role === 'SUPER_ADMIN'
  )
}
