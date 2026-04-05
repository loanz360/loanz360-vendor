/**
 * Two-Factor Authentication (2FA) Service
 * Implements TOTP-based 2FA with QR code generation and backup codes
 */

import { authenticator } from 'otplib'
import { toDataURL } from 'qrcode'
import { randomBytes } from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { logAuthEvent } from './secure-logger'
import { logger } from '@/lib/utils/logger'
import bcrypt from 'bcrypt'

// Configure TOTP settings
authenticator.options = {
  window: 1, // Allow 1 step before/after for time drift (30 seconds)
  step: 30, // 30-second time step
  digits: 6, // 6-digit codes
}

export interface TwoFactorSetup {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
  manualEntryKey: string
}

export interface TwoFactorVerification {
  valid: boolean
  error?: string
  usedBackupCode?: boolean
}

/**
 * Generate 2FA secret and setup data for a super admin
 */
export async function generateTwoFactorSetup(
  email: string,
  issuer: string = 'LOANZ 360'
): Promise<TwoFactorSetup> {
  try {
    // Generate secret
    const secret = authenticator.generateSecret()

    // Generate OTP Auth URL for QR code
    const otpauthUrl = authenticator.keyuri(email, issuer, secret)

    // Generate QR code as data URL
    const qrCodeUrl = await toDataURL(otpauthUrl)

    // Generate backup codes (8 codes, 10 characters each)
    const backupCodes = generateBackupCodes(8)

    // Format secret for manual entry (groups of 4)
    const manualEntryKey = secret.match(/.{1,4}/g)?.join(' ') || secret

    return {
      secret,
      qrCodeUrl,
      backupCodes,
      manualEntryKey,
    }
  } catch (error) {
    logger.error('Error generating 2FA setup:', error as Error)
    throw new Error('Failed to generate 2FA setup')
  }
}

/**
 * Generate backup codes for 2FA recovery
 */
function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = []

  for (let i = 0; i < count; i++) {
    // Generate 10-character alphanumeric code
    const code = randomBytes(5)
      .toString('hex')
      .toUpperCase()
      .match(/.{1,5}/g)
      ?.join('-') || ''
    codes.push(code)
  }

  return codes
}

/**
 * Verify TOTP code
 */
export function verifyTOTPCode(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret })
  } catch (error) {
    logger.error('Error verifying TOTP code:', error as Error)
    return false
  }
}

/**
 * Enable 2FA for a super admin
 */
export async function enableTwoFactorAuth(
  adminId: string,
  secret: string,
  backupCodes: string[],
  verificationCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify the code before enabling
    if (!verifyTOTPCode(verificationCode, secret)) {
      await logAuthEvent.warn('TWO_FACTOR_ENABLE_FAILED', {
        adminId,
        reason: 'Invalid verification code',
      })
      return { success: false, error: 'Invalid verification code' }
    }

    // Hash backup codes before storing
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10))
    )

    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    // Update super admin record
    const { error } = await supabaseAdmin
      .from('super_admins')
      .update({
        two_factor_enabled: true,
        two_factor_secret: secret,
        backup_codes: hashedBackupCodes,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', adminId)

    if (error) {
      logger.error('Error enabling 2FA:', error as Error)
      return { success: false, error: 'Failed to enable 2FA' }
    }

    await logAuthEvent.info('TWO_FACTOR_ENABLED', { adminId }, { userId: adminId })

    return { success: true }
  } catch (error) {
    logger.error('Failed to enable 2FA:', error as Error)
    return { success: false, error: 'System error' }
  }
}

/**
 * Disable 2FA for a super admin
 */
export async function disableTwoFactorAuth(
  adminId: string,
  verificationCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    // Get current 2FA secret
    const { data: admin, error: fetchError } = await supabaseAdmin
      .from('super_admins')
      .select('two_factor_secret, two_factor_enabled')
      .eq('id', adminId)
      .maybeSingle()

    if (fetchError || !admin) {
      return { success: false, error: 'Super admin not found' }
    }

    const adminData = admin as { two_factor_secret: string; two_factor_enabled: boolean }

    if (!adminData.two_factor_enabled) {
      return { success: false, error: '2FA is not enabled' }
    }

    // Verify code before disabling
    if (!verifyTOTPCode(verificationCode, adminData.two_factor_secret)) {
      await logAuthEvent.warn('TWO_FACTOR_DISABLE_FAILED', {
        adminId,
        reason: 'Invalid verification code',
      })
      return { success: false, error: 'Invalid verification code' }
    }

    // Disable 2FA
    const { error } = await supabaseAdmin
      .from('super_admins')
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
        backup_codes: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', adminId)

    if (error) {
      logger.error('Error disabling 2FA:', error as Error)
      return { success: false, error: 'Failed to disable 2FA' }
    }

    await logAuthEvent.info('TWO_FACTOR_DISABLED', { adminId }, { userId: adminId })

    return { success: true }
  } catch (error) {
    logger.error('Failed to disable 2FA:', error as Error)
    return { success: false, error: 'System error' }
  }
}

/**
 * Verify 2FA code (TOTP or backup code)
 */
