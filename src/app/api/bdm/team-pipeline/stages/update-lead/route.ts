import { parseBody } from '@/lib/utils/parse-body'

/**
 * BDM Team Pipeline - Update Lead API
 * PATCH /api/bdm/team-pipeline/stages/update-lead
 *
 * Updates lead properties (status, priority, assignment, etc.)
 * Creates timeline events for all changes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds } from '@/lib/bdm/bde-utils'
import { apiLogger } from '@/lib/utils/logger'

export async function PATCH(request: NextRequest) {
  try {
    // 1. Verify user is BDM
    const bdmId = await getCurrentBDMId()
    if (!bdmId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDM role required' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      leadId,
      updates,
      note,
    } = body

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'Lead ID is required' },
        { status: 400 }
      )
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // 3. Verify lead exists and BDM has access to it
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, assigned_to, status, priority, bank_id, customer_name')
      .eq('id', leadId)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    // Verify lead is assigned to BDE under this BDM
    const bdeIds = await getBDEIds(bdmId)
    if (!bdeIds.includes(lead.assigned_to)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Lead not under your management' },
        { status: 403 }
      )
    }

    // 4. Build update object (only allow certain fields)
    const allowedFields = [
      'status',
      'priority',
      'assigned_to',
      'bank_id',
      'bank_name',
      'expected_disbursement_date',
      'loan_amount',
      'loan_type',
    ]

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    const changes: Array<{ field: string; oldValue: any; newValue: any }> = []

    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        updateData[field] = value

        // Track changes for timeline
        if (lead[field as keyof typeof lead] !== value) {
          changes.push({
            field,
            oldValue: lead[field as keyof typeof lead],
            newValue: value,
          })
        }
      }
    }

    // Special handling for status changes
    if (updates.status && updates.status !== lead.status) {
      updateData.days_in_current_stage = 0 // Reset days in stage
      updateData.stage_changed_at = new Date().toISOString()

      // Update previous stage for tracking
      updateData.previous_stage = lead.status
    }

    // Special handling for assignment changes
    if (updates.assigned_to && updates.assigned_to !== lead.assigned_to) {
      // Verify new assignee is under this BDM
      if (!bdeIds.includes(updates.assigned_to)) {
        return NextResponse.json(
          { success: false, error: 'Cannot assign to BDE outside your team' },
          { status: 400 }
        )
      }
    }

    // 5. Update the lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('[Update Lead API] Error updating lead', updateError)
      throw new Error(`Failed to update lead: ${updateError.message}`)
    }

    // 6. Create timeline events for each change
    const timelineEvents = []

    for (const change of changes) {
      const eventType = getEventTypeForField(change.field)
      const description = getEventDescription(change.field, change.oldValue, change.newValue, lead.customer_name)

      timelineEvents.push({
        lead_id: leadId,
        event_type: eventType,
        description,
        performed_by: bdmId,
        metadata: {
          field: change.field,
          old_value: change.oldValue,
          new_value: change.newValue,
          changed_by_role: 'BDM',
        },
        created_at: new Date().toISOString(),
      })
    }

    // Add note as a separate event if provided
    if (note && note.trim()) {
      timelineEvents.push({
        lead_id: leadId,
        event_type: 'NOTE_ADDED',
        description: note.trim(),
        performed_by: bdmId,
        metadata: {
          note_type: 'BDM_UPDATE',
          changes: changes.map(c => c.field),
        },
        created_at: new Date().toISOString(),
      })
    }

    // Insert timeline events
    if (timelineEvents.length > 0) {
      const { error: timelineError } = await supabase
        .from('lead_timeline_events')
        .insert(timelineEvents)

      if (timelineError) {
        apiLogger.error('[Update Lead API] Error creating timeline events', timelineError)
        // Don't fail the request, just log the error
      }
    }

    // 7. Update last_activity_at
    await supabase
      .from('leads')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', leadId)

    // 8. Create alert if status changed to critical stages
    if (updates.status) {
      const criticalStatuses = ['DOCUMENTS_PENDING', 'UNDER_REVIEW', 'APPROVED']
      if (criticalStatuses.includes(updates.status)) {
        const alertSeverity = updates.status === 'APPROVED' ? 'high' : 'medium'
        const alertMessage = getAlertMessageForStatus(updates.status, lead.customer_name)

        await supabase
          .from('pipeline_alerts')
          .insert({
            lead_id: leadId,
            bde_user_id: updatedLead.assigned_to,
            alert_type: 'STAGE_CHANGE',
            severity: alertSeverity,
            message: alertMessage,
            metadata: {
              old_status: lead.status,
              new_status: updates.status,
              changed_by: bdmId,
              changed_by_role: 'BDM',
            },
            is_read: false,
            created_at: new Date().toISOString(),
          })
      }
    }

    // 9. Return success response
    return NextResponse.json({
      success: true,
      data: {
        lead: updatedLead,
        changes: changes.length,
        changesDetail: changes,
        timelineEventsCreated: timelineEvents.length,
      },
      message: `Lead updated successfully with ${changes.length} change(s)`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Update Lead API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update lead',
      },
      { status: 500 }
    )
  }
}

// Helper functions
function getEventTypeForField(field: string): string {
  const eventTypes: Record<string, string> = {
    status: 'STATUS_CHANGED',
    priority: 'PRIORITY_CHANGED',
    assigned_to: 'REASSIGNED',
    bank_id: 'BANK_CHANGED',
    expected_disbursement_date: 'DATE_UPDATED',
    loan_amount: 'AMOUNT_UPDATED',
    loan_type: 'LOAN_TYPE_CHANGED',
  }
  return eventTypes[field] || 'FIELD_UPDATED'
}

function getEventDescription(field: string, oldValue: any, newValue: any, customerName: string): string {
  switch (field) {
    case 'status':
      return `Lead status changed from ${getStatusLabel(oldValue)} to ${getStatusLabel(newValue)}`
    case 'priority':
      return `Priority changed from ${getPriorityLabel(oldValue)} to ${getPriorityLabel(newValue)}`
    case 'assigned_to':
      return `Lead reassigned to different BDE`
    case 'bank_id':
      return `Bank changed`
    case 'expected_disbursement_date':
      return `Expected disbursement date updated to ${formatDate(newValue)}`
    case 'loan_amount':
      return `Loan amount updated from ${formatCurrency(oldValue)} to ${formatCurrency(newValue)}`
    case 'loan_type':
      return `Loan type changed from ${getLoanTypeLabel(oldValue)} to ${getLoanTypeLabel(newValue)}`
    default:
      return `${field} updated`
  }
}

function getAlertMessageForStatus(status: string, customerName: string): string {
  switch (status) {
    case 'DOCUMENTS_PENDING':
      return `Documents pending for ${customerName}. Please follow up.`
    case 'UNDER_REVIEW':
      return `${customerName}'s application is under review. Monitor progress.`
    case 'APPROVED':
      return `${customerName}'s application has been approved! Proceed to disbursement.`
    default:
      return `Status updated for ${customerName}`
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: 'New Lead',
    CONTACTED: 'Contacted',
    DOCUMENTS_PENDING: 'Documents Pending',
    DOCUMENTS_SUBMITTED: 'Documents Submitted',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    DISBURSED: 'Disbursed',
    REJECTED: 'Rejected',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
  }
  return labels[status] || status
}

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
  }
  return labels[priority] || 'Medium'
}

function getLoanTypeLabel(loanType: string): string {
  const labels: Record<string, string> = {
    HOME_LOAN: 'Home Loan',
    PERSONAL_LOAN: 'Personal Loan',
    BUSINESS_LOAN: 'Business Loan',
    CAR_LOAN: 'Car Loan',
    EDUCATION_LOAN: 'Education Loan',
    GOLD_LOAN: 'Gold Loan',
    LAP: 'Loan Against Property',
  }
  return labels[loanType] || loanType
}

function formatCurrency(amount: number): string {
  if (!amount) return '₹0'
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`
  }
  return `₹${amount.toLocaleString('en-IN')}`
}

function formatDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
