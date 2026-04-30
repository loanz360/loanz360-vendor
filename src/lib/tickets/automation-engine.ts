import { createClient } from '@/lib/supabase/server'

// ============================================================================
// TYPES
// ============================================================================

export type TriggerType =
  | 'ticket_created'
  | 'ticket_updated'
  | 'status_changed'
  | 'priority_changed'
  | 'assignment_changed'
  | 'sla_warning'
  | 'sla_breach'
  | 'escalation_triggered'
  | 'customer_reply'
  | 'agent_reply'
  | 'ticket_reopened'
  | 'time_based'
  | 'tag_added'
  | 'category_changed'

export type ActionType =
  | 'assign_ticket'
  | 'change_status'
  | 'change_priority'
  | 'add_tag'
  | 'remove_tag'
  | 'send_notification'
  | 'send_email'
  | 'add_internal_note'
  | 'escalate'
  | 'apply_sla_policy'
  | 'run_webhook'
  | 'update_custom_field'
  | 'auto_reply'
  | 'merge_tickets'

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'in'
  | 'not_in'
  | 'matches_regex'

export interface WorkflowCondition {
  field: string
  operator: ConditionOperator
  value: unknown; logical?: 'AND' | 'OR'
}

export interface WorkflowAction {
  type: ActionType
  config: Record<string, unknown>
  delay_seconds?: number
}

export interface WorkflowRule {
  id: string
  name: string
  description?: string
  is_active: boolean
  priority: number // Lower = higher priority
  trigger_type: TriggerType
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  sources: ('EMPLOYEE' | 'CUSTOMER' | 'PARTNER')[]
  stop_processing_rules?: boolean
  created_by_id?: string
  created_at?: string
  updated_at?: string
  execution_count?: number
  last_executed_at?: string
}

export interface WorkflowExecution {
  id: string
  rule_id: string
  ticket_id: string
  ticket_source: string
  trigger_type: TriggerType
  trigger_data: Record<string, unknown>
  actions_executed: {
    action: WorkflowAction
    success: boolean
    result?: unknown; error?: string
  }[]
  started_at: string
  completed_at?: string
  status: 'running' | 'completed' | 'failed' | 'partial'
}

export interface AutomationStats {
  total_rules: number
  active_rules: number
  total_executions: number
  successful_executions: number
  failed_executions: number
  avg_execution_time_ms: number
}

// ============================================================================
// WORKFLOW RULE MANAGEMENT
// ============================================================================

/**
 * Get all workflow rules
 */
export async function getWorkflowRules(options: {
  activeOnly?: boolean
  triggerType?: TriggerType
  source?: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
}): Promise<WorkflowRule[]> {
  const supabase = await createClient()

  let query = supabase
    .from('workflow_rules')
    .select('*')
    .order('priority', { ascending: true })

  if (options.activeOnly) {
    query = query.eq('is_active', true)
  }

  if (options.triggerType) {
    query = query.eq('trigger_type', options.triggerType)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching workflow rules:', error)
    return []
  }

  // Filter by source if specified
  if (options.source && data) {
    return data.filter(rule =>
      !rule.sources || rule.sources.length === 0 || rule.sources.includes(options.source)
    )
  }

  return data || []
}

/**
 * Create a new workflow rule
 */
export async function createWorkflowRule(rule: Omit<WorkflowRule, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowRule | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workflow_rules')
    .insert({
      ...rule,
      execution_count: 0,
      created_at: new Date().toISOString()
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error creating workflow rule:', error)
    return null
  }

  return data
}

/**
 * Update a workflow rule
 */
export async function updateWorkflowRule(
  ruleId: string,
  updates: Partial<WorkflowRule>
): Promise<WorkflowRule | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workflow_rules')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', ruleId)
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error updating workflow rule:', error)
    return null
  }

  return data
}

/**
 * Delete a workflow rule
 */
