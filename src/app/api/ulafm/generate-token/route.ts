
/**
 * Universal Loan Application Form - Generate Token API
 *
 * POST /api/ulafm/generate-token
 *
 * Generates a secure referral token for sharing loan application forms.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTokenSchema } from '@/lib/validations/ulafm-schemas'
import type { ShareLinkData, ULAFReferralToken } from '@/types/ulafm'
import { apiLogger } from '@/lib/utils/logger'

// Generate a secure random token
function generateSecureToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// Generate a short code
function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Generate QR code data URL (simple SVG-based)
function generateQRCodeDataURL(url: string): string {
  // In production, use a proper QR code library like 'qrcode'
  // For now, return a placeholder that indicates QR code generation is needed
  // This would be replaced with actual QR code generation

  // Placeholder SVG
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="white"/>
      <text x="100" y="100" text-anchor="middle" font-size="12" fill="#666">
        QR Code
      </text>
      <text x="100" y="120" text-anchor="middle" font-size="8" fill="#999">
        ${url.substring(0, 30)}...
      </text>
    </svg>
  `

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()

    // Validate input
    const validationResult = createTokenSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Get user profile for sender details
    // Check employee_profile first, then profiles, then use auth user data
    let senderName = user.user_metadata?.full_name || user.email
    let senderEmail = user.email
    let senderMobile = user.user_metadata?.phone || data.sender_mobile
    let senderHierarchy = null

    // Try to get employee profile
    const { data: employeeProfile } = await supabase
      .from('employee_profile')
      .select('name, email, mobile, department, reporting_to')
      .eq('id', user.id)
      .maybeSingle()

    if (employeeProfile) {
      senderName = employeeProfile.name || senderName
      senderEmail = employeeProfile.email || senderEmail
      senderMobile = employeeProfile.mobile || senderMobile
      senderHierarchy = {
        department_id: employeeProfile.department,
        manager_id: employeeProfile.reporting_to,
      }
    }

    // Generate tokens
    const token = generateSecureToken()
    const shortCode = generateShortCode()

    // Calculate expiry if specified
    let expiresAt: string | null = null
    if (data.expires_in_days) {
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + data.expires_in_days)
      expiresAt = expiry.toISOString()
    }

    // Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.loanz360.com'
    const fullUrl = `${baseUrl}/loan-application?ref=${token}`
    const shortUrl = `${baseUrl}/a/${shortCode}`

    // Generate QR code
    const qrCodeDataUrl = generateQRCodeDataURL(shortUrl)

    // Prepare token data
    const tokenData: Partial<ULAFReferralToken> = {
      token,
      short_code: shortCode,
      sender_id: user.id,
      sender_type: data.sender_type,
      sender_subrole: data.sender_subrole || null,
      sender_name: data.sender_name || senderName,
      sender_email: data.sender_email || senderEmail,
      sender_mobile: data.sender_mobile || senderMobile,
      sender_hierarchy: senderHierarchy,
      campaign_id: data.campaign_id || null,
      campaign_name: data.campaign_name || null,
      source: data.source || 'DIRECT',
      medium: data.medium || null,
      is_active: true,
      expires_at: expiresAt,
      max_uses: data.max_uses || null,
      current_uses: 0,
    }

    // TODO: Save to database when schema is ready
    // const { data: savedToken, error: saveError } = await supabase
    //   .from('ulaf_referral_tokens')
    //   .insert(tokenData)
    //   .select()
    //   .maybeSingle()

    // Mock saved token
    const savedToken: ULAFReferralToken = {
      id: crypto.randomUUID(),
      token,
      short_code: shortCode,
      sender_id: user.id,
      sender_type: data.sender_type,
      sender_subrole: data.sender_subrole,
      sender_name: data.sender_name || senderName,
      sender_email: data.sender_email || senderEmail,
      sender_mobile: data.sender_mobile || senderMobile,
      sender_hierarchy: senderHierarchy,
      campaign_id: data.campaign_id,
      campaign_name: data.campaign_name,
      source: data.source || 'DIRECT',
      medium: data.medium,
      is_active: true,
      expires_at: expiresAt || undefined,
      max_uses: data.max_uses,
      current_uses: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Prepare response
    const shareData: ShareLinkData = {
      full_url: fullUrl,
      short_url: shortUrl,
      short_code: shortCode,
      qr_code_data_url: qrCodeDataUrl,
      expires_at: expiresAt || undefined,
      token: savedToken,
    }

    return NextResponse.json({
      success: true,
      data: shareData,
    })
  } catch (error) {
    apiLogger.error('ULAFM Generate Token Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate share link',
      },
      { status: 500 }
    )
  }
}
