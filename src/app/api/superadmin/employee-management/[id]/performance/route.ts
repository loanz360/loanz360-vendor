
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/superadmin/employee-management/[id]/performance
 * Fetch performance logs for a specific employee
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id
    const supabase = createSupabaseAdmin()

    // Fetch performance logs
    const { data: performanceLogs, error } = await supabase
      .from('employee_performance_logs')
      .select('*')
      .eq('employee_id', employeeId)
      .order('log_date', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch performance logs'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        performance_logs: performanceLogs || []
      }
    })

  } catch (error) {
    apiLogger.error('Error in GET performance logs', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