export async function deleteWorkflowRule(ruleId: string): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workflow_rules')
    .delete()
    .eq('id', ruleId)

  if (error) {
    console.error('Error deleting workflow rule:', error)
    return false
  }

  return true
}

// ============================================================================
// WORKFLOW EXECUTION
// ============================================================================

/**
 * Evaluate conditions against ticket data
 */
function evaluateConditions(
  conditions: WorkflowCondition[],
  ticketData: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return true

  let result = true
  let currentLogical: 'AND' | 'OR' = 'AND'

  for (const condition of conditions) {
    const fieldValue = getNestedValue(ticketData, condition.field)
    const conditionResult = evaluateSingleCondition(fieldValue, condition.operator, condition.value)

    if (currentLogical === 'AND') {
      result = result && conditionResult
    } else {
      result = result || conditionResult
    }

    currentLogical = condition.logical || 'AND'
  }

  return result
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

function evaluateSingleCondition(
  fieldValue: unknown,
  operator: ConditionOperator,
  conditionValue: unknown): boolean {
  const strFieldValue = String(fieldValue || '').toLowerCase()
  const strConditionValue = String(conditionValue || '').toLowerCase()

  switch (operator) {
    case 'equals':
      return strFieldValue === strConditionValue
    case 'not_equals':
      return strFieldValue !== strConditionValue
    case 'contains':
      return strFieldValue.includes(strConditionValue)
    case 'not_contains':
      return !strFieldValue.includes(strConditionValue)
    case 'starts_with':
      return strFieldValue.startsWith(strConditionValue)
    case 'ends_with':
      return strFieldValue.endsWith(strConditionValue)
    case 'greater_than':
      return Number(fieldValue) > Number(conditionValue)
    case 'less_than':
      return Number(fieldValue) < Number(conditionValue)
    case 'is_empty':
      return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0)
    case 'is_not_empty':
      return fieldValue && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0)
    case 'in':
      const inArray = Array.isArray(conditionValue) ? conditionValue : [conditionValue]
      return inArray.map(v => String(v).toLowerCase()).includes(strFieldValue)
    case 'not_in':
      const notInArray = Array.isArray(conditionValue) ? conditionValue : [conditionValue]
      return !notInArray.map(v => String(v).toLowerCase()).includes(strFieldValue)
    case 'matches_regex':
      try {
        return new RegExp(conditionValue, 'i').test(String(fieldValue))
      } catch {
        return false
      }
    default:
      return false
  }
}

/**
 * Execute a single action
 */