export async function verifyTwoFactorCode(
  adminId: string,
  code: string
): Promise<TwoFactorVerification> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    // Get admin 2FA data
    const { data: admin, error } = await supabaseAdmin
      .from('super_admins')
      .select('two_factor_secret, backup_codes, two_factor_enabled')
      .eq('id', adminId)
      .maybeSingle()

    if (error || !admin) {
      return { valid: false, error: 'Super admin not found' }
    }

    const adminData = admin as { two_factor_secret: string; backup_codes: string[] | null; two_factor_enabled: boolean }

    if (!adminData.two_factor_enabled) {
      return { valid: false, error: '2FA is not enabled' }
    }

    // First, try TOTP verification
    if (verifyTOTPCode(code, adminData.two_factor_secret)) {
      await logAuthEvent.info('TWO_FACTOR_VERIFIED', {
        adminId,
        method: 'TOTP',
      })
      return { valid: true }
    }

    // If TOTP fails, try backup codes
    if (adminData.backup_codes && adminData.backup_codes.length > 0) {
      for (let i = 0; i < adminData.backup_codes.length; i++) {
        const isMatch = await bcrypt.compare(code, adminData.backup_codes[i])

        if (isMatch) {
          // Remove used backup code
          const updatedBackupCodes = adminData.backup_codes!.filter(
            (_, index) => index !== i
          )

          await supabaseAdmin
            .from('super_admins')
            .update({
              backup_codes: updatedBackupCodes,
              updated_at: new Date().toISOString(),
            } as never)
            .eq('id', adminId)

          await logAuthEvent.info('TWO_FACTOR_VERIFIED', {
            adminId,
            method: 'BACKUP_CODE',
            remainingBackupCodes: updatedBackupCodes.length,
          })

          return { valid: true, usedBackupCode: true }
        }
      }
    }

    // Both TOTP and backup codes failed
    await logAuthEvent.warn('TWO_FACTOR_VERIFICATION_FAILED', {
      adminId,
      reason: 'Invalid code',
    })

    return { valid: false, error: 'Invalid verification code' }
  } catch (error) {
    logger.error('Error verifying 2FA code:', error as Error)
    return { valid: false, error: 'Verification failed' }
  }
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(
  adminId: string,
  verificationCode: string
): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    // Get current 2FA secret
    const { data: admin, error: fetchError} = await supabaseAdmin
      .from('super_admins')
      .select('two_factor_secret, two_factor_enabled')
      .eq('id', adminId)
      .maybeSingle()

    if (fetchError || !admin) {
      return { success: false, error: 'Super admin not found' }
    }

    const adminData = admin as { two_factor_secret: string; two_factor_enabled: boolean }

    if (!adminData.two_factor_enabled) {
      return { success: false, error: '2FA is not enabled' }
    }

    // Verify code before regenerating
    if (!verifyTOTPCode(verificationCode, adminData.two_factor_secret)) {
      await logAuthEvent.warn('BACKUP_CODES_REGENERATION_FAILED', {
        adminId,
        reason: 'Invalid verification code',
      })
      return { success: false, error: 'Invalid verification code' }
    }

    // Generate new backup codes
    const newBackupCodes = generateBackupCodes(8)

    // Hash backup codes
    const hashedBackupCodes = await Promise.all(
      newBackupCodes.map((code) => bcrypt.hash(code, 10))
    )

    // Update database
    const { error } = await supabaseAdmin
      .from('super_admins')
      .update({
        backup_codes: hashedBackupCodes,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', adminId)

    if (error) {
      logger.error('Error regenerating backup codes:', error as Error)
      return { success: false, error: 'Failed to regenerate backup codes' }
    }

    await logAuthEvent.info('BACKUP_CODES_REGENERATED', { adminId }, { userId: adminId })

    return { success: true, backupCodes: newBackupCodes }
  } catch (error) {
    logger.error('Failed to regenerate backup codes:', error as Error)
    return { success: false, error: 'System error' }
  }
}

/**
 * Check if 2FA is enabled for a super admin
 */
export async function isTwoFactorEnabled(
  adminId: string
): Promise<{ enabled: boolean; error?: string }> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    const { data: admin, error } = await supabaseAdmin
      .from('super_admins')
      .select('two_factor_enabled')
      .eq('id', adminId)
      .maybeSingle()

    if (error || !admin) {
      return { enabled: false, error: 'Super admin not found' }
    }

    const adminData = admin as { two_factor_enabled: boolean }
    return { enabled: adminData.two_factor_enabled }
  } catch (error) {
    logger.error('Error checking 2FA status:', error as Error)
    return { enabled: false, error: 'System error' }
  }
}

/**
 * Get remaining backup codes count
 */
export async function getRemainingBackupCodesCount(
  adminId: string
): Promise<{ count: number; error?: string }> {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin()

    const { data: admin, error } = await supabaseAdmin
      .from('super_admins')
      .select('backup_codes')
      .eq('id', adminId)
      .maybeSingle()

    if (error || !admin) {
      return { count: 0, error: 'Super admin not found' }
    }

    const adminData = admin as { backup_codes: string[] | null }
    return { count: adminData.backup_codes?.length || 0 }
  } catch (error) {
    logger.error('Error getting backup codes count:', error as Error)
    return { count: 0, error: 'System error' }
  }
}
