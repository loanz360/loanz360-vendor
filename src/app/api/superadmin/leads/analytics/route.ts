/**
 * Super Admin Leads Analytics API
 * GET /api/superadmin/leads/analytics
 *
 * Provides comprehensive analytics with growth trends
 * Supports filtering by month, state, and loan type
 *
 * Rate Limit: 10 requests per hour (expensive operation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { expensiveRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  return expensiveRateLimiter(request, async (req) => {
    return await getAnalyticsHandler(req)
  })
}

async function getAnalyticsHandler(request: NextRequest) {
  try {
    // Use unified auth (FIXED: was weak cookie check)
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month') // Format: 2025-01
    const state = searchParams.get('state')
    const loanType = searchParams.get('loan_type')
    // Helper function to calculate growth percentage
    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0
      return ((current - previous) / previous) * 100
    }

    // Helper function to get date ranges
    const getDateRanges = (period: 'today' | 'month' | 'year') => {
      const now = new Date()
      const currentStart = new Date()
      const currentEnd = new Date()
      const previousStart = new Date()
      const previousEnd = new Date()

      if (period === 'today') {
        currentStart.setHours(0, 0, 0, 0)
        currentEnd.setHours(23, 59, 59, 999)
        previousStart.setDate(now.getDate() - 1)
        previousStart.setHours(0, 0, 0, 0)
        previousEnd.setDate(now.getDate() - 1)
        previousEnd.setHours(23, 59, 59, 999)
      } else if (period === 'month') {
        currentStart.setDate(1)
        currentStart.setHours(0, 0, 0, 0)
        previousStart.setMonth(now.getMonth() - 1)
        previousStart.setDate(1)
        previousStart.setHours(0, 0, 0, 0)
        previousEnd.setMonth(now.getMonth())
        previousEnd.setDate(0)
        previousEnd.setHours(23, 59, 59, 999)
      } else if (period === 'year') {
        currentStart.setMonth(0, 1)
        currentStart.setHours(0, 0, 0, 0)
        previousStart.setFullYear(now.getFullYear() - 1)
        previousStart.setMonth(0, 1)
        previousStart.setHours(0, 0, 0, 0)
        previousEnd.setFullYear(now.getFullYear() - 1)
        previousEnd.setMonth(11, 31)
        previousEnd.setHours(23, 59, 59, 999)
      }

      return {
        currentStart: currentStart.toISOString(),
        currentEnd: currentEnd.toISOString(),
        previousStart: previousStart.toISOString(),
        previousEnd: previousEnd.toISOString(),
      }
    }

    // Build base query with filters
    const buildQuery = (table: any, dateField: string, startDate?: string, endDate?: string) => {
      let query = table.select('*', { count: 'exact' })

      if (month && month !== 'all') {
        const [year, monthNum] = month.split('-')
        const monthStart = new Date(`${year}-${monthNum}-01T00:00:00Z`)
        const monthEnd = new Date(monthStart)
        monthEnd.setMonth(monthEnd.getMonth() + 1)
        monthEnd.setDate(0)
        monthEnd.setHours(23, 59, 59, 999)

        query = query
          .gte(dateField, monthStart.toISOString())
          .lte(dateField, monthEnd.toISOString())
      } else if (startDate && endDate) {
        query = query.gte(dateField, startDate).lte(dateField, endDate)
      }

      if (state && state !== 'all') {
        query = query.eq('state', state)
      }

      if (loanType && loanType !== 'all') {
        query = query.eq('loan_type', loanType)
      }

      return query
    }

    // LINE 1: TIME-BASED LEADS
    const todayRanges = getDateRanges('today')
    const monthRanges = getDateRanges('month')
    const yearRanges = getDateRanges('year')

    const [todayCurrent, todayPrevious, monthCurrent, monthPrevious, yearCurrent, yearPrevious] = await Promise.all([
      buildQuery(supabase.from('leads'), 'created_at', todayRanges.currentStart, todayRanges.currentEnd),
      buildQuery(supabase.from('leads'), 'created_at', todayRanges.previousStart, todayRanges.previousEnd),
      buildQuery(supabase.from('leads'), 'created_at', monthRanges.currentStart, monthRanges.currentEnd),
      buildQuery(supabase.from('leads'), 'created_at', monthRanges.previousStart, monthRanges.previousEnd),
      buildQuery(supabase.from('leads'), 'created_at', yearRanges.currentStart, yearRanges.currentEnd),
      buildQuery(supabase.from('leads'), 'created_at', yearRanges.previousStart, yearRanges.previousEnd),
    ])

    // LINE 2: LEAD STATUS
    const [
      leadsReceivedCurrent,
      leadsReceivedPrevious,
      leadsInProcessCurrent,
      leadsInProcessPrevious,
      leadsRejectedCurrent,
      leadsRejectedPrevious,
      leadsSanctionedCurrent,
      leadsSanctionedPrevious,
      leadsDroppedCurrent,
      leadsDroppedPrevious,
    ] = await Promise.all([
      // Received (NEW status)
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).eq('lead_status', 'NEW'), 'created_at'),
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).eq('lead_status', 'NEW'), 'created_at', monthRanges.previousStart, monthRanges.previousEnd),
      // In Process (IN_PROGRESS, UNDER_REVIEW)
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).in('lead_status', ['IN_PROGRESS', 'UNDER_REVIEW']), 'created_at'),
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).in('lead_status', ['IN_PROGRESS', 'UNDER_REVIEW']), 'created_at', monthRanges.previousStart, monthRanges.previousEnd),
      // Rejected
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).eq('lead_status', 'REJECTED'), 'created_at'),
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).eq('lead_status', 'REJECTED'), 'created_at', monthRanges.previousStart, monthRanges.previousEnd),
      // Sanctioned (APPROVED)
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).eq('lead_status', 'APPROVED'), 'created_at'),
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).eq('lead_status', 'APPROVED'), 'created_at', monthRanges.previousStart, monthRanges.previousEnd),
      // Dropped
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).eq('lead_status', 'DROPPED'), 'created_at'),
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).eq('lead_status', 'DROPPED'), 'created_at', monthRanges.previousStart, monthRanges.previousEnd),
    ])

    // LINE 3: SOURCE ANALYSIS
    const [
      sourcePartnersCurrent,
      sourcePartnersPrevious,
      sourceEmployeesCurrent,
      sourceEmployeesPrevious,
      sourceCustomerRefCurrent,
      sourceCustomerRefPrevious,
      sourceDirectCurrent,
      sourceDirectPrevious,
    ] = await Promise.all([
      // Partners (BA, BP, CP)
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).or('referral_id.like.BA-%,referral_id.like.BP-%,referral_id.like.CP-%'), 'created_at'),
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).or('referral_id.like.BA-%,referral_id.like.BP-%,referral_id.like.CP-%'), 'created_at', monthRanges.previousStart, monthRanges.previousEnd),
      // Employees
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).ilike('referral_id', 'EMP-%'), 'created_at'),
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).ilike('referral_id', 'EMP-%'), 'created_at', monthRanges.previousStart, monthRanges.previousEnd),
      // Customer Referred (CUST prefix but not LOANZ360)
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).ilike('referral_id', 'CUST%').neq('referral_id', 'LOANZ360'), 'created_at'),
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).ilike('referral_id', 'CUST%').neq('referral_id', 'LOANZ360'), 'created_at', monthRanges.previousStart, monthRanges.previousEnd),
      // Direct (LOANZ360)
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).eq('referral_id', 'LOANZ360'), 'created_at'),
      buildQuery(supabase.from('leads').select('*', { count: 'exact' }).eq('referral_id', 'LOANZ360'), 'created_at', monthRanges.previousStart, monthRanges.previousEnd),
    ])

    // LINE 4: LOAN AMOUNTS
    const getLoanAmounts = async (status: string[], isPrevious = false) => {
      const dateRange = isPrevious
        ? { start: monthRanges.previousStart, end: monthRanges.previousEnd }
        : { start: monthRanges.currentStart, end: monthRanges.currentEnd }

      let query = supabase.from('leads').select('loan_amount')

      if (status.length > 0) {
        query = query.in('lead_status', status)
      }

      if (!month || month === 'all') {
        if (isPrevious) {
          query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end)
        }
      } else {
        const [year, monthNum] = month.split('-')
        const monthStart = new Date(`${year}-${monthNum}-01T00:00:00Z`)
        const monthEnd = new Date(monthStart)
        monthEnd.setMonth(monthEnd.getMonth() + 1)
        monthEnd.setDate(0)
        monthEnd.setHours(23, 59, 59, 999)

        query = query.gte('created_at', monthStart.toISOString()).lte('created_at', monthEnd.toISOString())
      }

      if (state && state !== 'all') {
        query = query.eq('state', state)
      }

      if (loanType && loanType !== 'all') {
        query = query.eq('loan_type', loanType)
      }

      const { data, error } = await query
      if (error) throw error

      return data?.reduce((sum, lead) => sum + (lead.loan_amount || 0), 0) || 0
    }

    const [
      loanAmountLoginCurrent,
      loanAmountLoginPrevious,
      loanAmountProcessCurrent,
      loanAmountProcessPrevious,
      loanAmountSanctionCurrent,
      loanAmountSanctionPrevious,
      loanAmountDroppedCurrent,
      loanAmountDroppedPrevious,
      loanAmountRejectedCurrent,
      loanAmountRejectedPrevious,
    ] = await Promise.all([
      getLoanAmounts(['NEW']), // Login = NEW leads
      getLoanAmounts(['NEW'], true),
      getLoanAmounts(['IN_PROGRESS', 'UNDER_REVIEW']), // Process
      getLoanAmounts(['IN_PROGRESS', 'UNDER_REVIEW'], true),
      getLoanAmounts(['APPROVED']), // Sanctioned
      getLoanAmounts(['APPROVED'], true),
      getLoanAmounts(['DROPPED']), // Dropped
      getLoanAmounts(['DROPPED'], true),
      getLoanAmounts(['REJECTED']), // Rejected
      getLoanAmounts(['REJECTED'], true),
    ])

    // Calculate all analytics with growth
    const analytics = {
      // Line 1: Time-based
      todayLeads: {
        count: todayCurrent.count || 0,
        growth: calculateGrowth(todayCurrent.count || 0, todayPrevious.count || 0),
      },
      thisMonthLeads: {
        count: monthCurrent.count || 0,
        growth: calculateGrowth(monthCurrent.count || 0, monthPrevious.count || 0),
      },
      thisYearLeads: {
        count: yearCurrent.count || 0,
        growth: calculateGrowth(yearCurrent.count || 0, yearPrevious.count || 0),
      },

      // Line 2: Lead Status
      leadsReceived: {
        count: leadsReceivedCurrent.count || 0,
        growth: calculateGrowth(leadsReceivedCurrent.count || 0, leadsReceivedPrevious.count || 0),
      },
      leadsInProcess: {
        count: leadsInProcessCurrent.count || 0,
        growth: calculateGrowth(leadsInProcessCurrent.count || 0, leadsInProcessPrevious.count || 0),
      },
      leadsRejected: {
        count: leadsRejectedCurrent.count || 0,
        growth: calculateGrowth(leadsRejectedCurrent.count || 0, leadsRejectedPrevious.count || 0),
      },
      leadsSanctioned: {
        count: leadsSanctionedCurrent.count || 0,
        growth: calculateGrowth(leadsSanctionedCurrent.count || 0, leadsSanctionedPrevious.count || 0),
      },
      leadsDropped: {
        count: leadsDroppedCurrent.count || 0,
        growth: calculateGrowth(leadsDroppedCurrent.count || 0, leadsDroppedPrevious.count || 0),
      },

      // Line 3: Source
      sourcePartners: {
        count: sourcePartnersCurrent.count || 0,
        growth: calculateGrowth(sourcePartnersCurrent.count || 0, sourcePartnersPrevious.count || 0),
      },
      sourceEmployees: {
        count: sourceEmployeesCurrent.count || 0,
        growth: calculateGrowth(sourceEmployeesCurrent.count || 0, sourceEmployeesPrevious.count || 0),
      },
      sourceCustomerReferred: {
        count: sourceCustomerRefCurrent.count || 0,
        growth: calculateGrowth(sourceCustomerRefCurrent.count || 0, sourceCustomerRefPrevious.count || 0),
      },
      sourceDirectCustomer: {
        count: sourceDirectCurrent.count || 0,
        growth: calculateGrowth(sourceDirectCurrent.count || 0, sourceDirectPrevious.count || 0),
      },

      // Line 4: Loan Amounts
      loanAmountLogin: {
        amount: loanAmountLoginCurrent,
        growth: calculateGrowth(loanAmountLoginCurrent, loanAmountLoginPrevious),
      },
      loanAmountProcess: {
        amount: loanAmountProcessCurrent,
        growth: calculateGrowth(loanAmountProcessCurrent, loanAmountProcessPrevious),
      },
      loanAmountSanction: {
        amount: loanAmountSanctionCurrent,
        growth: calculateGrowth(loanAmountSanctionCurrent, loanAmountSanctionPrevious),
      },
      loanAmountDropped: {
        amount: loanAmountDroppedCurrent,
        growth: calculateGrowth(loanAmountDroppedCurrent, loanAmountDroppedPrevious),
      },
      loanAmountRejected: {
        amount: loanAmountRejectedCurrent,
        growth: calculateGrowth(loanAmountRejectedCurrent, loanAmountRejectedPrevious),
      },
    }

    return NextResponse.json({
      success: true,
      analytics,
      filters: {
        month: month || 'all',
        state: state || 'all',
        loan_type: loanType || 'all',
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching analytics', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics',
      },
      { status: 500 }
    )
  }
}
