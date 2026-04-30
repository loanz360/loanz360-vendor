import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { logger } from '@/lib/utils/logger'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const runtime = 'nodejs'

/**
 * Verify superadmin authentication
 */
async function verifySuperAdmin(_request: NextRequest): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return { authorized: false, error: 'Unauthorized - No authentication token' }
  }

  const sessionData = verifySessionToken(authToken)
  if (!sessionData) {
    return { authorized: false, error: 'Unauthorized - Invalid or expired token' }
  }

  const [tokenBlacklisted, sessionRevoked] = await Promise.all([
    isTokenBlacklisted(authToken),
    isSessionRevoked(sessionData.sessionId)
  ])

  if (tokenBlacklisted || sessionRevoked) {
    return { authorized: false, error: 'Unauthorized - Session invalidated' }
  }

  if (sessionData.role !== 'SUPERADMIN') {
    return { authorized: false, error: 'Forbidden - Superadmin access required' }
  }

  return { authorized: true, userId: sessionData.userId }
}

/**
 * GET /api/superadmin/profile
 * Fetch superadmin profile with all enhanced fields
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await verifySuperAdmin(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch user data with extended fields
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('full_name, email, avatar_url, created_at, updated_at')
      .eq('id', auth.userId)
      .maybeSingle()

    if (userError) {
      logger.error('Error fetching superadmin data', userError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile data' },
        { status: 500 }
      )
    }

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Fetch extended profile data if exists
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        mobile,
        location,
        secondary_email,
        secondary_mobile,
        country_code,
        timezone,
        language,
        date_of_birth,
        digital_signature_url,
        display_name,
        department,
        designation,
        theme_preference,
        notification_preferences,
        accessibility_settings,
        last_login_at,
        last_login_ip,
        two_factor_enabled,
        two_factor_method
      `)
      .eq('user_id', auth.userId)
      .maybeSingle()

    // Fetch active sessions
    const { data: sessions } = await supabase
      .from('super_admin_sessions')
      .select('session_id, ip_address, user_agent, created_at, last_activity, expires_at, is_active')
      .eq('super_admin_id', auth.userId)
      .eq('is_active', true)
      .order('last_activity', { ascending: false })
      .limit(10)

    // Fetch recent audit logs
    const { data: auditLogs } = await supabase
      .from('super_admin_audit_log')
      .select('id, action, resource, details, ip_address, success, created_at')
      .eq('super_admin_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(20)

    // Build comprehensive profile response
    const profileData = {
      // Personal Information
      personal: {
        fullName: userData.full_name || '',
        displayName: profile?.display_name || userData.full_name?.split(' ')[0] || '',
        email: userData.email || '',
        secondaryEmail: profile?.secondary_email || '',
        avatarUrl: userData.avatar_url || '',
        mobile: profile?.mobile || '',
        secondaryMobile: profile?.secondary_mobile || '',
        countryCode: profile?.country_code || '+91',
        timezone: profile?.timezone || 'Asia/Kolkata',
        language: profile?.language || 'en',
        dateOfBirth: profile?.date_of_birth || '',
        digitalSignatureUrl: profile?.digital_signature_url || null
      },

      // Organization Information
      organization: {
        organizationName: 'Loanz360 Financial Services',
        legalEntityName: 'Loanz360 Pvt. Ltd.',
        organizationType: 'NBFC',
        designation: profile?.designation || 'Super Administrator',
        roleLevel: 'Level 1 - Full Access',
        employeeId: auth.userId?.slice(0, 8).toUpperCase() || 'SA-00001',
        department: profile?.department || 'Technology & Operations',
        reportingTo: 'Board of Directors'
      },

      // Security Settings
      security: {
        username: userData.email || '',
        twoFactorEnabled: profile?.two_factor_enabled || false,
        twoFactorMethod: profile?.two_factor_method || null,
        lastLoginAt: profile?.last_login_at || null,
        lastLoginIp: profile?.last_login_ip || null,
        passwordChangedAt: userData.updated_at || userData.created_at,
        passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      },

      // Preferences
      preferences: {
        theme: profile?.theme_preference || 'dark',
        notifications: profile?.notification_preferences || {
          email: true,
          sms: true,
          inApp: true,
          push: false
        },
        accessibility: profile?.accessibility_settings || {
          highContrast: false,
          reducedMotion: false,
          largeText: false
        }
      },

      // Active Sessions
      sessions: sessions?.map(s => ({
        sessionId: s.session_id,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        createdAt: s.created_at,
        lastActivity: s.last_activity,
        expiresAt: s.expires_at,
        isActive: s.is_active
      })) || [],

      // Activity Logs
      activityLogs: auditLogs?.map(log => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        details: log.details,
        ipAddress: log.ip_address,
        success: log.success,
        timestamp: log.created_at
      })) || [],

      // Metadata
      metadata: {
        createdAt: userData.created_at,
        updatedAt: userData.updated_at,
        profileVersion: 1
      }
    }

    return NextResponse.json({
      success: true,
      data: profileData
    })
  } catch (error) {
    logger.error('Error in GET /api/superadmin/profile', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/profile
 * Update superadmin profile with extended fields
 */
