import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { WhatsAppProvider } from '@/lib/communication/providers/whatsapp-provider'
import { apiLogger } from '@/lib/utils/logger'

/**
 * WhatsApp Webhook Endpoint
 * Handles delivery status updates and incoming messages
 */

/**
 * GET - Webhook verification (Meta requirement)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'loanz360_whatsapp_verify'

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
}

/**
 * POST - Receive webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr

    // Process webhook asynchronously
    WhatsAppProvider.handleWebhook(body).catch(error => {
      apiLogger.error('WhatsApp webhook processing error', error)
    })

    // Respond immediately (Meta requires 200 OK within 20 seconds)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    apiLogger.error('WhatsApp webhook error', error)
    return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 500 })
  }
}
