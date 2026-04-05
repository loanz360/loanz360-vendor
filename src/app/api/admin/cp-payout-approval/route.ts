import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { notifyStatusChange, type CPPayoutStatus } from '@/lib/notifications/cp-payout-notifications'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/cp-payout-approval
 * Get CP applications pending Super Admin approval
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'ACCOUNTS_VERIFIED'
    const search = searchParams.get('search')

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is Super Admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only Super Admin can access this resource.' },
        { status: 403 }
      )
    }

    // Build query
    let query = supabase
      .from('cp_applications')
      .select(`
        id,
        app_id,
        cp_user_id,
        cp_partner_id,
        application_number,
        customer_name,
        customer_mobile,
        customer_email,
        loan_amount_disbursed,
        bank_name,
        loan_type,
        disbursement_date,
        expected_payout_percentage,
        expected_payout_amount,
        notes,
        supporting_document_url,
        status,
        status_reason,
        accounts_verified_by,
        accounts_verified_at,
        accounts_verification_notes,
        created_at,
        updated_at,
        cp_user:users!cp_applications_cp_user_id_fkey (
          id,
          full_name,
          email,
          phone_number
        ),
        accounts_verifier:users!cp_applications_accounts_verified_by_fkey (
          id,
          full_name,
          email
        )
      `)
      .order('accounts_verified_at', { ascending: true })

    // Filter by status
    if (status !== 'ALL') {
      query = query.eq('status', status)
    } else {
      query = query.in('status', ['ACCOUNTS_VERIFIED', 'SA_APPROVED'])
    }

    const { data: applications, error: appError } = await query

    if (appError) {
      logger.error('Error fetching applications:', { error: appError })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch applications' },
        { status: 500 }
      )
    }

    // Filter by search
    let filteredApplications = applications || []
    if (search) {
      const searchLower = search.toLowerCase()
      filteredApplications = filteredApplications.filter(app =>
        app.app_id?.toLowerCase().includes(searchLower) ||
        app.application_number.toLowerCase().includes(searchLower) ||
        app.customer_name.toLowerCase().includes(searchLower) ||
        app.bank_name.toLowerCase().includes(searchLower)
      )
    }

    // Calculate stats
    const today = new Date().toISOString().split('T')[0]

    const { data: allApps } = await supabase
      .from('cp_applications')
      .select('status, sa_approved_at, expected_payout_amount')

    const stats = {
      pending_approval: allApps?.filter(a => a.status === 'ACCOUNTS_VERIFIED').length || 0,
      approved_today: allApps?.filter(a =>
        a.status === 'SA_APPROVED' &&
        a.sa_approved_at?.startsWith(today)
      ).length || 0,
      rejected_today: allApps?.filter(a =>
        a.status === 'REJECTED' &&
        a.sa_approved_at?.startsWith(today)
      ).length || 0,
      total_approved_amount: allApps
        ?.filter(a => a.status === 'SA_APPROVED' && a.sa_approved_at?.startsWith(today))
        .reduce((sum, a) => sum + (a.expected_payout_amount || 0), 0) || 0,
    }

    return NextResponse.json({
      success: true,
      applications: filteredApplications,
      stats,
    })
  } catch (error) {
    logger.error('Error in SA payout approval API:', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/cp-payout-approval
 * Approve, reject, or hold CP application
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { applicationId, action, notes, reason } = body

    if (!applicationId || !action) {
      return NextResponse.json(
        { success: false, error: 'Application ID and action are required' },
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

    // Verify user is Super Admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get current application with CP user details for notifications
    const { data: application, error: appError } = await supabase
      .from('cp_applications')
      .select(`
        id,
        app_id,
        status,
        cp_user_id,
        customer_name,
        application_number,
        bank_name,
        loan_type,
        loan_amount_disbursed,
        expected_payout_amount,
        cp_user:users!cp_applications_cp_user_id_fkey (
          id,
          full_name,
          email,
          phone_number
        )
      `)
      .eq('id', applicationId)
      .maybeSingle()

    if (appError || !application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      )
    }

    if (application.status !== 'ACCOUNTS_VERIFIED') {
      return NextResponse.json(
        { success: false, error: 'Application is not in the correct status for approval' },
        { status: 400 }
      )
    }

    let updateData: Record<string, any> = {}
    let newStatus: string

    switch (action) {
      case 'approve':
        newStatus = 'SA_APPROVED'
        updateData = {
          status: newStatus,
          sa_approved_by: user.id,
          sa_approved_at: new Date().toISOString(),
          sa_approval_notes: notes || null,
        }
        break

      case 'reject':
        if (!reason) {
          return NextResponse.json(
            { success: false, error: 'Rejection reason is required' },
            { status: 400 }
          )
        }
        newStatus = 'REJECTED'
        updateData = {
          status: newStatus,
          status_reason: reason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        }
        break

      case 'hold':
        if (!reason) {
          return NextResponse.json(
            { success: false, error: 'Hold reason is required' },
            { status: 400 }
          )
        }
        newStatus = 'ON_HOLD'
        updateData = {
          status: newStatus,
          status_reason: reason,
        }
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    // Update application
    const { error: updateError } = await supabase
      .from('cp_applications')
      .update(updateData)
      .eq('id', applicationId)

    if (updateError) {
      logger.error('Error updating application:', { error: updateError })
      return NextResponse.json(
        { success: false, error: 'Failed to update application' },
        { status: 500 }
      )
    }

    // Record status history
    const previousStatus = 'ACCOUNTS_VERIFIED'
    const { error: historyError } = await supabase
      .from('cp_application_status_history')
      .insert({
        application_id: applicationId,
        previous_status: previousStatus,
        new_status: newStatus,
        changed_by: user.id,
        changed_by_name: userData.full_name,
        changed_by_role: 'SUPER_ADMIN',
        notes: action === 'approve'
          ? notes || 'Approved by Super Admin'
          : action === 'reject'
            ? reason
            : reason || 'Put on hold',
      })

    if (historyError) {
      logger.warn('Failed to record status history:', { error: historyError })
    }

    // Send notifications to CP
    const cpUser = application.cp_user as any
    if (cpUser) {
      try {
        await notifyStatusChange(
          {
            applicationId: application.id,
            appId: application.app_id || '',
            cpUserId: application.cp_user_id,
            cpName: cpUser.full_name || 'Partner',
            cpEmail: cpUser.email || '',
            cpPhone: cpUser.phone_number,
            customerName: application.customer_name,
            applicationNumber: application.application_number,
            bankName: application.bank_name,
            loanType: application.loan_type,
            loanAmount: application.loan_amount_disbursed,
            expectedPayoutAmount: application.expected_payout_amount,
            status: newStatus as CPPayoutStatus,
            changedByName: userData.full_name,
            changedByRole: 'SUPER_ADMIN',
            reason: action === 'reject' ? reason : action === 'hold' ? reason : undefined,
            notes: notes,
          },
          previousStatus as CPPayoutStatus
        )
      } catch (notifyError) {
        logger.warn('Failed to send notification:', { error: notifyError })
      }
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve'
        ? 'Application approved and forwarded to Finance'
        : action === 'reject'
          ? 'Application rejected'
          : 'Application put on hold',
    })
  } catch (error) {
    logger.error('Error updating CP application:', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
