import { createClient } from '@supabase/supabase-js'

// ============================================================================
// WORKFLOW AUTOMATION SERVICE
// Enterprise ticket workflow automation engine
// Phase 4: Fortune 500 Features
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// TYPES
// ============================================================================

export type TriggerType =
  | 'ticket_created'
  | 'ticket_updated'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned'
  | 'message_received'
  | 'sla_warning'
  | 'sla_breach'
  | 'time_elapsed'
  | 'tag_added'

export type ActionType =
  | 'assign_to_agent'
  | 'assign_to_department'
  | 'change_status'
  | 'change_priority'
  | 'add_tag'
  | 'remove_tag'
  | 'send_notification'
  | 'send_email'
  | 'add_internal_note'
  | 'escalate'
  | 'apply_template'
  | 'webhook'
  | 'set_sla'

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty'
  | 'regex'

export interface WorkflowCondition {
  field: string
  operator: ConditionOperator
  value: unknown}

export interface WorkflowAction {
  type: ActionType
  params: Record<string, unknown>
  delay_minutes?: number
}

export interface WorkflowRule {
  id: string
  name: string
  description?: string
  ticket_source: 'employee' | 'customer' | 'partner' | 'all'
  trigger: TriggerType
  conditions: WorkflowCondition[]
  condition_logic: 'AND' | 'OR'
  actions: WorkflowAction[]
  is_active: boolean
  priority: number
  created_by: string
  created_at: string
  updated_at: string
  execution_count: number
  last_executed_at?: string
}

export interface WorkflowExecutionLog {
  id: string
  rule_id: string
  ticket_id: string
  trigger_type: TriggerType
  conditions_met: boolean
  actions_executed: string[]
  execution_time_ms: number
  success: boolean
  error_message?: string
  created_at: string
}

export interface WorkflowExecutionResult {
  success: boolean
  rulesEvaluated: number
  rulesMatched: number
  actionsExecuted: number
  errors: string[]
  executionLog: WorkflowExecutionLog[]
}

// ============================================================================
// WORKFLOW ENGINE CLASS
// ============================================================================

export class WorkflowAutomationService {
  private rulesCache: Map<string, WorkflowRule[]> = new Map()
  private cacheExpiry: number = 0
  private cacheTTL = 60 * 1000 // 1 minute

  // ============================================================================
  // RULE MANAGEMENT
  // ============================================================================

  /**
   * Get all active rules for a ticket source
   */
  async getActiveRules(
    ticketSource: 'employee' | 'customer' | 'partner',
    trigger: TriggerType
  ): Promise<WorkflowRule[]> {
    const cacheKey = `${ticketSource}:${trigger}`

    if (this.rulesCache.has(cacheKey) && Date.now() < this.cacheExpiry) {
      return this.rulesCache.get(cacheKey)!
    }

    const { data: rules } = await supabase
      .from('workflow_rules')
      .select('*')
      .or(`ticket_source.eq.${ticketSource},ticket_source.eq.all`)
      .eq('trigger', trigger)
      .eq('is_active', true)
      .order('priority', { ascending: true })

    const result = rules || []
    this.rulesCache.set(cacheKey, result)
    this.cacheExpiry = Date.now() + this.cacheTTL

    return result
  }

