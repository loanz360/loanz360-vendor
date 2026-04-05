/**
 * Idempotency Key Management for Financial Transactions
 *
 * CRITICAL: Prevents duplicate financial transactions when requests are retried.
 * Essential for PCI-DSS compliance and financial data integrity.
 *
 * How it works:
 * 1. Client generates unique idempotency key (UUID) for each transaction
 * 2. Server checks if key exists before processing
 * 3. If exists, return cached result instead of re-processing
 * 4. If new, process transaction and cache result
 *
 * Compliance: PCI-DSS, SOX, RBI Digital Lending Guidelines
 */

import { supabaseClient } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'
import Decimal from 'decimal.js'

/**
 * Idempotency key configuration
 */
export const IDEMPOTENCY_CONFIG = {
  // Keys expire after 24 hours (industry standard)
  TTL_MS: 24 * 60 * 60 * 1000,

  // Maximum key length (RFC 4122 UUID is 36 chars)
  MAX_KEY_LENGTH: 255,

  // Minimum key length (prevent weak keys)
  MIN_KEY_LENGTH: 16,
} as const

/**
 * Transaction types that require idempotency protection
 */
export enum TransactionType {
  LOAN_DISBURSEMENT = 'loan_disbursement',
  LOAN_REPAYMENT = 'loan_repayment',
  PROCESSING_FEE = 'processing_fee',
  PREPAYMENT = 'prepayment',
  LATE_PAYMENT_FEE = 'late_payment_fee',
  PAYOUT_PARTNER = 'payout_partner',
  REFUND = 'refund',
}

/**
 * Idempotency key record stored in database
 */
interface IdempotencyRecord {
  id?: string
  idempotency_key: string
  user_id: string
  transaction_type: TransactionType
  request_payload: Record<string, unknown>
  response_payload: Record<string, unknown> | null
  status: 'processing' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
  expires_at: string
  completed_at?: string
}

/**
 * Result of idempotency check
 */
interface IdempotencyCheckResult {
  // Whether this is a duplicate request
  isDuplicate: boolean

  // If duplicate, the cached response
  cachedResponse?: Record<string, unknown>

  // If duplicate and failed, the error
  cachedError?: string

  // If duplicate and still processing
  isProcessing?: boolean

  // Record ID for updating status
  recordId?: string
}

/**
 * Validate idempotency key format
 */
export function validateIdempotencyKey(key: string): { valid: boolean; error?: string } {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Idempotency key is required' }
  }

  if (key.length < IDEMPOTENCY_CONFIG.MIN_KEY_LENGTH) {
    return {
      valid: false,
      error: `Idempotency key must be at least ${IDEMPOTENCY_CONFIG.MIN_KEY_LENGTH} characters`
    }
  }

  if (key.length > IDEMPOTENCY_CONFIG.MAX_KEY_LENGTH) {
    return {
      valid: false,
      error: `Idempotency key must not exceed ${IDEMPOTENCY_CONFIG.MAX_KEY_LENGTH} characters`
    }
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validPattern = /^[a-zA-Z0-9_-]+$/
  if (!validPattern.test(key)) {
    return {
      valid: false,
      error: 'Idempotency key must contain only alphanumeric characters, hyphens, and underscores'
    }
  }

  return { valid: true }
}

/**
 * Generate a UUID v4 idempotency key (client-side)
 */
export function generateIdempotencyKey(): string {
  // Use crypto.randomUUID() if available (modern browsers/Node 16+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback: Generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Check if idempotency key exists and return cached result if found
 *
 * CRITICAL: Must be called BEFORE processing any financial transaction
 */
export async function checkIdempotency(
  idempotencyKey: string,
  userId: string,
  transactionType: TransactionType
): Promise<IdempotencyCheckResult> {
  try {
    // Validate key format
    const validation = validateIdempotencyKey(idempotencyKey)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Check if key exists in database
    const { data: record, error } = await supabaseClient
      .from('idempotency_keys')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .eq('user_id', userId)
      .eq('transaction_type', transactionType)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not a duplicate)
      logger.error('Idempotency check failed', error, {
        idempotencyKey,
        userId,
        transactionType,
      })
      throw new Error('Failed to check idempotency key')
    }

    if (!record) {
      // Not a duplicate, proceed with transaction
      return { isDuplicate: false }
    }

    // Found existing record - this is a duplicate request
    const typedRecord = record as IdempotencyRecord

    if (typedRecord.status === 'processing') {
      // Transaction is still being processed
      logger.warn('Duplicate request while processing', {
        idempotencyKey,
        userId,
        transactionType,
      })
      return {
        isDuplicate: true,
        isProcessing: true,
      }
    }

    if (typedRecord.status === 'failed') {
      // Transaction failed previously
      logger.info('Returning cached error for duplicate request', {
        idempotencyKey,
        userId,
        transactionType,
      })
      return {
        isDuplicate: true,
        cachedError: typedRecord.error_message || 'Transaction failed',
      }
    }

    // Transaction completed successfully - return cached response
    logger.info('Returning cached response for duplicate request', {
      idempotencyKey,
      userId,
      transactionType,
    })
    return {
      isDuplicate: true,
      cachedResponse: typedRecord.response_payload || {},
    }

  } catch (error) {
    logger.error('Idempotency check error', error instanceof Error ? error : undefined, {
      idempotencyKey,
      userId,
      transactionType,
    })
    throw error
  }
}

