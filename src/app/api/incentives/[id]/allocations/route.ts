
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import logger from '@/lib/monitoring/logger'
import { verifyAuth } from '@/lib/auth/employee-mgmt-auth'

/**
 * GET /api/incentives/[id]/allocations
 * Fetch all allocations for an incentive with employee details
 * Access: SuperAdmin, HR
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Use verifyAuth for proper session handling
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: auth.status || 401 }
      )
    }

    // Check if user has admin/HR permissions
    const isSuperAdmin = auth.role === 'SUPER_ADMIN'
    const isHR = auth.role === 'HR'

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Forbidden: Only SuperAdmin or HR can view allocations' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const { id: incentiveId } = await params

    // Fetch allocations with employee details
    const { data: allocations, error } = await supabase
      .from('incentive_allocations')
      .select(`
        id,
        user_id,
        progress_percentage,
        allocation_status,
        earned_amount,
        current_progress,
        created_at,
        updated_at
      `)
      .eq('incentive_id', incentiveId)
      .order('progress_percentage', { ascending: false })

    if (error) {
      logger.error('Error fetching allocations', { error, incentiveId })
      throw error
    }

    // Fetch employee details for each allocation
    const userIds = allocations?.map(a => a.user_id) || []

    let employees: unknown[] = []
    if (userIds.length > 0) {
      const { data: empData } = await supabase
        .from('employees')
        .select('id, full_name, work_email, sub_role, employee_id, department')
        .in('id', userIds)

      employees = empData || []
    }

    // Merge employee data with allocations
    const allocationsWithEmployees = allocations?.map(allocation => {
      const employee = employees.find(e => e.id === allocation.user_id)
      return {
        ...allocation,
        employee: employee || null
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: allocationsWithEmployees,
      count: allocationsWithEmployees.length
    })

  } catch (error) {
    logger.error('Error in GET /api/incentives/[id]/allocations', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to fetch allocations' },
      { status: 500 }
    )
  }
}
