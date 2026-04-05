/**
 * A/B Testing Service
 *
 * Features:
 * - Create and manage A/B tests for SMS/Email/WhatsApp templates
 * - Automatic traffic splitting
 * - Statistical analysis with chi-square test
 * - Auto-winner selection based on conversion rates
 * - Real-time analytics and insights
 */

import { createClient } from '@/lib/supabase/client'
import { smsService } from './unified-sms-service'

// =====================================================
// TYPES
// =====================================================

export interface CreateABTestParams {
  name: string
  description?: string
  messageType: 'sms' | 'email' | 'whatsapp'
  testType?: 'template' | 'subject' | 'sender' | 'timing'

  // Variants: Array of template codes or configurations
  variants: Array<{
    id: string // 'A', 'B', 'C', etc.
    templateCode?: string
    subject?: string
    senderId?: string
    customConfig?: Record<string, any>
  }>

  // Traffic split (must sum to 100)
  trafficSplit?: Record<string, number> // { "A": 50, "B": 50 }

  // Target audience
  segmentId?: string
  targetCount?: number

  // Test period
  startDate?: Date
  endDate?: Date

  // Winner selection
  autoSelectWinner?: boolean
  confidenceThreshold?: number // 90, 95, 99
}

export interface ABTest {
  id: string
  name: string
  description: string
  message_type: string
  test_type: string
  variants: any[]
  traffic_split: Record<string, number>
  segment_id?: string
  target_count: number
  start_date?: string
  end_date?: string
  status: string
  winner_variant_id?: string
  winner_selected_at?: string
  auto_select_winner: boolean
  confidence_threshold: number
  created_at: string
}

export interface ABTestAnalytics {
  variant_id: string
  total_sent: number
  total_delivered: number
  total_failed: number
  total_opened: number
  total_clicked: number
  total_converted: number
  delivery_rate: number
  open_rate: number
  click_rate: number
  conversion_rate: number
  total_revenue: number
  sample_size: number
  confidence_level?: number
  p_value?: number
  is_significant?: boolean
}

export interface SendABTestMessageParams {
  testId: string
  recipients: string[] // Phone numbers or emails
  variables?: Record<string, string>
}

// =====================================================
// A/B TESTING SERVICE
// =====================================================

export class ABTestingService {
  private supabase = createClient()

  /**
   * Create new A/B test
   */
  async createABTest(params: CreateABTestParams) {
    try {
      // Validate traffic split
      if (params.trafficSplit) {
        const total = Object.values(params.trafficSplit).reduce((a, b) => a + b, 0)
        if (Math.abs(total - 100) > 0.01) {
          throw new Error('Traffic split must sum to 100%')
        }
      } else {
        // Equal split by default
        const splitPercent = 100 / params.variants.length
        params.trafficSplit = params.variants.reduce((acc, v) => {
          acc[v.id] = splitPercent
          return acc
        }, {} as Record<string, number>)
      }

      const { data, error } = await this.supabase
        .from('ab_tests')
        .insert({
          name: params.name,
          description: params.description,
          message_type: params.messageType,
          test_type: params.testType || 'template',
          variants: params.variants,
          traffic_split: params.trafficSplit,
          segment_id: params.segmentId,
          target_count: params.targetCount || 0,
          start_date: params.startDate?.toISOString(),
          end_date: params.endDate?.toISOString(),
          status: 'draft',
          auto_select_winner: params.autoSelectWinner ?? true,
          confidence_threshold: params.confidenceThreshold || 95
        })
        .select()
        .maybeSingle()

      if (error) {
        throw new Error(`Failed to create A/B test: ${error.message}`)
      }

      return {
        success: true,
        test: data
      }
    } catch (error) {
      console.error('Create A/B test error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create A/B test'
      }
    }
  }

  /**
   * Start A/B test
   */
  async startABTest(testId: string) {
    try {
      const { error } = await this.supabase
        .from('ab_tests')
        .update({
          status: 'running',
          start_date: new Date().toISOString()
        })
        .eq('id', testId)

      if (error) {
        throw error
      }

      return {
        success: true,
        message: 'A/B test started'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start test'
      }
    }
  }

