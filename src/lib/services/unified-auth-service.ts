/**
 * Unified Auth Service - Enterprise Grade
 * Version: 1.0
 *
 * This service provides a unified interface for user authentication
 * and role verification across all user types (employees, customers, partners, super admins).
 * Fixes Bug #1: Inconsistent User/Profile Access Pattern
 */

import { createClient } from '@/lib/supabase/server'
import { SupabaseClient, User } from '@supabase/supabase-js'

// ============================================================
// TYPES
// ============================================================

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  EMPLOYEE = 'EMPLOYEE',
  CUSTOMER = 'CUSTOMER',
  PARTNER = 'PARTNER',
  UNKNOWN = 'UNKNOWN'
}

export enum PartnerSubRole {
  BUSINESS_ASSOCIATE = 'ba',
  BUSINESS_PARTNER = 'bp',
  CHANNEL_PARTNER = 'cp'
}

export interface AuthenticatedUser {
  id: string
  email: string
  role: UserRole
  sub_role?: string
  full_name: string
  avatar_url?: string
  department?: string
  is_active: boolean
  metadata: Record<string, unknown>
}

export interface AuthResult {
  success: boolean
  user?: AuthenticatedUser
  error?: string
  errorCode?: string
}

export interface RoleCheckOptions {
  allowedRoles?: UserRole[]
  requiredSubRoles?: string[]
  requireDepartment?: string[]
  requireActive?: boolean
}

// ============================================================
// UNIFIED AUTH SERVICE
// ============================================================

export class UnifiedAuthService {
  private supabase: SupabaseClient

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Get authenticated user with full profile information
   * This method checks all possible user tables in priority order
   */
  async getAuthenticatedUser(): Promise<AuthResult> {
    try {
      // Get the auth user
      const { data: { user }, error: authError } = await this.supabase.auth.getUser()

      if (authError || !user) {
        return {
          success: false,
          error: 'Not authenticated',
          errorCode: 'AUTH_REQUIRED'
        }
      }

      // Try to determine user role and get profile
      const authenticatedUser = await this.resolveUserProfile(user)

      if (!authenticatedUser) {
        return {
          success: false,
          error: 'User profile not found',
          errorCode: 'PROFILE_NOT_FOUND'
        }
      }

      return {
        success: true,
        user: authenticatedUser
      }
    } catch (error) {
      console.error('UnifiedAuthService Error:', error)
      return {
        success: false,
        error: 'Authentication service error',
        errorCode: 'SERVICE_ERROR'
      }
    }
  }

  /**
   * Resolve user profile from various tables
   */
  private async resolveUserProfile(authUser: User): Promise<AuthenticatedUser | null> {
    const userId = authUser.id
    const email = authUser.email || ''

    // 1. Check Super Admin first
    const superAdmin = await this.checkSuperAdmin(userId)
    if (superAdmin) return superAdmin

    // 2. Check profiles table (unified user table)
    const profileUser = await this.checkProfiles(userId)
    if (profileUser) return profileUser

    // 3. Check users table (legacy)
    const legacyUser = await this.checkUsersTable(userId)
    if (legacyUser) return legacyUser

    // 4. Check employees table directly
    const employee = await this.checkEmployees(userId)
    if (employee) return employee

    // 5. Check customers table directly
    const customer = await this.checkCustomers(userId, email)
    if (customer) return customer

    // 6. Check partner_profiles table
    const partner = await this.checkPartners(userId)
    if (partner) return partner

    return null
  }

  /**
   * Check if user is a super admin
   */
  private async checkSuperAdmin(userId: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.supabase
      .from('super_admins')
      .select('id, full_name, email, role, is_active')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null

    return {
      id: data.id,
      email: data.email,
      role: UserRole.SUPER_ADMIN,
      sub_role: data.role,
      full_name: data.full_name,
      is_active: data.is_active !== false,
      metadata: { source: 'super_admins' }
    }
  }

