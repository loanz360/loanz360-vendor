import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || (auth.role !== 'SUPER_ADMIN' && !auth.isSuperAdmin)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

    // Run all queries in parallel for performance
    const [
      employeesResult,
      partnersResult,
      customersResult,
      vendorsResult,
      todayLeadsResult,
      allLeadsResult,
      monthLeadsResult,
      lastMonthLeadsResult,
      cpAppsResult,
      partnerAppsResult,
      baCountResult,
      bpCountResult,
      cpCountResult,
      lastMonthPartnersResult,
    ] = await Promise.all([
      // Entity counts
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('partners').select('id', { count: 'exact', head: true }),
      supabase.from('customer_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('vendors').select('id', { count: 'exact', head: true }),

      // Today's leads
      supabase.from('leads').select('id, lead_status, required_loan_amount', { count: 'exact' }).gte('created_at', todayStart),

      // H2 FIX: Remove arbitrary limit - use count-based approach for large datasets
      supabase.from('leads').select('lead_status, required_loan_amount, sanctioned_amount, disbursed_amount'),

      // This month leads
      supabase.from('leads').select('lead_status, required_loan_amount, sanctioned_amount, disbursed_amount').gte('created_at', monthStart),

      // Last month leads (for comparison)
      supabase.from('leads').select('lead_status, required_loan_amount, sanctioned_amount, disbursed_amount')
        .gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),

      // CP applications
      supabase.from('cp_applications').select('status', { count: 'exact', head: true }),

      // Partner payout applications (table may not exist yet)
      supabase.from('partner_payout_applications').select('status', { count: 'exact', head: true }),

      // Partner type counts
      supabase.from('partners').select('id', { count: 'exact', head: true }).eq('partner_type', 'BUSINESS_ASSOCIATE'),
      supabase.from('partners').select('id', { count: 'exact', head: true }).eq('partner_type', 'BUSINESS_PARTNER'),
      supabase.from('partners').select('id', { count: 'exact', head: true }).eq('partner_type', 'CHANNEL_PARTNER'),

      // Last month partners (for growth calc)
      supabase.from('partners').select('id', { count: 'exact', head: true }).lte('created_at', lastMonthEnd),
    ])

    // Calculate today's performance
    const todayLeads = todayLeadsResult.data || []
    const todayApplications = todayLeadsResult.count || 0
    const todayProcessed = todayLeads.filter(l =>
      ['IN_PROGRESS', 'PROCESSING', 'DOCUMENTS_COLLECTED', 'BANK_LOGIN'].includes(l.lead_status || '')
    ).length
    const todayDisbursedAmount = todayLeads
      .filter(l => l.lead_status === 'DISBURSED')
      .reduce((sum, l) => sum + (l.required_loan_amount || 0), 0)

    // Calculate processing queue from all leads
    const allLeads = allLeadsResult.data || []
    const pendingVerification = allLeads.filter(l => ['NEW', 'NEW_UNASSIGNED', 'PENDING'].includes(l.lead_status || '')).length
    const awaitingApproval = allLeads.filter(l => ['BANK_LOGIN', 'CREDIT_MANAGER'].includes(l.lead_status || '')).length
    const readyForDisbursement = allLeads.filter(l => l.lead_status === 'SANCTIONED').length
    const underReview = allLeads.filter(l => ['DOCUMENTS_PENDING', 'DOCUMENTS_COLLECTED'].includes(l.lead_status || '')).length

    // Calculate loan portfolio
    const totalEstimated = allLeads.reduce((sum, l) => sum + (l.required_loan_amount || 0), 0)
    const totalSanctioned = allLeads
      .filter(l => ['SANCTIONED', 'DISBURSED'].includes(l.lead_status || ''))
      .reduce((sum, l) => sum + (l.sanctioned_amount || l.required_loan_amount || 0), 0)
    const totalDisbursed = allLeads
      .filter(l => l.lead_status === 'DISBURSED')
      .reduce((sum, l) => sum + (l.disbursed_amount || l.sanctioned_amount || l.required_loan_amount || 0), 0)
    const totalRejected = allLeads
      .filter(l => ['REJECTED', 'BANK_REJECTED'].includes(l.lead_status || ''))
      .reduce((sum, l) => sum + (l.required_loan_amount || 0), 0)
    const totalDropped = allLeads
      .filter(l => ['DROPPED', 'CANCELLED', 'DEAD'].includes(l.lead_status || ''))
      .reduce((sum, l) => sum + (l.required_loan_amount || 0), 0)

    // This month vs last month for growth percentages
    const monthLeads = monthLeadsResult.data || []
    const lastMonthLeads = lastMonthLeadsResult.data || []
    const monthTotal = monthLeads.reduce((s, l) => s + (l.required_loan_amount || 0), 0)
    const lastMonthTotal = lastMonthLeads.reduce((s, l) => s + (l.required_loan_amount || 0), 0)
    const growthPct = lastMonthTotal > 0 ? ((monthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1) : '0'

    // Partner counts
    const totalPartners = partnersResult.count || 0
    const lastMonthPartnerCount = lastMonthPartnersResult.count || 0
    const newPartnersThisMonth = totalPartners - lastMonthPartnerCount

    // Approval rate
    const sanctionedCount = allLeads.filter(l => ['SANCTIONED', 'DISBURSED'].includes(l.lead_status || '')).length
    const processedCount = allLeads.filter(l => !['NEW', 'NEW_UNASSIGNED', 'PENDING'].includes(l.lead_status || '')).length
    const approvalRate = processedCount > 0 ? (sanctionedCount / processedCount * 100).toFixed(1) : '0'

    // Employee growth
    const totalEmployees = employeesResult.count || 0
    const totalCustomers = customersResult.count || 0
    const totalVendors = vendorsResult.count || 0

    // Format currency helper - H2 FIX: Add NaN/Infinity validation
    const formatCr = (amount: number) => {
      if (!Number.isFinite(amount) || amount < 0) return '0'
      if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)} Cr`
      if (amount >= 100000) return `${(amount / 100000).toFixed(1)} L`
      return amount.toLocaleString('en-IN')
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          today: {
            applications_received: todayApplications,
            loans_processed: todayProcessed,
            amount_disbursed: formatCr(todayDisbursedAmount),
            amount_disbursed_raw: todayDisbursedAmount,
          },
          processing_queue: {
            pending_verification: pendingVerification,
            awaiting_approval: awaitingApproval,
            ready_for_disbursement: readyForDisbursement,
            under_review: underReview,
          },
          organization: {
            employees: totalEmployees,
            partners: totalPartners,
            vendors: totalVendors,
            customers: totalCustomers,
            new_partners_this_month: newPartnersThisMonth,
          },
          loan_portfolio: {
            total_applications: formatCr(totalEstimated),
            total_applications_raw: totalEstimated,
            loans_sanctioned: formatCr(totalSanctioned),
            loans_sanctioned_raw: totalSanctioned,
            loans_disbursed: formatCr(totalDisbursed),
            loans_disbursed_raw: totalDisbursed,
            loans_rejected: formatCr(totalRejected),
            loans_rejected_raw: totalRejected,
            loans_dropped: formatCr(totalDropped),
            loans_dropped_raw: totalDropped,
            growth_pct: growthPct,
          },
          approval_rate: parseFloat(approvalRate),
        },
        analytics: {
          partner_counts: {
            ba: baCountResult.count || 0,
            bp: bpCountResult.count || 0,
            cp: cpCountResult.count || 0,
            total: totalPartners,
            new_this_month: newPartnersThisMonth,
          },
          lead_stats: {
            total: allLeads.length,
            this_month: monthLeads.length,
            sanctioned: sanctionedCount,
            disbursed: allLeads.filter(l => l.lead_status === 'DISBURSED').length,
            dropped: allLeads.filter(l => ['DROPPED', 'CANCELLED', 'DEAD'].includes(l.lead_status || '')).length,
            rejected: allLeads.filter(l => ['REJECTED', 'BANK_REJECTED'].includes(l.lead_status || '')).length,
            processing: allLeads.filter(l => ['IN_PROGRESS', 'PROCESSING', 'BANK_LOGIN', 'CREDIT_MANAGER'].includes(l.lead_status || '')).length,
          },
          amounts: {
            total_estimated: totalEstimated,
            total_sanctioned: totalSanctioned,
            total_disbursed: totalDisbursed,
            total_dropped: totalDropped,
            total_rejected: totalRejected,
            total_cancelled: allLeads
              .filter(l => l.lead_status === 'CANCELLED')
              .reduce((s, l) => s + (l.required_loan_amount || 0), 0),
          },
        },
      },
    })
  } catch (error) {
    apiLogger.error('Error in SA dashboard API', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
