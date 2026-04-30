
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

// GET - Leave utilization report
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

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const department = searchParams.get('department')
    const employee_id = searchParams.get('employee_id')

    // Check permissions
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = userData?.sub_role === 'hr_executive' || userData?.sub_role === 'hr_manager'
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN'

    let query = supabase
      .from('vw_leave_utilization')
      .select('*')
      .eq('year', year)

    // If not HR/Super Admin, only show own data
    if (!isHR && !isSuperAdmin) {
      query = query.eq('employee_id', user.id)
    } else if (employee_id) {
      query = query.eq('employee_id', employee_id)
    } else if (department) {
      query = query.eq('department', department)
    }

    const { data: utilizationData, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: utilizationData || [],
      filters: { year, department, employee_id }
    })

  } catch (error: unknown) {
    apiLogger.error('Leave utilization report error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leave utilization' },
      { status: 500 }
    )
  }
}
