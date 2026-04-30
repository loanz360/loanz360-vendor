import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/superadmin/customer-management/customers/[id]/notes/[noteId]/comments
 * Add a comment to a note
 *
 * Rate Limit: 30 requests per minute
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  return writeRateLimiter(request, async (req) => {
    return await addCommentHandler(req, params.id, params.noteId)
  })
}

async function addCommentHandler(request: NextRequest, customerId: string, noteId: string) {
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { comment_content, parent_comment_id, mentioned_users } = body

    // Validation
    if (!comment_content || typeof comment_content !== 'string' || comment_content.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Comment content is required and must be a non-empty string'
      }, { status: 400 })
    }

    if (comment_content.length > 5000) {
      return NextResponse.json({
        success: false,
        error: 'Comment content must be less than 5,000 characters'
      }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // Verify note exists and user has access
    const { data: note, error: noteError } = await supabase
      .from('customer_notes')
      .select('id, customer_id, created_by, visibility')
      .eq('id', noteId)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .maybeSingle()

    if (noteError || !note) {
      return NextResponse.json({
        success: false,
        error: 'Note not found'
      }, { status: 404 })
    }

    // Check visibility permissions
    if (note.visibility === 'PRIVATE' && note.created_by !== auth.userId && !auth.isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: Cannot comment on private notes'
      }, { status: 403 })
    }

    // Verify parent comment if provided
    if (parent_comment_id) {
      const { data: parentComment } = await supabase
        .from('customer_note_comments')
        .select('id, note_id')
        .eq('id', parent_comment_id)
        .eq('note_id', noteId)
        .is('deleted_at', null)
        .maybeSingle()

      if (!parentComment) {
        return NextResponse.json({
          success: false,
          error: 'Parent comment not found'
        }, { status: 404 })
      }
    }

    // Create comment
    const { data: newComment, error: createError } = await supabase
      .from('customer_note_comments')
      .insert({
        note_id: noteId,
        parent_comment_id: parent_comment_id || null,
        comment_content: comment_content.trim(),
        mentioned_users: mentioned_users || [],
        created_by: auth.userId
      })
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
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error creating comment', createError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create comment'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Comment added successfully',
      comment: newComment
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Error in add comment API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
