/**
 * Cohort Analysis API
 * GET /api/superadmin/cohort-analysis
 *
 * Provides cohort-based lead conversion analytics:
 * - Monthly cohort data with retention rates
 * - Time-to-conversion distribution
 *
 * Uses DB views: v_lead_cohort_analysis, v_time_to_conversion_analysis
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Super Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch from both views in parallel
    const [cohortRes, timeRes] = await Promise.all([
      supabase
        .from('v_lead_cohort_analysis')
        .select('*')
        .order('cohort_month', { ascending: false }),
      supabase.from('v_time_to_conversion_analysis').select('*'),
    ])

    // Build response from DB views
    const cohorts = cohortRes.data || []
    const timeToConversion = timeRes.data?.[0] || null

    return NextResponse.json({
      success: true,
      data: { cohorts, timeToConversion },
    })
  } catch (error: unknown) {
    apiLogger.error('[Cohort Analysis API] Error', error)
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
