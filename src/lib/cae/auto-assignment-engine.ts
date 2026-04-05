/**
 * Auto-Assignment Engine
 * Automatically assigns CAMs/leads to BDEs based on configurable rules
 *
 * Rules are stored in bde_assignment_rules table and consider:
 * - Location (state/city)
 * - Loan type expertise
 * - Loan amount range
 * - Current workload
 * - Performance metrics
 */

import { SupabaseClient } from '@supabase/supabase-js'

interface AssignmentRule {
  id: string
  bde_id: string
  state?: string
  city?: string
  loan_types: string[]
  min_loan_amount?: number
  max_loan_amount?: number
  max_active_leads: number
  priority: number
  is_active: boolean
}

interface BDEInfo {
  id: string
  user_id: string
  name: string
  email: string
  mobile: string
  employee_status: string
  active_leads_count: number
  total_leads_processed: number
  conversion_rate: number
  avg_processing_time_days: number
}

interface AssignmentInput {
  lead_id: string
  cam_id?: string
  loan_type: string
  loan_amount: number
  state?: string
  city?: string
  priority?: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface AssignmentResult {
  success: boolean
  assigned_to_bde_id?: string
  assigned_to_bde_name?: string
  assignment_reason?: string
  error?: string
}

export class AutoAssignmentEngine {
  private supabase: SupabaseClient

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Find the best BDE for a given lead/CAM
   */
  async findBestBDE(input: AssignmentInput): Promise<AssignmentResult> {
    try {
      // 1. Fetch all active assignment rules
      const { data: rules, error: rulesError } = await this.supabase
        .from('bde_assignment_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true })

      if (rulesError) {
        console.error('Failed to fetch assignment rules:', rulesError)
        return { success: false, error: 'Failed to fetch assignment rules' }
      }

      if (!rules || rules.length === 0) {
        return { success: false, error: 'No assignment rules configured' }
      }

      // 2. Filter rules based on criteria
      const eligibleRules = rules.filter(rule => {
        // Location check
        if (rule.state && input.state && rule.state.toLowerCase() !== input.state.toLowerCase()) {
          return false
        }
        if (rule.city && input.city && rule.city.toLowerCase() !== input.city.toLowerCase()) {
          return false
        }

        // Loan type check
        if (rule.loan_types && rule.loan_types.length > 0) {
          const loanTypeMatch = rule.loan_types.some((lt: string) =>
            lt.toUpperCase() === input.loan_type.toUpperCase() ||
            lt.toUpperCase() === 'ALL'
          )
          if (!loanTypeMatch) return false
        }

        // Amount range check
        if (rule.min_loan_amount && input.loan_amount < rule.min_loan_amount) {
          return false
        }
        if (rule.max_loan_amount && input.loan_amount > rule.max_loan_amount) {
          return false
        }

        return true
      })

      if (eligibleRules.length === 0) {
        // Try to find a fallback BDE (one with no location restrictions)
        const fallbackRules = rules.filter(rule =>
          !rule.state && !rule.city &&
          (!rule.loan_types || rule.loan_types.length === 0 || rule.loan_types.includes('ALL'))
        )

        if (fallbackRules.length === 0) {
          return { success: false, error: 'No BDE available for this criteria' }
        }

        eligibleRules.push(...fallbackRules)
      }

      // 3. Get BDE IDs from eligible rules
      const bdeIds = [...new Set(eligibleRules.map(r => r.bde_id))]

      // 4. Fetch BDE details with workload
      const { data: bdes, error: bdeError } = await this.supabase
        .from('employees')
        .select(`
          id,
          user_id,
          employee_status,
          users!inner (
            full_name,
            email,
            mobile
          )
        `)
        .in('id', bdeIds)
        .eq('employee_status', 'ACTIVE')
        .eq('sub_role', 'BDE')

      if (bdeError || !bdes || bdes.length === 0) {
        return { success: false, error: 'No active BDEs found' }
      }

      // 5. Get current workload for each BDE
      const bdeInfoList: BDEInfo[] = await Promise.all(
        bdes.map(async (bde: any) => {
          const workload = await this.getBDEWorkload(bde.id)
          return {
            id: bde.id,
            user_id: bde.user_id,
            name: bde.users?.full_name || 'Unknown BDE',
            email: bde.users?.email || '',
            mobile: bde.users?.mobile || '',
            employee_status: bde.employee_status,
            ...workload,
          }
        })
      )

      // 6. Score and rank BDEs
      const scoredBDEs = bdeInfoList
        .filter(bde => {
          // Check max active leads from rules
          const rule = eligibleRules.find(r => r.bde_id === bde.id)
          if (rule && rule.max_active_leads && bde.active_leads_count >= rule.max_active_leads) {
            return false // BDE at capacity
          }
          return true
        })
        .map(bde => ({
          ...bde,
          score: this.calculateBDEScore(bde, eligibleRules.find(r => r.bde_id === bde.id)!),
        }))
        .sort((a, b) => b.score - a.score)

      if (scoredBDEs.length === 0) {
        return { success: false, error: 'All eligible BDEs are at capacity' }
      }

      // 7. Select best BDE
      const bestBDE = scoredBDEs[0]
      const matchingRule = eligibleRules.find(r => r.bde_id === bestBDE.id)

      // Build assignment reason
      const reasons: string[] = []
      if (matchingRule?.state) reasons.push(`Location: ${matchingRule.state}`)
      if (matchingRule?.loan_types?.length) reasons.push(`Expertise: ${input.loan_type}`)
      if (bestBDE.conversion_rate > 0) reasons.push(`Conversion: ${bestBDE.conversion_rate.toFixed(0)}%`)
      reasons.push(`Workload: ${bestBDE.active_leads_count} active`)

      return {
        success: true,
        assigned_to_bde_id: bestBDE.user_id, // Return user_id for assignment
        assigned_to_bde_name: bestBDE.name,
        assignment_reason: reasons.join(', '),
      }

    } catch (error) {
      console.error('Auto-assignment error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Assign a CAM to a BDE
   */
  async assignCAM(input: AssignmentInput): Promise<AssignmentResult> {
    // Find best BDE
    const result = await this.findBestBDE(input)

    if (!result.success || !result.assigned_to_bde_id) {
      return result
    }

    try {
      // Update CAM with assignment
      if (input.cam_id) {
        const { error: updateError } = await this.supabase
          .from('credit_appraisal_memos')
          .update({
            assigned_bde_id: result.assigned_to_bde_id,
            assigned_at: new Date().toISOString(),
            assignment_reason: result.assignment_reason,
            status: 'ASSIGNED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.cam_id)

        if (updateError) {
          console.error('Failed to update CAM assignment:', updateError)
          return { success: false, error: 'Failed to assign CAM' }
        }
      }

      // Update lead with assignment
      const { error: leadError } = await this.supabase
        .from('partner_leads')
        .update({
          assigned_bde_id: result.assigned_to_bde_id,
          lead_status: 'ASSIGNED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.lead_id)

      if (leadError) {
        console.error('Failed to update lead assignment:', leadError)
        // Don't fail - CAM assignment succeeded
      }

      // Log assignment history
      await this.logAssignment({
        lead_id: input.lead_id,
        cam_id: input.cam_id,
        assigned_to_bde_id: result.assigned_to_bde_id,
        assigned_by: 'SYSTEM',
        assignment_type: 'AUTO',
        reason: result.assignment_reason,
      })

      // Create notification for BDE
      await this.notifyBDE(result.assigned_to_bde_id, {
        lead_id: input.lead_id,
        loan_type: input.loan_type,
        loan_amount: input.loan_amount,
        priority: input.priority || 'MEDIUM',
      })

      return result

    } catch (error) {
      console.error('Assignment error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Assignment failed',
      }
    }
  }

  /**
   * Re-assign a CAM to a different BDE
   */
  async reassignCAM(
    camId: string,
    newBdeUserId: string,
    reason: string,
    reassignedBy: string
  ): Promise<AssignmentResult> {
    try {
      // Get current assignment
      const { data: cam, error: camError } = await this.supabase
        .from('credit_appraisal_memos')
        .select('assigned_bde_id, lead_id, loan_type, requested_amount')
        .eq('id', camId)
        .maybeSingle()

      if (camError || !cam) {
        return { success: false, error: 'CAM not found' }
      }

      const previousBdeId = cam.assigned_bde_id

      // Update CAM
      const { error: updateError } = await this.supabase
        .from('credit_appraisal_memos')
        .update({
          assigned_bde_id: newBdeUserId,
          assigned_at: new Date().toISOString(),
          assignment_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', camId)

      if (updateError) {
        return { success: false, error: 'Failed to reassign CAM' }
      }

      // Update lead
      if (cam.lead_id) {
        await this.supabase
          .from('partner_leads')
          .update({
            assigned_bde_id: newBdeUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cam.lead_id)
      }

      // Log reassignment
      await this.logAssignment({
        lead_id: cam.lead_id,
        cam_id: camId,
        assigned_to_bde_id: newBdeUserId,
        previous_bde_id: previousBdeId,
        assigned_by: reassignedBy,
        assignment_type: 'MANUAL_REASSIGN',
        reason,
      })

      // Get BDE name
      const { data: bde } = await this.supabase
        .from('users')
        .select('full_name')
        .eq('id', newBdeUserId)
        .maybeSingle()

      return {
        success: true,
        assigned_to_bde_id: newBdeUserId,
        assigned_to_bde_name: bde?.full_name || 'Unknown',
        assignment_reason: reason,
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reassignment failed',
      }
    }
  }

  /**
   * Get workload metrics for a BDE
   */
  private async getBDEWorkload(bdeEmployeeId: string): Promise<{
    active_leads_count: number
    total_leads_processed: number
    conversion_rate: number
    avg_processing_time_days: number
  }> {
    try {
      // Get BDE's user_id from employee table
      const { data: employee } = await this.supabase
        .from('employees')
        .select('user_id')
        .eq('id', bdeEmployeeId)
        .maybeSingle()

      if (!employee) {
        return {
          active_leads_count: 0,
          total_leads_processed: 0,
          conversion_rate: 0,
          avg_processing_time_days: 0,
        }
      }

      const userId = employee.user_id

      // Count active leads
      const { count: activeCount } = await this.supabase
        .from('partner_leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_bde_id', userId)
        .in('lead_status', ['ASSIGNED', 'PROCESSING', 'IN_PROGRESS', 'SUBMITTED'])

      // Get total processed and conversion stats
      const { data: stats } = await this.supabase
        .from('partner_leads')
        .select('lead_status, created_at, updated_at')
        .eq('assigned_bde_id', userId)
        .in('lead_status', ['APPROVED', 'REJECTED', 'DISBURSED', 'COMPLETED', 'CLOSED'])

      const totalProcessed = stats?.length || 0
      const converted = stats?.filter(s =>
        ['APPROVED', 'DISBURSED', 'COMPLETED'].includes(s.lead_status)
      ).length || 0

      const conversionRate = totalProcessed > 0 ? (converted / totalProcessed) * 100 : 0

      // Calculate average processing time
      let avgProcessingDays = 0
      if (stats && stats.length > 0) {
        const processingTimes = stats
          .filter(s => s.created_at && s.updated_at)
          .map(s => {
            const created = new Date(s.created_at)
            const updated = new Date(s.updated_at)
            return (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
          })

        if (processingTimes.length > 0) {
          avgProcessingDays = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        }
      }

      return {
        active_leads_count: activeCount || 0,
        total_leads_processed: totalProcessed,
        conversion_rate: conversionRate,
        avg_processing_time_days: avgProcessingDays,
      }

    } catch (error) {
      console.error('Error getting BDE workload:', error)
      return {
        active_leads_count: 999, // High number to deprioritize on error
        total_leads_processed: 0,
        conversion_rate: 0,
        avg_processing_time_days: 0,
      }
    }
  }

  /**
   * Calculate score for BDE ranking
   */
  private calculateBDEScore(bde: BDEInfo, rule: AssignmentRule): number {
    let score = 100 // Base score

    // Workload penalty (lower workload = higher score)
    // Max penalty: 30 points
    const workloadPenalty = Math.min(30, bde.active_leads_count * 3)
    score -= workloadPenalty

    // Conversion rate bonus (higher conversion = higher score)
    // Max bonus: 20 points
    if (bde.total_leads_processed >= 5) {
      const conversionBonus = Math.min(20, bde.conversion_rate / 5)
      score += conversionBonus
    }

    // Processing speed bonus (faster = higher score)
    // Max bonus: 10 points
    if (bde.avg_processing_time_days > 0 && bde.avg_processing_time_days < 10) {
      const speedBonus = Math.max(0, 10 - bde.avg_processing_time_days)
      score += speedBonus
    }

    // Rule priority bonus
    score += (10 - Math.min(10, rule.priority))

    return Math.max(0, score)
  }

  /**
   * Log assignment to history table
   */
  private async logAssignment(log: {
    lead_id: string
    cam_id?: string
    assigned_to_bde_id: string
    previous_bde_id?: string
    assigned_by: string
    assignment_type: 'AUTO' | 'MANUAL' | 'MANUAL_REASSIGN'
    reason?: string
  }): Promise<void> {
    try {
      await this.supabase
        .from('cam_assignment_history')
        .insert({
          lead_id: log.lead_id,
          cam_id: log.cam_id,
          assigned_to_bde_id: log.assigned_to_bde_id,
          previous_bde_id: log.previous_bde_id,
          assigned_by: log.assigned_by,
          assignment_type: log.assignment_type,
          assignment_reason: log.reason,
          created_at: new Date().toISOString(),
        })
    } catch (error) {
      console.error('Failed to log assignment:', error)
    }
  }

  /**
   * Send notification to BDE about new assignment
   */
  private async notifyBDE(bdeUserId: string, details: {
    lead_id: string
    loan_type: string
    loan_amount: number
    priority: string
  }): Promise<void> {
    try {
      await this.supabase
        .from('notifications')
        .insert({
          user_id: bdeUserId,
          title: 'New Lead Assigned',
          message: `A new ${details.loan_type} lead (₹${details.loan_amount.toLocaleString()}) has been assigned to you.`,
          type: 'LEAD_ASSIGNMENT',
          entity_type: 'LEAD',
          entity_id: details.lead_id,
          priority: details.priority,
          is_read: false,
          created_at: new Date().toISOString(),
        })
    } catch (error) {
      console.error('Failed to send BDE notification:', error)
    }
  }

  /**
   * Get assignment statistics
   */
  async getAssignmentStats(): Promise<{
    total_assigned_today: number
    total_assigned_week: number
    avg_time_to_assign_hours: number
    bde_workload: Array<{ bde_name: string; active_count: number }>
  }> {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)

      // Today's assignments
      const { count: todayCount } = await this.supabase
        .from('cam_assignment_history')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      // Week's assignments
      const { count: weekCount } = await this.supabase
        .from('cam_assignment_history')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString())

      // BDE workload
      const { data: bdes } = await this.supabase
        .from('employees')
        .select(`
          id,
          user_id,
          users!inner (full_name)
        `)
        .eq('sub_role', 'BDE')
        .eq('employee_status', 'ACTIVE')

      const workloadPromises = (bdes || []).map(async (bde: any) => {
        const { count } = await this.supabase
          .from('partner_leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_bde_id', bde.user_id)
          .in('lead_status', ['ASSIGNED', 'PROCESSING', 'IN_PROGRESS'])

        return {
          bde_name: bde.users?.full_name || 'Unknown',
          active_count: count || 0,
        }
      })

      const bdeWorkload = await Promise.all(workloadPromises)

      return {
        total_assigned_today: todayCount || 0,
        total_assigned_week: weekCount || 0,
        avg_time_to_assign_hours: 2.5, // TODO: Calculate actual
        bde_workload: bdeWorkload.sort((a, b) => b.active_count - a.active_count),
      }

    } catch (error) {
      console.error('Error getting assignment stats:', error)
      return {
        total_assigned_today: 0,
        total_assigned_week: 0,
        avg_time_to_assign_hours: 0,
        bde_workload: [],
      }
    }
  }
}

export function createAutoAssignmentEngine(supabaseClient: SupabaseClient): AutoAssignmentEngine {
  return new AutoAssignmentEngine(supabaseClient)
}
