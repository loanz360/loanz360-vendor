import { parseBody } from '@/lib/utils/parse-body'

/**
 * WorkDrive Comments API
 * GET - Get comments for a file
 * POST - Create a new comment
 * PUT - Update a comment
 * DELETE - Delete a comment
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Comment {
  id: string
  file_id: string
  user_id: string
  user_name?: string
  user_avatar?: string
  content: string
  mentions: string[]
  parent_comment_id?: string
  is_resolved?: boolean
  resolved_by?: string
  resolved_at?: string
  created_at: string
  updated_at: string
  replies?: Comment[]
}

/**
 * Extract mentions from comment text
 * Mentions are in the format @[username](user_id)
 */
function extractMentions(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
  const mentions: string[] = []
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[2]) // user_id
  }

  return mentions
}

/**
 * GET /api/workdrive/comments?fileId=xxx
 * Get all comments for a file
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json({ success: false, error: 'File ID is required' }, { status: 400 })
    }

    // Get comments with user profiles
    const { data: comments, error: commentsError } = await supabase
      .from('workdrive_comments')
      .select(`
        id,
        file_id,
        user_id,
        content,
        mentions,
        parent_comment_id,
        is_resolved,
        resolved_by,
        resolved_at,
        created_at,
        updated_at,
        user_profile:profiles!workdrive_comments_user_id_fkey(full_name, email, avatar_url)
      `)
      .eq('file_id', fileId)
      .is('is_deleted', false)
      .order('created_at', { ascending: true })

    if (commentsError) {
      apiLogger.error('Error fetching comments', commentsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 })
    }

    // Organize comments into threads (parent comments with their replies)
    const commentMap = new Map<string, Comment>()
    const rootComments: Comment[] = []

    // First pass: create comment objects
    for (const c of comments || []) {
      const comment: Comment = {
        id: c.id,
        file_id: c.file_id,
        user_id: c.user_id,
        user_name: c.user_profile?.full_name || c.user_profile?.email || 'Unknown User',
        user_avatar: c.user_profile?.avatar_url,
        content: c.content,
        mentions: c.mentions || [],
        parent_comment_id: c.parent_comment_id,
        is_resolved: c.is_resolved,
        resolved_by: c.resolved_by,
        resolved_at: c.resolved_at,
        created_at: c.created_at,
        updated_at: c.updated_at,
        replies: [],
      }
      commentMap.set(c.id, comment)
    }

    // Second pass: organize into threads
    for (const comment of commentMap.values()) {
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id)
        if (parent) {
          parent.replies = parent.replies || []
          parent.replies.push(comment)
        }
      } else {
        rootComments.push(comment)
      }
    }

    return NextResponse.json({
      comments: rootComments,
      totalComments: comments?.length || 0,
    })
  } catch (error) {
    apiLogger.error('Get comments error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/workdrive/comments
 * Create a new comment
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { fileId, content, parentCommentId } = body

    if (!fileId || !content) {
      return NextResponse.json({ success: false, error: 'File ID and content are required' }, { status: 400 })
    }

    // Extract mentions from content
    const mentions = extractMentions(content)

    // Create the comment
    const { data: comment, error: commentError } = await supabase
      .from('workdrive_comments')
      .insert({
        file_id: fileId,
        user_id: user.id,
        content,
        mentions,
        parent_comment_id: parentCommentId || null,
      })
      .select(`
        id,
        file_id,
        user_id,
        content,
        mentions,
        parent_comment_id,
        is_resolved,
        created_at,
        updated_at,
        user_profile:profiles!workdrive_comments_user_id_fkey(full_name, email, avatar_url)
      `)
      .maybeSingle()

    if (commentError) {
      apiLogger.error('Error creating comment', commentError)
      return NextResponse.json({ success: false, error: 'Failed to create comment' }, { status: 500 })
    }

    // Get file name for audit
    const { data: file } = await supabase
      .from('workdrive_files')
      .select('name')
      .eq('id', fileId)
      .maybeSingle()

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'comment',
      resourceType: 'file',
      resourceId: fileId,
      resourceName: file?.name,
      details: {
        comment_id: comment.id,
        has_mentions: mentions.length > 0,
        mention_count: mentions.length,
        is_reply: !!parentCommentId,
      },
    })

    // Create notifications for mentioned users
    if (mentions.length > 0) {
      const notifications = mentions.map(mentionedUserId => ({
        user_id: mentionedUserId,
        type: 'mention',
        title: 'You were mentioned in a comment',
        message: `${comment.user_profile?.full_name || 'Someone'} mentioned you in a comment on "${file?.name}"`,
        metadata: {
          file_id: fileId,
          comment_id: comment.id,
          mentioned_by: user.id,
        },
        is_read: false,
      }))

      await supabase.from('notifications').insert(notifications)
    }

    // Format response
    const formattedComment: Comment = {
      id: comment.id,
      file_id: comment.file_id,
      user_id: comment.user_id,
      user_name: comment.user_profile?.full_name || comment.user_profile?.email || 'Unknown User',
      user_avatar: comment.user_profile?.avatar_url,
      content: comment.content,
      mentions: comment.mentions || [],
      parent_comment_id: comment.parent_comment_id,
      is_resolved: comment.is_resolved,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      replies: [],
    }

    return NextResponse.json({
      success: true,
      comment: formattedComment,
    })
  } catch (error) {
    apiLogger.error('Create comment error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/workdrive/comments
 * Update a comment (edit or resolve)
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { commentId, content, resolve } = body

    if (!commentId) {
      return NextResponse.json({ success: false, error: 'Comment ID is required' }, { status: 400 })
    }

    // Get the comment to check ownership
    const { data: existingComment, error: fetchError } = await supabase
      .from('workdrive_comments')
      .select('user_id, file_id')
      .eq('id', commentId)
      .maybeSingle()

    if (fetchError || !existingComment) {
      return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 })
    }

    // For edit: only owner can edit
    // For resolve: anyone with file access can resolve
    if (content !== undefined && existingComment.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (content !== undefined) {
      updateData.content = content
      updateData.mentions = extractMentions(content)
    }

    if (resolve !== undefined) {
      updateData.is_resolved = resolve
      if (resolve) {
        updateData.resolved_by = user.id
        updateData.resolved_at = new Date().toISOString()
      } else {
        updateData.resolved_by = null
        updateData.resolved_at = null
      }
    }

    const { data: updatedComment, error: updateError } = await supabase
      .from('workdrive_comments')
      .update(updateData)
      .eq('id', commentId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating comment', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update comment' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      comment: updatedComment,
    })
  } catch (error) {
    apiLogger.error('Update comment error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/workdrive/comments?commentId=xxx
 * Delete a comment (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json({ success: false, error: 'Comment ID is required' }, { status: 400 })
    }

    // Get the comment to check ownership
    const { data: existingComment, error: fetchError } = await supabase
      .from('workdrive_comments')
      .select('user_id, file_id')
      .eq('id', commentId)
      .maybeSingle()

    if (fetchError || !existingComment) {
      return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 })
    }

    // Only comment owner can delete
    if (existingComment.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 })
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('workdrive_comments')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq('id', commentId)

    if (deleteError) {
      apiLogger.error('Error deleting comment', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete comment' }, { status: 500 })
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'delete',
      resourceType: 'file',
      resourceId: existingComment.file_id,
      details: {
        action_type: 'comment_delete',
        comment_id: commentId,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Comment deleted',
    })
  } catch (error) {
    apiLogger.error('Delete comment error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