  /**
   * Send messages for A/B test with automatic variant assignment
   */
  async sendABTestMessages(params: SendABTestMessageParams) {
    try {
      // Get test details
      const { data: test, error: testError } = await this.supabase
        .from('ab_tests')
        .select('*')
        .eq('id', params.testId)
        .maybeSingle()

      if (testError || !test) {
        throw new Error('Test not found')
      }

      if (test.status !== 'running') {
        throw new Error('Test is not running')
      }

      const results: any[] = []
      const variantAssignments: Record<string, string[]> = {}

      // Initialize variant assignments
      for (const variant of test.variants) {
        variantAssignments[variant.id] = []
      }

      // Assign recipients to variants based on traffic split
      for (let i = 0; i < params.recipients.length; i++) {
        const recipient = params.recipients[i]
        const variantId = this.assignVariant(i, test.traffic_split)
        variantAssignments[variantId].push(recipient)
      }

      // Send messages for each variant
      for (const variant of test.variants) {
        const recipients = variantAssignments[variant.id]
        if (recipients.length === 0) continue

        if (test.message_type === 'sms') {
          const smsResults = await smsService.send({
            to: recipients,
            templateCode: variant.templateCode!,
            variables: params.variables || {}
          })

          // Log results for A/B test tracking
          for (let i = 0; i < smsResults.length; i++) {
            const result = smsResults[i]
            await this.logABTestResult({
              testId: params.testId,
              variantId: variant.id,
              recipient: recipients[i],
              recipientType: 'phone',
              templateCode: variant.templateCode!,
              deliveryStatus: result.success ? 'sent' : 'failed',
              providerName: result.provider,
              providerMessageId: result.messageId,
              errorMessage: result.error
            })

            results.push({
              recipient: recipients[i],
              variantId: variant.id,
              ...result
            })
          }
        } else if (test.message_type === 'email') {
          // Email sending logic (to be implemented)
          console.log('Email A/B testing not yet implemented')
        } else if (test.message_type === 'whatsapp') {
          // WhatsApp sending logic (to be implemented)
          console.log('WhatsApp A/B testing not yet implemented')
        }
      }

      return {
        success: true,
        totalSent: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length,
        results
      }
    } catch (error) {
      console.error('Send A/B test messages error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send messages'
      }
    }
  }

  /**
   * Assign recipient to variant based on traffic split
   */
  private assignVariant(index: number, trafficSplit: Record<string, number>): string {
    const random = (index * 7919) % 100 // Deterministic pseudo-random

    let cumulative = 0
    for (const [variantId, percentage] of Object.entries(trafficSplit)) {
      cumulative += percentage
      if (random < cumulative) {
        return variantId
      }
    }

    return Object.keys(trafficSplit)[0] // Fallback
  }

  /**
   * Log A/B test result
   */
  private async logABTestResult(params: {
    testId: string
    variantId: string
    recipient: string
    recipientType: string
    templateCode: string
    deliveryStatus: string
    providerName?: string
    providerMessageId?: string
    errorMessage?: string
  }) {
    try {
      await this.supabase
        .from('ab_test_results')
        .insert({
          ab_test_id: params.testId,
          variant_id: params.variantId,
          recipient: params.recipient,
          recipient_type: params.recipientType,
          template_code: params.templateCode,
          sent_at: new Date().toISOString(),
          delivery_status: params.deliveryStatus,
          provider_name: params.providerName,
          provider_message_id: params.providerMessageId,
          error_message: params.errorMessage
        })
    } catch (error) {
      console.error('Failed to log A/B test result:', error)
    }
  }

  /**
   * Track conversion for A/B test
   */
  async trackConversion(params: {
    testId: string
    recipient: string
    conversionValue?: number
  }) {
    try {
      const { error } = await this.supabase
        .from('ab_test_results')
        .update({
          converted_at: new Date().toISOString(),
          conversion_value: params.conversionValue || 0
        })
        .eq('ab_test_id', params.testId)
        .eq('recipient', params.recipient)
        .is('converted_at', null) // Only track first conversion

      if (error) {
        throw error
      }

      return {
        success: true,
        message: 'Conversion tracked'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track conversion'
      }
    }
  }

