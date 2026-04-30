import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter, writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/superadmin/customer-management/customers/[id]/notes/[noteId]
 * Fetch a single note with comments
 *
 * Rate Limit: 60 requests per minute
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  return readRateLimiter(request, async (req) => {
    return await getNoteHandler(req, params.id, params.noteId)
  })
}

/**
 * PATCH /api/superadmin/customer-management/customers/[id]/notes/[noteId]
 * Update a note
 *
 * Rate Limit: 30 requests per minute
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  return writeRateLimiter(request, async (req) => {
    return await updateNoteHandler(req, params.id, params.noteId)
  })
}

/**
 * DELETE /api/superadmin/customer-management/customers/[id]/notes/[noteId]
 * Delete a note (soft delete)
 *
 * Rate Limit: 30 requests per minute
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  return writeRateLimiter(request, async (req) => {
    return await deleteNoteHandler(req, params.id, params.noteId)
  })
}

async function getNoteHandler(request: NextRequest, customerId: string, noteId: string) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin && !auth.isEmployee) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Access denied' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch note
    const { data: note, error: noteError } = await supabase
      .from('customer_notes')
      .select(`
        id,
        customer_id,
        note_title,
        note_content,
        note_type,
        category,
        is_important,
        is_pinned,
        visibility,
        tags,
        related_loan_id,
        related_ticket_id,
        related_document_id,
        reminder_at,
        reminded_at,
        assigned_to,
        due_date,
        completed_at,
        created_at,
        updated_at,
        created_by,
        updated_by,
        users!customer_notes_created_by_fkey(id, full_name, email),
        assigned_user:users!customer_notes_assigned_to_fkey(id, full_name),
        updated_user:users!customer_notes_updated_by_fkey(id, full_name)
      `)
      .eq('id', noteId)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .maybeSingle()

    if (noteError) {
      apiLogger.error('Error fetching note', noteError)

      if (noteError.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Note not found'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to fetch note'
      }, { status: 500 })
    }

    // Check visibility permissions
    if (note.visibility === 'PRIVATE' && note.created_by !== auth.userId && !auth.isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: This note is private'
      }, { status: 403 })
    }

    // Fetch comments
    const { data: comments, error: commentsError } = await supabase
      .from('customer_note_comments')
      .select(`
        id,
        note_id,
        parent_comment_id,
        comment_content,
        mentioned_users,
        created_at,
        updated_at,
        users!customer_note_comments_created_by_fkey(id, full_name, email)
      `)
      .eq('note_id', noteId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (commentsError) {
      apiLogger.error('Error fetching comments', commentsError)
    }

    return NextResponse.json({
      success: true,
      note: {
        ...note,
        comments: comments || []
      }
    }, { status: 200 })

  } catch (error) {
    apiLogger.error('Error in get note API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

async function updateNoteHandler(request: NextRequest, customerId: string, noteId: string) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin && !auth.isEmployee) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Access denied' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      note_title: z.string().optional(),


      note_content: z.string().optional(),


      note_type: z.string().optional(),


      category: z.string().optional(),


      is_important: z.boolean().optional(),


      is_pinned: z.boolean().optional(),


      visibility: z.string().optional(),


      tags: z.array(z.unknown()).optional(),


      reminder_at: z.string().optional(),


      assigned_to: z.string().optional(),


      due_date: z.string().optional(),


      completed_at: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      note_title,
      note_content,
      note_type,
      category,
      is_important,
      is_pinned,
      visibility,
      tags,
      reminder_at,
      assigned_to,
      due_date,
      completed_at
    } = body

    const supabase = createSupabaseAdmin()

    // Fetch existing note to check permissions
    const { data: existingNote, error: fetchError } = await supabase
      .from('customer_notes')
      .select('id, customer_id, created_by, visibility')
      .eq('id', noteId)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !existingNote) {
      return NextResponse.json({
        success: false,
        error: 'Note not found'
      }, { status: 404 })
    }

    // Check update permissions
    if (existingNote.created_by !== auth.userId && !auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: You can only update your own notes'
      }, { status: 403 })
    }

    // Build update object
    const updateData: Record<string, unknown> = {}

    if (note_title !== undefined) updateData.note_title = note_title?.trim() || null
    if (note_content !== undefined) {
      if (typeof note_content !== 'string' || note_content.trim().length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Note content cannot be empty'
        }, { status: 400 })
      }
      updateData.note_content = note_content.trim()
    }

    // Validate and set note_type
    if (note_type !== undefined) {
      const validNoteTypes = ['GENERAL', 'FOLLOW_UP', 'COMPLAINT', 'FEEDBACK', 'INTERNAL', 'MEETING', 'CALL_LOG']
      if (!validNoteTypes.includes(note_type)) {
        return NextResponse.json({
          success: false,
          error: `Invalid note type. Must be one of: ${validNoteTypes.join(', ')}`
        }, { status: 400 })
      }
      updateData.note_type = note_type
    }

    // Validate and set category
    if (category !== undefined) {
      const validCategories = ['SALES', 'SUPPORT', 'COLLECTIONS', 'RISK', 'GENERAL']
      if (category && !validCategories.includes(category)) {
        return NextResponse.json({
          success: false,
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        }, { status: 400 })
      }
      updateData.category = category
    }

    // Validate and set visibility
    if (visibility !== undefined) {
      const validVisibility = ['PRIVATE', 'TEAM', 'ALL']
      if (!validVisibility.includes(visibility)) {
        return NextResponse.json({
          success: false,
          error: `Invalid visibility. Must be one of: ${validVisibility.join(', ')}`
        }, { status: 400 })
      }
      updateData.visibility = visibility
    }

    if (is_important !== undefined) updateData.is_important = is_important
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned
    if (tags !== undefined) updateData.tags = tags
    if (reminder_at !== undefined) updateData.reminder_at = reminder_at
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to
    if (due_date !== undefined) updateData.due_date = due_date
    if (completed_at !== undefined) updateData.completed_at = completed_at

    // Perform update
    const { data: updatedNote, error: updateError } = await supabase
      .from('customer_notes')
      .update(updateData)
      .eq('id', noteId)
      .select(`
        id,
        note_title,
        note_content,
        note_type,
        category,
        is_important,
        is_pinned,
        visibility,
        tags,
        reminder_at,
        assigned_to,
        due_date,
        completed_at,
        created_at,
        updated_at,
        users!customer_notes_created_by_fkey(id, full_name, email),
        assigned_user:users!customer_notes_assigned_to_fkey(id, full_name)
      `)
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating note', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to update note'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Note updated successfully',
      note: updatedNote
    }, { status: 200 })

  } catch (error) {
    apiLogger.error('Error in update note API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

async function deleteNoteHandler(request: NextRequest, customerId: string, noteId: string) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin && !auth.isEmployee) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Access denied' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch existing note to check permissions
    const { data: existingNote, error: fetchError } = await supabase
      .from('customer_notes')
      .select('id, customer_id, created_by')
      .eq('id', noteId)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError || !existingNote) {
      return NextResponse.json({
        success: false,
        error: 'Note not found'
      }, { status: 404 })
    }

    // Check delete permissions
    if (existingNote.created_by !== auth.userId && !auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: You can only delete your own notes'
      }, { status: 403 })
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('customer_notes')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: auth.userId
      })
      .eq('id', noteId)

    if (deleteError) {
      apiLogger.error('Error deleting note', deleteError)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete note'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully'
    }, { status: 200 })

  } catch (error) {
    apiLogger.error('Error in delete note API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
