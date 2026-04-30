
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ChatbotUpdateInput } from '@/types/chatbot'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/chatbot/[id] - Get a single chatbot
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is super admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Super admin only.' },
        { status: 403 }
      )
    }

    // Get chatbot with flows
    const { data: chatbot, error } = await supabase
      .from('chatbots')
      .select(`
        *,
        chatbot_flows (
          id,
          name,
          description,
          version,
          is_published,
          is_default,
          created_at,
          updated_at,
          published_at
        )
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Chatbot not found' },
          { status: 404 }
        )
      }
      apiLogger.error('Error fetching chatbot', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch chatbot' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: chatbot
    })
  } catch (error) {
    apiLogger.error('Chatbot get error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/chatbot/[id] - Update a chatbot
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is super admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Super admin only.' },
        { status: 403 }
      )
    }

    const body: Partial<ChatbotUpdateInput> = await request.json()

    // Check if chatbot exists
    const { data: existingChatbot, error: findError } = await supabase
      .from('chatbots')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (findError || !existingChatbot) {
      return NextResponse.json(
        { success: false, error: 'Chatbot not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.status !== undefined) updateData.status = body.status
    if (body.theme !== undefined) updateData.theme = body.theme
    if (body.settings !== undefined) updateData.settings = body.settings
    if (body.assignment_mode !== undefined) updateData.assignment_mode = body.assignment_mode
    if (body.assignment_rules !== undefined) updateData.assignment_rules = body.assignment_rules
    if (body.default_assignee_id !== undefined) updateData.default_assignee_id = body.default_assignee_id
    if (body.embed_domains !== undefined) updateData.embed_domains = body.embed_domains

    // Update chatbot
    const { data: chatbot, error: updateError } = await supabase
      .from('chatbots')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating chatbot', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update chatbot' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: chatbot,
      message: 'Chatbot updated successfully'
    })
  } catch (error) {
    apiLogger.error('Chatbot update error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/chatbot/[id] - Delete a chatbot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is super admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Super admin only.' },
        { status: 403 }
      )
    }

    // Check if chatbot exists
    const { data: existingChatbot, error: findError } = await supabase
      .from('chatbots')
      .select('id, name, total_leads')
      .eq('id', id)
      .maybeSingle()

    if (findError || !existingChatbot) {
      return NextResponse.json(
        { success: false, error: 'Chatbot not found' },
        { status: 404 }
      )
    }

    // Warn if chatbot has leads
    if (existingChatbot.total_leads > 0) {
      // Instead of deleting, archive it
      const { error: archiveError } = await supabase
        .from('chatbots')
        .update({ status: 'archived' })
        .eq('id', id)

      if (archiveError) {
        apiLogger.error('Error archiving chatbot', archiveError)
        return NextResponse.json(
          { success: false, error: 'Failed to archive chatbot' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Chatbot archived (not deleted) because it has associated leads'
      })
    }

    // Delete chatbot (cascades to flows, nodes, edges)
    const { error: deleteError } = await supabase
      .from('chatbots')
      .delete()
      .eq('id', id)

    if (deleteError) {
      apiLogger.error('Error deleting chatbot', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete chatbot' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Chatbot deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Chatbot delete error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
