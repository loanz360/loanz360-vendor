
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * POST /api/notifications/push/register
 * Register a push notification token for the current user
 *
 * Body: {
 *   token: string,
 *   device_type: 'web' | 'ios' | 'android',
 *   device_name?: string,
 *   browser?: string
 * }
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse body
    const { token, device_type, device_name, browser } = await request.json()

    if (!token || !device_type) {
      return NextResponse.json(
        { error: 'Token and device_type are required' },
        { status: 400 }
      )
    }

    // Validate device_type
    if (!['web', 'ios', 'android'].includes(device_type)) {
      return NextResponse.json(
        { error: 'Invalid device_type. Must be: web, ios, or android' },
        { status: 400 }
      )
    }

    // Check if token already exists
    const { data: existingToken } = await supabase
      .from('user_push_tokens')
      .select('id, is_active')
      .eq('token', token)
      .maybeSingle()

    if (existingToken) {
      // Reactivate if inactive
      if (!existingToken.is_active) {
        await supabase
          .from('user_push_tokens')
          .update({
            is_active: true,
            user_id: user.id, // Update user_id in case device changed users
            device_name,
            browser,
            last_used_at: new Date().toISOString()
          })
          .eq('id', existingToken.id)

        return NextResponse.json({
          success: true,
          message: 'Push token reactivated',
          token_id: existingToken.id
        })
      }

      // Already active
      return NextResponse.json({
        success: true,
        message: 'Push token already registered',
        token_id: existingToken.id
      })
    }

    // Insert new token
    const { data: newToken, error: insertError } = await supabase
      .from('user_push_tokens')
      .insert({
        user_id: user.id,
        token,
        device_type,
        device_name,
        browser
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error registering push token', insertError)
      return NextResponse.json(
        { error: 'Failed to register push token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Push token registered successfully',
      token_id: newToken.id
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/notifications/push/register', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/push/register
 * Unregister a push notification token
 *
 * Body: { token: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Delete or deactivate token
    const { error: deleteError } = await supabase
      .from('user_push_tokens')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('token', token)

    if (deleteError) {
      apiLogger.error('Error unregistering push token', deleteError)
      return NextResponse.json(
        { error: 'Failed to unregister push token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Push token unregistered successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in DELETE /api/notifications/push/register', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
