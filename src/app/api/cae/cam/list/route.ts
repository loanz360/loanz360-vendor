/**
 * API Route: List Credit Appraisal Memos
 * GET /api/cae/cam/list
 *
 * Lists all CAMs with filtering, pagination, and role-based access
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - status: Filter by CAM status
 * - risk_grade: Filter by risk grade
 * - recommendation: Filter by recommendation
 * - date_from: Filter by created date (from)
 * - date_to: Filter by created date (to)
 * - search: Search by lead number or customer name
 * - sort_by: Sort field (default: created_at)
 * - sort_order: Sort order (asc/desc, default: desc)
 *
 * ACCESS CONTROL:
 * - Super Admin: All CAMs
 * - Operations/Finance: All CAMs
 * - BDE: Only assigned leads' CAMs
 * - Customers: NO ACCESS
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


// Role configurations
const FULL_ACCESS_SUB_ROLES = [
  'CRO',
  'OPERATIONS_EXECUTIVE',
  'OPERATIONS_MANAGER',
  'FINANCE_EXECUTIVE',
  'FINANCE_MANAGER',
]

const BDE_SUB_ROLES = [
  'BUSINESS_DEVELOPMENT_EXECUTIVE',
  'BUSINESS_DEVELOPMENT_MANAGER',
  'DIGITAL_SALES_EXECUTIVE',
  'DIGITAL_SALES_MANAGER',
  'CHANNEL_PARTNER_EXECUTIVE',
  'CHANNEL_PARTNER_MANAGER',
  'DIRECT_SALES_EXECUTIVE',
  'DIRECT_SALES_MANAGER',
]

interface CAMListItem {
  id: string
  cam_id: string
  lead_id: string
  lead_number: string
  customer_name: string
  loan_type: string
  loan_amount: number
  status: string
  recommendation: string
  risk_grade: string
  credit_score: number
  is_eligible: boolean
  max_eligible_amount: number
  critical_flags_count: number
  high_flags_count: number
  prepared_by_name: string | null
  reviewed_by_name: string | null
  approved_by_name: string | null
  created_at: string
  updated_at: string
}

interface CAMListResponse {
  success: boolean
  data?: {
    items: CAMListItem[]
    pagination: {
      page: number
      limit: number
      total: number
      total_pages: number
    }
    summary: {
      total_cams: number
      approved_count: number
      rejected_count: number
      pending_count: number
      avg_risk_score: number
    }
  }
  error?: string
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    const status = searchParams.get('status')
    const riskGrade = searchParams.get('risk_grade')
    const recommendation = searchParams.get('recommendation')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') === 'asc' ? true : false

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as CAMListResponse,
        { status: 401 }
      )
    }

    // Check access level
    const accessLevel = await getAccessLevel(supabase, user.id)

    if (accessLevel === 'NONE') {
      return NextResponse.json(
        { success: false, error: 'Access denied' } as CAMListResponse,
        { status: 403 }
      )
    }

    // Build query
    let query = supabase
      .from('credit_appraisal_memos')
      .select(`
        id,
        cam_id,
        lead_id,
        status,
        recommendation,
        risk_grade,
        credit_score,
        is_eligible,
        max_eligible_amount,
        critical_flags_count,
        high_flags_count,
        created_at,
        updated_at,
        prepared_by,
        reviewed_by,
        approved_by,
        assigned_bde_id,
        partner_leads!inner (
          lead_id,
          customer_name,
          loan_type,
          required_loan_amount
        )
      `, { count: 'exact' })
      .eq('is_latest', true)

    // Apply BDE filter if not full access
    if (accessLevel === 'BDE_ONLY') {
      query = query.eq('assigned_bde_id', user.id)
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (riskGrade) {
      query = query.eq('risk_grade', riskGrade)
    }
    if (recommendation) {
      query = query.eq('recommendation', recommendation)
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }
    if (search) {
      query = query.or(`partner_leads.lead_id.ilike.%${search}%,partner_leads.customer_name.ilike.%${search}%`)
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder })
      .range(offset, offset + limit - 1)

    const { data: cams, count, error } = await query

    if (error) {
      apiLogger.error('CAM list error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch CAMs' } as CAMListResponse,
        { status: 500 }
      )
    }

    // Get user names for prepared_by, reviewed_by, approved_by
    const userIds = new Set<string>()
    cams?.forEach((cam: unknown) => {
      if (cam.prepared_by) userIds.add(cam.prepared_by)
      if (cam.reviewed_by) userIds.add(cam.reviewed_by)
      if (cam.approved_by) userIds.add(cam.approved_by)
    })

    const userNames: Record<string, string> = {}
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', Array.from(userIds))

      users?.forEach((u: unknown) => {
        userNames[u.id] = u.full_name
      })
    }

    // Transform data
    const items: CAMListItem[] = (cams || []).map((cam: unknown) => ({
      id: cam.id,
      cam_id: cam.cam_id,
      lead_id: cam.lead_id,
      lead_number: cam.partner_leads?.lead_id || '',
      customer_name: cam.partner_leads?.customer_name || '',
      loan_type: cam.partner_leads?.loan_type || '',
      loan_amount: cam.partner_leads?.required_loan_amount || 0,
      status: cam.status,
      recommendation: cam.recommendation,
      risk_grade: cam.risk_grade,
      credit_score: cam.credit_score,
      is_eligible: cam.is_eligible,
      max_eligible_amount: cam.max_eligible_amount,
      critical_flags_count: cam.critical_flags_count || 0,
      high_flags_count: cam.high_flags_count || 0,
      prepared_by_name: cam.prepared_by ? userNames[cam.prepared_by] || null : null,
      reviewed_by_name: cam.reviewed_by ? userNames[cam.reviewed_by] || null : null,
      approved_by_name: cam.approved_by ? userNames[cam.approved_by] || null : null,
      created_at: cam.created_at,
      updated_at: cam.updated_at,
    }))

    // Get summary stats
    const summary = await getCAMSummary(supabase, accessLevel, user.id)

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
        summary,
      },
    } as CAMListResponse)

  } catch (error) {
    apiLogger.error('CAM list error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as CAMListResponse,
      { status: 500 }
    )
  }
}

async function getAccessLevel(
  supabase: unknown,
  userId: string
): Promise<'FULL' | 'BDE_ONLY' | 'NONE'> {
  // Check super admin
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (superAdmin) return 'FULL'

  // Check users table for admin role
  const { data: adminUser } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .in('role', ['SUPER_ADMIN', 'ADMIN'])
    .maybeSingle()

  if (adminUser) return 'FULL'

  // Check employee
  const { data: employee } = await supabase
    .from('employees')
    .select('id, sub_role, user_id, employee_status')
    .eq('user_id', userId)
    .eq('employee_status', 'ACTIVE')
    .maybeSingle()

  if (!employee) return 'NONE'

  if (FULL_ACCESS_SUB_ROLES.includes(employee.sub_role)) {
    return 'FULL'
  }

  if (BDE_SUB_ROLES.includes(employee.sub_role)) {
    return 'BDE_ONLY'
  }

  return 'NONE'
}

async function getCAMSummary(
  supabase: unknown,
  accessLevel: 'FULL' | 'BDE_ONLY',
  userId: string
) {
  let query = supabase
    .from('credit_appraisal_memos')
    .select('status, recommendation, risk_score')
    .eq('is_latest', true)

  if (accessLevel === 'BDE_ONLY') {
    query = query.eq('assigned_bde_id', userId)
  }

  const { data: cams } = await query

  if (!cams || cams.length === 0) {
    return {
      total_cams: 0,
      approved_count: 0,
      rejected_count: 0,
      pending_count: 0,
      avg_risk_score: 0,
    }
  }

  const approvedCount = cams.filter((c: unknown) => c.recommendation === 'APPROVE').length
  const rejectedCount = cams.filter((c: unknown) => c.recommendation === 'REJECT').length
  const pendingCount = cams.filter((c: unknown) =>
    c.status === 'COMPLETED' && !['APPROVE', 'REJECT'].includes(c.recommendation)
  ).length

  const riskScores = cams.filter((c: unknown) => c.risk_score).map((c: unknown) => c.risk_score)
  const avgRiskScore = riskScores.length > 0
    ? Math.round(riskScores.reduce((a: number, b: number) => a + b, 0) / riskScores.length)
    : 0

  return {
    total_cams: cams.length,
    approved_count: approvedCount,
    rejected_count: rejectedCount,
    pending_count: pendingCount,
    avg_risk_score: avgRiskScore,
  }
}
