/**
 * Scheduled Messaging System
 *
 * Features:
 * - Schedule SMS/Email/WhatsApp for future delivery
 * - Recurring messages (daily, weekly, monthly)
 * - Segment-based targeting
 * - Bulk scheduling
 * - Automatic execution via cron job
 */

import { createClient } from '@/lib/supabase/client'
import { smsService } from './unified-sms-service'

// =====================================================
// TYPES
// =====================================================

export interface ScheduleMessageParams {
  messageType: 'sms' | 'email' | 'whatsapp'
  templateCode: string
  recipients: string[] | string // Array of recipients or segment ID
  variables: Record<string, string>
  scheduledAt: Date
  timezone?: string
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'custom'
    endDate?: Date
    customCron?: string
  }
  senderId?: string
  subject?: string // For email
}

export interface ScheduledMessage {
  id: string
  message_type: string
  template_code: string
  recipient_type: string
  recipients: unknown  variables: Record<string, string>
  scheduled_at: string
  timezone: string
  recurrence_pattern?: string
  recurrence_end_date?: string
  status: string
  executed_at?: string
  total_sent: number
  total_failed: number
}

export interface MessageSegment {
  id: string
  name: string
  description: string
  filters: Record<string, unknown>
  recipient_count: number
}

// =====================================================
// SCHEDULED MESSAGING SERVICE
// =====================================================

export class ScheduledMessagingService {
  private supabase = createClient()

  /**
   * Schedule a message for future delivery
   */
  async scheduleMessage(params: ScheduleMessageParams) {
    try {
      const recipientType = Array.isArray(params.recipients) ? 'bulk' : 'segment'

      const { data, error } = await this.supabase
        .from('scheduled_messages')
        .insert({
          message_type: params.messageType,
          template_code: params.templateCode,
          recipient_type: recipientType,
          recipients: params.recipients,
          variables: params.variables,
          scheduled_at: params.scheduledAt.toISOString(),
          timezone: params.timezone || 'Asia/Kolkata',
          recurrence_pattern: params.recurrence?.pattern,
          recurrence_end_date: params.recurrence?.endDate?.toISOString(),
          status: 'scheduled',
          subject: params.subject
        })
        .select()
        .maybeSingle()

      if (error) {
        throw new Error(`Failed to schedule message: ${error.message}`)
      }

      return {
        success: true,
        scheduledMessageId: data.id,
        scheduledAt: params.scheduledAt
      }
    } catch (error) {
      console.error('Schedule message error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule message'
      }
    }
  }

  /**
   * Process scheduled messages (called by cron job)
   */
  async processScheduledMessages() {
    try {
      // Get messages due for sending (next 5 minutes to account for cron timing)
      const now = new Date()
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

      const { data: dueMessages, error } = await this.supabase
        .from('scheduled_messages')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_at', fiveMinutesFromNow.toISOString())
        .limit(100)

      if (error) {
        throw new Error(`Failed to fetch due messages: ${error.message}`)
      }

      if (!dueMessages || dueMessages.length === 0) {
        return {
          success: true,
          processed: 0,
          message: 'No messages due for sending'
        }
      }

      let successCount = 0
      let failCount = 0

      for (const message of dueMessages) {
        try {
          await this.executeScheduledMessage(message)
          successCount++
        } catch (error) {
          console.error(`Failed to execute message ${message.id}:`, error)
          failCount++
        }
      }

      return {
        success: true,
        processed: dueMessages.length,
        successful: successCount,
        failed: failCount
      }
    } catch (error) {
      console.error('Process scheduled messages error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed'
      }
    }
  }

  /**
   * Execute a single scheduled message
   */
  private async executeScheduledMessage(message: ScheduledMessage) {
    try {
      // Mark as processing
      await this.supabase
        .from('scheduled_messages')
        .update({ status: 'processing' })
        .eq('id', message.id)

      // Get recipients
      let recipients: string[] = []

      if (message.recipient_type === 'bulk') {
        recipients = message.recipients
      } else if (message.recipient_type === 'segment') {
        recipients = await this.getSegmentRecipients(message.recipients)
      }

      if (recipients.length === 0) {
        throw new Error('No recipients found')
      }

      // Send messages based on type
      let totalSent = 0
      let totalFailed = 0

      if (message.message_type === 'sms') {
        const results = await smsService.send({
          to: recipients,
          templateCode: message.template_code,
          variables: message.variables
        })

        totalSent = results.filter(r => r.success).length
        totalFailed = results.filter(r => !r.success).length
      } else if (message.message_type === 'email') {
        // Email sending logic (to be implemented)
      } else if (message.message_type === 'whatsapp') {
        // WhatsApp sending logic
      }

      // Update status
      await this.supabase
        .from('scheduled_messages')
        .update({
          status: 'sent',
          executed_at: new Date().toISOString(),
          total_sent: totalSent,
          total_failed: totalFailed
        })
        .eq('id', message.id)

      // Handle recurrence
      if (message.recurrence_pattern) {
        await this.scheduleRecurrence(message)
      }

      return {
        success: true,
        sent: totalSent,
        failed: totalFailed
      }
    } catch (error) {
      // Mark as failed
      await this.supabase
        .from('scheduled_messages')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Execution failed'
        })
        .eq('id', message.id)

