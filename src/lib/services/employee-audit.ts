/**
 * Employee Management Audit Logging Service
 * Tracks all actions performed on employee records
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

export interface EmployeeActivityLog {
  employeeId: string
  action: string
  actionDetails?: Record<string, any>
  performedBy: string
  performedByRole: string
  performedByName?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Log employee management activity
 */
export async function logEmployeeActivity(log: EmployeeActivityLog): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin()

    // Get performer's name if not provided
    let performerName = log.performedByName
    if (!performerName) {
      const { data: user } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', log.performedBy)
        .maybeSingle()

      performerName = user?.full_name || 'Unknown User'
    }

    // Insert activity log
    const { error } = await supabase
      .from('employee_activity_logs')
      .insert({
        employee_id: log.employeeId,
        action: log.action,
        action_details: log.actionDetails || {},
        performed_by: log.performedBy,
        performed_by_name: performerName,
        performed_by_role: log.performedByRole,
        ip_address: log.ipAddress || null,
        user_agent: log.userAgent || null
      })

    if (error) {
      logger.error('Error logging employee activity:', error)
      return false
    }

    return true
  } catch (error) {
    logger.error('Error in logEmployeeActivity:', error)
    return false
  }
}

/**
 * Log status change
 */
export async function logStatusChange(
  employeeId: string,
  oldStatus: string,
  newStatus: string,
  changedBy: string,
  changedByRole: string,
  reason?: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin()

    const { data: user } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', changedBy)
      .maybeSingle()

    const { error } = await supabase
      .from('employee_status_history')
      .insert({
        employee_id: employeeId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: changedBy,
        changed_by_name: user?.full_name || 'Unknown',
        changed_by_role: changedByRole,
        reason: reason || null
      })

    if (error) {
      logger.error('Error logging status change:', error)
      return false
    }

    // Also log as activity
    await logEmployeeActivity({
      employeeId,
      action: 'STATUS_CHANGED',
      actionDetails: {
        old_status: oldStatus,
        new_status: newStatus,
        reason
      },
      performedBy: changedBy,
      performedByRole: changedByRole
    })

    return true
  } catch (error) {
    logger.error('Error in logStatusChange:', error)
    return false
  }
}

/**
 * Get activity logs for an employee
 */
export async function getEmployeeActivityLogs(
  employeeId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('employee_activity_logs')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('Error fetching activity logs:', error)
      return []
    }

    return data || []
  } catch (error) {
    logger.error('Error in getEmployeeActivityLogs:', error)
    return []
  }
}

/**
 * Get status change history for an employee
 */
export async function getStatusHistory(employeeId: string): Promise<any[]> {
  try {
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('employee_status_history')
      .select('*')
      .eq('employee_id', employeeId)
      .order('changed_at', { ascending: false })

    if (error) {
      logger.error('Error fetching status history:', error)
      return []
    }

    return data || []
  } catch (error) {
    logger.error('Error in getStatusHistory:', error)
    return []
  }
}

/**
 * Bulk log activities (for batch operations)
 */
export async function bulkLogActivities(logs: EmployeeActivityLog[]): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin()

    const activities = await Promise.all(
      logs.map(async (log) => {
        let performerName = log.performedByName
        if (!performerName) {
          const { data: user } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', log.performedBy)
            .maybeSingle()

          performerName = user?.full_name || 'Unknown User'
        }

        return {
          employee_id: log.employeeId,
          action: log.action,
          action_details: log.actionDetails || {},
          performed_by: log.performedBy,
          performed_by_name: performerName,
          performed_by_role: log.performedByRole,
          ip_address: log.ipAddress || null,
          user_agent: log.userAgent || null
        }
      })
    )

    const { error } = await supabase
      .from('employee_activity_logs')
      .insert(activities)

    if (error) {
      logger.error('Error bulk logging activities:', error)
      return false
    }

    return true
  } catch (error) {
    logger.error('Error in bulkLogActivities:', error)
    return false
  }
}
