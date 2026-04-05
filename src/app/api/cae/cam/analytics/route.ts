/**
 * API Route: CAM Analytics
 * GET /api/cae/cam/analytics
 *
 * Provides comprehensive analytics for Credit Appraisal Memos
 *
 * Query Parameters:
 * - period: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' (default: 'month')
 * - group_by: 'day' | 'week' | 'month' (default: based on period)
 *
 * ACCESS CONTROL:
 * - Super Admin: Full analytics
 * - Operations/Finance: Full analytics
 * - BDE: Only their own analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// Full access roles
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

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all'

interface CAMAnalyticsResponse {
  success: boolean
  data?: {
    summary: {
      total_cams: number
      approved_count: number
      rejected_count: number
      pending_count: number
      conditional_count: number
      approval_rate: number
      avg_processing_time_hours: number
      avg_risk_score: number
      avg_credit_score: number
      total_loan_amount: number
      total_approved_amount: number
    }
    by_status: Array<{
      status: string
      count: number
      percentage: number
    }>
    by_risk_grade: Array<{
      risk_grade: string
      count: number
      percentage: number
      avg_credit_score: number
    }>
    by_recommendation: Array<{
      recommendation: string
      count: number
      percentage: number
    }>
    by_loan_type: Array<{
      loan_type: string
      count: number
      total_amount: number
      approved_count: number
      avg_amount: number
    }>
    trend: Array<{
      period: string
      total: number
      approved: number
      rejected: number
      pending: number
    }>
    top_performers?: Array<{
      user_id: string
      user_name: string
      cams_processed: number
      approval_rate: number
    }>
    recent_approvals: Array<{
      cam_id: string
      lead_number: string
      customer_name: string
      loan_type: string
      approved_amount: number
      approved_by_name: string
      approved_at: string
    }>
    recent_rejections: Array<{
      cam_id: string
      lead_number: string
      customer_name: string
      loan_type: string
      rejection_reason: string
      rejected_by_name: string
      rejected_at: string
    }>
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

    const period = (searchParams.get('period') || 'month') as Period

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as CAMAnalyticsResponse,
        { status: 401 }
      )
    }

    // Check access level
    const accessLevel = await getAccessLevel(supabase, user.id)

    if (accessLevel === 'NONE') {
      return NextResponse.json(
        { success: false, error: 'Access denied' } as CAMAnalyticsResponse,
        { status: 403 }
      )
    }

    // Calculate date range
    const dateRange = getDateRange(period)

    // Build base query
    let baseQuery = supabase
      .from('credit_appraisal_memos')
      .select('*')
      .eq('is_latest', true)
      .gte('created_at', dateRange.start.toISOString())

    if (dateRange.end) {
      baseQuery = baseQuery.lte('created_at', dateRange.end.toISOString())
    }

    // Apply BDE filter
    if (accessLevel === 'BDE_ONLY') {
      baseQuery = baseQuery.eq('assigned_bde_id', user.id)
    }

    const { data: cams, error } = await baseQuery

    if (error) {
      apiLogger.error('Analytics fetch error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch analytics' } as CAMAnalyticsResponse,
        { status: 500 }
      )
    }

    const camList = cams || []

    // Calculate summary statistics
    const summary = calculateSummary(camList)

    // Calculate breakdowns
    const byStatus = calculateByStatus(camList)
    const byRiskGrade = calculateByRiskGrade(camList)
    const byRecommendation = calculateByRecommendation(camList)

    // Get loan type breakdown with lead data
    const byLoanType = await calculateByLoanType(supabase, camList)

    // Calculate trend
    const trend = calculateTrend(camList, period)

    // Get top performers (only for full access)
    let topPerformers: any[] | undefined
    if (accessLevel === 'FULL') {
      topPerformers = await getTopPerformers(supabase, dateRange)
    }

    // Get recent approvals and rejections
    const recentApprovals = await getRecentApprovals(supabase, accessLevel, user.id, 5)
    const recentRejections = await getRecentRejections(supabase, accessLevel, user.id, 5)

    return NextResponse.json({
      success: true,
      data: {
        summary,
        by_status: byStatus,
        by_risk_grade: byRiskGrade,
        by_recommendation: byRecommendation,
        by_loan_type: byLoanType,
        trend,
        top_performers: topPerformers,
        recent_approvals: recentApprovals,
        recent_rejections: recentRejections,
      },
    } as CAMAnalyticsResponse)

  } catch (error) {
    apiLogger.error('CAM analytics error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as CAMAnalyticsResponse,
      { status: 500 }
    )
  }
}

async function getAccessLevel(
  supabase: any,
  userId: string
): Promise<'FULL' | 'BDE_ONLY' | 'NONE'> {
  // Check super admin
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (superAdmin) return 'FULL'

  // Check admin role
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

function getDateRange(period: Period): { start: Date; end: Date | null } {
  const now = new Date()
  let start: Date

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      start = new Date(now)
      start.setDate(now.getDate() - 7)
      break
    case 'month':
      start = new Date(now)
      start.setMonth(now.getMonth() - 1)
      break
    case 'quarter':
      start = new Date(now)
      start.setMonth(now.getMonth() - 3)
      break
    case 'year':
      start = new Date(now)
      start.setFullYear(now.getFullYear() - 1)
      break
    case 'all':
    default:
      start = new Date('2020-01-01')
      break
  }

  return { start, end: now }
}

function calculateSummary(cams: any[]) {
  const total = cams.length

  const approved = cams.filter(c =>
    c.recommendation === 'APPROVE' || c.status === 'APPROVED'
  ).length

  const rejected = cams.filter(c =>
    c.recommendation === 'REJECT' || c.status === 'REJECTED'
  ).length

  const conditional = cams.filter(c =>
    c.recommendation === 'APPROVE_WITH_CONDITIONS'
  ).length

  const pending = total - approved - rejected

  const riskScores = cams.filter(c => c.risk_score).map(c => c.risk_score)
  const avgRiskScore = riskScores.length > 0
    ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
    : 0

  const creditScores = cams.filter(c => c.credit_score).map(c => c.credit_score)
  const avgCreditScore = creditScores.length > 0
    ? Math.round(creditScores.reduce((a, b) => a + b, 0) / creditScores.length)
    : 0

  const totalLoanAmount = cams.reduce((sum, c) => sum + (c.loan_amount || 0), 0)
  const totalApprovedAmount = cams
    .filter(c => c.status === 'APPROVED')
    .reduce((sum, c) => sum + (c.approved_amount || c.recommended_amount || 0), 0)

  // Calculate avg processing time (from created_at to approved_at/rejected_at)
  const processedCams = cams.filter(c =>
    (c.approved_at || c.rejected_at) && c.created_at
  )
  let avgProcessingTime = 0
  if (processedCams.length > 0) {
    const totalHours = processedCams.reduce((sum, c) => {
      const created = new Date(c.created_at).getTime()
      const processed = new Date(c.approved_at || c.rejected_at).getTime()
      return sum + (processed - created) / (1000 * 60 * 60)
    }, 0)
    avgProcessingTime = Math.round((totalHours / processedCams.length) * 10) / 10
  }

  return {
    total_cams: total,
    approved_count: approved,
    rejected_count: rejected,
    pending_count: pending,
    conditional_count: conditional,
    approval_rate: total > 0 ? Math.round(((approved + conditional) / total) * 100) : 0,
    avg_processing_time_hours: avgProcessingTime,
    avg_risk_score: avgRiskScore,
    avg_credit_score: avgCreditScore,
    total_loan_amount: totalLoanAmount,
    total_approved_amount: totalApprovedAmount,
  }
}

function calculateByStatus(cams: any[]) {
  const total = cams.length
  const statusCounts: Record<string, number> = {}

  cams.forEach(c => {
    const status = c.status || 'UNKNOWN'
    statusCounts[status] = (statusCounts[status] || 0) + 1
  })

  return Object.entries(statusCounts)
    .map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

function calculateByRiskGrade(cams: any[]) {
  const total = cams.length
  const gradeCounts: Record<string, { count: number; creditScores: number[] }> = {}

  cams.forEach(c => {
    const grade = c.risk_grade || 'UNKNOWN'
    if (!gradeCounts[grade]) {
      gradeCounts[grade] = { count: 0, creditScores: [] }
    }
    gradeCounts[grade].count++
    if (c.credit_score) {
      gradeCounts[grade].creditScores.push(c.credit_score)
    }
  })

  return Object.entries(gradeCounts)
    .map(([risk_grade, data]) => ({
      risk_grade,
      count: data.count,
      percentage: total > 0 ? Math.round((data.count / total) * 100) : 0,
      avg_credit_score: data.creditScores.length > 0
        ? Math.round(data.creditScores.reduce((a, b) => a + b, 0) / data.creditScores.length)
        : 0,
    }))
    .sort((a, b) => {
      const gradeOrder = ['A', 'B', 'C', 'D', 'E', 'UNKNOWN']
      return gradeOrder.indexOf(a.risk_grade) - gradeOrder.indexOf(b.risk_grade)
    })
}

function calculateByRecommendation(cams: any[]) {
  const total = cams.length
  const recCounts: Record<string, number> = {}

  cams.forEach(c => {
    const rec = c.recommendation || 'UNKNOWN'
    recCounts[rec] = (recCounts[rec] || 0) + 1
  })

  return Object.entries(recCounts)
    .map(([recommendation, count]) => ({
      recommendation,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

async function calculateByLoanType(supabase: any, cams: any[]) {
  // Get lead IDs to fetch loan types
  const leadIds = cams.map(c => c.lead_id).filter(Boolean)

  if (leadIds.length === 0) {
    return []
  }

  const { data: leads } = await supabase
    .from('partner_leads')
    .select('id, loan_type, required_loan_amount')
    .in('id', leadIds)

  const leadMap = new Map(leads?.map((l: any) => [l.id, l]) || [])

  const loanTypeStats: Record<string, {
    count: number
    totalAmount: number
    approvedCount: number
  }> = {}

  cams.forEach(cam => {
    const lead = leadMap.get(cam.lead_id)
    const loanType = lead?.loan_type || 'Unknown'
    const amount = lead?.required_loan_amount || cam.loan_amount || 0

    if (!loanTypeStats[loanType]) {
      loanTypeStats[loanType] = { count: 0, totalAmount: 0, approvedCount: 0 }
    }

    loanTypeStats[loanType].count++
    loanTypeStats[loanType].totalAmount += amount

    if (cam.status === 'APPROVED') {
      loanTypeStats[loanType].approvedCount++
    }
  })

  return Object.entries(loanTypeStats)
    .map(([loan_type, stats]) => ({
      loan_type,
      count: stats.count,
      total_amount: stats.totalAmount,
      approved_count: stats.approvedCount,
      avg_amount: stats.count > 0 ? Math.round(stats.totalAmount / stats.count) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

function calculateTrend(cams: any[], period: Period) {
  const groupBy = period === 'today' ? 'hour' : period === 'week' ? 'day' : 'week'

  const groups: Record<string, { total: number; approved: number; rejected: number; pending: number }> = {}

  cams.forEach(cam => {
    const date = new Date(cam.created_at)
    let key: string

    if (groupBy === 'hour') {
      key = `${date.getHours()}:00`
    } else if (groupBy === 'day') {
      key = date.toISOString().split('T')[0]
    } else {
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      key = weekStart.toISOString().split('T')[0]
    }

    if (!groups[key]) {
      groups[key] = { total: 0, approved: 0, rejected: 0, pending: 0 }
    }

    groups[key].total++

    if (cam.status === 'APPROVED') {
      groups[key].approved++
    } else if (cam.status === 'REJECTED') {
      groups[key].rejected++
    } else {
      groups[key].pending++
    }
  })

  return Object.entries(groups)
    .map(([period, stats]) => ({
      period,
      ...stats,
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

async function getTopPerformers(
  supabase: any,
  dateRange: { start: Date; end: Date | null }
) {
  const { data: approvalLogs } = await supabase
    .from('cam_approval_logs')
    .select('action_by, action_by_name, action')
    .gte('created_at', dateRange.start.toISOString())
    .in('action', ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT'])

  if (!approvalLogs || approvalLogs.length === 0) {
    return []
  }

  const userStats: Record<string, {
    name: string
    total: number
    approved: number
  }> = {}

  approvalLogs.forEach((log: any) => {
    if (!userStats[log.action_by]) {
      userStats[log.action_by] = { name: log.action_by_name, total: 0, approved: 0 }
    }
    userStats[log.action_by].total++
    if (log.action === 'APPROVE' || log.action === 'APPROVE_WITH_CONDITIONS') {
      userStats[log.action_by].approved++
    }
  })

  return Object.entries(userStats)
    .map(([user_id, stats]) => ({
      user_id,
      user_name: stats.name,
      cams_processed: stats.total,
      approval_rate: stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.cams_processed - a.cams_processed)
    .slice(0, 5)
}

async function getRecentApprovals(
  supabase: any,
  accessLevel: 'FULL' | 'BDE_ONLY',
  userId: string,
  limit: number
) {
  let query = supabase
    .from('credit_appraisal_memos')
    .select(`
      id,
      cam_id,
      lead_id,
      approved_amount,
      approved_by,
      approved_at,
      partner_leads!inner (
        lead_id,
        customer_name,
        loan_type
      )
    `)
    .eq('status', 'APPROVED')
    .not('approved_at', 'is', null)
    .order('approved_at', { ascending: false })
    .limit(limit)

  if (accessLevel === 'BDE_ONLY') {
    query = query.eq('assigned_bde_id', userId)
  }

  const { data: cams } = await query

  if (!cams || cams.length === 0) {
    return []
  }

  // Get approver names
  const approverIds = cams.map((c: any) => c.approved_by).filter(Boolean)
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', approverIds)

  const userMap = new Map(users?.map((u: any) => [u.id, u.full_name]) || [])

  return cams.map((cam: any) => ({
    cam_id: cam.cam_id,
    lead_number: cam.partner_leads?.lead_id || '',
    customer_name: cam.partner_leads?.customer_name || '',
    loan_type: cam.partner_leads?.loan_type || '',
    approved_amount: cam.approved_amount || 0,
    approved_by_name: userMap.get(cam.approved_by) || 'Unknown',
    approved_at: cam.approved_at,
  }))
}

async function getRecentRejections(
  supabase: any,
  accessLevel: 'FULL' | 'BDE_ONLY',
  userId: string,
  limit: number
) {
  let query = supabase
    .from('credit_appraisal_memos')
    .select(`
      id,
      cam_id,
      lead_id,
      rejection_reason,
      rejected_by,
      rejected_at,
      partner_leads!inner (
        lead_id,
        customer_name,
        loan_type
      )
    `)
    .eq('status', 'REJECTED')
    .not('rejected_at', 'is', null)
    .order('rejected_at', { ascending: false })
    .limit(limit)

  if (accessLevel === 'BDE_ONLY') {
    query = query.eq('assigned_bde_id', userId)
  }

  const { data: cams } = await query

  if (!cams || cams.length === 0) {
    return []
  }

  // Get rejector names
  const rejectorIds = cams.map((c: any) => c.rejected_by).filter(Boolean)
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', rejectorIds)

  const userMap = new Map(users?.map((u: any) => [u.id, u.full_name]) || [])

  return cams.map((cam: any) => ({
    cam_id: cam.cam_id,
    lead_number: cam.partner_leads?.lead_id || '',
    customer_name: cam.partner_leads?.customer_name || '',
    loan_type: cam.partner_leads?.loan_type || '',
    rejection_reason: cam.rejection_reason || '',
    rejected_by_name: userMap.get(cam.rejected_by) || 'Unknown',
    rejected_at: cam.rejected_at,
  }))
}
