/**
 * Transaction Handler for Supabase
 * Provides transaction-like behavior for related operations
 */

import { SupabaseClient } from '@supabase/supabase-js'
import logger from '@/lib/monitoring/logger'

// =====================================================
// TYPES
// =====================================================

export interface TransactionResult<T> {
  success: boolean
  data?: T
  error?: Error
  rollbackExecuted?: boolean
}

export interface TransactionStep {
  name: string
  execute: () => Promise<unknown>
  rollback?: () => Promise<unknown>
}

// =====================================================
// TRANSACTION HANDLER
// =====================================================

export class TransactionHandler {
  private steps: TransactionStep[] = []
  private executedSteps: { name: string; result: any }[] = []
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  /**
   * Add a step to the transaction
   */
  addStep(step: TransactionStep): this {
    this.steps.push(step)
    return this
  }

  /**
   * Execute all steps in sequence with automatic rollback on failure
   */
  async execute<T = any>(): Promise<TransactionResult<T>> {
    try {
      // Execute each step in sequence
      for (const step of this.steps) {
        logger.info(`Executing transaction step: ${step.name}`)

        try {
          const result = await step.execute()
          this.executedSteps.push({ name: step.name, result })
          logger.info(`Transaction step completed: ${step.name}`)
        } catch (stepError) {
          logger.error(`Transaction step failed: ${step.name}`, stepError as Error)

          // Rollback all executed steps
          await this.rollback()

          return {
            success: false,
            error: stepError as Error,
            rollbackExecuted: true,
          }
        }
      }

      // All steps completed successfully
      const finalResult = this.executedSteps[this.executedSteps.length - 1]?.result

      return {
        success: true,
        data: finalResult as T,
      }
    } catch (error) {
      logger.error('Transaction execution failed', error as Error)
      await this.rollback()

      return {
        success: false,
        error: error as Error,
        rollbackExecuted: true,
      }
    }
  }

  /**
   * Rollback executed steps in reverse order
   */
  private async rollback(): Promise<void> {
    logger.warn('Rolling back transaction...')

    // Rollback in reverse order
    for (let i = this.executedSteps.length - 1; i >= 0; i--) {
      const executedStep = this.executedSteps[i]
      const step = this.steps.find(s => s.name === executedStep.name)

      if (step?.rollback) {
        try {
          logger.info(`Rolling back step: ${step.name}`)
          await step.rollback()
          logger.info(`Rollback completed: ${step.name}`)
        } catch (rollbackError) {
          logger.error(`Rollback failed for step: ${step.name}`, rollbackError as Error)
          // Continue rolling back other steps
        }
      }
    }

    logger.warn('Transaction rollback completed')
  }

  /**
   * Clear all steps and executed steps
   */
  clear(): void {
    this.steps = []
    this.executedSteps = []
  }
}

// =====================================================
// COMMON TRANSACTION PATTERNS
// =====================================================

/**
 * Create incentive with allocations in a transaction
 */
export async function createIncentiveWithAllocations(
  supabase: SupabaseClient,
  incentiveData: any,
  targetSubroles: string[],
  budgetId?: string,
  budgetAmount?: number
): Promise<TransactionResult<any>> {
  const transaction = new TransactionHandler(supabase)

  let incentiveId: string
  let budgetAllocationId: string | null = null

  // Step 1: Create incentive
  transaction.addStep({
    name: 'create_incentive',
    execute: async () => {
      const { data, error } = await supabase
        .from('incentives')
        .insert(incentiveData)
        .select()
        .maybeSingle()

      if (error) throw error
      incentiveId = data.id
      return data
    },
    rollback: async () => {
      if (incentiveId) {
        await supabase.from('incentives').delete().eq('id', incentiveId)
      }
    },
  })

  // Step 2: Create target audiences
  if (targetSubroles.length > 0) {
    transaction.addStep({
      name: 'create_target_audiences',
      execute: async () => {
        const audiences = targetSubroles.map(subroleId => ({
          incentive_id: incentiveId,
          subrole_id: subroleId,
        }))

        const { error } = await supabase
          .from('incentive_target_audience')
          .insert(audiences)

        if (error) throw error
        return audiences
      },
      rollback: async () => {
        if (incentiveId) {
          await supabase
            .from('incentive_target_audience')
            .delete()
            .eq('incentive_id', incentiveId)
        }
      },
    })
  }

  // Step 3: Allocate budget (if provided)
  if (budgetId && budgetAmount) {
    transaction.addStep({
      name: 'allocate_budget',
      execute: async () => {
        const { data, error } = await supabase.rpc('allocate_budget_to_incentive', {
          p_incentive_id: incentiveId,
          p_budget_id: budgetId,
          p_amount: budgetAmount,
        })

        if (error) throw error
        budgetAllocationId = data
        return data
      },
      rollback: async () => {
        if (budgetAllocationId) {
          await supabase
            .from('incentive_budget_allocations')
            .delete()
            .eq('id', budgetAllocationId)

          // Restore budget allocation
          if (budgetAmount) {
            await supabase.rpc('exec_sql', {
              sql: `UPDATE incentive_budgets
                    SET allocated_amount = allocated_amount - ${budgetAmount}
                    WHERE id = '${budgetId}'`
            })
          }
        }
      },
    })
  }

  // Step 4: Create allocations for eligible users
  transaction.addStep({
    name: 'create_user_allocations',
    execute: async () => {
      // This would call the existing createIncentiveAllocations function
      // For now, returning success
      return { success: true }
    },
    rollback: async () => {
      if (incentiveId) {
        await supabase
          .from('incentive_allocations')
          .delete()
          .eq('incentive_id', incentiveId)
      }
    },
  })

  return await transaction.execute()
}

