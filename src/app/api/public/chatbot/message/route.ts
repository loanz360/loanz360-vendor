import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LeadAssignmentService } from '@/lib/services/lead-assignment-service'
import {
  getClientIP,
  rateLimitByIP,
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS
} from '@/lib/middleware/rate-limiter'
import { sanitizeChatInput, sanitizeCollectedData } from '@/lib/utils/sanitize'
import { apiLogger } from '@/lib/utils/logger'

// SECURITY: Allowed origins for CORS (no wildcard!)
const ALLOWED_ORIGINS = [
  'https://loanz-360-claude-code.vercel.app',
  'https://loanz-360-claude-code-git-master-vinod-bysanis-projects.vercel.app',
  'https://loanz360.com',
  'https://www.loanz360.com',
  'https://app.loanz360.com',
  process.env.NEXT_PUBLIC_APP_URL,
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : [])
].filter(Boolean) as string[]

// CORS headers for public API - strict origin checking
function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin')
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  }
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

// Handle preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request)
  })
}

// POST - Process chat message and get next node
export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request)

  try {
    const bodySchema = z.object({

      session_id: z.string().uuid().optional(),

      node_id: z.string().uuid().optional(),

      answer: z.string().optional(),

      collected_data: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { session_id, node_id, answer, collected_data } = body

    if (!session_id || !node_id) {
      return NextResponse.json(
        { success: false, error: 'Session ID and Node ID required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Rate limiting
    const clientIP = getClientIP(request.headers)
    const rateLimitResult = rateLimitByIP(
      clientIP,
      'message',
      RATE_LIMIT_CONFIGS.MESSAGE
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            ...getRateLimitHeaders(rateLimitResult)
          }
        }
      )
    }

    // Sanitize inputs
    const sanitizedAnswer = answer ? sanitizeChatInput(String(answer)) : null
    const sanitizedCollectedData = collected_data
      ? sanitizeCollectedData(collected_data)
      : {}

    const supabase = await createClient()

    // Verify session exists and is active
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*, chatbots(id, assignment_mode)')
      .eq('id', session_id)
      .eq('status', 'active')
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Session not found or expired' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Get the flow for this chatbot
    const { data: flow, error: flowError } = await supabase
      .from('chatbot_flows')
      .select('id')
      .eq('chatbot_id', session.chatbot_id)
      .eq('is_published', true)
      .maybeSingle()

    if (flowError || !flow) {
      return NextResponse.json(
        { success: false, error: 'Flow not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Get current node
    const { data: currentNode, error: nodeError } = await supabase
      .from('chatbot_nodes')
      .select('*')
      .eq('node_id', node_id)
      .eq('flow_id', flow.id)
      .maybeSingle()

    if (nodeError || !currentNode) {
      return NextResponse.json(
        { success: false, error: 'Node not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Store message if there's an answer
    if (sanitizedAnswer) {
      await supabase.from('chat_messages').insert({
        session_id,
        sender: 'user',
        content: sanitizedAnswer,
        node_id,
        metadata: { collected_data: sanitizedCollectedData }
      })

      // Update session with collected data
      await supabase
        .from('chat_sessions')
        .update({
          collected_data: sanitizedCollectedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    // Find next node
    let nextNodeId: string | null = null

    if (currentNode.node_type === 'condition') {
      // Handle conditional branching
      const variable = currentNode.config.variable
      const operator = currentNode.config.operator
      const conditionValue = currentNode.config.value
      const actualValue = (sanitizedCollectedData as Record<string, unknown>)?.[variable]

      let conditionMet = evaluateCondition(operator, actualValue, conditionValue)

      // Find the appropriate edge
      const { data: edges } = await supabase
        .from('chatbot_edges')
        .select('*')
        .eq('source_node_id', node_id)
        .eq('flow_id', flow.id)

      if (edges && edges.length > 0) {
        const edge = edges.find(e =>
          e.source_handle === (conditionMet ? 'true' : 'false')
        ) || edges[0]
        nextNodeId = edge?.target_node_id
      }
    } else {
      // Find next node via edge
      const { data: edge } = await supabase
        .from('chatbot_edges')
        .select('target_node_id')
        .eq('source_node_id', node_id)
        .eq('flow_id', flow.id)
        .maybeSingle()

      nextNodeId = edge?.target_node_id || null
    }

    // Get next node data
    let nextNode = null
    let referenceNumber = null

    if (nextNodeId) {
      const { data: node } = await supabase
        .from('chatbot_nodes')
        .select('*')
        .eq('node_id', nextNodeId)
        .eq('flow_id', flow.id)
        .maybeSingle()

      if (node) {
        nextNode = {
          id: node.id,
          type: node.node_type,
          data: node.config
        }

        // Handle end node with lead submission
        if (node.node_type === 'end' && node.config.type === 'submit_lead') {
          referenceNumber = await submitLead(supabase, session, sanitizedCollectedData as Record<string, unknown>)

          // Update session status
          await supabase
            .from('chat_sessions')
            .update({
              status: 'completed',
              ended_at: new Date().toISOString()
            })
            .eq('id', session_id)
        }
      }
    }

    // Store bot message
    if (nextNode) {
      const messageContent = nextNode.data.message || nextNode.data.question || ''
      await supabase.from('chat_messages').insert({
        session_id,
        sender: 'bot',
        content: messageContent,
        node_id: nextNode.id,
        metadata: { node_type: nextNode.type }
      })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          node: nextNode,
          next_node_id: nextNodeId,
          reference_number: referenceNumber
        }
      },
      {
        headers: {
          ...corsHeaders,
          ...getRateLimitHeaders(rateLimitResult)
        }
      }
    )
  } catch (error) {
    apiLogger.error('Error processing message', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process message' },
      { status: 500, headers: corsHeaders }
    )
  }
}

function evaluateCondition(operator: string, actualValue: unknown, conditionValue: string): boolean {
  if (actualValue === undefined || actualValue === null) {
    return operator === 'is_empty'
  }

  const strValue = String(actualValue).toLowerCase()
  const condValue = conditionValue.toLowerCase()

  switch (operator) {
    case 'equals':
      return strValue === condValue
    case 'not_equals':
      return strValue !== condValue
    case 'contains':
      return strValue.includes(condValue)
    case 'greater_than':
      return Number(actualValue) > Number(conditionValue)
    case 'less_than':
      return Number(actualValue) < Number(conditionValue)
    case 'is_empty':
      return !actualValue || strValue === ''
    case 'is_not_empty':
      return actualValue && strValue !== ''
    default:
      return false
  }
}

async function submitLead(supabase: unknown, session: unknown, collectedData: unknown): Promise<string> {
  // Generate reference number
  const referenceNumber = `OL${Date.now().toString(36).toUpperCase()}`

  // Extract common fields from collected data
  const customerName = collectedData?.customer_name || collectedData?.name || 'Unknown'
  const phone = collectedData?.phone || collectedData?.mobile || ''
  const email = collectedData?.email || ''

  // Create online lead
  const { data: lead, error } = await supabase
    .from('online_leads')
    .insert({
      reference_number: referenceNumber,
      chatbot_id: session.chatbot_id,
      session_id: session.id,
      customer_name: customerName,
      phone,
      email,
      collected_data: collectedData,
      source_url: session.page_url,
      utm_source: session.visitor_data?.utm_source,
      utm_medium: session.visitor_data?.utm_medium,
      utm_campaign: session.visitor_data?.utm_campaign,
      device_type: session.device_type,
      browser: session.browser,
      country: session.country,
      city: session.city,
      status: 'new',
      notes_timeline: [{
        id: `note-${Date.now()}`,
        type: 'system',
        content: 'Lead collected via chatbot',
        created_at: new Date().toISOString()
      }]
    })
    .select()
    .maybeSingle()

  if (error) {
    apiLogger.error('Failed to create lead', error)
    throw error
  }

  // Auto-assign lead based on chatbot assignment mode
  if (lead && session.chatbot_id) {
    try {
      const assignmentResult = await LeadAssignmentService.assignLead(
        session.chatbot_id,
        lead.id
      )
      if (assignmentResult.success && assignmentResult.assignedTo) {
      }
    } catch (assignError) {
      apiLogger.error('Lead assignment failed', assignError)
      // Don't fail the lead creation if assignment fails
    }
  }

  return referenceNumber
}
