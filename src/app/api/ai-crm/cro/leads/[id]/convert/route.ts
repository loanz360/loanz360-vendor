/**
 * CRO Lead Conversion API
 *
 * Enterprise-grade API for converting leads to deals
 * Features:
 * - RBAC authentication
 * - Database transactions for data integrity
 * - Intelligent BDE auto-assignment
 * - Audit logging
 * - Input validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  validateRequestBody,
  createSuccessResponse,
  createErrorResponse,
  logAuditTrail,
  extractClientInfo,
  verifyLeadOwnership,
} from '@/lib/api/ai-crm-middleware'
import { convertLeadToDealSchema, type ConvertLeadToDealInput } from '@/lib/validations/ai-crm-schemas'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Schema for the conversion request
const conversionRequestSchema = z.object({
  assignmentMode: z.enum(['auto', 'manual']).default('auto'),
  bdeId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  // Authenticate and verify CRO role
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context
  const { id: leadId } = await params

  try {
    // Validate lead ID
    if (!leadId || !z.string().uuid().safeParse(leadId).success) {
      return createErrorResponse('Invalid lead ID', 400, requestId)
    }

    // Validate request body
    const validationResult = await validateRequestBody(
      request,
      conversionRequestSchema,
      requestId
    )
    if (!validationResult.success) {
      return validationResult.response
    }

    const { assignmentMode, bdeId, notes, priority } = validationResult.data

    // Verify CRO owns this lead and get lead data
    const ownershipResult = await verifyLeadOwnership(supabase, leadId, user.id, requestId)
    if (!ownershipResult.success) {
      return ownershipResult.response
    }

    const lead = ownershipResult.lead

    // Check if lead is already converted
    if (lead.status === 'converted') {
      return createErrorResponse(
        'Lead has already been converted to a deal',
        409,
        requestId,
        { existingDealId: lead.converted_deal_id }
      )
    }

    // Check if lead is in correct stage
    if (lead.stage !== 'ready_to_convert') {
      return createErrorResponse(
        `Lead must be in 'ready_to_convert' stage. Current stage: ${lead.stage}`,
        400,
        requestId,
        { currentStage: lead.stage }
      )
    }

    let assignedBdeId = bdeId

    // Auto-assign BDE if not specified
    if (assignmentMode === 'auto' || !assignedBdeId) {
      // Use the database function for optimal BDE selection
      const { data: bestBde, error: bdeError } = await supabase
        .rpc('get_best_bde_for_assignment')

      if (bdeError || !bestBde) {
        // Fallback: Get any available BDE from profiles table
        const { data: fallbackBde } = await supabase
          .from('profiles')
          .select('id')
          .eq('sub_role', 'BDE')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()

        if (!fallbackBde) {
          return createErrorResponse(
            'No BDE users available for assignment',
            503,
            requestId,
            { code: 'NO_BDE_AVAILABLE' }
          )
        }
        assignedBdeId = fallbackBde.id
      } else {
        // Handle both object ({id: string}) and string return types from RPC
        assignedBdeId = typeof bestBde === 'string' ? bestBde : bestBde?.id || bestBde
      }
    }

    // Verify BDE exists if manually assigned
    if (assignmentMode === 'manual' && bdeId) {
      const { data: bdeUser, error: bdeCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', bdeId)
        .eq('sub_role', 'BDE')
        .eq('is_active', true)
        .maybeSingle()

      if (bdeCheckError || !bdeUser) {
        return createErrorResponse(
          'Selected BDE user not found or not a valid BDE',
          400,
          requestId
        )
      }
    }

    // Use database function for atomic conversion
    const { data: conversionResult, error: conversionError } = await supabase
      .rpc('convert_lead_to_deal', {
        p_lead_id: leadId,
        p_bde_id: assignedBdeId,
        p_cro_id: user.id,
        p_conversion_notes: notes || null,
      })

    if (conversionError) {
      logApiError(conversionError as Error, request, {
        action: 'convert_lead',
        requestId,
        leadId,
      })
      return createErrorResponse(
        'Failed to convert lead to deal',
        500,
        requestId,
        { code: 'CONVERSION_ERROR' }
      )
    }

    // Check if conversion was successful
    if (!conversionResult.success) {
      return createErrorResponse(
        conversionResult.error || 'Conversion failed',
        400,
        requestId
      )
    }

    // Log audit trail
    const clientInfo = extractClientInfo(request)
    await logAuditTrail(supabase, {
      userId: user.id,
      action: 'convert_lead_to_deal',
      entityType: 'crm_leads',
      entityId: leadId,
      oldValues: {
        status: lead.status,
        stage: lead.stage,
      },
      newValues: {
        status: 'converted',
        deal_id: conversionResult.deal_id,
        bde_id: assignedBdeId,
      },
      metadata: {
        assignmentMode,
        priority,
        conversionNotes: notes,
      },
      ...clientInfo,
    })

    // Also log for the new deal
    await logAuditTrail(supabase, {
      userId: user.id,
      action: 'create_deal_from_lead',
      entityType: 'crm_deals',
      entityId: conversionResult.deal_id,
      newValues: {
        lead_id: leadId,
        cro_id: user.id,
        bde_id: assignedBdeId,
        customer_name: lead.name,
        loan_amount: lead.loan_amount,
      },
      metadata: {
        assignmentMode,
        priority,
      },
      ...clientInfo,
    })

    // Get BDE info for response
    const { data: bdeInfo } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', assignedBdeId)
      .maybeSingle()

    return createSuccessResponse(
      {
        message: 'Lead successfully converted to deal',
        deal_id: conversionResult.deal_id,
        bde_id: assignedBdeId,
        bde_name: bdeInfo?.full_name || 'Unknown',
        bde_email: bdeInfo?.email,
        assignment_mode: assignmentMode,
      },
      requestId
    )
  } catch (error) {
    logApiError(error as Error, request, {
      action: 'convert_lead',
      requestId,
      leadId,
    })
    return createErrorResponse(
      'Internal server error',
      500,
      requestId,
      { code: 'INTERNAL_ERROR' }
    )
  }
}
