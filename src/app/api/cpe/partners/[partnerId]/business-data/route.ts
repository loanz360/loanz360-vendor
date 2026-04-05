export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/cpe/partners/[partnerId]/business-data
 *
 * Get monthly business data for a specific partner
 * Query params:
 *   - months: Number of months back (default: 6)
 *
 * Returns:
 *   - Monthly business volume trends
 *   - Monthly application counts
 *   - Conversion rates
 *   - Growth metrics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
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

    const { partnerId } = params

    // Verify partner belongs to this CPE
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, full_name, partner_type')
      .eq('id', partnerId)
      .eq('recruited_by_cpe', user.id)
      .maybeSingle()

    if (partnerError || !partner) {
      apiLogger.error('Error fetching partner', partnerError)
      return NextResponse.json(
        { success: false, error: 'Partner not found or access denied' },
        { status: 404 }
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

    // Fetch partner's business metrics from partner_daily_metrics
    const { data: metricsData, error: metricsError } = await supabase
      .from('partner_daily_metrics')
      .select('metric_date, business_volume, applications_sourced, disbursed_amount, commission_earned')
      .eq('partner_id', partnerId)
      .gte('metric_date', startDateStr)
      .order('metric_date', { ascending: true })

    if (metricsError) {
      apiLogger.error('Error fetching partner metrics', metricsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partner business data' },
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
          businessVolume: 0,
          applicationsSourced: 0,
          disbursedAmount: 0,
          commissionEarned: 0,
        }
      }

      monthlyData[month].businessVolume += parseFloat(record.business_volume || 0)
      monthlyData[month].applicationsSourced += parseInt(record.applications_sourced || 0)
      monthlyData[month].disbursedAmount += parseFloat(record.disbursed_amount || 0)
      monthlyData[month].commissionEarned += parseFloat(record.commission_earned || 0)
    })

    // Convert to array and sort
    const monthlyArray = Object.values(monthlyData).sort((a: any, b: any) =>
      a.month.localeCompare(b.month)
    )

    // Calculate growth metrics
    const currentMonth = monthlyArray[monthlyArray.length - 1]
    const previousMonth = monthlyArray[monthlyArray.length - 2]

    let businessGrowth = 0
    let applicationsGrowth = 0

    if (previousMonth && currentMonth) {
      if (previousMonth.businessVolume > 0) {
        businessGrowth = ((currentMonth.businessVolume - previousMonth.businessVolume) / previousMonth.businessVolume) * 100
      }
      if (previousMonth.applicationsSourced > 0) {
        applicationsGrowth = ((currentMonth.applicationsSourced - previousMonth.applicationsSourced) / previousMonth.applicationsSourced) * 100
      }
    }

    // Calculate conversion rate (disbursed / business volume)
    const totalBusinessVolume = monthlyArray.reduce((sum, m) => sum + m.businessVolume, 0)
    const totalDisbursed = monthlyArray.reduce((sum, m) => sum + m.disbursedAmount, 0)
    const conversionRate = totalBusinessVolume > 0 ? (totalDisbursed / totalBusinessVolume) * 100 : 0

    // Calculate average business per application
    const totalApplications = monthlyArray.reduce((sum, m) => sum + m.applicationsSourced, 0)
    const avgBusinessPerApplication = totalApplications > 0 ? totalBusinessVolume / totalApplications : 0

    // Format response
    const response = {
      success: true,
      data: {
        partner: {
          id: partner.id,
          name: partner.full_name,
          type: partner.partner_type,
        },
        monthly: {
          labels: monthlyArray.map((m) => m.month),
          datasets: {
            businessVolume: monthlyArray.map((m) => m.businessVolume),
            applicationsSourced: monthlyArray.map((m) => m.applicationsSourced),
            disbursedAmount: monthlyArray.map((m) => m.disbursedAmount),
            commissionEarned: monthlyArray.map((m) => m.commissionEarned),
          },
          raw: monthlyArray,
        },
        summary: {
          totalBusinessVolume,
          totalApplications,
          totalDisbursed,
          totalCommission: monthlyArray.reduce((sum, m) => sum + m.commissionEarned, 0),
          avgBusinessPerApplication: parseFloat(avgBusinessPerApplication.toFixed(2)),
          conversionRate: parseFloat(conversionRate.toFixed(2)),
        },
        growth: {
          businessVolume: {
            value: parseFloat(businessGrowth.toFixed(2)),
            direction: businessGrowth > 0 ? 'up' : businessGrowth < 0 ? 'down' : 'neutral',
          },
          applications: {
            value: parseFloat(applicationsGrowth.toFixed(2)),
            direction: applicationsGrowth > 0 ? 'up' : applicationsGrowth < 0 ? 'down' : 'neutral',
          },
        },
        period: {
          startDate: startDateStr,
          endDate: new Date().toISOString().split('T')[0],
          monthsIncluded: monthsBack,
        },
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in partner business data API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