async function executeAction(
  action: WorkflowAction,
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  ticketData: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const supabase = await createClient()

  const tableMap = {
    EMPLOYEE: 'employee_tickets',
    CUSTOMER: 'customer_tickets',
    PARTNER: 'partner_tickets'
  }
  const tableName = tableMap[ticketSource]

  try {
    // Apply delay if specified
    if (action.delay_seconds && action.delay_seconds > 0) {
      await new Promise(resolve => setTimeout(resolve, action.delay_seconds! * 1000))
    }

    switch (action.type) {
      case 'assign_ticket': {
        const { assigned_to_id, assigned_to_name } = action.config
        const { error } = await supabase
          .from(tableName)
          .update({
            assigned_to_id,
            assigned_to_name,
            updated_at: new Date().toISOString()
          })
          .eq('id', ticketId)

        if (error) throw error
        return { success: true, result: { assigned_to_id } }
      }

      case 'change_status': {
        const { status } = action.config
        const updates: Record<string, unknown> = {
          status,
          updated_at: new Date().toISOString()
        }
        if (status === 'resolved' || status === 'closed') {
          updates.resolved_at = new Date().toISOString()
        }

        const { error } = await supabase
          .from(tableName)
          .update(updates)
          .eq('id', ticketId)

        if (error) throw error
        return { success: true, result: { status } }
      }

      case 'change_priority': {
        const { priority } = action.config
        const { error } = await supabase
          .from(tableName)
          .update({
            priority,
            updated_at: new Date().toISOString()
          })
          .eq('id', ticketId)

        if (error) throw error
        return { success: true, result: { priority } }
      }

      case 'add_tag': {
        const { tag } = action.config
        const currentTags = ticketData.tags || []
        if (!currentTags.includes(tag)) {
          const { error } = await supabase
            .from(tableName)
            .update({
              tags: [...currentTags, tag],
              updated_at: new Date().toISOString()
            })
            .eq('id', ticketId)

          if (error) throw error
        }
        return { success: true, result: { tag_added: tag } }
      }

      case 'remove_tag': {
        const { tag } = action.config
        const currentTags = ticketData.tags || []
        const { error } = await supabase
          .from(tableName)
          .update({
            tags: currentTags.filter((t: string) => t !== tag),
            updated_at: new Date().toISOString()
          })
          .eq('id', ticketId)

        if (error) throw error
        return { success: true, result: { tag_removed: tag } }
      }

      case 'send_notification': {
        const { user_ids, title, message } = action.config
        for (const userId of user_ids || []) {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'automation',
            title,
            message: message.replace('{ticket_id}', ticketId).replace('{subject}', ticketData.subject || ''),
            reference_id: ticketId,
            reference_type: 'ticket',
            created_at: new Date().toISOString()
          })
        }
        return { success: true, result: { notifications_sent: user_ids?.length || 0 } }
      }

      case 'add_internal_note': {
        const { note } = action.config
        await supabase.from('ticket_messages').insert({
          ticket_id: ticketId,
          ticket_source: ticketSource,
          message: note.replace('{ticket_id}', ticketId).replace('{subject}', ticketData.subject || ''),
          is_internal: true,
          sender_type: 'system',
          sender_name: 'Automation',
          created_at: new Date().toISOString()
        })
        return { success: true, result: { note_added: true } }
      }

      case 'escalate': {
        const { level, reason } = action.config
        await supabase.from('ticket_escalations').insert({
          ticket_id: ticketId,
          ticket_source: ticketSource,
          current_level: level || 'L2',
          trigger: 'manual',
          reason: reason || 'Automated escalation',
          status: 'pending',
          created_at: new Date().toISOString()
        })
        return { success: true, result: { escalated_to: level } }
      }

      case 'run_webhook': {
        const { url, method, headers, body } = action.config
        const response = await fetch(url, {
          method: method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify({
            ...body,
            ticket_id: ticketId,
            ticket_source: ticketSource,
            ticket_data: ticketData
          })
        })
        return {
          success: response.ok,
          result: { status: response.status, url }
        }
      }

      case 'auto_reply': {
        const { message, is_internal } = action.config
        await supabase.from('ticket_messages').insert({
          ticket_id: ticketId,
          ticket_source: ticketSource,
          message: message.replace('{ticket_id}', ticketId).replace('{subject}', ticketData.subject || ''),
          is_internal: is_internal || false,
          sender_type: 'system',
          sender_name: 'Auto-Reply',
          created_at: new Date().toISOString()
        })
        return { success: true, result: { reply_sent: true } }
      }

      case 'update_custom_field': {
        const { field, value } = action.config
        const { error } = await supabase
          .from(tableName)
          .update({
            [field]: value,
            updated_at: new Date().toISOString()
          })
          .eq('id', ticketId)

        if (error) throw error
        return { success: true, result: { field, value } }
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` }
    }
  } catch (error: unknown) {
    console.error(`Error executing action ${action.type}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Process workflow rules for a ticket event
 */
export async function processWorkflows(
  triggerType: TriggerType,
  ticketId: string,
  ticketSource: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER',
  ticketData: Record<string, unknown>,
  triggerData?: Record<string, unknown>
): Promise<WorkflowExecution[]> {
  const supabase = await createClient()

  // Get applicable rules
  const rules = await getWorkflowRules({
    activeOnly: true,
    triggerType,
    source: ticketSource
  })

  const executions: WorkflowExecution[] = []

  for (const rule of rules) {
    // Check conditions
    if (!evaluateConditions(rule.conditions, { ...ticketData, ...triggerData })) {
      continue
    }

    // Create execution record
    const execution: WorkflowExecution = {
      id: crypto.randomUUID(),
      rule_id: rule.id,
      ticket_id: ticketId,
      ticket_source: ticketSource,
      trigger_type: triggerType,
      trigger_data: triggerData || {},
      actions_executed: [],
      started_at: new Date().toISOString(),
      status: 'running'
    }

    // Execute actions
    let allSuccess = true
    let anySuccess = false

    for (const action of rule.actions) {
      const result = await executeAction(action, ticketId, ticketSource, ticketData)
      execution.actions_executed.push({
        action,
        success: result.success,
        result: result.result,
        error: result.error
      })

      if (result.success) anySuccess = true
      else allSuccess = false
    }

    // Update execution status
    execution.completed_at = new Date().toISOString()
    execution.status = allSuccess ? 'completed' : anySuccess ? 'partial' : 'failed'

    // Save execution record
    await supabase.from('workflow_executions').insert({
      ...execution,
      actions_executed: JSON.stringify(execution.actions_executed)
    })

    // Update rule execution count
    await supabase
      .from('workflow_rules')
      .update({
        execution_count: (rule.execution_count || 0) + 1,
        last_executed_at: new Date().toISOString()
      })
      .eq('id', rule.id)

    executions.push(execution)

    // Stop processing if rule says so
    if (rule.stop_processing_rules) break
  }

  return executions
}

// ============================================================================
// PREDEFINED WORKFLOW TEMPLATES
// ============================================================================

export const WORKFLOW_TEMPLATES: Omit<WorkflowRule, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Auto-assign urgent tickets',
    description: 'Automatically assign urgent tickets to available senior agents',
    is_active: true,
    priority: 1,
    trigger_type: 'ticket_created',
    conditions: [
      { field: 'priority', operator: 'equals', value: 'urgent' }
    ],
    actions: [
      { type: 'add_tag', config: { tag: 'urgent-auto-assigned' } },
      { type: 'send_notification', config: {
        user_ids: ['supervisor'],
        title: 'Urgent Ticket Created',
        message: 'Urgent ticket #{ticket_id} needs attention: {subject}'
      }}
    ],
    sources: ['EMPLOYEE', 'CUSTOMER', 'PARTNER']
  },
  {
    name: 'SLA Warning Notification',
    description: 'Notify when SLA is about to breach',
    is_active: true,
    priority: 2,
    trigger_type: 'sla_warning',
    conditions: [],
    actions: [
      { type: 'send_notification', config: {
        user_ids: ['assigned_agent', 'supervisor'],
        title: 'SLA Warning',
        message: 'Ticket #{ticket_id} is approaching SLA deadline'
      }},
      { type: 'add_tag', config: { tag: 'sla-at-risk' } }
    ],
    sources: ['EMPLOYEE', 'CUSTOMER', 'PARTNER']
  },
  {
    name: 'Auto-escalate SLA breaches',
    description: 'Automatically escalate tickets that breach SLA',
    is_active: true,
    priority: 3,
    trigger_type: 'sla_breach',
    conditions: [],
    actions: [
      { type: 'escalate', config: { level: 'L2', reason: 'SLA breach - automatic escalation' } },
      { type: 'add_tag', config: { tag: 'sla-breached' } },
      { type: 'change_priority', config: { priority: 'high' } }
    ],
    sources: ['EMPLOYEE', 'CUSTOMER', 'PARTNER']
  },
  {
    name: 'Customer reply notification',
    description: 'Notify agent when customer replies',
    is_active: true,
    priority: 4,
    trigger_type: 'customer_reply',
    conditions: [],
    actions: [
      { type: 'send_notification', config: {
        user_ids: ['assigned_agent'],
        title: 'Customer Reply',
        message: 'Customer has replied to ticket #{ticket_id}'
      }},
      { type: 'change_status', config: { status: 'open' } }
    ],
    sources: ['CUSTOMER', 'PARTNER']
  },
  {
    name: 'Auto-close resolved tickets',
    description: 'Automatically close tickets 48 hours after resolution',
    is_active: true,
    priority: 10,
    trigger_type: 'time_based',
    conditions: [
      { field: 'status', operator: 'equals', value: 'resolved' },
      { field: 'hours_since_resolved', operator: 'greater_than', value: 48, logical: 'AND' }
    ],
    actions: [
      { type: 'change_status', config: { status: 'closed' } },
      { type: 'add_internal_note', config: {
        note: 'Ticket automatically closed after 48 hours with no customer response'
      }}
    ],
    sources: ['EMPLOYEE', 'CUSTOMER', 'PARTNER']
  },
  {
    name: 'Tag payment issues',
    description: 'Auto-tag tickets mentioning payment problems',
    is_active: true,
    priority: 5,
    trigger_type: 'ticket_created',
    conditions: [
      { field: 'subject', operator: 'contains', value: 'payment' },
      { field: 'description', operator: 'contains', value: 'emi', logical: 'OR' }
    ],
    actions: [
      { type: 'add_tag', config: { tag: 'payment-issue' } },
      { type: 'change_priority', config: { priority: 'high' } }
    ],
    sources: ['CUSTOMER']
  }
]

