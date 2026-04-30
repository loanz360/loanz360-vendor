
/**
 * API Route: ULAP Share Link - Generate
 * POST /api/ulap/share-link/generate - Generate a trackable shareable link
 *
 * Creates a shareable link with hidden tracking (trace_token)
 * that expires after 30 days (configurable)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

// Base URL for generating shareable links
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'

// Generate short code for link
function generateShortCode(): string {
  // Generate a more readable 8-character code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed confusing chars like O, 0, I, 1
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Generate trace token (hidden from user, used for tracking)
function generateTraceToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Extract parameters
    const sourceType = body.source_type || 'ULAP_SHARE_LINK'
    const sourceUserId = body.source_user_id || user.id
    const sourceUserName = body.source_user_name || user.user_metadata?.full_name || 'Unknown'
    const sourcePartnerId = body.source_partner_id || null
    const sourcePartnerName = body.source_partner_name || null
    const expiryDays = body.expiry_days || 30
    const customerName = body.customer_name || null
    const customerMobile = body.customer_mobile || null
    const loanType = body.loan_type || null

    // Generate short code and trace token
    const shortCode = generateShortCode()
    const traceToken = generateTraceToken()

    // Calculate expiry date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiryDays)

    // Generate the full URL (clean, no tracking visible)
    const fullUrl = `${BASE_URL}/apply/${shortCode}`

    // Insert into share_links table
    const shareLink = {
      short_code: shortCode,
      full_url: fullUrl,
      trace_token: traceToken,
      source_type: sourceType,
      source_user_id: sourceUserId,
      source_user_name: sourceUserName,
      source_partner_id: sourcePartnerId,
      source_partner_name: sourcePartnerName,
      customer_name: customerName,
      customer_mobile: customerMobile,
      loan_type: loanType,
      expires_at: expiresAt.toISOString(),
      is_active: true,
      open_count: 0,
      conversion_count: 0,
      created_at: new Date().toISOString(),
      created_by_id: user.id,
      created_by_name: sourceUserName,
    }

    const { data: link, error: insertError } = await supabase
      .from('ulap_share_links')
      .insert([shareLink])
      .select('*')
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating share link', insertError)

      // If table doesn't exist, create a fallback response
      // The link will still work via the apply/[code] route
      if (insertError.code === '42P01') {
        // Table doesn't exist - return link without persistence
        return NextResponse.json({
          success: true,
          link: {
            id: crypto.randomUUID(),
            short_code: shortCode,
            full_url: fullUrl,
            trace_token: traceToken,
            created_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            is_active: true,
            open_count: 0,
            conversion_count: 0,
            source_type: sourceType,
            created_by_id: user.id,
            created_by_name: sourceUserName,
          },
          message: 'Link generated (persistence disabled)',
        })
      }

      return NextResponse.json(
        { success: false, error: 'Failed to create share link' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      link: {
        id: link.id,
        short_code: link.short_code,
        full_url: link.full_url,
        trace_token: link.trace_token,
        created_at: link.created_at,
        expires_at: link.expires_at,
        is_active: link.is_active,
        open_count: link.open_count,
        conversion_count: link.conversion_count,
        source_type: link.source_type,
        created_by_id: link.created_by_id,
        created_by_name: link.created_by_name,
      },
    })
  } catch (error) {
    apiLogger.error('Error in share-link generate API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
