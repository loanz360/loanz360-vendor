export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

// GET - Fetch active payout conditions for partners
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // FIX ISSUE #7: Verify user is actually a partner
    const { data: partnerData, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_type')
      .eq('user_id', user.id)
      .maybeSingle()

    if (partnerError) {
      apiLogger.error('Error fetching partner data', partnerError)
      return NextResponse.json({ success: false, error: 'Failed to verify partner status' }, { status: 500 })
    }

    if (!partnerData) {
      return NextResponse.json(
        { error: 'Forbidden: Only partners can access payout conditions' },
        { status: 403 }
      )
    }

    // FIX ISSUE #8: Map partner_type to condition applies_to format
    const partnerTypeMap: Record<string, string> = {
      'BUSINESS_ASSOCIATE': 'BA',
      'BUSINESS_PARTNER': 'BP',
      'CHANNEL_PARTNER': 'CP'
    }

    const conditionPartnerType = partnerTypeMap[partnerData.partner_type]

    if (!conditionPartnerType) {
      apiLogger.error('Unknown partner type', partnerData.partner_type)
      return NextResponse.json({ success: false, error: 'Invalid partner type' }, { status: 400 })
    }

    // Fetch only active payout conditions that apply to this partner type
    // Note: RLS policy already filters by partner type, but we add extra check for security
    const { data: conditions, error } = await supabase
      .from('payout_conditions')
      .select('id, condition_text, condition_order, applies_to')
      .eq('is_active', true)
      .order('condition_order', { ascending: true })

    if (error) {
      apiLogger.error('Error fetching payout conditions', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch payout conditions' }, { status: 500 })
    }

    // Double-check filtering (defense in depth)
    const filteredConditions = conditions?.filter(
      (condition) => condition.applies_to && condition.applies_to.includes(conditionPartnerType)
    ) || []

    return NextResponse.json({
      conditions: filteredConditions,
      partner_type: conditionPartnerType
    })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