/**
 * Create idempotency record to mark transaction as processing
 *
 * CRITICAL: Must be called in same database transaction as financial operation
 */
export async function createIdempotencyRecord(
  idempotencyKey: string,
  userId: string,
  transactionType: TransactionType,
  requestPayload: Record<string, unknown>
): Promise<string> {
  try {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + IDEMPOTENCY_CONFIG.TTL_MS)

    const record: Omit<IdempotencyRecord, 'id'> = {
      idempotency_key: idempotencyKey,
      user_id: userId,
      transaction_type: transactionType,
      request_payload: requestPayload,
      response_payload: null,
      status: 'processing',
      error_message: null,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }

    const { data, error } = await supabaseClient
      .from('idempotency_keys')
      .insert(record as never)
      .select('id')
      .maybeSingle()

    if (error) {
      logger.error('Failed to create idempotency record', error, {
        idempotencyKey,
        userId,
        transactionType,
      })
      throw new Error('Failed to create idempotency record')
    }

    const insertedRecord = data as { id: string }
    logger.info('Created idempotency record', {
      recordId: insertedRecord.id,
      idempotencyKey,
      userId,
      transactionType,
    })

    return insertedRecord.id

  } catch (error) {
    logger.error('Create idempotency record error', error instanceof Error ? error : undefined, {
      idempotencyKey,
      userId,
      transactionType,
    })
    throw error
  }
}

/**
 * Update idempotency record with successful result
 */
export async function completeIdempotencyRecord(
  recordId: string,
  responsePayload: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabaseClient
      .from('idempotency_keys')
      .update({
        status: 'completed',
        response_payload: responsePayload,
        completed_at: new Date().toISOString(),
      } as never)
      .eq('id', recordId)

    if (error) {
      logger.error('Failed to complete idempotency record', error, { recordId })
      throw new Error('Failed to complete idempotency record')
    }

    logger.info('Completed idempotency record', { recordId })

  } catch (error) {
    logger.error('Complete idempotency record error', error instanceof Error ? error : undefined, {
      recordId,
    })
    throw error
  }
}

/**
 * Update idempotency record with failure
 */
export async function failIdempotencyRecord(
  recordId: string,
  errorMessage: string
): Promise<void> {
  try {
    const { error } = await supabaseClient
      .from('idempotency_keys')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      } as never)
      .eq('id', recordId)

    if (error) {
      logger.error('Failed to update idempotency record', error, { recordId })
      throw new Error('Failed to update idempotency record')
    }

    logger.info('Failed idempotency record', { recordId, errorMessage })

  } catch (error) {
    logger.error('Fail idempotency record error', error instanceof Error ? error : undefined, {
      recordId,
    })
    throw error
  }
}

/**
 * Clean up expired idempotency keys (run as scheduled job)
 */
export async function cleanupExpiredKeys(): Promise<number> {
  try {
    const { data, error } = await supabaseClient
      .from('idempotency_keys')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id')

    if (error) {
      logger.error('Failed to cleanup expired idempotency keys', error)
      throw new Error('Failed to cleanup expired keys')
    }

    const deletedCount = data?.length || 0
    logger.info('Cleaned up expired idempotency keys', { deletedCount })

    return deletedCount

  } catch (error) {
    logger.error('Cleanup expired keys error', error instanceof Error ? error : undefined)
    throw error
  }
}

/**
 * Example usage wrapper for financial transactions
 */
export async function executeWithIdempotency<T>(
  idempotencyKey: string,
  userId: string,
  transactionType: TransactionType,
  requestPayload: Record<string, unknown>,
  transactionFn: () => Promise<T>
): Promise<T> {
  // Check for duplicate
  const check = await checkIdempotency(idempotencyKey, userId, transactionType)

  if (check.isDuplicate) {
    if (check.isProcessing) {
      throw new Error('Transaction is already being processed. Please wait.')
    }
    if (check.cachedError) {
      throw new Error(check.cachedError)
    }
    if (check.cachedResponse) {
      return check.cachedResponse as T
    }
  }

  // Create idempotency record
  const recordId = await createIdempotencyRecord(
    idempotencyKey,
    userId,
    transactionType,
    requestPayload
  )

  try {
    // Execute transaction
    const result = await transactionFn()

    // Mark as completed
    await completeIdempotencyRecord(recordId, result as Record<string, unknown>)

    return result

  } catch (error) {
    // Mark as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await failIdempotencyRecord(recordId, errorMessage)
    throw error
  }
}