  /**
   * Track email open for A/B test
   */
  async trackOpen(params: { testId: string; recipient: string }) {
    try {
      await this.supabase
        .from('ab_test_results')
        .update({ opened_at: new Date().toISOString() })
        .eq('ab_test_id', params.testId)
        .eq('recipient', params.recipient)
        .is('opened_at', null)

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to track open' }
    }
  }

  /**
   * Track email/link click for A/B test
   */
  async trackClick(params: { testId: string; recipient: string }) {
    try {
      await this.supabase
        .from('ab_test_results')
        .update({ clicked_at: new Date().toISOString() })
        .eq('ab_test_id', params.testId)
        .eq('recipient', params.recipient)
        .is('clicked_at', null)

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to track click' }
    }
  }

  /**
   * Get A/B test analytics
   */
  async getABTestAnalytics(testId: string): Promise<{
    success: boolean
    analytics?: ABTestAnalytics[]
    error?: string
  }> {
    try {
      // Calculate latest analytics
      const { error: calcError } = await this.supabase.rpc('calculate_ab_test_analytics', {
        test_id: testId
      })

      if (calcError) {
        console.error('Failed to calculate analytics:', calcError)
      }

      // Fetch analytics
      const { data, error } = await this.supabase
        .from('ab_test_analytics')
        .select('*')
        .eq('ab_test_id', testId)
        .order('conversion_rate', { ascending: false })

      if (error) {
        throw error
      }

      return {
        success: true,
        analytics: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics'
      }
    }
  }

  /**
   * Auto-select winner based on statistical significance
   */
  async selectWinner(testId: string) {
    try {
      const { data, error } = await this.supabase.rpc('auto_select_ab_test_winner', {
        test_id: testId
      })

      if (error) {
        throw error
      }

      return data || { success: false, error: 'Failed to select winner' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to select winner'
      }
    }
  }

  /**
   * Stop A/B test
   */
  async stopABTest(testId: string) {
    try {
      const { error } = await this.supabase
        .from('ab_tests')
        .update({
          status: 'completed',
          end_date: new Date().toISOString()
        })
        .eq('id', testId)

      if (error) {
        throw error
      }

      // Auto-select winner if enabled
      const { data: test } = await this.supabase
        .from('ab_tests')
        .select('auto_select_winner')
        .eq('id', testId)
        .maybeSingle()

      if (test?.auto_select_winner) {
        await this.selectWinner(testId)
      }

      return {
        success: true,
        message: 'A/B test stopped'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop test'
      }
    }
  }

  /**
   * Get all A/B tests
   */
  async getABTests(filter?: {
    status?: string
    messageType?: string
    limit?: number
  }) {
    try {
      let query = this.supabase
        .from('ab_tests')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter?.status) {
        query = query.eq('status', filter.status)
      }

      if (filter?.messageType) {
        query = query.eq('message_type', filter.messageType)
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
        tests: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tests'
      }
    }
  }

  /**
   * Get A/B test details
   */
  async getABTest(testId: string) {
    try {
      const { data, error } = await this.supabase
        .from('ab_tests')
        .select('*')
        .eq('id', testId)
        .maybeSingle()

      if (error) {
        throw error
      }

      return {
        success: true,
        test: data
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch test'
      }
    }
  }

  /**
   * Delete A/B test
   */
  async deleteABTest(testId: string) {
    try {
      const { error } = await this.supabase
        .from('ab_tests')
        .delete()
        .eq('id', testId)

      if (error) {
        throw error
      }

      return {
        success: true,
        message: 'A/B test deleted'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete test'
      }
    }
  }
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let abTestingInstance: ABTestingService | null = null

export function getABTestingService(): ABTestingService {
  if (!abTestingInstance) {
    abTestingInstance = new ABTestingService()
  }
  return abTestingInstance
}

// Convenience export
export const abTestingService = getABTestingService()
