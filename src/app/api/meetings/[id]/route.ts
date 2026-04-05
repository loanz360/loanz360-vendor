import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meetings/[id]
 * Retrieves a specific meeting by ID with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Fetch meeting with related data
    const { data: meeting, error: queryError } = await supabase
      .from('meetings')
      .select(
        `
        *,
        customer:customers(*),
        notes:meeting_notes!meeting_notes_meeting_id_fkey(
          *,
          author:users!meeting_notes_created_by_fkey(full_name, email)
        ),
        reminders:meeting_reminders(*)
      `
      )
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (queryError) {
      if (queryError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
      }
      apiLogger.error('Error fetching meeting', queryError)
      return NextResponse.json({ success: false, error: 'Failed to fetch meeting' }, { status: 500 })
    }

    return NextResponse.json({ meeting })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/meetings/[id]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/meetings/[id]
 * Updates a specific meeting
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()

    // Verify ownership
    const { data: existingMeeting, error: checkError } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (checkError || !existingMeeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // Update meeting
    const { data: meeting, error: updateError } = await supabase
      .from('meetings')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating meeting', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update meeting' }, { status: 500 })
    }

    return NextResponse.json({ meeting })
  } catch (error: unknown) {
    apiLogger.error('Error in PATCH /api/meetings/[id]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/meetings/[id]
 * Soft deletes a specific meeting
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Verify ownership
    const { data: existingMeeting, error: checkError } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (checkError || !existingMeeting) {
      return NextResponse.json({ success: false, error: 'Meeting not found' }, { status: 404 })
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('meetings')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq('id', id)

    if (deleteError) {
      apiLogger.error('Error deleting meeting', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete meeting' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Meeting deleted successfully' })
  } catch (error: unknown) {
    apiLogger.error('Error in DELETE /api/meetings/[id]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
