
/**
 * API Route: Track Link Open
 * POST /api/public/track-link-open
 *
 * Tracks when a user opens a shared link (updates form_status to OPENED)
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // 1. Parse request body
    const { short_code, trace_token } = await request.json()

    if (!short_code && !trace_token) {
      return NextResponse.json(
        { success: false, error: 'short_code or trace_token is required' },
        { status: 400 }
      )
    }

    // 2. Find lead
    let leadQuery = supabase.from('leads').select('id, form_status')

    if (short_code) {
      leadQuery = leadQuery.eq('short_code', short_code)
    } else if (trace_token) {
      leadQuery = leadQuery.eq('trace_token', trace_token)
    }

    const { data: lead, error: leadError } = await leadQuery.maybeSingle()

    if (leadError || !lead) {
      apiLogger.error('Lead not found for tracking', leadError)
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    // 3. Update form status to OPENED (only if currently PENDING)
    if (lead.form_status === 'PENDING') {
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          form_status: 'OPENED',
          form_completion_percentage: 10,
        })
        .eq('id', lead.id)

      if (updateError) {
        apiLogger.error('Lead update error', updateError)
      }
    }

    // 4. Update referral tracking
    const { error: trackingError } = await supabase
      .from('lead_referral_tracking')
      .update({
        link_opened: true,
        link_opened_at: new Date().toISOString(),
        link_opened_count: supabase.raw('link_opened_count + 1'),
        ip_addresses: supabase.raw('array_append(COALESCE(ip_addresses, ARRAY[]::text[]), ?)', [
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        ]),
        user_agents: supabase.raw('array_append(COALESCE(user_agents, ARRAY[]::text[]), ?)', [
          request.headers.get('user-agent') || 'unknown',
        ]),
      })
      .eq('lead_id', lead.id)

    if (trackingError) {
      apiLogger.error('Tracking update error', trackingError)
    }

    // 5. Update short link analytics
    if (short_code) {
      const { error: linkError } = await supabase
        .from('short_links')
        .update({
          click_count: supabase.raw('click_count + 1'),
          last_accessed_at: new Date().toISOString(),
        })
        .eq('short_code', short_code)

      if (linkError) {
        apiLogger.error('Short link update error', linkError)
      }
    }

    // 6. Return success
    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Track link open error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// OPTIONS - Handle CORS preflight
// ============================================================================
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  )
}