/**
 * Initialize default workflow rules
 */
export async function initializeWorkflowRules(userId: string): Promise<void> {
  const supabase = await createClient()

  // Check if rules exist
  const { count } = await supabase
    .from('workflow_rules')
    .select('id', { count: 'exact', head: true })

  if (count && count > 0) return

  // Insert templates
  for (const template of WORKFLOW_TEMPLATES) {
    await createWorkflowRule({
      ...template,
      created_by_id: userId
    })
  }
}

/**
 * Get automation statistics
 */
export async function getAutomationStats(): Promise<AutomationStats> {
  const supabase = await createClient()

  // Get rule counts
  const { data: rules } = await supabase
    .from('workflow_rules')
    .select('id, is_active')

  const totalRules = rules?.length || 0
  const activeRules = rules?.filter(r => r.is_active).length || 0

  // Get execution stats
  const { data: executions } = await supabase
    .from('workflow_executions')
    .select('status, started_at, completed_at')

  const totalExecutions = executions?.length || 0
  const successfulExecutions = executions?.filter(e => e.status === 'completed').length || 0
  const failedExecutions = executions?.filter(e => e.status === 'failed').length || 0

  // Calculate avg execution time
  let totalTime = 0
  let timeCount = 0
  executions?.forEach(e => {
    if (e.started_at && e.completed_at) {
      totalTime += new Date(e.completed_at).getTime() - new Date(e.started_at).getTime()
      timeCount++
    }
  })

  return {
    total_rules: totalRules,
    active_rules: activeRules,
    total_executions: totalExecutions,
    successful_executions: successfulExecutions,
    failed_executions: failedExecutions,
    avg_execution_time_ms: timeCount > 0 ? Math.round(totalTime / timeCount) : 0
  }
}

/**
 * Get workflow execution history
 */
export async function getWorkflowExecutions(options: {
  ruleId?: string
  ticketId?: string
  status?: 'running' | 'completed' | 'failed' | 'partial'
  limit?: number
}): Promise<WorkflowExecution[]> {
  const supabase = await createClient()

  let query = supabase
    .from('workflow_executions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(options.limit || 50)

  if (options.ruleId) {
    query = query.eq('rule_id', options.ruleId)
  }

  if (options.ticketId) {
    query = query.eq('ticket_id', options.ticketId)
  }

  if (options.status) {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching workflow executions:', error)
    return []
  }

  return data?.map(e => ({
    ...e,
    actions_executed: typeof e.actions_executed === 'string'
      ? JSON.parse(e.actions_executed)
      : e.actions_executed
  })) || []
}
