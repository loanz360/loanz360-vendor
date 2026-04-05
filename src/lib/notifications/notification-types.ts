/**
 * Notification System Types
 * TypeScript definitions for the notification system
 */

import { z } from 'zod'

// ============================================================================
// SCHEMAS
// ============================================================================

export const notificationTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  category: z.enum(['security', 'performance', 'system', 'achievement']),
  channels: z.array(z.enum(['email', 'in_app', 'sms'])),
  subject_template: z.string().optional(),
  body_template: z.string().optional(),
  sms_template: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  is_active: z.boolean().default(true),
  required_variables: z.array(z.string()).default([]),
  is_system: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export const inAppNotificationSchema = z.object({
  id: z.string().uuid(),
  admin_id: z.string().uuid(),
  type: z.enum(['info', 'success', 'warning', 'error']),
  category: z.string(),
  title: z.string(),
  message: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  action_url: z.string().optional(),
  action_label: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  is_read: z.boolean(),
  read_at: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  expires_at: z.string().optional(),
  created_at: z.string(),
})

export const notificationPreferencesSchema = z.object({
  id: z.string().uuid().optional(),
  admin_id: z.string().uuid(),
  email_enabled: z.boolean().default(true),
  sms_enabled: z.boolean().default(false),
  in_app_enabled: z.boolean().default(true),
  category_preferences: z.record(z.any()).optional(),
  quiet_hours_enabled: z.boolean().default(false),
  quiet_hours_start: z.string().default('22:00'),
  quiet_hours_end: z.string().default('07:00'),
  quiet_hours_timezone: z.string().default('UTC'),
  daily_digest_enabled: z.boolean().default(true),
  daily_digest_time: z.string().default('09:00'),
  weekly_digest_enabled: z.boolean().default(true),
  weekly_digest_day: z.number().default(1),
  weekly_digest_time: z.string().default('09:00'),
  sound_enabled: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

// ============================================================================
// TYPES
// ============================================================================

export type NotificationTemplate = z.infer<typeof notificationTemplateSchema>
export type InAppNotification = z.infer<typeof inAppNotificationSchema>
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>

export type NotificationCategory = 'security' | 'performance' | 'system' | 'achievement'
export type NotificationChannel = 'email' | 'in_app' | 'sms'
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'
export type NotificationType = 'info' | 'success' | 'warning' | 'error'

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface QueueNotificationParams {
  templateName: string
  recipientId: string
  variables?: Record<string, any>
  scheduledFor?: Date
}

export interface CreateInAppNotificationParams {
  adminId: string
  type: NotificationType
  category: string
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  icon?: string
  color?: string
  metadata?: Record<string, any>
  expiresAt?: Date
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getNotificationTypeColor(type: NotificationType): string {
  const colors: Record<NotificationType, string> = {
    info: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
  }
  return colors[type]
}

export function getNotificationTypeBg(type: NotificationType): string {
  const colors: Record<NotificationType, string> = {
    info: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200',
  }
  return colors[type]
}

export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  }
  return icons[type]
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    security: '🔒',
    performance: '📊',
    system: '⚙️',
    achievement: '🏆',
  }
  return icons[category] || '📢'
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

/**
 * Get priority border color classes
 * Returns Tailwind CSS classes for border color based on priority
 */
export function getPriorityBorderColor(priority: NotificationPriority): string {
  const colors: Record<NotificationPriority, string> = {
    urgent: 'border-l-4 border-l-red-500',
    high: 'border-l-4 border-l-orange-500',
    normal: 'border-l-4 border-l-gray-300',
    low: 'border-l-4 border-l-green-500',
  }
  return colors[priority] || colors.normal
}

/**
 * Get priority badge styles
 * Returns background and text color classes for priority badge
 */
export function getPriorityBadgeStyles(priority: NotificationPriority): string {
  const styles: Record<NotificationPriority, string> = {
    urgent: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    normal: 'bg-gray-100 text-gray-800 border-gray-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  }
  return styles[priority] || styles.normal
}

/**
 * Get priority icon
 * Returns emoji icon for priority level
 */
export function getPriorityIcon(priority: NotificationPriority): string {
  const icons: Record<NotificationPriority, string> = {
    urgent: '🚨',
    high: '⚠️',
    normal: 'ℹ️',
    low: '✅',
  }
  return icons[priority] || icons.normal
}

/**
 * Check if notification should have flash animation
 * Returns true for urgent priority notifications
 */
export function shouldFlashNotification(priority: NotificationPriority): boolean {
  return priority === 'urgent'
}
