
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/cpe/analytics/summary
 *
 * Get analytics summary for the logged-in CPE
 * Query params:
 *   - month: YYYY-MM format (optional, defaults to current month)
 *
 * Returns:
 *   - totalPartners: Total partners recruited
 *   - totalBA/BP/CP: Breakdown by partner type
 *   - growth: Growth percentages vs previous month
 *   - currentMonthNew: Partners recruited this month
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
    const monthParam = searchParams.get('month')

    // Parse month or use current month
    let targetMonth: Date
    if (monthParam) {
      // Validate format YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(monthParam)) {
        return NextResponse.json(
          { success: false, error: 'Invalid month format. Use YYYY-MM.' },
          { status: 400 }
        )
      }
      targetMonth = new Date(`${monthParam}-01`)
    } else {
      targetMonth = new Date()
    }

    // Call database function to get analytics
    const { data: analyticsData, error: analyticsError } = await supabase.rpc(
      'get_cpe_analytics_summary',
      {
        p_cpe_user_id: user.id,
        p_target_month: targetMonth.toISOString().split('T')[0],
      }
    )

    if (analyticsError) {
      apiLogger.error('Error fetching analytics', analyticsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch analytics data' },
        { status: 500 }
      )
    }

    // Calculate growth indicators
    const currentMonthNew = analyticsData.currentMonthNew || 0
    const previousMonthNew = analyticsData.previousMonthNew || 0

    let growthPercentage = 0
    let growthDirection: 'up' | 'down' | 'neutral' = 'neutral'

    if (previousMonthNew > 0) {
      growthPercentage = ((currentMonthNew - previousMonthNew) / previousMonthNew) * 100
      growthDirection = growthPercentage > 0 ? 'up' : growthPercentage < 0 ? 'down' : 'neutral'
    } else if (currentMonthNew > 0) {
      growthPercentage = 100
      growthDirection = 'up'
    }

    // Format response
    const response = {
      success: true,
      data: {
        month: analyticsData.month,
        summary: {
          totalPartners: {
            count: analyticsData.totalPartners || 0,
            growth: {
              count: currentMonthNew - previousMonthNew,
              percentage: Math.round(growthPercentage * 100) / 100,
              direction: growthDirection,
            },
          },
          businessAssociates: {
            count: analyticsData.totalBA || 0,
            growth: {
              count: 0, // Will be calculated separately if needed
              percentage: 0,
              direction: 'neutral' as const,
            },
          },
          businessPartners: {
            count: analyticsData.totalBP || 0,
            growth: {
              count: 0,
              percentage: 0,
              direction: 'neutral' as const,
            },
          },
          channelPartners: {
            count: analyticsData.totalCP || 0,
            growth: {
              count: 0,
              percentage: 0,
              direction: 'neutral' as const,
            },
          },
        },
        thisMonth: {
          newPartners: currentMonthNew,
          previousMonth: previousMonthNew,
        },
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in analytics summary API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
