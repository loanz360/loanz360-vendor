/**
 * Customer Dashboard Aggregation API
 * GET /api/customers/dashboard
 *
 * Aggregates data from multiple sources into a single response:
 * - Loan applications (from leads table)
 * - Loan accounts (from loan_applications table)
 * - Credit score (from credit_bureau_fetch_log)
 * - Wallet points (from customer_referral_points)
 * - Unread notifications (from notification_recipients)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

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

    const adminClient = createAdminClient()

    // Get customer profile for mobile-based lookups
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('id, mobile_number')
      .eq('user_id', user.id)
      .maybeSingle()

    const userMobile = profile?.mobile_number || null
    const customerId = profile?.id || null

    // Run all queries in parallel for speed
    const [
      applicationsResult,
      loansResult,
      creditScoreResult,
      walletResult,
      notificationsResult,
    ] = await Promise.allSettled([
      // 1. Fetch lead applications (pending/active)
      (async () => {
        let query = supabase
          .from('leads')
          .select('id, lead_id, loan_type, required_loan_amount, lead_status, cam_status, created_at')
          .order('created_at', { ascending: false })
          .limit(10)

        if (userMobile && userMobile.trim().length >= 10) {
          query = query.or(`customer_user_id.eq.${user.id},customer_mobile.eq.${userMobile}`)
        } else {
          query = query.eq('customer_user_id', user.id)
        }

        return query
      })(),

      // 2. Fetch loan_applications (disbursed/active loans)
      adminClient
        .from('loan_applications')
        .select('id, application_number, loan_type, requested_amount, approved_amount, tenure_months, interest_rate, emi_amount, status, disbursement_date, created_at')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false }),

      // 3. Fetch latest credit score
      adminClient
        .from('credit_bureau_fetch_log')
        .select('credit_score, bureau_name, created_at')
        .eq('customer_id', user.id)
        .eq('fetch_status', 'SUCCESS')
        .order('created_at', { ascending: false })
        .limit(1),

      // 4. Fetch wallet points
      (async () => {
        if (!customerId) return { data: null, error: null }
        return adminClient
          .from('customer_referral_points')
          .select('points_balance, total_points_earned')
          .eq('customer_id', customerId)
          .maybeSingle()
      })(),

      // 5. Fetch unread notification count
      (async () => {
        const { count, error } = await supabase
          .from('notification_recipients')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false)
          .eq('is_archived', false)

        if (error) {
          // Fallback to notifications table
          const { count: notifCount } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false)

          return notifCount || 0
        }
        return count || 0
      })(),
    ])

    // Extract applications data
    const applications = applicationsResult.status === 'fulfilled'
      ? (applicationsResult.value?.data || [])
      : []

    const pendingApplications = applications.filter(
      (a: { lead_status: string }) => ['NEW', 'OPEN', 'IN_PROGRESS', 'PROCESSING', 'PENDING'].includes(a.lead_status?.toUpperCase())
    )

    // Extract loans data
    const loans = loansResult.status === 'fulfilled'
      ? (loansResult.value?.data || [])
      : []

    const activeLoans = loans.filter(
      (l: { status: string }) => ['ACTIVE', 'DISBURSED', 'RUNNING'].includes(l.status?.toUpperCase())
    )

    const totalLoanAmount = activeLoans.reduce(
      (sum: number, l: { approved_amount?: number; requested_amount?: number }) =>
        sum + (l.approved_amount || l.requested_amount || 0),
      0
    )

    const totalEmiAmount = activeLoans.reduce(
      (sum: number, l: { emi_amount?: number }) => sum + (l.emi_amount || 0),
      0
    )

    // Extract credit score
    const creditScoreData = creditScoreResult.status === 'fulfilled'
      ? (creditScoreResult.value?.data?.[0] || null)
      : null

    // Extract wallet data
    const walletData = walletResult.status === 'fulfilled'
      ? (walletResult.value?.data || null)
      : null

    // Extract notifications count
    const unreadNotifications = notificationsResult.status === 'fulfilled'
      ? (typeof notificationsResult.value === 'number' ? notificationsResult.value : 0)
      : 0

    // Build loan summaries for active loans display
    const loanSummaries = activeLoans.map((loan: {
      id: string
      application_number: string
      loan_type: string
      approved_amount?: number
      requested_amount?: number
      emi_amount?: number
      tenure_months?: number
      status: string
      disbursement_date?: string
      created_at: string
    }) => {
      const amount = loan.approved_amount || loan.requested_amount || 0
      const emi = loan.emi_amount || 0
      const totalEmis = loan.tenure_months || 0
      // Estimate paid EMIs from disbursement date
      let paidEmis = 0
      if (loan.disbursement_date) {
        const months = Math.floor(
          (Date.now() - new Date(loan.disbursement_date).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
        )
        paidEmis = Math.max(0, Math.min(months, totalEmis))
      }
      const progress = totalEmis > 0 ? Math.round((paidEmis / totalEmis) * 100) : 0
      const balance = amount - (paidEmis * emi)

      return {
        id: loan.application_number || loan.id,
        type: loan.loan_type || 'Loan',
        amount,
        emi,
        balance: Math.max(0, balance),
        status: loan.status?.toLowerCase() || 'active',
        progress,
      }
    })

    // Build recent activity from applications (most recent 5)
    const recentActivity = applications.slice(0, 5).map((app: {
      lead_status: string
      loan_type: string
      created_at: string
    }) => ({
      type: app.lead_status?.toUpperCase() === 'NEW' ? 'application_submitted' :
            app.lead_status?.toUpperCase() === 'APPROVED' ? 'loan_approved' :
            app.lead_status?.toUpperCase() === 'DISBURSED' ? 'loan_disbursed' :
            'application_update',
      description: `${app.loan_type || 'Loan'} - ${app.lead_status || 'Unknown'}`,
      date: app.created_at,
    }))

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          activeLoans: activeLoans.length,
          totalLoanAmount,
          totalEmiPaid: loanSummaries.reduce((sum: number, l: { amount: number; balance: number }) => sum + (l.amount - l.balance), 0),
          nextEmiAmount: totalEmiAmount,
          creditScore: creditScoreData?.credit_score || null,
          pendingApplications: pendingApplications.length,
          unreadNotifications,
          walletPoints: walletData?.points_balance || 0,
        },
        loans: loanSummaries,
        recentActivity,
        applicationCount: applications.length,
      },
    })
  } catch (error) {
    apiLogger.error('Dashboard API error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