  /**
   * Check profiles table (primary unified table)
   */
  private async checkProfiles(userId: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, full_name, email, role, sub_role, avatar_url, is_active')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null

    // Map role string to enum
    let role = UserRole.UNKNOWN
    switch (data.role?.toUpperCase()) {
      case 'SUPER_ADMIN':
        role = UserRole.SUPER_ADMIN
        break
      case 'EMPLOYEE':
        role = UserRole.EMPLOYEE
        break
      case 'CUSTOMER':
        role = UserRole.CUSTOMER
        break
      case 'PARTNER':
        role = UserRole.PARTNER
        break
    }

    // Get department if employee
    let department: string | undefined
    if (role === UserRole.EMPLOYEE) {
      const { data: deptData } = await this.supabase
        .from('department_employees')
        .select('department')
        .eq('employee_id', userId)
        .eq('is_active', true)
        .maybeSingle()
      department = deptData?.department
    }

    return {
      id: data.id,
      email: data.email,
      role,
      sub_role: data.sub_role,
      full_name: data.full_name || 'User',
      avatar_url: data.avatar_url,
      department,
      is_active: data.is_active !== false,
      metadata: { source: 'profiles' }
    }
  }

  /**
   * Check legacy users table
   */
  private async checkUsersTable(userId: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, full_name, email, role, user_metadata')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null

    let role = UserRole.UNKNOWN
    switch (data.role?.toUpperCase()) {
      case 'SUPER_ADMIN':
        role = UserRole.SUPER_ADMIN
        break
      case 'EMPLOYEE':
        role = UserRole.EMPLOYEE
        break
      case 'CUSTOMER':
        role = UserRole.CUSTOMER
        break
      case 'PARTNER':
        role = UserRole.PARTNER
        break
    }

    return {
      id: data.id,
      email: data.email,
      role,
      full_name: data.full_name || 'User',
      is_active: true,
      metadata: { source: 'users', user_metadata: data.user_metadata }
    }
  }

  /**
   * Check employees table
   */
  private async checkEmployees(userId: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.supabase
      .from('employees')
      .select('id, full_name, email, department, designation, is_active')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) return null

