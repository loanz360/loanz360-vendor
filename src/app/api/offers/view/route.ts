export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

// POST - Record offer view for analytics
export async function POST(request: NextRequest) {
  // Apply rate limiting - 10 views per minute per user to prevent spam
  const rateLimitResponse = await rateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    max: 10 // 10 requests per minute
  })
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { offer_id } = body

    if (!offer_id) {
      return NextResponse.json({ success: false, error: 'Offer ID required' }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(offer_id)) {
      return NextResponse.json({ success: false, error: 'Invalid offer ID format' }, { status: 400 })
    }

    // Use the RPC function to record view
    const { data, error } = await supabase.rpc('record_offer_view', {
      p_offer_id: offer_id
    })

    if (error) throw error

    return NextResponse.json({ success: true, recorded: data })
  } catch (error: unknown) {
    apiLogger.error('Error recording offer view', error)
    logApiError(error as Error, request, { action: 'record_view' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
