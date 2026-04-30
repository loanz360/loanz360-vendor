import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission, hrCanManageEmployee } from '@/lib/auth/employee-mgmt-auth'
import { logEmployeeActivity } from '@/lib/services/employee-audit'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

/**
 * GET /api/superadmin/employee-management/[id]/notes
 * Fetch all notes for an employee
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'VIEW_EMPLOYEES')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const employeeId = params.id
    const supabase = createSupabaseAdmin()

    // Verify employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name')
      .eq('id', employeeId)
      .is('deleted_at', null)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Fetch notes
    const { data: notes, error: notesError } = await supabase
      .from('employee_notes')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })

    if (notesError) {
      logger.error('Error fetching notes:', notesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch notes' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: notes,
      employee: {
        id: employee.id,
        employee_id: employee.employee_id,
        full_name: employee.full_name
      }
    })
  } catch (error) {
    logger.error('Error in GET /api/superadmin/employee-management/[id]/notes:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/employee-management/[id]/notes
 * Create new note for employee
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'SEND_NOTES')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to send notes' },
        { status: 403 }
      )
    }

    const employeeId = params.id
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    if (!body.note_text) {
      return NextResponse.json(
        { success: false, error: 'note_text is required' },
        { status: 400 }
      )
    }

    // HR check
    if (auth.role === 'HR') {
      const canManage = await hrCanManageEmployee(auth.userId!, employeeId)
      if (!canManage.canManage) {
        return NextResponse.json(
          { success: false, error: 'Cannot send notes to this employee' },
          { status: 403 }
        )
      }
    }

    const supabase = createSupabaseAdmin()

    // Verify employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name')
      .eq('id', employeeId)
      .is('deleted_at', null)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Get sender info
    const { data: sender } = await supabase
      .from('users')
      .select('full_name, role')
      .eq('id', auth.userId)
      .maybeSingle()

    // Create note
    const noteData = {
      employee_id: employeeId,
      note_text: body.note_text,
      note_type: body.note_type || 'GENERAL',
      is_confidential: body.is_confidential || false,
      visible_to_employee: body.visible_to_employee || false,
      created_by: auth.userId,
      created_by_name: sender?.full_name || 'Unknown',
      created_by_role: sender?.role || auth.role,
      attachments: body.attachments || []
    }

    const { data: newNote, error: insertError } = await supabase
      .from('employee_notes')
      .insert(noteData)
      .select()
      .maybeSingle()

    if (insertError) {
      logger.error('Error creating note:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create note' },
        { status: 500 }
      )
    }

    // Log activity
    await logEmployeeActivity({
      employeeId,
      action: 'NOTE_ADDED',
      actionDetails: {
        note_type: newNote.note_type,
        is_confidential: newNote.is_confidential,
        visible_to_employee: newNote.visible_to_employee
      },
      performedBy: auth.userId!,
      performedByRole: auth.role!
    })

    logger.info(`Note added to employee ${employee.employee_id}`)

    return NextResponse.json({
      success: true,
      data: newNote,
      message: 'Note added successfully'
    }, { status: 201 })
  } catch (error) {
    logger.error('Error in POST /api/superadmin/employee-management/[id]/notes:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/superadmin/employee-management/[id]/notes
 * Mark note as read by employee
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const employeeId = params.id
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { note_id } = body

    if (!note_id) {
      return NextResponse.json(
        { success: false, error: 'note_id is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Get note
    const { data: note, error: noteError } = await supabase
      .from('employee_notes')
      .select('*')
      .eq('id', note_id)
      .eq('employee_id', employeeId)
      .maybeSingle()

    if (noteError || !note) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      )
    }

    // Mark as read
    const { error: updateError } = await supabase
      .from('employee_notes')
      .update({
        read_by_employee: true,
        read_at: new Date().toISOString()
      })
      .eq('id', note_id)

    if (updateError) {
      logger.error('Error marking note as read:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update note' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Note marked as read'
    })
  } catch (error) {
    logger.error('Error in PATCH /api/superadmin/employee-management/[id]/notes:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
