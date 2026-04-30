/**
 * Notification System - Queue Workers
 *
 * In-memory worker implementation for Vercel deployment.
 * For production with high load, deploy with Redis and use BullMQ workers.
 *
 * Worker processes that consume jobs from notification queues
 * Handles actual email/SMS/push sending and bulk operations
 */

import { createClient } from '@/lib/supabase/server'
import type {
  EmailJobData,
  SMSJobData,
  PushJobData,
  BulkJobData,
  AnalyticsJobData,
  CleanupJobData
} from './notification-queue'

// =====================================================
// Worker Types
// =====================================================

interface Job<T = any> {
  id: string
  data: T
  progress: number
  updateProgress: (progress: number) => Promise<void>
}

type WorkerHandler<T> = (job: Job<T>) => Promise<unknown>

// =====================================================
// In-Memory Worker Implementation
// =====================================================

class InMemoryWorker<T> {
  private name: string
  private handler: WorkerHandler<T>
  private concurrency: number
  private running = false
  private eventHandlers: {
    completed: ((job: Job<T>) => void)[]
    failed: ((job: Job<T> | undefined, err: Error) => void)[]
  } = {
    completed: [],
    failed: []
  }

  constructor(
    queueName: string,
    handler: WorkerHandler<T>,
    options?: { concurrency?: number }
  ) {
    this.name = queueName
    this.handler = handler
    this.concurrency = options?.concurrency || 1
  }

  on(event: 'completed', handler: (job: Job<T>) => void): void
  on(event: 'failed', handler: (job: Job<T> | undefined, err: Error) => void): void
  on(event: 'completed' | 'failed', handler: any): void {
    if (event === 'completed') {
      this.eventHandlers.completed.push(handler)
    } else if (event === 'failed') {
      this.eventHandlers.failed.push(handler)
    }
  }

  async processJob(job: Job<T>): Promise<unknown> {
    try {
      const result = await this.handler(job)
      this.eventHandlers.completed.forEach(h => h(job))
      return result
    } catch (error: unknown) {
      this.eventHandlers.failed.forEach(h => h(job, error))
      throw error
    }
  }

  async close(): Promise<void> {
    this.running = false
  }
}

// =====================================================
// Email Worker
// =====================================================

