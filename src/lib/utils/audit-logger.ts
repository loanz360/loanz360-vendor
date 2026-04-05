import { createClient } from '@/lib/supabase/server'

export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW'
  | 'APPROVE' | 'REJECT' | 'SUBMIT' | 'CANCEL'
  | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT'
  | 'ASSIGN' | 'UNASSIGN' | 'ACTIVATE' | 'DEACTIVATE'

export type AuditModule =
  | 'EMPLOYEES' | 'ATTENDANCE' | 'LEAVES' | 'PAYROLL'
  | 'PERFORMANCE' | 'RECRUITMENT' | 'COMPLIANCE' | 'BENEFITS'
  | 'LEARNING' | 'LETTERS' | 'TICKETS' | 'NOTIFICATIONS'
  | 'RESIGNATIONS' | 'ONBOARDING' | 'PIP' | 'FEEDBACK_360'
  | 'PROFILE_REVIEW' | 'BGV' | 'SHIFTS' | 'HOLIDAYS'
  | 'REPORTS' | 'SETTINGS' | 'AUTH'

interface AuditLogEntry {
  user_id: string
  action: AuditAction
  module: AuditModule
  entity_type: string
  entity_id?: string
  description: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  metadata?: Record<string, unknown>
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('audit_logs').insert({
      ...entry,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    // Audit logging should never break the main flow
    console.error('[AuditLogger] Failed to log audit entry:', error)
  }
}

export function buildAuditDescription(action: AuditAction, module: AuditModule, entityName?: string): string {
  const actionMap: Record<AuditAction, string> = {
    CREATE: 'Created',
    UPDATE: 'Updated',
    DELETE: 'Deleted',
    VIEW: 'Viewed',
    APPROVE: 'Approved',
    REJECT: 'Rejected',
    SUBMIT: 'Submitted',
    CANCEL: 'Cancelled',
    LOGIN: 'Logged in',
    LOGOUT: 'Logged out',
    EXPORT: 'Exported',
    IMPORT: 'Imported',
    ASSIGN: 'Assigned',
    UNASSIGN: 'Unassigned',
    ACTIVATE: 'Activated',
    DEACTIVATE: 'Deactivated',
  }
  const moduleMap: Record<AuditModule, string> = {
    EMPLOYEES: 'employee',
    ATTENDANCE: 'attendance record',
    LEAVES: 'leave request',
    PAYROLL: 'payroll',
    PERFORMANCE: 'performance review',
    RECRUITMENT: 'recruitment',
    COMPLIANCE: 'compliance record',
    BENEFITS: 'benefit',
    LEARNING: 'learning program',
    LETTERS: 'letter',
    TICKETS: 'support ticket',
    NOTIFICATIONS: 'notification',
    RESIGNATIONS: 'resignation',
    ONBOARDING: 'onboarding',
    PIP: 'PIP plan',
    FEEDBACK_360: '360 feedback',
    PROFILE_REVIEW: 'profile review',
    BGV: 'background verification',
    SHIFTS: 'shift',
    HOLIDAYS: 'holiday',
    REPORTS: 'report',
    SETTINGS: 'setting',
    AUTH: 'authentication',
  }
  return `${actionMap[action]} ${moduleMap[module]}${entityName ? `: ${entityName}` : ''}`
}
