/**
 * CRO Contact Call Update API
 *
 * Enterprise-grade API for logging call activities
 * Features:
 * - RBAC authentication
 * - Atomic counter increment (no race conditions)
 * - Input validation
 * - Audit logging
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
  verifyContactOwnership,
} from '@/lib/api/ai-crm-middleware'
import { updateContactCallSchema, type UpdateContactCallInput } from '@/lib/validations/ai-crm-schemas'


export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  // Authenticate and verify CRO role
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    // Validate request body
    const validationResult = await validateRequestBody<UpdateContactCallInput>(
      request,
      updateContactCallSchema,
      requestId
    )
    if (!validationResult.success) {
      return validationResult.response
    }

    const {
      contactId,
      callDuration,
      callOutcome,
      notes,
      nextFollowUp,
      interestLevel,
    } = validationResult.data

    // Verify CRO owns this contact
    const ownershipResult = await verifyContactOwnership(supabase, contactId, user.id, requestId)
    if (!ownershipResult.success) {
      return ownershipResult.response
    }

    const contact = ownershipResult.contact

    // Use atomic increment to prevent race conditions
    const { data: newCallCount, error: incrementError } = await supabase
      .rpc('increment_call_count', {
        p_contact_id: contactId,
        p_cro_id: user.id,
      })

    if (incrementError) {
      logApiError(incrementError as Error, request, {
        action: 'increment_call_count',
        requestId,
        contactId,
      })
      return createErrorResponse(
        'Failed to update call count',
        500,
        requestId
      )
    }

    // Determine new status based on call outcome
    let newStatus = contact.status
    if (callOutcome === 'connected') {
      newStatus = 'called'
    } else if (callOutcome === 'callback_requested' || nextFollowUp) {
      newStatus = 'follow_up'
    } else if (callOutcome === 'wrong_number') {
      newStatus = 'invalid'
    }

    // Update contact with additional call information
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    if (nextFollowUp) {
      updateData.next_follow_up = nextFollowUp
    }

    if (interestLevel) {
      updateData.interest_level = interestLevel
    }

    // Add call log to notes timeline
    const callLogEntry = {
      id: crypto.randomUUID(),
      type: 'call_log',
      timestamp: new Date().toISOString(),
      call_duration: callDuration,
      call_outcome: callOutcome,
      notes: notes || null,
      interest_level: interestLevel || null,
      created_by: user.id,
      created_by_name: user.user_metadata?.full_name || user.email,
    }

    // Append to existing notes timeline
    // TODO: Use atomic jsonb_concat RPC for concurrent safety. Current read-modify-write
    // is acceptable for single-CRO contacts but could lose data under concurrent writes.
    const existingTimeline = contact.notes_timeline || []
    updateData.notes_timeline = [...existingTimeline, callLogEntry]

    const { error: updateError } = await supabase
      .from('crm_contacts')
      .update(updateData)
      .eq('id', contactId)
      .eq('cro_id', user.id)

    if (updateError) {
      logApiError(updateError as Error, request, {
        action: 'update_contact',
        requestId,
        contactId,
      })
      return createErrorResponse(
        'Failed to update contact details',
        500,
        requestId
      )
    }

    // Log audit trail
    const clientInfo = extractClientInfo(request)
    await logAuditTrail(supabase, {
      userId: user.id,
      action: 'log_call',
      entityType: 'crm_contacts',
      entityId: contactId,
      oldValues: {
        call_count: contact.call_count,
        status: contact.status,
      },
      newValues: {
        call_count: newCallCount,
        status: newStatus,
        call_outcome: callOutcome,
        call_duration: callDuration,
      },
      metadata: {
        notes,
        nextFollowUp,
        interestLevel,
      },
      ...clientInfo,
    })

    return createSuccessResponse(
      {
        message: 'Call logged successfully',
        call_count: newCallCount,
        status: newStatus,
        next_follow_up: nextFollowUp || null,
      },
      requestId
    )
  } catch (error) {
    logApiError(error as Error, request, { action: 'update_call', requestId })
    return createErrorResponse(
      'Internal server error',
      500,
      requestId,
      { code: 'INTERNAL_ERROR' }
    )
  }
}
