export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * POST /api/auth/check-email
 *
 * Checks if an email is already registered in the system.
 * Used during signup to proactively detect auto-registered members
 * (e.g., entity members created by admins) before they fill out the form.
 *
 * Returns whether the email exists and if it was auto-registered.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Check if user exists in auth using admin API
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1
    })

    if (error) {
      // If admin API is not available, return unknown state
      return NextResponse.json({
        success: true,
        exists: false,
        auto_registered: false
      })
    }

    // Use a more targeted approach - look up by email directly
    // Supabase admin getUserByEmail is not available in all versions,
    // so we query the auth.users through a filtered approach
    const { data: authUsers } = await supabaseAdmin
      .from('auth.users')
      .select('id, email, created_at, raw_user_meta_data')
      .eq('email', email.toLowerCase().trim())
      .limit(1)

    // If direct table query fails (RLS), try admin API
    if (!authUsers) {
      // Fallback: check if any user profile exists with this email
      const { data: customerProfile } = await supabaseAdmin
        .from('customer_identities')
        .select('id, auth_user_id, status')
        .eq('email', email.toLowerCase().trim())
        .limit(1)
        .maybeSingle()

      if (customerProfile) {
        return NextResponse.json({
          success: true,
          exists: true,
          auto_registered: !customerProfile.auth_user_id,
          message: 'An account with this email already exists. Please sign in instead.'
        })
      }

      // Also check individuals table
      const { data: individual } = await supabaseAdmin
        .from('individuals')
        .select('id, auth_user_id')
        .eq('email', email.toLowerCase().trim())
        .limit(1)
        .maybeSingle()

      if (individual) {
        return NextResponse.json({
          success: true,
          exists: true,
          auto_registered: false,
          message: 'An account with this email already exists. Please sign in instead.'
        })
      }

      return NextResponse.json({
        success: true,
        exists: false,
        auto_registered: false
      })
    }

    const existingUser = authUsers[0]

    if (existingUser) {
      const isAutoRegistered = existingUser.raw_user_meta_data?.auto_registered === true

      return NextResponse.json({
        success: true,
        exists: true,
        auto_registered: isAutoRegistered,
        message: isAutoRegistered
          ? 'This email was already registered by your organization admin. Please sign in with the credentials sent to your email.'
          : 'An account with this email already exists. Please sign in instead.'
      })
    }

    return NextResponse.json({
      success: true,
      exists: false,
      auto_registered: false
    })
  } catch (error) {
    apiLogger.error('Error in check-email API', error)
    // Don't block signup on check failure
    return NextResponse.json({
      success: true,
      exists: false,
      auto_registered: false
    })
  }
}