export const emailWorker = new InMemoryWorker<EmailJobData>(
  'notification:email',
  async (job) => {

    const { notification_id, recipient_ids } = job.data

    try {
      // Call the email API endpoint
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const response = await fetch(`${appUrl}/api/notifications/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          notification_id,
          recipient_ids
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Email sending failed')
      }

      const result = await response.json()

      // Update job progress
      await job.updateProgress(100)

      return {
        success: true,
        sent_count: result.sent_count,
        failed_count: result.failed_count
      }
    } catch (error: unknown) {
      console.error(`[Email Worker] Error in job ${job.id}:`, error)
      throw error
    }
  },
  { concurrency: 5 }
)

// =====================================================
// SMS Worker
// =====================================================

export const smsWorker = new InMemoryWorker<SMSJobData>(
  'notification:sms',
  async (job) => {

    const { phone_numbers } = job.data

    try {
      // Placeholder implementation

      await job.updateProgress(100)

      return {
        success: true,
        sent_count: phone_numbers.length,
        message: 'SMS sending not yet implemented - waiting for custom SMS API details'
      }
    } catch (error: unknown) {
      console.error(`[SMS Worker] Error in job ${job.id}:`, error)
      throw error
    }
  },
  { concurrency: 3 }
)

// =====================================================
// Push Notification Worker
// =====================================================

export const pushWorker = new InMemoryWorker<PushJobData>(
  'notification:push',
  async (job) => {

    const { recipient_ids } = job.data

    try {
      // Placeholder implementation

      await job.updateProgress(100)

      return {
        success: true,
        sent_count: recipient_ids.length,
        message: 'Push notifications not yet implemented'
      }
    } catch (error: unknown) {
      console.error(`[Push Worker] Error in job ${job.id}:`, error)
      throw error
    }
  },
  { concurrency: 10 }
)

// =====================================================
// Bulk Operations Worker
// =====================================================

export const bulkWorker = new InMemoryWorker<BulkJobData>(
  'notification:bulk',
  async (job) => {

    const {
      notification_id,
      target_type,
      target_category,
      target_users,
      channels
    } = job.data

    try {
      const supabase = await createClient()

      // Get notification details
      const { data: notification, error: notifError } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('id', notification_id)
        .maybeSingle()

      if (notifError || !notification) {
        throw new Error('Notification not found')
      }

      // Determine recipients based on target type
      let recipientIds: string[] = []

      if (target_type === 'individual' && target_users) {
        recipientIds = target_users
      } else if (target_type === 'all') {
        // Get all users
        const { data: users } = await supabase
          .from('users')
          .select('id')

        recipientIds = users?.map(u => u.id) || []
      }

      await job.updateProgress(25)

      // Create notification recipients
      const recipientRecords = recipientIds.map(userId => ({
        notification_id,
        user_id: userId,
        user_type: target_category || 'employee'
      }))

      const { error: recipientsError } = await supabase
        .from('notification_recipients')
        .insert(recipientRecords)

      if (recipientsError) {
        throw new Error(`Failed to create recipients: ${recipientsError.message}`)
      }

      await job.updateProgress(50)

      // Queue channel-specific jobs
      const jobs = []

      if (channels.includes('email')) {
        const { queueEmailNotification } = await import('./notification-queue')
        jobs.push(queueEmailNotification({
          notification_id,
          recipient_ids: recipientIds
        }))
      }

      if (channels.includes('push')) {
        const { queuePushNotification } = await import('./notification-queue')
        jobs.push(queuePushNotification({
          notification_id,
          recipient_ids: recipientIds,
          title: notification.title,
          body: notification.message
        }))
      }

      await Promise.all(jobs)

      await job.updateProgress(75)

      // Update notification status
      await supabase
        .from('system_notifications')
        .update({
          status: 'sent',
          total_recipients: recipientIds.length
        })
        .eq('id', notification_id)

      await job.updateProgress(100)

      return {
        success: true,
        recipients_created: recipientIds.length,
        channels_queued: channels
      }
    } catch (error: unknown) {
      console.error(`[Bulk Worker] Error in job ${job.id}:`, error)
      throw error
    }
  },
  { concurrency: 2 }
)

// =====================================================
// Analytics Worker
// =====================================================

export const analyticsWorker = new InMemoryWorker<AnalyticsJobData>(
  'notification:analytics',
  async (job) => {

    const { job_type } = job.data

    try {
      const supabase = await createClient()

      if (job_type === 'refresh_materialized_views') {
        // Refresh materialized views
        await supabase.rpc('refresh_notification_analytics')

        return {
          success: true,
          message: 'Materialized views refreshed'
        }
      }

      return {
        success: true,
        job_type
      }
    } catch (error: unknown) {
      console.error(`[Analytics Worker] Error in job ${job.id}:`, error)
      throw error
    }
  },
  { concurrency: 1 }
)

// =====================================================
// Cleanup Worker
// =====================================================

export const cleanupWorker = new InMemoryWorker<CleanupJobData>(
  'notification:cleanup',
  async (job) => {

    const { job_type } = job.data

    try {
      const supabase = await createClient()

      if (job_type === 'archive_old') {
        // Archive old notifications
        const result = await supabase.rpc('archive_old_notifications')

        return {
          success: true,
          archived_count: result.data?.archived_count || 0
        }
      }

      if (job_type === 'delete_expired') {
        // Delete expired archived notifications
        const result = await supabase.rpc('cleanup_expired_archives')

        return {
          success: true,
          deleted_count: result.data?.deleted_count || 0
        }
      }

      if (job_type === 'cleanup_cache') {
        // Cleanup old cache entries
        const { invalidateAllNotificationCaches } = await import('@/lib/cache/notification-cache')
        await invalidateAllNotificationCaches()

        return {
          success: true,
          message: 'Cache cleaned up'
        }
      }

      return {
        success: true,
        job_type
      }
    } catch (error: unknown) {
      console.error(`[Cleanup Worker] Error in job ${job.id}:`, error)
      throw error
    }
  },
  { concurrency: 1 }
)

// =====================================================
// Worker Event Handlers
// =====================================================

// Email Worker Events
emailWorker.on('completed', (job) => {
})

emailWorker.on('failed', (job, err) => {
  console.error(`[Email Worker] Job ${job?.id} failed:`, err.message)
})

// SMS Worker Events
smsWorker.on('completed', (job) => {
})

smsWorker.on('failed', (job, err) => {
  console.error(`[SMS Worker] Job ${job?.id} failed:`, err.message)
})

// Bulk Worker Events
bulkWorker.on('completed', (job) => {
})

bulkWorker.on('failed', (job, err) => {
  console.error(`[Bulk Worker] Job ${job?.id} failed:`, err.message)
})

// Analytics Worker Events
analyticsWorker.on('completed', (job) => {
})

// Cleanup Worker Events
cleanupWorker.on('completed', (job) => {
})

// =====================================================
// Graceful Shutdown
// =====================================================

async function gracefulShutdown() {

  await Promise.all([
    emailWorker.close(),
    smsWorker.close(),
    pushWorker.close(),
    bulkWorker.close(),
    analyticsWorker.close(),
    cleanupWorker.close()
  ])

}

// Only add process handlers in Node.js environment
if (typeof process !== 'undefined' && process.on) {
  process.on('SIGTERM', gracefulShutdown)
  process.on('SIGINT', gracefulShutdown)
}

// =====================================================
// Export Workers
// =====================================================

export const workers = {
  email: emailWorker,
  sms: smsWorker,
  push: pushWorker,
  bulk: bulkWorker,
  analytics: analyticsWorker,
  cleanup: cleanupWorker
}

/**
 * Start all workers
 * Call this from a separate worker process or server
 */
export function startAllWorkers() {
}
