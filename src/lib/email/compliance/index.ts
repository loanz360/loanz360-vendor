/**
 * Email Compliance Module
 * Exports all compliance-related services and types
 */

export {
  ComplianceService,
  getComplianceService,
  type LegalHoldStatus,
  type LegalHoldType,
  type LegalHold,
  type RetentionAction,
  type RetentionScope,
  type RetentionPolicy,
  type ComplianceReport,
  type AuditLogEntry,
  type CreateLegalHoldParams,
  type CreateRetentionPolicyParams,
} from './compliance-service';
