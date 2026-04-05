/**
 * Email Quota Module
 * Exports all quota-related services and types
 */

export {
  QuotaService,
  getQuotaService,
  type QuotaSource,
  type QuotaPolicy,
  type EffectiveQuota,
  type QuotaUsage,
  type QuotaAlert,
  type CreatePolicyParams,
} from './quota-service';
