/**
 * Progress Tracking Service for Incentives
 * Syncs progress from CRM/Leads module and updates incentive allocations
 *
 * Features:
 * - Real-time progress sync from leads/deals
 * - Webhook-based progress updates
 * - Manual progress updates via API
 * - Automatic eligibility calculation
 * - Progress history tracking
 */

import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'

export interface ProgressUpdate {
  userId: string
  incentiveId: string
  metricType: string
  currentValue: number
  targetValue: number
  timestamp?: Date
  source: 'manual' | 'webhook' | 'sync' | 'calculated'
  metadata?: Record<string, any>
}

export interface ProgressCalculation {
  progressPercentage: number
  earnedAmount: number
  isEligible: boolean
  meetsThreshold: boolean
  remainingToTarget: number
}

/**
 * Calculate progress and earned amount based on incentive criteria
 */
export async function calculateProgress(
  supabase: SupabaseClient,
  allocationId: string,
  currentValue: number
): Promise<ProgressCalculation> {
  // Get allocation with incentive details
  const { data: allocation, error } = await supabase
    .from('incentive_allocations')
    .select(`
      *,
      incentive:incentives (
        reward_amount,
        reward_percentage,
        reward_type,
        performance_criteria,
        eligibility_criteria
      )
    `)
    .eq('id', allocationId)
    .maybeSingle()

  if (error || !allocation) {
    throw new Error(`Failed to fetch allocation: ${error?.message}`)
  }

  const incentive = allocation.incentive as any
  const criteria = incentive.performance_criteria || {}
  const eligibilityCriteria = incentive.eligibility_criteria || {}

  const targetValue = criteria.target_value || 100
  const thresholdPercentage = eligibilityCriteria.minimum_achievement_percentage || 0

  // Calculate progress percentage
  const progressPercentage = Math.min((currentValue / targetValue) * 100, 100)

  // Check if meets threshold
  const meetsThreshold = progressPercentage >= thresholdPercentage

  // Calculate earned amount based on reward type
  let earnedAmount = 0

  if (incentive.reward_type === 'monetary') {
    if (criteria.reward_calculation === 'proportional') {
      // Proportional to achievement
      earnedAmount = (incentive.reward_amount * progressPercentage) / 100
    } else if (criteria.reward_calculation === 'tiered') {
      // Tiered rewards
      const tiers = criteria.reward_tiers || []
      for (const tier of tiers) {
        if (progressPercentage >= tier.min_percentage && progressPercentage <= tier.max_percentage) {
          earnedAmount = tier.amount
          break
        }
      }
    } else {
      // All-or-nothing (default)
      earnedAmount = progressPercentage >= 100 ? incentive.reward_amount : 0
    }
  } else if (incentive.reward_type === 'percentage') {
    // Calculate based on base salary or revenue
    const baseAmount = allocation.current_progress?.base_amount || 0
    earnedAmount = (baseAmount * incentive.reward_percentage) / 100
  }

  // Check eligibility
  const isEligible = meetsThreshold

  return {
    progressPercentage: Math.round(progressPercentage * 100) / 100,
    earnedAmount: Math.round(earnedAmount * 100) / 100,
    isEligible,
    meetsThreshold,
    remainingToTarget: Math.max(targetValue - currentValue, 0)
  }
}

/**
 * Update progress for a specific allocation
 */
export async function updateProgress(
  update: ProgressUpdate
): Promise<void> {
  const supabase = await createClient()

  // Get the allocation
  const { data: allocation, error: fetchError } = await supabase
    .from('incentive_allocations')
    .select('*')
    .eq('incentive_id', update.incentiveId)
    .eq('user_id', update.userId)
    .maybeSingle()

  if (fetchError || !allocation) {
    throw new Error(`Allocation not found: ${fetchError?.message}`)
  }

  // Calculate progress
  const calculation = await calculateProgress(supabase, allocation.id, update.currentValue)

  // Update current_progress JSONB
  const updatedProgress = {
    ...allocation.current_progress,
    metric_value: update.currentValue,
    target_value: update.targetValue,
    metric_type: update.metricType,
    last_updated: update.timestamp?.toISOString() || new Date().toISOString(),
    source: update.source,
    metadata: update.metadata
  }

  // Update allocation
  const { error: updateError } = await supabase
    .from('incentive_allocations')
    .update({
      progress_percentage: calculation.progressPercentage,
      earned_amount: calculation.earnedAmount,
      is_eligible: calculation.isEligible,
      current_progress: updatedProgress,
      updated_at: new Date().toISOString()
    })
    .eq('id', allocation.id)

  if (updateError) {
    throw new Error(`Failed to update progress: ${updateError.message}`)
  }

  // Log progress update
  await logProgressUpdate(supabase, allocation.id, update, calculation)
}

/**
 * Sync progress from leads/deals for all active allocations
 */
export async function syncProgressFromLeads(userId?: string): Promise<number> {
  const supabase = await createClient()

  // Get active allocations
  let query = supabase
    .from('incentive_allocations')
    .select(`
      *,
      incentive:incentives (
        performance_criteria,
        status
      )
    `)
    .eq('incentive.status', 'active')
    .eq('allocation_status', 'eligible')

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data: allocations, error } = await query

  if (error || !allocations) {
    throw new Error(`Failed to fetch allocations: ${error?.message}`)
  }

  let updatedCount = 0

  for (const allocation of allocations) {
    const incentive = allocation.incentive as any
    const criteria = incentive.performance_criteria || {}
    const metricType = criteria.metric_type

    try {
      // Get current metric value from leads/deals
      const currentValue = await getMetricValueFromLeads(
        supabase,
        allocation.user_id,
        metricType,
        criteria
      )

      if (currentValue !== null) {
        await updateProgress({
          userId: allocation.user_id,
          incentiveId: allocation.incentive_id,
          metricType,
          currentValue,
          targetValue: criteria.target_value || 100,
          source: 'sync'
        })
        updatedCount++
      }
    } catch (err) {
      console.error(`Failed to sync progress for allocation ${allocation.id}:`, err)
    }
  }

  return updatedCount
}

