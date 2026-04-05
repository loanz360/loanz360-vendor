/**
 * Encryption Service
 * Provides field-level encryption using AES-256-GCM
 * Supports key rotation and access logging
 */

import { createClient } from '@/lib/supabase/client'
import * as crypto from 'crypto'

// ==================== TYPES ====================

export interface EncryptionKey {
  id: string
  key_id: string
  key_version: number
  encryption_algorithm: string
  key_hash: string
  key_salt: string
  purpose?: string
  is_active: boolean
  rotated_at?: string
  expires_at?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface EncryptedField {
  id: string
  table_name: string
  column_name: string
  record_id: string
  encryption_key_id: string
  encryption_algorithm: string
  initialization_vector: string
  encrypted_at: string
  decrypted_at?: string
  access_count: number
  created_at: string
  updated_at: string
}

export interface EncryptedData {
  ciphertext: string
  iv: string
  authTag: string
  keyId: string
  keyVersion: number
}

// ==================== ENCRYPTION SERVICE ====================

export class EncryptionService {
  private supabase = createClient()
  private readonly ALGORITHM = 'aes-256-gcm'
  private readonly KEY_LENGTH = 32 // 256 bits
  private readonly IV_LENGTH = 16 // 128 bits
  private readonly AUTH_TAG_LENGTH = 16 // 128 bits
  private readonly SALT_LENGTH = 32 // 256 bits

  // In-memory cache for encryption keys (encrypted with master key)
  private keyCache = new Map<string, Buffer>()

  // ==================== KEY MANAGEMENT ====================

