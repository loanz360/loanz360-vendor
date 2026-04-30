/**
 * BDM Team Targets - Targets History API
 * Returns historical targets and achievements for trend analysis
 * BDM access only
 *
 * Rate Limit: 60 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getTargetsHistoryHandler(req)
  })
}

async function getTargetsHistoryHandler(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized || (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    const { searchParams } = new URL(request.url)
    const bdeId = searchParams.get('bdeId') // Optional: specific BDE
    const months = parseInt(searchParams.get('months') || '6') // Last N months

    // Get team BDEs
    const { data: teamBDEs } = await supabase
      .from('users')
      .select('id, name, employee_code')
      .eq('manager_id', bdmUserId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')

    if (!teamBDEs || teamBDEs.length === 0) {
      return NextResponse.json({
        success: true,
        data: { history: [] },
        timestamp: new Date().toISOString(),
      })
    }

    const teamBDEIds = bdeId ? [bdeId] : teamBDEs.map(b => b.id)

    // Fetch historical targets
    const { data: targets } = await supabase
      .from('team_targets')
      .select('*')
      .in('user_id', teamBDEIds)
      .eq('target_type', 'BDE')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(months * teamBDEIds.length)

    // Aggregate achievements by month
    const history = targets?.map(target => {
      const bde = teamBDEs.find(b => b.id === target.user_id)
      return {
        bdeId: target.user_id,
        bdeName: bde?.name || 'Unknown',
        month: target.month,
        year: target.year,
        period: `${target.year}-${target.month.toString().padStart(2, '0')}`,
        targets: {
          conversions: target.monthly_conversion_target,
          revenue: target.monthly_revenue_target,
        },
        createdAt: target.created_at,
        updatedAt: target.updated_at,
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: { history },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getTargetsHistoryHandler', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
