/**
 * Multi-Factor Authentication Service
 * Supports TOTP (RFC 6238), SMS 2FA, and Email 2FA
 */

import { createClient } from '@/lib/supabase/client'
import * as crypto from 'crypto'

// ==================== TYPES ====================

export type MFAMethodType = 'totp' | 'sms' | 'email'

export interface MFAMethod {
  id: string
  user_id: string
  method_type: MFAMethodType
  is_enabled: boolean
  is_verified: boolean
  totp_secret?: string
  totp_backup_codes?: string[]
  phone_number?: string
  email_address?: string
  device_name?: string
  last_used_at?: string
  created_at: string
  updated_at: string
}

export interface MFASetupData {
  method_id: string
  method_type: MFAMethodType
  totp_secret?: string
  totp_qr_code?: string // Data URL for QR code
  backup_codes?: string[]
  phone_number?: string
  email_address?: string
  verification_code?: string
}

export interface MFAVerificationLog {
  id: string
  user_id: string
  mfa_method_id: string
  method_type: MFAMethodType
  verification_success: boolean
  failure_reason?: string
  ip_address?: string
  user_agent?: string
  created_at: string
}

// ==================== TOTP UTILITIES ====================

class TOTPService {
  /**
   * Generate a random Base32 secret for TOTP
   */
  static generateSecret(): string {
    const buffer = crypto.randomBytes(20)
    return this.base32Encode(buffer)
  }

  /**
   * Base32 encode (RFC 4648)
   */
  private static base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let bits = 0
    let value = 0
    let output = ''

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i]
      bits += 8

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31]
        bits -= 5
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31]
    }

    return output
  }

  /**
   * Base32 decode (RFC 4648)
   */
  private static base32Decode(base32: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let bits = 0
    let value = 0
    let index = 0
    const output = Buffer.alloc(Math.ceil((base32.length * 5) / 8))

    for (let i = 0; i < base32.length; i++) {
      const char = base32.charAt(i).toUpperCase()
      const charIndex = alphabet.indexOf(char)

      if (charIndex === -1) continue

      value = (value << 5) | charIndex
      bits += 5

      if (bits >= 8) {
        output[index++] = (value >>> (bits - 8)) & 255
        bits -= 8
      }
    }

    return output.slice(0, index)
  }

  /**
   * Generate TOTP code (RFC 6238)
   * @param secret Base32 encoded secret
   * @param window Time window (30 seconds default)
   * @param digits Number of digits (6 default)
   */
  static generateTOTP(secret: string, window = 30, digits = 6): string {
    const epoch = Math.floor(Date.now() / 1000)
    const counter = Math.floor(epoch / window)

    return this.generateHOTP(secret, counter, digits)
  }

  /**
   * Generate HOTP code (RFC 4226)
   */
  private static generateHOTP(secret: string, counter: number, digits = 6): string {
    const decodedSecret = this.base32Decode(secret)

    // Create counter buffer (8 bytes, big-endian)
    const buffer = Buffer.alloc(8)
    buffer.writeBigInt64BE(BigInt(counter))

    // HMAC-SHA1
    const hmac = crypto.createHmac('sha1', decodedSecret)
    hmac.update(buffer)
    const hash = hmac.digest()

    // Dynamic truncation (RFC 4226)
    const offset = hash[hash.length - 1] & 0xf
    const code =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)

    // Return code with specified digits
    return String(code % Math.pow(10, digits)).padStart(digits, '0')
  }

  /**
   * Verify TOTP code
   * @param secret Base32 encoded secret
   * @param token User-provided token
   * @param window Time window (30 seconds)
   * @param drift Allow drift of ±1 window (90 seconds total)
   */
  static verifyTOTP(secret: string, token: string, window = 30, drift = 1): boolean {
    const epoch = Math.floor(Date.now() / 1000)
    const currentCounter = Math.floor(epoch / window)

    // Check current window and drift windows
    for (let i = -drift; i <= drift; i++) {
      const counter = currentCounter + i
      const expectedToken = this.generateHOTP(secret, counter, 6)

      if (expectedToken === token) {
        return true
      }
    }

    return false
  }

  /**
   * Generate QR code data URL for TOTP setup
   * Format: otpauth://totp/LOANZ360:user@example.com?secret=SECRET&issuer=LOANZ360
   */
  static generateQRCodeURL(secret: string, userEmail: string, issuer = 'LOANZ360'): string {
    const label = `${issuer}:${userEmail}`
    const params = new URLSearchParams({
      secret,
      issuer,
      algorithm: 'SHA1',
      digits: '6',
      period: '30'
    })

    return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
  }
}

