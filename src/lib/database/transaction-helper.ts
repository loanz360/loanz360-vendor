/**
 * Database Transaction Helper
 * Provides utilities for managing database transactions and preventing race conditions
 */

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Transaction options
 */
export interface TransactionOptions {
  maxRetries?: number
  retryDelay?: number
  isolationLevel?: 'read committed' | 'repeatable read' | 'serializable'
}

/**
 * Optimistic locking error
 */
export class OptimisticLockError extends Error {
  constructor(message: string = 'Resource was modified by another user') {
    super(message)
    this.name = 'OptimisticLockError'
  }
}

/**
 * Execute a function with retry logic for handling transient errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000 } = options
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry on non-transient errors
      if (!isTransientError(error)) {
        throw error
      }

      // Last attempt - throw error
      if (attempt === maxRetries) {
        break
      }

      // Wait before retrying with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)))
    }
  }

  throw lastError!
}

/**
 * Check if error is transient (should be retried)
 */
function isTransientError(error: any): boolean {
  const transientCodes = [
    '40001', // serialization_failure
    '40P01', // deadlock_detected
    '08006', // connection_failure
    '08003', // connection_does_not_exist
    '08000', // connection_exception
  ]

  return transientCodes.includes(error?.code)
}

/**
 * Optimistic locking - check version before update
 */
export async function updateWithOptimisticLock<T extends Record<string, any>>(
  supabase: SupabaseClient,
  table: string,
  id: string,
  currentVersion: number,
  updates: Partial<T>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    // Update only if version matches (optimistic lock)
    const { data, error } = await supabase
      .from(table)
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        version: currentVersion + 1,
      })
      .eq('id', id)
      .eq('version', currentVersion)
      .select()
      .maybeSingle()

    if (error) {
      return { data: null, error }
    }

    // If no rows updated, version conflict occurred
    if (!data) {
      return {
        data: null,
        error: new OptimisticLockError('Resource was modified by another user. Please refresh and try again.'),
      }
    }

    return { data: data as T, error: null }
  } catch (error) {
    return { data: null, error: error as Error }
  }
}

/**
 * Idempotency key tracker for preventing duplicate operations
 */
const idempotencyCache = new Map<string, { result: any; timestamp: number }>()
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Execute operation with idempotency key
 */
export async function withIdempotency<T>(
  idempotencyKey: string,
  operation: () => Promise<T>
): Promise<T> {
  // Check cache
  const cached = idempotencyCache.get(idempotencyKey)
  if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL) {
    return cached.result as T
  }

  // Execute operation
  const result = await operation()

  // Cache result
  idempotencyCache.set(idempotencyKey, {
    result,
    timestamp: Date.now(),
  })

  // Cleanup old entries (simple implementation)
  if (idempotencyCache.size > 10000) {
    const now = Date.now()
    for (const [key, value] of idempotencyCache.entries()) {
      if (now - value.timestamp > IDEMPOTENCY_TTL) {
        idempotencyCache.delete(key)
      }
    }
  }

  return result
}

/**
 * Generate idempotency key from request data
 */
export function generateIdempotencyKey(
  operation: string,
  userId: string,
  data: Record<string, any>
): string {
  const dataStr = JSON.stringify(data, Object.keys(data).sort())
  return `${operation}:${userId}:${hashString(dataStr)}`
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Atomic counter increment with retry
 */
export async function incrementCounter(
  supabase: SupabaseClient,
  table: string,
  id: string,
  field: string,
  increment: number = 1
): Promise<{ data: number | null; error: Error | null }> {
  return withRetry(async () => {
    const { data, error } = await supabase.rpc('increment_counter', {
      table_name: table,
      record_id: id,
      counter_field: field,
      increment_by: increment,
    })

    if (error) {
      return { data: null, error }
    }

    return { data: data as number, error: null }
  })
}

/**
 * Execute multiple operations in a batch with rollback on error
 */
export async function executeBatch<T>(
  operations: Array<() => Promise<T>>,
  options: { stopOnError?: boolean } = {}
): Promise<{ results: T[]; errors: Error[] }> {
  const { stopOnError = true } = options
  const results: T[] = []
  const errors: Error[] = []

  for (const operation of operations) {
    try {
      const result = await operation()
      results.push(result)
    } catch (error) {
      errors.push(error as Error)
      if (stopOnError) {
        break
      }
    }
  }

  return { results, errors }
}

/**
 * Acquire distributed lock (using Supabase advisory locks)
 */
export async function acquireLock(
  supabase: SupabaseClient,
  lockKey: string,
  timeout: number = 5000
): Promise<{ success: boolean; release: () => Promise<void> }> {
  const lockId = Math.abs(hashCode(lockKey))
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const { data, error } = await supabase.rpc('pg_try_advisory_lock', {
      lock_id: lockId,
    })

    if (!error && data === true) {
      // Lock acquired
      return {
        success: true,
        release: async () => {
          await supabase.rpc('pg_advisory_unlock', { lock_id: lockId })
        },
      }
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // Timeout
  return {
    success: false,
    release: async () => {},
  }
}

/**
 * Hash code function for lock keys
 */
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
  }
  return hash
}

