import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET - Get chatbot flow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatbotId } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is super admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (userProfile?.role !== 'SUPER_ADMIN' && !superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Get the main flow for this chatbot
    const { data: flow, error: flowError } = await supabase
      .from('chatbot_flows')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .eq('is_published', true)
      .maybeSingle()

    if (flowError && flowError.code !== 'PGRST116') {
      throw flowError
    }

    if (!flow) {
      // Return empty flow if none exists
      return NextResponse.json({
        success: true,
        data: {
          nodes: [],
          edges: []
        }
      })
    }

    // Get nodes for this flow
    const { data: nodes, error: nodesError } = await supabase
      .from('chatbot_nodes')
      .select('*')
      .eq('flow_id', flow.id)
      .order('order_index')

    if (nodesError) throw nodesError

    // Get edges for this flow
    const { data: edges, error: edgesError } = await supabase
      .from('chatbot_edges')
      .select('*')
      .eq('flow_id', flow.id)

    if (edgesError) throw edgesError

    // Transform to React Flow format
    const transformedNodes = (nodes || []).map(node => ({
      id: node.node_id,
      type: node.node_type,
      position: node.position,
      data: {
        label: node.label,
        ...node.config
      }
    }))

    const transformedEdges = (edges || []).map(edge => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      sourceHandle: edge.source_handle,
      targetHandle: edge.target_handle,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#FF6B00', strokeWidth: 2 }
    }))

    return NextResponse.json({
      success: true,
      data: {
        flowId: flow.id,
        nodes: transformedNodes,
        edges: transformedEdges
      }
    })
  } catch (error) {
    apiLogger.error('Error fetching flow', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch flow' },
      { status: 500 }
    )
  }
}

// POST - Save/Update chatbot flow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatbotId } = await params
    const bodySchema = z.object({

      nodes: z.array(z.unknown()).optional(),

      edges: z.array(z.unknown()).optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { nodes, edges } = body

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is super admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (userProfile?.role !== 'SUPER_ADMIN' && !superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Verify chatbot exists
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id')
      .eq('id', chatbotId)
      .maybeSingle()

    if (chatbotError || !chatbot) {
      return NextResponse.json(
        { success: false, error: 'Chatbot not found' },
        { status: 404 }
      )
    }

    // Get or create flow
    let { data: existingFlow } = await supabase
      .from('chatbot_flows')
      .select('id')
      .eq('chatbot_id', chatbotId)
      .maybeSingle()

    let flowId: string

    if (!existingFlow) {
      // Create new flow
      const { data: newFlow, error: createFlowError } = await supabase
        .from('chatbot_flows')
        .insert({
          chatbot_id: chatbotId,
          name: 'Main Flow',
          description: 'Primary conversation flow',
          is_published: false
        })
        .select()
        .maybeSingle()

      if (createFlowError) throw createFlowError
      flowId = newFlow.id
    } else {
      flowId = existingFlow.id

      // Delete existing nodes and edges
      await supabase.from('chatbot_edges').delete().eq('flow_id', flowId)
      await supabase.from('chatbot_nodes').delete().eq('flow_id', flowId)
    }

    // Insert nodes
    if (nodes && nodes.length > 0) {
      const nodesToInsert = nodes.map((node: unknown, index: number) => ({
        node_id: node.id,
        flow_id: flowId,
        node_type: node.type,
        label: node.data?.label || node.type,
        config: node.data || {},
        position: node.position,
        order_index: index
      }))

      const { error: insertNodesError } = await supabase
        .from('chatbot_nodes')
        .insert(nodesToInsert)

      if (insertNodesError) throw insertNodesError
    }

    // Insert edges
    if (edges && edges.length > 0) {
      const edgesToInsert = edges.map((edge: unknown) => ({
        id: edge.id,
        flow_id: flowId,
        source_node_id: edge.source,
        target_node_id: edge.target,
        source_handle: edge.sourceHandle || null,
        target_handle: edge.targetHandle || null,
        condition: edge.condition || null
      }))

      const { error: insertEdgesError } = await supabase
        .from('chatbot_edges')
        .insert(edgesToInsert)

      if (insertEdgesError) throw insertEdgesError
    }

    // Update chatbot's updated_at
    await supabase
      .from('chatbots')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatbotId)

    return NextResponse.json({
      success: true,
      data: {
        flowId,
        nodesCount: nodes?.length || 0,
        edgesCount: edges?.length || 0
      }
    })
  } catch (error) {
    apiLogger.error('Error saving flow', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save flow' },
      { status: 500 }
    )
  }
}
