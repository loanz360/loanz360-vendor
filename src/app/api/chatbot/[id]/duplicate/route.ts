
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// POST /api/chatbot/[id]/duplicate - Duplicate a chatbot
export async function POST(
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

    // Get original chatbot
    const { data: original, error: findError } = await supabase
      .from('chatbots')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (findError || !original) {
      return NextResponse.json(
        { success: false, error: 'Chatbot not found' },
        { status: 404 }
      )
    }

    // Create duplicate chatbot
    const duplicateData = {
      name: `${original.name} (Copy)`,
      description: original.description,
      status: 'draft',
      theme: original.theme,
      settings: original.settings,
      track_utm: original.track_utm,
      track_device: original.track_device,
      track_location: original.track_location,
      track_page_url: original.track_page_url,
      track_referrer: original.track_referrer,
      assignment_mode: original.assignment_mode,
      assignment_rules: original.assignment_rules,
      default_assignee_id: original.default_assignee_id,
      embed_domains: [],
      created_by: user.id
    }

    const { data: newChatbot, error: createError } = await supabase
      .from('chatbots')
      .insert(duplicateData)
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error duplicating chatbot', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to duplicate chatbot' },
        { status: 500 }
      )
    }

    // Get original flows
    const { data: originalFlows } = await supabase
      .from('chatbot_flows')
      .select('*')
      .eq('chatbot_id', id)

    if (originalFlows && originalFlows.length > 0) {
      // Duplicate flows
      for (const flow of originalFlows) {
        const { data: newFlow, error: flowError } = await supabase
          .from('chatbot_flows')
          .insert({
            chatbot_id: newChatbot.id,
            name: flow.name,
            description: flow.description,
            version: 1,
            is_published: false,
            is_default: flow.is_default,
            canvas_data: flow.canvas_data
          })
          .select()
          .maybeSingle()

        if (flowError) {
          apiLogger.error('Error duplicating flow', flowError)
          continue
        }

        // Get original nodes for this flow
        const { data: originalNodes } = await supabase
          .from('chatbot_nodes')
          .select('*')
          .eq('flow_id', flow.id)

        if (originalNodes && originalNodes.length > 0) {
          // Duplicate nodes
          const nodesToInsert = originalNodes.map(node => ({
            flow_id: newFlow.id,
            node_id: node.node_id,
            node_type: node.node_type,
            position_x: node.position_x,
            position_y: node.position_y,
            width: node.width,
            height: node.height,
            content: node.content,
            next_node_id: node.next_node_id,
            conditional_next: node.conditional_next,
            display_order: node.display_order
          }))

          await supabase.from('chatbot_nodes').insert(nodesToInsert)
        }

        // Get original edges for this flow
        const { data: originalEdges } = await supabase
          .from('chatbot_edges')
          .select('*')
          .eq('flow_id', flow.id)

        if (originalEdges && originalEdges.length > 0) {
          // Duplicate edges
          const edgesToInsert = originalEdges.map(edge => ({
            flow_id: newFlow.id,
            edge_id: edge.edge_id,
            source_node_id: edge.source_node_id,
            target_node_id: edge.target_node_id,
            source_handle: edge.source_handle,
            target_handle: edge.target_handle,
            label: edge.label,
            edge_type: edge.edge_type
          }))

          await supabase.from('chatbot_edges').insert(edgesToInsert)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: newChatbot,
      message: 'Chatbot duplicated successfully'
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Chatbot duplicate error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
