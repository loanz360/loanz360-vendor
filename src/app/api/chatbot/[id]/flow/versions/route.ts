export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { auditService } from '@/lib/services/audit-service'
import { apiLogger } from '@/lib/utils/logger'

// GET - List flow versions
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

    // Get all versions for this chatbot
    const { data: versions, error } = await supabase
      .from('chatbot_flow_versions')
      .select(`
        id,
        chatbot_id,
        flow_id,
        version_number,
        name,
        description,
        is_published,
        created_by,
        created_at
      `)
      .eq('chatbot_id', chatbotId)
      .order('version_number', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: versions || []
    })
  } catch (error) {
    apiLogger.error('Error fetching flow versions', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch flow versions' },
      { status: 500 }
    )
  }
}

// POST - Create a new version (snapshot current flow)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatbotId } = await params
    const body = await request.json()
    const { name, description } = body

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

    // Get current flow
    const { data: flow, error: flowError } = await supabase
      .from('chatbot_flows')
      .select('id, canvas_data')
      .eq('chatbot_id', chatbotId)
      .maybeSingle()

    if (flowError || !flow) {
      return NextResponse.json(
        { success: false, error: 'No flow found to version' },
        { status: 404 }
      )
    }

    // Get current nodes and edges
    const { data: nodes } = await supabase
      .from('chatbot_nodes')
      .select('*')
      .eq('flow_id', flow.id)

    const { data: edges } = await supabase
      .from('chatbot_edges')
      .select('*')
      .eq('flow_id', flow.id)

    // Get the next version number
    const { data: latestVersion } = await supabase
      .from('chatbot_flow_versions')
      .select('version_number')
      .eq('chatbot_id', chatbotId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersionNumber = (latestVersion?.version_number || 0) + 1

    // Create version snapshot
    const { data: version, error: createError } = await supabase
      .from('chatbot_flow_versions')
      .insert({
        chatbot_id: chatbotId,
        flow_id: flow.id,
        version_number: nextVersionNumber,
        name: name || `Version ${nextVersionNumber}`,
        description: description || null,
        canvas_data: {
          nodes: nodes || [],
          edges: edges || [],
          savedAt: new Date().toISOString()
        },
        is_published: false,
        created_by: user.id
      })
      .select()
      .maybeSingle()

    if (createError) throw createError

    // Log audit event
    await auditService.log({
      event_type: 'flow.saved',
      entity_type: 'chatbot_flow',
      entity_id: flow.id,
      actor_id: user.id,
      actor_type: 'user',
      new_values: {
        version_number: nextVersionNumber,
        nodes_count: nodes?.length || 0,
        edges_count: edges?.length || 0
      },
      metadata: { chatbot_id: chatbotId }
    })

    return NextResponse.json({
      success: true,
      data: version
    })
  } catch (error) {
    apiLogger.error('Error creating flow version', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create flow version' },
      { status: 500 }
    )
  }
}