/**
 * Get metric value from leads/deals based on metric type
 */
async function getMetricValueFromLeads(
  supabase: SupabaseClient,
  userId: string,
  metricType: string,
  criteria: any
): Promise<number | null> {
  const measurementPeriod = criteria.measurement_period || 'monthly'
  const startDate = getStartDateForPeriod(measurementPeriod)

  switch (metricType) {
    case 'leads_converted':
      return await getLeadsConverted(supabase, userId, startDate)

    case 'deals_closed':
      return await getDealsCount(supabase, userId, startDate, ['WON', 'CLOSED'])

    case 'revenue_generated':
      return await getRevenue(supabase, userId, startDate)

    case 'leads_created':
      return await getLeadsCount(supabase, userId, startDate)

    case 'calls_completed':
      return await getCallsCount(supabase, userId, startDate)

    case 'meetings_scheduled':
      return await getMeetingsCount(supabase, userId, startDate)

    case 'forms_completed':
      return await getFormsCompleted(supabase, userId, startDate)

    default:
      console.warn(`Unknown metric type: ${metricType}`)
      return null
  }
}

/**
 * Helper functions to get specific metrics
 */
async function getLeadsConverted(supabase: SupabaseClient, userId: string, startDate: Date): Promise<number> {
  const { count } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_to', userId)
    .in('status', ['CONVERTED', 'WON', 'CLOSED'])
    .gte('converted_at', startDate.toISOString())

  return count || 0
}

async function getDealsCount(supabase: SupabaseClient, userId: string, startDate: Date, statuses: string[]): Promise<number> {
  const { count } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .in('status', statuses)
    .gte('closed_at', startDate.toISOString())

  return count || 0
}

async function getRevenue(supabase: SupabaseClient, userId: string, startDate: Date): Promise<number> {
  const { data } = await supabase
    .from('deals')
    .select('deal_value')
    .eq('owner_id', userId)
    .in('status', ['WON', 'CLOSED'])
    .gte('closed_at', startDate.toISOString())

  return data?.reduce((sum, deal) => sum + (deal.deal_value || 0), 0) || 0
}

async function getLeadsCount(supabase: SupabaseClient, userId: string, startDate: Date): Promise<number> {
  const { count } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', userId)
    .gte('created_at', startDate.toISOString())

  return count || 0
}

async function getCallsCount(supabase: SupabaseClient, userId: string, startDate: Date): Promise<number> {
  const { count } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('activity_type', 'CALL')
    .eq('status', 'COMPLETED')
    .gte('completed_at', startDate.toISOString())

  return count || 0
}

async function getMeetingsCount(supabase: SupabaseClient, userId: string, startDate: Date): Promise<number> {
  const { count } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('activity_type', 'MEETING')
    .eq('status', 'COMPLETED')
    .gte('completed_at', startDate.toISOString())

  return count || 0
}

async function getFormsCompleted(supabase: SupabaseClient, userId: string, startDate: Date): Promise<number> {
  const { count } = await supabase
    .from('form_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('submitted_by', userId)
    .eq('status', 'COMPLETED')
    .gte('submitted_at', startDate.toISOString())

  return count || 0
}

/**
 * Get start date based on measurement period
 */
function getStartDateForPeriod(period: string): Date {
  const now = new Date()

  switch (period) {
    case 'daily':
      return new Date(now.setHours(0, 0, 0, 0))

    case 'weekly':
      const dayOfWeek = now.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      return new Date(now.setDate(now.getDate() - daysToMonday))

    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1)

    case 'quarterly':
      const quarter = Math.floor(now.getMonth() / 3)
      return new Date(now.getFullYear(), quarter * 3, 1)

    case 'yearly':
      return new Date(now.getFullYear(), 0, 1)

    default:
      return new Date(now.getFullYear(), now.getMonth(), 1)
  }
}

/**
 * Log progress update for audit trail
 */
async function logProgressUpdate(
  supabase: SupabaseClient,
  allocationId: string,
  update: ProgressUpdate,
  calculation: ProgressCalculation
): Promise<void> {
  // Get previous value from the most recent progress history record
  const { data: lastRecord } = await supabase
    .from('progress_history')
    .select('new_value')
    .eq('allocation_id', allocationId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  await supabase.from('progress_history').insert({
    allocation_id: allocationId,
    metric_type: update.metricType,
    previous_value: lastRecord?.new_value ?? 0,
    new_value: update.currentValue,
    progress_percentage: calculation.progressPercentage,
    earned_amount: calculation.earnedAmount,
    update_source: update.source,
    updated_at: update.timestamp?.toISOString() || new Date().toISOString(),
    metadata: update.metadata
  })
}

/**
 * Bulk update progress for multiple users
 */
export async function bulkUpdateProgress(updates: ProgressUpdate[]): Promise<number> {
  let successCount = 0

  for (const update of updates) {
    try {
      await updateProgress(update)
      successCount++
    } catch (err) {
      console.error('Failed to update progress:', err)
    }
  }

  return successCount
}
