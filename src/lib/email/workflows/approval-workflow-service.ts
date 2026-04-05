/**
 * Email Approval Workflow Engine
 * Enterprise-grade multi-step approval workflow system
 *
 * Features:
 * - Configurable multi-step approval chains
 * - Auto-approve/deny timeout handling
 * - Notification integration
 * - Full audit trail
 * - Role-based approver resolution
 */

import { createSupabaseAdmin } from '@/lib/supabase/server';
import {
  getAccountLifecycleService,
  type CreateAccountParams,
} from '@/lib/email/lifecycle/account-lifecycle-service';

// ============================================================================
// TYPES
// ============================================================================

export type WorkflowType =
  | 'account_creation'
  | 'quota_increase'
  | 'external_access'
  | 'offboarding'
  | 'delegation_request'
  | 'shared_mailbox_access'
  | 'alias_creation'
  | 'distribution_list_creation';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'cancelled'
  | 'expired';

export type ApproverType =
  | 'manager'
  | 'department_head'
  | 'email_admin'
  | 'hr_admin'
  | 'security_admin'
  | 'super_admin'
  | 'specific_user';

export interface ApprovalStep {
  step: number;
  approverType: ApproverType;
  specificUserId?: string; // For specific_user type
  timeoutHours?: number;
  autoApproveOnTimeout?: boolean;
  required?: boolean; // If false, can be skipped if not available
}

export interface ApprovalChain {
  steps: ApprovalStep[];
  requireAllApprovers: boolean;
  parallelApproval?: boolean; // All steps can approve in parallel
}

export interface WorkflowDefinition {
  id: string;
  workflowName: string;
  workflowType: WorkflowType;
  description?: string;
  approvalChain: ApprovalChain;
  triggerConditions?: Record<string, unknown>;
  autoApproveTimeoutHours?: number;
  autoDenyTimeoutHours?: number;
  notifyOnSubmit: boolean;
  notifyOnApprove: boolean;
  notifyOnDeny: boolean;
  isActive: boolean;
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  requestType: WorkflowType;
  requesterId: string;
  targetAccountId?: string;
  requestData: Record<string, unknown>;
  status: ApprovalStatus;
  currentStep: number;
  approvalHistory: ApprovalHistoryEntry[];
  submittedAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
  requesterNotes?: string;
  finalNotes?: string;
}

export interface ApprovalHistoryEntry {
  step: number;
  approverId: string;
  approverName?: string;
  action: 'approved' | 'denied' | 'delegated';
  timestamp: Date;
  notes?: string;
  delegatedTo?: string;
}

export interface CreateWorkflowParams {
  workflowName: string;
  workflowType: WorkflowType;
  description?: string;
  approvalChain: ApprovalChain;
  triggerConditions?: Record<string, unknown>;
  autoApproveTimeoutHours?: number;
  autoDenyTimeoutHours?: number;
}

export interface SubmitRequestParams {
  requestType: WorkflowType;
  requestData: Record<string, unknown>;
  targetAccountId?: string;
  requesterNotes?: string;
}

export interface ProcessApprovalParams {
  requestId: string;
  approverId: string;
  action: 'approve' | 'deny';
  notes?: string;
}

// ============================================================================
// APPROVAL WORKFLOW SERVICE
// ============================================================================

export class ApprovalWorkflowService {
  private supabase = createSupabaseAdmin();
  private lifecycleService = getAccountLifecycleService();

  // ============================================================================
  // WORKFLOW MANAGEMENT
  // ============================================================================

  /**
   * Create a new approval workflow definition
   */
  async createWorkflow(
    params: CreateWorkflowParams,
    createdBy: string
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Validate approval chain
      if (!params.approvalChain.steps || params.approvalChain.steps.length === 0) {
        return { success: false, error: 'Approval chain must have at least one step' };
      }

      const { data, error } = await this.supabase
        .from('email_approval_workflows')
        .insert({
          workflow_name: params.workflowName,
          workflow_type: params.workflowType,
          description: params.description,
          approval_chain: params.approvalChain,
          trigger_conditions: params.triggerConditions || {},
          auto_approve_timeout_hours: params.autoApproveTimeoutHours,
          auto_deny_timeout_hours: params.autoDenyTimeoutHours,
          notify_on_submit: true,
          notify_on_approve: true,
          notify_on_deny: true,
          is_active: true,
          created_by: createdBy,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[ApprovalWorkflow] Error creating workflow:', error);
        return { success: false, error: 'Failed to create workflow' };
      }

      return { success: true, workflowId: data.id };
    } catch (error) {
      console.error('[ApprovalWorkflow] Error creating workflow:', error);
      return { success: false, error: 'Failed to create workflow' };
    }
  }

