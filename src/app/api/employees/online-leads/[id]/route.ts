export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyEmployee } from '@/lib/auth/verify-employee'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get single online lead details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const employee = await verifyEmployee(request)
    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const supabase = await createClient()

    const { data: lead, error } = await supabase
      .from('online_leads')
      .select('*, chatbots(id, name, settings), chat_sessions(id, started_at, ended_at, status)')
      .eq('id', id)
      .eq('assigned_to', employee.id)
      .maybeSingle()

    if (error || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Get chat messages for this lead's session
    if (lead.session_id) {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', lead.session_id)
        .order('created_at', { ascending: true })

      lead.chat_messages = messages || []
    }

    return NextResponse.json({
      success: true,
      data: lead
    })
  } catch (error) {
    apiLogger.error('Error fetching lead', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lead' },
      { status: 500 }
    )
  }
}

// PATCH - Update online lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const employee = await verifyEmployee(request)
    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { status, note } = body

    const supabase = await createClient()

    // Verify lead belongs to this employee
    const { data: existingLead, error: fetchError } = await supabase
      .from('online_leads')
      .select('id, notes_timeline')
      .eq('id', id)
      .eq('assigned_to', employee.id)
      .maybeSingle()

    if (fetchError || !existingLead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (status) {
      updates.status = status
    }

    // Add note to timeline if provided
    if (note) {
      const currentTimeline = existingLead.notes_timeline || []
      updates.notes_timeline = [
        ...currentTimeline,
        {
          id: `note-${Date.now()}`,
          type: 'note',
          content: note,
          created_by: employee.id,
          created_at: new Date().toISOString()
        }
      ]
    }

    // Add status change to timeline
    if (status) {
      const currentTimeline = updates.notes_timeline || existingLead.notes_timeline || []
      updates.notes_timeline = [
        ...currentTimeline,
        {
          id: `status-${Date.now()}`,
          type: 'status_change',
          content: `Status changed to ${status}`,
          created_by: employee.id,
          created_at: new Date().toISOString()
        }
      ]
    }

    const { data: lead, error } = await supabase
      .from('online_leads')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating lead', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: lead
    })
  } catch (error) {
    apiLogger.error('Error updating lead', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update lead' },
      { status: 500 }
    )
  }
}