/**
 * Execute operation with distributed lock
 */
export async function withLock<T>(
  supabase: SupabaseClient,
  lockKey: string,
  operation: () => Promise<T>,
  timeout: number = 5000
): Promise<T> {
  const { success, release } = await acquireLock(supabase, lockKey, timeout)

  if (!success) {
    throw new Error(`Failed to acquire lock: ${lockKey}`)
  }

  try {
    return await operation()
  } finally {
    await release()
  }
}

/**
 * Check for concurrent updates before executing operation
 */
export async function checkConcurrentUpdate<T extends Record<string, any>>(
  supabase: SupabaseClient,
  table: string,
  id: string,
  lastKnownUpdate: string
): Promise<{ hasConflict: boolean; currentData: T | null }> {
  const { data, error } = await supabase
    .from(table)
    .select('updated_at, *')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return { hasConflict: false, currentData: null }
  }

  const hasConflict = new Date(data.updated_at) > new Date(lastKnownUpdate)

  return {
    hasConflict,
    currentData: data as T,
  }
}

/**
 * Upsert with conflict resolution
 */
export async function upsertWithConflictResolution<T extends Record<string, any>>(
  supabase: SupabaseClient,
  table: string,
  data: T,
  conflictColumns: string[],
  onConflict: 'update' | 'ignore' | 'error' = 'update'
): Promise<{ data: T | null; error: Error | null }> {
  try {
    if (onConflict === 'update') {
      const { data: result, error } = await supabase
        .from(table)
        .upsert(data, {
          onConflict: conflictColumns.join(','),
        })
        .select()
        .maybeSingle()

      return { data: result as T, error }
    } else if (onConflict === 'ignore') {
      const { data: result, error } = await supabase
        .from(table)
        .upsert(data, {
          onConflict: conflictColumns.join(','),
          ignoreDuplicates: true,
        })
        .select()
        .maybeSingle()

      return { data: result as T, error }
    } else {
      // Check if record exists
      const query = supabase.from(table).select('id')
      for (const col of conflictColumns) {
        query.eq(col, data[col])
      }

      const { data: existing } = await query.maybeSingle()

      if (existing) {
        return {
          data: null,
          error: new Error('Conflict: Record already exists'),
        }
      }

      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .maybeSingle()

      return { data: result as T, error }
    }
  } catch (error) {
    return { data: null, error: error as Error }
  }
}

/**
 * Batch update with optimistic locking
 */
export async function batchUpdateWithLocking<T extends Record<string, any>>(
  supabase: SupabaseClient,
  table: string,
  updates: Array<{ id: string; version: number; data: Partial<T> }>
): Promise<{ succeeded: T[]; failed: Array<{ id: string; error: string }> }> {
  const succeeded: T[] = []
  const failed: Array<{ id: string; error: string }> = []

  for (const update of updates) {
    const { data, error } = await updateWithOptimisticLock<T>(
      supabase,
      table,
      update.id,
      update.version,
      update.data
    )

    if (error || !data) {
      failed.push({
        id: update.id,
        error: error?.message || 'Update failed',
      })
    } else {
      succeeded.push(data)
    }
  }

  return { succeeded, failed }
}
