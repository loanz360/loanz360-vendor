/**
 * Deal Assignment Service
 * Handles automatic and manual assignment of deals to BDEs
 * Based on loan type, location, capacity, and round-robin logic
 */

import { createClient } from '@/lib/supabase/server'
import type { BDEAssignmentConfig, DealAssignmentResult } from '@/types/ai-crm'

export interface AssignmentCriteria {
  loanType: string
  location?: string
  loanAmount?: number
}

export interface BDECandidate {
  bde_id: string
  bde_name: string
  loan_types: string[]
  locations: string[]
  current_active_deals: number
  max_active_deals: number
  priority_weight: number
  success_rate?: number
  loan_type_match: boolean
  location_match: boolean
  capacity_available: boolean
}

/**
 * Find the best BDE to assign a deal based on criteria
 */
export async function findBestBDEForDeal(
  criteria: AssignmentCriteria
): Promise<DealAssignmentResult> {
  try {
    const supabase = await createClient()

    // Fetch all active BDE configurations
    const { data: bdeConfigs, error: configError } = await supabase
      .from('bde_assignment_config')
      .select(`
        id,
        bde_id,
        loan_types,
        locations,
        min_loan_amount,
        max_loan_amount,
        max_active_deals,
        current_active_deals,
        priority_weight,
        auto_assign_enabled,
        is_active,
        is_on_leave,
        success_rate
      `)
      .eq('is_active', true)
      .eq('is_on_leave', false)
      .eq('auto_assign_enabled', true)

    if (configError) {
      console.error('Error fetching BDE configs:', configError)
      return {
        success: false,
        deal_id: '',
        error: 'Failed to fetch BDE configurations'
      }
    }

    if (!bdeConfigs || bdeConfigs.length === 0) {
      return {
        success: false,
        deal_id: '',
        error: 'No BDEs available for assignment'
      }
    }

    // Fetch BDE names
    const bdeIds = bdeConfigs.map(c => c.bde_id)
    const { data: bdeUsers } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', bdeIds)

    const bdeNameMap = new Map(bdeUsers?.map(u => [u.id, u.full_name]) || [])

    // Score each BDE candidate
    const candidates: BDECandidate[] = bdeConfigs
      .filter(config => {
        // Check capacity
        if (config.current_active_deals >= config.max_active_deals) {
          return false
        }

        // Check loan amount range if specified
        if (criteria.loanAmount) {
          if (config.min_loan_amount && criteria.loanAmount < config.min_loan_amount) {
            return false
          }
          if (config.max_loan_amount && criteria.loanAmount > config.max_loan_amount) {
            return false
          }
        }

        return true
      })
      .map(config => {
        // Check loan type match
        const loanTypeMatch = config.loan_types.length === 0 ||
          config.loan_types.some(lt =>
            lt.toLowerCase() === criteria.loanType.toLowerCase() ||
            criteria.loanType.toLowerCase().includes(lt.toLowerCase())
          )

        // Check location match
        const locationMatch = !criteria.location ||
          config.locations.length === 0 ||
          config.locations.some(loc =>
            loc.toLowerCase() === criteria.location?.toLowerCase() ||
            criteria.location?.toLowerCase().includes(loc.toLowerCase())
          )

        return {
          bde_id: config.bde_id,
          bde_name: bdeNameMap.get(config.bde_id) || 'Unknown',
          loan_types: config.loan_types || [],
          locations: config.locations || [],
          current_active_deals: config.current_active_deals,
          max_active_deals: config.max_active_deals,
          priority_weight: config.priority_weight,
          success_rate: config.success_rate,
          loan_type_match: loanTypeMatch,
          location_match: locationMatch,
          capacity_available: config.current_active_deals < config.max_active_deals
        }
      })

    if (candidates.length === 0) {
      return {
        success: false,
        deal_id: '',
        error: 'No BDEs match the criteria or have available capacity'
      }
    }

    // Sort candidates by score
    candidates.sort((a, b) => {
      // Priority 1: Both loan type and location match
      const aBothMatch = a.loan_type_match && a.location_match ? 1 : 0
      const bBothMatch = b.loan_type_match && b.location_match ? 1 : 0
      if (aBothMatch !== bBothMatch) return bBothMatch - aBothMatch

      // Priority 2: Loan type match
      if (a.loan_type_match !== b.loan_type_match) {
        return a.loan_type_match ? -1 : 1
      }

      // Priority 3: Location match
      if (a.location_match !== b.location_match) {
        return a.location_match ? -1 : 1
      }

      // Priority 4: Load balancing (prefer lower utilization)
      const aUtilization = a.current_active_deals / a.max_active_deals
      const bUtilization = b.current_active_deals / b.max_active_deals
      if (Math.abs(aUtilization - bUtilization) > 0.1) {
        return aUtilization - bUtilization
      }

      // Priority 5: Priority weight (higher is better)
      if (a.priority_weight !== b.priority_weight) {
        return b.priority_weight - a.priority_weight
      }

      // Priority 6: Success rate (higher is better)
      const aSuccessRate = a.success_rate || 0
      const bSuccessRate = b.success_rate || 0
      return bSuccessRate - aSuccessRate
    })

    const selectedBDE = candidates[0]

    // Build assignment reason
    const reasons: string[] = []
    if (selectedBDE.loan_type_match) {
      reasons.push(`Loan type match: ${criteria.loanType}`)
    }
    if (selectedBDE.location_match && criteria.location) {
      reasons.push(`Location match: ${criteria.location}`)
    }
    reasons.push(`Current load: ${selectedBDE.current_active_deals}/${selectedBDE.max_active_deals} deals`)

    return {
      success: true,
      deal_id: '', // Will be set by caller
      bde_id: selectedBDE.bde_id,
      bde_name: selectedBDE.bde_name,
      assignment_reason: reasons.join('; ')
    }

  } catch (error) {
    console.error('Error in deal assignment:', error)
    return {
      success: false,
      deal_id: '',
      error: 'Internal error during BDE assignment'
    }
  }
}