// ==================== MFA SERVICE ====================

export class MFAService {
  private supabase = createClient()

  // ==================== TOTP METHODS ====================

  /**
   * Setup TOTP for a user
   */
  async setupTOTP(userId: string, deviceName?: string): Promise<{ success: boolean; data?: MFASetupData; error?: string }> {
    try {
      // Generate secret and backup codes
      const secret = TOTPService.generateSecret()
      const backupCodes = this.generateBackupCodes(10)

      // Hash backup codes for storage
      const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code))

      // Get user email for QR code
      const { data: user } = await this.supabase.auth.getUser()
      if (!user?.user?.email) {
        return { success: false, error: 'User email not found' }
      }

      // Create MFA method
      const { data: mfaMethod, error } = await this.supabase
        .from('mfa_methods')
        .insert({
          user_id: userId,
          method_type: 'totp',
          is_enabled: false, // Will be enabled after verification
          is_verified: false,
          totp_secret: secret,
          totp_backup_codes: hashedBackupCodes,
          device_name: deviceName || 'Authenticator App'
        })
        .select()
        .maybeSingle()

      if (error) throw error

      // Generate QR code URL
      const qrCodeURL = TOTPService.generateQRCodeURL(secret, user.user.email)

      return {
        success: true,
        data: {
          method_id: mfaMethod.id,
          method_type: 'totp',
          totp_secret: secret,
          totp_qr_code: qrCodeURL,
          backup_codes: backupCodes // Return plaintext codes to user (only shown once)
        }
      }
    } catch (error: unknown) {
      console.error('Error setting up TOTP:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Verify TOTP code
   */
  async verifyTOTP(
    userId: string,
    methodId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get TOTP method
      const { data: method, error: fetchError } = await this.supabase
        .from('mfa_methods')
        .select('*')
        .eq('id', methodId)
        .eq('user_id', userId)
        .eq('method_type', 'totp')
        .maybeSingle()

      if (fetchError || !method) {
        return { success: false, error: 'TOTP method not found' }
      }

      // Verify token
      const isValid = TOTPService.verifyTOTP(method.totp_secret, token)

      // Record verification attempt
      await this.recordVerificationLog(userId, methodId, 'totp', isValid, isValid ? undefined : 'Invalid token', ipAddress, userAgent)

      if (!isValid) {
        return { success: false, error: 'Invalid TOTP code' }
      }

      // Enable and verify method on first successful verification
      if (!method.is_verified) {
        await this.supabase
          .from('mfa_methods')
          .update({
            is_enabled: true,
            is_verified: true,
            last_used_at: new Date().toISOString()
          })
          .eq('id', methodId)

        // Update user MFA status
        await this.updateUserMFAStatus(userId)
      } else {
        // Just update last_used_at
        await this.supabase
          .from('mfa_methods')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', methodId)
      }

      return { success: true }
    } catch (error: unknown) {
      console.error('Error verifying TOTP:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, methodId: string, backupCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: method } = await this.supabase
        .from('mfa_methods')
        .select('*')
        .eq('id', methodId)
        .eq('user_id', userId)
        .eq('method_type', 'totp')
        .maybeSingle()

      if (!method || !method.totp_backup_codes) {
        return { success: false, error: 'TOTP method not found' }
      }

      // Check if backup code matches any hashed code
      const hashedCode = this.hashBackupCode(backupCode)
      const codeIndex = method.totp_backup_codes.indexOf(hashedCode)

      if (codeIndex === -1) {
        await this.recordVerificationLog(userId, methodId, 'totp', false, 'Invalid backup code')
        return { success: false, error: 'Invalid backup code' }
      }

      // Remove used backup code
      const updatedCodes = method.totp_backup_codes.filter((_: any, i: number) => i !== codeIndex)

      await this.supabase
        .from('mfa_methods')
        .update({
          totp_backup_codes: updatedCodes,
          last_used_at: new Date().toISOString()
        })
        .eq('id', methodId)

      await this.recordVerificationLog(userId, methodId, 'totp', true)

      // Warn if running low on backup codes
      if (updatedCodes.length <= 2) {
        console.warn(`⚠️ User ${userId} has only ${updatedCodes.length} backup codes remaining`)
      }

      return { success: true }
    } catch (error: unknown) {
      console.error('Error verifying backup code:', error)
      return { success: false, error: error.message }
    }
  }

  // ==================== SMS METHODS ====================

  /**
   * Setup SMS 2FA
   */
  async setupSMS(userId: string, phoneNumber: string): Promise<{ success: boolean; data?: MFASetupData; error?: string }> {
    try {
      // Normalize phone number to E.164 format
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber)

      // Generate 6-digit verification code
      const verificationCode = this.generateVerificationCode(6)

      // Create MFA method
      const { data: mfaMethod, error } = await this.supabase
        .from('mfa_methods')
        .insert({
          user_id: userId,
          method_type: 'sms',
          is_enabled: false,
          is_verified: false,
          phone_number: normalizedPhone,
          verification_code: verificationCode,
          verification_code_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
        })
        .select()
        .maybeSingle()

      if (error) throw error

      // TODO: Send SMS via Twilio/MSG91
      // await this.sendSMS(normalizedPhone, `Your LOANZ 360 verification code is: ${verificationCode}`)

      return {
        success: true,
        data: {
          method_id: mfaMethod.id,
          method_type: 'sms',
          phone_number: normalizedPhone,
          verification_code: verificationCode // For testing only, remove in production
        }
      }
    } catch (error: unknown) {
      console.error('Error setting up SMS 2FA:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Verify SMS code
   */
  async verifySMS(
    userId: string,
    methodId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: method } = await this.supabase
        .from('mfa_methods')
        .select('*')
        .eq('id', methodId)
        .eq('user_id', userId)
        .eq('method_type', 'sms')
        .maybeSingle()

      if (!method) {
        return { success: false, error: 'SMS method not found' }
      }

      // Check if code expired
      if (method.verification_code_expires_at && new Date(method.verification_code_expires_at) < new Date()) {
        await this.recordVerificationLog(userId, methodId, 'sms', false, 'Code expired', ipAddress, userAgent)
        return { success: false, error: 'Verification code expired' }
      }

      // Verify code
      if (method.verification_code !== code) {
        await this.recordVerificationLog(userId, methodId, 'sms', false, 'Invalid code', ipAddress, userAgent)
        return { success: false, error: 'Invalid verification code' }
      }

      // Enable and verify method
      await this.supabase
        .from('mfa_methods')
        .update({
          is_enabled: true,
          is_verified: true,
          verification_code: null,
          verification_code_expires_at: null,
          last_used_at: new Date().toISOString()
        })
        .eq('id', methodId)

      await this.recordVerificationLog(userId, methodId, 'sms', true, undefined, ipAddress, userAgent)
      await this.updateUserMFAStatus(userId)

      return { success: true }
    } catch (error: unknown) {
      console.error('Error verifying SMS:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Send SMS 2FA code for login
   */
  async sendSMSCode(userId: string, methodId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: method } = await this.supabase
        .from('mfa_methods')
        .select('*')
        .eq('id', methodId)
        .eq('user_id', userId)
        .eq('method_type', 'sms')
        .eq('is_verified', true)
        .maybeSingle()

      if (!method) {
        return { success: false, error: 'SMS method not found' }
      }

      const verificationCode = this.generateVerificationCode(6)

      await this.supabase
        .from('mfa_methods')
        .update({
          verification_code: verificationCode,
          verification_code_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        })
        .eq('id', methodId)

      // TODO: Send SMS

      return { success: true }
    } catch (error: unknown) {
      console.error('Error sending SMS code:', error)
      return { success: false, error: error.message }
    }
  }

  // ==================== EMAIL METHODS ====================

  /**
   * Setup Email 2FA
   */
  async setupEmail(userId: string, emailAddress: string): Promise<{ success: boolean; data?: MFASetupData; error?: string }> {
    try {
      const verificationCode = this.generateVerificationCode(6)

      const { data: mfaMethod, error } = await this.supabase
        .from('mfa_methods')
        .insert({
          user_id: userId,
          method_type: 'email',
          is_enabled: false,
          is_verified: false,
          email_address: emailAddress,
          verification_code: verificationCode,
          verification_code_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        })
        .select()
        .maybeSingle()

      if (error) throw error

      // TODO: Send email via email service

      return {
        success: true,
        data: {
          method_id: mfaMethod.id,
          method_type: 'email',
          email_address: emailAddress,
          verification_code: verificationCode // For testing only
        }
      }
    } catch (error: unknown) {
      console.error('Error setting up Email 2FA:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Verify Email code (same logic as SMS)
   */
  async verifyEmail(
    userId: string,
    methodId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: method } = await this.supabase
        .from('mfa_methods')
        .select('*')
        .eq('id', methodId)
        .eq('user_id', userId)
        .eq('method_type', 'email')
        .maybeSingle()

      if (!method) {
        return { success: false, error: 'Email method not found' }
      }

      if (method.verification_code_expires_at && new Date(method.verification_code_expires_at) < new Date()) {
        await this.recordVerificationLog(userId, methodId, 'email', false, 'Code expired', ipAddress, userAgent)
        return { success: false, error: 'Verification code expired' }
      }

      if (method.verification_code !== code) {
        await this.recordVerificationLog(userId, methodId, 'email', false, 'Invalid code', ipAddress, userAgent)
        return { success: false, error: 'Invalid verification code' }
      }

      await this.supabase
        .from('mfa_methods')
        .update({
          is_enabled: true,
          is_verified: true,
          verification_code: null,
          verification_code_expires_at: null,
          last_used_at: new Date().toISOString()
        })
        .eq('id', methodId)

      await this.recordVerificationLog(userId, methodId, 'email', true, undefined, ipAddress, userAgent)
      await this.updateUserMFAStatus(userId)

      return { success: true }
    } catch (error: unknown) {
      console.error('Error verifying Email:', error)
      return { success: false, error: error.message }
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get all MFA methods for a user
   */
  async getUserMFAMethods(userId: string): Promise<MFAMethod[]> {
    try {
      const { data, error } = await this.supabase
        .from('mfa_methods')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching MFA methods:', error)
      return []
    }
  }

  /**
   * Check if user has MFA enabled
   */
  async hasMFAEnabled(userId: string): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from('mfa_methods')
        .select('id')
        .eq('user_id', userId)
        .eq('is_enabled', true)
        .eq('is_verified', true)
        .limit(1)

      return (data?.length || 0) > 0
    } catch (error) {
      return false
    }
  }

  /**
   * Disable MFA method
   */
  async disableMFAMethod(userId: string, methodId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('mfa_methods')
        .update({ is_enabled: false })
        .eq('id', methodId)
        .eq('user_id', userId)

      if (error) throw error

      await this.updateUserMFAStatus(userId)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete MFA method
   */
  async deleteMFAMethod(userId: string, methodId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('mfa_methods')
        .delete()
        .eq('id', methodId)
        .eq('user_id', userId)

      if (error) throw error

      await this.updateUserMFAStatus(userId)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  // ==================== PRIVATE HELPERS ====================

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      codes.push(this.generateVerificationCode(8))
    }
    return codes
  }

  private generateVerificationCode(length: number): string {
    const digits = '0123456789'
    let code = ''
    for (let i = 0; i < length; i++) {
      code += digits[Math.floor(Math.random() * digits.length)]
    }
    return code
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex')
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let normalized = phone.replace(/\D/g, '')

    // Add + prefix if not present (assume international format)
    if (!normalized.startsWith('+')) {
      // Default to India (+91) if no country code
      if (normalized.length === 10) {
        normalized = '+91' + normalized
      } else {
        normalized = '+' + normalized
      }
    }

    return normalized
  }

  private async recordVerificationLog(
    userId: string,
    methodId: string,
    methodType: MFAMethodType,
    success: boolean,
    failureReason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.supabase.from('mfa_verification_logs').insert({
        user_id: userId,
        mfa_method_id: methodId,
        method_type: methodType,
        verification_success: success,
        failure_reason: failureReason,
        ip_address: ipAddress,
        user_agent: userAgent
      })
    } catch (error) {
      console.error('Error recording verification log:', error)
    }
  }

  private async updateUserMFAStatus(userId: string): Promise<void> {
    try {
      const methods = await this.getUserMFAMethods(userId)
      const enabledMethods = methods.filter(m => m.is_enabled && m.is_verified)

      const primaryMethod = enabledMethods[0]?.method_type
      const backupMethods = enabledMethods.slice(1).map(m => m.method_type)

      await this.supabase
        .from('user_mfa_status')
        .upsert({
          user_id: userId,
          mfa_enabled: enabledMethods.length > 0,
          primary_method: primaryMethod,
          backup_methods: backupMethods
        })
    } catch (error) {
      console.error('Error updating user MFA status:', error)
    }
  }
}

// Export singleton instance
export const mfaService = new MFAService()
export { TOTPService }
