import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/bdm/team-management/assignment/engine
 * Auto-assign pending leads using round-robin algorithm based on loan type + geography
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const bodySchema = z.object({

      loanType: z.string().optional(),

      leadSource: z.string().optional(),

      limit: z.number().optional().default(50),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Optional filters
    const { loanType, leadSource, limit = 50 } = body

    // Get current user (must be BDM or Admin)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has permission
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !['BUSINESS_DEVELOPMENT_MANAGER', 'SUPER_ADMIN'].includes(userData?.sub_role || '')) {
      return NextResponse.json({ success: false, error: 'Access denied. BDM or Admin role required.' }, { status: 403 })
    }

    // Get pending leads that are unassigned
    let pendingQuery = supabase
      .from('leads')
      .select('id, loan_type, customer_name, requested_amount, pincode, lead_source, created_at')
      .is('assigned_to_bde', null)
      .eq('current_stage', 'NEW')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (loanType) {
      pendingQuery = pendingQuery.eq('loan_type', loanType)
    }

    if (leadSource) {
      pendingQuery = pendingQuery.eq('lead_source', leadSource)
    }

    const { data: pendingLeads, error: leadsError } = await pendingQuery

    if (leadsError) {
      apiLogger.error('Error fetching pending leads', leadsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch pending leads' }, { status: 500 })
    }

    if (!pendingLeads || pendingLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending leads to assign',
        assignedCount: 0,
        skippedCount: 0,
        assignments: [],
      })
    }

    // Track engine run start time
    const engineRunStartTime = new Date().toISOString()

    // Process each lead for assignment
    const assignments: unknown[] = []
    const skipped: unknown[] = []

    for (const lead of pendingLeads) {
      try {
        // Find eligible BDEs for this lead
        const { data: eligibleBDEs, error: bdeError } = await supabase
          .from('users')
          .select(`
            id,
            full_name,
            email,
            assigned_loan_type,
            assigned_pincode_ranges,
            bde_assignment_settings!inner(
              is_active_for_assignment,
              assignment_status,
              max_concurrent_leads,
              current_lead_count,
              assignment_priority,
              assignment_weight,
              last_assigned_at
            )
          `)
          .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
          .eq('assigned_loan_type', lead.loan_type)
          .eq('bde_assignment_settings.is_active_for_assignment', true)
          .eq('bde_assignment_settings.assignment_status', 'active')

        if (bdeError) {
          apiLogger.error('Error fetching eligible BDEs', bdeError)
          skipped.push({ leadId: lead.id, reason: 'Failed to fetch BDEs' })
          continue
        }

        // Filter BDEs by pincode match
        const matchingBDEs = eligibleBDEs?.filter((bde: unknown) => {
          const pincodes = bde.assigned_pincode_ranges || []
          return pincodes.includes(lead.pincode)
        }) || []

        // Further filter by workload capacity
        const availableBDEs = matchingBDEs.filter((bde: unknown) => {
          const settings = bde.bde_assignment_settings
          return settings.current_lead_count < settings.max_concurrent_leads
        })

        if (availableBDEs.length === 0) {
          skipped.push({
            leadId: lead.id,
            reason: matchingBDEs.length === 0
              ? 'No BDEs match loan type + pincode'
              : 'All matching BDEs at capacity'
          })
          continue
        }

        // Round-robin: Sort by last_assigned_at (oldest gets next lead)
        availableBDEs.sort((a: unknown, b: unknown) => {
          const aTime = a.bde_assignment_settings.last_assigned_at
            ? new Date(a.bde_assignment_settings.last_assigned_at).getTime()
            : 0
          const bTime = b.bde_assignment_settings.last_assigned_at
            ? new Date(b.bde_assignment_settings.last_assigned_at).getTime()
            : 0
          return aTime - bTime
        })

        const selectedBDE = availableBDEs[0]

        // Assign lead to selected BDE
        const { error: assignError } = await supabase
          .from('leads')
          .update({
            assigned_to_bde: selectedBDE.id,
            current_stage: 'ASSIGNED_TO_BDE',
            assigned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id)

        if (assignError) {
          apiLogger.error('Error assigning lead', assignError)
          skipped.push({ leadId: lead.id, reason: 'Failed to update lead' })
          continue
        }

        // Update BDE assignment settings
        await supabase
          .from('bde_assignment_settings')
          .update({
            current_lead_count: selectedBDE.bde_assignment_settings.current_lead_count + 1,
            last_assigned_at: new Date().toISOString(),
            total_leads_assigned_lifetime: (selectedBDE.bde_assignment_settings.total_leads_assigned_lifetime || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', selectedBDE.id)

        // Log assignment audit
        await supabase.from('lead_assignment_audit').insert({
          lead_id: lead.id,
          assigned_to_bde_id: selectedBDE.id,
          assignment_type: 'auto_round_robin',
          assigned_by_bdm_id: user.id,
          round_robin_sequence: 1,
          eligible_bdes_count: availableBDEs.length,
          assignment_criteria: {
            loan_type: lead.loan_type,
            pincode: lead.pincode,
            matching_bdes: availableBDEs.length,
          },
          assigned_at: new Date().toISOString(),
        })

        // Log BDM action
        await supabase.from('bdm_assignment_actions').insert({
          bdm_user_id: user.id,
          action_type: 'auto_assign_lead',
          target_bde_user_id: selectedBDE.id,
          affected_lead_id: lead.id,
          old_value: { assigned_to_bde: null },
          new_value: { assigned_to_bde: selectedBDE.id },
          reason: 'Automatic round-robin assignment',
          action_timestamp: new Date().toISOString(),
        })

        // Log activity
        await supabase.from('bde_activity_logs').insert({
          user_id: selectedBDE.id,
          activity_type: 'lead_assigned',
          activity_description: `New ${lead.loan_type} lead assigned: ${lead.customer_name}`,
          entity_type: 'lead',
          entity_id: lead.id,
          metadata: {
            assignment_type: 'auto_round_robin',
            loan_type: lead.loan_type,
            amount: lead.requested_amount,
          },
        })

        assignments.push({
          leadId: lead.id,
          leadName: lead.customer_name,
          loanType: lead.loan_type,
          assignedTo: {
            id: selectedBDE.id,
            name: selectedBDE.full_name,
            email: selectedBDE.email,
          },
          assignedAt: new Date().toISOString(),
        })
      } catch (error: unknown) {
        apiLogger.error(`Error processing lead ${lead.id}:`, error)
        skipped.push({ leadId: lead.id, reason: error.message })
      }
    }

    // Store last run timestamp in a settings table or return it in response
    // For now, we'll log it and return it in the response
    const engineRunEndTime = new Date().toISOString()

    // Try to update or insert engine run history
    try {
      await supabase.from('assignment_engine_runs').insert({
        bdm_user_id: user.id,
        run_started_at: engineRunStartTime,
        run_completed_at: engineRunEndTime,
        leads_processed: pendingLeads.length,
        leads_assigned: assignments.length,
        leads_skipped: skipped.length,
        filters_applied: { loanType, leadSource, limit },
      })
    } catch (historyError) {
      // If table doesn't exist, just log it
    }

    return NextResponse.json({
      success: true,
      message: `Assigned ${assignments.length} leads, skipped ${skipped.length}`,
      assignedCount: assignments.length,
      skippedCount: skipped.length,
      assignments,
      skipped: skipped.slice(0, 10), // Return first 10 skipped for debugging
      runTimestamp: engineRunEndTime,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in assignment engine', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/bdm/team-management/assignment/engine
 * Get assignment engine status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get pending leads count by loan type
    const { data: pendingStats, error: statsError } = await supabase
      .from('leads')
      .select('loan_type')
      .is('assigned_to_bde', null)
      .eq('current_stage', 'NEW')

    const pendingByLoanType: Record<string, number> = {}
    pendingStats?.forEach((lead: unknown) => {
      pendingByLoanType[lead.loan_type] = (pendingByLoanType[lead.loan_type] || 0) + 1
    })

    // Get available BDE capacity
    const { data: bdeCapacity, error: capacityError } = await supabase
      .from('bde_assignment_settings')
      .select(`
        user_id,
        max_concurrent_leads,
        current_lead_count,
        assignment_status,
        is_active_for_assignment,
        users!inner(assigned_loan_type)
      `)
      .eq('is_active_for_assignment', true)
      .eq('assignment_status', 'active')

    const capacityByLoanType: Record<string, { available: number; total: number; bdes: number }> = {}
    bdeCapacity?.forEach((bde: unknown) => {
      const loanType = bde.users.assigned_loan_type
      if (!capacityByLoanType[loanType]) {
        capacityByLoanType[loanType] = { available: 0, total: 0, bdes: 0 }
      }
      const available = Math.max(0, bde.max_concurrent_leads - bde.current_lead_count)
      capacityByLoanType[loanType].available += available
      capacityByLoanType[loanType].total += bde.max_concurrent_leads
      capacityByLoanType[loanType].bdes += 1
    })

    // Get last run timestamp from engine run history
    let lastRunTimestamp = null
    try {
      const { data: lastRun } = await supabase
        .from('assignment_engine_runs')
        .select('run_completed_at, leads_assigned, leads_skipped')
        .order('run_completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastRun) {
        lastRunTimestamp = {
          timestamp: lastRun.run_completed_at,
          leadsAssigned: lastRun.leads_assigned,
          leadsSkipped: lastRun.leads_skipped,
        }
      }
    } catch (error) {
      // If table doesn't exist or no records, lastRunTimestamp stays null
    }

    return NextResponse.json({
      pendingLeads: {
        total: pendingStats?.length || 0,
        byLoanType: pendingByLoanType,
      },
      bdeCapacity: {
        byLoanType: capacityByLoanType,
      },
      engineStatus: 'ready',
      lastRun: lastRunTimestamp,
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching engine status', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
