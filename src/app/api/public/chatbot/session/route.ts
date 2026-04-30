
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'
import { randomBytes } from 'crypto'
import {
  getClientIP,
  rateLimitCombined,
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS
} from '@/lib/middleware/rate-limiter'
import { sanitizeCollectedData } from '@/lib/utils/sanitize'
import { apiLogger } from '@/lib/utils/logger'

// Generate a secure session token
function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

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

// POST - Create new chat session
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  const corsHeaders = getCorsHeaders(origin)

  try {
    const body = await request.json()
    const { chatbot_id, visitor_data } = body

    if (!chatbot_id) {
      return NextResponse.json(
        { success: false, error: 'Chatbot ID required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Rate limiting
    const clientIP = getClientIP(request.headers)
    const rateLimitResult = rateLimitCombined(
      clientIP,
      chatbot_id,
      'session',
      RATE_LIMIT_CONFIGS.SESSION_CREATE
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            ...getRateLimitHeaders(rateLimitResult)
          }
        }
      )
    }

    const supabase = await createClient()

    // Verify chatbot exists and is active
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, status')
      .eq('id', chatbot_id)
      .eq('status', 'active')
      .maybeSingle()

    if (chatbotError || !chatbot) {
      return NextResponse.json(
        { success: false, error: 'Chatbot not found or inactive' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Get visitor info from request
    const userAgent = request.headers.get('user-agent') || ''
    const referer = request.headers.get('referer') || ''

    // Sanitize visitor data
    const sanitizedVisitorData = visitor_data
      ? sanitizeCollectedData(visitor_data)
      : {}

    // Create session
    const sessionId = uuidv4()
    const sessionToken = generateSessionToken()
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .insert({
        id: sessionId,
        session_token: sessionToken,
        chatbot_id,
        visitor_id: uuidv4(),
        visitor_data: {
          ...sanitizedVisitorData,
          ip: clientIP,
          userAgent: userAgent.slice(0, 500), // Limit UA length
          referer: referer.slice(0, 2000) // Limit referer length
        },
        device_type: detectDeviceType(userAgent),
        browser: detectBrowser(userAgent),
        country: null,
        city: null,
        page_url: (sanitizedVisitorData as Record<string, unknown>)?.url as string || referer.slice(0, 2000),
        status: 'active',
        started_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (sessionError) {
      apiLogger.error('Session create error', sessionError)
      throw sessionError
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          session_id: session.id,
          session_token: session.session_token
        }
      },
      {
        headers: {
          ...corsHeaders,
          ...getRateLimitHeaders(rateLimitResult)
        }
      }
    )
  } catch (error) {
    apiLogger.error('Error creating session', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500, headers: corsHeaders }
    )
  }
}

function detectDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (/mobile|android|iphone|ipad|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
    if (/ipad|tablet/i.test(ua)) {
      return 'tablet'
    }
    return 'mobile'
  }
  return 'desktop'
}

function detectBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes('chrome')) return 'Chrome'
  if (ua.includes('firefox')) return 'Firefox'
  if (ua.includes('safari')) return 'Safari'
  if (ua.includes('edge')) return 'Edge'
  if (ua.includes('opera')) return 'Opera'
  if (ua.includes('msie') || ua.includes('trident')) return 'IE'
  return 'Unknown'
}