  /**
   * Get workflow by type
   */
  async getWorkflowByType(type: WorkflowType): Promise<WorkflowDefinition | null> {
    const { data } = await this.supabase
      .from('email_approval_workflows')
      .select('*')
      .eq('workflow_type', type)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) return null;

    return this.mapDbToWorkflow(data);
  }

  /**
   * Get all active workflows
   */
  async getActiveWorkflows(): Promise<WorkflowDefinition[]> {
    const { data } = await this.supabase
      .from('email_approval_workflows')
      .select('*')
      .eq('is_active', true)
      .order('workflow_name');

    return (data || []).map(this.mapDbToWorkflow);
  }

  /**
   * Update workflow
   */
  async updateWorkflow(
    workflowId: string,
    updates: Partial<CreateWorkflowParams>,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.workflowName) updateData.workflow_name = updates.workflowName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.approvalChain) updateData.approval_chain = updates.approvalChain;
      if (updates.triggerConditions !== undefined) updateData.trigger_conditions = updates.triggerConditions;
      if (updates.autoApproveTimeoutHours !== undefined) updateData.auto_approve_timeout_hours = updates.autoApproveTimeoutHours;
      if (updates.autoDenyTimeoutHours !== undefined) updateData.auto_deny_timeout_hours = updates.autoDenyTimeoutHours;

      const { error } = await this.supabase
        .from('email_approval_workflows')
        .update(updateData)
        .eq('id', workflowId);

      if (error) {
        return { success: false, error: 'Failed to update workflow' };
      }

      return { success: true };
    } catch (error) {
      console.error('[ApprovalWorkflow] Error updating workflow:', error);
      return { success: false, error: 'Failed to update workflow' };
    }
  }

  /**
   * Deactivate workflow
   */
  async deactivateWorkflow(
    workflowId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('email_approval_workflows')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', workflowId);

    if (error) {
      return { success: false, error: 'Failed to deactivate workflow' };
    }

    return { success: true };
  }

  // ============================================================================
  // REQUEST SUBMISSION
  // ============================================================================

  /**
   * Submit a new approval request
   */
  async submitRequest(
    params: SubmitRequestParams,
    requesterId: string
  ): Promise<{
    success: boolean;
    requestId?: string;
    requiresApproval: boolean;
    error?: string;
  }> {
    try {
      // Find matching workflow
      const workflow = await this.getWorkflowByType(params.requestType);

      if (!workflow) {
        // No workflow defined - auto-approve
        return {
          success: true,
          requiresApproval: false,
        };
      }

      // Check trigger conditions
      if (workflow.triggerConditions && Object.keys(workflow.triggerConditions).length > 0) {
        const shouldTrigger = this.evaluateTriggerConditions(
          workflow.triggerConditions,
          params.requestData
        );

        if (!shouldTrigger) {
          return {
            success: true,
            requiresApproval: false,
          };
        }
      }

      // Calculate expiry
      let expiresAt: Date | undefined;
      if (workflow.autoDenyTimeoutHours) {
        expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + workflow.autoDenyTimeoutHours);
      }

      // Create approval request
      const { data, error } = await this.supabase
        .from('email_approval_requests')
        .insert({
          workflow_id: workflow.id,
          request_type: params.requestType,
          requester_id: requesterId,
          target_account_id: params.targetAccountId,
          request_data: params.requestData,
          status: 'pending',
          current_step: 1,
          approval_history: [],
          submitted_at: new Date().toISOString(),
          expires_at: expiresAt?.toISOString(),
          requester_notes: params.requesterNotes,
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[ApprovalWorkflow] Error submitting request:', error);
        return { success: false, requiresApproval: false, error: 'Failed to submit request' };
      }

      // Get approvers for first step
      const approvers = await this.resolveApprovers(
        workflow.approvalChain.steps[0],
        requesterId,
        params.requestData
      );

      // TODO: Send notification to approvers
      if (workflow.notifyOnSubmit && approvers.length > 0) {
        await this.sendApprovalNotification(data.id, approvers, 'request_submitted');
      }

      return {
        success: true,
        requestId: data.id,
        requiresApproval: true,
      };
    } catch (error) {
      console.error('[ApprovalWorkflow] Error submitting request:', error);
      return { success: false, requiresApproval: false, error: 'Failed to submit request' };
    }
  }

  // ============================================================================
  // APPROVAL PROCESSING
  // ============================================================================

  /**
   * Process an approval or denial
   */
  async processApproval(
    params: ProcessApprovalParams
  ): Promise<{
    success: boolean;
    isComplete: boolean;
    finalStatus?: ApprovalStatus;
    error?: string;
  }> {
    try {
      // Get the request
      const { data: request, error: fetchError } = await this.supabase
        .from('email_approval_requests')
        .select('*, email_approval_workflows(*)')
        .eq('id', params.requestId)
        .maybeSingle();

      if (fetchError || !request) {
        return { success: false, isComplete: false, error: 'Request not found' };
      }

      if (request.status !== 'pending') {
        return { success: false, isComplete: true, error: 'Request already processed' };
      }

      const workflow = request.email_approval_workflows;
      const approvalChain = workflow.approval_chain as ApprovalChain;
      const currentStepConfig = approvalChain.steps[request.current_step - 1];

      // Verify approver is authorized
      const isAuthorized = await this.verifyApprover(
        params.approverId,
        currentStepConfig,
        request.requester_id,
        request.request_data
      );

      if (!isAuthorized) {
        return { success: false, isComplete: false, error: 'Not authorized to approve this request' };
      }

      // Get approver info
      const { data: approverInfo } = await this.supabase
        .from('user')
        .select('full_name')
        .eq('id', params.approverId)
        .maybeSingle();

      // Add to approval history
      const newHistoryEntry: ApprovalHistoryEntry = {
        step: request.current_step,
        approverId: params.approverId,
        approverName: approverInfo?.full_name || 'Unknown',
        action: params.action === 'approve' ? 'approved' : 'denied',
        timestamp: new Date(),
        notes: params.notes,
      };

      const approvalHistory = [...(request.approval_history || []), newHistoryEntry];

      if (params.action === 'deny') {
        // Denied - end workflow
        await this.supabase
          .from('email_approval_requests')
          .update({
            status: 'denied',
            approval_history: approvalHistory,
            completed_at: new Date().toISOString(),
            final_notes: params.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.requestId);

        // Notify requester
        if (workflow.notify_on_deny) {
          await this.sendApprovalNotification(params.requestId, [request.requester_id], 'request_denied');
        }

        return { success: true, isComplete: true, finalStatus: 'denied' };
      }

      // Approved - check if more steps
      const nextStep = request.current_step + 1;
      const hasMoreSteps = nextStep <= approvalChain.steps.length;

      if (hasMoreSteps && approvalChain.requireAllApprovers) {
        // Move to next step
        await this.supabase
          .from('email_approval_requests')
          .update({
            current_step: nextStep,
            approval_history: approvalHistory,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.requestId);

        // Notify next approvers
        const nextApprovers = await this.resolveApprovers(
          approvalChain.steps[nextStep - 1],
          request.requester_id,
          request.request_data
        );

        if (nextApprovers.length > 0) {
          await this.sendApprovalNotification(params.requestId, nextApprovers, 'approval_required');
        }

        return { success: true, isComplete: false };
      }

      // Fully approved - complete workflow
      await this.supabase
        .from('email_approval_requests')
        .update({
          status: 'approved',
          approval_history: approvalHistory,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.requestId);

      // Execute the approved action
      await this.executeApprovedAction(request);

      // Notify requester
      if (workflow.notify_on_approve) {
        await this.sendApprovalNotification(params.requestId, [request.requester_id], 'request_approved');
      }

      return { success: true, isComplete: true, finalStatus: 'approved' };
    } catch (error) {
      console.error('[ApprovalWorkflow] Error processing approval:', error);
      return { success: false, isComplete: false, error: 'Failed to process approval' };
    }
  }

  /**
   * Cancel a pending request
   */
  async cancelRequest(
    requestId: string,
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: request } = await this.supabase
        .from('email_approval_requests')
        .select('requester_id, status')
        .eq('id', requestId)
        .maybeSingle();

      if (!request) {
        return { success: false, error: 'Request not found' };
      }

      if (request.status !== 'pending') {
        return { success: false, error: 'Request cannot be cancelled' };
      }

      // Only requester or admin can cancel
      // TODO: Add admin check
      if (request.requester_id !== userId) {
        return { success: false, error: 'Not authorized to cancel this request' };
      }

      await this.supabase
        .from('email_approval_requests')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          final_notes: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      return { success: true };
    } catch (error) {
      console.error('[ApprovalWorkflow] Error cancelling request:', error);
      return { success: false, error: 'Failed to cancel request' };
    }
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovalsForUser(userId: string): Promise<ApprovalRequest[]> {
    // Get user's role and department
    const { data: userInfo } = await this.supabase
      .from('user')
      .select('role, employee_profile!inner(department)')
      .eq('id', userId)
      .maybeSingle();

    if (!userInfo) return [];

    // Get all pending requests
    const { data: requests } = await this.supabase
      .from('email_approval_requests')
      .select('*, email_approval_workflows(*)')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });

    if (!requests) return [];

    // Filter requests where user can approve current step
    const approvableRequests: ApprovalRequest[] = [];

    for (const request of requests) {
      const workflow = request.email_approval_workflows;
      const approvalChain = workflow.approval_chain as ApprovalChain;
      const currentStepConfig = approvalChain.steps[request.current_step - 1];

      const canApprove = await this.verifyApprover(
        userId,
        currentStepConfig,
        request.requester_id,
        request.request_data
      );

      if (canApprove) {
        approvableRequests.push(this.mapDbToRequest(request));
      }
    }

    return approvableRequests;
  }

  /**
   * Get requests submitted by a user
   */
  async getRequestsByRequester(
    requesterId: string,
    status?: ApprovalStatus
  ): Promise<ApprovalRequest[]> {
    let query = this.supabase
      .from('email_approval_requests')
      .select('*, email_approval_workflows(*)')
      .eq('requester_id', requesterId)
      .order('submitted_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data } = await query;

    return (data || []).map(this.mapDbToRequest);
  }

  /**
   * Get all pending requests (for admins)
   */
  async getAllPendingRequests(): Promise<ApprovalRequest[]> {
    const { data } = await this.supabase
      .from('email_approval_requests')
      .select('*, email_approval_workflows(*)')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });

    return (data || []).map(this.mapDbToRequest);
  }

  /**
   * Get request by ID
   */
  async getRequestById(requestId: string): Promise<ApprovalRequest | null> {
    const { data } = await this.supabase
      .from('email_approval_requests')
      .select('*, email_approval_workflows(*)')
      .eq('id', requestId)
      .maybeSingle();

    if (!data) return null;

    return this.mapDbToRequest(data);
  }

  // ============================================================================
  // SCHEDULED PROCESSING
  // ============================================================================

  /**
   * Process expired requests (run periodically)
   */
  async processExpiredRequests(): Promise<{
    expired: number;
    autoApproved: number;
    autoDenied: number;
  }> {
    let expired = 0;
    let autoApproved = 0;
    let autoDenied = 0;

    // Get expired pending requests
    const { data: expiredRequests } = await this.supabase
      .from('email_approval_requests')
      .select('*, email_approval_workflows(*)')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    for (const request of expiredRequests || []) {
      const workflow = request.email_approval_workflows;

      if (workflow.auto_approve_timeout_hours) {
        // Auto-approve
        await this.supabase
          .from('email_approval_requests')
          .update({
            status: 'approved',
            completed_at: new Date().toISOString(),
            final_notes: 'Auto-approved due to timeout',
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        await this.executeApprovedAction(request);
        autoApproved++;
      } else {
        // Auto-deny (expire)
        await this.supabase
          .from('email_approval_requests')
          .update({
            status: 'expired',
            completed_at: new Date().toISOString(),
            final_notes: 'Request expired due to timeout',
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        autoDenied++;
      }

      expired++;
    }

    return { expired, autoApproved, autoDenied };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Evaluate trigger conditions
   */
  private evaluateTriggerConditions(
    conditions: Record<string, unknown>,
    requestData: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      const dataValue = requestData[key];

      if (Array.isArray(value)) {
        // Check if data value is in array
        if (!value.includes(dataValue)) {
          return false;
        }
      } else if (typeof value === 'number' && key.endsWith('_above')) {
        // Numeric threshold (e.g., quota_increase_above)
        const actualKey = key.replace('_above', '');
        const actualValue = requestData[actualKey];
        if (typeof actualValue !== 'number' || actualValue <= value) {
          return false;
        }
      } else if (dataValue !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Resolve approvers for a step
   */
  private async resolveApprovers(
    step: ApprovalStep,
    requesterId: string,
    requestData: Record<string, unknown>
  ): Promise<string[]> {
    switch (step.approverType) {
      case 'specific_user':
        return step.specificUserId ? [step.specificUserId] : [];

      case 'manager': {
        // Get requester's manager
        const { data: requester } = await this.supabase
          .from('user')
          .select('employee_profile!inner(reporting_manager_id)')
          .eq('id', requesterId)
          .maybeSingle();

        const managerId = requester?.employee_profile?.reporting_manager_id;
        return managerId ? [managerId] : [];
      }

      case 'department_head': {
        // Get department head for requester's department
        const { data: requester } = await this.supabase
          .from('user')
          .select('employee_profile!inner(department)')
          .eq('id', requesterId)
          .maybeSingle();

        const department = requester?.employee_profile?.department;
        if (!department) return [];

        const { data: heads } = await this.supabase
          .from('employee_profile')
          .select('user_id')
          .eq('department', department)
          .eq('designation', 'Department Head');

        return heads?.map(h => h.user_id).filter(Boolean) || [];
      }

      case 'email_admin': {
        // Get users with email_admin role
        const { data: admins } = await this.supabase
          .from('user')
          .select('id')
          .eq('role', 'email_admin');

        return admins?.map(a => a.id) || [];
      }

      case 'hr_admin': {
        const { data: admins } = await this.supabase
          .from('user')
          .select('id')
          .eq('role', 'hr_admin');

        return admins?.map(a => a.id) || [];
      }

      case 'security_admin': {
        const { data: admins } = await this.supabase
          .from('user')
          .select('id')
          .eq('role', 'security_admin');

        return admins?.map(a => a.id) || [];
      }

      case 'super_admin': {
        const { data: admins } = await this.supabase
          .from('user')
          .select('id')
          .eq('role', 'super_admin');

        return admins?.map(a => a.id) || [];
      }

      default:
        return [];
    }
  }

  /**
   * Verify if a user can approve a step
   */
  private async verifyApprover(
    userId: string,
    step: ApprovalStep,
    requesterId: string,
    requestData: Record<string, unknown>
  ): Promise<boolean> {
    const approvers = await this.resolveApprovers(step, requesterId, requestData);
    return approvers.includes(userId);
  }

  /**
   * Execute the action after approval
   */
  private async executeApprovedAction(request: Record<string, unknown>): Promise<void> {
    const requestType = request.request_type as WorkflowType;
    const requestData = request.request_data as Record<string, unknown>;

    switch (requestType) {
      case 'account_creation': {
        // Create the email account
        await this.lifecycleService.createAccount(
          requestData as unknown as CreateAccountParams,
          request.requester_id as string
        );
        break;
      }

      case 'quota_increase': {
        // Update account quota
        if (request.target_account_id) {
          await this.supabase
            .from('email_accounts')
            .update({
              storage_quota_mb: requestData.newStorageQuotaMb,
              daily_send_limit: requestData.newDailySendLimit,
              updated_at: new Date().toISOString(),
            })
            .eq('id', request.target_account_id);
        }
        break;
      }

      case 'offboarding': {
        // Initiate offboarding
        if (request.target_account_id) {
          await this.lifecycleService.initiateOffboarding(
            {
              accountId: request.target_account_id as string,
              reason: requestData.reason as string,
              scheduledDate: requestData.scheduledDate ? new Date(requestData.scheduledDate as string) : undefined,
              backupData: requestData.backupData as boolean,
              forwardEmailsTo: requestData.forwardEmailsTo as string,
            },
            request.requester_id as string
          );
        }
        break;
      }

      case 'delegation_request': {
        // Create delegation
        await this.supabase.from('email_delegations').insert({
          delegator_account_id: requestData.delegatorAccountId,
          delegate_account_id: requestData.delegateAccountId,
          permissions: requestData.permissions,
          valid_from: new Date().toISOString(),
          valid_until: requestData.validUntil,
          reason: requestData.reason,
          approved_by: request.requester_id,
          approval_request_id: request.id,
          is_active: true,
        });
        break;
      }

      case 'shared_mailbox_access': {
        // Grant shared mailbox access
        await this.supabase.from('email_shared_mailbox_access').insert({
          mailbox_id: requestData.mailboxId,
          email_account_id: requestData.emailAccountId,
          permission_level: requestData.permissionLevel,
          granted_by: request.requester_id,
          expires_at: requestData.expiresAt,
        });
        break;
      }

      case 'alias_creation': {
        // Create email alias
        await this.supabase.from('email_aliases').insert({
          alias_address: requestData.aliasAddress,
          alias_type: requestData.aliasType || 'personal',
          display_name: requestData.displayName,
          description: requestData.description,
          email_account_id: request.target_account_id,
          is_active: true,
          allow_send_as: requestData.allowSendAs || false,
          created_by: request.requester_id,
        });
        break;
      }

      case 'distribution_list_creation': {
        // Create distribution list
        await this.supabase.from('email_distribution_lists').insert({
          email_address: requestData.emailAddress,
          display_name: requestData.displayName,
          list_type: requestData.listType || 'static',
          description: requestData.description,
          owner_account_id: request.target_account_id,
          moderation_enabled: requestData.moderationEnabled || false,
          allow_external_senders: requestData.allowExternalSenders || false,
          is_active: true,
          created_by: request.requester_id,
        });
        break;
      }

      default:
        console.warn(`[ApprovalWorkflow] Unknown request type: ${requestType}`);
    }
  }

  /**
   * Send approval notification
   */
  private async sendApprovalNotification(
    requestId: string,
    recipientIds: string[],
    notificationType: 'request_submitted' | 'approval_required' | 'request_approved' | 'request_denied'
  ): Promise<void> {
    // TODO: Implement notification sending
    // This would integrate with the notification/email system
    console.log(`[ApprovalWorkflow] Notification: ${notificationType} for request ${requestId} to ${recipientIds.length} recipients`);
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapDbToWorkflow(data: Record<string, unknown>): WorkflowDefinition {
    return {
      id: data.id as string,
      workflowName: data.workflow_name as string,
      workflowType: data.workflow_type as WorkflowType,
      description: data.description as string | undefined,
      approvalChain: data.approval_chain as ApprovalChain,
      triggerConditions: data.trigger_conditions as Record<string, unknown>,
      autoApproveTimeoutHours: data.auto_approve_timeout_hours as number | undefined,
      autoDenyTimeoutHours: data.auto_deny_timeout_hours as number | undefined,
      notifyOnSubmit: data.notify_on_submit as boolean,
      notifyOnApprove: data.notify_on_approve as boolean,
      notifyOnDeny: data.notify_on_deny as boolean,
      isActive: data.is_active as boolean,
    };
  }

  private mapDbToRequest(data: Record<string, unknown>): ApprovalRequest {
    return {
      id: data.id as string,
      workflowId: data.workflow_id as string,
      requestType: data.request_type as WorkflowType,
      requesterId: data.requester_id as string,
      targetAccountId: data.target_account_id as string | undefined,
      requestData: data.request_data as Record<string, unknown>,
      status: data.status as ApprovalStatus,
      currentStep: data.current_step as number,
      approvalHistory: data.approval_history as ApprovalHistoryEntry[],
      submittedAt: new Date(data.submitted_at as string),
      completedAt: data.completed_at ? new Date(data.completed_at as string) : undefined,
      expiresAt: data.expires_at ? new Date(data.expires_at as string) : undefined,
      requesterNotes: data.requester_notes as string | undefined,
      finalNotes: data.final_notes as string | undefined,
    };
  }
}

// Singleton
let workflowServiceInstance: ApprovalWorkflowService | null = null;

export function getApprovalWorkflowService(): ApprovalWorkflowService {
  if (!workflowServiceInstance) {
    workflowServiceInstance = new ApprovalWorkflowService();
  }
  return workflowServiceInstance;
}

export default ApprovalWorkflowService;
