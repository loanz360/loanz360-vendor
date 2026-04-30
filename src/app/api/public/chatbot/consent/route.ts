import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClientIP, rateLimitByIP, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'

// CORS headers for public API
function getCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  }
}

// Handle preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin)
  })
}

// POST - Save consent
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  const corsHeaders = getCorsHeaders(origin)

  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { session_id, consents } = body

    if (!session_id || !consents || !Array.isArray(consents)) {
      return NextResponse.json(
        { success: false, error: 'Session ID and consents array required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Rate limiting
    const clientIP = getClientIP(request.headers)
    const rateLimitResult = rateLimitByIP(
      clientIP,
      'consent',
      RATE_LIMIT_CONFIGS.PUBLIC_CHATBOT
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429, headers: corsHeaders }
      )
    }

    const supabase = await createClient()
    const userAgent = request.headers.get('user-agent') || ''

    // Save each consent type
    const consentsToInsert = consents.map((consent: { consent_type: string; granted: boolean }) => ({
      session_id,
      consent_type: consent.consent_type,
      granted: consent.granted,
      granted_at: new Date().toISOString(),
      ip_address: clientIP,
      user_agent: userAgent.slice(0, 500)
    }))

    // Upsert consents (update if exists, insert if not)
    for (const consent of consentsToInsert) {
      await supabase
        .from('chatbot_consents')
        .upsert(
          consent,
          { onConflict: 'session_id,consent_type' }
        )
    }

    return NextResponse.json(
      { success: true, message: 'Consent saved' },
      { headers: corsHeaders }
    )
  } catch (error) {
    apiLogger.error('Error saving consent', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save consent' },
      { status: 500, headers: corsHeaders }
    )
  }
}
