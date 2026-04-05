/**
 * Password History Validation
 * Prevents users from reusing their last 5 passwords
 * SECURITY: Critical for financial applications (PCI-DSS, SOC 2 compliance)
 */

import bcrypt from 'bcrypt'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

const MAX_PASSWORD_HISTORY = 5

export interface PasswordHistoryCheck {
  allowed: boolean
  message?: string
}

/**
 * Check if password was used recently (last 5 passwords)
 * @param userId - User ID from auth.users
 * @param newPassword - Plain text password to check
 * @returns Promise<PasswordHistoryCheck>
 */
export async function checkPasswordHistory(
  userId: string,
  newPassword: string
): Promise<PasswordHistoryCheck> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    // Get last 5 passwords for this user
    const { data: history, error } = await supabaseAdmin
      .from('password_history')
      .select('password_hash')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_PASSWORD_HISTORY)

    if (error) {
      // Fail open - allow password change if we can't check history
      // Log the error for monitoring
      logger.error('Password history check failed', error as Error, { userId })
      return { allowed: true }
    }

    if (!history || history.length === 0) {
      // No password history yet - allow
      return { allowed: true }
    }

    // Check if new password matches any previous password
    for (const record of history) {
      const matches = await bcrypt.compare(newPassword, (record as { password_hash: string }).password_hash)
      if (matches) {
        return {
          allowed: false,
          message: `Password was used recently. Please choose a different password. You cannot reuse your last ${MAX_PASSWORD_HISTORY} passwords.`
        }
      }
    }

    return { allowed: true }
  } catch (error) {
    // Fail open on unexpected error - don't block legitimate password changes
    logger.error('Password history check error', error as Error, { userId })
    return { allowed: true }
  }
}

/**
 * Save password to history
 * @param userId - User ID from auth.users
 * @param passwordHash - bcrypt hash of the password
 */
export async function savePasswordHistory(
  userId: string,
  passwordHash: string
): Promise<void> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    await supabaseAdmin
      .from('password_history')
      .insert({
        user_id: userId,
        password_hash: passwordHash
      } as never)
    // Trigger will automatically maintain only last 5 passwords
  } catch (error) {
    // Log but don't fail - password history is nice-to-have
    logger.error('Failed to save password history', error as Error, { userId })
  }
}

/**
 * Check if super admin password was used recently
 * @param adminId - Super admin ID
 * @param newPassword - Plain text password to check
 */
export async function checkSuperAdminPasswordHistory(
  adminId: string,
  newPassword: string
): Promise<PasswordHistoryCheck> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    const { data: history, error } = await supabaseAdmin
      .from('super_admin_password_history')
      .select('password_hash')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })
      .limit(MAX_PASSWORD_HISTORY)

    if (error) {
      logger.error('Super admin password history check failed', error as Error, { adminId })
      return { allowed: true }
    }

    if (!history || history.length === 0) {
      return { allowed: true }
    }

    for (const record of history) {
      const matches = await bcrypt.compare(newPassword, (record as { password_hash: string }).password_hash)
      if (matches) {
        return {
          allowed: false,
          message: `Password was used recently. Please choose a different password. You cannot reuse your last ${MAX_PASSWORD_HISTORY} passwords.`
        }
      }
    }

    return { allowed: true }
  } catch (error) {
    logger.error('Super admin password history check error', error as Error, { adminId })
    return { allowed: true }
  }
}

/**
 * Save super admin password to history
 * @param adminId - Super admin ID
 * @param passwordHash - bcrypt hash of the password
 */
export async function saveSuperAdminPasswordHistory(
  adminId: string,
  passwordHash: string
): Promise<void> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    await supabaseAdmin
      .from('super_admin_password_history')
      .insert({
        admin_id: adminId,
        password_hash: passwordHash
      } as never)
  } catch (error) {
    logger.error('Failed to save super admin password history', error as Error, { adminId })
  }
}

/**
 * Clear password history for a user (use with caution!)
 * @param userId - User ID
 */
export async function clearPasswordHistory(userId: string): Promise<void> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    await supabaseAdmin
      .from('password_history')
      .delete()
      .eq('user_id', userId)
  } catch (error) {
    logger.error('Failed to clear password history', error as Error, { userId })
  }
}

/**
 * Get password history count for a user
 * @param userId - User ID
 */
export async function getPasswordHistoryCount(userId: string): Promise<number> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    const { count, error } = await supabaseAdmin
      .from('password_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) {
      logger.error('Failed to get password history count', error as Error, { userId })
      return 0
    }

    return count || 0
  } catch (error) {
    logger.error('Error getting password history count', error as Error, { userId })
    return 0
  }
}
