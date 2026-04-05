/**
 * Email Workflows Module
 * Exports all workflow-related services and types
 */

export {
  ApprovalWorkflowService,
  getApprovalWorkflowService,
  type WorkflowType,
  type ApprovalStatus,
  type ApproverType,
  type ApprovalStep,
  type ApprovalChain,
  type WorkflowDefinition,
  type ApprovalRequest,
  type ApprovalHistoryEntry,
  type CreateWorkflowParams,
  type SubmitRequestParams,
  type ProcessApprovalParams,
} from './approval-workflow-service';
