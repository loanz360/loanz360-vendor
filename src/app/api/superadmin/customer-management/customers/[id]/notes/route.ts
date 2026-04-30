import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter, writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/superadmin/customer-management/customers/[id]/notes
 * Fetch all notes for a customer
 *
 * Rate Limit: 60 requests per minute
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return readRateLimiter(request, async (req) => {
    return await getCustomerNotesHandler(req, params.id)
  })
}

/**
 * POST /api/superadmin/customer-management/customers/[id]/notes
 * Create a new note for a customer
 *
 * Rate Limit: 30 requests per minute
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return writeRateLimiter(request, async (req) => {
    return await createCustomerNoteHandler(req, params.id)
  })
}

async function getCustomerNotesHandler(request: NextRequest, customerId: string) {
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

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const search = searchParams.get('search')
    const noteType = searchParams.get('note_type')
    const category = searchParams.get('category')
    const isImportant = searchParams.get('is_important')

    const supabase = createSupabaseAdmin()

    // Use the database function for optimized retrieval
    if (!search && !noteType && !category && !isImportant) {
      const { data: notes, error: notesError } = await supabase
        .rpc('get_customer_notes', {
          p_customer_id: customerId,
          p_limit: limit
        })

      if (notesError) {
        apiLogger.error('Error fetching customer notes', notesError)
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch customer notes'
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        notes: notes || []
      }, { status: 200 })
    }

    // For filtered queries, build custom query
    let query = supabase
      .from('customer_notes')
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
      .eq('customer_id', customerId)
      .is('deleted_at', null)

    // Apply filters
    if (search) {
      const sanitizedSearch = search.replace(/[%_'";\\]/g, '')
      query = query.or(`note_title.ilike.%${sanitizedSearch}%,note_content.ilike.%${sanitizedSearch}%`)
    }

    if (noteType) {
      const validNoteTypes = ['GENERAL', 'FOLLOW_UP', 'COMPLAINT', 'FEEDBACK', 'INTERNAL', 'MEETING', 'CALL_LOG']
      if (!validNoteTypes.includes(noteType)) {
        return NextResponse.json({
          success: false,
          error: `Invalid note type. Must be one of: ${validNoteTypes.join(', ')}`
        }, { status: 400 })
      }
      query = query.eq('note_type', noteType)
    }

    if (category) {
      const validCategories = ['SALES', 'SUPPORT', 'COLLECTIONS', 'RISK', 'GENERAL']
      if (!validCategories.includes(category)) {
        return NextResponse.json({
          success: false,
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        }, { status: 400 })
      }
      query = query.eq('category', category)
    }

    if (isImportant === 'true') {
      query = query.eq('is_important', true)
    }

    query = query
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    const { data: notes, error: notesError } = await query

    if (notesError) {
      apiLogger.error('Error fetching customer notes', notesError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch customer notes'
      }, { status: 500 })
    }

    // Fetch comment counts for each note
    const noteIds = notes?.map(n => n.id) || []
    let commentCounts: Record<string, number> = {}

    if (noteIds.length > 0) {
      const { data: comments } = await supabase
        .from('customer_note_comments')
        .select('note_id')
        .in('note_id', noteIds)
        .is('deleted_at', null)

      if (comments) {
        commentCounts = comments.reduce((acc, c) => {
          acc[c.note_id] = (acc[c.note_id] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
    }

    // Add comment counts to notes
    const notesWithCounts = notes?.map(note => ({
      ...note,
      comment_count: commentCounts[note.id] || 0
    }))

    return NextResponse.json({
      success: true,
      notes: notesWithCounts || []
    }, { status: 200 })

  } catch (error) {
    apiLogger.error('Error in customer notes API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

async function createCustomerNoteHandler(request: NextRequest, customerId: string) {
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


      mentioned_users: z.string().optional(),


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
      mentioned_users
    } = body

    // Validation
    if (!note_content || typeof note_content !== 'string' || note_content.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Note content is required and must be a non-empty string'
      }, { status: 400 })
    }

    if (note_content.length > 10000) {
      return NextResponse.json({
        success: false,
        error: 'Note content must be less than 10,000 characters'
      }, { status: 400 })
    }

    // Validate note type
    const validNoteTypes = ['GENERAL', 'FOLLOW_UP', 'COMPLAINT', 'FEEDBACK', 'INTERNAL', 'MEETING', 'CALL_LOG']
    if (note_type && !validNoteTypes.includes(note_type)) {
      return NextResponse.json({
        success: false,
        error: `Invalid note type. Must be one of: ${validNoteTypes.join(', ')}`
      }, { status: 400 })
    }

    // Validate category
    const validCategories = ['SALES', 'SUPPORT', 'COLLECTIONS', 'RISK', 'GENERAL']
    if (category && !validCategories.includes(category)) {
      return NextResponse.json({
        success: false,
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      }, { status: 400 })
    }

    // Validate visibility
    const validVisibility = ['PRIVATE', 'TEAM', 'ALL']
    if (visibility && !validVisibility.includes(visibility)) {
      return NextResponse.json({
        success: false,
        error: `Invalid visibility. Must be one of: ${validVisibility.join(', ')}`
      }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // Verify customer exists
    const { data: customerExists, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .maybeSingle()

    if (customerError || !customerExists) {
      return NextResponse.json({
        success: false,
        error: 'Customer not found'
      }, { status: 404 })
    }

    // Use the database function to create note
    const { data: noteId, error: createError } = await supabase
      .rpc('create_customer_note', {
        p_customer_id: customerId,
        p_note_content: note_content.trim(),
        p_note_title: note_title?.trim() || null,
        p_note_type: note_type || 'GENERAL',
        p_category: category || null,
        p_is_important: is_important || false
      })

    if (createError) {
      apiLogger.error('Error creating customer note', createError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create customer note'
      }, { status: 500 })
    }

    // Update additional fields if provided
    if (is_pinned || visibility || tags || reminder_at || assigned_to || due_date || mentioned_users) {
      const updateData: Record<string, unknown> = {}

      if (is_pinned !== undefined) updateData.is_pinned = is_pinned
      if (visibility) updateData.visibility = visibility
      if (tags && Array.isArray(tags)) updateData.tags = tags
      if (reminder_at) updateData.reminder_at = reminder_at
      if (assigned_to) updateData.assigned_to = assigned_to
      if (due_date) updateData.due_date = due_date
      if (mentioned_users && Array.isArray(mentioned_users)) updateData.mentioned_users = mentioned_users

      await supabase
        .from('customer_notes')
        .update(updateData)
        .eq('id', noteId)
    }

    // Fetch the newly created note
    const { data: newNote } = await supabase
      .from('customer_notes')
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
      .eq('id', noteId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      message: 'Note created successfully',
      note: newNote
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Error in create customer note API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
