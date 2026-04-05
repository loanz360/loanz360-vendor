/**
 * Super Admin Service
 * Manages super admin authentication using database password hashing
 * Uses custom JWT tokens separate from regular user Supabase Auth
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import bcrypt from 'bcrypt'
import { logAuthEvent } from './secure-logger'
import { logger } from '@/lib/utils/logger'

export interface SuperAdmin {
  id: string
  email: string
  full_name: string
  is_active: boolean
  is_locked: boolean
  two_factor_enabled: boolean
  password_must_change: boolean
  last_login: string | null
}

export interface SuperAdminSession {
  session_id: string
  ip_address: string
  user_agent: string
  created_at: string
  last_activity: string
  expires_at: string
}

/**
 * Verify super admin credentials using database password hash
 * Uses bcrypt to verify password against stored hash
 */
export async function verifySuperAdmin(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  success: boolean
  admin?: SuperAdmin
  error?: string
  requiresTwoFactor?: boolean
}> {
  try {
    // Step 1: Check if email exists in super_admins table
    const supabaseAdmin = createSupabaseAdmin()
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('super_admins')
      .select('id, email, full_name, password_hash, is_active, is_locked, two_factor_enabled, password_must_change, last_login, failed_login_attempts')
      .eq('email', email)
      .maybeSingle()

    if (adminError || !adminData) {
      logger.debug('Super admin not found in database', { email })
      await recordFailedLogin(email, null, ipAddress, userAgent, 'Invalid credentials')
      return { success: false, error: 'Invalid credentials' }
    }

    const admin = adminData as SuperAdmin & { password_hash: string }

    // Step 2: Account status checks
    if (admin.is_locked) {
      await recordFailedLogin(email, admin.id, ipAddress, userAgent, 'Account locked')
      return { success: false, error: 'Account is locked. Please contact support.' }
    }

    if (!admin.is_active) {
      await recordFailedLogin(email, admin.id, ipAddress, userAgent, 'Account inactive')
      return { success: false, error: 'Account is inactive. Please contact support.' }
    }

    // Step 3: Verify password using bcrypt
    const passwordMatch = await bcrypt.compare(password, admin.password_hash)

    if (!passwordMatch) {
      await recordFailedLogin(email, admin.id, ipAddress, userAgent, 'Invalid password')
      return { success: false, error: 'Invalid credentials' }
    }

    // Step 4: Check if 2FA is required
    if (admin.two_factor_enabled) {
      return {
        success: false,
        requiresTwoFactor: true,
        admin: {
          id: admin.id,
          email: admin.email,
          full_name: admin.full_name,
          is_active: admin.is_active,
          is_locked: admin.is_locked,
          two_factor_enabled: admin.two_factor_enabled,
          password_must_change: admin.password_must_change,
          last_login: admin.last_login
        }
      }
    }

    // Step 5: Success - return admin data
    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        is_active: admin.is_active,
        is_locked: admin.is_locked,
        two_factor_enabled: admin.two_factor_enabled,
        password_must_change: admin.password_must_change,
        last_login: admin.last_login
      }
    }
  } catch (error) {
    logger.error('Super admin verification error', error as Error, { email })
    return { success: false, error: 'Authentication failed' }
  }
}

/**
 * Record successful super admin login
 */
export async function recordSuperAdminLogin(
  adminId: string,
  sessionId: string,
  tokenHash: string,
  ipAddress: string,
  userAgent: string,
  expiresAt: Date
): Promise<{ success: boolean }> {
  try {
    // Step 1: Update super_admins table - reset failed attempts and update last login
    const supabaseAdmin = createSupabaseAdmin()
    const { error: updateError } = await supabaseAdmin
      .from('super_admins')
      .update({
        last_login: new Date().toISOString(),
        failed_login_attempts: 0,
        last_failed_login: null,
        updated_at: new Date().toISOString()
      } as never)
      .eq('id', adminId)

    if (updateError) {
      logger.error('Error updating super admin last login', updateError as Error, { adminId })
      return { success: false }
    }

    // Step 2: Insert session record
    const { error: sessionError } = await supabaseAdmin
      .from('super_admin_sessions')
      .insert({
        super_admin_id: adminId,
        session_id: sessionId,
        token_hash: tokenHash,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      } as never)

    if (sessionError) {
      logger.error('Error creating session', sessionError as Error, { adminId })
      return { success: false }
    }

    // Step 3: Insert audit log entry
    const { error: auditError } = await supabaseAdmin
      .from('super_admin_audit_log')
      .insert({
        super_admin_id: adminId,
        action: 'LOGIN_SUCCESS',
        details: { session_id: sessionId },
        ip_address: ipAddress,
        user_agent: userAgent,
        success: true,
        created_at: new Date().toISOString()
      } as never)

    if (auditError) {
      logger.error('Error creating audit log entry', auditError as Error, { adminId })
      // Don't fail the login if audit log fails, just log the error
    }

    await logAuthEvent.info('SUPER_ADMIN_LOGIN', {
      adminId,
      sessionId
    }, {
      userId: adminId,
      ip: ipAddress,
      userAgent
    })

    return { success: true }
  } catch (error) {
    logger.error('Failed to record super admin login', error as Error, { adminId })
    return { success: false }
  }
}

/**
 * Record failed super admin login
 */
