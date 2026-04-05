/**
 * Credit Appraisal Engine (CAE) Service
 * Orchestrates credit appraisal processing across providers
 *
 * Features:
 * - Multi-provider credit bureau integration
 * - Rules-based decision engine
 * - Data validation and sanitization
 * - Audit logging and security
 */

import { createClient } from '@/lib/supabase/server'
import { MockCAEAdapter } from './adapters/mock-adapter'
import { CIBILAdapter } from './adapters/cibil-adapter'
import { ExperianAdapter } from './adapters/experian-adapter'
import { EquifaxAdapter } from './adapters/equifax-adapter'
import {
  CAEProviderAdapter,
  CAEProviderType,
  CAERequest,
  CAEResponse,
  CAEProviderConfig,
  CreditAppraisalRecord,
  CAMStatus,
} from './types'
import { createValidationEngine, ValidationResult } from './validation-engine'
import { createRulesEngine, RulesEngineResult } from './rules-engine'
import { maskSensitiveData, auditLogger } from './security'

export class CAEService {
  private adapters: Map<CAEProviderType, CAEProviderAdapter> = new Map()
  private defaultProvider: CAEProviderType = 'MOCK'

  constructor() {
    // Initialize with mock adapter by default
    this.registerAdapter(new MockCAEAdapter())

    // Register production adapters (will use sandbox mode by default)
    this.registerAdapter(new CIBILAdapter({
      id: 'cibil-default',
      name: 'CIBIL',
      provider_type: 'CIBIL',
      is_active: true,
      priority: 1,
      timeout_ms: 30000,
      retry_count: 2,
      config: { environment: 'sandbox' },
    }))

    this.registerAdapter(new ExperianAdapter({
      id: 'experian-default',
      name: 'Experian',
      provider_type: 'EXPERIAN',
      is_active: true,
      priority: 2,
      timeout_ms: 30000,
      retry_count: 2,
      config: { environment: 'sandbox' },
    }))

    this.registerAdapter(new EquifaxAdapter({
      id: 'equifax-default',
      name: 'Equifax',
      provider_type: 'EQUIFAX',
      is_active: true,
      priority: 3,
      timeout_ms: 30000,
      retry_count: 2,
      config: { environment: 'sandbox' },
    }))
  }

