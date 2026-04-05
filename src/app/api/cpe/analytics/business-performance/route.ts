export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/cpe/analytics/business-performance
 *
 * Get business performance metrics over time
 * Query params:
 *   - months: Number of months back (default: 6)
 *
 * Returns:
 *   - Monthly data for business volume and disbursements
 *   - Total loan amounts, sanctioned amounts, disbursed amounts
 *   - Suitable for line charts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
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

    // Verify user is a Channel Partner Executive
    const isCPE = await verifyCPERole(supabase, user)

    if (!isCPE) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Channel Partner Executive role required.' },
        { status: 403 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const monthsBack = parseInt(searchParams.get('months') || '6')

    // Validate months parameter
    if (isNaN(monthsBack) || monthsBack < 1 || monthsBack > 24) {
      return NextResponse.json(
        { success: false, error: 'Invalid months parameter. Must be between 1 and 24.' },
        { status: 400 }
      )
    }

    // Calculate date range
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - monthsBack)
    const startDateStr = startDate.toISOString().split('T')[0]

    // Query business performance data from cpe_daily_metrics
    const { data: metricsData, error: metricsError } = await supabase
      .from('cpe_daily_metrics')
      .select('metric_date, total_loan_amount, sanctioned_loan_amount, disbursed_loan_amount, total_loan_applications')
      .eq('user_id', user.id)
      .gte('metric_date', startDateStr)
      .order('metric_date', { ascending: true })

    if (metricsError) {
      apiLogger.error('Error fetching business performance', metricsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch business performance data' },
        { status: 500 }
      )
    }

    // Group by month and aggregate
    const monthlyData: { [key: string]: any } = {}

    metricsData?.forEach((record) => {
      const month = record.metric_date.substring(0, 7) // Extract YYYY-MM

      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          totalLoanAmount: 0,
          sanctionedAmount: 0,
          disbursedAmount: 0,
          totalApplications: 0,
        }
      }

      monthlyData[month].totalLoanAmount += parseFloat(record.total_loan_amount || 0)
      monthlyData[month].sanctionedAmount += parseFloat(record.sanctioned_loan_amount || 0)
      monthlyData[month].disbursedAmount += parseFloat(record.disbursed_loan_amount || 0)
      monthlyData[month].totalApplications += parseInt(record.total_loan_applications || 0)
    })

    // Convert to array and sort
    const monthlyArray = Object.values(monthlyData).sort((a: any, b: any) =>
      a.month.localeCompare(b.month)
    )

    // Format response for chart consumption
    const response = {
      success: true,
      data: {
        labels: monthlyArray.map(m => m.month), // ['2025-01', '2025-02', ...]
        datasets: {
          totalLoanAmount: monthlyArray.map(m => m.totalLoanAmount),
          sanctionedAmount: monthlyArray.map(m => m.sanctionedAmount),
          disbursedAmount: monthlyArray.map(m => m.disbursedAmount),
          totalApplications: monthlyArray.map(m => m.totalApplications),
        },
        raw: monthlyArray, // Full data for flexibility
        summary: {
          totalLoanAmountSum: monthlyArray.reduce((sum, m) => sum + m.totalLoanAmount, 0),
          sanctionedAmountSum: monthlyArray.reduce((sum, m) => sum + m.sanctionedAmount, 0),
          disbursedAmountSum: monthlyArray.reduce((sum, m) => sum + m.disbursedAmount, 0),
          totalApplicationsSum: monthlyArray.reduce((sum, m) => sum + m.totalApplications, 0),
        },
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in business performance API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