    return {
      id: userId,
      email: data.email,
      role: UserRole.EMPLOYEE,
      sub_role: data.designation,
      full_name: data.full_name,
      department: data.department,
      is_active: data.is_active !== false,
      metadata: { source: 'employees', employee_id: data.id }
    }
  }

  /**
   * Check customers table
   */
  private async checkCustomers(userId: string, email: string): Promise<AuthenticatedUser | null> {
    // Try by user_id first
    let { data, error } = await this.supabase
      .from('customers')
      .select('id, full_name, email, phone, sub_role, is_active')
      .eq('user_id', userId)
      .maybeSingle()

    // If not found by user_id, try by email
    if (error || !data) {
      const result = await this.supabase
        .from('customers')
        .select('id, full_name, email, phone, sub_role, is_active')
        .eq('email', email)
        .maybeSingle()
      data = result.data
      error = result.error
    }

    if (error || !data) return null

    return {
      id: userId,
      email: data.email,
      role: UserRole.CUSTOMER,
      sub_role: data.sub_role,
      full_name: data.full_name,
      is_active: data.is_active !== false,
      metadata: { source: 'customers', customer_id: data.id, phone: data.phone }
    }
  }

  /**
   * Check partner_profiles table
   */
  private async checkPartners(userId: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.supabase
      .from('partner_profiles')
      .select('id, company_name, partner_id')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null

    // Get profile info
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('full_name, email, sub_role, avatar_url')
      .eq('id', userId)
      .maybeSingle()

    return {
      id: userId,
      email: profile?.email || '',
      role: UserRole.PARTNER,
      sub_role: profile?.sub_role,
      full_name: profile?.full_name || data.company_name || 'Partner',
      avatar_url: profile?.avatar_url,
      is_active: true,
      metadata: {
        source: 'partner_profiles',
        partner_id: data.partner_id,
        company_name: data.company_name
      }
    }
  }

  /**
   * Verify user has required permissions
   */
  async verifyPermissions(options: RoleCheckOptions = {}): Promise<AuthResult> {
    const authResult = await this.getAuthenticatedUser()

    if (!authResult.success || !authResult.user) {
      return authResult
    }

    const user = authResult.user

    // Check active status
    if (options.requireActive !== false && !user.is_active) {
      return {
        success: false,
        error: 'User account is inactive',
        errorCode: 'ACCOUNT_INACTIVE'
      }
    }

    // Check allowed roles
    if (options.allowedRoles && options.allowedRoles.length > 0) {
      if (!options.allowedRoles.includes(user.role)) {
        return {
          success: false,
          error: 'Insufficient permissions',
          errorCode: 'FORBIDDEN'
        }
      }
    }

    // Check required sub roles
    if (options.requiredSubRoles && options.requiredSubRoles.length > 0) {
      if (!user.sub_role || !options.requiredSubRoles.includes(user.sub_role)) {
        return {
          success: false,
          error: 'Insufficient role permissions',
          errorCode: 'FORBIDDEN'
        }
      }
    }

    // Check required department
    if (options.requireDepartment && options.requireDepartment.length > 0) {
      if (!user.department || !options.requireDepartment.includes(user.department)) {
        return {
          success: false,
          error: 'Department access denied',
          errorCode: 'FORBIDDEN'
        }
      }
    }

    return authResult
  }

  /**
   * Check if user can access a specific ticket
   */
  async canAccessTicket(
    ticketId: string,
    ticketSource: 'employee' | 'customer' | 'partner',
    ticketOwnerId: string,
    ticketDepartment?: string
  ): Promise<boolean> {
    const authResult = await this.getAuthenticatedUser()
    if (!authResult.success || !authResult.user) return false

    const user = authResult.user

    // Super admin can access all tickets
    if (user.role === UserRole.SUPER_ADMIN) return true

    // Check based on ticket source
    switch (ticketSource) {
      case 'employee':
        // Employee can access their own tickets
        if (user.role === UserRole.EMPLOYEE && user.id === ticketOwnerId) return true
        // HR/assigned employee can access
        if (user.role === UserRole.EMPLOYEE && ticketDepartment) {
          if (user.department === ticketDepartment) return true
        }
        break

      case 'customer':
        // Customer can access their own tickets
        if (user.role === UserRole.CUSTOMER && user.id === ticketOwnerId) return true
        // Customer support employees can access
        if (user.role === UserRole.EMPLOYEE) {
          if (user.department === 'customer_support' || ticketDepartment === user.department) {
            return true
          }
        }
        break

      case 'partner':
        // Partner can access their own tickets
        if (user.role === UserRole.PARTNER && user.id === ticketOwnerId) return true
        // Partner support employees can access
        if (user.role === UserRole.EMPLOYEE) {
          if (user.department === 'partner_support' || ticketDepartment === user.department) {
            return true
          }
        }
        break
    }

    return false
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create an instance of UnifiedAuthService
 */
export async function getAuthService(): Promise<UnifiedAuthService> {
  const supabase = await createClient()
  return new UnifiedAuthService(supabase)
}

/**
 * Quick auth check - returns authenticated user or throws
 */
export async function requireAuth(options?: RoleCheckOptions): Promise<AuthenticatedUser> {
  const authService = await getAuthService()
  const result = await authService.verifyPermissions(options)

  if (!result.success || !result.user) {
    throw new AuthError(result.error || 'Authentication required', result.errorCode || 'AUTH_REQUIRED')
  }

  return result.user
}

/**
 * Check if user is super admin
 */
export async function requireSuperAdmin(): Promise<AuthenticatedUser> {
  return requireAuth({ allowedRoles: [UserRole.SUPER_ADMIN] })
}

/**
 * Check if user is employee
 */
export async function requireEmployee(departments?: string[]): Promise<AuthenticatedUser> {
  return requireAuth({
    allowedRoles: [UserRole.EMPLOYEE, UserRole.SUPER_ADMIN],
    requireDepartment: departments
  })
}

/**
 * Check if user is customer
 */
export async function requireCustomer(): Promise<AuthenticatedUser> {
  return requireAuth({ allowedRoles: [UserRole.CUSTOMER] })
}

/**
 * Check if user is partner
 */
export async function requirePartner(subRoles?: string[]): Promise<AuthenticatedUser> {
  return requireAuth({
    allowedRoles: [UserRole.PARTNER],
    requiredSubRoles: subRoles
  })
}

// ============================================================
// ERROR CLASS
// ============================================================

export class AuthError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}