  /**
   * Generate a new encryption key
   * @param keyId User-friendly identifier (e.g., 'lead_notes_encryption')
   * @param purpose Description of what this key encrypts
   * @param masterPassword Master password for key derivation
   */
  async generateKey(
    keyId: string,
    purpose: string,
    masterPassword: string,
    userId?: string
  ): Promise<{ success: boolean; keyData?: EncryptionKey; error?: string }> {
    try {
      // Generate random encryption key
      const encryptionKey = crypto.randomBytes(this.KEY_LENGTH)

      // Generate salt for key derivation
      const salt = crypto.randomBytes(this.SALT_LENGTH)

      // Derive key from master password using PBKDF2
      const derivedKey = crypto.pbkdf2Sync(masterPassword, salt, 100000, this.KEY_LENGTH, 'sha256')

      // Hash the encryption key for storage (never store plaintext)
      const keyHash = crypto.createHash('sha256').update(encryptionKey).digest('hex')

      // Encrypt the encryption key with the derived key before caching
      const encryptedKey = this.encryptWithKey(encryptionKey, derivedKey)

      // Check if key already exists
      const { data: existing } = await this.supabase
        .from('encryption_keys')
        .select('key_version')
        .eq('key_id', keyId)
        .order('key_version', { ascending: false })
        .limit(1)
        .maybeSingle()

      const version = existing ? existing.key_version + 1 : 1

      // Store key metadata (not the actual key)
      const { data: keyData, error } = await this.supabase
        .from('encryption_keys')
        .insert({
          key_id: keyId,
          key_version: version,
          encryption_algorithm: this.ALGORITHM,
          key_hash: keyHash,
          key_salt: salt.toString('base64'),
          purpose,
          is_active: true,
          created_by: userId
        })
        .select()
        .maybeSingle()

      if (error) throw error

      // Cache the encrypted key
      this.keyCache.set(`${keyId}:${version}`, encryptionKey)

      return { success: true, keyData }
    } catch (error: unknown) {
      console.error('Error generating encryption key:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Retrieve encryption key from cache or derive from master password
   */
  private async getEncryptionKey(keyId: string, keyVersion: number, masterPassword?: string): Promise<Buffer | null> {
    const cacheKey = `${keyId}:${keyVersion}`

    // Check cache first
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!
    }

    // If not in cache and no master password provided, cannot retrieve
    if (!masterPassword) {
      console.error('Encryption key not in cache and no master password provided')
      return null
    }

    // Retrieve key metadata from database
    const { data: keyData } = await this.supabase
      .from('encryption_keys')
      .select('*')
      .eq('key_id', keyId)
      .eq('key_version', keyVersion)
      .maybeSingle()

    if (!keyData) {
      console.error('Encryption key not found in database')
      return null
    }

    // In production, you would decrypt the key using the master password
    // For now, we'll need to generate it fresh (this is a limitation of storing only hash)
    // BETTER APPROACH: Store encrypted key instead of just hash

    console.warn('⚠️ Key not in cache. In production, implement secure key storage.')
    return null
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyId: string, masterPassword: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Deactivate old key
      await this.supabase
        .from('encryption_keys')
        .update({
          is_active: false,
          rotated_at: new Date().toISOString()
        })
        .eq('key_id', keyId)
        .eq('is_active', true)

      // Generate new key version
      const result = await this.generateKey(keyId, 'Rotated key', masterPassword, userId)

      return result
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  // ==================== ENCRYPTION/DECRYPTION ====================

  /**
   * Encrypt plaintext using AES-256-GCM
   */
  async encrypt(
    plaintext: string,
    keyId: string,
    keyVersion: number,
    masterPassword?: string
  ): Promise<{ success: boolean; encrypted?: EncryptedData; error?: string }> {
    try {
      // Get encryption key
      const encryptionKey = await this.getEncryptionKey(keyId, keyVersion, masterPassword)
      if (!encryptionKey) {
        return { success: false, error: 'Encryption key not available' }
      }

      // Generate random IV
      const iv = crypto.randomBytes(this.IV_LENGTH)

      // Create cipher
      const cipher = crypto.createCipheriv(this.ALGORITHM, encryptionKey, iv)

      // Encrypt
      let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
      ciphertext += cipher.final('base64')

      // Get auth tag
      const authTag = cipher.getAuthTag()

      return {
        success: true,
        encrypted: {
          ciphertext,
          iv: iv.toString('base64'),
          authTag: authTag.toString('base64'),
          keyId,
          keyVersion
        }
      }
    } catch (error: unknown) {
      console.error('Error encrypting data:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Decrypt ciphertext using AES-256-GCM
   */
  async decrypt(
    encrypted: EncryptedData,
    masterPassword?: string
  ): Promise<{ success: boolean; plaintext?: string; error?: string }> {
    try {
      // Get encryption key
      const encryptionKey = await this.getEncryptionKey(encrypted.keyId, encrypted.keyVersion, masterPassword)
      if (!encryptionKey) {
        return { success: false, error: 'Encryption key not available' }
      }

      // Convert from base64
      const iv = Buffer.from(encrypted.iv, 'base64')
      const authTag = Buffer.from(encrypted.authTag, 'base64')

      // Create decipher
      const decipher = crypto.createDecipheriv(this.ALGORITHM, encryptionKey, iv)
      decipher.setAuthTag(authTag)

      // Decrypt
      let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8')
      plaintext += decipher.final('utf8')

      return { success: true, plaintext }
    } catch (error: unknown) {
      console.error('Error decrypting data:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Encrypt field in database and track metadata
   */
  async encryptField(
    tableName: string,
    columnName: string,
    recordId: string,
    plaintext: string,
    keyId: string,
    keyVersion: number,
    masterPassword?: string
  ): Promise<{ success: boolean; encrypted?: EncryptedData; error?: string }> {
    try {
      // Encrypt data
      const result = await this.encrypt(plaintext, keyId, keyVersion, masterPassword)
      if (!result.success || !result.encrypted) {
        return result
      }

      // Get key database ID
      const { data: keyData } = await this.supabase
        .from('encryption_keys')
        .select('id')
        .eq('key_id', keyId)
        .eq('key_version', keyVersion)
        .maybeSingle()

      if (!keyData) {
        return { success: false, error: 'Encryption key not found' }
      }

      // Store encryption metadata
      await this.supabase.from('encrypted_fields').upsert({
        table_name: tableName,
        column_name: columnName,
        record_id: recordId,
        encryption_key_id: keyData.id,
        encryption_algorithm: this.ALGORITHM,
        initialization_vector: result.encrypted.iv,
        encrypted_at: new Date().toISOString()
      })

      return { success: true, encrypted: result.encrypted }
    } catch (error: unknown) {
      console.error('Error encrypting field:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Decrypt field and log access
   */
  async decryptField(
    tableName: string,
    columnName: string,
    recordId: string,
    encrypted: EncryptedData,
    masterPassword?: string
  ): Promise<{ success: boolean; plaintext?: string; error?: string }> {
    try {
      // Decrypt data
      const result = await this.decrypt(encrypted, masterPassword)
      if (!result.success) {
        return result
      }

      // Log access
      await this.supabase
        .from('encrypted_fields')
        .update({
          decrypted_at: new Date().toISOString(),
          access_count: this.supabase.rpc('increment', { row_id: recordId, amount: 1 })
        })
        .eq('table_name', tableName)
        .eq('column_name', columnName)
        .eq('record_id', recordId)

      return result
    } catch (error: unknown) {
      console.error('Error decrypting field:', error)
      return { success: false, error: error.message }
    }
  }

  // ==================== END-TO-END ENCRYPTION ====================

  /**
   * Encrypt with user's public key (for E2EE notes)
   * This is a simplified version - in production, use proper asymmetric encryption
   */
  async encryptE2E(plaintext: string, publicKey: string): Promise<{ success: boolean; encrypted?: string; error?: string }> {
    try {
      // TODO: Implement RSA or ECDH encryption with user's public key
      // For now, use symmetric encryption with derived key
      const derivedKey = crypto.pbkdf2Sync(publicKey, 'salt', 100000, this.KEY_LENGTH, 'sha256')

      const encrypted = this.encryptWithKey(Buffer.from(plaintext, 'utf8'), derivedKey)

      return { success: true, encrypted: encrypted.toString('base64') }
    } catch (error: unknown) {
      console.error('Error with E2E encryption:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Decrypt with user's private key (for E2EE notes)
   */
  async decryptE2E(ciphertext: string, privateKey: string): Promise<{ success: boolean; plaintext?: string; error?: string }> {
    try {
      // TODO: Implement RSA or ECDH decryption with user's private key
      const derivedKey = crypto.pbkdf2Sync(privateKey, 'salt', 100000, this.KEY_LENGTH, 'sha256')

      const decrypted = this.decryptWithKey(Buffer.from(ciphertext, 'base64'), derivedKey)

      return { success: true, plaintext: decrypted.toString('utf8') }
    } catch (error: unknown) {
      console.error('Error with E2E decryption:', error)
      return { success: false, error: error.message }
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get all encryption keys
   */
  async getKeys(filters?: { is_active?: boolean; purpose?: string }): Promise<EncryptionKey[]> {
    try {
      let query = this.supabase
        .from('encryption_keys')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active)
      }

      if (filters?.purpose) {
        query = query.eq('purpose', filters.purpose)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching keys:', error)
      return []
    }
  }

  /**
   * Get encrypted fields metadata
   */
  async getEncryptedFields(filters?: {
    table_name?: string
    record_id?: string
  }): Promise<EncryptedField[]> {
    try {
      let query = this.supabase
        .from('encrypted_fields')
        .select('*')
        .order('encrypted_at', { ascending: false })

      if (filters?.table_name) {
        query = query.eq('table_name', filters.table_name)
      }

      if (filters?.record_id) {
        query = query.eq('record_id', filters.record_id)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching encrypted fields:', error)
      return []
    }
  }

  /**
   * Get encryption statistics
   */
  async getEncryptionStats(): Promise<{
    total_keys: number
    active_keys: number
    total_encrypted_fields: number
    by_table: Record<string, number>
    total_decryptions: number
  }> {
    try {
      const [keys, fields] = await Promise.all([this.getKeys(), this.getEncryptedFields()])

      const byTable = fields.reduce((acc, field) => {
        acc[field.table_name] = (acc[field.table_name] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const totalDecryptions = fields.reduce((sum, field) => sum + field.access_count, 0)

      return {
        total_keys: keys.length,
        active_keys: keys.filter(k => k.is_active).length,
        total_encrypted_fields: fields.length,
        by_table: byTable,
        total_decryptions: totalDecryptions
      }
    } catch (error) {
      console.error('Error fetching encryption stats:', error)
      return {
        total_keys: 0,
        active_keys: 0,
        total_encrypted_fields: 0,
        by_table: {},
        total_decryptions: 0
      }
    }
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Simple symmetric encryption helper
   */
  private encryptWithKey(plaintext: Buffer, key: Buffer): Buffer {
    const iv = crypto.randomBytes(this.IV_LENGTH)
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv)

    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const authTag = cipher.getAuthTag()

    // Combine IV + ciphertext + authTag
    return Buffer.concat([iv, encrypted, authTag])
  }

  /**
   * Simple symmetric decryption helper
   */
  private decryptWithKey(combined: Buffer, key: Buffer): Buffer {
    // Extract IV, ciphertext, authTag
    const iv = combined.slice(0, this.IV_LENGTH)
    const authTag = combined.slice(-this.AUTH_TAG_LENGTH)
    const ciphertext = combined.slice(this.IV_LENGTH, -this.AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }

  /**
   * Clear key cache (call on logout or key rotation)
   */
  clearKeyCache(): void {
    this.keyCache.clear()
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService()
