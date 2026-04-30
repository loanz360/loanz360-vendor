
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'

/**
 * GET /api/incentives/my-incentives
 * Fetch all incentives for the authenticated employee
 * Returns both active and expired incentives with allocation data
 * Access: All authenticated employees
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') // 'active' or 'expired'

    // Get user's employee profile using the enhanced helper function
    // This checks both 'employees' and 'employee_profile' tables
    const { data: employee, error: empError } = await supabase
      .rpc('get_employee_by_auth_user', { p_user_id: user.id })
      .maybeSingle()

    // If no employee found, log details and return helpful error
    if (!employee) {
      logger.error('Employee profile not found in both employees and employee_profile tables', {
        userId: user.id,
        userEmail: user.email,
        error: empError
      })
      return NextResponse.json({ success: false, error: 'Employee profile not found. Please contact support at support@loanz360.com to link your account.',
        details: process.env.NODE_ENV === 'development' ? {
          userId: user.id,
          userEmail: user.email,
          message: 'Your employee record may not be linked to your auth account. Contact your system administrator.'
        } : undefined
      }, { status: 404 })
    }

    // Check if employee account is active (employee_status should be ACTIVE or similar)
    if (employee.employee_status !== 'ACTIVE' && employee.employee_status !== 'active') {
      logger.warn('Inactive employee account attempted to access incentives', {
        employeeId: employee.id,
        status: employee.employee_status
      })
      return NextResponse.json({ success: false, error: 'Employee account is not active' }, { status: 403 })
    }

    // Role check: exclude support/admin/back-office roles that don't have incentives
    const ROLES_WITHOUT_INCENTIVES = new Set([
      'ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER',
      'COMPLIANCE_OFFICER', 'COMPLIANCE_MANAGER',
      'LEGAL_OFFICER', 'LEGAL_MANAGER',
      'IT_SUPPORT', 'IT_MANAGER',
      'FACILITY_MANAGER', 'RECEPTIONIST',
      'CUSTOMER_SUPPORT_EXECUTIVE', 'CUSTOMER_SUPPORT_MANAGER',
    ])
    const subRole = employee.sub_role || employee.designation || ''
    if (ROLES_WITHOUT_INCENTIVES.has(subRole.toUpperCase())) {
      return NextResponse.json({ success: false, error: 'Incentives not available for this role' }, { status: 403 })
    }

    // Fetch active incentives using user.id (auth UUID, not employee.id)
    let activeIncentives: any[] = []
    if (!statusFilter || statusFilter === 'active') {
      const { data: activeData, error: activeError } = await supabase.rpc(
        'get_active_incentives_for_user',
        { user_uuid: user.id }
      )

      if (activeError) {
        logger.error('Error fetching active incentives', {
          employeeId: employee.id,
          error: activeError
        })
      } else {
        activeIncentives = activeData || []
      }
    }

    // Fetch expired incentives using user.id (auth UUID, not employee.id)
    let expiredIncentives: any[] = []
    if (!statusFilter || statusFilter === 'expired') {
      const { data: expiredData, error: expiredError } = await supabase.rpc(
        'get_expired_incentives_for_user',
        { user_uuid: user.id }
      )

      if (expiredError) {
        logger.error('Error fetching expired incentives', {
          employeeId: employee.id,
          error: expiredError
        })
      } else {
        expiredIncentives = expiredData || []
      }
    }

    // Calculate summary statistics
    const totalActive = activeIncentives.length
    const totalExpired = expiredIncentives.length
    const inProgress = activeIncentives.filter((i) => i.progress_percentage > 0).length
    const achieved = activeIncentives.filter((i) => i.allocation_status === 'achieved').length

    // Calculate total potential earnings
    const totalPotentialEarnings = activeIncentives.reduce(
      (sum, i) => sum + (parseFloat(i.reward_amount) || 0),
      0
    )

    // Calculate total earned (from allocations)
    const totalEarned = [
      ...activeIncentives.filter((i) => i.earned_amount),
      ...expiredIncentives.filter((i) => i.earned_amount),
    ].reduce((sum, i) => sum + (parseFloat(i.earned_amount) || 0), 0)

    return NextResponse.json({
      success: true,
      data: {
        active: activeIncentives,
        expired: expiredIncentives,
      },
      summary: {
        total_active: totalActive,
        total_expired: totalExpired,
        in_progress: inProgress,
        achieved: achieved,
        total_potential_earnings: totalPotentialEarnings,
        total_earned: totalEarned,
      },
    })
  } catch (error) {
    logger.error('Error in GET /api/incentives/my-incentives', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchMyIncentives' })
    return NextResponse.json({ success: false, error: 'Failed to fetch incentives' }, { status: 500 })
  }
}