/**
 * Assign a deal to a specific BDE
 */
export async function assignDealToBDE(
  dealId: string,
  bdeId: string,
  assignedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()

    // Update the deal
    const { error: dealError } = await supabase
      .from('crm_deals')
      .update({
        bde_id: bdeId,
        assigned_at: now,
        updated_at: now
      })
      .eq('id', dealId)

    if (dealError) {
      console.error('Error assigning deal:', dealError)
      return { success: false, error: 'Failed to assign deal' }
    }

    // Create initial reminder for the BDE
    const reminderTime = new Date()
    reminderTime.setHours(reminderTime.getHours() + 3)

    await supabase
      .from('deal_update_reminders')
      .insert({
        deal_id: dealId,
        bde_id: bdeId,
        reminder_type: '3_hour',
        scheduled_at: reminderTime.toISOString(),
        priority: 'normal',
        status: 'pending'
      })

    // Create stage history entry
    await supabase
      .from('deal_stage_history')
      .insert({
        deal_id: dealId,
        from_stage: null,
        to_stage: 'docs_collected',
        from_status: null,
        to_status: 'in_progress',
        changed_by: assignedBy,
        change_reason: 'Deal assigned to BDE'
      })

    return { success: true }

  } catch (error) {
    console.error('Error in assignDealToBDE:', error)
    return { success: false, error: 'Internal error during assignment' }
  }
}

/**
 * Reassign a deal to a different BDE
 */