      throw error
    }
  }

  /**
   * Schedule next recurrence
   */
  private async scheduleRecurrence(message: ScheduledMessage) {
    try {
      const currentSchedule = new Date(message.scheduled_at)
      const nextSchedule = this.calculateNextSchedule(currentSchedule, message.recurrence_pattern!)

      // Check if recurrence has ended
      if (message.recurrence_end_date) {
        const endDate = new Date(message.recurrence_end_date)
        if (nextSchedule > endDate) {
          return // Recurrence ended
        }
      }

      // Create next scheduled message
      await this.supabase
        .from('scheduled_messages')
        .insert({
          message_type: message.message_type,
          template_code: message.template_code,
          recipient_type: message.recipient_type,
          recipients: message.recipients,
          variables: message.variables,
          scheduled_at: nextSchedule.toISOString(),
          timezone: message.timezone,
          recurrence_pattern: message.recurrence_pattern,
          recurrence_end_date: message.recurrence_end_date,
          status: 'scheduled'
        })
    } catch (error) {
      console.error('Schedule recurrence error:', error)
    }
  }

  /**
   * Calculate next schedule based on pattern
   */
  private calculateNextSchedule(current: Date, pattern: string): Date {
    const next = new Date(current)

    switch (pattern) {
      case 'daily':
        next.setDate(next.getDate() + 1)
        break
      case 'weekly':
        next.setDate(next.getDate() + 7)
        break
      case 'monthly':
        next.setMonth(next.getMonth() + 1)
        break
      default:
        next.setDate(next.getDate() + 1) // Default to daily
    }

    return next
  }

  /**
   * Get recipients from segment
   */
  private async getSegmentRecipients(segmentId: string): Promise<string[]> {
    try {
      const { data: segment, error } = await this.supabase
        .from('message_segments')
        .select('filters')
        .eq('id', segmentId)
        .maybeSingle()

      if (error || !segment) {
        return []
      }

      // Apply filters to get recipients
      // This is simplified - actual implementation would apply complex filters
      const filters = segment.filters

      let query = this.supabase
        .from('users')
        .select('mobile')

      // Apply filters (example)
      if (filters.role) {
        query = query.eq('role', filters.role)
      }

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      query = query.limit(10000) // Max recipients per batch

      const { data: users } = await query

      return users?.map(u => u.mobile).filter(Boolean) || []
    } catch (error) {
      console.error('Get segment recipients error:', error)
      return []
    }
  }

  /**
   * Get scheduled messages list
   */
  async getScheduledMessages(filter?: {
    status?: string
    messageType?: string
    from?: Date
    to?: Date
    limit?: number
  }) {
    try {
      let query = this.supabase
        .from('scheduled_messages')
        .select('*')
        .order('scheduled_at', { ascending: true })

      if (filter?.status) {
        query = query.eq('status', filter.status)
      }

      if (filter?.messageType) {
        query = query.eq('message_type', filter.messageType)
      }

      if (filter?.from) {
        query = query.gte('scheduled_at', filter.from.toISOString())
      }

      if (filter?.to) {
        query = query.lte('scheduled_at', filter.to.toISOString())
      }

      if (filter?.limit) {
        query = query.limit(filter.limit)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      return {
        success: true,
        messages: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      }
    }
  }

  /**
   * Cancel scheduled message
   */
  async cancelScheduledMessage(id: string) {
    try {
      const { error } = await this.supabase
        .from('scheduled_messages')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'scheduled') // Only cancel if still scheduled

      if (error) {
        throw error
      }

      return {
        success: true,
        message: 'Scheduled message cancelled'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel message'
      }
    }
  }

  /**
   * Create message segment
   */
  async createSegment(params: {
    name: string
    description: string
    filters: Record<string, unknown>
  }) {
    try {
      // Calculate recipient count
      const recipients = await this.getSegmentRecipients(params.filters as unknown)

      const { data, error } = await this.supabase
        .from('message_segments')
        .insert({
          name: params.name,
          description: params.description,
          filters: params.filters,
          recipient_count: recipients.length,
          last_calculated_at: new Date().toISOString()
        })
        .select()
        .maybeSingle()

      if (error) {
        throw error
      }

      return {
        success: true,
        segment: data
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create segment'
      }
    }
  }

  /**
   * Get segments list
   */
  async getSegments() {
    try {
      const { data, error } = await this.supabase
        .from('message_segments')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return {
        success: true,
        segments: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch segments'
      }
    }
  }
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let scheduledMessagingInstance: ScheduledMessagingService | null = null

export function getScheduledMessagingService(): ScheduledMessagingService {
  if (!scheduledMessagingInstance) {
    scheduledMessagingInstance = new ScheduledMessagingService()
  }
  return scheduledMessagingInstance
}

// Convenience export
export const scheduledMessaging = getScheduledMessagingService()
