/**
 * Public API: ULI Feature Check
 * GET /api/uli/feature-check?service=uli-credit-bureau
 *
 * Lightweight endpoint to check if a ULI service category is enabled.
 * Used by client components (CreditBureauGate etc.) to gate features.
 * Returns simple { enabled: boolean } — no sensitive data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const featureKey = searchParams.get('service')

    if (!featureKey) {
      return NextResponse.json({ enabled: false }, { status: 400 })
    }

    // Check env var override first (fastest path)
    if (featureKey === 'uli-credit-bureau') {
      const envOverride = process.env.NEXT_PUBLIC_CREDIT_BUREAU_ENABLED
      if (envOverride === 'true') {
        return NextResponse.json({ enabled: true })
      }
      if (envOverride === 'false') {
        return NextResponse.json({ enabled: false })
      }
      // If not set, fall through to DB check
    }

    const supabase = createAdminClient()

    // Check if at least one service in the category is enabled
    const { data, error } = await supabase
      .from('uli_services')
      .select('id')
      .eq('feature_flag_key', featureKey)
      .eq('is_enabled', true)
      .limit(1)

    if (error) {
      return NextResponse.json({ enabled: false })
    }

    return NextResponse.json({ enabled: Array.isArray(data) && data.length > 0 })
  } catch {
    return NextResponse.json({ enabled: false })
  }
}