export async function recordFailedLogin(
  email: string,
  adminId: string | null,
  ipAddress?: string,
  userAgent?: string,
  reason?: string
): Promise<void> {
  try {
    const supabaseAdmin = createSupabaseAdmin()
    await supabaseAdmin.rpc('record_super_admin_failed_login', {
      p_email: email,
      p_super_admin_id: adminId,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_reason: reason || 'Invalid credentials'
    } as never)

    await logAuthEvent.warn('SUPER_ADMIN_LOGIN_FAILED', {
      email,
      reason
    }, {
      userId: adminId || undefined,
      ip: ipAddress,
      userAgent
    })
  } catch (error) {
    logger.error('Failed to record super admin failed login', error as Error, { email })
  }
}

/**
 * Create new super admin
 */
export async function createSuperAdmin(
  email: string,
  password: string,
  fullName: string,
  createdBy?: string
): Promise<{ success: boolean; adminId?: string; error?: string }> {
  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create super admin
    const supabaseAdmin = createSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .rpc('create_super_admin', {
        p_email: email,
        p_password_hash: passwordHash,
        p_full_name: fullName,
        p_created_by: createdBy
      } as never)

    if (error) {
      logger.error('Error creating super admin', error as Error, { email })
      return { success: false, error: 'Failed to create super admin' }
    }

    await logAuthEvent.info('SUPER_ADMIN_CREATED', {
      newAdminEmail: email,
      fullName
    }, {
      userId: createdBy
    })

    return { success: true, adminId: data }
  } catch (error) {
    logger.error('Failed to create super admin', error as Error, { email })
    return { success: false, error: 'System error' }
  }
}

/**
 * Get active super admin sessions
 */
export async function getActiveSuperAdminSessions(
  adminId: string
): Promise<SuperAdminSession[]> {
  try {
    const supabaseAdmin = createSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .rpc('get_active_super_admin_sessions', {
        p_super_admin_id: adminId
      } as never)

    if (error) {
      logger.error('Error getting active sessions', error as Error, { adminId })
      return []
    }

    return data || []
  } catch (error) {
    logger.error('Failed to get active sessions', error as Error, { adminId })
    return []
  }
}

/**
 * Revoke super admin session
 */
export async function revokeSuperAdminSession(
  sessionId: string,
  reason?: string
): Promise<{ success: boolean }> {
  try {
    const supabaseAdmin = createSupabaseAdmin()
    const { error } = await supabaseAdmin
      .rpc('revoke_super_admin_session', {
        p_session_id: sessionId,
        p_reason: reason || 'Manual logout'
      } as never)

    if (error) {
      logger.error('Error revoking session', error as Error, { sessionId })
      return { success: false }
    }

    await logAuthEvent.info('SUPER_ADMIN_SESSION_REVOKED', {
      sessionId,
      reason
    })

    return { success: true }
  } catch (error) {
    logger.error('Failed to revoke session', error as Error, { sessionId })
    return { success: false }
  }
}

/**
 * Unlock super admin account
 */
export async function unlockSuperAdmin(
  adminId: string,
  unlockedBy: string
): Promise<{ success: boolean }> {
  try {
    const supabaseAdmin = createSupabaseAdmin()
    const { error } = await supabaseAdmin
      .rpc('unlock_super_admin', {
        p_super_admin_id: adminId,
        p_unlocked_by: unlockedBy
      } as never)

    if (error) {
      logger.error('Error unlocking super admin', error as Error, { adminId })
      return { success: false }
    }

    await logAuthEvent.info('SUPER_ADMIN_UNLOCKED', {
      unlockedAdminId: adminId
    }, {
      userId: unlockedBy
    })

    return { success: true }
  } catch (error) {
    logger.error('Failed to unlock super admin', error as Error, { adminId })
    return { success: false }
  }
}

/**
 * Update super admin password
 */
export async function updateSuperAdminPassword(
  adminId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12)

    const supabaseAdmin = createSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('super_admins')
      .update({
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString(),
        password_must_change: false,
        updated_at: new Date().toISOString()
      } as never)
      .eq('id', adminId)

    if (error) {
      logger.error('Error updating password', error as Error, { adminId })
      return { success: false, error: 'Failed to update password' }
    }

    await logAuthEvent.info('SUPER_ADMIN_PASSWORD_CHANGED', {
      adminId
    }, {
      userId: adminId
    })

    return { success: true }
  } catch (error) {
    logger.error('Failed to update password', error as Error, { adminId })
    return { success: false, error: 'System error' }
  }
}

/**
 * Get super admin by email
 */
export async function getSuperAdminByEmail(
  email: string
): Promise<SuperAdmin | null> {
  try {
    const supabaseAdmin = createSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('super_admins')
      .select('id, email, full_name, is_active, is_locked, two_factor_enabled, password_must_change, last_login')
      .eq('email', email)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    return data as SuperAdmin
  } catch (error) {
    logger.error('Failed to get super admin', error as Error, { email })
    return null
  }
}

/**
 * List all super admins
 */
export async function listSuperAdmins(): Promise<SuperAdmin[]> {
  try {
    const supabaseAdmin = createSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('super_admins')
      .select('id, email, full_name, is_active, is_locked, two_factor_enabled, password_must_change, last_login')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error listing super admins', error as Error)
      return []
    }

    return data as SuperAdmin[]
  } catch (error) {
    logger.error('Failed to list super admins', error as Error)
    return []
  }
}