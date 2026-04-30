
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

// GET - Team attendance dashboard
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is Manager, HR, or Super Admin
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = userData?.sub_role === 'hr_executive' || userData?.sub_role === 'hr_manager'
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN'
    const isManager = userData?.sub_role?.includes('manager')

    if (!isHR && !isSuperAdmin && !isManager) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || new Date().getMonth() + 1
    const year = searchParams.get('year') || new Date().getFullYear()
    const department = searchParams.get('department')

    // Build query
    let query = supabase
      .from('vw_team_attendance_dashboard')
      .select('*')

    // Filters
    if (!isHR && !isSuperAdmin && isManager) {
      // Managers see only their team
      query = query.eq('manager_id', user.id)
    }

    if (department) {
      query = query.eq('department', department)
    }

    // Month/year filter
    const monthStart = new Date(parseInt(year as string), parseInt(month as string) - 1, 1)
    query = query.eq('month', monthStart.toISOString())

    const { data: teamData, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: teamData || [],
      filters: {
        month: parseInt(month as string),
        year: parseInt(year as string),
        department
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Team attendance report error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team attendance' },
      { status: 500 }
    )
  }
}
