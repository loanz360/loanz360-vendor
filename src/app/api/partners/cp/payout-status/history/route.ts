import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logger } from '@/lib/utils/logger'


/**
 * GET /api/partners/cp/payout-status/history
 * Get status history for a specific CP application
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const applicationId = searchParams.get('applicationId')

    if (!applicationId) {
      return NextResponse.json(
        { success: false, error: 'Application ID is required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user owns this application or is admin/employee
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check application ownership if not admin/employee
    if (userData.role === 'PARTNER') {
      const { data: application, error: appError } = await supabase
        .from('cp_applications')
        .select('cp_user_id')
        .eq('id', applicationId)
        .maybeSingle()

      if (appError || !application) {
        return NextResponse.json(
          { success: false, error: 'Application not found' },
          { status: 404 }
        )
      }

      if (application.cp_user_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Get status history
    const { data: history, error: historyError } = await supabase
      .from('cp_application_status_history')
      .select(`
        id,
        previous_status,
        new_status,
        status_reason,
        changed_by_name,
        changed_by_role,
        notes,
        created_at
      `)
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true })

    if (historyError) {
      logger.error('Error fetching status history:', { error: historyError })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch status history' },
        { status: 500 }
      )
    }

    // Transform to match expected format
    const formattedHistory = history?.map(item => ({
      status: item.new_status,
      status_reason: item.status_reason,
      changed_by_name: item.changed_by_name,
      changed_by_role: item.changed_by_role,
      notes: item.notes,
      created_at: item.created_at,
    })) || []

    return NextResponse.json({
      success: true,
      history: formattedHistory,
    })
  } catch (error) {
    logger.error('Error in status history API:', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
