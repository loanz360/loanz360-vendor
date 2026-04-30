
/**
 * Onboarding Pipeline API
 * SuperAdmin endpoint for monitoring customer onboarding funnel
 *
 * GET - Fetch onboarding pipeline statistics and customer counts per stage
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Pipeline stages in order
const PIPELINE_STAGES = [
  { key: 'REGISTERED', label: 'Registered', order: 1 },
  { key: 'MOBILE_VERIFIED', label: 'Mobile Verified', order: 2 },
  { key: 'BASIC_INFO', label: 'Basic Info', order: 3 },
  { key: 'INCOME_SELECTED', label: 'Income Selected', order: 4 },
  { key: 'KYC_INITIATED', label: 'KYC Initiated', order: 5 },
  { key: 'KYC_VERIFIED', label: 'KYC Verified', order: 6 },
  { key: 'PROFILE_COMPLETE', label: 'Profile Complete', order: 7 },
]

/**
 * GET /api/superadmin/customer-management/onboarding-pipeline
 * Fetch onboarding pipeline statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters for date range
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    // Build query for individuals by onboarding status
    let query = supabaseAdmin
      .from('individuals')
      .select('onboarding_status, created_at')

    // Apply date range if provided
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    const { data: individuals, error } = await query

    if (error) {
      apiLogger.error('Error fetching onboarding data', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch onboarding data' },
        { status: 500 }
      )
    }

    // Calculate counts per stage
    const stageCounts: Record<string, number> = {}
    PIPELINE_STAGES.forEach(stage => {
      stageCounts[stage.key] = 0
    })

    individuals?.forEach(ind => {
      const status = ind.onboarding_status || 'REGISTERED'
      if (stageCounts.hasOwnProperty(status)) {
        stageCounts[status]++
      }
    })

    // Calculate pipeline data with conversion rates
    const pipelineData = PIPELINE_STAGES.map((stage, index) => {
      const count = stageCounts[stage.key] || 0
      const totalSoFar = PIPELINE_STAGES
        .filter((_, i) => i >= index)
        .reduce((sum, s) => sum + (stageCounts[s.key] || 0), 0)

      const previousTotal = index === 0
        ? individuals?.length || 0
        : PIPELINE_STAGES
            .filter((_, i) => i >= index - 1)
            .reduce((sum, s) => sum + (stageCounts[s.key] || 0), 0)

      const conversionRate = previousTotal > 0
        ? ((totalSoFar / previousTotal) * 100).toFixed(1)
        : '0.0'

      const dropoffRate = previousTotal > 0
        ? (((previousTotal - totalSoFar) / previousTotal) * 100).toFixed(1)
        : '0.0'

      return {
        ...stage,
        count,
        cumulative_count: totalSoFar,
        conversion_rate: conversionRate,
        dropoff_rate: dropoffRate,
        percentage_of_total: individuals?.length
          ? ((count / individuals.length) * 100).toFixed(1)
          : '0.0',
      }
    })

    // Calculate overall statistics
    const totalRegistered = individuals?.length || 0
    const totalCompleted = stageCounts['PROFILE_COMPLETE'] || 0
    const totalPending = totalRegistered - totalCompleted
    const overallConversionRate = totalRegistered > 0
      ? ((totalCompleted / totalRegistered) * 100).toFixed(1)
      : '0.0'

    // Calculate pending KYC (those who have started KYC but not completed)
    const pendingKyc = (stageCounts['KYC_INITIATED'] || 0)

    // Calculate today's registrations
    const today = new Date().toISOString().split('T')[0]
    const todayRegistrations = individuals?.filter(ind =>
      ind.created_at?.startsWith(today)
    ).length || 0

    // Weekly trend (last 7 days)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weeklyRegistrations = individuals?.filter(ind =>
      new Date(ind.created_at) >= weekAgo
    ).length || 0

    const statistics = {
      total_in_pipeline: totalRegistered,
      completed: totalCompleted,
      pending: totalPending,
      pending_kyc: pendingKyc,
      overall_conversion_rate: overallConversionRate,
      today_registrations: todayRegistrations,
      weekly_registrations: weeklyRegistrations,
      avg_daily_registrations: Math.round(weeklyRegistrations / 7),
    }

    // Funnel data for visualization
    const funnelData = pipelineData.map(stage => ({
      stage: stage.label,
      value: stage.cumulative_count,
      percentage: totalRegistered > 0
        ? ((stage.cumulative_count / totalRegistered) * 100).toFixed(1)
        : '0.0',
    }))

    return NextResponse.json({
      success: true,
      data: {
        pipeline: pipelineData,
        funnel: funnelData,
      },
      statistics,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    apiLogger.error('Onboarding Pipeline GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
