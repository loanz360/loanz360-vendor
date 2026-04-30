
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { auditService } from '@/lib/services/audit-service'
import { apiLogger } from '@/lib/utils/logger'

// GET - Get specific version details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: chatbotId, versionId } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get version details
    const { data: version, error } = await supabase
      .from('chatbot_flow_versions')
      .select('*')
      .eq('id', versionId)
      .eq('chatbot_id', chatbotId)
      .maybeSingle()

    if (error || !version) {
      return NextResponse.json(
        { success: false, error: 'Version not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: version
    })
  } catch (error) {
    apiLogger.error('Error fetching version', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch version' },
      { status: 500 }
    )
  }
}

// POST - Rollback to this version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: chatbotId, versionId } = await params
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

    // Get version to rollback to
    const { data: version, error: versionError } = await supabase
      .from('chatbot_flow_versions')
      .select('*')
      .eq('id', versionId)
      .eq('chatbot_id', chatbotId)
      .maybeSingle()

    if (versionError || !version) {
      return NextResponse.json(
        { success: false, error: 'Version not found' },
        { status: 404 }
      )
    }

    // Get current flow
    const { data: flow } = await supabase
      .from('chatbot_flows')
      .select('id')
      .eq('chatbot_id', chatbotId)
      .maybeSingle()

    if (!flow) {
      return NextResponse.json(
        { success: false, error: 'Flow not found' },
        { status: 404 }
      )
    }

    // Get current version number for audit
    const { data: currentLatest } = await supabase
      .from('chatbot_flow_versions')
      .select('version_number')
      .eq('chatbot_id', chatbotId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Delete existing nodes and edges
    await supabase.from('chatbot_edges').delete().eq('flow_id', flow.id)
    await supabase.from('chatbot_nodes').delete().eq('flow_id', flow.id)

    // Restore nodes from version
    const canvasData = version.canvas_data as {
      nodes?: Array<{
        node_id: string
        node_type: string
        label: string
        config: Record<string, unknown>
        position: { x: number; y: number }
        order_index: number
      }>
      edges?: Array<{
        id: string
        source_node_id: string
        target_node_id: string
        source_handle?: string
        target_handle?: string
        condition?: string
      }>
    }

    if (canvasData.nodes && canvasData.nodes.length > 0) {
      const nodesToInsert = canvasData.nodes.map((node, index) => ({
        node_id: node.node_id,
        flow_id: flow.id,
        node_type: node.node_type,
        label: node.label,
        config: node.config,
        position: node.position,
        order_index: node.order_index ?? index
      }))

      await supabase.from('chatbot_nodes').insert(nodesToInsert)
    }

    // Restore edges from version
    if (canvasData.edges && canvasData.edges.length > 0) {
      const edgesToInsert = canvasData.edges.map(edge => ({
        id: edge.id,
        flow_id: flow.id,
        source_node_id: edge.source_node_id,
        target_node_id: edge.target_node_id,
        source_handle: edge.source_handle || null,
        target_handle: edge.target_handle || null,
        condition: edge.condition || null
      }))

      await supabase.from('chatbot_edges').insert(edgesToInsert)
    }

    // Update canvas_data on flow
    await supabase
      .from('chatbot_flows')
      .update({ canvas_data: canvasData })
      .eq('id', flow.id)

    // Log audit event
    await auditService.logFlowRolledBack(
      flow.id,
      currentLatest?.version_number || 0,
      version.version_number,
      user.id
    )

    return NextResponse.json({
      success: true,
      data: {
        message: `Rolled back to version ${version.version_number}`,
        version_number: version.version_number
      }
    })
  } catch (error) {
    apiLogger.error('Error rolling back version', error)
    return NextResponse.json(
      { success: false, error: 'Failed to rollback version' },
      { status: 500 }
    )
  }
}

// PUT - Publish this version
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: chatbotId, versionId } = await params
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

    // Get version
    const { data: version, error: versionError } = await supabase
      .from('chatbot_flow_versions')
      .select('*')
      .eq('id', versionId)
      .eq('chatbot_id', chatbotId)
      .maybeSingle()

    if (versionError || !version) {
      return NextResponse.json(
        { success: false, error: 'Version not found' },
        { status: 404 }
      )
    }

    // Unpublish all other versions for this chatbot
    await supabase
      .from('chatbot_flow_versions')
      .update({ is_published: false })
      .eq('chatbot_id', chatbotId)

    // Publish this version
    await supabase
      .from('chatbot_flow_versions')
      .update({ is_published: true })
      .eq('id', versionId)

    // Also mark the flow as published
    await supabase
      .from('chatbot_flows')
      .update({ is_published: true })
      .eq('id', version.flow_id)

    // Log audit event
    await auditService.logFlowPublished(
      version.flow_id,
      version.version_number,
      user.id
    )

    return NextResponse.json({
      success: true,
      data: {
        message: `Version ${version.version_number} published`,
        version_number: version.version_number
      }
    })
  } catch (error) {
    apiLogger.error('Error publishing version', error)
    return NextResponse.json(
      { success: false, error: 'Failed to publish version' },
      { status: 500 }
    )
  }
}
