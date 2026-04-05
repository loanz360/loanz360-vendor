/**
 * ULAP Pipeline Service
 * Orchestrates the automated flow: ULAP Lead → CAM → Deal → BDE
 *
 * Flow:
 * 1. Phase 2 submitted → triggerCAMPipeline()
 * 2. Bridge leads record → partner_leads (for CAM system)
 * 3. Generate CAM using CAE
 * 4. On CAM success → create CRM deal
 * 5. Auto-assign BDE to the deal
 *
 * Key principle: BDE should NOT receive leads until CAM is complete.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createCAMService } from '@/lib/cae/cam-service'
import { createAutoAssignmentEngine } from '@/lib/cae/auto-assignment-engine'

interface PipelineResult {
  success: boolean
  pipeline_status: string
  partner_lead_id?: string
  cam_id?: string
  deal_id?: string
  bde_id?: string
  bde_name?: string
  error?: string
}

interface PipelineStatusResult {
  lead_number: string
  pipeline_status: string
  cam_status: string
  cam_id?: string
  cam_credit_score?: number
  cam_risk_grade?: string
  cam_eligible_amount?: number
  deal_id?: string
  deal_status?: string
  bde_name?: string
  bde_id?: string
  partner_lead_id?: string
  events: Array<{
    event_type: string
    event_status: string
    created_at: string
    event_data: Record<string, unknown>
  }>
}

export class ULAPPipelineService {
  private supabase: SupabaseClient

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Main entry point: Trigger the full CAM pipeline for a ULAP lead.
   * Called after Phase 2 submission.
   *
   * This method:
   * 1. Bridges the lead to partner_leads table
   * 2. Generates CAM
   * 3. Creates a deal from the completed CAM
   * 4. Assigns BDE to the deal
   */
  async triggerCAMPipeline(leadId: string): Promise<PipelineResult> {
    const startTime = Date.now()

    try {
      // 1. Get the lead
      const { data: lead, error: leadError } = await this.supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle()

      if (leadError || !lead) {
        return {
          success: false,
          pipeline_status: 'ERROR',
          error: `Lead not found: ${leadId}`,
        }
      }

      // Check if already processed
      if (lead.pipeline_status === 'BDE_ASSIGNED' || lead.pipeline_status === 'COMPLETED') {
        return {
          success: true,
          pipeline_status: lead.pipeline_status,
          partner_lead_id: lead.partner_lead_id,
          cam_id: lead.cam_id,
          deal_id: lead.crm_deal_id,
        }
      }

      // 2. Bridge to partner_leads (for CAM system)
      const partnerLeadId = await this.bridgeToPartnerLead(leadId)
      if (!partnerLeadId) {
        await this.logEvent(leadId, lead.lead_number, 'BRIDGE_FAILED', 'FAILED', {
          error: 'Failed to bridge lead to partner_leads',
        })
        return {
          success: false,
          pipeline_status: 'CAM_FAILED',
          error: 'Failed to bridge lead to partner_leads for CAM processing',
        }
      }

      // 3. Generate CAM
      const camResult = await this.generateCAM(leadId, partnerLeadId, lead)
      if (!camResult.success) {
        // Update lead status to reflect failure
        await this.supabase
          .from('leads')
          .update({
            pipeline_status: 'CAM_FAILED',
            cam_status: 'FAILED',
            cam_error_message: camResult.error,
            cam_retry_count: (lead.cam_retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId)

        await this.logEvent(leadId, lead.lead_number, 'CAM_FAILED', 'FAILED', {
          error: camResult.error,
          partner_lead_id: partnerLeadId,
          retry_count: (lead.cam_retry_count || 0) + 1,
        })

        return {
          success: false,
          pipeline_status: 'CAM_FAILED',
          partner_lead_id: partnerLeadId,
          error: camResult.error,
        }
      }

      // 4. Create deal from completed CAM
      const dealResult = await this.createDeal(leadId, camResult.cam_id!, lead)
      if (!dealResult.success) {
        await this.logEvent(leadId, lead.lead_number, 'DEAL_CREATION_FAILED', 'FAILED', {
          error: dealResult.error,
          cam_id: camResult.cam_id,
        })

        return {
          success: false,
          pipeline_status: 'CAM_COMPLETED',
          partner_lead_id: partnerLeadId,
          cam_id: camResult.cam_id,
          error: `CAM completed but deal creation failed: ${dealResult.error}`,
        }
      }

      // 5. Assign BDE to the deal
      const bdeResult = await this.assignBDE(leadId, dealResult.deal_id!, lead)

      const processingTime = Date.now() - startTime

      await this.logEvent(leadId, lead.lead_number, 'PIPELINE_COMPLETED', 'SUCCESS', {
        partner_lead_id: partnerLeadId,
        cam_id: camResult.cam_id,
        deal_id: dealResult.deal_id,
        bde_id: bdeResult.bde_id,
        bde_name: bdeResult.bde_name,
        processing_time_ms: processingTime,
      })

      return {
        success: true,
        pipeline_status: bdeResult.success ? 'BDE_ASSIGNED' : 'DEAL_CREATED',
        partner_lead_id: partnerLeadId,
        cam_id: camResult.cam_id,
        deal_id: dealResult.deal_id,
        bde_id: bdeResult.bde_id,
        bde_name: bdeResult.bde_name,
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown pipeline error'
      console.error('Pipeline error:', error)

      await this.logEvent(leadId, '', 'PIPELINE_ERROR', 'FAILED', {
        error: errorMessage,
      })

      return {
        success: false,
        pipeline_status: 'ERROR',
        error: errorMessage,
      }
    }
  }

  /**
   * Bridge a ULAP lead to partner_leads table for CAM processing.
   * Uses the DB function bridge_ulap_lead_to_partner_lead().
   */
  private async bridgeToPartnerLead(leadId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('bridge_ulap_lead_to_partner_lead', { p_lead_id: leadId })

      if (error) {
        console.error('Bridge RPC error:', error)
        return null
      }

      return data as string
    } catch (error) {
      console.error('Bridge error:', error)
      return null
    }
  }

  /**
   * Generate CAM for a partner_lead using the CAE service.
   */
  private async generateCAM(
    leadId: string,
    partnerLeadId: string,
    lead: Record<string, unknown>
  ): Promise<{ success: boolean; cam_id?: string; error?: string }> {
    try {
      // Update pipeline status
      await this.supabase
        .from('leads')
        .update({
          pipeline_status: 'CAM_PROCESSING',
          cam_status: 'PROCESSING',
          cam_initiated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      await this.logEvent(
        leadId,
        lead.lead_number as string,
        'CAM_GENERATION_STARTED',
        'SUCCESS',
        { partner_lead_id: partnerLeadId }
      )

      // Use the legacy CAM service (it works with partner_leads)
      const camService = createCAMService(this.supabase)
      const cam = await camService.generateCAM(partnerLeadId)

      if (!cam) {
        return {
          success: false,
          error: 'CAM generation returned null — insufficient lead data',
        }
      }

      // Save CAM to credit_appraisal_memos
      const { data: savedCAM, error: saveError } = await this.supabase
        .from('credit_appraisal_memos')
        .upsert({
          lead_id: partnerLeadId,
          cam_id: cam.cam_id,
          customer_profile: cam.customer,
          loan_details: cam.loan,
          income_analysis: cam.income_analysis,
          credit_analysis: cam.credit_analysis,
          risk_assessment: cam.risk_assessment,
          eligibility_analysis: cam.eligibility_analysis,
          document_summary: cam.document_summary,
          credit_score: cam.credit_analysis?.credit_score,
          risk_grade: cam.risk_assessment?.risk_grade,
          risk_score: cam.risk_assessment?.overall_risk_score,
          eligibility_score: cam.eligibility_analysis?.eligibility_score,
          is_eligible: cam.eligibility_analysis?.is_eligible,
          max_eligible_amount: cam.eligibility_analysis?.max_eligible_amount,
          recommended_amount: cam.loan?.recommended_amount,
          recommended_tenure: cam.eligibility_analysis?.recommended_tenure,
          recommended_emi: cam.eligibility_analysis?.recommended_emi,
          foir: cam.eligibility_analysis?.foir,
          dti: cam.eligibility_analysis?.dti,
          recommendation: cam.recommendation,
          recommendation_notes: cam.recommendation_notes,
          conditions: cam.conditions,
          risk_flags: cam.risk_assessment?.risk_flags,
          status: cam.status || 'COMPLETED',
          is_latest: true,
          version: 1,
          source: 'ulap_pipeline',
          prepared_by: 'SYSTEM',
          prepared_at: new Date().toISOString(),
          created_by: 'SYSTEM',
          last_modified_by: 'SYSTEM',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'cam_id',
        })
        .select('id')
        .maybeSingle()

      if (saveError) {
        console.error('CAM save error:', saveError)
        return {
          success: false,
          error: `CAM generated but save failed: ${saveError.message}`,
        }
      }

      const camId = savedCAM?.id

      // Update leads table with CAM results
      await this.supabase
        .from('leads')
        .update({
          pipeline_status: 'CAM_COMPLETED',
          cam_status: 'COMPLETED',
          cam_id: camId,
          cam_completed_at: new Date().toISOString(),
          cam_credit_score: cam.credit_analysis?.credit_score,
          cam_risk_grade: cam.risk_assessment?.risk_grade,
          cam_risk_score: cam.risk_assessment?.overall_risk_score,
          cam_recommendation: cam.recommendation,
          cam_eligible_amount: cam.eligibility_analysis?.max_eligible_amount,
          cam_foir: cam.eligibility_analysis?.foir,
          cam_dti: cam.eligibility_analysis?.dti,
          cam_provider: 'ulap_pipeline',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      await this.logEvent(
        leadId,
        lead.lead_number as string,
        'CAM_COMPLETED',
        'SUCCESS',
        {
          cam_id: camId,
          credit_score: cam.credit_analysis?.credit_score,
          risk_grade: cam.risk_assessment?.risk_grade,
          is_eligible: cam.eligibility_analysis?.is_eligible,
          eligible_amount: cam.eligibility_analysis?.max_eligible_amount,
        }
      )

      return { success: true, cam_id: camId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'CAM generation failed'
      console.error('CAM generation error:', error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Create a CRM deal from a completed ULAP lead + CAM.
   * Uses the DB function create_deal_from_ulap_lead().
   */
  private async createDeal(
    leadId: string,
    camId: string,
    lead: Record<string, unknown>
  ): Promise<{ success: boolean; deal_id?: string; error?: string }> {
    try {
      const { data: dealId, error } = await this.supabase
        .rpc('create_deal_from_ulap_lead', {
          p_lead_id: leadId,
          p_cam_id: camId,
          p_bde_user_id: null, // BDE assigned in next step
        })

      if (error) {
        console.error('Create deal RPC error:', error)
        return { success: false, error: error.message }
      }

      await this.logEvent(
        leadId,
        lead.lead_number as string,
        'DEAL_CREATED',
        'SUCCESS',
        { deal_id: dealId, cam_id: camId }
      )

      return { success: true, deal_id: dealId as string }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deal creation failed'
      console.error('Deal creation error:', error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Assign BDE to a deal using the AutoAssignmentEngine.
   * This is the final step — BDE only gets the deal AFTER CAM is complete.
   */
  private async assignBDE(
    leadId: string,
    dealId: string,
    lead: Record<string, unknown>
  ): Promise<{ success: boolean; bde_id?: string; bde_name?: string; error?: string }> {
    try {
      const engine = createAutoAssignmentEngine(this.supabase)

      const result = await engine.findBestBDE({
        lead_id: lead.partner_lead_id as string || leadId,
        loan_type: lead.loan_type as string || '',
        loan_amount: Number(lead.loan_amount) || 0,
        state: lead.customer_state as string,
        city: lead.customer_city as string,
        priority: (lead.lead_priority as 'HIGH' | 'MEDIUM' | 'LOW') || 'MEDIUM',
      })

      if (!result.success || !result.assigned_to_bde_id) {
        // No BDE available — deal stays unassigned, admin can manually assign
        await this.supabase
          .from('leads')
          .update({
            pipeline_status: 'DEAL_CREATED',
            lead_status: 'PENDING_ASSIGNMENT',
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId)

        await this.logEvent(
          leadId,
          lead.lead_number as string,
          'BDE_ASSIGNMENT_PENDING',
          'WARNING',
          {
            deal_id: dealId,
            reason: result.error || 'No matching BDE found',
          }
        )

        return {
          success: false,
          error: result.error || 'No matching BDE available',
        }
      }

      // Update the deal with BDE assignment
      await this.supabase
        .from('crm_deals')
        .update({
          bde_id: result.assigned_to_bde_id,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId)

      // Update leads table
      await this.supabase
        .from('leads')
        .update({
          pipeline_status: 'BDE_ASSIGNED',
          lead_status: 'ASSIGNED',
          assigned_bde_id: result.assigned_to_bde_id,
          assigned_bde_name: result.assigned_to_bde_name,
          assigned_at: new Date().toISOString(),
          assignment_type: 'AUTO_PIPELINE',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      // Update partner_leads with BDE assignment
      if (lead.partner_lead_id) {
        await this.supabase
          .from('partner_leads')
          .update({
            assigned_bde_id: result.assigned_to_bde_id,
            lead_status: 'ASSIGNED',
            assigned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.partner_lead_id)
      }

      // Send notification to BDE
      await this.supabase
        .from('notifications')
        .insert({
          user_id: result.assigned_to_bde_id,
          title: 'New Deal Assigned',
          message: `A new ${lead.loan_type} deal (₹${Number(lead.loan_amount).toLocaleString('en-IN')}) has been assigned to you. CAM is ready for review.`,
          type: 'DEAL_ASSIGNED',
          data: {
            deal_id: dealId,
            lead_id: leadId,
            lead_number: lead.lead_number,
            loan_type: lead.loan_type,
            loan_amount: lead.loan_amount,
            cam_ready: true,
          },
          is_read: false,
        })

      await this.logEvent(
        leadId,
        lead.lead_number as string,
        'BDE_ASSIGNED',
        'SUCCESS',
        {
          deal_id: dealId,
          bde_id: result.assigned_to_bde_id,
          bde_name: result.assigned_to_bde_name,
          assignment_reason: result.assignment_reason,
        }
      )

      return {
        success: true,
        bde_id: result.assigned_to_bde_id,
        bde_name: result.assigned_to_bde_name,
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'BDE assignment failed'
      console.error('BDE assignment error:', error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Get the current pipeline status for a lead.
   */
  async getPipelineStatus(leadNumber: string): Promise<PipelineStatusResult | null> {
    try {
      // Get lead data
      const { data: lead, error } = await this.supabase
        .from('leads')
        .select('*')
        .eq('lead_number', leadNumber)
        .maybeSingle()

      if (error || !lead) return null

      // Get pipeline events
      const { data: events } = await this.supabase
        .from('pipeline_events')
        .select('event_type, event_status, created_at, event_data')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true })

      // Get deal info if exists
      let dealStatus: string | undefined
      let bdeName: string | undefined

      if (lead.crm_deal_id) {
        const { data: deal } = await this.supabase
          .from('crm_deals')
          .select('status, bde_id')
          .eq('id', lead.crm_deal_id)
          .maybeSingle()

        dealStatus = deal?.status

        if (deal?.bde_id) {
          const { data: bde } = await this.supabase
            .from('users')
            .select('full_name')
            .eq('id', deal.bde_id)
            .maybeSingle()

          bdeName = bde?.full_name
        }
      }

      return {
        lead_number: leadNumber,
        pipeline_status: lead.pipeline_status || 'SUBMITTED',
        cam_status: lead.cam_status || 'NOT_REQUIRED',
        cam_id: lead.cam_id,
        cam_credit_score: lead.cam_credit_score,
        cam_risk_grade: lead.cam_risk_grade,
        cam_eligible_amount: lead.cam_eligible_amount,
        deal_id: lead.crm_deal_id,
        deal_status: dealStatus,
        bde_name: bdeName,
        bde_id: lead.assigned_bde_id,
        partner_lead_id: lead.partner_lead_id,
        events: events || [],
      }
    } catch (error) {
      console.error('Pipeline status error:', error)
      return null
    }
  }

  /**
   * Retry a failed pipeline from a specific step.
   */
  async retryPipeline(
    leadId: string,
    fromStep?: 'bridge' | 'cam' | 'deal' | 'bde'
  ): Promise<PipelineResult> {
    const { data: lead } = await this.supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle()

    if (!lead) {
      return { success: false, pipeline_status: 'ERROR', error: 'Lead not found' }
    }

    // Determine which step to retry from
    const step = fromStep || this.getRetryStep(lead.pipeline_status)

    await this.logEvent(leadId, lead.lead_number, 'PIPELINE_RETRY', 'SUCCESS', {
      from_step: step,
      previous_status: lead.pipeline_status,
    })

    switch (step) {
      case 'bridge':
        // Full retry from beginning
        return this.triggerCAMPipeline(leadId)

      case 'cam':
        // Retry CAM generation (bridge already done)
        if (!lead.partner_lead_id) {
          return this.triggerCAMPipeline(leadId) // Need bridge first
        }
        const camResult = await this.generateCAM(leadId, lead.partner_lead_id, lead)
        if (!camResult.success) {
          return {
            success: false,
            pipeline_status: 'CAM_FAILED',
            partner_lead_id: lead.partner_lead_id,
            error: camResult.error,
          }
        }
        // Continue to deal + BDE
        const dealResult = await this.createDeal(leadId, camResult.cam_id!, lead)
        if (!dealResult.success) {
          return {
            success: false,
            pipeline_status: 'CAM_COMPLETED',
            cam_id: camResult.cam_id,
            error: dealResult.error,
          }
        }
        const bdeResult1 = await this.assignBDE(leadId, dealResult.deal_id!, lead)
        return {
          success: true,
          pipeline_status: bdeResult1.success ? 'BDE_ASSIGNED' : 'DEAL_CREATED',
          partner_lead_id: lead.partner_lead_id,
          cam_id: camResult.cam_id,
          deal_id: dealResult.deal_id,
          bde_id: bdeResult1.bde_id,
          bde_name: bdeResult1.bde_name,
        }

      case 'deal':
        // Retry deal creation (CAM already done)
        if (!lead.cam_id) {
          return { success: false, pipeline_status: 'ERROR', error: 'No CAM ID — retry from cam step' }
        }
        const dealResult2 = await this.createDeal(leadId, lead.cam_id, lead)
        if (!dealResult2.success) {
          return { success: false, pipeline_status: 'CAM_COMPLETED', error: dealResult2.error }
        }
        const bdeResult2 = await this.assignBDE(leadId, dealResult2.deal_id!, lead)
        return {
          success: true,
          pipeline_status: bdeResult2.success ? 'BDE_ASSIGNED' : 'DEAL_CREATED',
          cam_id: lead.cam_id,
          deal_id: dealResult2.deal_id,
          bde_id: bdeResult2.bde_id,
          bde_name: bdeResult2.bde_name,
        }

      case 'bde':
        // Retry BDE assignment only
        if (!lead.crm_deal_id) {
          return { success: false, pipeline_status: 'ERROR', error: 'No deal — retry from deal step' }
        }
        const bdeResult3 = await this.assignBDE(leadId, lead.crm_deal_id, lead)
        return {
          success: bdeResult3.success,
          pipeline_status: bdeResult3.success ? 'BDE_ASSIGNED' : 'DEAL_CREATED',
          cam_id: lead.cam_id,
          deal_id: lead.crm_deal_id,
          bde_id: bdeResult3.bde_id,
          bde_name: bdeResult3.bde_name,
          error: bdeResult3.error,
        }

      default:
        return this.triggerCAMPipeline(leadId)
    }
  }

  /**
   * Determine which step to retry from based on current status.
   */
  private getRetryStep(pipelineStatus: string): 'bridge' | 'cam' | 'deal' | 'bde' {
    switch (pipelineStatus) {
      case 'SUBMITTED':
        return 'bridge'
      case 'CAM_BRIDGED':
      case 'CAM_PROCESSING':
      case 'CAM_FAILED':
        return 'cam'
      case 'CAM_COMPLETED':
        return 'deal'
      case 'DEAL_CREATED':
        return 'bde'
      default:
        return 'bridge'
    }
  }

  /**
   * Log a pipeline event for audit trail.
   */
  private async logEvent(
    leadId: string,
    leadNumber: string,
    eventType: string,
    eventStatus: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase
        .from('pipeline_events')
        .insert({
          lead_id: leadId,
          lead_number: leadNumber,
          event_type: eventType,
          event_status: eventStatus,
          event_data: eventData,
        })
    } catch (error) {
      console.error('Failed to log pipeline event:', error)
    }
  }
}

export function createULAPPipelineService(supabaseClient: SupabaseClient): ULAPPipelineService {
  return new ULAPPipelineService(supabaseClient)
}
