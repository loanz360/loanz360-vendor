/**
 * Unsubscribe Link Handler
 * One-click email unsubscribe for CAN-SPAM/GDPR compliance
 *
 * URL format: /api/unsubscribe/{token}
 * Token contains encrypted email + channel information
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || 'default-unsubscribe-key-change-in-prod'

// =====================================================
// GET - Show unsubscribe confirmation page
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const decoded = decodeUnsubscribeToken(params.token)

    if (!decoded) {
      return new NextResponse(renderErrorPage('Invalid or expired unsubscribe link'), {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    const { email, channel } = decoded

    return new NextResponse(renderUnsubscribePage(email, channel, params.token), {
      headers: { 'Content-Type': 'text/html' }
    })
  } catch (error) {
    apiLogger.error('[Unsubscribe] GET error', error)
    return new NextResponse(renderErrorPage('An error occurred'), {
      headers: { 'Content-Type': 'text/html' }
    })
  }
}

// =====================================================
// POST - Process unsubscribe
// =====================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const decoded = decodeUnsubscribeToken(params.token)

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 400 }
      )
    }

    const { email, channel } = decoded
    const supabase = createSupabaseAdmin()

    // Check if already unsubscribed
    const { data: existing } = await supabase
      .from('communication_optouts')
      .select('id, is_active')
      .eq('identifier', email.toLowerCase())
      .eq('channel', channel)
      .maybeSingle()

    if (existing?.is_active) {
      return new NextResponse(renderSuccessPage(email, true), {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // Add to opt-out list
    const { error } = await supabase
      .from('communication_optouts')
      .upsert({
        identifier: email.toLowerCase(),
        identifier_type: 'email',
        channel: channel,
        reason: 'user_request',
        source: 'unsubscribe_link',
        is_active: true,
        opted_out_at: new Date().toISOString(),
        notes: 'Unsubscribed via email link'
      }, {
        onConflict: 'identifier,channel'
      })

    if (error) {
      apiLogger.error('[Unsubscribe] Database error', error)
      return new NextResponse(renderErrorPage('Failed to process unsubscribe'), {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // Log to audit
    await supabase
      .from('communication_audit_log')
      .insert({
        action_type: 'unsubscribe',
        entity_type: 'optout',
        entity_id: email,
        changes: { email, channel, source: 'unsubscribe_link' }
      })

    return new NextResponse(renderSuccessPage(email, false), {
      headers: { 'Content-Type': 'text/html' }
    })
  } catch (error) {
    apiLogger.error('[Unsubscribe] POST error', error)
    return new NextResponse(renderErrorPage('An error occurred'), {
      headers: { 'Content-Type': 'text/html' }
    })
  }
}

// =====================================================
// TOKEN UTILITIES
// =====================================================

export function generateUnsubscribeToken(email: string, channel: string = 'email'): string {
  const data = JSON.stringify({
    email: email.toLowerCase(),
    channel,
    ts: Date.now()
  })

  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    crypto.createHash('sha256').update(UNSUBSCRIBE_SECRET).digest(),
    iv
  )

  let encrypted = cipher.update(data, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag()

  // Combine iv + authTag + encrypted and URL-safe encode
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')])
  return combined.toString('base64url')
}

function decodeUnsubscribeToken(token: string): { email: string; channel: string } | null {
  try {
    const combined = Buffer.from(token, 'base64url')

    const iv = combined.subarray(0, 16)
    const authTag = combined.subarray(16, 32)
    const encrypted = combined.subarray(32)

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      crypto.createHash('sha256').update(UNSUBSCRIBE_SECRET).digest(),
      iv
    )
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    const data = JSON.parse(decrypted.toString('utf8'))

    // Check if token is not too old (30 days)
    const maxAge = 30 * 24 * 60 * 60 * 1000
    if (Date.now() - data.ts > maxAge) {
      return null
    }

    return {
      email: data.email,
      channel: data.channel
    }
  } catch (error) {
    apiLogger.error('[Unsubscribe] Token decode error', error)
    return null
  }
}

// =====================================================
// HTML TEMPLATES
// =====================================================

function renderUnsubscribePage(email: string, channel: string, token: string): string {
  const maskedEmail = maskEmail(email)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - Loanz360</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .logo { font-size: 32px; font-weight: 700; color: #667eea; margin-bottom: 24px; }
    h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; margin-bottom: 24px; }
    .email {
      background: #f5f5f5;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: monospace;
      color: #333;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #dc3545;
      color: white;
    }
    .btn-primary:hover { background: #c82333; }
    .btn-secondary {
      background: #f5f5f5;
      color: #666;
      margin-left: 12px;
    }
    .btn-secondary:hover { background: #e5e5e5; }
    .footer { margin-top: 32px; font-size: 13px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Loanz360</div>
    <h1>Unsubscribe from Emails</h1>
    <p>You are about to unsubscribe the following email from ${channel === 'all' ? 'all' : channel} communications:</p>
    <div class="email">${maskedEmail}</div>
    <form method="POST" action="/api/unsubscribe/${token}">
      <button type="submit" class="btn btn-primary">Unsubscribe</button>
      <a href="/" class="btn btn-secondary">Cancel</a>
    </form>
    <div class="footer">
      <p>If you unsubscribe by mistake, you can resubscribe by contacting support.</p>
    </div>
  </div>
</body>
</html>`
}

function renderSuccessPage(email: string, alreadyUnsubscribed: boolean): string {
  const maskedEmail = maskEmail(email)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed - Loanz360</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .logo { font-size: 32px; font-weight: 700; color: #667eea; margin-bottom: 24px; }
    .icon { font-size: 64px; margin-bottom: 24px; }
    h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; margin-bottom: 24px; }
    .email {
      background: #f5f5f5;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: monospace;
      color: #333;
      margin-bottom: 24px;
    }
    .footer { margin-top: 32px; font-size: 13px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Loanz360</div>
    <div class="icon">✓</div>
    <h1>${alreadyUnsubscribed ? 'Already Unsubscribed' : 'Successfully Unsubscribed'}</h1>
    <p>${alreadyUnsubscribed
      ? 'This email was already unsubscribed from our mailing list.'
      : 'You have been successfully unsubscribed from our mailing list.'}</p>
    <div class="email">${maskedEmail}</div>
    <div class="footer">
      <p>You will no longer receive marketing emails from us.</p>
      <p>Important transactional emails (like password resets) may still be sent.</p>
    </div>
  </div>
</body>
</html>`
}

function renderErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Loanz360</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .logo { font-size: 32px; font-weight: 700; color: #667eea; margin-bottom: 24px; }
    .icon { font-size: 64px; margin-bottom: 24px; color: #dc3545; }
    h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; margin-bottom: 24px; }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      background: #667eea;
      color: white;
      text-decoration: none;
    }
    .btn:hover { background: #5a6fd6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Loanz360</div>
    <div class="icon">✕</div>
    <h1>Error</h1>
    <p>${message}</p>
    <a href="/" class="btn">Go to Homepage</a>
  </div>
</body>
</html>`
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`
}