export async function reassignDeal(
  dealId: string,
  newBdeId: string,
  reason: string,
  reassignedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()

    // Get current deal info
    const { data: deal, error: fetchError } = await supabase
      .from('crm_deals')
      .select('bde_id, stage, status')
      .eq('id', dealId)
      .maybeSingle()

    if (fetchError || !deal) {
      return { success: false, error: 'Deal not found' }
    }

    const oldBdeId = deal.bde_id

    // Update the deal
    const { error: dealError } = await supabase
      .from('crm_deals')
      .update({
        bde_id: newBdeId,
        assigned_at: now,
        updated_at: now
      })
      .eq('id', dealId)

    if (dealError) {
      console.error('Error reassigning deal:', dealError)
      return { success: false, error: 'Failed to reassign deal' }
    }

    // Cancel old BDE's reminders
    if (oldBdeId) {
      await supabase
        .from('deal_update_reminders')
        .update({ status: 'expired' })
        .eq('deal_id', dealId)
        .eq('bde_id', oldBdeId)
        .eq('status', 'pending')
    }

    // Create new reminder for new BDE
    const reminderTime = new Date()
    reminderTime.setHours(reminderTime.getHours() + 3)

    await supabase
      .from('deal_update_reminders')
      .insert({
        deal_id: dealId,
        bde_id: newBdeId,
        reminder_type: '3_hour',
        scheduled_at: reminderTime.toISOString(),
        priority: 'high', // High priority for reassigned deals
        status: 'pending'
      })

    // Create stage history entry for reassignment
    await supabase
      .from('deal_stage_history')
      .insert({
        deal_id: dealId,
        from_stage: deal.stage,
        to_stage: deal.stage,
        from_status: deal.status,
        to_status: deal.status,
        changed_by: reassignedBy,
        change_reason: `Reassigned to new BDE. Reason: ${reason}`,
        metadata: { old_bde_id: oldBdeId, new_bde_id: newBdeId }
      })

    return { success: true }

  } catch (error) {
    console.error('Error in reassignDeal:', error)
    return { success: false, error: 'Internal error during reassignment' }
  }
}

/**
 * Get BDE assignment statistics
 */
export async function getBDEAssignmentStats(): Promise<{
  success: boolean
  data?: {
    total_bdes: number
    active_bdes: number
    total_capacity: number
    current_load: number
    utilization_percentage: number
    bde_stats: Array<{
      bde_id: string
      bde_name: string
      current_deals: number
      max_deals: number
      utilization: number
      loan_types: string[]
      locations: string[]
    }>
  }
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: configs, error } = await supabase
      .from('bde_assignment_config')
      .select(`
        bde_id,
        loan_types,
        locations,
        max_active_deals,
        current_active_deals,
        is_active,
        is_on_leave
      `)

    if (error) {
      return { success: false, error: 'Failed to fetch BDE stats' }
    }

    // Get BDE names
    const bdeIds = configs?.map(c => c.bde_id) || []
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', bdeIds)

    const nameMap = new Map(users?.map(u => [u.id, u.full_name]) || [])

    const activeConfigs = configs?.filter(c => c.is_active && !c.is_on_leave) || []

    const totalCapacity = activeConfigs.reduce((sum, c) => sum + c.max_active_deals, 0)
    const currentLoad = activeConfigs.reduce((sum, c) => sum + c.current_active_deals, 0)

    const bdeStats = activeConfigs.map(c => ({
      bde_id: c.bde_id,
      bde_name: nameMap.get(c.bde_id) || 'Unknown',
      current_deals: c.current_active_deals,
      max_deals: c.max_active_deals,
      utilization: c.max_active_deals > 0
        ? Math.round((c.current_active_deals / c.max_active_deals) * 100)
        : 0,
      loan_types: c.loan_types || [],
      locations: c.locations || []
    }))

    return {
      success: true,
      data: {
        total_bdes: configs?.length || 0,
        active_bdes: activeConfigs.length,
        total_capacity: totalCapacity,
        current_load: currentLoad,
        utilization_percentage: totalCapacity > 0
          ? Math.round((currentLoad / totalCapacity) * 100)
          : 0,
        bde_stats: bdeStats
      }
    }

  } catch (error) {
    console.error('Error getting BDE stats:', error)
    return { success: false, error: 'Internal error' }
  }
}
