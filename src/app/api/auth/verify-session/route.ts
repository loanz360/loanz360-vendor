/**
 * Verify if current session is valid
 * This allows client-side components to check authentication
 * without needing to read HttpOnly cookies
 *
 * OPTIMIZED: Combined queries for faster response
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Check for super_admin_session cookie
    const superAdminSession = request.cookies.get('super_admin_session')?.value

    if (!superAdminSession) {
      return NextResponse.json({
        authenticated: false,
        role: null
      })
    }

    // Single optimized query: join session with admin data
    const supabase = createSupabaseAdmin()

    const { data: session, error } = await supabase
      .from('super_admin_sessions')
      .select(`
        super_admin_id,
        expires_at,
        super_admins!inner (
          id,
          email,
          full_name,
          is_active,
          is_locked
        )
      `)
      .eq('session_id', superAdminSession)
      .maybeSingle()

    if (error || !session) {
      return NextResponse.json({
        authenticated: false,
        role: null
      })
    }

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({
        authenticated: false,
        role: null,
        reason: 'expired'
      })
    }

    // Type assertion for the joined data
    const admin = session.super_admins as unknown as {
      id: string
      email: string
      full_name: string
      is_active: boolean
      is_locked: boolean
    }

    if (!admin || !admin.is_active || admin.is_locked) {
      return NextResponse.json({
        authenticated: false,
        role: null,
        reason: 'inactive'
      })
    }

    // Valid session
    return NextResponse.json({
      authenticated: true,
      role: 'SUPER_ADMIN',
      user: {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name
      }
    })

  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      role: null
    }, { status: 500 })
  }
}
