
/**
 * BDM Team Pipeline - Lead Detail API
 * GET /api/bdm/team-pipeline/stages/lead-detail
 *
 * Returns complete information about a single lead including timeline, documents, notes
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds } from '@/lib/bdm/bde-utils'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
// 1. Verify user is BDM
    const bdmId = await getCurrentBDMId()
    if (!bdmId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDM role required' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const leadId = searchParams.get('leadId')

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'Lead ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // 3. Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        id,
        customer_name,
        customer_phone,
        customer_email,
        customer_address,
        customer_city,
        customer_state,
        customer_pincode,
        loan_type,
        loan_amount,
        loan_purpose,
        employment_type,
        monthly_income,
        status,
        priority,
        assigned_to,
        bank_id,
        bank_name,
        days_in_current_stage,
        stage_changed_at,
        previous_stage,
        last_activity_at,
        expected_disbursement_date,
        created_at,
        updated_at,
        notes_count,
        documents_count,
        source,
        utm_source,
        utm_medium,
        utm_campaign
      `)
      .eq('id', leadId)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    // 4. Verify lead is assigned to BDE under this BDM
    const bdeIds = await getBDEIds(bdmId)
    if (!bdeIds.includes(lead.assigned_to)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Lead not under your management' },
        { status: 403 }
      )
    }

    // 5. Get BDE details
    const { data: bde } = await supabase
      .from('users')
      .select('id, full_name, email, avatar_url, phone')
      .eq('id', lead.assigned_to)
      .maybeSingle()

    // 6. Get timeline events
    const { data: timelineEvents } = await supabase
      .from('lead_timeline_events')
      .select(`
        id,
        event_type,
        description,
        performed_by,
        metadata,
        created_at,
        users:performed_by (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(50)

    // 7. Get bank details if bank_id exists
    let bankDetails = null
    if (lead.bank_id) {
      const { data: bank } = await supabase
        .from('banks')
        .select('id, bank_name, logo_url, contact_person, contact_email, contact_phone')
        .eq('id', lead.bank_id)
        .maybeSingle()

      bankDetails = bank
    }

    // 8. Get lead scoring if available
    const { data: leadScore } = await supabase
      .from('lead_scoring_models')
      .select('score, confidence, factors, last_calculated_at')
      .eq('lead_id', leadId)
      .maybeSingle()

    // 9. Get active alerts for this lead
    const { data: alerts } = await supabase
      .from('pipeline_alerts')
      .select('id, alert_type, severity, message, created_at, is_read, is_resolved')
      .eq('lead_id', leadId)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(10)

    // 10. Calculate additional metrics
    const daysSinceCreation = Math.floor(
      (new Date().getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    const daysSinceLastActivity = lead.last_activity_at
      ? Math.floor(
          (new Date().getTime() - new Date(lead.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
        )
      : null

    const isStale = (lead.days_in_current_stage || 0) > 7
    const isUrgent = lead.priority === 'CRITICAL' || lead.priority === 'HIGH'
    const hasRecentActivity = daysSinceLastActivity !== null && daysSinceLastActivity <= 2

    // 11. Build comprehensive response
    const leadDetail = {
      // Basic information
      id: lead.id,
      customerName: lead.customer_name,
      customerPhone: lead.customer_phone,
      customerEmail: lead.customer_email,
      customerAddress: lead.customer_address,
      customerCity: lead.customer_city,
      customerState: lead.customer_state,
      customerPincode: lead.customer_pincode,

      // Loan information
      loanType: lead.loan_type,
      loanTypeLabel: getLoanTypeLabel(lead.loan_type),
      loanAmount: lead.loan_amount,
      formattedAmount: formatCurrency(lead.loan_amount || 0),
      loanPurpose: lead.loan_purpose,
      employmentType: lead.employment_type,
      monthlyIncome: lead.monthly_income,
      formattedIncome: formatCurrency(lead.monthly_income || 0),

      // Status and priority
      status: lead.status,
      statusLabel: getStatusLabel(lead.status),
      statusColor: getStatusColor(lead.status),
      priority: lead.priority,
      priorityLabel: getPriorityLabel(lead.priority),
      priorityColor: getPriorityColor(lead.priority),

      // Assignment
      assignedTo: lead.assigned_to,
      bde: bde ? {
        id: bde.id,
        name: bde.full_name,
        email: bde.email,
        phone: bde.phone,
        avatar: bde.avatar_url,
      } : null,

      // Bank information
      bankId: lead.bank_id,
      bankName: lead.bank_name,
      bank: bankDetails,

      // Timeline metrics
      daysInStage: lead.days_in_current_stage || 0,
      stageChangedAt: lead.stage_changed_at,
      previousStage: lead.previous_stage,
      previousStageLabel: lead.previous_stage ? getStatusLabel(lead.previous_stage) : null,
      lastActivityAt: lead.last_activity_at,
      lastActivityFormatted: lead.last_activity_at ? formatRelativeTime(lead.last_activity_at) : 'No activity',
      expectedDisbursementDate: lead.expected_disbursement_date,
      expectedDisbursementFormatted: lead.expected_disbursement_date ? formatDate(lead.expected_disbursement_date) : null,

      // Counts
      notesCount: lead.notes_count || 0,
      documentsCount: lead.documents_count || 0,

      // Dates
      createdAt: lead.created_at,
      createdAtFormatted: formatDate(lead.created_at),
      updatedAt: lead.updated_at,
      updatedAtFormatted: formatRelativeTime(lead.updated_at),

      // Calculated metrics
      daysSinceCreation,
      daysSinceLastActivity,
      isStale,
      isUrgent,
      hasRecentActivity,

      // Source tracking
      source: lead.source,
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmCampaign: lead.utm_campaign,

      // Lead scoring
      score: leadScore?.score || null,
      scoreConfidence: leadScore?.confidence || null,
      scoreFactors: leadScore?.factors || null,
      lastScoreCalculation: leadScore?.last_calculated_at || null,
    }

    // 12. Format timeline events
    const timeline = timelineEvents?.map(event => ({
      id: event.id,
      type: event.event_type,
      typeLabel: getEventTypeLabel(event.event_type),
      description: event.description,
      performedBy: event.performed_by,
      performedByName: event.users?.full_name || 'System',
      performedByAvatar: event.users?.avatar_url || null,
      metadata: event.metadata,
      createdAt: event.created_at,
      createdAtFormatted: formatRelativeTime(event.created_at),
      icon: getEventIcon(event.event_type),
      color: getEventColor(event.event_type),
    })) || []

    // 13. Format alerts
    const formattedAlerts = alerts?.map(alert => ({
      id: alert.id,
      type: alert.alert_type,
      severity: alert.severity,
      severityLabel: getSeverityLabel(alert.severity),
      severityColor: getSeverityColor(alert.severity),
      message: alert.message,
      createdAt: alert.created_at,
      createdAtFormatted: formatRelativeTime(alert.created_at),
      isRead: alert.is_read,
      isResolved: alert.is_resolved,
    })) || []

    // 14. Return response
    return NextResponse.json({
      success: true,
      data: {
        lead: leadDetail,
        timeline,
        alerts: formattedAlerts,
        stats: {
          totalTimelineEvents: timelineEvents?.length || 0,
          activeAlerts: formattedAlerts.filter(a => !a.isRead).length,
          daysSinceCreation,
          daysSinceLastActivity,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Lead Detail API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch lead details',
      },
      { status: 500 }
    )
  }
}

// Helper functions
function formatCurrency(amount: number): string {
  if (!amount) return '₹0'
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`
  }
  return `₹${amount.toLocaleString('en-IN')}`
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

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: '#3B82F6',
    CONTACTED: '#6366F1',
    DOCUMENTS_PENDING: '#8B5CF6',
    DOCUMENTS_SUBMITTED: '#A855F7',
    UNDER_REVIEW: '#D946EF',
    APPROVED: '#10B981',
    DISBURSED: '#059669',
    REJECTED: '#EF4444',
    ON_HOLD: '#F59E0B',
    CANCELLED: '#6B7280',
  }
  return colors[status] || '#3B82F6'
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

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    CRITICAL: '#DC2626',
    HIGH: '#F59E0B',
    MEDIUM: '#3B82F6',
    LOW: '#6B7280',
  }
  return colors[priority] || '#3B82F6'
}

function getEventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    STATUS_CHANGED: 'Status Changed',
    PRIORITY_CHANGED: 'Priority Changed',
    REASSIGNED: 'Reassigned',
    NOTE_ADDED: 'Note Added',
    DOCUMENT_UPLOADED: 'Document Uploaded',
    BANK_CHANGED: 'Bank Changed',
    DATE_UPDATED: 'Date Updated',
    AMOUNT_UPDATED: 'Amount Updated',
    LOAN_TYPE_CHANGED: 'Loan Type Changed',
    CALL_LOGGED: 'Call Logged',
    EMAIL_SENT: 'Email Sent',
    MEETING_SCHEDULED: 'Meeting Scheduled',
  }
  return labels[eventType] || eventType
}

function getEventIcon(eventType: string): string {
  const icons: Record<string, string> = {
    STATUS_CHANGED: 'arrow-right',
    PRIORITY_CHANGED: 'flag',
    REASSIGNED: 'user-switch',
    NOTE_ADDED: 'file-text',
    DOCUMENT_UPLOADED: 'upload',
    BANK_CHANGED: 'building',
    DATE_UPDATED: 'calendar',
    AMOUNT_UPDATED: 'dollar-sign',
    CALL_LOGGED: 'phone',
    EMAIL_SENT: 'mail',
    MEETING_SCHEDULED: 'calendar-check',
  }
  return icons[eventType] || 'circle'
}

function getEventColor(eventType: string): string {
  const colors: Record<string, string> = {
    STATUS_CHANGED: '#3B82F6',
    PRIORITY_CHANGED: '#F59E0B',
    REASSIGNED: '#8B5CF6',
    NOTE_ADDED: '#6B7280',
    DOCUMENT_UPLOADED: '#10B981',
    BANK_CHANGED: '#06B6D4',
    DATE_UPDATED: '#EC4899',
    AMOUNT_UPDATED: '#10B981',
    CALL_LOGGED: '#3B82F6',
    EMAIL_SENT: '#8B5CF6',
    MEETING_SCHEDULED: '#F59E0B',
  }
  return colors[eventType] || '#6B7280'
}

function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }
  return labels[severity] || severity
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: '#DC2626',
    high: '#F59E0B',
    medium: '#3B82F6',
    low: '#6B7280',
  }
  return colors[severity] || '#3B82F6'
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

function formatRelativeTime(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`

  return formatDate(dateString)
}
