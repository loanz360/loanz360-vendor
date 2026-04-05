export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'

// GET /api/hr/payroll/runs/[id]/details
// Get payroll details for a specific run
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or superadmin
    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can view payroll details' },
        { status: 403 }
      )
    }

    const payrollRunId = id

    // Verify the payroll run exists
    const { data: payrollRun, error: runError } = await adminClient
      .from('payroll_runs')
      .select('id')
      .eq('id', payrollRunId)
      .maybeSingle()

    if (runError) throw runError

    if (!payrollRun) {
      return NextResponse.json(
        { success: false, error: 'Payroll run not found' },
        { status: 404 }
      )
    }

    // Pagination
    const sp = request.nextUrl.searchParams
    const page = parseInt(sp.get('page') || '1', 10)
    const pageSize = Math.min(parseInt(sp.get('page_size') || '50', 10), 100)
    const offset = (page - 1) * pageSize

    // Get payroll details with employee information
    const { data: details, error, count } = await adminClient
      .from('payroll_details')
      .select(`
        *,
        employee_profile!payroll_details_user_id_fkey (
          first_name,
          last_name,
          employee_id,
          email,
          department,
          designation
        )
      `, { count: 'exact' })
      .eq('payroll_run_id', payrollRunId)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: details || [],
      meta: {
        total: count || 0,
        page,
        page_size: pageSize,
      }
    })

  } catch (error) {
    apiLogger.error('Fetch payroll details error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payroll details' },
      { status: 500 }
    )
  }
}
