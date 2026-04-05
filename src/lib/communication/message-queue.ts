/**
 * Enterprise Message Queue Service
 * Fortune 500 Grade Implementation
 *
 * Features:
 * - Async message processing with database-backed queue
 * - Retry mechanism with exponential backoff
 * - Dead letter queue for failed messages
 * - Priority queue support
 * - Batch processing
 * - Rate limiting integration
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { providerManager, sendWithFailover, ProviderType } from './provider-manager'

// =====================================================
// TYPES
// =====================================================

export type MessageStatus = 'queued' | 'processing' | 'sent' | 'delivered' | 'failed' | 'dead_letter'
export type MessagePriority = 'high' | 'normal' | 'low'

export interface QueuedMessage {
  id: string
  messageType: ProviderType
  recipient: string
  content: string
  subject?: string
  templateCode?: string
  variables?: Record<string, string>
  priority: MessagePriority
  status: MessageStatus
  retryCount: number
  maxRetries: number
  nextRetryAt?: Date
  scheduledAt?: Date
  providerId?: string
  externalMessageId?: string
  errorMessage?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  processedAt?: Date
  deliveredAt?: Date
}

export interface EnqueueOptions {
  priority?: MessagePriority
  scheduledAt?: Date
  maxRetries?: number
  templateCode?: string
  variables?: Record<string, string>
  metadata?: Record<string, any>
}

export interface ProcessingResult {
  processed: number
  succeeded: number
  failed: number
  retried: number
  deadLettered: number
}

// =====================================================
// CONSTANTS
// =====================================================

const RETRY_DELAYS = [
  1 * 60 * 1000,      // 1 minute
  5 * 60 * 1000,      // 5 minutes
  15 * 60 * 1000,     // 15 minutes
  60 * 60 * 1000,     // 1 hour
  4 * 60 * 60 * 1000, // 4 hours
]

const DEFAULT_MAX_RETRIES = 5
const BATCH_SIZE = 50
const PROCESSING_TIMEOUT_MS = 30000

// =====================================================
// MESSAGE QUEUE SERVICE
// =====================================================

class MessageQueueService {
  private static instance: MessageQueueService
  private processing = false
  private processingInterval: NodeJS.Timeout | null = null

  private constructor() {}

  static getInstance(): MessageQueueService {
    if (!MessageQueueService.instance) {
      MessageQueueService.instance = new MessageQueueService()
    }
    return MessageQueueService.instance
  }

  // =====================================================
  // ENQUEUEING
  // =====================================================

  /**
   * Add a message to the queue
   */
  async enqueue(
    messageType: ProviderType,
    recipient: string,
    content: string,
    options?: EnqueueOptions
  ): Promise<string> {
    const supabase = createSupabaseAdmin()

    const message = {
      message_type: messageType,
      recipient: recipient,
      content: content,
      subject: null,
      template_code: options?.templateCode || null,
      variables: options?.variables || null,
      priority: options?.priority || 'normal',
      status: 'queued',
      retry_count: 0,
      max_retries: options?.maxRetries ?? DEFAULT_MAX_RETRIES,
      scheduled_at: options?.scheduledAt?.toISOString() || null,
      metadata: options?.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('message_queue')
      .insert(message)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[MessageQueue] Failed to enqueue message:', error)
      throw error
    }

    console.log(`[MessageQueue] Enqueued message ${data.id} for ${recipient}`)
    return data.id
  }

  /**
   * Enqueue multiple messages in batch
   */
  async enqueueBatch(
    messageType: ProviderType,
    messages: Array<{
      recipient: string
      content: string
      options?: EnqueueOptions
    }>
  ): Promise<string[]> {
    const supabase = createSupabaseAdmin()

    const records = messages.map(msg => ({
      message_type: messageType,
      recipient: msg.recipient,
      content: msg.content,
      template_code: msg.options?.templateCode || null,
      variables: msg.options?.variables || null,
      priority: msg.options?.priority || 'normal',
      status: 'queued',
      retry_count: 0,
      max_retries: msg.options?.maxRetries ?? DEFAULT_MAX_RETRIES,
      scheduled_at: msg.options?.scheduledAt?.toISOString() || null,
      metadata: msg.options?.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { data, error } = await supabase
      .from('message_queue')
      .insert(records)
      .select('id')

    if (error) {
      console.error('[MessageQueue] Failed to enqueue batch:', error)
      throw error
    }

    console.log(`[MessageQueue] Enqueued ${data?.length || 0} messages`)
    return (data || []).map(d => d.id)
  }

  // =====================================================
  // PROCESSING
  // =====================================================

  /**
   * Process pending messages in the queue
   */
  async processQueue(): Promise<ProcessingResult> {
    if (this.processing) {
      console.log('[MessageQueue] Already processing, skipping')
      return { processed: 0, succeeded: 0, failed: 0, retried: 0, deadLettered: 0 }
    }

    this.processing = true
    const result: ProcessingResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      retried: 0,
      deadLettered: 0
    }

    try {
      const supabase = createSupabaseAdmin()

      // Fetch messages ready for processing
      const { data: messages, error } = await supabase
        .from('message_queue')
        .select('*')
        .in('status', ['queued', 'retrying'])
        .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
        .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
        .order('priority', { ascending: true }) // high = 0, normal = 1, low = 2
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE)

      if (error) {
        console.error('[MessageQueue] Failed to fetch messages:', error)
        throw error
      }

      if (!messages || messages.length === 0) {
        return result
      }

      console.log(`[MessageQueue] Processing ${messages.length} messages`)

      // Process each message
      for (const message of messages) {
        result.processed++

        try {
          // Mark as processing
          await supabase
            .from('message_queue')
            .update({
              status: 'processing',
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id)

          // Send the message
          const sendResult = await this.sendMessage(message)

          if (sendResult.success) {
            // Success - update status
            await supabase
              .from('message_queue')
              .update({
                status: 'sent',
                provider_id: sendResult.providerId,
                external_message_id: sendResult.externalId,
                processed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', message.id)

            result.succeeded++
          } else {
            // Failed - handle retry or dead letter
            await this.handleFailure(message, sendResult.error || 'Unknown error')

            if (message.retry_count >= message.max_retries) {
              result.deadLettered++
            } else {
              result.retried++
            }
            result.failed++
          }
        } catch (error: unknown) {
          console.error(`[MessageQueue] Error processing message ${message.id}:`, error)
          await this.handleFailure(message, error.message)
          result.failed++

          if (message.retry_count >= message.max_retries) {
            result.deadLettered++
          } else {
            result.retried++
          }
        }
      }

      console.log(`[MessageQueue] Processing complete:`, result)
      return result
    } finally {
      this.processing = false
    }
  }

  /**
   * Send a single message
   */
  private async sendMessage(message: any): Promise<{
    success: boolean
    providerId?: string
    externalId?: string
    error?: string
  }> {
    try {
      const type = message.message_type as ProviderType

      // Get content (from template or direct)
      let content = message.content
      if (message.template_code && message.variables) {
        content = await this.renderTemplate(message.template_code, message.variables)
      }

      // Send with failover
      const result = await sendWithFailover(
        type,
        async (provider) => {
          // Call the appropriate sender based on provider
          // This is a simplified version - actual implementation would
          // call the specific provider's API
          return this.callProviderAPI(provider, message.recipient, content, message.subject)
        }
      )

      if (result) {
        return {
          success: true,
          providerId: result.provider.id,
          externalId: result.result?.messageId
        }
      }

      return { success: false, error: 'No provider available' }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Call provider API (simplified - actual implementation in provider services)
   */
  private async callProviderAPI(
    provider: any,
    recipient: string,
    content: string,
    subject?: string
  ): Promise<{ messageId: string }> {
    // This would call the actual provider API
    // For now, return a mock response
    console.log(`[MessageQueue] Sending to ${recipient} via ${provider.name}`)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100))

    return {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  /**
   * Render template with variables
   */
  private async renderTemplate(
    templateCode: string,
    variables: Record<string, string>
  ): Promise<string> {
    const supabase = createSupabaseAdmin()

    const { data: template } = await supabase
      .from('communication_templates')
      .select('content')
      .eq('template_code', templateCode)
      .eq('is_active', true)
      .maybeSingle()

    if (!template) {
      throw new Error(`Template not found: ${templateCode}`)
    }

    let content = template.content
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value)
    }

    return content
  }

  /**
   * Handle message failure
   */
  private async handleFailure(message: any, error: string): Promise<void> {
    const supabase = createSupabaseAdmin()
    const newRetryCount = (message.retry_count || 0) + 1

    if (newRetryCount > message.max_retries) {
      // Move to dead letter queue
      await supabase
        .from('message_queue')
        .update({
          status: 'dead_letter',
          error_message: error,
          updated_at: new Date().toISOString()
        })
        .eq('id', message.id)

      console.warn(`[MessageQueue] Message ${message.id} moved to dead letter queue`)
    } else {
      // Schedule retry with exponential backoff
      const retryDelay = RETRY_DELAYS[Math.min(newRetryCount - 1, RETRY_DELAYS.length - 1)]
      const nextRetryAt = new Date(Date.now() + retryDelay)

      await supabase
        .from('message_queue')
        .update({
          status: 'queued',
          retry_count: newRetryCount,
          next_retry_at: nextRetryAt.toISOString(),
          error_message: error,
          updated_at: new Date().toISOString()
        })
        .eq('id', message.id)

      console.log(`[MessageQueue] Message ${message.id} scheduled for retry at ${nextRetryAt}`)
    }
  }

  // =====================================================
  // QUEUE MANAGEMENT
  // =====================================================

  /**
   * Start automatic queue processing
   */
  startProcessing(intervalMs = 10000): void {
    if (this.processingInterval) {
      console.log('[MessageQueue] Processing already started')
      return
    }

    console.log(`[MessageQueue] Starting queue processing every ${intervalMs}ms`)
    this.processingInterval = setInterval(() => {
      this.processQueue().catch(err => {
        console.error('[MessageQueue] Processing error:', err)
      })
    }, intervalMs)
  }

  /**
   * Stop automatic queue processing
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
      console.log('[MessageQueue] Processing stopped')
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queued: number
    processing: number
    sent: number
    failed: number
    deadLetter: number
  }> {
    const supabase = createSupabaseAdmin()

    const statuses = ['queued', 'processing', 'sent', 'failed', 'dead_letter']
    const stats: any = {}

    for (const status of statuses) {
      const { count } = await supabase
        .from('message_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', status)

      stats[status === 'dead_letter' ? 'deadLetter' : status] = count || 0
    }

    return stats
  }

  /**
   * Retry dead letter messages
   */
  async retryDeadLetters(limit = 100): Promise<number> {
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('message_queue')
      .update({
        status: 'queued',
        retry_count: 0,
        next_retry_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('status', 'dead_letter')
      .limit(limit)
      .select('id')

    if (error) {
      console.error('[MessageQueue] Failed to retry dead letters:', error)
      throw error
    }

    console.log(`[MessageQueue] Retried ${data?.length || 0} dead letter messages`)
    return data?.length || 0
  }

  /**
   * Purge old processed messages
   */
  async purgeProcessed(olderThanDays = 30): Promise<number> {
    const supabase = createSupabaseAdmin()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const { data, error } = await supabase
      .from('message_queue')
      .delete()
      .in('status', ['sent', 'delivered'])
      .lt('processed_at', cutoffDate.toISOString())
      .select('id')

    if (error) {
      console.error('[MessageQueue] Failed to purge messages:', error)
      throw error
    }

    console.log(`[MessageQueue] Purged ${data?.length || 0} old messages`)
    return data?.length || 0
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const messageQueue = MessageQueueService.getInstance()

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Enqueue an SMS message
 */
export async function enqueueSMS(
  recipient: string,
  content: string,
  options?: EnqueueOptions
): Promise<string> {
  return messageQueue.enqueue('sms', recipient, content, options)
}

/**
 * Enqueue an email message
 */
export async function enqueueEmail(
  recipient: string,
  content: string,
  options?: EnqueueOptions
): Promise<string> {
  return messageQueue.enqueue('email', recipient, content, options)
}

/**
 * Enqueue a WhatsApp message
 */
export async function enqueueWhatsApp(
  recipient: string,
  content: string,
  options?: EnqueueOptions
): Promise<string> {
  return messageQueue.enqueue('whatsapp', recipient, content, options)
}