  /**
   * Create a new workflow rule
   */
  async createRule(rule: Omit<WorkflowRule, 'id' | 'created_at' | 'updated_at' | 'execution_count'>): Promise<{
    success: boolean
    rule?: WorkflowRule
    error?: string
  }> {
    try {
      const { data, error } = await supabase
        .from('workflow_rules')
        .insert({
          ...rule,
          execution_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .maybeSingle()

      if (error) throw error

      this.invalidateCache()
      return { success: true, rule: data }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Update an existing rule
   */
  async updateRule(ruleId: string, updates: Partial<WorkflowRule>): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const { error } = await supabase
        .from('workflow_rules')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', ruleId)

      if (error) throw error

      this.invalidateCache()
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('workflow_rules')
        .delete()
        .eq('id', ruleId)

      if (error) throw error

      this.invalidateCache()
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  // ============================================================================
  // RULE EXECUTION
  // ============================================================================

  /**
   * Execute workflows for a trigger event
   */
  async executeWorkflows(
    ticketSource: 'employee' | 'customer' | 'partner',
    trigger: TriggerType,
    ticket: unknown,
    context: Record<string, unknown> = {}
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now()
    const result: WorkflowExecutionResult = {
      success: true,
      rulesEvaluated: 0,
      rulesMatched: 0,
      actionsExecuted: 0,
      errors: [],
      executionLog: []
    }

    try {
      const rules = await this.getActiveRules(ticketSource, trigger)
      result.rulesEvaluated = rules.length

      for (const rule of rules) {
        const ruleStartTime = Date.now()
        const executionLog: WorkflowExecutionLog = {
          id: crypto.randomUUID(),
          rule_id: rule.id,
          ticket_id: ticket.id,
          trigger_type: trigger,
          conditions_met: false,
          actions_executed: [],
          execution_time_ms: 0,
          success: false,
          created_at: new Date().toISOString()
        }

        try {
          // Evaluate conditions
          const conditionsMet = this.evaluateConditions(
            rule.conditions,
            rule.condition_logic,
            ticket,
            context
          )

          executionLog.conditions_met = conditionsMet

          if (conditionsMet) {
            result.rulesMatched++

            // Execute actions
            for (const action of rule.actions) {
              try {
                await this.executeAction(action, ticket, ticketSource, context)
                executionLog.actions_executed.push(action.type)
                result.actionsExecuted++
              } catch (actionError: unknown) {
                result.errors.push(`Action ${action.type} failed: ${actionError instanceof Error ? actionError.message : String(actionError)}`)
              }
            }

            // Update rule execution stats
            await this.updateRuleStats(rule.id)
          }

          executionLog.success = true
        } catch (ruleError: unknown) {
          executionLog.success = false
          executionLog.error_message = (ruleError instanceof Error ? ruleError.message : String(ruleError))
          result.errors.push(`Rule ${rule.name} failed: ${ruleError instanceof Error ? ruleError.message : String(ruleError)}`)
        }

        executionLog.execution_time_ms = Date.now() - ruleStartTime
        result.executionLog.push(executionLog)

        // Log execution
        await this.logExecution(executionLog)
      }
    } catch (error: unknown) {
      result.success = false
      result.errors.push(`Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    return result
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateConditions(
    conditions: WorkflowCondition[],
    logic: 'AND' | 'OR',
    ticket: unknown,
    context: Record<string, unknown>
  ): boolean {
    if (conditions.length === 0) return true

    const results = conditions.map(condition =>
      this.evaluateCondition(condition, ticket, context)
    )

    return logic === 'AND'
      ? results.every(r => r)
      : results.some(r => r)
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: WorkflowCondition,
    ticket: unknown,
    context: Record<string, unknown>
  ): boolean {
    const fieldValue = this.getFieldValue(condition.field, ticket, context)
    const compareValue = condition.value

    switch (condition.operator) {
      case 'equals':
        return fieldValue === compareValue

      case 'not_equals':
        return fieldValue !== compareValue

      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase())

      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase())

      case 'starts_with':
        return String(fieldValue).toLowerCase().startsWith(String(compareValue).toLowerCase())

      case 'ends_with':
        return String(fieldValue).toLowerCase().endsWith(String(compareValue).toLowerCase())

      case 'greater_than':
        return Number(fieldValue) > Number(compareValue)

      case 'less_than':
        return Number(fieldValue) < Number(compareValue)

      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(fieldValue)

      case 'not_in':
        return Array.isArray(compareValue) && !compareValue.includes(fieldValue)

      case 'is_empty':
        return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0)

      case 'is_not_empty':
        return fieldValue && fieldValue !== '' && !(Array.isArray(fieldValue) && fieldValue.length === 0)

      case 'regex':
        try {
          return new RegExp(compareValue, 'i').test(String(fieldValue))
        } catch {
          return false
        }

      default:
        return false
    }
  }

  /**
   * Get field value from ticket or context
   */
  private getFieldValue(field: string, ticket: unknown, context: Record<string, unknown>): unknown {
    // Check context first
    if (field.startsWith('context.')) {
      const contextField = field.replace('context.', '')
      return context[contextField]
    }

    // Handle nested fields
    const parts = field.split('.')
    let value = ticket

    for (const part of parts) {
      if (value === null || value === undefined) return undefined
      value = value[part]
    }

    return value
  }

  // ============================================================================
  // ACTION EXECUTION
  // ============================================================================

  /**
   * Execute a workflow action
   */
  private async executeAction(
    action: WorkflowAction,
    ticket: unknown,
    ticketSource: 'employee' | 'customer' | 'partner',
    context: Record<string, unknown>
  ): Promise<void> {
    // Handle delay if specified
    if (action.delay_minutes && action.delay_minutes > 0) {
      await this.scheduleDelayedAction(action, ticket, ticketSource, context)
      return
    }

    const tableName = ticketSource === 'employee'
      ? 'support_tickets'
      : ticketSource === 'customer'
      ? 'customer_support_tickets'
      : 'partner_support_tickets'

    switch (action.type) {
      case 'assign_to_agent':
        await supabase
          .from(tableName)
          .update({ assigned_agent_id: action.params.agent_id })
          .eq('id', ticket.id)
        break

      case 'assign_to_department':
        await supabase
          .from(tableName)
          .update({ assigned_to: action.params.department })
          .eq('id', ticket.id)
        break

      case 'change_status':
        await supabase
          .from(tableName)
          .update({ status: action.params.status })
          .eq('id', ticket.id)
        break

      case 'change_priority':
        await supabase
          .from(tableName)
          .update({ priority: action.params.priority })
          .eq('id', ticket.id)
        break

      case 'add_tag':
        const currentTags = ticket.tags || []
        if (!currentTags.includes(action.params.tag)) {
          await supabase
            .from(tableName)
            .update({ tags: [...currentTags, action.params.tag] })
            .eq('id', ticket.id)
        }
        break

      case 'remove_tag':
        const existingTags = ticket.tags || []
        await supabase
          .from(tableName)
          .update({ tags: existingTags.filter((t: string) => t !== action.params.tag) })
          .eq('id', ticket.id)
        break

      case 'send_notification':
        await this.sendNotification(action.params, ticket, ticketSource)
        break

      case 'send_email':
        await this.sendEmail(action.params, ticket)
        break

      case 'add_internal_note':
        await this.addInternalNote(action.params.note, ticket, ticketSource)
        break

      case 'escalate':
        await this.escalateTicket(ticket, ticketSource, action.params)
        break

      case 'apply_template':
        await this.applyTemplate(action.params.template_id, ticket, ticketSource)
        break

      case 'webhook':
        await this.executeWebhook(action.params, ticket)
        break

      case 'set_sla':
        await supabase
          .from(tableName)
          .update({
            sla_policy_id: action.params.policy_id,
            sla_response_deadline: action.params.response_deadline,
            sla_resolution_deadline: action.params.resolution_deadline
          })
          .eq('id', ticket.id)
        break

      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }
  }

  /**
   * Schedule a delayed action
   */
  private async scheduleDelayedAction(
    action: WorkflowAction,
    ticket: unknown,
    ticketSource: string,
    context: Record<string, unknown>
  ): Promise<void> {
    const executeAt = new Date(Date.now() + (action.delay_minutes! * 60 * 1000))

    await supabase
      .from('scheduled_workflow_actions')
      .insert({
        action: action,
        ticket_id: ticket.id,
        ticket_source: ticketSource,
        context: context,
        execute_at: executeAt.toISOString(),
        status: 'pending'
      })
  }

  /**
   * Send notification
   */
  private async sendNotification(
    params: Record<string, unknown>,
    ticket: unknown,
    ticketSource: string
  ): Promise<void> {
    await supabase
      .from('notifications')
      .insert({
        user_id: params.user_id || ticket.assigned_agent_id,
        type: 'workflow_notification',
        title: params.title || 'Workflow Notification',
        message: this.interpolateTemplate(params.message, ticket),
        data: { ticket_id: ticket.id, ticket_source: ticketSource },
        read: false
      })
  }

  /**
   * Send email
   */
  private async sendEmail(params: Record<string, unknown>, ticket: unknown): Promise<void> {
    await supabase
      .from('email_queue')
      .insert({
        to_email: params.to || ticket.email,
        subject: this.interpolateTemplate(params.subject, ticket),
        body: this.interpolateTemplate(params.body, ticket),
        template_id: params.template_id,
        status: 'pending'
      })
  }

  /**
   * Add internal note
   */
  private async addInternalNote(
    note: string,
    ticket: unknown,
    ticketSource: string
  ): Promise<void> {
    const messageTable = ticketSource === 'employee'
      ? 'support_ticket_messages'
      : ticketSource === 'customer'
      ? 'customer_support_messages'
      : 'partner_support_messages'

    await supabase
      .from(messageTable)
      .insert({
        ticket_id: ticket.id,
        content: this.interpolateTemplate(note, ticket),
        sender_type: 'system',
        is_internal: true
      })
  }

  /**
   * Escalate ticket
   */
  private async escalateTicket(
    ticket: unknown,
    ticketSource: string,
    params: Record<string, unknown>
  ): Promise<void> {
    const tableName = ticketSource === 'employee'
      ? 'support_tickets'
      : ticketSource === 'customer'
      ? 'customer_support_tickets'
      : 'partner_support_tickets'

    await supabase
      .from(tableName)
      .update({
        status: 'escalated',
        escalation_level: (ticket.escalation_level || 0) + 1,
        escalated_to: params.department || 'management',
        escalated_at: new Date().toISOString()
      })
      .eq('id', ticket.id)

    // Add escalation note
    await this.addInternalNote(
      `Ticket automatically escalated to ${params.department || 'management'}. Reason: ${params.reason || 'Workflow automation'}`,
      ticket,
      ticketSource
    )
  }

  /**
   * Apply canned response template
   */
  private async applyTemplate(
    templateId: string,
    ticket: unknown,
    ticketSource: string
  ): Promise<void> {
    const { data: template } = await supabase
      .from('canned_responses')
      .select('*')
      .eq('id', templateId)
      .maybeSingle()

    if (template) {
      const messageTable = ticketSource === 'employee'
        ? 'support_ticket_messages'
        : ticketSource === 'customer'
        ? 'customer_support_messages'
        : 'partner_support_messages'

      await supabase
        .from(messageTable)
        .insert({
          ticket_id: ticket.id,
          content: this.interpolateTemplate(template.content, ticket),
          sender_type: 'system',
          is_internal: false
        })
    }
  }

  /**
   * Execute webhook
   */
  private async executeWebhook(
    params: Record<string, unknown>,
    ticket: unknown  ): Promise<void> {
    try {
      const response = await fetch(params.url, {
        method: params.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(params.headers || {})
        },
        body: JSON.stringify({
          event: 'workflow_triggered',
          ticket: ticket,
          custom_data: params.data
        })
      })

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`)
      }
    } catch (error: unknown) {
      console.error('Webhook execution error:', error)
      throw error
    }
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(template: string, ticket: unknown): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return ticket[key] ?? match
    })
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Update rule execution statistics
   */
  private async updateRuleStats(ruleId: string): Promise<void> {
    await supabase
      .from('workflow_rules')
      .update({
        execution_count: supabase.rpc('increment', { row_id: ruleId }),
        last_executed_at: new Date().toISOString()
      })
      .eq('id', ruleId)
  }

  /**
   * Log workflow execution
   */
  private async logExecution(log: WorkflowExecutionLog): Promise<void> {
    await supabase
      .from('workflow_execution_logs')
      .insert(log)
  }

  /**
   * Invalidate rules cache
   */
  invalidateCache(): void {
    this.rulesCache.clear()
    this.cacheExpiry = 0
  }

  /**
   * Get rule execution history
   */
  async getRuleExecutionHistory(
    ruleId: string,
    limit: number = 50
  ): Promise<WorkflowExecutionLog[]> {
    const { data } = await supabase
      .from('workflow_execution_logs')
      .select('*')
      .eq('rule_id', ruleId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return data || []
  }

  /**
   * Get workflow analytics
   */
  async getWorkflowAnalytics(
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    totalExecutions: number
    successRate: number
    topRules: Array<{ rule_id: string; rule_name: string; executions: number }>
    actionBreakdown: Record<string, number>
  }> {
    const { data: logs } = await supabase
      .from('workflow_execution_logs')
      .select('*')
      .gte('created_at', dateFrom.toISOString())
      .lte('created_at', dateTo.toISOString())

    if (!logs?.length) {
      return {
        totalExecutions: 0,
        successRate: 0,
        topRules: [],
        actionBreakdown: {}
      }
    }

    const successCount = logs.filter(l => l.success).length
    const ruleExecutions = new Map<string, number>()
    const actionCounts: Record<string, number> = {}

    for (const log of logs) {
      ruleExecutions.set(log.rule_id, (ruleExecutions.get(log.rule_id) || 0) + 1)

      for (const action of log.actions_executed) {
        actionCounts[action] = (actionCounts[action] || 0) + 1
      }
    }

    // Get rule names
    const ruleIds = [...ruleExecutions.keys()]
    const { data: rules } = await supabase
      .from('workflow_rules')
      .select('id, name')
      .in('id', ruleIds)

    const ruleNameMap = new Map(rules?.map(r => [r.id, r.name]) || [])

    return {
      totalExecutions: logs.length,
      successRate: (successCount / logs.length) * 100,
      topRules: [...ruleExecutions.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, count]) => ({
          rule_id: id,
          rule_name: ruleNameMap.get(id) || 'Unknown',
          executions: count
        })),
      actionBreakdown: actionCounts
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

let workflowService: WorkflowAutomationService | null = null

export function getWorkflowService(): WorkflowAutomationService {
  if (!workflowService) {
    workflowService = new WorkflowAutomationService()
  }
  return workflowService
}

// Helper functions
export async function executeWorkflows(
  ticketSource: 'employee' | 'customer' | 'partner',
  trigger: TriggerType,
  ticket: unknown,
  context?: Record<string, unknown>
) {
  return getWorkflowService().executeWorkflows(ticketSource, trigger, ticket, context)
}

export async function createWorkflowRule(
  rule: Omit<WorkflowRule, 'id' | 'created_at' | 'updated_at' | 'execution_count'>
) {
  return getWorkflowService().createRule(rule)
}

// Pre-defined workflow templates
export const WORKFLOW_TEMPLATES = {
  AUTO_ASSIGN_BY_CATEGORY: {
    name: 'Auto-assign by Category',
    trigger: 'ticket_created' as TriggerType,
    conditions: [],
    condition_logic: 'AND' as const,
    actions: [
      {
        type: 'assign_to_department' as ActionType,
        params: { department: '{{category}}' }
      }
    ]
  },
  ESCALATE_HIGH_PRIORITY: {
    name: 'Escalate High Priority After 1 Hour',
    trigger: 'time_elapsed' as TriggerType,
    conditions: [
      { field: 'priority', operator: 'in' as ConditionOperator, value: ['urgent', 'critical'] },
      { field: 'status', operator: 'equals' as ConditionOperator, value: 'open' }
    ],
    condition_logic: 'AND' as const,
    actions: [
      {
        type: 'escalate' as ActionType,
        params: { department: 'management', reason: 'High priority ticket unassigned for 1 hour' },
        delay_minutes: 60
      }
    ]
  },
  SLA_BREACH_NOTIFICATION: {
    name: 'SLA Breach Notification',
    trigger: 'sla_breach' as TriggerType,
    conditions: [],
    condition_logic: 'AND' as const,
    actions: [
      {
        type: 'send_notification' as ActionType,
        params: {
          title: 'SLA Breach Alert',
          message: 'Ticket {{ticket_number}} has breached SLA'
        }
      },
      {
        type: 'add_tag' as ActionType,
        params: { tag: 'sla-breached' }
      }
    ]
  }
}