  /**
   * Register a CAE provider adapter
   */
  registerAdapter(adapter: CAEProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter)
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(provider: CAEProviderType): void {
    if (!this.adapters.has(provider)) {
      throw new Error(`Provider ${provider} not registered`)
    }
    this.defaultProvider = provider
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): CAEProviderType[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * Validate a CAE request before processing
   */
  async validateRequest(
    request: CAERequest,
    options?: { loanType?: string; employmentType?: string }
  ): Promise<ValidationResult> {
    const supabase = await createClient()
    const validationEngine = createValidationEngine(supabase)

    return validationEngine.validate(request, {
      sanitize: true,
      loanType: options?.loanType || request.loan_type,
      employmentType: options?.employmentType || request.employment_type,
    })
  }

  /**
   * Evaluate business rules for a request and result
   */
  async evaluateRules(
    request: CAERequest,
    result?: any
  ): Promise<RulesEngineResult> {
    const supabase = await createClient()
    const rulesEngine = createRulesEngine(supabase)

    return rulesEngine.evaluateRules({
      request,
      result,
    })
  }

  /**
   * Process a credit appraisal for a lead
   * BUG FIX #5: Added transaction support with rollback on failure
   */
  async processAppraisal(
    leadId: string,
    provider?: CAEProviderType,
    options?: { skipValidation?: boolean; userId?: string }
  ): Promise<{ success: boolean; appraisalId?: string; error?: string; validationErrors?: string[] }> {
    const supabase = await createClient()

    // Generate transaction ID for tracking related operations
    const transactionId = crypto.randomUUID()

    try {
      // 1. Fetch lead data
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle()

      if (leadError || !lead) {
        auditLogger.log({
          action: 'PROCESS_APPRAISAL',
          resourceType: 'LEAD',
          resourceId: leadId,
          userId: options?.userId,
          status: 'FAILURE',
          errorMessage: 'Lead not found',
          metadata: { transaction_id: transactionId },
        })
        return { success: false, error: 'Lead not found' }
      }

      // 2. Check if CAM already exists
      if (lead.cam_status === 'COMPLETED') {
        const { data: existingAppraisal } = await supabase
          .from('credit_appraisals')
          .select('id, cam_id')
          .eq('lead_id', leadId)
          .eq('status', 'COMPLETED')
          .maybeSingle()

        if (existingAppraisal) {
          return { success: true, appraisalId: existingAppraisal.id }
        }
      }

      // 3. Build CAE request from lead data
      const caeRequest = this.buildCAERequest(lead)

      // 4. Validate request (unless skipped)
      if (!options?.skipValidation) {
        const validation = await this.validateRequest(caeRequest)
        if (!validation.valid) {
          auditLogger.log({
            action: 'PROCESS_APPRAISAL',
            resourceType: 'LEAD',
            resourceId: leadId,
            userId: options?.userId,
            status: 'FAILURE',
            errorMessage: 'Validation failed',
            metadata: {
              errors: validation.errors.map(e => e.message),
              transaction_id: transactionId,
            },
          })
          return {
            success: false,
            error: 'Validation failed',
            validationErrors: validation.errors.map(e => e.message),
          }
        }
      }

      // 4. Fetch co-applicants if any
      if (lead.co_applicant_count > 0) {
        const { data: coApplicants } = await supabase
          .from('lead_co_applicants')
          .select('*')
          .eq('lead_id', leadId)

        if (coApplicants && coApplicants.length > 0) {
          caeRequest.co_applicants = coApplicants.map((ca) => ({
            name: ca.full_name || ca.entity_name || 'Unknown',
            mobile: ca.mobile_number,
            pan: ca.pan_number,
            aadhar: ca.aadhar_number,
            dob: ca.date_of_birth,
            relationship: ca.relationship,
            income: ca.monthly_income,
            income_considered: ca.income_considered,
            income_percentage: ca.income_percentage_considered || 100,
          }))
        }
      }

      // 5. Generate CAM ID
      const { data: camIdResult } = await supabase.rpc('generate_cam_appraisal_id')
      const camId = camIdResult || `CAM-${Date.now()}`

      // 6. Create appraisal record with transaction tracking
      const { data: appraisal, error: insertError } = await supabase
        .from('credit_appraisals')
        .insert({
          lead_id: leadId,
          cam_id: camId,
          provider: provider || this.defaultProvider,
          status: 'PROCESSING',
          request_payload: caeRequest,
          retry_count: 0,
          transaction_id: transactionId,
          max_retries: 3,
        })
        .select()
        .maybeSingle()

      if (insertError || !appraisal) {
        console.error('Failed to create appraisal record:', insertError)

        // Rollback: No records created yet, just log
        auditLogger.log({
          action: 'PROCESS_APPRAISAL',
          resourceType: 'LEAD',
          resourceId: leadId,
          userId: options?.userId,
          status: 'FAILURE',
          errorMessage: 'Failed to create appraisal record',
          metadata: { transaction_id: transactionId, error: insertError?.message },
        })

        return { success: false, error: 'Failed to create appraisal record' }
      }

      // 7. Update lead CAM status
      const { error: leadUpdateError } = await supabase
        .from('leads')
        .update({ cam_status: 'PROCESSING' })
        .eq('id', leadId)

      if (leadUpdateError) {
        console.error('Failed to update lead status:', leadUpdateError)

        // Rollback: Delete appraisal record
        await this.rollbackTransaction(transactionId, 'Failed to update lead status')

        return { success: false, error: 'Failed to update lead status' }
      }

      // 8. Process with adapter (async) - transaction ID passed for tracking
      this.processWithAdapter(
        appraisal.id,
        leadId,
        caeRequest,
        provider || this.defaultProvider,
        transactionId
      )

      // Log successful transaction start
      auditLogger.log({
        action: 'PROCESS_APPRAISAL_START',
        resourceType: 'LEAD',
        resourceId: leadId,
        userId: options?.userId,
        status: 'SUCCESS',
        metadata: {
          transaction_id: transactionId,
          appraisal_id: appraisal.id,
          provider: provider || this.defaultProvider,
        },
      })

      return { success: true, appraisalId: appraisal.id }
    } catch (error) {
      console.error('CAE processing error:', error)

      // Rollback transaction on any error
      await this.rollbackTransaction(transactionId, error instanceof Error ? error.message : 'Unknown error')

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Process appraisal with provider adapter (runs async)
   * BUG FIX #5: Enhanced with transaction tracking and rollback support
   * BUG FIX #6: Automatic provider fallback on failure
   */
  private async processWithAdapter(
    appraisalId: string,
    leadId: string,
    request: CAERequest,
    providerType: CAEProviderType,
    transactionId: string
  ): Promise<void> {
    const supabase = await createClient()
    const startTime = Date.now()

    try {
      // Get fallback chain for this provider type
      const fallbackChain = await this.getFallbackProviderChain(providerType)

      let lastError: Error | null = null
      let attemptedProviders: string[] = []

      // Try each provider in the fallback chain
      for (const currentProviderType of fallbackChain) {
        const adapter = this.adapters.get(currentProviderType)
        if (!adapter) {
          console.warn(`[CAE] Provider ${currentProviderType} adapter not available, skipping`)
          attemptedProviders.push(`${currentProviderType} (not available)`)
          continue
        }

        try {
          console.log(`[CAE] Attempting provider: ${currentProviderType} (fallback chain: ${fallbackChain.join(' → ')})`)
          attemptedProviders.push(currentProviderType)

          // Process appraisal with timeout (30 seconds default)
          const timeout = 30000 // 30 seconds
          const response = await this.withTimeout(
            adapter.processAppraisal(request),
            timeout,
            `Provider ${currentProviderType} timeout after ${timeout}ms`
          )

          // Log API call
          await this.logAPICall(leadId, currentProviderType, request, response, Date.now() - startTime)

          // If successful, process the response
          if (response.success && response.data) {
            // Log successful fallback if not primary provider
            if (currentProviderType !== providerType) {
              auditLogger.log({
                action: 'PROVIDER_FALLBACK_SUCCESS',
                resourceType: 'APPRAISAL',
                resourceId: appraisalId,
                status: 'SUCCESS',
                metadata: {
                  transaction_id: transactionId,
                  primary_provider: providerType,
                  successful_provider: currentProviderType,
                  attempted_providers: attemptedProviders,
                  fallback_chain: fallbackChain,
                },
              })
            }

            // Process successful response (continue with existing code)
            const { error: updateError } = await supabase
              .from('credit_appraisals')
              .update({
                status: 'COMPLETED',
                provider: currentProviderType, // Update to actual provider used
                response_payload: response,
                credit_score: response.data.credit_score,
                risk_grade: response.data.risk_grade,
                risk_score: response.data.risk_score,
                eligible_loan_amount: response.data.eligible_loan_amount,
                recommendation: response.data.recommendation,
                processing_time_ms: response.processing_time_ms,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', appraisalId)

            if (updateError) {
              console.error('Failed to update appraisal:', updateError)
              throw new Error('Failed to update appraisal record')
            }

            // Update lead with CAM data
            const { error: leadUpdateError } = await supabase
              .from('leads')
              .update({
                cam_status: 'COMPLETED',
                cam_generated_at: new Date().toISOString(),
              })
              .eq('id', leadId)

            if (leadUpdateError) {
              console.error('Failed to update lead:', leadUpdateError)
              throw new Error('Failed to update lead status')
            }

            // Log successful completion
            auditLogger.log({
              action: 'PROCESS_APPRAISAL_COMPLETE',
              resourceType: 'LEAD',
              resourceId: leadId,
              status: 'SUCCESS',
              metadata: {
                transaction_id: transactionId,
                appraisal_id: appraisalId,
                provider: currentProviderType,
                credit_score: response.data.credit_score,
                recommendation: response.data.recommendation,
                fallback_used: currentProviderType !== providerType,
              },
            })

            // Success! Exit the fallback loop
            return
          } else {
            // Provider returned error, try next in chain
            lastError = new Error(response.error || 'Provider processing failed')
            console.warn(`[CAE] Provider ${currentProviderType} failed: ${response.error}`)
            continue
          }
        } catch (error) {
          // Provider threw exception, try next in chain
          lastError = error instanceof Error ? error : new Error('Unknown error')
          console.warn(`[CAE] Provider ${currentProviderType} threw error: ${lastError.message}`)
          continue
        }
      }

      // All providers failed - log and rollback
      console.error(`[CAE] All providers failed for appraisal ${appraisalId}. Attempted: ${attemptedProviders.join(', ')}`)

      auditLogger.log({
        action: 'PROVIDER_FALLBACK_EXHAUSTED',
        resourceType: 'APPRAISAL',
        resourceId: appraisalId,
        status: 'FAILURE',
        errorMessage: `All providers failed: ${lastError?.message}`,
        metadata: {
          transaction_id: transactionId,
          attempted_providers: attemptedProviders,
          fallback_chain: fallbackChain,
          last_error: lastError?.message,
        },
      })

      // Rollback transaction
      await this.rollbackTransaction(transactionId, `All providers failed: ${lastError?.message}`)

      await supabase
        .from('credit_appraisals')
        .update({
          status: 'FAILED',
          error_message: `All providers failed. Attempted: ${attemptedProviders.join(', ')}. Last error: ${lastError?.message}`,
          processing_time_ms: Date.now() - startTime,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appraisalId)

      await supabase.from('leads').update({ cam_status: 'FAILED' }).eq('id', leadId)

    } catch (error) {
      console.error('Adapter processing error:', error)

      // Rollback transaction on error
      await this.rollbackTransaction(
        transactionId,
        error instanceof Error ? error.message : 'Processing failed'
      )

      // Update with error
      await supabase
        .from('credit_appraisals')
        .update({
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : 'Processing failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', appraisalId)

      await supabase.from('leads').update({ cam_status: 'FAILED' }).eq('id', leadId)
    }
  }

  /**
   * Get fallback provider chain for a given provider type
   * BUG FIX #6: Returns ordered list of providers to try (primary + fallbacks)
   */
  private async getFallbackProviderChain(primaryProvider: CAEProviderType): Promise<CAEProviderType[]> {
    try {
      const supabase = await createClient()

      // Get all active providers of the same type from database
      const { data: providers, error } = await supabase
        .from('cae_providers')
        .select('provider_type, is_active, priority')
        .eq('is_active', true)
        .order('priority', { ascending: true })

      if (error || !providers) {
        console.warn('[CAE] Could not fetch provider fallback chain, using primary only')
        return [primaryProvider]
      }

      // Get the provider type of the primary provider
      const primaryProviderData = providers.find(p => p.provider_type === primaryProvider)
      const providerCategory = this.getProviderCategory(primaryProvider)

      // Get all providers in the same category, sorted by priority
      const fallbackChain: CAEProviderType[] = []

      // Add primary provider first
      fallbackChain.push(primaryProvider)

      // Add other active providers as fallbacks (for now, just credit bureau providers)
      if (providerCategory === 'CREDIT_BUREAU') {
        const creditBureauProviders: CAEProviderType[] = ['CIBIL', 'EXPERIAN', 'EQUIFAX']

        for (const provider of creditBureauProviders) {
          if (provider !== primaryProvider && this.adapters.has(provider)) {
            fallbackChain.push(provider)
          }
        }
      }

      console.log(`[CAE] Fallback chain for ${primaryProvider}: ${fallbackChain.join(' → ')}`)
      return fallbackChain
    } catch (error) {
      console.error('[CAE] Error building fallback chain:', error)
      return [primaryProvider]
    }
  }

  /**
   * Get provider category for fallback logic
   */
  private getProviderCategory(provider: CAEProviderType): string {
    const creditBureauProviders: CAEProviderType[] = ['CIBIL', 'EXPERIAN', 'EQUIFAX', 'CRIF']

    if (creditBureauProviders.includes(provider)) {
      return 'CREDIT_BUREAU'
    }

    return 'OTHER'
  }

  /**
   * Get appraisal status
   */
  async getAppraisalStatus(appraisalId: string): Promise<CreditAppraisalRecord | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('credit_appraisals')
      .select('*')
      .eq('id', appraisalId)
      .maybeSingle()

    if (error || !data) return null

    return data as CreditAppraisalRecord
  }

  /**
   * Get appraisal by lead ID
   */
  async getAppraisalByLeadId(leadId: string): Promise<CreditAppraisalRecord | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('credit_appraisals')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null

    return data as CreditAppraisalRecord
  }

  /**
   * Retry failed appraisal
   * BUG FIX #5: Respects max_retries limit from database
   */
  async retryAppraisal(appraisalId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    const { data: appraisal, error } = await supabase
      .from('credit_appraisals')
      .select('*')
      .eq('id', appraisalId)
      .maybeSingle()

    if (error || !appraisal) {
      return { success: false, error: 'Appraisal not found' }
    }

    if (appraisal.status !== 'FAILED') {
      return { success: false, error: 'Can only retry failed appraisals' }
    }

    // Check max retries (use from database or default to 3)
    const maxRetries = appraisal.max_retries || 3

    if (appraisal.retry_count >= maxRetries) {
      auditLogger.log({
        action: 'RETRY_APPRAISAL',
        resourceType: 'APPRAISAL',
        resourceId: appraisalId,
        status: 'FAILURE',
        errorMessage: `Maximum retry attempts exceeded (${maxRetries})`,
        metadata: {
          transaction_id: appraisal.transaction_id,
          retry_count: appraisal.retry_count,
          max_retries: maxRetries,
        },
      })

      return { success: false, error: `Maximum retry attempts exceeded (${maxRetries})` }
    }

    // Generate new transaction ID for retry
    const newTransactionId = crypto.randomUUID()

    // Increment retry count and reset status
    await supabase
      .from('credit_appraisals')
      .update({
        status: 'PROCESSING',
        retry_count: appraisal.retry_count + 1,
        error_message: null,
        transaction_id: newTransactionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appraisalId)

    // Log retry attempt
    auditLogger.log({
      action: 'RETRY_APPRAISAL',
      resourceType: 'APPRAISAL',
      resourceId: appraisalId,
      status: 'SUCCESS',
      metadata: {
        transaction_id: newTransactionId,
        previous_transaction_id: appraisal.transaction_id,
        retry_count: appraisal.retry_count + 1,
        max_retries: maxRetries,
      },
    })

    // Re-process with new transaction ID
    this.processWithAdapter(
      appraisalId,
      appraisal.lead_id,
      appraisal.request_payload,
      appraisal.provider,
      newTransactionId
    )

    return { success: true }
  }

  /**
   * Build CAE request from lead data
   */
  private buildCAERequest(lead: any): CAERequest {
    return {
      lead_id: lead.lead_id,
      customer_name: lead.customer_name,
      customer_mobile: lead.customer_mobile,
      customer_pan: lead.customer_pan,
      customer_aadhar: lead.customer_aadhar,
      customer_dob: lead.customer_dob,
      customer_email: lead.customer_email,
      customer_address: lead.customer_address,
      customer_city: lead.customer_city,
      customer_state: lead.customer_state,
      customer_pincode: lead.customer_pincode,
      loan_type: lead.loan_type,
      loan_amount: lead.required_loan_amount,
      employment_type: lead.employment_type,
      monthly_income: lead.monthly_income,
      employer_name: lead.employer_name,
      years_of_employment: lead.years_of_employment,
      existing_emis: lead.existing_emis,
    }
  }

  /**
   * Log API call for analytics
   */
  private async logAPICall(
    leadId: string,
    provider: CAEProviderType,
    request: any,
    response: CAEResponse,
    duration: number
  ): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase.from('cae_api_logs').insert({
        lead_id: leadId,
        provider,
        endpoint: 'processAppraisal',
        request_payload: request,
        response_payload: response,
        status_code: response.success ? 200 : 500,
        response_time_ms: duration,
        is_success: response.success,
        error_message: response.error,
      })
    } catch (error) {
      console.error('Failed to log API call:', error)
    }
  }

  /**
   * Wrapper to add timeout to async operations
   * BUG FIX #1: Prevents API calls from hanging indefinitely
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(errorMessage))
      }, timeoutMs)
    })

    try {
      const result = await Promise.race([promise, timeoutPromise])
      clearTimeout(timeoutHandle!)
      return result
    } catch (error) {
      clearTimeout(timeoutHandle!)
      throw error
    }
  }

  /**
   * Rollback transaction on failure
   * BUG FIX #5: Cleans up partial data on transaction failure
   */
  private async rollbackTransaction(transactionId: string, reason: string): Promise<void> {
    try {
      const supabase = await createClient()

      console.log(`[CAE] Rolling back transaction ${transactionId}: ${reason}`)

      // Get all appraisals with this transaction ID
      const { data: appraisals } = await supabase
        .from('credit_appraisals')
        .select('id, lead_id, status')
        .eq('transaction_id', transactionId)

      if (!appraisals || appraisals.length === 0) {
        console.log('[CAE] No appraisals found for transaction rollback')
        return
      }

      // For each appraisal in this transaction
      for (const appraisal of appraisals) {
        // If still in PROCESSING state, mark as FAILED
        if (appraisal.status === 'PROCESSING') {
          await supabase
            .from('credit_appraisals')
            .update({
              status: 'FAILED',
              error_message: `Transaction rollback: ${reason}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', appraisal.id)

          // Update lead status to FAILED
          await supabase
            .from('leads')
            .update({
              cam_status: 'FAILED',
              updated_at: new Date().toISOString(),
            })
            .eq('id', appraisal.lead_id)
        }

        // Clean up any partial CAM data
        await supabase
          .from('cams')
          .delete()
          .eq('appraisal_id', appraisal.id)
          .eq('status', 'DRAFT')

        // Clean up any partial verification results
        await supabase
          .from('verification_results')
          .delete()
          .eq('appraisal_id', appraisal.id)
          .is('completed_at', null)
      }

      // Log rollback for audit
      auditLogger.log({
        action: 'TRANSACTION_ROLLBACK',
        resourceType: 'TRANSACTION',
        resourceId: transactionId,
        status: 'SUCCESS',
        metadata: {
          reason,
          appraisals_affected: appraisals.length,
          appraisal_ids: appraisals.map(a => a.id),
        },
      })

      console.log(`[CAE] Transaction ${transactionId} rolled back successfully`)
    } catch (error) {
      console.error('[CAE] Failed to rollback transaction:', error)

      // Log rollback failure for audit
      auditLogger.log({
        action: 'TRANSACTION_ROLLBACK',
        resourceType: 'TRANSACTION',
        resourceId: transactionId,
        status: 'FAILURE',
        errorMessage: error instanceof Error ? error.message : 'Rollback failed',
        metadata: { reason },
      })
    }
  }
}

// Export singleton instance
export const caeService = new CAEService()
