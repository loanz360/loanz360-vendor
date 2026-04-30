
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { csrfProtection } from '@/lib/middleware/csrf'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// POST - Bulk approve leave requests
export async function POST(request: NextRequest) {
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  try {
    const rateLimitResponse = await rateLimit(request, {
    ...RATE_LIMIT_CONFIGS.DEFAULT,
    maxRequests: 10,
    windowMs: 60 * 60 * 1000
  })
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or Super Admin (strict role check)
    const { data: userData } = await adminClient
      .from('employees')
      .select('id, role, sub_role, user_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    const normalizedSubRole = (userData?.sub_role || '').toUpperCase().trim()
    const normalizedRole = (userData?.role || '').toUpperCase().trim()

    const HR_ALLOWED_ROLES = ['HR_EXECUTIVE', 'HR_MANAGER', 'HR', 'SUPER_ADMIN', 'SUPERADMIN', 'ADMIN']
    const isHR = HR_ALLOWED_ROLES.includes(normalizedSubRole) || HR_ALLOWED_ROLES.includes(normalizedRole)

    // Managers can only approve leaves of their direct reports
    // Use explicit role check — never use .includes() to prevent privilege escalation
    // (e.g., 'ACCOUNT_MANAGER' should not get manager-level leave approval)
    const MANAGER_ROLES = ['MANAGER', 'TEAM_LEAD', 'TEAM_MANAGER', 'DEPARTMENT_MANAGER']
    const isManager = MANAGER_ROLES.includes(normalizedSubRole) && !isHR

    if (!isHR && !isManager) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { leave_request_ids, comments } = body

    if (!Array.isArray(leave_request_ids) || leave_request_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No leave requests selected' },
        { status: 400 }
      )
    }

    // Validate UUID format for all IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const invalidIds = leave_request_ids.filter((id: string) => !uuidRegex.test(id))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid leave request IDs' },
        { status: 400 }
      )
    }

    // If manager (not HR), verify they can only approve their direct reports' leaves
    if (isManager && !isHR) {
      const { data: directReportLeaves } = await adminClient
        .from('leave_applications')
        .select('id, user_id')
        .in('id', leave_request_ids)

      if (directReportLeaves && directReportLeaves.length > 0) {
        const reportUserIds = directReportLeaves.map((l: { user_id: string }) => l.user_id)
        const { data: reports } = await adminClient
          .from('employees')
          .select('user_id')
          .eq('reporting_manager_id', userData?.id)
          .in('user_id', reportUserIds)
          .is('deleted_at', null)

        const authorizedUserIds = new Set((reports || []).map((r: { user_id: string }) => r.user_id))
        const unauthorizedLeaves = directReportLeaves.filter(
          (l: { user_id: string }) => !authorizedUserIds.has(l.user_id)
        )

        if (unauthorizedLeaves.length > 0) {
          return NextResponse.json(
            { success: false, error: 'You can only approve leave requests from your direct reports' },
            { status: 403 }
          )
        }
      }
    }

    // Call bulk approve function
    const { data: result, error } = await adminClient
      .rpc('bulk_approve_leaves', {
        p_leave_request_ids: leave_request_ids,
        p_approver_id: user.id,
        p_comments: comments || null
      })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully approved ${result.success_count} requests. ${result.error_count} errors.`
    })

  } catch (error: unknown) {
    apiLogger.error('Bulk leave approval error', error)
    logApiError(error instanceof Error ? error : new Error('Unknown error'), request, { action: 'bulk_leave_approval' })
    return NextResponse.json(
      { success: false, error: 'Failed to approve leave requests' },
      { status: 500 }
    )
  }
}
