/**
 * API Route: Payout Analytics
 * GET /api/superadmin/payouts/analytics
 * Returns comprehensive analytics for payout management dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface PayoutAnalyticsResponse {
  success: boolean
  data?: {
    overview: {
      total_commissions_paid: number
      total_commissions_pending: number
      total_amount_paid: number
      total_amount_pending: number
      avg_commission_amount: number
      total_partners: number
    }
    trends: {
      period: string // 'YYYY-MM'
      total_commissions: number
      total_amount: number
      ba_count: number
      bp_count: number
      ba_amount: number
      bp_amount: number
    }[]
    partner_breakdown: {
      partner_type: string
      total_commissions: number
      total_amount: number
      avg_amount: number
      pending_count: number
      pending_amount: number
    }[]
    top_performers: {
      partner_id: string
      partner_name: string
      partner_type: string
      total_commissions: number
      total_amount: number
      avg_amount: number
    }[]
    product_breakdown: {
      loan_product: string
      total_commissions: number
      total_amount: number
      avg_amount: number
    }[]
    recent_batches: {
      batch_id: string
      batch_number: string
      partner_type: string
      total_leads: number
      total_amount: number
      status: string
      created_at: string
    }[]
  }
  error?: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()

    // 1. Authenticate
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized || !auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Get Overview Statistics
    const { data: overviewData, error: overviewError } = await supabase
      .from('leads')
      .select('commission_status, commission_amount')
      .not('commission_amount', 'is', null)

    if (overviewError) {
      throw new Error('Failed to fetch overview data')
    }

    const totalPaid = overviewData?.filter(l => l.commission_status === 'PAID').length || 0
    const totalPending = overviewData?.filter(l => l.commission_status === 'CALCULATED').length || 0
    const totalAmountPaid = overviewData
      ?.filter(l => l.commission_status === 'PAID')
      .reduce((sum, l) => sum + (l.commission_amount || 0), 0) || 0
    const totalAmountPending = overviewData
      ?.filter(l => l.commission_status === 'CALCULATED')
      .reduce((sum, l) => sum + (l.commission_amount || 0), 0) || 0
    const avgCommission = totalPaid > 0 ? totalAmountPaid / totalPaid : 0

    // Get unique partners count
    const { data: partnersData } = await supabase
      .from('leads')
      .select('partner_id', { count: 'exact', head: true })

    // 3. Get Monthly Trends (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: trendsData } = await supabase
      .from('leads')
      .select('created_at, commission_amount, partner_type, commission_status')
      .gte('created_at', sixMonthsAgo.toISOString())
      .in('commission_status', ['PAID', 'APPROVED', 'CALCULATED'])

    const trendsByMonth = new Map()
    trendsData?.forEach(lead => {
      const month = lead.created_at.substring(0, 7) // YYYY-MM
      if (!trendsByMonth.has(month)) {
        trendsByMonth.set(month, {
          period: month,
          total_commissions: 0,
          total_amount: 0,
          ba_count: 0,
          bp_count: 0,
          ba_amount: 0,
          bp_amount: 0
        })
      }

      const monthData = trendsByMonth.get(month)
      monthData.total_commissions++
      monthData.total_amount += lead.commission_amount || 0

      if (lead.partner_type === 'BUSINESS_ASSOCIATE') {
        monthData.ba_count++
        monthData.ba_amount += lead.commission_amount || 0
      } else if (lead.partner_type === 'BUSINESS_PARTNER') {
        monthData.bp_count++
        monthData.bp_amount += lead.commission_amount || 0
      }
    })

    const trends = Array.from(trendsByMonth.values())
      .sort((a, b) => a.period.localeCompare(b.period))

    // 4. Partner Type Breakdown
    const { data: partnerBreakdown } = await supabase
      .from('leads')
      .select('partner_type, commission_status, commission_amount')
      .not('commission_amount', 'is', null)

    const breakdownMap = new Map()
    partnerBreakdown?.forEach(lead => {
      const type = lead.partner_type
      if (!breakdownMap.has(type)) {
        breakdownMap.set(type, {
          partner_type: type,
          total_commissions: 0,
          total_amount: 0,
          pending_count: 0,
          pending_amount: 0
        })
      }

      const data = breakdownMap.get(type)
      data.total_commissions++
      data.total_amount += lead.commission_amount || 0

      if (lead.commission_status === 'CALCULATED') {
        data.pending_count++
        data.pending_amount += lead.commission_amount || 0
      }
    })

    const partner_breakdown = Array.from(breakdownMap.values()).map(item => ({
      ...item,
      avg_amount: item.total_commissions > 0 ? item.total_amount / item.total_commissions : 0
    }))

    // 5. Top Performers
    const { data: topPerformersData } = await supabase.rpc('get_top_performing_partners', {
      p_limit: 10
    }).catch(() => ({ data: [] }))

    // 6. Product Breakdown
    const { data: productData } = await supabase
      .from('leads')
      .select('loan_product, commission_amount')
      .not('commission_amount', 'is', null)
      .in('commission_status', ['PAID', 'APPROVED'])

    const productMap = new Map()
    productData?.forEach(lead => {
      const product = lead.loan_product || 'Unknown'
      if (!productMap.has(product)) {
        productMap.set(product, {
          loan_product: product,
          total_commissions: 0,
          total_amount: 0
        })
      }

      const data = productMap.get(product)
      data.total_commissions++
      data.total_amount += lead.commission_amount || 0
    })

    const product_breakdown = Array.from(productMap.values())
      .map(item => ({
        ...item,
        avg_amount: item.total_commissions > 0 ? item.total_amount / item.total_commissions : 0
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 10)

    // 7. Recent Batches
    const { data: recentBatches } = await supabase
      .from('payout_batches')
      .select('id, batch_number, partner_type, total_leads, total_amount, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    const recent_batches = recentBatches?.map(batch => ({
      batch_id: batch.id,
      batch_number: batch.batch_number,
      partner_type: batch.partner_type,
      total_leads: batch.total_leads,
      total_amount: batch.total_amount,
      status: batch.status,
      created_at: batch.created_at
    })) || []

    // 8. Payout Application Pipeline (from actual payout tables)
    const pipelineStatuses = ['PENDING', 'ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'SA_APPROVED', 'FINANCE_PROCESSING', 'PAYOUT_CREDITED', 'REJECTED', 'ON_HOLD']

    const [cpPipelineResults, partnerPipelineResults] = await Promise.all([
      Promise.all(pipelineStatuses.map(s =>
        supabase.from('cp_applications').select('id', { count: 'exact', head: true }).eq('status', s)
      )),
      Promise.all(pipelineStatuses.map(s =>
        supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('status', s)
      )),
    ])

    const pipeline: Record<string, { cp: number; partner: number; total: number }> = {}
    pipelineStatuses.forEach((status, i) => {
      const cp = cpPipelineResults[i].count || 0
      const partner = partnerPipelineResults[i].count || 0
      pipeline[status] = { cp, partner, total: cp + partner }
    })

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          total_commissions_paid: totalPaid,
          total_commissions_pending: totalPending,
          total_amount_paid: totalAmountPaid,
          total_amount_pending: totalAmountPending,
          avg_commission_amount: avgCommission,
          total_partners: partnersData?.count || 0
        },
        trends,
        partner_breakdown,
        top_performers: topPerformersData || [],
        product_breakdown,
        recent_batches,
        pipeline,
      }
    } as PayoutAnalyticsResponse)

  } catch (error) {
    apiLogger.error('Payout analytics error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      } as PayoutAnalyticsResponse,
      { status: 500 }
    )
  }
}