export async function PUT(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await verifySuperAdmin(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      // Personal fields
      fullName,
      displayName,
      mobile,
      secondaryMobile,
      secondaryEmail,
      countryCode,
      timezone,
      language,
      dateOfBirth,
      digitalSignatureUrl,
      // Organization fields
      department,
      designation,
      // Preferences
      theme,
      notifications,
      accessibility
    } = body

    const supabase = createSupabaseAdmin()

    // Update full name in users table
    if (fullName !== undefined) {
      const { error: userError } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString()
        })
        .eq('id', auth.userId)

      if (userError) {
        logger.error('Error updating user full name', userError)
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        )
      }
    }

    // Build profile update data
    const profileData: Record<string, unknown> = {}

    // Personal fields
    if (displayName !== undefined) profileData.display_name = displayName
    if (mobile !== undefined) profileData.mobile = mobile
    if (secondaryMobile !== undefined) profileData.secondary_mobile = secondaryMobile
    if (secondaryEmail !== undefined) profileData.secondary_email = secondaryEmail
    if (countryCode !== undefined) profileData.country_code = countryCode
    if (timezone !== undefined) profileData.timezone = timezone
    if (language !== undefined) profileData.language = language
    if (dateOfBirth !== undefined) profileData.date_of_birth = dateOfBirth
    if (digitalSignatureUrl !== undefined) profileData.digital_signature_url = digitalSignatureUrl

    // Organization fields
    if (department !== undefined) profileData.department = department
    if (designation !== undefined) profileData.designation = designation

    // Preferences
    if (theme !== undefined) profileData.theme_preference = theme
    if (notifications !== undefined) profileData.notification_preferences = notifications
    if (accessibility !== undefined) profileData.accessibility_settings = accessibility

    // Only update profiles table if there are fields to update
    if (Object.keys(profileData).length > 0) {
      profileData.updated_at = new Date().toISOString()

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', auth.userId)
        .maybeSingle()

      if (!existingProfile) {
        // Create new profile
        profileData.user_id = auth.userId
        profileData.created_at = new Date().toISOString()

        const { error: insertError } = await supabase
          .from('profiles')
          .insert(profileData)

        if (insertError) {
          logger.error('Error creating profile', insertError)
          return NextResponse.json(
            { success: false, error: 'Failed to create profile' },
            { status: 500 }
          )
        }
      } else {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('user_id', auth.userId)

        if (updateError) {
          logger.error('Error updating profile', updateError)
          return NextResponse.json(
            { success: false, error: 'Failed to update profile' },
            { status: 500 }
          )
        }
      }
    }

    // Log the profile update action
    try {
      await supabase
        .from('super_admin_audit_log')
        .insert({
          super_admin_id: auth.userId,
          action: 'PROFILE_UPDATE',
          resource: 'profile',
          resource_id: auth.userId,
          details: {
            updated_fields: Object.keys(profileData).filter(k => k !== 'updated_at'),
            timestamp: new Date().toISOString()
          },
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          success: true
        })
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      logger.warn('Failed to log profile update audit', auditError)
    }

    logger.info('Superadmin profile updated successfully', { userId: auth.userId })

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully'
    })
  } catch (error) {
    logger.error('Error in PUT /api/superadmin/profile', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/profile/session
 * Revoke a specific session
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifySuperAdmin(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Revoke the session
    const { error } = await supabase
      .from('super_admin_sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoke_reason: 'Manual revocation by user'
      })
      .eq('session_id', sessionId)
      .eq('super_admin_id', auth.userId)

    if (error) {
      logger.error('Error revoking session', error)
      return NextResponse.json(
        { success: false, error: 'Failed to revoke session' },
        { status: 500 }
      )
    }

    // Log the session revocation
    await supabase
      .from('super_admin_audit_log')
      .insert({
        super_admin_id: auth.userId,
        action: 'SESSION_REVOKED',
        resource: 'session',
        resource_id: sessionId,
        details: { reason: 'Manual revocation by user' },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        success: true
      })

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully'
    })
  } catch (error) {
    logger.error('Error in DELETE /api/superadmin/profile', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
