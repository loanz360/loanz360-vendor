/**
 * Employee Management Authentication & Authorization
 * Handles RBAC for Super Admin, HR, and Admin roles
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { createSupabaseAdmin } from '@/lib/supabase/server'

export interface AuthResult {
  authorized: boolean
  userId?: string
  role?: string
  error?: string
  status?: number
}

export interface PermissionMatrix {
  [key: string]: {
    SUPER_ADMIN: boolean
    HR: boolean
    ADMIN: boolean
  }
}

// Permission matrix for Employee Management actions
export const EMPLOYEE_MGMT_PERMISSIONS: PermissionMatrix = {
  VIEW_EMPLOYEES: {
    SUPER_ADMIN: true,
    HR: true,
    ADMIN: true
  },
  ADD_EMPLOYEE: {
    SUPER_ADMIN: true,
    HR: true, // Can add all except Admin/HR roles
    ADMIN: false
  },
  EDIT_EMPLOYEE: {
    SUPER_ADMIN: true,
    HR: true, // Can edit all except Super Admin/Admin
    ADMIN: false
  },
  DELETE_EMPLOYEE: {
    SUPER_ADMIN: true,
    HR: false,
    ADMIN: false
  },
  ENABLE_DISABLE_EMPLOYEE: {
    SUPER_ADMIN: true,
    HR: true,
    ADMIN: false
  },
  ASSIGN_TARGETS: {
    SUPER_ADMIN: true,
    HR: true, // Within allowed sub-roles
    ADMIN: false
  },
  MODIFY_TARGETS: {
    SUPER_ADMIN: true,
    HR: true,
    ADMIN: false
  },
  VIEW_PERFORMANCE: {
    SUPER_ADMIN: true,
    HR: true,
    ADMIN: true
  },
  EDIT_PERFORMANCE: {
    SUPER_ADMIN: true,
    HR: true,
    ADMIN: false
  },
  RESET_LOGIN_ACCESS: {
    SUPER_ADMIN: true,
    HR: false,
    ADMIN: false
  },
  VIEW_ANALYTICS: {
    SUPER_ADMIN: true,
    HR: true,
    ADMIN: true
  },
  EXPORT_DATA: {
    SUPER_ADMIN: true,
    HR: true,
    ADMIN: true
  },
  MANAGE_ORG_HIERARCHY: {
    SUPER_ADMIN: true,
    HR: true, // Limited to their departments
    ADMIN: false
  },
  SEND_NOTES: {
    SUPER_ADMIN: true,
    HR: true,
    ADMIN: false
  }
}

/**
 * Verify authentication for employee management endpoints
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const cookieStore = await cookies()
    const supabase = createSupabaseAdmin()

    // PRIORITY 1: Check for super_admin_session cookie (from simple-login)
    const superAdminSession = cookieStore.get('super_admin_session')?.value

    if (superAdminSession) {
      // Verify super admin session in database
      const { data: session, error: sessionError } = await supabase
        .from('super_admin_sessions')
        .select('super_admin_id, expires_at, is_active')
        .eq('session_id', superAdminSession)
        .maybeSingle()

      if (!sessionError && session && session.is_active) {
        // Check if session expired
        const expiresAt = new Date(session.expires_at)
        if (expiresAt > new Date()) {
          // Get super admin details
          const { data: admin, error: adminError } = await supabase
            .from('super_admins')
            .select('id, email, is_active, is_locked')
            .eq('id', session.super_admin_id)
            .maybeSingle()

          if (!adminError && admin && admin.is_active && !admin.is_locked) {
            // Update last activity
            await supabase
              .from('super_admin_sessions')
              .update({ last_activity: new Date().toISOString() })
              .eq('session_id', superAdminSession)
              .select()

            return {
              authorized: true,
              userId: admin.id,
              role: 'SUPER_ADMIN'
            }
          }
        }
      }
    }

    // PRIORITY 2: Check for auth-token cookie (from full auth system)
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return {
        authorized: false,
        error: 'Authentication required',
        status: 401
      }
    }

    // Verify token
    const sessionData = verifySessionToken(authToken)
    if (!sessionData) {
      return {
        authorized: false,
        error: 'Invalid or expired token',
        status: 401
      }
    }

    // Check if token is blacklisted or session revoked
    const [tokenBlacklisted, sessionRevoked] = await Promise.all([
      isTokenBlacklisted(authToken),
      isSessionRevoked(sessionData.sessionId)
    ])

    if (tokenBlacklisted || sessionRevoked) {
      return {
        authorized: false,
        error: 'Session has been invalidated',
        status: 401
      }
    }

    // Check role - must be SUPER_ADMIN, ADMIN, or HR
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'HR']
    if (!allowedRoles.includes(sessionData.role)) {
      return {
        authorized: false,
        error: 'Access denied. Super Admin, HR, or Admin role required',
        status: 403
      }
    }

    // Get user details from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, email')
      .eq('id', sessionData.userId)
      .maybeSingle()

    if (error || !user) {
      return {
        authorized: false,
        error: 'User not found',
        status: 404
      }
    }

    // Note: is_active column doesn't exist in users table
    // Active status is managed through session tokens and blacklisting

    return {
      authorized: true,
      userId: user.id,
      role: user.role
    }
  } catch (error) {
    console.error('Error in verifyAuth:', error)
    return {
      authorized: false,
      error: 'Authentication error',
      status: 500
    }
  }
}

/**
 * Check if user has permission for specific action
 */
