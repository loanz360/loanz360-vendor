/**
 * API Route: BDE Dashboard
 * GET /api/cae/bde/dashboard
 *
 * Provides BDE with their assigned CAMs, leads, and workload summary
 *
 * ACCESS CONTROL:
 * - BDE: Own dashboard only
 * - Super Admin: Can view any BDE's dashboard with ?bde_id=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


interface DashboardResponse {
  success: boolean
  data?: BDEDashboard
  error?: string
}

interface BDEDashboard {
  bde: {
    id: string
    name: string
    email: string
  }
  summary: {
    total_assigned: number
    pending_action: number
    processing: number
    submitted: number
    approved: number
    rejected: number
    total_loan_amount: number
    avg_processing_days: number
  }
  today: {
    new_assignments: number
    status_updates: number
    approvals: number
    rejections: number
  }
  cams: CAMSummary[]
  pending_actions: PendingAction[]
  performance: {
    conversion_rate: number
    avg_cam_score: number
    this_month_disbursed: number
    this_month_leads: number
  }
}

interface CAMSummary {
  cam_id: string
  lead_id: string
  lead_number: string
  customer_name: string
  loan_type: string
  loan_amount: number
  status: string
  profile_status: string
  risk_grade: string
  eligible_amount: number
  recommended_lender: string | null
  assigned_at: string
  last_updated: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  pending_actions_count: number
}

interface PendingAction {
  cam_id: string
  lead_number: string
  customer_name: string
  action: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  due_by: string | null
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const requestedBdeId = searchParams.get('bde_id')

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as DashboardResponse,
        { status: 401 }
      )
    }

    // Determine which BDE's dashboard to show
    let bdeUserId = user.id
    let isSuperAdmin = false

    // Check if super admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (superAdmin) {
      isSuperAdmin = true
      if (requestedBdeId) {
        bdeUserId = requestedBdeId
      }
    } else if (requestedBdeId && requestedBdeId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied. You can only view your own dashboard.' } as DashboardResponse,
        { status: 403 }
      )
    }

    // Verify user is a BDE (unless super admin viewing someone else)
    if (!isSuperAdmin) {
      const { data: employee } = await supabase
        .from('employees')
        .select('sub_role')
        .eq('user_id', user.id)
        .eq('employee_status', 'ACTIVE')
        .maybeSingle()

      if (!employee || !['BDE', 'BUSINESS_DEVELOPMENT_EXECUTIVE', 'BUSINESS_DEVELOPMENT_MANAGER'].includes(employee.sub_role)) {
        return NextResponse.json(
          { success: false, error: 'Access denied. BDE dashboard is only for BDE role.' } as DashboardResponse,
          { status: 403 }
        )
      }
    }

    // Get BDE info
    const { data: bdeUser } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('id', bdeUserId)
      .maybeSingle()

    if (!bdeUser) {
      return NextResponse.json(
        { success: false, error: 'BDE not found' } as DashboardResponse,
        { status: 404 }
      )
    }

    // Fetch assigned CAMs
    const { data: cams, error: camsError } = await supabase
      .from('credit_appraisal_memos')
      .select(`
        id,
        cam_id,
        lead_id,
        status,
        loan_type,
        requested_amount,
        max_eligible_amount,
        risk_grade,
        final_assessment,
        assigned_at,
        updated_at,
        created_at,
        partner_leads!inner (
          lead_id,
          customer_name,
          loan_amount,
          lead_status
        )
      `)
      .eq('assigned_bde_id', bdeUserId)
      .eq('is_latest', true)
      .order('assigned_at', { ascending: false })
      .limit(100)

    if (camsError) {
      apiLogger.error('Error fetching CAMs', camsError)
    }

    // Calculate summary stats
    const allCams = cams || []
    const summary = calculateSummary(allCams)

    // Get today's activity
    const todayActivity = await getTodayActivity(supabase, bdeUserId)

    // Build CAM summaries with priority
    const camSummaries = buildCAMSummaries(allCams)

    // Extract pending actions
    const pendingActions = extractPendingActions(allCams)

    // Get performance metrics
    const performance = await getPerformanceMetrics(supabase, bdeUserId)

    const dashboard: BDEDashboard = {
      bde: {
        id: bdeUser.id,
        name: bdeUser.full_name || 'Unknown',
        email: bdeUser.email || '',
      },
      summary,
      today: todayActivity,
      cams: camSummaries,
      pending_actions: pendingActions,
      performance,
    }

    return NextResponse.json({
      success: true,
      data: dashboard,
    } as DashboardResponse)

  } catch (error) {
    apiLogger.error('BDE dashboard error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as DashboardResponse,
      { status: 500 }
    )
  }
}

function calculateSummary(cams: unknown[]): BDEDashboard['summary'] {
  const statusCounts: Record<string, number> = {
    PENDING_ACTION: 0,
    PROCESSING: 0,
    SUBMITTED: 0,
    APPROVED: 0,
    REJECTED: 0,
  }

  let totalLoanAmount = 0
  let totalProcessingDays = 0
  let completedCount = 0

  for (const cam of cams) {
    const status = cam.status?.toUpperCase() || 'UNKNOWN'

    // Map status to categories
    if (['GENERATED', 'ASSIGNED', 'PENDING', 'PENDING_INFO'].includes(status)) {
      statusCounts.PENDING_ACTION++
    } else if (['PROCESSING', 'IN_PROGRESS', 'REVIEWED'].includes(status)) {
      statusCounts.PROCESSING++
    } else if (['SUBMITTED', 'SUBMITTED_TO_BANK'].includes(status)) {
      statusCounts.SUBMITTED++
    } else if (['APPROVED', 'DISBURSED', 'COMPLETED'].includes(status)) {
      statusCounts.APPROVED++
      completedCount++
      if (cam.assigned_at && cam.updated_at) {
        const days = Math.ceil(
          (new Date(cam.updated_at).getTime() - new Date(cam.assigned_at).getTime()) / (1000 * 60 * 60 * 24)
        )
        totalProcessingDays += days
      }
    } else if (['REJECTED', 'DECLINED', 'CANCELLED'].includes(status)) {
      statusCounts.REJECTED++
      completedCount++
    }

    totalLoanAmount += cam.requested_amount || 0
  }

  return {
    total_assigned: cams.length,
    pending_action: statusCounts.PENDING_ACTION,
    processing: statusCounts.PROCESSING,
    submitted: statusCounts.SUBMITTED,
    approved: statusCounts.APPROVED,
    rejected: statusCounts.REJECTED,
    total_loan_amount: totalLoanAmount,
    avg_processing_days: completedCount > 0 ? Math.round(totalProcessingDays / completedCount) : 0,
  }
}

async function getTodayActivity(supabase: unknown, bdeUserId: string): Promise<BDEDashboard['today']> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  // New assignments today
  const { count: newAssignments } = await supabase
    .from('credit_appraisal_memos')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_bde_id', bdeUserId)
    .gte('assigned_at', todayISO)

  // Status updates today (from activity log or updated_at)
  const { count: statusUpdates } = await supabase
    .from('credit_appraisal_memos')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_bde_id', bdeUserId)
    .gte('updated_at', todayISO)

  // Approvals today
  const { count: approvals } = await supabase
    .from('credit_appraisal_memos')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_bde_id', bdeUserId)
    .eq('status', 'APPROVED')
    .gte('updated_at', todayISO)

  // Rejections today
  const { count: rejections } = await supabase
    .from('credit_appraisal_memos')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_bde_id', bdeUserId)
    .eq('status', 'REJECTED')
    .gte('updated_at', todayISO)

  return {
    new_assignments: newAssignments || 0,
    status_updates: statusUpdates || 0,
    approvals: approvals || 0,
    rejections: rejections || 0,
  }
}

function buildCAMSummaries(cams: unknown[]): CAMSummary[] {
  return cams.map(cam => {
    const finalAssessment = cam.final_assessment || {}
    const lead = cam.partner_leads || {}

    // Determine priority based on status and age
    const priority = determinePriority(cam)

    return {
      cam_id: cam.cam_id || cam.id,
      lead_id: cam.lead_id,
      lead_number: lead.lead_id || cam.lead_id,
      customer_name: lead.customer_name || 'Unknown',
      loan_type: cam.loan_type || 'Unknown',
      loan_amount: cam.requested_amount || lead.loan_amount || 0,
      status: cam.status || 'UNKNOWN',
      profile_status: finalAssessment.profile_status || 'PENDING',
      risk_grade: cam.risk_grade || 'N/A',
      eligible_amount: cam.max_eligible_amount || 0,
      recommended_lender: finalAssessment.recommended_lender_name || null,
      assigned_at: cam.assigned_at || cam.created_at,
      last_updated: cam.updated_at,
      priority,
      pending_actions_count: finalAssessment.pending_actions?.length || 0,
    }
  })
}

function determinePriority(cam: unknown): 'HIGH' | 'MEDIUM' | 'LOW' {
  // High priority: Pending action, assigned > 2 days ago
  const assignedAt = new Date(cam.assigned_at || cam.created_at)
  const daysSinceAssigned = Math.ceil((Date.now() - assignedAt.getTime()) / (1000 * 60 * 60 * 24))
  const status = cam.status?.toUpperCase() || ''

  if (['PENDING_INFO', 'REQUIRES_REVIEW'].includes(status)) {
    return 'HIGH'
  }

  if (daysSinceAssigned > 5) {
    return 'HIGH'
  }

  if (daysSinceAssigned > 2 || ['GENERATED', 'ASSIGNED', 'PENDING'].includes(status)) {
    return 'MEDIUM'
  }

  return 'LOW'
}

function extractPendingActions(cams: unknown[]): PendingAction[] {
  const actions: PendingAction[] = []

  for (const cam of cams) {
    const finalAssessment = cam.final_assessment || {}
    const lead = cam.partner_leads || {}

    // Add explicit pending actions
    if (finalAssessment.pending_actions && Array.isArray(finalAssessment.pending_actions)) {
      for (const action of finalAssessment.pending_actions.slice(0, 3)) {
        actions.push({
          cam_id: cam.cam_id || cam.id,
          lead_number: lead.lead_id || cam.lead_id,
          customer_name: lead.customer_name || 'Unknown',
          action: action.action,
          priority: action.priority || 'MEDIUM',
          due_by: action.due_by,
        })
      }
    }

    // Add implicit actions based on status
    const status = cam.status?.toUpperCase()
    if (status === 'GENERATED' || status === 'ASSIGNED') {
      actions.push({
        cam_id: cam.cam_id || cam.id,
        lead_number: lead.lead_id || cam.lead_id,
        customer_name: lead.customer_name || 'Unknown',
        action: 'Review CAM and initiate bank submission',
        priority: 'MEDIUM',
        due_by: null,
      })
    }

    if (status === 'PENDING_INFO') {
      actions.push({
        cam_id: cam.cam_id || cam.id,
        lead_number: lead.lead_id || cam.lead_id,
        customer_name: lead.customer_name || 'Unknown',
        action: 'Collect additional information requested',
        priority: 'HIGH',
        due_by: null,
      })
    }
  }

  // Sort by priority and limit
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  return actions
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 20)
}

async function getPerformanceMetrics(supabase: unknown, bdeUserId: string): Promise<BDEDashboard['performance']> {
  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)
  const thisMonthISO = thisMonth.toISOString()

  // This month's leads
  const { count: monthLeads } = await supabase
    .from('credit_appraisal_memos')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_bde_id', bdeUserId)
    .gte('assigned_at', thisMonthISO)

  // This month's disbursed
  const { data: disbursed } = await supabase
    .from('credit_appraisal_memos')
    .select('requested_amount')
    .eq('assigned_bde_id', bdeUserId)
    .in('status', ['DISBURSED', 'COMPLETED'])
    .gte('updated_at', thisMonthISO)

  const monthDisbursed = disbursed?.reduce((sum: number, d: unknown) => sum + (d.requested_amount || 0), 0) || 0

  // Overall conversion rate
  const { count: totalClosed } = await supabase
    .from('credit_appraisal_memos')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_bde_id', bdeUserId)
    .in('status', ['APPROVED', 'DISBURSED', 'COMPLETED', 'REJECTED', 'DECLINED'])

  const { count: totalApproved } = await supabase
    .from('credit_appraisal_memos')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_bde_id', bdeUserId)
    .in('status', ['APPROVED', 'DISBURSED', 'COMPLETED'])

  const conversionRate = totalClosed > 0 ? Math.round((totalApproved / totalClosed) * 100) : 0

  // Average CAM score (using risk_score inversely)
  const { data: scores } = await supabase
    .from('credit_appraisal_memos')
    .select('risk_score')
    .eq('assigned_bde_id', bdeUserId)
    .not('risk_score', 'is', null)
    .limit(50)

  const avgCamScore = scores && scores.length > 0
    ? Math.round(100 - (scores.reduce((sum: number, s: unknown) => sum + (s.risk_score || 50), 0) / scores.length))
    : 0

  return {
    conversion_rate: conversionRate,
    avg_cam_score: avgCamScore,
    this_month_disbursed: monthDisbursed,
    this_month_leads: monthLeads || 0,
  }
}
