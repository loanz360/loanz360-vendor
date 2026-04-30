
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/emi-inquiries/stats
 * Get statistics and analytics for the current employee
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters for date range
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // days

    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - parseInt(period))

    // Get overall counts
    const { count: totalInquiries } = await supabase
      .from('customer_emi_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('created_by_employee_id', user.id)
      .is('archived_at', null)

    const { count: totalInquiriesInPeriod } = await supabase
      .from('customer_emi_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('created_by_employee_id', user.id)
      .gte('created_at', dateFrom.toISOString())
      .is('archived_at', null)

    // Get counts by status
    const { data: statusCounts } = await supabase
      .from('customer_emi_inquiries')
      .select('status')
      .eq('created_by_employee_id', user.id)
      .is('archived_at', null)

    const statusBreakdown = statusCounts?.reduce((acc: unknown, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {})

    // Get hot leads count
    const { count: hotLeads } = await supabase
      .from('customer_emi_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('created_by_employee_id', user.id)
      .eq('hot_lead', true)
      .is('archived_at', null)

    // Get upcoming follow-ups
    const today = new Date().toISOString().split('T')[0]
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    const nextWeekDate = nextWeek.toISOString().split('T')[0]

    const { count: followUpsDueToday } = await supabase
      .from('customer_emi_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('created_by_employee_id', user.id)
      .eq('next_follow_up_date', today)
      .is('archived_at', null)

    const { count: followUpsDueThisWeek } = await supabase
      .from('customer_emi_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('created_by_employee_id', user.id)
      .gte('next_follow_up_date', today)
      .lte('next_follow_up_date', nextWeekDate)
      .is('archived_at', null)

    // Get total shares
    const { count: totalShares } = await supabase
      .from('inquiry_shares')
      .select('*', { count: 'exact', head: true })
      .eq('shared_by_employee_id', user.id)

    const { count: sharesInPeriod } = await supabase
      .from('inquiry_shares')
      .select('*', { count: 'exact', head: true })
      .eq('shared_by_employee_id', user.id)
      .gte('created_at', dateFrom.toISOString())

    // Get share engagement
    const { data: shareEngagement } = await supabase
      .from('inquiry_shares')
      .select('opened_at, view_count')
      .eq('shared_by_employee_id', user.id)
      .not('opened_at', 'is', null)

    const totalViews = shareEngagement?.reduce((sum, share) => sum + (share.view_count || 0), 0) || 0
    const shareViewRate = totalShares ? ((shareEngagement?.length || 0) / totalShares * 100).toFixed(2) : '0.00'

    // Get conversion metrics
    const { count: convertedToLeads } = await supabase
      .from('customer_emi_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('created_by_employee_id', user.id)
      .not('lead_id', 'is', null)

    const { count: convertedToApplications } = await supabase
      .from('customer_emi_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('created_by_employee_id', user.id)
      .in('status', ['application_started', 'application_submitted', 'approved', 'disbursed'])

    const { count: approvedLoans } = await supabase
      .from('customer_emi_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('created_by_employee_id', user.id)
      .in('status', ['approved', 'disbursed'])

    // Calculate conversion rates
    const inquiryToLeadRate = totalInquiries ? ((convertedToLeads || 0) / totalInquiries * 100).toFixed(2) : '0.00'
    const inquiryToApplicationRate = totalInquiries ? ((convertedToApplications || 0) / totalInquiries * 100).toFixed(2) : '0.00'
    const inquiryToApprovalRate = totalInquiries ? ((approvedLoans || 0) / totalInquiries * 100).toFixed(2) : '0.00'

    // Get loan type breakdown
    const { data: loanTypes } = await supabase
      .from('customer_emi_inquiries')
      .select('loan_type')
      .eq('created_by_employee_id', user.id)
      .is('archived_at', null)

    const loanTypeBreakdown = loanTypes?.reduce((acc: unknown, item) => {
      acc[item.loan_type] = (acc[item.loan_type] || 0) + 1
      return acc
    }, {})

    // Get total loan amounts
    const { data: loanAmounts } = await supabase
      .from('customer_emi_inquiries')
      .select('principal_amount, status')
      .eq('created_by_employee_id', user.id)
      .is('archived_at', null)

    const totalLoanAmountInquiries = loanAmounts?.reduce((sum, item) => sum + parseFloat(item.principal_amount || 0), 0) || 0

    const disbursedLoans = loanAmounts?.filter(item => item.status === 'disbursed') || []
    const totalLoanAmountDisbursed = disbursedLoans.reduce((sum, item) => sum + parseFloat(item.principal_amount || 0), 0)

    // Get recent activity
    const { data: recentInquiries } = await supabase
      .from('customer_emi_inquiries')
      .select('id, inquiry_number, customer_name, principal_amount, status, created_at')
      .eq('created_by_employee_id', user.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      period_days: parseInt(period),
      overview: {
        total_inquiries: totalInquiries || 0,
        inquiries_in_period: totalInquiriesInPeriod || 0,
        hot_leads: hotLeads || 0,
        follow_ups_due_today: followUpsDueToday || 0,
        follow_ups_due_this_week: followUpsDueThisWeek || 0
      },
      status_breakdown: statusBreakdown || {},
      sharing: {
        total_shares: totalShares || 0,
        shares_in_period: sharesInPeriod || 0,
        total_views: totalViews,
        share_view_rate: parseFloat(shareViewRate),
        opened_shares: shareEngagement?.length || 0
      },
      conversions: {
        converted_to_leads: convertedToLeads || 0,
        converted_to_applications: convertedToApplications || 0,
        approved_loans: approvedLoans || 0,
        inquiry_to_lead_rate: parseFloat(inquiryToLeadRate),
        inquiry_to_application_rate: parseFloat(inquiryToApplicationRate),
        inquiry_to_approval_rate: parseFloat(inquiryToApprovalRate)
      },
      loan_types: loanTypeBreakdown || {},
      financial_metrics: {
        total_loan_amount_inquiries: totalLoanAmountInquiries,
        total_loan_amount_disbursed: totalLoanAmountDisbursed,
        average_inquiry_amount: totalInquiries ? (totalLoanAmountInquiries / totalInquiries).toFixed(2) : '0.00'
      },
      recent_inquiries: recentInquiries || []
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/emi-inquiries/stats', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