export async function checkPermission(
  userId: string,
  userRole: string,
  action: keyof typeof EMPLOYEE_MGMT_PERMISSIONS
): Promise<boolean> {
  try {
    const permission = EMPLOYEE_MGMT_PERMISSIONS[action]
    if (!permission) {
      return false
    }

    // Check role-based permission
    const hasPermission = permission[userRole as keyof typeof permission]
    if (!hasPermission) {
      return false
    }

    // Additional checks for HR role
    if (userRole === 'HR') {
      // HR can only manage employees in their department(s)
      // This check should be done at the query level in the API
      return true
    }

    return true
  } catch (error) {
    console.error('Error in checkPermission:', error)
    return false
  }
}

/**
 * Check if HR can manage a specific employee
 * HR cannot manage Super Admin, Admin, or other HR roles
 */
export async function hrCanManageEmployee(
  hrUserId: string,
  targetEmployeeId: string
): Promise<{ canManage: boolean; reason?: string }> {
  try {
    const supabase = createSupabaseAdmin()

    // Get target employee details
    const { data: targetEmployee, error } = await supabase
      .from('employees')
      .select('sub_role, department_id, employee_status')
      .eq('id', targetEmployeeId)
      .maybeSingle()

    if (error || !targetEmployee) {
      return { canManage: false, reason: 'Employee not found' }
    }

    // HR cannot manage Admin or HR roles
    const restrictedRoles = [
      'ADMIN_EXECUTIVE',
      'ADMIN_MANAGER',
      'HR_EXECUTIVE',
      'HR_MANAGER'
    ]

    if (restrictedRoles.includes(targetEmployee.sub_role)) {
      return {
        canManage: false,
        reason: 'HR cannot manage Admin or HR roles'
      }
    }

    // Get HR user's department
    const { data: hrEmployee } = await supabase
      .from('employees')
      .select('department_id')
      .eq('user_id', hrUserId)
      .maybeSingle()

    // HR can only manage employees in their department
    if (hrEmployee?.department_id !== targetEmployee.department_id) {
      return {
        canManage: false,
        reason: 'HR can only manage employees in their department'
      }
    }

    return { canManage: true }
  } catch (error) {
    console.error('Error in hrCanManageEmployee:', error)
    return { canManage: false, reason: 'Error checking permissions' }
  }
}

/**
 * Check if HR can add employee with specific sub_role
 */
export function hrCanAddRole(subRole: string): boolean {
  const restrictedRoles = [
    'ADMIN_EXECUTIVE',
    'ADMIN_MANAGER',
    'HR_EXECUTIVE',
    'HR_MANAGER'
  ]
  return !restrictedRoles.includes(subRole)
}

/**
 * Get user's accessible departments
 * Super Admin: All departments
 * HR: Their department only
 * Admin: Read-only access to all
 */
export async function getAccessibleDepartments(
  userId: string,
  userRole: string
): Promise<string[]> {
  try {
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      // Super Admin and Admin can access all departments
      const supabase = createSupabaseAdmin()
      const { data: departments } = await supabase
        .from('departments')
        .select('id')
        .eq('is_active', true)

      return departments?.map(d => d.id) || []
    }

    if (userRole === 'HR') {
      // HR can only access their department
      const supabase = createSupabaseAdmin()
      const { data: hrEmployee } = await supabase
        .from('employees')
        .select('department_id')
        .eq('user_id', userId)
        .maybeSingle()

      return hrEmployee?.department_id ? [hrEmployee.department_id] : []
    }

    return []
  } catch (error) {
    console.error('Error in getAccessibleDepartments:', error)
    return []
  }
}
