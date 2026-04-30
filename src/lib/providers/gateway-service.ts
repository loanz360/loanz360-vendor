// Unified Gateway Service with Provider Failover

import { createSMSProvider, SMSMessage, SMSResponse } from './sms'
import { createEmailProvider, EmailMessage, EmailResponse } from './email'
import { createClient } from '@/lib/supabase/server'

interface ProviderConfig {
  id: string
  type: 'sms' | 'email'
  provider_name: string
  config: Record<string, unknown>
  is_active: boolean
  priority: number
  rate_limit_per_minute?: number
  last_failure?: string
  failure_count: number
}

interface SendResult {
  success: boolean
  provider: string
  message_id?: string
  error?: string
  fallback_used?: boolean
}

class RateLimiter {
  private counts: Map<string, { count: number; resetAt: number }> = new Map()

  canSend(providerId: string, limit: number): boolean {
    const now = Date.now()
    const entry = this.counts.get(providerId)

    if (!entry || now > entry.resetAt) {
      this.counts.set(providerId, { count: 1, resetAt: now + 60000 })
      return true
    }

    if (entry.count >= limit) {
      return false
    }

    entry.count++
    return true
  }
}

export class GatewayService {
  private rateLimiter = new RateLimiter()

  async getActiveProviders(type: 'sms' | 'email'): Promise<ProviderConfig[]> {
    const supabase = await createClient()
    const { data: providers } = await supabase
      .from('communication_providers')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .order('priority', { ascending: true })

    return providers || []
  }

  async sendSMS(message: SMSMessage): Promise<SendResult> {
    const providers = await this.getActiveProviders('sms')

    if (providers.length === 0) {
      return { success: false, provider: 'none', error: 'No active SMS providers configured' }
    }

    let lastError = ''
    let fallbackUsed = false

    for (let i = 0; i < providers.length; i++) {
      const providerConfig = providers[i]

      // Check rate limit
      if (providerConfig.rate_limit_per_minute &&
          !this.rateLimiter.canSend(providerConfig.id, providerConfig.rate_limit_per_minute)) {
        continue
      }

      // Skip if recently failed too many times
      if (providerConfig.failure_count >= 5 && providerConfig.last_failure) {
        const lastFailure = new Date(providerConfig.last_failure)
        const cooldownPeriod = 5 * 60 * 1000 // 5 minutes
        if (Date.now() - lastFailure.getTime() < cooldownPeriod) {
          continue
        }
      }

      try {
        const provider = createSMSProvider(providerConfig.provider_name, providerConfig.config)
        const response = await provider.sendSMS(message)

        if (response.success) {
          // Reset failure count on success
          await this.resetFailureCount(providerConfig.id)

          // Log delivery
          await this.logDelivery({
            type: 'sms',
            provider: providerConfig.provider_name,
            recipient: Array.isArray(message.to) ? message.to.join(',') : message.to,
            message_id: response.message_id,
            status: 'sent',
            fallback_used: fallbackUsed
          })

          return {
            success: true,
            provider: providerConfig.provider_name,
            message_id: response.message_id,
            fallback_used: i > 0
          }
        }

        lastError = response.error || 'Unknown error'
        fallbackUsed = true
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Provider error'
        await this.incrementFailureCount(providerConfig.id)
        fallbackUsed = true
      }
    }

    // All providers failed
    await this.logDelivery({
      type: 'sms',
      provider: 'all_failed',
      recipient: Array.isArray(message.to) ? message.to.join(',') : message.to,
      status: 'failed',
      error: lastError
    })

    return { success: false, provider: 'all_failed', error: lastError }
  }

  async sendEmail(message: EmailMessage): Promise<SendResult> {
    const providers = await this.getActiveProviders('email')

    if (providers.length === 0) {
      return { success: false, provider: 'none', error: 'No active email providers configured' }
    }

    let lastError = ''
    let fallbackUsed = false

    for (let i = 0; i < providers.length; i++) {
      const providerConfig = providers[i]

      // Check rate limit
      if (providerConfig.rate_limit_per_minute &&
          !this.rateLimiter.canSend(providerConfig.id, providerConfig.rate_limit_per_minute)) {
        continue
      }

      try {
        const provider = createEmailProvider(providerConfig.provider_name, providerConfig.config)
        const response = await provider.sendEmail(message)

        if (response.success) {
          await this.resetFailureCount(providerConfig.id)

          await this.logDelivery({
            type: 'email',
            provider: providerConfig.provider_name,
            recipient: Array.isArray(message.to) ? message.to.join(',') : message.to,
            message_id: response.message_id,
            status: 'sent',
            subject: message.subject,
            fallback_used: fallbackUsed
          })

          return {
            success: true,
            provider: providerConfig.provider_name,
            message_id: response.message_id,
            fallback_used: i > 0
          }
        }

        lastError = response.error || 'Unknown error'
        fallbackUsed = true
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Provider error'
        await this.incrementFailureCount(providerConfig.id)
        fallbackUsed = true
      }
    }

    await this.logDelivery({
      type: 'email',
      provider: 'all_failed',
      recipient: Array.isArray(message.to) ? message.to.join(',') : message.to,
      status: 'failed',
      subject: message.subject,
      error: lastError
    })

    return { success: false, provider: 'all_failed', error: lastError }
  }

  private async logDelivery(data: {
    type: string
    provider: string
    recipient: string
    message_id?: string
    status: string
    subject?: string
    error?: string
    fallback_used?: boolean
  }) {
    try {
      const supabase = await createClient()
      await supabase.from('communication_delivery_logs').insert({
        type: data.type,
        provider: data.provider,
        recipient: data.recipient,
        message_id: data.message_id,
        status: data.status,
        subject: data.subject,
        error: data.error,
        metadata: { fallback_used: data.fallback_used },
        created_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to log delivery:', error)
    }
  }

  private async incrementFailureCount(providerId: string) {
    try {
      const supabase = await createClient()
      const { data: provider } = await supabase
        .from('communication_providers')
        .select('failure_count')
        .eq('id', providerId)
        .maybeSingle()

      await supabase
        .from('communication_providers')
        .update({
          failure_count: (provider?.failure_count || 0) + 1,
          last_failure: new Date().toISOString()
        })
        .eq('id', providerId)
    } catch (error) {
      console.error('Failed to update failure count:', error)
    }
  }

  private async resetFailureCount(providerId: string) {
    try {
      const supabase = await createClient()
      await supabase
        .from('communication_providers')
        .update({ failure_count: 0, last_failure: null })
        .eq('id', providerId)
    } catch (error) {
      console.error('Failed to reset failure count:', error)
    }
  }
}

export const gatewayService = new GatewayService()
