export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/cpe/analytics/partner-growth
 *
 * Get partner growth trends over time
 * Query params:
 *   - months: Number of months back (default: 6)
 *
 * Returns:
 *   - Monthly data for BA, BP, CP recruitment
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

    // Call database function to get growth trends
    const { data: growthData, error: growthError } = await supabase.rpc(
      'get_partner_growth_trends',
      {
        p_cpe_user_id: user.id,
        p_months_back: monthsBack,
      }
    )

    if (growthError) {
      apiLogger.error('Error fetching growth trends', growthError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch growth trends data' },
        { status: 500 }
      )
    }

    // Format response for chart consumption
    const months = growthData?.months || []

    const response = {
      success: true,
      data: {
        labels: months.map((m: any) => m.month), // ['2025-01', '2025-02', ...]
        datasets: {
          businessAssociates: months.map((m: any) => m.businessAssociates),
          businessPartners: months.map((m: any) => m.businessPartners),
          channelPartners: months.map((m: any) => m.channelPartners),
          total: months.map((m: any) => m.total),
        },
        raw: months, // Full data for flexibility
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in partner growth API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
