/**
 * API Route: CAM Approval Workflow
 * POST /api/cae/cam/approve
 *
 * Handles CAM approval, rejection, and review actions
 *
 * ACCESS CONTROL:
 * - Super Admin: Can approve/reject any CAM
 * - CRO: Can approve/reject any CAM
 * - Operations Manager: Can approve/reject any CAM
 * - Operations Executive: Can mark as reviewed
 * - BDE: Read-only (cannot approve/reject)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


// Roles that can fully approve/reject
const APPROVAL_ROLES = [
  'CRO',
  'OPERATIONS_MANAGER',
]

// Roles that can only review (mark as reviewed)
const REVIEW_ROLES = [
  'OPERATIONS_EXECUTIVE',
  'FINANCE_MANAGER',
  'FINANCE_EXECUTIVE',
]

type ApprovalAction = 'REVIEW' | 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'REJECT' | 'REQUEST_INFO'

interface ApproveCAMRequest {
  cam_id: string
  action: ApprovalAction
  remarks?: string
  conditions?: string[]
  approved_amount?: number
  approved_tenure?: number
  approved_interest_rate?: number
}

interface ApproveCAMResponse {
  success: boolean
  data?: {
    cam_id: string
    status: string
    action: string
    updated_by: string
    updated_at: string
  }
  error?: string
}

interface CAMApprovalLog {
  id?: string
  cam_id: string
  action: string
  action_by: string
  action_by_name: string
  action_by_role: string
  remarks?: string
  conditions?: string[]
  previous_status: string
  new_status: string
  created_at: string
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApproveCAMResponse,
        { status: 401 }
      )
    }

    // Parse request body
    const body: ApproveCAMRequest = await request.json()

    if (!body.cam_id) {
      return NextResponse.json(
        { success: false, error: 'cam_id is required' } as ApproveCAMResponse,
        { status: 400 }
      )
    }

    if (!body.action || !['REVIEW', 'APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'REQUEST_INFO'].includes(body.action)) {
      return NextResponse.json(
        { success: false, error: 'action must be one of: REVIEW, APPROVE, APPROVE_WITH_CONDITIONS, REJECT, REQUEST_INFO' } as ApproveCAMResponse,
        { status: 400 }
      )
    }

    // APPROVE_WITH_CONDITIONS requires conditions
    if (body.action === 'APPROVE_WITH_CONDITIONS' && (!body.conditions || body.conditions.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'conditions are required for APPROVE_WITH_CONDITIONS action' } as ApproveCAMResponse,
        { status: 400 }
      )
    }

    // REJECT requires remarks
    if (body.action === 'REJECT' && !body.remarks) {
      return NextResponse.json(
        { success: false, error: 'remarks are required for REJECT action' } as ApproveCAMResponse,
        { status: 400 }
      )
    }

    // Check user permissions
    const userAccess = await getUserApprovalAccess(supabase, user.id)

    if (!userAccess.canAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied. You do not have permission to perform approval actions.' } as ApproveCAMResponse,
        { status: 403 }
      )
    }

    // Check if action is allowed for user's role
    const requiresFullApproval = ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT'].includes(body.action)

    if (requiresFullApproval && !userAccess.canFullyApprove) {
      return NextResponse.json(
        {
          success: false,
          error: `Your role (${userAccess.subRole}) cannot perform ${body.action}. Only CRO and Operations Manager can approve/reject.`
        } as ApproveCAMResponse,
        { status: 403 }
      )
    }

    // Fetch CAM
    const { data: cam, error: fetchError } = await supabase
      .from('credit_appraisal_memos')
      .select('*')
      .eq('id', body.cam_id)
      .maybeSingle()

    if (fetchError || !cam) {
      return NextResponse.json(
        { success: false, error: 'CAM not found' } as ApproveCAMResponse,
        { status: 404 }
      )
    }

    // Check if CAM is already in a final state
    if (['APPROVED', 'REJECTED'].includes(cam.status) && ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT'].includes(body.action)) {
      return NextResponse.json(
        { success: false, error: `CAM is already ${cam.status}. Cannot modify.` } as ApproveCAMResponse,
        { status: 400 }
      )
    }

    // Determine new status based on action
    let newStatus: string
    switch (body.action) {
      case 'REVIEW':
        newStatus = 'REVIEWED'
        break
      case 'APPROVE':
      case 'APPROVE_WITH_CONDITIONS':
        newStatus = 'APPROVED'
        break
      case 'REJECT':
        newStatus = 'REJECTED'
        break
      case 'REQUEST_INFO':
        newStatus = 'PENDING_INFO'
        break
      default:
        newStatus = cam.status
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    // Add approval-specific fields
    if (body.action === 'APPROVE' || body.action === 'APPROVE_WITH_CONDITIONS') {
      updateData.approved_by = user.id
      updateData.approved_at = new Date().toISOString()
      updateData.approval_remarks = body.remarks || null
      updateData.approval_conditions = body.conditions || []

      if (body.approved_amount) updateData.approved_amount = body.approved_amount
      if (body.approved_tenure) updateData.approved_tenure = body.approved_tenure
      if (body.approved_interest_rate) updateData.approved_interest_rate = body.approved_interest_rate
    } else if (body.action === 'REJECT') {
      updateData.rejected_by = user.id
      updateData.rejected_at = new Date().toISOString()
      updateData.rejection_reason = body.remarks
    } else if (body.action === 'REVIEW') {
      updateData.reviewed_by = user.id
      updateData.reviewed_at = new Date().toISOString()
      updateData.review_remarks = body.remarks || null
    } else if (body.action === 'REQUEST_INFO') {
      updateData.info_requested_by = user.id
      updateData.info_requested_at = new Date().toISOString()
      updateData.info_request_remarks = body.remarks
    }

    // Update CAM
    const { error: updateError } = await supabase
      .from('credit_appraisal_memos')
      .update(updateData)
      .eq('id', body.cam_id)

    if (updateError) {
      apiLogger.error('CAM update error', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update CAM' } as ApproveCAMResponse,
        { status: 500 }
      )
    }

    // Log the approval action
    const approvalLog: CAMApprovalLog = {
      cam_id: body.cam_id,
      action: body.action,
      action_by: user.id,
      action_by_name: userAccess.userName,
      action_by_role: userAccess.subRole || userAccess.role,
      remarks: body.remarks,
      conditions: body.conditions,
      previous_status: cam.status,
      new_status: newStatus,
      created_at: new Date().toISOString(),
    }

    await supabase
      .from('cam_approval_logs')
      .insert(approvalLog)
      .catch(err => apiLogger.error('Failed to log approval', err))

    // Send notification (async, don't wait)
    sendApprovalNotification(supabase, {
      camId: body.cam_id,
      leadId: cam.lead_id,
      action: body.action,
      actionBy: userAccess.userName,
      assignedBdeId: cam.assigned_bde_id,
    }).catch(err => apiLogger.error('Failed to send notification', err))

    return NextResponse.json({
      success: true,
      data: {
        cam_id: body.cam_id,
        status: newStatus,
        action: body.action,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
    } as ApproveCAMResponse)

  } catch (error) {
    apiLogger.error('CAM approval error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as ApproveCAMResponse,
      { status: 500 }
    )
  }
}

/**
 * GET /api/cae/cam/approve?cam_id=xxx
 * Get approval history for a CAM
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const camId = searchParams.get('cam_id')

    if (!camId) {
      return NextResponse.json(
        { success: false, error: 'cam_id is required' },
        { status: 400 }
      )
    }

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch approval logs
    const { data: logs, error } = await supabase
      .from('cam_approval_logs')
      .select('*')
      .eq('cam_id', camId)
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Approval logs fetch error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch approval history' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: logs || [],
        count: logs?.length || 0,
      },
    })

  } catch (error) {
    apiLogger.error('Approval history fetch error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

interface UserApprovalAccess {
  canAccess: boolean
  canFullyApprove: boolean
  role: string
  subRole: string | null
  userName: string
}

async function getUserApprovalAccess(
  supabase: any,
  userId: string
): Promise<UserApprovalAccess> {
  const defaultAccess: UserApprovalAccess = {
    canAccess: false,
    canFullyApprove: false,
    role: 'UNKNOWN',
    subRole: null,
    userName: 'Unknown User',
  }

  // Check super admin
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (superAdmin) {
    const { data: user } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()

    return {
      canAccess: true,
      canFullyApprove: true,
      role: 'SUPER_ADMIN',
      subRole: null,
      userName: user?.full_name || 'Super Admin',
    }
  }

  // Check users table for admin role
  const { data: adminUser } = await supabase
    .from('users')
    .select('id, role, full_name')
    .eq('id', userId)
    .in('role', ['SUPER_ADMIN', 'ADMIN'])
    .maybeSingle()

  if (adminUser) {
    return {
      canAccess: true,
      canFullyApprove: true,
      role: adminUser.role,
      subRole: null,
      userName: adminUser.full_name || 'Admin',
    }
  }

  // Check employee
  const { data: employee } = await supabase
    .from('employees')
    .select(`
      id,
      sub_role,
      user_id,
      employee_status,
      users!inner (
        full_name
      )
    `)
    .eq('user_id', userId)
    .eq('employee_status', 'ACTIVE')
    .maybeSingle()

  if (!employee) {
    return defaultAccess
  }

  const canFullyApprove = APPROVAL_ROLES.includes(employee.sub_role)
  const canReview = REVIEW_ROLES.includes(employee.sub_role)

  return {
    canAccess: canFullyApprove || canReview,
    canFullyApprove,
    role: 'EMPLOYEE',
    subRole: employee.sub_role,
    userName: employee.users?.full_name || 'Employee',
  }
}

interface NotificationParams {
  camId: string
  leadId: string
  action: string
  actionBy: string
  assignedBdeId?: string
}

async function sendApprovalNotification(
  supabase: any,
  params: NotificationParams
): Promise<void> {
  const { camId, leadId, action, actionBy, assignedBdeId } = params

  // Get lead details for notification
  const { data: lead } = await supabase
    .from('partner_leads')
    .select('lead_id, customer_name')
    .eq('id', leadId)
    .maybeSingle()

  const leadNumber = lead?.lead_id || camId
  const customerName = lead?.customer_name || 'Customer'

  // Determine notification message
  let title: string
  let message: string

  switch (action) {
    case 'APPROVE':
      title = 'CAM Approved'
      message = `CAM for ${customerName} (${leadNumber}) has been approved by ${actionBy}.`
      break
    case 'APPROVE_WITH_CONDITIONS':
      title = 'CAM Approved with Conditions'
      message = `CAM for ${customerName} (${leadNumber}) has been approved with conditions by ${actionBy}.`
      break
    case 'REJECT':
      title = 'CAM Rejected'
      message = `CAM for ${customerName} (${leadNumber}) has been rejected by ${actionBy}.`
      break
    case 'REVIEW':
      title = 'CAM Reviewed'
      message = `CAM for ${customerName} (${leadNumber}) has been reviewed by ${actionBy}.`
      break
    case 'REQUEST_INFO':
      title = 'Additional Information Required'
      message = `Additional information has been requested for ${customerName} (${leadNumber}) by ${actionBy}.`
      break
    default:
      return
  }

  // Create notification for assigned BDE
  if (assignedBdeId) {
    await supabase.from('notifications').insert({
      user_id: assignedBdeId,
      title,
      message,
      type: 'CAM_STATUS_UPDATE',
      entity_type: 'CAM',
      entity_id: camId,
      is_read: false,
      created_at: new Date().toISOString(),
    }).catch(() => { /* Non-critical side effect */ })
  }

  // Create notification for operations team (for REVIEW action from BDE side)
  if (action === 'REQUEST_INFO') {
    const { data: opsUsers } = await supabase
      .from('employees')
      .select('user_id')
      .in('sub_role', ['CRO', 'OPERATIONS_MANAGER', 'OPERATIONS_EXECUTIVE'])
      .eq('employee_status', 'ACTIVE')

    if (opsUsers && opsUsers.length > 0) {
      const notifications = opsUsers.map((u: any) => ({
        user_id: u.user_id,
        title,
        message,
        type: 'CAM_STATUS_UPDATE',
        entity_type: 'CAM',
        entity_id: camId,
        is_read: false,
        created_at: new Date().toISOString(),
      }))

      await supabase.from('notifications').insert(notifications).catch(() => { /* Non-critical side effect */ })
    }
  }
}
