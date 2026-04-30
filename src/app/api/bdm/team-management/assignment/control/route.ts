import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/bdm/team-management/assignment/control
 * BDM control actions: pause/resume BDE, manual assign/reassign leads
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const bodySchema = z.object({

      action: z.string(),

      bdeId: z.string().uuid(),

      leadId: z.string().uuid().optional(),

      reason: z.string(),

      newBdeId: z.string().uuid().optional(),

      fromBdeId: z.string().uuid().optional(),

      leadIds: z.array(z.unknown()).optional(),

      targetBdeId: z.string().uuid().optional(),

      autoDistribute: z.boolean().optional().default(false),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { action, bdeId, leadId, reason, newBdeId } = body

    // Validate required fields
    if (!action) {
      return NextResponse.json({ success: false, error: 'Action is required' }, { status: 400 })
    }

    // Get current user (must be BDM)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a BDM
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER') {
      return NextResponse.json({ success: false, error: 'Access denied. BDM role required.' }, { status: 403 })
    }

    // Handle different actions
    switch (action) {
      case 'pause_bde':
        return await pauseBDE(supabase, user.id, bdeId, reason)

      case 'resume_bde':
        return await resumeBDE(supabase, user.id, bdeId)

      case 'manual_assign':
        return await manualAssignLead(supabase, user.id, leadId, bdeId, reason)

      case 'reassign_lead':
        return await reassignLead(supabase, user.id, leadId, newBdeId, reason)

      case 'bulk_reassign':
        return await bulkReassign(supabase, user.id, body)

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: unknown) {
    apiLogger.error('Error in control API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Pause a BDE from receiving new assignments
async function pauseBDE(supabase: unknown, bdmId: string, bdeId: string, reason: string) {
  if (!bdeId) {
    return NextResponse.json({ success: false, error: 'BDE ID is required' }, { status: 400 })
  }

  if (!reason) {
    return NextResponse.json({ success: false, error: 'Pause reason is required' }, { status: 400 })
  }

  // Verify BDE reports to this BDM
  const { data: bdeData, error: bdeError } = await supabase
    .from('users')
    .select('id, full_name, manager_id')
    .eq('id', bdeId)
    .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
    .maybeSingle()

  if (bdeError || !bdeData) {
    return NextResponse.json({ success: false, error: 'BDE not found' }, { status: 404 })
  }

  if (bdeData.manager_id !== bdmId) {
    return NextResponse.json({ success: false, error: 'You can only pause your own team members' }, { status: 403 })
  }

  // Update assignment settings
  const { data: updated, error: updateError } = await supabase
    .from('bde_assignment_settings')
    .update({
      is_active_for_assignment: false,
      assignment_status: 'paused',
      pause_reason: reason,
      paused_by: bdmId,
      paused_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', bdeId)
    .select()
    .maybeSingle()

  if (updateError) {
    apiLogger.error('Error pausing BDE', updateError)
    return NextResponse.json({ success: false, error: 'Failed to pause BDE' }, { status: 500 })
  }

  // Log BDM action
  await supabase.from('bdm_assignment_actions').insert({
    bdm_user_id: bdmId,
    action_type: 'pause_bde_assignment',
    target_bde_user_id: bdeId,
    old_value: { assignment_status: 'active' },
    new_value: { assignment_status: 'paused' },
    reason: reason,
    action_timestamp: new Date().toISOString(),
  })

  return NextResponse.json({
    success: true,
    message: `${bdeData.full_name} paused from receiving new leads`,
    bde: {
      id: bdeId,
      name: bdeData.full_name,
      status: 'paused',
      pausedAt: new Date().toISOString(),
    },
  })
}

// Resume a BDE to start receiving assignments
async function resumeBDE(supabase: unknown, bdmId: string, bdeId: string) {
  if (!bdeId) {
    return NextResponse.json({ success: false, error: 'BDE ID is required' }, { status: 400 })
  }

  // Verify BDE reports to this BDM
  const { data: bdeData, error: bdeError } = await supabase
    .from('users')
    .select('id, full_name, manager_id')
    .eq('id', bdeId)
    .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
    .maybeSingle()

  if (bdeError || !bdeData) {
    return NextResponse.json({ success: false, error: 'BDE not found' }, { status: 404 })
  }

  if (bdeData.manager_id !== bdmId) {
    return NextResponse.json({ success: false, error: 'You can only resume your own team members' }, { status: 403 })
  }

  // Update assignment settings
  const { data: updated, error: updateError } = await supabase
    .from('bde_assignment_settings')
    .update({
      is_active_for_assignment: true,
      assignment_status: 'active',
      pause_reason: null,
      paused_by: null,
      paused_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', bdeId)
    .select()
    .maybeSingle()

  if (updateError) {
    apiLogger.error('Error resuming BDE', updateError)
    return NextResponse.json({ success: false, error: 'Failed to resume BDE' }, { status: 500 })
  }

  // Log BDM action
  await supabase.from('bdm_assignment_actions').insert({
    bdm_user_id: bdmId,
    action_type: 'resume_bde_assignment',
    target_bde_user_id: bdeId,
    old_value: { assignment_status: 'paused' },
    new_value: { assignment_status: 'active' },
    reason: 'Resumed by BDM',
    action_timestamp: new Date().toISOString(),
  })

  return NextResponse.json({
    success: true,
    message: `${bdeData.full_name} resumed and can now receive new leads`,
    bde: {
      id: bdeId,
      name: bdeData.full_name,
      status: 'active',
      resumedAt: new Date().toISOString(),
    },
  })
}

// Manually assign a lead to a specific BDE
async function manualAssignLead(supabase: unknown, bdmId: string, leadId: string, bdeId: string, reason: string) {
  if (!leadId || !bdeId) {
    return NextResponse.json({ success: false, error: 'Lead ID and BDE ID are required' }, { status: 400 })
  }

  // Get lead details
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, customer_name, loan_type, assigned_to_bde')
    .eq('id', leadId)
    .maybeSingle()

  if (leadError || !lead) {
    return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
  }

  // Get BDE details and verify they report to this BDM
  const { data: bde, error: bdeError } = await supabase
    .from('users')
    .select('id, full_name, manager_id, assigned_loan_type')
    .eq('id', bdeId)
    .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
    .maybeSingle()

  if (bdeError || !bde) {
    return NextResponse.json({ success: false, error: 'BDE not found' }, { status: 404 })
  }

  if (bde.manager_id !== bdmId) {
    return NextResponse.json({ success: false, error: 'You can only assign leads to your team members' }, { status: 403 })
  }

  // Check if BDE's loan type matches lead
  if (bde.assigned_loan_type !== lead.loan_type) {
    return NextResponse.json({ success: false, error: `BDE specializes in ${bde.assigned_loan_type}, but lead requires ${lead.loan_type}`,
    }, { status: 400 })
  }

  const oldBdeId = lead.assigned_to_bde

  // Assign lead
  const { error: assignError } = await supabase
    .from('leads')
    .update({
      assigned_to_bde: bdeId,
      current_stage: 'ASSIGNED_TO_BDE',
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (assignError) {
    apiLogger.error('Error assigning lead', assignError)
    return NextResponse.json({ success: false, error: 'Failed to assign lead' }, { status: 500 })
  }

  // Update BDE assignment count
  if (!oldBdeId) {
    // New assignment - increment count
    await supabase
      .from('bde_assignment_settings')
      .update({
        current_lead_count: supabase.rpc('increment', { field: 'current_lead_count' }),
        last_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', bdeId)
  }

  // Log assignment audit
  await supabase.from('lead_assignment_audit').insert({
    lead_id: leadId,
    assigned_to_bde_id: bdeId,
    assignment_type: 'manual_override',
    assigned_by_bdm_id: bdmId,
    previous_bde_id: oldBdeId,
    assignment_criteria: {
      manual: true,
      reason: reason || 'Manual assignment by BDM',
    },
    assigned_at: new Date().toISOString(),
  })

  // Log BDM action
  await supabase.from('bdm_assignment_actions').insert({
    bdm_user_id: bdmId,
    action_type: 'manual_assign_lead',
    target_bde_user_id: bdeId,
    affected_lead_id: leadId,
    old_value: { assigned_to_bde: oldBdeId },
    new_value: { assigned_to_bde: bdeId },
    reason: reason || 'Manual assignment by BDM',
    action_timestamp: new Date().toISOString(),
  })

  return NextResponse.json({
    success: true,
    message: `Lead assigned to ${bde.full_name}`,
    assignment: {
      leadId,
      leadName: lead.customer_name,
      assignedTo: {
        id: bdeId,
        name: bde.full_name,
      },
      assignedAt: new Date().toISOString(),
    },
  })
}

// Reassign a lead from one BDE to another
async function reassignLead(supabase: unknown, bdmId: string, leadId: string, newBdeId: string, reason: string) {
  if (!leadId || !newBdeId) {
    return NextResponse.json({ success: false, error: 'Lead ID and new BDE ID are required' }, { status: 400 })
  }

  if (!reason) {
    return NextResponse.json({ success: false, error: 'Reassignment reason is required' }, { status: 400 })
  }

  // Get lead details
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, customer_name, loan_type, assigned_to_bde')
    .eq('id', leadId)
    .maybeSingle()

  if (leadError || !lead) {
    return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
  }

  if (!lead.assigned_to_bde) {
    return NextResponse.json({ success: false, error: 'Lead is not currently assigned' }, { status: 400 })
  }

  const oldBdeId = lead.assigned_to_bde

  // Get both BDEs
  const { data: newBde, error: newBdeError } = await supabase
    .from('users')
    .select('id, full_name, manager_id, assigned_loan_type')
    .eq('id', newBdeId)
    .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
    .maybeSingle()

  if (newBdeError || !newBde) {
    return NextResponse.json({ success: false, error: 'New BDE not found' }, { status: 404 })
  }

  if (newBde.manager_id !== bdmId) {
    return NextResponse.json({ success: false, error: 'You can only reassign to your team members' }, { status: 403 })
  }

  // Reassign lead
  const { error: reassignError } = await supabase
    .from('leads')
    .update({
      assigned_to_bde: newBdeId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (reassignError) {
    apiLogger.error('Error reassigning lead', reassignError)
    return NextResponse.json({ success: false, error: 'Failed to reassign lead' }, { status: 500 })
  }

  // Update lead counts
  // Decrement old BDE
  await supabase.rpc('decrement_lead_count', { bde_id: oldBdeId })

  // Increment new BDE
  await supabase
    .from('bde_assignment_settings')
    .update({
      current_lead_count: supabase.rpc('increment', { field: 'current_lead_count' }),
      last_assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', newBdeId)

  // Log reassignment
  await supabase.from('lead_assignment_audit').insert({
    lead_id: leadId,
    assigned_to_bde_id: newBdeId,
    assignment_type: 'manual_override',
    assigned_by_bdm_id: bdmId,
    previous_bde_id: oldBdeId,
    assignment_criteria: {
      reassignment: true,
      reason: reason,
    },
    assigned_at: new Date().toISOString(),
  })

  // Log BDM action
  await supabase.from('bdm_assignment_actions').insert({
    bdm_user_id: bdmId,
    action_type: 'reassign_lead',
    target_bde_user_id: newBdeId,
    affected_lead_id: leadId,
    old_value: { assigned_to_bde: oldBdeId },
    new_value: { assigned_to_bde: newBdeId },
    reason: reason,
    action_timestamp: new Date().toISOString(),
  })

  return NextResponse.json({
    success: true,
    message: `Lead reassigned to ${newBde.full_name}`,
    reassignment: {
      leadId,
      leadName: lead.customer_name,
      from: oldBdeId,
      to: {
        id: newBdeId,
        name: newBde.full_name,
      },
      reason,
      reassignedAt: new Date().toISOString(),
    },
  })
}

// Bulk reassign leads from one BDE to others
async function bulkReassign(supabase: unknown, bdmId: string, body: unknown) {
  const { fromBdeId, leadIds, targetBdeId, reason, autoDistribute = false } = body

  if (!leadIds || leadIds.length === 0) {
    return NextResponse.json({ success: false, error: 'Lead IDs are required' }, { status: 400 })
  }

  if (!reason) {
    return NextResponse.json({ success: false, error: 'Reassignment reason is required' }, { status: 400 })
  }

  // If targetBdeId is specified, assign all leads to that BDE
  // If autoDistribute is true, distribute leads across available BDEs using round-robin
  if (!targetBdeId && !autoDistribute) {
    return NextResponse.json({ success: false, error: 'Either targetBdeId or autoDistribute must be specified' }, { status: 400 })
  }

  const successful: unknown[] = []
  const failed: unknown[] = []

  // Get available BDEs if auto-distributing
  let availableBDEs: unknown[] = []
  if (autoDistribute) {
    const { data: bdes, error: bdeError } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        assigned_loan_type,
        manager_id,
        bde_assignment_settings!inner(
          is_active_for_assignment,
          assignment_status,
          max_concurrent_leads,
          current_lead_count,
          last_assigned_at
        )
      `)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('manager_id', bdmId)
      .eq('bde_assignment_settings.is_active_for_assignment', true)
      .eq('bde_assignment_settings.assignment_status', 'active')

    if (bdeError || !bdes || bdes.length === 0) {
      return NextResponse.json({ success: false, error: 'No available BDEs for distribution' }, { status: 400 })
    }

    // Filter BDEs with available capacity
    availableBDEs = bdes.filter((bde: unknown) => {
      const settings = bde.bde_assignment_settings
      return settings.current_lead_count < settings.max_concurrent_leads
    })

    if (availableBDEs.length === 0) {
      return NextResponse.json({ success: false, error: 'All BDEs are at capacity' }, { status: 400 })
    }

    // Sort by last_assigned_at for round-robin
    availableBDEs.sort((a: unknown, b: unknown) => {
      const aTime = a.bde_assignment_settings.last_assigned_at
        ? new Date(a.bde_assignment_settings.last_assigned_at).getTime()
        : 0
      const bTime = b.bde_assignment_settings.last_assigned_at
        ? new Date(b.bde_assignment_settings.last_assigned_at).getTime()
        : 0
      return aTime - bTime
    })
  }

  let bdeIndex = 0

  for (const leadId of leadIds) {
    try {
      // Get lead details
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, customer_name, loan_type, assigned_to_bde')
        .eq('id', leadId)
        .maybeSingle()

      if (leadError || !lead) {
        failed.push({ leadId, reason: 'Lead not found' })
        continue
      }

      const oldBdeId = lead.assigned_to_bde

      // Determine target BDE
      let assignToBdeId = targetBdeId
      let selectedBDE: unknown = null

      if (autoDistribute) {
        // Filter by matching loan type
        const matchingBDEs = availableBDEs.filter((bde: unknown) => bde.assigned_loan_type === lead.loan_type)
        if (matchingBDEs.length === 0) {
          failed.push({ leadId, reason: `No BDEs available for loan type ${lead.loan_type}` })
          continue
        }

        // Use round-robin index
        selectedBDE = matchingBDEs[bdeIndex % matchingBDEs.length]
        assignToBdeId = selectedBDE.id
        bdeIndex++
      } else {
        // Verify target BDE
        const { data: targetBde, error: targetBdeError } = await supabase
          .from('users')
          .select('id, full_name, assigned_loan_type, manager_id')
          .eq('id', targetBdeId)
          .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
          .maybeSingle()

        if (targetBdeError || !targetBde) {
          failed.push({ leadId, reason: 'Target BDE not found' })
          continue
        }

        if (targetBde.manager_id !== bdmId) {
          failed.push({ leadId, reason: 'Target BDE not in your team' })
          continue
        }

        if (targetBde.assigned_loan_type !== lead.loan_type) {
          failed.push({ leadId, reason: `Loan type mismatch: ${lead.loan_type} vs ${targetBde.assigned_loan_type}` })
          continue
        }

        selectedBDE = targetBde
      }

      // Reassign lead
      const { error: reassignError } = await supabase
        .from('leads')
        .update({
          assigned_to_bde: assignToBdeId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      if (reassignError) {
        failed.push({ leadId, reason: 'Failed to update lead' })
        continue
      }

      // Update lead counts
      if (oldBdeId) {
        await supabase.rpc('decrement_lead_count', { bde_id: oldBdeId })
      }

      await supabase
        .from('bde_assignment_settings')
        .update({
          current_lead_count: supabase.rpc('increment', { field: 'current_lead_count' }),
          last_assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', assignToBdeId)

      // Log reassignment
      await supabase.from('lead_assignment_audit').insert({
        lead_id: leadId,
        assigned_to_bde_id: assignToBdeId,
        assignment_type: 'bulk_reassignment',
        assigned_by_bdm_id: bdmId,
        previous_bde_id: oldBdeId,
        assignment_criteria: {
          bulk: true,
          autoDistribute,
          reason,
        },
        assigned_at: new Date().toISOString(),
      })

      // Log BDM action
      await supabase.from('bdm_assignment_actions').insert({
        bdm_user_id: bdmId,
        action_type: 'bulk_reassign_leads',
        target_bde_user_id: assignToBdeId,
        affected_lead_id: leadId,
        old_value: { assigned_to_bde: oldBdeId },
        new_value: { assigned_to_bde: assignToBdeId },
        reason,
        action_timestamp: new Date().toISOString(),
      })

      successful.push({
        leadId,
        leadName: lead.customer_name,
        assignedTo: {
          id: assignToBdeId,
          name: selectedBDE.full_name,
        },
      })
    } catch (error: unknown) {
      failed.push({ leadId, reason: error.message })
    }
  }

  return NextResponse.json({
    success: true,
    message: `Bulk reassignment completed: ${successful.length} successful, ${failed.length} failed`,
    reassignedCount: successful.length,
    failedCount: failed.length,
    successful,
    failed: failed.slice(0, 10), // Return first 10 failures for debugging
  })
}
