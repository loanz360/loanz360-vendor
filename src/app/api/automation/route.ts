
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import {
  getWorkflowRules,
  createWorkflowRule,
  updateWorkflowRule,
  deleteWorkflowRule,
  processWorkflows,
  getAutomationStats,
  getWorkflowExecutions,
  initializeWorkflowRules,
  WORKFLOW_TEMPLATES
} from '@/lib/tickets/automation-engine'

/**
 * GET /api/automation
 * Get workflow rules, executions, or stats
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'rules'

    // Mode: Get rules
    if (mode === 'rules') {
      const activeOnly = searchParams.get('active_only') === 'true'
      const triggerType = searchParams.get('trigger_type') as any
      const source = searchParams.get('source') as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER' | undefined

      const rules = await getWorkflowRules({
        activeOnly,
        triggerType,
        source
      })

      return NextResponse.json({ rules })
    }

    // Mode: Get executions
    if (mode === 'executions') {
      const ruleId = searchParams.get('rule_id') || undefined
      const ticketId = searchParams.get('ticket_id') || undefined
      const status = searchParams.get('status') as any
      const limit = parseInt(searchParams.get('limit') || '50')

      const executions = await getWorkflowExecutions({
        ruleId,
        ticketId,
        status,
        limit
      })

      return NextResponse.json({ executions })
    }

    // Mode: Get stats
    if (mode === 'stats') {
      const stats = await getAutomationStats()
      return NextResponse.json({ stats })
    }

    // Mode: Get templates
    if (mode === 'templates') {
      return NextResponse.json({ templates: WORKFLOW_TEMPLATES })
    }

    return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Automation API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/automation
 * Create a new workflow rule or trigger workflow processing
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // Action: Create a new rule
    if (action === 'create_rule') {
      const { name, description, trigger_type, conditions, actions, sources, priority, stop_processing_rules } = body

      if (!name || !trigger_type || !actions || actions.length === 0) {
        return NextResponse.json(
          { error: 'name, trigger_type, and actions are required' },
          { status: 400 }
        )
      }

      const rule = await createWorkflowRule({
        name,
        description,
        is_active: true,
        priority: priority || 10,
        trigger_type,
        conditions: conditions || [],
        actions,
        sources: sources || ['EMPLOYEE', 'CUSTOMER', 'PARTNER'],
        stop_processing_rules,
        created_by_id: user.id
      })

      if (!rule) {
        return NextResponse.json({ success: false, error: 'Failed to create rule' }, { status: 500 })
      }

      return NextResponse.json({ rule })
    }

    // Action: Process workflows (trigger manually or from event)
    if (action === 'process') {
      const { trigger_type, ticket_id, ticket_source, ticket_data, trigger_data } = body

      if (!trigger_type || !ticket_id || !ticket_source) {
        return NextResponse.json(
          { error: 'trigger_type, ticket_id, and ticket_source are required' },
          { status: 400 }
        )
      }

      const executions = await processWorkflows(
        trigger_type,
        ticket_id,
        ticket_source,
        ticket_data || {},
        trigger_data
      )

      return NextResponse.json({
        executions,
        processed: executions.length
      })
    }

    // Action: Initialize default rules
    if (action === 'initialize') {
      await initializeWorkflowRules(user.id)
      return NextResponse.json({ success: true, message: 'Default rules initialized' })
    }

    // Action: Create from template
    if (action === 'create_from_template') {
      const { template_index, overrides } = body

      if (template_index === undefined || template_index < 0 || template_index >= WORKFLOW_TEMPLATES.length) {
        return NextResponse.json({ success: false, error: 'Invalid template index' }, { status: 400 })
      }

      const template = WORKFLOW_TEMPLATES[template_index]
      const rule = await createWorkflowRule({
        ...template,
        ...overrides,
        created_by_id: user.id
      })

      if (!rule) {
        return NextResponse.json({ success: false, error: 'Failed to create rule from template' }, { status: 500 })
      }

      return NextResponse.json({ rule })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Automation API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/automation
 * Update a workflow rule
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { rule_id, ...updates } = body

    if (!rule_id) {
      return NextResponse.json({ success: false, error: 'rule_id is required' }, { status: 400 })
    }

    const rule = await updateWorkflowRule(rule_id, updates)

    if (!rule) {
      return NextResponse.json({ success: false, error: 'Failed to update rule' }, { status: 500 })
    }

    return NextResponse.json({ rule })
  } catch (error) {
    apiLogger.error('Automation API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/automation
 * Delete a workflow rule
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('rule_id')

    if (!ruleId) {
      return NextResponse.json({ success: false, error: 'rule_id is required' }, { status: 400 })
    }

    const success = await deleteWorkflowRule(ruleId)

    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to delete rule' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Automation API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
