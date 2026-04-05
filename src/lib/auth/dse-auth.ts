import { SupabaseClient } from '@supabase/supabase-js'

/**
 * DSE Auth Verification Utility
 *
 * Centralized role verification for Direct Sales Executive and Direct Sales Manager roles.
 * Checks employee_profile, users, and employees tables consistently.
 * Accepts both 'DSE' and 'DIRECT_SALES_EXECUTIVE' formats.
 */

export type DSERoleType = 'DSE' | 'DSM'

interface DSEAuthResult {
  valid: boolean
  error?: string
  userId: string
  employeeId?: string
  role?: DSERoleType
  rawSubRole?: string
  department?: string
  status?: string
}

// All accepted DSE role variants (case-insensitive, normalized)
const DSE_ROLE_VARIANTS = [
  'DIRECT_SALES_EXECUTIVE',
  'DSE',
  'DIRECT SALES EXECUTIVE',
  'DIRECT-SALES-EXECUTIVE',
]

const DSM_ROLE_VARIANTS = [
  'DIRECT_SALES_MANAGER',
  'DSM',
  'DIRECT SALES MANAGER',
  'DIRECT-SALES-MANAGER',
]

/**
 * Normalize a role string for comparison
 */
function normalizeRole(role: string | null | undefined): string {
  if (!role) return ''
  return role.toUpperCase().replace(/[\s-]/g, '_').trim()
}

/**
 * Check if a role string matches DSE
 */
export function isDSERole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role)
  return DSE_ROLE_VARIANTS.some(v => normalizeRole(v) === normalized)
}

/**
 * Check if a role string matches DSM (Direct Sales Manager)
 */
export function isDSMRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role)
  return DSM_ROLE_VARIANTS.some(v => normalizeRole(v) === normalized)
}

/**
 * Check if a role string matches either DSE or DSM
 */
export function isDSEOrDSMRole(role: string | null | undefined): boolean {
  return isDSERole(role) || isDSMRole(role)
}

/**
 * Verify that a user has DSE or DSM role by checking all relevant tables.
 * This is the single source of truth for DSE auth verification.
 */
export async function verifyDSEAuth(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    allowDSM?: boolean      // Also allow Direct Sales Manager (default: false)
    requireActive?: boolean  // Require active status (default: true)
  }
): Promise<DSEAuthResult> {
  const { allowDSM = false, requireActive = true } = options || {}
  const baseResult: DSEAuthResult = { valid: false, userId }

  // Strategy 1: Check employee_profile table
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('subrole, status, user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (profile) {
    const roleMatch = isDSERole(profile.subrole) || (allowDSM && isDSMRole(profile.subrole))
    if (roleMatch) {
      if (requireActive && profile.status?.toUpperCase() !== 'ACTIVE') {
        return { ...baseResult, error: 'Account is inactive. Please contact your administrator.' }
      }
      return {
        valid: true,
        userId,
        role: isDSERole(profile.subrole) ? 'DSE' : 'DSM',
        rawSubRole: profile.subrole,
        status: profile.status,
      }
    }
  }

  // Strategy 2: Check employees table
  const { data: employee } = await supabase
    .from('employees')
    .select('id, sub_role, department, is_active, user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (employee) {
    const roleMatch = isDSERole(employee.sub_role) || (allowDSM && isDSMRole(employee.sub_role))
    if (roleMatch) {
      if (requireActive && !employee.is_active) {
        return { ...baseResult, error: 'Account is inactive. Please contact your administrator.' }
      }
      return {
        valid: true,
        userId,
        employeeId: employee.id,
        role: isDSERole(employee.sub_role) ? 'DSE' : 'DSM',
        rawSubRole: employee.sub_role,
        department: employee.department,
      }
    }
  }

  // Strategy 3: Check users table (fallback)
  const { data: userProfile } = await supabase
    .from('users')
    .select('id, role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (userProfile) {
    const isEmployee = userProfile.role?.toUpperCase() === 'EMPLOYEE'
    const roleMatch = isDSERole(userProfile.sub_role) || (allowDSM && isDSMRole(userProfile.sub_role))
    if (isEmployee && roleMatch) {
      return {
        valid: true,
        userId,
        role: isDSERole(userProfile.sub_role) ? 'DSE' : 'DSM',
        rawSubRole: userProfile.sub_role,
      }
    }
  }

  return {
    ...baseResult,
    error: allowDSM
      ? 'Access denied. This feature is only available for Direct Sales Executives and Managers.'
      : 'Access denied. This feature is only available for Direct Sales Executives.',
  }
}

/**
 * Verify DSE Manager role specifically (for team schedule features)
 */
export async function verifyDSMAuth(
  supabase: SupabaseClient,
  userId: string
): Promise<DSEAuthResult> {
  const baseResult: DSEAuthResult = { valid: false, userId }

  // Check employees table for manager role and department
  const { data: manager } = await supabase
    .from('employees')
    .select('id, sub_role, department, is_active, full_name, email, user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (manager && isDSMRole(manager.sub_role)) {
    if (!manager.is_active) {
      return { ...baseResult, error: 'Account is inactive.' }
    }
    return {
      valid: true,
      userId,
      employeeId: manager.id,
      role: 'DSM',
      rawSubRole: manager.sub_role,
      department: manager.department,
    }
  }

  // Fallback: check employee_profile
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('subrole, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profile && isDSMRole(profile.subrole)) {
    if (profile.status?.toUpperCase() !== 'ACTIVE') {
      return { ...baseResult, error: 'Account is inactive.' }
    }
    return {
      valid: true,
      userId,
      role: 'DSM',
      rawSubRole: profile.subrole,
      status: profile.status,
    }
  }

  return {
    ...baseResult,
    error: 'Unauthorized: Only Direct Sales Managers can access this feature.',
  }
}
