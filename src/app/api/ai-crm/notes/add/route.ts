import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Note } from '@/types/ai-crm'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * ADD Manual Note to Contact/Lead/Deal
 *
 * POST /api/ai-crm/notes/add
 * Body: {
 *   entity_type: 'contact' | 'positive_contact' | 'lead' | 'deal'
 *   entity_id: string
 *   content: string
 * }
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { entity_type, entity_id, content } = body

    // Validate inputs
    if (!entity_type || !entity_id || !content) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: entity_type, entity_id, content' },
        { status: 400 }
      )
    }

    if (!['contact', 'positive_contact', 'lead', 'deal'].includes(entity_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid entity_type. Must be: contact, positive_contact, lead, or deal' },
        { status: 400 }
      )
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Note content cannot be empty' },
        { status: 400 }
      )
    }

    // Map entity type to table name
    const tableMap: Record<string, string> = {
      contact: 'crm_contacts',
      positive_contact: 'positive_contacts',
      lead: 'crm_leads',
      deal: 'crm_deals',
    }

    const tableName = tableMap[entity_type]

    // Fetch current entity to get existing notes
    const { data: entity, error: fetchError } = await supabase
      .from(tableName)
      .select('notes_timeline')
      .eq('id', entity_id)
      .maybeSingle()

    if (fetchError || !entity) {
      return NextResponse.json(
        { success: false, error: `${entity_type} not found` },
        { status: 404 }
      )
    }

    // Create manual note
    const manualNote: Note = {
      id: crypto.randomUUID(),
      type: 'manual_note',
      timestamp: new Date().toISOString(),
      content: content.trim(),
      is_editable: true,
      created_by: user.id,
      created_by_name: user.user_metadata?.full_name || 'Unknown',
      created_at: new Date().toISOString(),
    }

    // Append to existing notes
    const existingNotes = (entity.notes_timeline as Note[]) || []
    const updatedNotes = [...existingNotes, manualNote]

    // Update entity with new notes timeline
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        notes_timeline: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entity_id)

    if (updateError) {
      apiLogger.error('Error updating notes', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to add note' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        note: manualNote,
        total_notes: updatedNotes.length,
      },
      message: 'Note added successfully',
    })
  } catch (error) {
    apiLogger.error('Error in add-note API', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
