import { createClient } from '@/lib/supabase/server'

export type WorkflowStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ESCALATED'

export interface WorkflowStep {
  step_number: number
  approver_role: string
  approver_id?: string
  status: WorkflowStatus
  action_date?: string
  remarks?: string
}

export interface WorkflowDefinition {
  name: string
  module: string
  steps: Array<{
    step_number: number
    approver_role: string
    auto_approve_after_days?: number
    can_skip?: boolean
  }>
  on_complete?: 'auto_execute' | 'notify_requester'
  escalation_after_days?: number
}

// Pre-defined workflows for common HR processes
export const WORKFLOW_DEFINITIONS: Record<string, WorkflowDefinition> = {
  LEAVE_REQUEST: {
    name: 'Leave Request Approval',
    module: 'LEAVES',
    steps: [
      { step_number: 1, approver_role: 'reporting_manager' },
      { step_number: 2, approver_role: 'hr_manager', can_skip: true },
    ],
    on_complete: 'auto_execute',
    escalation_after_days: 3,
  },
  RESIGNATION: {
    name: 'Resignation Process',
    module: 'RESIGNATIONS',
    steps: [
      { step_number: 1, approver_role: 'reporting_manager' },
      { step_number: 2, approver_role: 'hr_manager' },
      { step_number: 3, approver_role: 'department_head' },
    ],
    on_complete: 'notify_requester',
    escalation_after_days: 5,
  },
  PAYROLL_RUN: {
    name: 'Payroll Run Approval',
    module: 'PAYROLL',
    steps: [
      { step_number: 1, approver_role: 'hr_manager' },
      { step_number: 2, approver_role: 'finance_manager' },
      { step_number: 3, approver_role: 'admin', can_skip: true },
    ],
    on_complete: 'auto_execute',
    escalation_after_days: 2,
  },
  REIMBURSEMENT: {
    name: 'Reimbursement Claim',
    module: 'PAYROLL',
    steps: [
      { step_number: 1, approver_role: 'reporting_manager' },
      { step_number: 2, approver_role: 'finance_executive' },
    ],
    on_complete: 'auto_execute',
    escalation_after_days: 5,
  },
  PIP: {
    name: 'PIP Initiation',
    module: 'PIP',
    steps: [
      { step_number: 1, approver_role: 'hr_manager' },
      { step_number: 2, approver_role: 'department_head' },
    ],
    on_complete: 'notify_requester',
    escalation_after_days: 3,
  },
}

export class WorkflowEngine {
  /**
   * Start a new workflow instance
   */
  static async initiate(params: {
    workflow_type: keyof typeof WORKFLOW_DEFINITIONS
    entity_id: string
    requester_id: string
    metadata?: Record<string, unknown>
  }): Promise<{ workflow_id: string; current_step: number }> {
    const definition = WORKFLOW_DEFINITIONS[params.workflow_type]
    if (!definition) throw new Error(`Unknown workflow type: ${params.workflow_type}`)

    const supabase = await createClient()

    const workflowData = {
      workflow_type: params.workflow_type,
      entity_id: params.entity_id,
      requester_id: params.requester_id,
      definition_name: definition.name,
      module: definition.module,
      current_step: 1,
      total_steps: definition.steps.length,
      status: 'IN_PROGRESS' as WorkflowStatus,
      steps: definition.steps.map(s => ({
        ...s,
        status: 'PENDING' as WorkflowStatus,
        action_date: null,
        remarks: null,
        approver_id: null,
      })),
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('workflow_instances')
      .insert(workflowData)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[WorkflowEngine] Failed to initiate workflow:', error)
      throw new Error('Failed to initiate approval workflow')
    }

    return { workflow_id: data.id, current_step: 1 }
  }

  /**
   * Process an approval/rejection action on a workflow step
   */
  static async processAction(params: {
    workflow_id: string
    approver_id: string
    action: 'APPROVE' | 'REJECT'
    remarks?: string
  }): Promise<{ status: WorkflowStatus; next_step?: number; completed: boolean }> {
    const supabase = await createClient()

    const { data: workflow, error } = await supabase
      .from('workflow_instances')
      .select('*')
      .eq('id', params.workflow_id)
      .maybeSingle()

    if (error || !workflow) throw new Error('Workflow not found')
    if (workflow.status !== 'IN_PROGRESS') throw new Error(`Workflow is already ${workflow.status}`)

    const steps = workflow.steps as WorkflowStep[]
    const currentStep = steps[workflow.current_step - 1]
    if (!currentStep) throw new Error('Invalid workflow step')

    // Update current step
    currentStep.status = params.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    currentStep.approver_id = params.approver_id
    currentStep.action_date = new Date().toISOString()
    currentStep.remarks = params.remarks || null

    if (params.action === 'REJECT') {
      // Rejection ends the workflow
      await supabase
        .from('workflow_instances')
        .update({ status: 'REJECTED', steps, completed_at: new Date().toISOString() })
        .eq('id', params.workflow_id)

      return { status: 'REJECTED', completed: true }
    }

    // Check if there are more steps
    const nextStepNum = workflow.current_step + 1
    if (nextStepNum > workflow.total_steps) {
      // All steps approved - workflow complete
      await supabase
        .from('workflow_instances')
        .update({ status: 'APPROVED', steps, current_step: workflow.total_steps, completed_at: new Date().toISOString() })
        .eq('id', params.workflow_id)

      return { status: 'APPROVED', completed: true }
    }

    // Move to next step
    const definition = WORKFLOW_DEFINITIONS[workflow.workflow_type as keyof typeof WORKFLOW_DEFINITIONS]
    const nextStepDef = definition?.steps.find(s => s.step_number === nextStepNum)

    // Skip optional steps if configured
    if (nextStepDef?.can_skip) {
      // For now, don't auto-skip - let the approver decide
    }

    await supabase
      .from('workflow_instances')
      .update({ steps, current_step: nextStepNum })
      .eq('id', params.workflow_id)

    return { status: 'IN_PROGRESS', next_step: nextStepNum, completed: false }
  }

  /**
   * Cancel a workflow
   */
  static async cancel(workflow_id: string, cancelled_by: string): Promise<void> {
    const supabase = await createClient()
    await supabase
      .from('workflow_instances')
      .update({
        status: 'CANCELLED',
        completed_at: new Date().toISOString(),
        metadata: { cancelled_by, cancelled_at: new Date().toISOString() }
      })
      .eq('id', workflow_id)
      .eq('status', 'IN_PROGRESS')
  }

  /**
   * Get workflow status for an entity
   */
  static async getStatus(entity_id: string, workflow_type?: string): Promise<{
    workflow_id: string
    status: WorkflowStatus
    current_step: number
    total_steps: number
    steps: WorkflowStep[]
  } | null> {
    const supabase = await createClient()
    let query = supabase
      .from('workflow_instances')
      .select('*')
      .eq('entity_id', entity_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (workflow_type) {
      query = query.eq('workflow_type', workflow_type)
    }

    const { data } = await query.maybeSingle()
    if (!data) return null

    return {
      workflow_id: data.id,
      status: data.status,
      current_step: data.current_step,
      total_steps: data.total_steps,
      steps: data.steps as WorkflowStep[],
    }
  }
}
