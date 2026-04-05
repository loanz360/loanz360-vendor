export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/pan/check
 * Check if PAN number exists for the authenticated customer
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if PAN exists in customer_profiles
    const { data: profile, error: profileError } = await supabase
      .from('customer_profiles')
      .select('pan_number')
      .eq('customer_id', user.id)
      .maybeSingle()

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      apiLogger.error('Error fetching customer profile', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch customer profile' },
        { status: 500 }
      )
    }

    const hasPan = !!(profile?.pan_number && profile.pan_number.length === 10)

    return NextResponse.json({
      success: true,
      has_pan: hasPan,
      pan_number: hasPan ? maskPan(profile.pan_number) : null
    })
  } catch (error) {
    apiLogger.error('Error checking PAN', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Mask PAN number for display (show first 2 and last 2 characters)
 * e.g., ABCDE1234F -> AB******4F
 */
function maskPan(pan: string): string {
  if (!pan || pan.length !== 10) return '**********'
  return pan.slice(0, 2) + '******' + pan.slice(-2)
}
