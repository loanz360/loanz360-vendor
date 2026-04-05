/**
 * Admin Analytics Library
 * Data aggregation and formatting for dashboard
 */

import { z } from 'zod'

export const activitySchema = z.object({
  id: z.string().uuid(),
  admin_id: z.string().uuid().nullable(),
  admin_name: z.string().nullable(),
  admin_email: z.string().nullable(),
  action_type: z.string(),
  target_type: z.string().nullable(),
  target_id: z.string().uuid().nullable(),
  details: z.record(z.any()).optional(),
  ip_address: z.string().nullable(),
  severity: z.string(),
  created_at: z.string(),
})

export type Activity = z.infer<typeof activitySchema>

export interface DashboardStats {
  adminStats: {
    total: number
    active: number
    inactive: number
    twoFactorEnabled: number
    newThisPeriod: number
  }
  activityStats: {
    totalActions: number
    uniqueAdmins: number
    byType: Record<string, number>
  }
  securityStats: {
    failedLogins24h: number
    failedLogins7d: number
    lockedAccounts: number
    passwordResets: number
  }
  sessionStats: {
    activeSessions: number
    uniqueAdmins: number
  }
  roleDistribution: Record<string, number>
  healthScore: number
}

export interface LoginTrend {
  date: string
  successfulLogins: number
  failedLogins: number
  uniqueAdmins: number
}

export function formatTimeAgo(date: string): string {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)

  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    info: 'text-blue-600',
    warning: 'text-yellow-600',
    critical: 'text-red-600',
  }
  return colors[severity] || 'text-gray-600'
}

export function getActionIcon(actionType: string): string {
  const icons: Record<string, string> = {
    login: '🔓',
    logout: '🔒',
    login_failed: '⚠️',
    create: '➕',
    update: '✏️',
    delete: '🗑️',
    password_reset: '🔑',
    '2fa_setup': '🛡️',
  }
  return icons[actionType] || '📝'
}
