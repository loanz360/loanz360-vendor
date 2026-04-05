export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin/cp-applications
 * Fetches all CP applications for admin review
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is admin or employee
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || !['SUPER_ADMIN', 'EMPLOYEE'].includes(userData.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const offset = (page - 1) * limit

    // Build query with partner info
    let query = supabase
      .from('cp_applications')
      .select(`
        *,
        cp_user:users!cp_applications_cp_user_id_fkey (
          id,
          full_name,
          email,
          phone_number
        ),
        reviewer:users!cp_applications_reviewed_by_fkey (
          id,
          full_name,
          email
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply status filter
    if (status && status !== 'ALL') {
      query = query.eq('status', status)
    }

    // Apply search filter
    if (search) {
      query = query.or(`application_number.ilike.%${search}%,customer_name.ilike.%${search}%,bank_name.ilike.%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: applications, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching CP applications for admin', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch applications' },
        { status: 500 }
      )
    }

    // Get aggregate statistics
    const { data: statsData } = await supabase
      .from('cp_applications')
      .select('status, loan_amount_disbursed, expected_payout_amount')

    const stats = {
      total_applications: statsData?.length || 0,
      pending_count: statsData?.filter(a => a.status === 'PENDING').length || 0,
      under_review_count: statsData?.filter(a => a.status === 'UNDER_REVIEW').length || 0,
      approved_count: statsData?.filter(a => a.status === 'APPROVED').length || 0,
      rejected_count: statsData?.filter(a => a.status === 'REJECTED').length || 0,
      payout_processed_count: statsData?.filter(a => a.status === 'PAYOUT_PROCESSED').length || 0,
      on_hold_count: statsData?.filter(a => a.status === 'ON_HOLD').length || 0,
      total_loan_amount: statsData?.reduce((sum, a) => sum + (a.loan_amount_disbursed || 0), 0) || 0,
      total_expected_payout: statsData?.reduce((sum, a) => sum + (a.expected_payout_amount || 0), 0) || 0,
    }

    return NextResponse.json({
      success: true,
      applications: applications || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      stats
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/cp-applications', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/cp-applications
 * Updates application status (approve, reject, etc.)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is admin or employee
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || !['SUPER_ADMIN', 'EMPLOYEE'].includes(userData.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Application ID is required' },
        { status: 400 }
      )
    }

    if (!body.status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      )
    }

    const validStatuses = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAYOUT_PROCESSED', 'ON_HOLD']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Fetch existing application
    const { data: existing, error: fetchError } = await supabase
      .from('cp_applications')
      .select('*, cp_user:users!cp_applications_cp_user_id_fkey (id, full_name, email)')
      .eq('id', body.id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status: body.status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Add status reason if provided (required for rejection/hold)
    if (['REJECTED', 'ON_HOLD'].includes(body.status)) {
      if (!body.status_reason) {
        return NextResponse.json(
          { success: false, error: 'Reason is required for rejection or hold' },
          { status: 400 }
        )
      }
      updateData.status_reason = body.status_reason
    } else {
      updateData.status_reason = body.status_reason || null
    }

    // Update application
    const { data: application, error } = await supabase
      .from('cp_applications')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating CP application', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update application' },
        { status: 500 }
      )
    }

    // Create notification for the CP
    const notificationTitle = getNotificationTitle(body.status)
    const notificationMessage = getNotificationMessage(body.status, existing.application_number, body.status_reason)

    try {
      // Insert notification for the CP user
      await supabase
        .from('system_notifications')
        .insert({
          sent_by: user.id,
          sent_by_type: userData.role === 'SUPER_ADMIN' ? 'super_admin' : 'hr',
          sent_by_name: userData.full_name || 'Loanz360 Team',
          title: notificationTitle,
          message: notificationMessage,
          notification_type: body.status === 'APPROVED' || body.status === 'PAYOUT_PROCESSED' ? 'celebration' : 'update',
          priority: body.status === 'REJECTED' ? 'high' : 'normal',
          target_type: 'individual',
          target_category: 'partner',
          target_users: [existing.cp_user_id],
          send_in_app: true,
          send_email: true,
          action_url: '/partners/cp/applications',
          action_label: 'View Application',
        })

      // Insert into notification_recipients
      await supabase
        .from('notification_recipients')
        .insert({
          notification_id: null, // Will be linked via trigger or separate query
          user_id: existing.cp_user_id,
          user_type: 'partner',
          is_read: false,
        })
    } catch (notifError) {
      // Log but don't fail the request
      apiLogger.error('Error creating notification', notifError)
    }

    return NextResponse.json({
      success: true,
      message: `Application ${body.status.toLowerCase().replace(/_/g, ' ')} successfully`,
      application
    })
  } catch (error) {
    apiLogger.error('Error in PUT /api/admin/cp-applications', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions for notifications
function getNotificationTitle(status: string): string {
  switch (status) {
    case 'UNDER_REVIEW':
      return 'Application Under Review'
    case 'APPROVED':
      return 'Application Approved!'
    case 'REJECTED':
      return 'Application Rejected'
    case 'PAYOUT_PROCESSED':
      return 'Payout Processed!'
    case 'ON_HOLD':
      return 'Application On Hold'
    default:
      return 'Application Status Updated'
  }
}

function getNotificationMessage(status: string, appNumber: string, reason?: string): string {
  switch (status) {
    case 'UNDER_REVIEW':
      return `Your application #${appNumber} is now being reviewed by our team. We'll update you soon.`
    case 'APPROVED':
      return `Great news! Your application #${appNumber} has been approved. Payout will be processed shortly.`
    case 'REJECTED':
      return `Your application #${appNumber} has been rejected. ${reason ? `Reason: ${reason}` : ''} Please review and resubmit if needed.`
    case 'PAYOUT_PROCESSED':
      return `Your payout for application #${appNumber} has been processed. Please check your bank account.`
    case 'ON_HOLD':
      return `Your application #${appNumber} has been placed on hold. ${reason ? `Reason: ${reason}` : ''} Please contact support for more information.`
    default:
      return `Your application #${appNumber} status has been updated to ${status.toLowerCase().replace(/_/g, ' ')}.`
  }
}
