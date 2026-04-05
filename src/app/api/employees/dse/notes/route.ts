import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { validatePagination } from '@/lib/validations/dse-validation'

export const dynamic = 'force-dynamic'

// Validation schema for notes
const noteSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  visit_id: z.string().uuid().optional().nullable(),
  meeting_id: z.string().uuid().optional().nullable(),
  note_type: z.enum([
    'General', 'Meeting Notes', 'Call Notes', 'Visit Notes',
    'Follow-up Notes', 'Key Points', 'Action Items', 'Voice Note'
  ]).default('General'),
  title: z.string().max(255).optional().nullable(),
  content: z.string().min(1),
  is_voice_note: z.boolean().default(false),
  voice_recording_url: z.string().url().optional().nullable(),
  voice_duration_seconds: z.number().optional().nullable(),
  transcription_status: z.enum(['Pending', 'Processing', 'Completed', 'Failed']).optional().nullable(),
  original_transcription: z.string().optional().nullable(),
  formatted_content: z.record(z.string(), z.unknown()).optional().nullable(),
  key_points: z.array(z.object({
    point: z.string(),
    priority: z.enum(['low', 'medium', 'high']).optional()
  })).optional().nullable(),
  action_items: z.array(z.object({
    item: z.string(),
    due_date: z.string().optional(),
    completed: z.boolean().default(false)
  })).optional().nullable(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    type: z.string().optional()
  })).optional().nullable(),
  is_pinned: z.boolean().default(false),
  is_private: z.boolean().default(false),
  tags: z.array(z.string()).optional().nullable(),
})

// GET - List notes
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId') || searchParams.get('customer_id')
    const leadId = searchParams.get('leadId') || searchParams.get('lead_id')
    const noteType = searchParams.get('noteType') || searchParams.get('note_type')
    const { page, limit, offset } = validatePagination(searchParams.get('page'), searchParams.get('limit'))

    let query = supabase
      .from('dse_notes')
      .select('*, dse_customers(full_name, company_name), dse_leads(customer_name, lead_stage)', { count: 'exact' })
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    if (leadId) {
      query = query.eq('lead_id', leadId)
    }

    if (noteType) {
      query = query.eq('note_type', noteType)
    }

    query = query.range(offset, offset + limit - 1)

    const { data: notes, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: {
        notes,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching notes', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a note
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const body = await request.json()
    const validatedData = noteSchema.parse(body)

    // Verify ownership if customer_id or lead_id provided
    if (validatedData.customer_id) {
      const { data: customer, error } = await supabase
        .from('dse_customers')
        .select('dse_user_id')
        .eq('id', validatedData.customer_id)
        .maybeSingle()

      if (error || !customer || customer.dse_user_id !== user.id) {
        return NextResponse.json({ success: false, error: 'Customer not found or access denied' }, { status: 403 })
      }
    }

    if (validatedData.lead_id) {
      const { data: lead, error } = await supabase
        .from('dse_leads')
        .select('dse_user_id')
        .eq('id', validatedData.lead_id)
        .maybeSingle()

      if (error || !lead || lead.dse_user_id !== user.id) {
        return NextResponse.json({ success: false, error: 'Lead not found or access denied' }, { status: 403 })
      }
    }

    // Verify ownership of visit_id if provided
    if (validatedData.visit_id) {
      const { data: visit, error } = await supabase
        .from('dse_visits')
        .select('dse_user_id')
        .eq('id', validatedData.visit_id)
        .maybeSingle()

      if (error || !visit || visit.dse_user_id !== user.id) {
        return NextResponse.json({ success: false, error: 'Visit not found or access denied' }, { status: 403 })
      }
    }

    // Verify ownership of meeting_id if provided
    if (validatedData.meeting_id) {
      const { data: meeting, error } = await supabase
        .from('dse_meetings')
        .select('organizer_id')
        .eq('id', validatedData.meeting_id)
        .maybeSingle()

      if (error || !meeting || meeting.organizer_id !== user.id) {
        return NextResponse.json({ success: false, error: 'Meeting not found or access denied' }, { status: 403 })
      }
    }

    // Create note
    const { data: note, error: createError } = await supabase
      .from('dse_notes')
      .insert({
        ...validatedData,
        author_id: user.id,
      })
      .select()
      .maybeSingle()

    if (createError) throw createError

    if (!note) {
      apiLogger.error('Note insert returned null despite no error')
      return NextResponse.json(
        { success: false, error: 'Failed to create note' },
        { status: 500 }
      )
    }

    // Update counters on customer/lead
    if (validatedData.customer_id) {
      const { error: rpcError } = await supabase.rpc('increment_counter', {
        table_name: 'dse_customers',
        row_id: validatedData.customer_id,
        counter_column: 'notes_count'
      })
      if (rpcError) {
        apiLogger.error('Failed to increment customer notes_count', rpcError)
      }
    }

    if (validatedData.lead_id) {
      const { error: rpcError } = await supabase.rpc('increment_counter', {
        table_name: 'dse_leads',
        row_id: validatedData.lead_id,
        counter_column: 'notes_count'
      })
      if (rpcError) {
        apiLogger.error('Failed to increment lead notes_count', rpcError)
      }
    }

    // Create audit log
    const { error: auditError } = await supabase.from('dse_audit_log').insert({
      entity_type: 'Note',
      entity_id: note.id,
      action: 'NoteAdded',
      new_values: note,
      user_id: user.id,
      changes_summary: `Added ${validatedData.note_type} note`
    })

    if (auditError) {
      apiLogger.error('Failed to create audit log for note creation', auditError)
    }

    return NextResponse.json({
      success: true,
      data: note,
      message: 'Note created successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 })
    }

    apiLogger.error('Error creating note', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
