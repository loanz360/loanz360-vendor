/**
 * Enterprise Credit Management Service
 * Fortune 500 Grade Implementation
 *
 * Features:
 * - Real-time credit balance tracking
 * - Credit reservation and release
 * - Transaction logging
 * - Low balance alerts
 * - Provider-specific credit tracking
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'

// =====================================================
// TYPES
// =====================================================

export type CreditType = 'sms' | 'email' | 'whatsapp'
export type TransactionType = 'purchase' | 'usage' | 'refund' | 'adjustment' | 'expiry' | 'reserve' | 'release'

export interface CreditBalance {
  providerId: string
  providerName: string
  creditType: CreditType
  totalCredits: number
  usedCredits: number
  reservedCredits: number
  availableCredits: number
  costPerUnit: number
  currency: string
  lowBalanceThreshold: number
  criticalBalanceThreshold: number
  isLowBalance: boolean
  isCriticalBalance: boolean
  lastSyncedAt: Date | null
  expiresAt: Date | null
}

export interface CreditTransaction {
  id: string
  creditId: string
  transactionType: TransactionType
  amount: number
  balanceBefore: number
  balanceAfter: number
  referenceType?: string
  referenceId?: string
  description?: string
  performedBy?: string
  createdAt: Date
}

export interface DeductCreditResult {
  success: boolean
  newBalance?: number
  transactionId?: string
  error?: string
}

// =====================================================
// CREDIT SERVICE CLASS
// =====================================================

class CreditService {
  private static instance: CreditService

  private constructor() {}

  static getInstance(): CreditService {
    if (!CreditService.instance) {
      CreditService.instance = new CreditService()
    }
    return CreditService.instance
  }

  // =====================================================
  // BALANCE QUERIES
  // =====================================================

  /**
   * Get credit balance for a provider
   */
  async getBalance(providerId: string, creditType: CreditType): Promise<CreditBalance | null> {
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('communication_credits')
      .select(`
        *,
        provider:provider_id (
          id,
          name
        )
      `)
      .eq('provider_id', providerId)
      .eq('credit_type', creditType)
      .maybeSingle()

    if (error || !data) {
      console.error('[CreditService] Failed to get balance:', error)
      return null
    }

    const available = data.total_credits - data.used_credits - data.reserved_credits

    return {
      providerId: data.provider_id,
      providerName: data.provider?.name || 'Unknown',
      creditType: data.credit_type,
      totalCredits: data.total_credits,
      usedCredits: data.used_credits,
      reservedCredits: data.reserved_credits,
      availableCredits: available,
      costPerUnit: data.cost_per_unit,
      currency: data.currency,
      lowBalanceThreshold: data.low_balance_threshold,
      criticalBalanceThreshold: data.critical_balance_threshold,
      isLowBalance: available <= data.low_balance_threshold,
      isCriticalBalance: available <= data.critical_balance_threshold,
      lastSyncedAt: data.last_synced_at ? new Date(data.last_synced_at) : null,
      expiresAt: data.expires_at ? new Date(data.expires_at) : null
    }
  }

  /**
   * Get all credit balances
   */
  async getAllBalances(): Promise<CreditBalance[]> {
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('communication_credits')
      .select(`
        *,
        provider:provider_id (
          id,
          name
        )
      `)
      .order('credit_type')

    if (error || !data) {
      console.error('[CreditService] Failed to get balances:', error)
      return []
    }

    return data.map(credit => {
      const available = credit.total_credits - credit.used_credits - credit.reserved_credits
      return {
        providerId: credit.provider_id,
        providerName: credit.provider?.name || 'Unknown',
        creditType: credit.credit_type,
        totalCredits: credit.total_credits,
        usedCredits: credit.used_credits,
        reservedCredits: credit.reserved_credits,
        availableCredits: available,
        costPerUnit: credit.cost_per_unit,
        currency: credit.currency,
        lowBalanceThreshold: credit.low_balance_threshold,
        criticalBalanceThreshold: credit.critical_balance_threshold,
        isLowBalance: available <= credit.low_balance_threshold,
        isCriticalBalance: available <= credit.critical_balance_threshold,
        lastSyncedAt: credit.last_synced_at ? new Date(credit.last_synced_at) : null,
        expiresAt: credit.expires_at ? new Date(credit.expires_at) : null
      }
    })
  }

  /**
   * Check if sufficient credits are available
   */
  async hasCredits(providerId: string, creditType: CreditType, amount: number): Promise<boolean> {
    const balance = await this.getBalance(providerId, creditType)
    return balance !== null && balance.availableCredits >= amount
  }

  // =====================================================
  // CREDIT OPERATIONS
  // =====================================================

  /**
   * Deduct credits for a message
   */
  async deductCredits(
    providerId: string,
    creditType: CreditType,
    amount: number,
    referenceType: string,
    referenceId: string,
    userId?: string
  ): Promise<DeductCreditResult> {
    const supabase = createSupabaseAdmin()

    try {
      // Get current balance
      const { data: credit, error: creditError } = await supabase
        .from('communication_credits')
        .select('id, total_credits, used_credits, reserved_credits')
        .eq('provider_id', providerId)
        .eq('credit_type', creditType)
        .maybeSingle()

      if (creditError || !credit) {
        return { success: false, error: 'Credit record not found' }
      }

      const available = credit.total_credits - credit.used_credits - credit.reserved_credits

      if (available < amount) {
        return { success: false, error: 'Insufficient credits' }
      }

      const balanceBefore = available
      const balanceAfter = available - amount

      // Update credits
      const { error: updateError } = await supabase
        .from('communication_credits')
        .update({
          used_credits: credit.used_credits + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', credit.id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Log transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          credit_id: credit.id,
          transaction_type: 'usage',
          amount: amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_type: referenceType,
          reference_id: referenceId,
          description: `Deducted ${amount} credits for ${referenceType}`,
          performed_by: userId
        })
        .select('id')
        .maybeSingle()

      if (transactionError) {
        console.error('[CreditService] Failed to log transaction:', transactionError)
      }

      // Check for low balance alert
      if (balanceAfter <= credit.low_balance_threshold) {
        await this.sendLowBalanceAlert(providerId, creditType, balanceAfter)
      }

      return {
        success: true,
        newBalance: balanceAfter,
        transactionId: transaction?.id
      }
    } catch (error: unknown) {
      console.error('[CreditService] Deduct error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Reserve credits for pending messages
   */
  async reserveCredits(
    providerId: string,
    creditType: CreditType,
    amount: number,
    referenceId: string
  ): Promise<DeductCreditResult> {
    const supabase = createSupabaseAdmin()

    try {
      const { data: credit, error: creditError } = await supabase
        .from('communication_credits')
        .select('id, total_credits, used_credits, reserved_credits')
        .eq('provider_id', providerId)
        .eq('credit_type', creditType)
        .maybeSingle()

      if (creditError || !credit) {
        return { success: false, error: 'Credit record not found' }
      }

      const available = credit.total_credits - credit.used_credits - credit.reserved_credits

      if (available < amount) {
        return { success: false, error: 'Insufficient credits' }
      }

      // Update reserved credits
      const { error: updateError } = await supabase
        .from('communication_credits')
        .update({
          reserved_credits: credit.reserved_credits + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', credit.id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Log transaction
      await supabase
        .from('credit_transactions')
        .insert({
          credit_id: credit.id,
          transaction_type: 'reserve',
          amount: amount,
          balance_before: available,
          balance_after: available - amount,
          reference_type: 'reservation',
          reference_id: referenceId,
          description: `Reserved ${amount} credits`
        })

      return {
        success: true,
        newBalance: available - amount
      }
    } catch (error: unknown) {
      console.error('[CreditService] Reserve error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Release reserved credits
   */
  async releaseCredits(
    providerId: string,
    creditType: CreditType,
    amount: number,
    referenceId: string
  ): Promise<DeductCreditResult> {
    const supabase = createSupabaseAdmin()

    try {
      const { data: credit, error: creditError } = await supabase
        .from('communication_credits')
        .select('id, reserved_credits')
        .eq('provider_id', providerId)
        .eq('credit_type', creditType)
        .maybeSingle()

      if (creditError || !credit) {
        return { success: false, error: 'Credit record not found' }
      }

      // Update reserved credits
      const { error: updateError } = await supabase
        .from('communication_credits')
        .update({
          reserved_credits: Math.max(0, credit.reserved_credits - amount),
          updated_at: new Date().toISOString()
        })
        .eq('id', credit.id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Log transaction
      await supabase
        .from('credit_transactions')
        .insert({
          credit_id: credit.id,
          transaction_type: 'release',
          amount: amount,
          balance_before: 0, // N/A for release
          balance_after: 0,
          reference_type: 'release',
          reference_id: referenceId,
          description: `Released ${amount} reserved credits`
        })

      return { success: true }
    } catch (error: unknown) {
      console.error('[CreditService] Release error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Add credits (purchase or refund)
   */
  async addCredits(
    providerId: string,
    creditType: CreditType,
    amount: number,
    transactionType: 'purchase' | 'refund' | 'adjustment',
    description: string,
    userId?: string
  ): Promise<DeductCreditResult> {
    const supabase = createSupabaseAdmin()

    try {
      const { data: credit, error: creditError } = await supabase
        .from('communication_credits')
        .select('id, total_credits, used_credits, reserved_credits')
        .eq('provider_id', providerId)
        .eq('credit_type', creditType)
        .maybeSingle()

      if (creditError || !credit) {
        // Create new credit record
        const { data: newCredit, error: createError } = await supabase
          .from('communication_credits')
          .insert({
            provider_id: providerId,
            credit_type: creditType,
            total_credits: amount,
            used_credits: 0,
            reserved_credits: 0,
            cost_per_unit: 0,
            currency: 'INR'
          })
          .select('id')
          .maybeSingle()

        if (createError) {
          return { success: false, error: createError.message }
        }

        return { success: true, newBalance: amount, transactionId: newCredit?.id }
      }

      const balanceBefore = credit.total_credits - credit.used_credits - credit.reserved_credits
      const balanceAfter = balanceBefore + amount

      // Update credits
      const { error: updateError } = await supabase
        .from('communication_credits')
        .update({
          total_credits: credit.total_credits + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', credit.id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Log transaction
      const { data: transaction } = await supabase
        .from('credit_transactions')
        .insert({
          credit_id: credit.id,
          transaction_type: transactionType,
          amount: amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: description,
          performed_by: userId
        })
        .select('id')
        .maybeSingle()

      return {
        success: true,
        newBalance: balanceAfter,
        transactionId: transaction?.id
      }
    } catch (error: unknown) {
      console.error('[CreditService] Add credits error:', error)
      return { success: false, error: error.message }
    }
  }

  // =====================================================
  // TRANSACTION HISTORY
  // =====================================================

  /**
   * Get transaction history
   */
  async getTransactions(
    providerId?: string,
    creditType?: CreditType,
    limit = 100,
    offset = 0
  ): Promise<CreditTransaction[]> {
    const supabase = createSupabaseAdmin()

    let query = supabase
      .from('credit_transactions')
      .select(`
        *,
        credit:credit_id (
          provider_id,
          credit_type
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (providerId) {
      query = query.eq('credit.provider_id', providerId)
    }

    if (creditType) {
      query = query.eq('credit.credit_type', creditType)
    }

    const { data, error } = await query

    if (error) {
      console.error('[CreditService] Failed to get transactions:', error)
      return []
    }

    return (data || []).map(t => ({
      id: t.id,
      creditId: t.credit_id,
      transactionType: t.transaction_type,
      amount: t.amount,
      balanceBefore: t.balance_before,
      balanceAfter: t.balance_after,
      referenceType: t.reference_type,
      referenceId: t.reference_id,
      description: t.description,
      performedBy: t.performed_by,
      createdAt: new Date(t.created_at)
    }))
  }

  // =====================================================
  // ALERTS
  // =====================================================

  /**
   * Send low balance alert
   */
  private async sendLowBalanceAlert(
    providerId: string,
    creditType: CreditType,
    balance: number
  ): Promise<void> {
    console.warn(`[CreditService] Low balance alert: Provider ${providerId}, Type ${creditType}, Balance ${balance}`)

    // TODO: Implement notification (email/webhook) for low balance alerts
    // This could trigger an internal notification or external webhook
  }

  /**
   * Get low balance providers
   */
  async getLowBalanceProviders(): Promise<CreditBalance[]> {
    const balances = await this.getAllBalances()
    return balances.filter(b => b.isLowBalance)
  }

  // =====================================================
  // SYNC WITH PROVIDERS
  // =====================================================

  /**
   * Sync credits with external provider API
   */
  async syncWithProvider(providerId: string, creditType: CreditType): Promise<boolean> {
    const supabase = createSupabaseAdmin()

    try {
      // TODO: Implement actual API calls to provider to get balance
      // For now, just update the sync timestamp

      const { error } = await supabase
        .from('communication_credits')
        .update({
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('provider_id', providerId)
        .eq('credit_type', creditType)

      if (error) {
        console.error('[CreditService] Sync failed:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('[CreditService] Sync error:', error)
      return false
    }
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const creditService = CreditService.getInstance()

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

export async function checkAndDeductCredits(
  providerId: string,
  creditType: CreditType,
  amount: number,
  referenceType: string,
  referenceId: string
): Promise<boolean> {
  const result = await creditService.deductCredits(
    providerId,
    creditType,
    amount,
    referenceType,
    referenceId
  )
  return result.success
}

export async function getAvailableCredits(
  providerId: string,
  creditType: CreditType
): Promise<number> {
  const balance = await creditService.getBalance(providerId, creditType)
  return balance?.availableCredits || 0
}
