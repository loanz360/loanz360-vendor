
/**
 * Assignment Rules Statistics API
 * Get analytics about assignment rules performance
 * Admin access only
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
// Verify authentication
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      const adminId = payload.sub as string

      if (!adminId) {
        throw new Error('Invalid token payload')
      }

      // Verify admin role
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', adminId)
        .maybeSingle()

      if (userError || !user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized access' },
          { status: 403 }
        )
      }
    } catch (error) {
      apiLogger.error('JWT verification error', error)
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Get total rules count
    const { count: totalRules, error: totalError } = await supabase
      .from('lead_assignment_rules')
      .select('*', { count: 'exact', head: true })

    if (totalError) {
      apiLogger.error('Error counting total rules', totalError)
    }

    // Get active rules count
    const { count: activeRules, error: activeError } = await supabase
      .from('lead_assignment_rules')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    if (activeError) {
      apiLogger.error('Error counting active rules', activeError)
    }

    // Get total assignments
    const { count: totalAssignments, error: assignError } = await supabase
      .from('lead_assignment_history')
      .select('*', { count: 'exact', head: true })

    if (assignError) {
      apiLogger.error('Error counting assignments', assignError)
    }

    // Get average assignment time (last 100 assignments)
    const { data: recentAssignments, error: timeError } = await supabase
      .from('lead_assignment_history')
      .select('assignment_time_ms')
      .order('assigned_at', { ascending: false })
      .limit(100)

    let avgAssignmentTime = 0
    if (!timeError && recentAssignments && recentAssignments.length > 0) {
      const sum = recentAssignments.reduce((acc, curr) => acc + (curr.assignment_time_ms || 0), 0)
      avgAssignmentTime = Math.round(sum / recentAssignments.length)
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalRules: totalRules || 0,
        activeRules: activeRules || 0,
        totalAssignments: totalAssignments || 0,
        avgAssignmentTime: avgAssignmentTime
      }
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/admin/assignment-rules/stats', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
