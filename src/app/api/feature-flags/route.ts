/**
 * API Route: Public Feature Flags
 * GET /api/feature-flags?portal=CUSTOMER
 *
 * Returns enabled feature flags for a given portal.
 * No auth required — flags are public read (controls UI visibility only).
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'

export const revalidate = 60 // Cache for 60 seconds

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const portal = request.nextUrl.searchParams.get('portal') || 'CUSTOMER'
    const supabase = createAdminClient()

    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('flag_key, flag_name, is_enabled, rollout_percentage, metadata, category')
      .or(`portal.eq.${portal},portal.eq.ALL`)
      .order('category')
      .order('flag_name')

    if (error) {
      apiLogger.error('Feature flags fetch error', error)
      // Return empty on error — all features hidden (fail-closed)
      return NextResponse.json({ success: true, data: {} })
    }

    // Transform to key-value map for easy lookup
    const flagMap: Record<string, { enabled: boolean; metadata: Record<string, unknown> }> = {}
    for (const flag of flags || []) {
      flagMap[flag.flag_key] = {
        enabled: flag.is_enabled && (flag.rollout_percentage === 100 || Math.random() * 100 < flag.rollout_percentage),
        metadata: flag.metadata || {},
      }
    }

    return NextResponse.json({
      success: true,
      data: flagMap,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    apiLogger.error('Feature flags API error', error)
    return NextResponse.json({ success: true, data: {} })
  }
}
