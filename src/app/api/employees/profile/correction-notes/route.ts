export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { logger } from '@/lib/utils/logger'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const runtime = 'nodejs'

/**
 * GET /api/employees/profile/correction-notes
 * Fetch unresolved correction notes for the current employee
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const sessionData = verifySessionToken(authToken)
    if (!sessionData) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const [tokenBlacklisted, sessionRevoked] = await Promise.all([
      isTokenBlacklisted(authToken),
      isSessionRevoked(sessionData.sessionId)
    ])

    if (tokenBlacklisted || sessionRevoked) {
      return NextResponse.json({ success: false, error: 'Session invalidated' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()

    // Get the employee ID for this user
    const { data: employee } = await supabase
      .from('employees')
      .select('id, employee_status')
      .eq('user_id', sessionData.userId)
      .maybeSingle()

    if (!employee) {
      return NextResponse.json({ success: true, data: [], employee_status: null })
    }

    // Fetch unresolved correction notes
    const { data: notes, error } = await supabase
      .from('employee_profile_review_notes')
      .select('id, note_type, field_reference, note_text, is_resolved, created_at')
      .eq('employee_id', employee.id)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error fetching correction notes:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch correction notes' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: notes || [],
      employee_status: employee.employee_status,
    })
  } catch (error) {
    logger.error('Error in GET /api/employees/profile/correction-notes:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
