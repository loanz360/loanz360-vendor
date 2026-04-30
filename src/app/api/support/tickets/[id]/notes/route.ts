
// =====================================================
// TICKET INTERNAL NOTES API
// GET: List internal notes for a ticket
// POST: Add new internal note
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET: List internal notes (HR and Super Admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role check: only HR and Super Admin can view internal notes
    const { data: employee } = await supabase.from('employees').select('id, role, sub_role').eq('user_id', user.id).maybeSingle()
    const { data: superAdmin } = await supabase.from('super_admins').select('id').eq('id', user.id).maybeSingle()
    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin
    if (!isHR && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied. Internal notes are visible to HR and Super Admin only.' }, { status: 403 })
    }

    const { data: notes, error: notesError } = await supabase
      .from('ticket_internal_notes')
      .select('*')
      .eq('ticket_id', ticketId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (notesError) {
      apiLogger.error('Notes fetch error', notesError)
      return NextResponse.json({ success: false, error: 'Failed to fetch notes' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: notes || []
    })
  } catch (error) {
    apiLogger.error('Notes GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Add internal note (HR and Super Admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get employee info for the note
    const { data: employee } = await supabase
      .from('employees')
      .select('full_name, role, sub_role')
      .eq('user_id', user.id)
      .maybeSingle()

    // Role check: only HR and Super Admin can add internal notes
    const { data: superAdmin } = await supabase.from('super_admins').select('id, full_name').eq('id', user.id).maybeSingle()
    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = !!superAdmin
    if (!isHR && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied. Only HR and Super Admin can add internal notes.' }, { status: 403 })
    }

    const body = await request.json()
    const { note } = body

    if (!note?.trim()) {
      return NextResponse.json({ success: false, error: 'Note content is required' }, { status: 400 })
    }

    const { data: newNote, error: insertError } = await supabase
      .from('ticket_internal_notes')
      .insert({
        ticket_id: ticketId,
        note: note.trim(),
        created_by: user.id,
        created_by_type: isSuperAdmin ? 'SUPER_ADMIN' : 'HR',
        created_by_name: (isSuperAdmin ? superAdmin?.full_name : employee?.full_name) || 'HR Staff'
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Note insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to save note' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: newNote,
      message: 'Note saved successfully'
    })
  } catch (error) {
    apiLogger.error('Notes POST Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
