export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { requireHRAccess } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeText } from '@/lib/validations/input-sanitization'
import { logEmployeeActivity } from '@/lib/services/employee-audit'

export const runtime = 'nodejs'

/**
 * GET /api/hr/profile-review
 * Fetch employees pending profile review
 * Query params: ?status=PENDING_PROFILE_REVIEW|NEEDS_PROFILE_CORRECTION|all
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    // Standard Supabase auth + HR access check
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const deny = await requireHRAccess(authClient)
    if (deny) return deny

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') || 'PENDING_PROFILE_REVIEW'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))

    // Use admin client for data queries (bypasses RLS)
    const supabase = createSupabaseAdmin()

    // Fetch stat counts in parallel (always across all relevant statuses)
    const [pendingCountResult, correctionCountResult] = await Promise.all([
      supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('employee_status', 'PENDING_PROFILE_REVIEW'),
      supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('employee_status', 'NEEDS_PROFILE_CORRECTION'),
    ])

    const pendingReviewCount = pendingCountResult.count ?? 0
    const needsCorrectionCount = correctionCountResult.count ?? 0

    // Build query for employees pending review with pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('employees')
      .select(`
        id,
        employee_id,
        full_name,
        work_email,
        personal_email,
        mobile_number,
        sub_role,
        employee_status,
        profile_completed,
        date_of_joining,
        profile_photo_url,
        created_at,
        departments:department_id (
          id,
          name,
          code
        )
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(from, to)

    // Filter by status
    if (statusFilter !== 'all') {
      query = query.eq('employee_status', statusFilter)
    } else {
      query = query.in('employee_status', ['PENDING_PROFILE_REVIEW', 'NEEDS_PROFILE_CORRECTION'])
    }

    const { data: employees, error, count: totalCount } = await query

    if (error) {
      logger.error('Error fetching employees for profile review:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch employees' },
        { status: 500 }
      )
    }

    // Batch fetch unresolved notes counts for all employees in one query
    const employeeIds = (employees || []).map(emp => emp.id)
    let notesCountMap: Record<string, number> = {}

    if (employeeIds.length > 0) {
      const { data: notesData } = await supabase
        .from('employee_profile_review_notes')
        .select('employee_id')
        .in('employee_id', employeeIds)
        .eq('is_resolved', false)

      if (notesData) {
        for (const note of notesData) {
          notesCountMap[note.employee_id] = (notesCountMap[note.employee_id] || 0) + 1
        }
      }
    }

    const employeesWithNotes = (employees || []).map(emp => ({
      ...emp,
      unresolved_notes_count: notesCountMap[emp.id] || 0,
    }))

    return NextResponse.json({
      success: true,
      data: employeesWithNotes,
      count: totalCount ?? employeesWithNotes.length,
      page,
      page_size: pageSize,
      stats: {
        pending_review: pendingReviewCount,
        needs_correction: needsCorrectionCount,
        total_in_queue: pendingReviewCount + needsCorrectionCount,
      },
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    logger.error('Error in GET /api/hr/profile-review:', { errorId, error })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}

/**
 * POST /api/hr/profile-review
 * HR approves or requests corrections for an employee's profile
 * Body: { employee_id: UUID, action: 'APPROVE' | 'REQUEST_CORRECTION', notes?: [{ field_reference, note_text }] }
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    // Standard Supabase auth + HR access check
    const authClient = await createClient()
    const { data: { user: authUser }, error: authError } = await authClient.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const deny = await requireHRAccess(authClient)
    if (deny) return deny
    const auth = { authorized: true, userId: authUser.id }

    const body = await request.json()
    const { employee_id, action, notes } = body

    if (!employee_id || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: employee_id, action' },
        { status: 400 }
      )
    }

    if (!['APPROVE', 'REQUEST_CORRECTION'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be APPROVE or REQUEST_CORRECTION' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch the employee
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id, employee_status, full_name')
      .eq('id', employee_id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Allow review from PENDING_PROFILE_REVIEW or NEEDS_PROFILE_CORRECTION (re-review after resubmission)
    const reviewableStatuses = ['PENDING_PROFILE_REVIEW', 'NEEDS_PROFILE_CORRECTION']
    if (!reviewableStatuses.includes(employee.employee_status)) {
      return NextResponse.json(
        { success: false, error: `Cannot review profile in status: ${employee.employee_status}` },
        { status: 400 }
      )
    }

    if (action === 'APPROVE') {
      // Approve the profile
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          employee_status: 'ACTIVE',
          profile_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', employee_id)

      if (updateError) {
        logger.error('Error approving employee profile:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to approve profile' },
          { status: 500 }
        )
      }

      // Mark all existing correction notes as resolved
      await supabase
        .from('employee_profile_review_notes')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: auth.userId,
        })
        .eq('employee_id', employee_id)
        .eq('is_resolved', false)

      // Add approval note
      await supabase
        .from('employee_profile_review_notes')
        .insert({
          employee_id: employee_id,
          reviewer_id: auth.userId,
          note_type: 'APPROVAL_NOTE',
          note_text: 'Profile approved by HR',
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        })

      logger.info(`Profile approved for employee ${employee.employee_id} by ${auth.userId}`)

      // Audit trail
      logEmployeeActivity({
        employeeId: employee_id,
        action: 'PROFILE_APPROVED',
        actionDetails: { old_status: employee.employee_status, new_status: 'ACTIVE' },
        performedBy: auth.userId!,
        performedByRole: 'HR',
      }).catch((err) => logger.warn('Audit log failed for profile-review', err))

      // Send email notification
      try {
        const { sendStatusChangeEmail } = await import('@/lib/services/employee-email-service')
        const { data: empDetails } = await supabase
          .from('employees')
          .select('full_name, personal_email')
          .eq('id', employee_id)
          .maybeSingle()

        if (empDetails) {
          await sendStatusChangeEmail({
            full_name: empDetails.full_name,
            personal_email: empDetails.personal_email,
            old_status: employee.employee_status,
            new_status: 'ACTIVE',
          })
        }
      } catch (emailErr) {
        logger.error('Failed to send approval email:', emailErr)
      }

      return NextResponse.json({
        success: true,
        message: `Profile for ${employee.full_name} (${employee.employee_id}) has been approved. All portal features are now unlocked.`,
        data: { new_status: 'ACTIVE' },
      })
    }

    if (action === 'REQUEST_CORRECTION') {
      if (!notes || !Array.isArray(notes) || notes.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Correction notes are required when requesting corrections' },
          { status: 400 }
        )
      }

      // Update status to NEEDS_PROFILE_CORRECTION
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          employee_status: 'NEEDS_PROFILE_CORRECTION',
          updated_at: new Date().toISOString(),
        })
        .eq('id', employee_id)

      if (updateError) {
        logger.error('Error requesting profile corrections:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to request corrections' },
          { status: 500 }
        )
      }

      // Insert correction notes (sanitize user input)
      const correctionNotes = notes.map((note: { field_reference?: string; note_text: string }) => ({
        employee_id: employee_id,
        reviewer_id: auth.userId,
        note_type: 'CORRECTION_REQUEST',
        field_reference: note.field_reference ? sanitizeText(note.field_reference) : null,
        note_text: sanitizeText(note.note_text),
        is_resolved: false,
      }))

      const { error: notesError } = await supabase
        .from('employee_profile_review_notes')
        .insert(correctionNotes)

      if (notesError) {
        logger.error('Error inserting correction notes:', notesError)
      }

      logger.info(`Corrections requested for employee ${employee.employee_id} by ${auth.userId}: ${notes.length} notes`)

      // Audit trail
      logEmployeeActivity({
        employeeId: employee_id,
        action: 'PROFILE_CORRECTION_REQUESTED',
        actionDetails: { old_status: employee.employee_status, new_status: 'NEEDS_PROFILE_CORRECTION', notes_count: notes.length },
        performedBy: auth.userId!,
        performedByRole: 'HR',
      }).catch((err) => logger.warn('Audit log failed for profile-review', err))

      // Send email notification
      try {
        const { sendStatusChangeEmail } = await import('@/lib/services/employee-email-service')
        const { data: empDetails } = await supabase
          .from('employees')
          .select('full_name, personal_email')
          .eq('id', employee_id)
          .maybeSingle()

        if (empDetails) {
          await sendStatusChangeEmail({
            full_name: empDetails.full_name,
            personal_email: empDetails.personal_email,
            old_status: employee.employee_status,
            new_status: 'NEEDS_PROFILE_CORRECTION',
            reason: `${notes.length} field(s) need correction`,
          })
        }
      } catch (emailErr) {
        logger.error('Failed to send correction email:', emailErr)
      }

      return NextResponse.json({
        success: true,
        message: `Corrections requested for ${employee.full_name} (${employee.employee_id}). ${notes.length} note(s) added.`,
        data: { new_status: 'NEEDS_PROFILE_CORRECTION', notes_count: notes.length },
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    const errorId = crypto.randomUUID()
    logger.error('Error in POST /api/hr/profile-review:', { errorId, error })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}
