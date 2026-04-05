export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  assignTicket,
  reassignTicket,
  unassignTicket,
  getAvailableAgents,
  getWorkloadStats,
  getAssignmentHistory,
  updateAgentStatus,
  AssignmentMethod,
  AgentStatus
} from '@/lib/tickets/assignment-engine'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/assignment
 * Get assignment data (agents, workload, history)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'agents' // 'agents', 'workload', 'history', 'rules'
    const source = searchParams.get('source') as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER' | null
    const ticketId = searchParams.get('ticket_id')
    const role = searchParams.get('role') || undefined
    const category = searchParams.get('category') || undefined

    // Mode: Get available agents
    if (mode === 'agents') {
      if (!source) {
        return NextResponse.json({ success: false, error: 'Source is required' }, { status: 400 })
      }
      const agents = await getAvailableAgents(source, role, undefined, category)
      return NextResponse.json({ agents })
    }

    // Mode: Get workload statistics
    if (mode === 'workload') {
      const stats = await getWorkloadStats(source || undefined)
      return NextResponse.json({ workload_stats: stats })
    }

    // Mode: Get assignment history for a ticket
    if (mode === 'history') {
      if (!ticketId || !source) {
        return NextResponse.json({ success: false, error: 'ticket_id and source are required' }, { status: 400 })
      }
      const history = await getAssignmentHistory(ticketId, source)
      return NextResponse.json({ history })
    }

    // Mode: Get assignment rules
    if (mode === 'rules') {
      const { data: rules } = await supabase
        .from('assignment_rules')
        .select('*')
        .order('order', { ascending: true })

      return NextResponse.json({ rules: rules || [] })
    }

    return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/assignment
 * Assign a ticket
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      ticket_id,
      ticket_source,
      priority,
      category,
      preferred_agent_id,
      method
    } = body

    if (!ticket_id || !ticket_source || !priority) {
      return NextResponse.json(
        { error: 'Missing required fields: ticket_id, ticket_source, priority' },
        { status: 400 }
      )
    }

    const result = await assignTicket(
      ticket_id,
      ticket_source as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
      priority,
      category,
      preferred_agent_id,
      method as AssignmentMethod | undefined
    )

    return NextResponse.json({ result })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/assignment
 * Reassign, unassign, or update agent status
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, ticket_id, ticket_source, agent_id, reason, status } = body

    if (!action) {
      return NextResponse.json({ success: false, error: 'Missing action' }, { status: 400 })
    }

    switch (action) {
      case 'reassign':
        if (!ticket_id || !ticket_source || !agent_id || !reason) {
          return NextResponse.json(
            { error: 'Missing required fields for reassignment' },
            { status: 400 }
          )
        }
        const reassigned = await reassignTicket(
          ticket_id,
          ticket_source as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
          agent_id,
          reason,
          user.id
        )
        return NextResponse.json({ success: reassigned })

      case 'unassign':
        if (!ticket_id || !ticket_source || !reason) {
          return NextResponse.json(
            { error: 'Missing required fields for unassignment' },
            { status: 400 }
          )
        }
        const unassigned = await unassignTicket(
          ticket_id,
          ticket_source as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
          reason,
          user.id
        )
        return NextResponse.json({ success: unassigned })

      case 'update_status':
        if (!agent_id || !status) {
          return NextResponse.json(
            { error: 'Missing agent_id or status' },
            { status: 400 }
          )
        }
        const updated = await updateAgentStatus(agent_id, status as AgentStatus)
        return NextResponse.json({ success: updated })

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