/**
 * Process claim with TDS deduction in a transaction
 */
export async function processClaimWithTDS(
  supabase: SupabaseClient,
  claimId: string,
  approvalData: any
): Promise<TransactionResult<any>> {
  const transaction = new TransactionHandler(supabase)

  let tdsDeductionId: string | null = null
  let journalEntryId: string | null = null

  // Step 1: Update claim status
  transaction.addStep({
    name: 'update_claim_status',
    execute: async () => {
      const { data, error } = await supabase
        .from('incentive_claims')
        .update(approvalData)
        .eq('id', claimId)
        .select()
        .maybeSingle()

      if (error) throw error
      return data
    },
    rollback: async () => {
      // Revert claim to previous status
      await supabase
        .from('incentive_claims')
        .update({ claim_status: 'pending' })
        .eq('id', claimId)
    },
  })

  // Step 2: Create TDS deduction
  if (approvalData.claim_status === 'paid') {
    transaction.addStep({
      name: 'create_tds_deduction',
      execute: async () => {
        const { data, error } = await supabase.rpc('create_tds_deduction_for_claim', {
          p_claim_id: claimId,
        })

        if (error) throw error
        tdsDeductionId = data
        return data
      },
      rollback: async () => {
        if (tdsDeductionId) {
          await supabase
            .from('incentive_tds_deductions')
            .delete()
            .eq('id', tdsDeductionId)
        }
      },
    })

    // Step 3: Create journal entry
    transaction.addStep({
      name: 'create_journal_entry',
      execute: async () => {
        const claim = await supabase
          .from('incentive_claims')
          .select('*, incentive:incentives(*)')
          .eq('id', claimId)
          .maybeSingle()

        const entryNumber = `JE-${Date.now()}`

        const { data, error } = await supabase
          .from('incentive_journal_entries')
          .insert({
            entry_number: entryNumber,
            entry_date: new Date().toISOString().split('T')[0],
            entry_type: 'payment',
            claim_id: claimId,
            debit_account: '50000', // Employee Benefits Expense
            credit_account: '20000', // Cash/Bank
            amount: claim.data?.claimed_amount,
            description: `Incentive payment: ${claim.data?.incentive?.incentive_title}`,
            post_status: 'posted',
            posted_at: new Date().toISOString(),
            posted_by: approvalData.reviewed_by,
          })
          .select()
          .maybeSingle()

        if (error) throw error
        journalEntryId = data.id
        return data
      },
      rollback: async () => {
        if (journalEntryId) {
          await supabase
            .from('incentive_journal_entries')
            .delete()
            .eq('id', journalEntryId)
        }
      },
    })
  }

  return await transaction.execute()
}

/**
 * Update incentive with workflow initiation
 */
export async function updateIncentiveWithWorkflow(
  supabase: SupabaseClient,
  incentiveId: string,
  updates: any,
  initiateWorkflow: boolean = false
): Promise<TransactionResult<any>> {
  const transaction = new TransactionHandler(supabase)

  let workflowId: string | null = null
  let previousData: any = null

  // Step 1: Get previous data for rollback
  transaction.addStep({
    name: 'fetch_previous_data',
    execute: async () => {
      const { data, error } = await supabase
        .from('incentives')
        .select('*')
        .eq('id', incentiveId)
        .maybeSingle()

      if (error) throw error
      previousData = data
      return data
    },
  })

  // Step 2: Update incentive
  transaction.addStep({
    name: 'update_incentive',
    execute: async () => {
      const { data, error } = await supabase
        .from('incentives')
        .update(updates)
        .eq('id', incentiveId)
        .select()
        .maybeSingle()

      if (error) throw error
      return data
    },
    rollback: async () => {
      if (previousData) {
        await supabase
          .from('incentives')
          .update(previousData)
          .eq('id', incentiveId)
      }
    },
  })

  // Step 3: Initiate workflow if requested
  if (initiateWorkflow) {
    transaction.addStep({
      name: 'initiate_workflow',
      execute: async () => {
        const { data, error } = await supabase.rpc('initiate_workflow', {
          p_entity_type: 'incentive',
          p_entity_id: incentiveId,
          p_initiated_by: updates.updated_by,
        })

        if (error) throw error
        workflowId = data
        return data
      },
      rollback: async () => {
        if (workflowId) {
          await supabase
            .from('incentive_workflow_instances')
            .update({ workflow_status: 'cancelled' })
            .eq('id', workflowId)
        }
      },
    })
  }

  return await transaction.execute()
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Execute multiple operations with automatic rollback
 */
export async function executeWithRollback<T>(
  operations: Array<{
    name: string
    execute: () => Promise<unknown>
    rollback?: () => Promise<unknown>
  }>
): Promise<TransactionResult<T>> {
  const executedOps: Array<{ name: string; result: any }> = []

  try {
    for (const op of operations) {
      const result = await op.execute()
      executedOps.push({ name: op.name, result })
    }

    return {
      success: true,
      data: executedOps[executedOps.length - 1]?.result as T,
    }
  } catch (error) {
    // Rollback in reverse order
    for (let i = executedOps.length - 1; i >= 0; i--) {
      const executedOp = executedOps[i]
      const op = operations.find(o => o.name === executedOp.name)

      if (op?.rollback) {
        try {
          await op.rollback()
        } catch (rollbackError) {
          logger.error(`Rollback failed for ${op.name}`, rollbackError as Error)
        }
      }
    }

    return {
      success: false,
      error: error as Error,
      rollbackExecuted: true,
    }
  }
}
