/**
 * Data Retention Policies — RBI/NBFC Compliance
 * 
 * Indian fintech regulations require:
 * - Loan data retained for minimum 8 years after closure
 * - KYC documents retained for 5 years after account closure
 * - Transaction logs retained for 10 years
 * - Audit trails retained permanently
 * - Customer consent records retained for duration of relationship + 5 years
 */

export const DATA_RETENTION_POLICIES = {
  LOAN_RECORDS: { years: 8, description: 'Loan data after account closure (RBI mandate)' },
  KYC_DOCUMENTS: { years: 5, description: 'KYC after account closure' },
  TRANSACTION_LOGS: { years: 10, description: 'All financial transactions' },
  AUDIT_TRAILS: { years: -1, description: 'Permanent retention' },
  CONSENT_RECORDS: { years: 5, description: 'After end of relationship' },
  SESSION_LOGS: { years: 1, description: 'Login/logout activity' },
  COMMUNICATION_LOGS: { years: 3, description: 'SMS, email, WhatsApp logs' },
  FAILED_LOGIN_ATTEMPTS: { days: 90, description: 'Security monitoring' },
  RATE_LIMIT_LOGS: { days: 30, description: 'Rate limiting records' },
} as const

export type RetentionCategory = keyof typeof DATA_RETENTION_POLICIES

export function getRetentionDate(category: RetentionCategory): Date | null {
  const policy = DATA_RETENTION_POLICIES[category]
  if ('years' in policy && policy.years === -1) return null // permanent
  
  const date = new Date()
  if ('years' in policy) {
    date.setFullYear(date.getFullYear() - policy.years)
  } else if ('days' in policy) {
    date.setDate(date.getDate() - policy.days)
  }
  return date
}
