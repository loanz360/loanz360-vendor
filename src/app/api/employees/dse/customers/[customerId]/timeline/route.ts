import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import {
  isValidUUID,
  validatePagination,
  calculateCustomerHealthScore,
  type CustomerHealthInput,
} from '@/lib/validations/dse-validation'


// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

interface TimelineItem {
  id: string
  type:
    | 'note'
    | 'visit'
    | 'meeting'
    | 'reminder'
    | 'lead_created'
    | 'lead_stage_change'
    | 'audit'
  title: string
  description: string
  created_at: string
  metadata: Record<string, unknown>
}

interface TimelineSummary {
  total_interactions: number
  last_contact_date: string | null
  total_notes: number
  total_visits: number
  total_meetings: number
  customer_health_score: number
  days_since_first_contact: number
}

// ---------------------------------------------------------------------
// Mapper helpers – each transforms a raw DB row into a TimelineItem
// ---------------------------------------------------------------------

function mapNote(row: Record<string, unknown>): TimelineItem {
  return {
    id: `note-${row.id}`,
    type: 'note',
    title: `Note added${row.category ? ` (${row.category})` : ''}`,
    description: (row.content as string) || '',
    created_at: row.created_at as string,
    metadata: {
      note_id: row.id,
      category: row.category ?? null,
      is_pinned: row.is_pinned ?? false,
    },
  }
}

function mapVisit(row: Record<string, unknown>): TimelineItem {
  const outcome = row.outcome as string | undefined
  return {
    id: `visit-${row.id}`,
    type: 'visit',
    title: `Visit ${outcome === 'Successful' ? 'completed' : outcome === 'Cancelled' ? 'cancelled' : 'scheduled'}`,
    description: (row.visit_purpose as string) || (row.outcome_notes as string) || '',
    created_at: row.created_at as string,
    metadata: {
      visit_id: row.id,
      visit_type: row.visit_type ?? null,
      visit_date: row.visit_date ?? null,
      check_in_time: row.check_in_time ?? null,
      check_out_time: row.check_out_time ?? null,
      location: row.check_in_address ?? null,
      latitude: row.check_in_latitude ?? null,
      longitude: row.check_in_longitude ?? null,
      outcome: outcome ?? null,
      duration_minutes: row.duration_minutes ?? null,
    },
  }
}

function mapMeeting(row: Record<string, unknown>): TimelineItem {
  const status = row.status as string | undefined
  return {
    id: `meeting-${row.id}`,
    type: 'meeting',
    title: `Meeting ${status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'scheduled'}${row.meeting_type ? ` - ${row.meeting_type}` : ''}`,
    description: (row.agenda as string) || (row.notes as string) || '',
    created_at: row.created_at as string,
    metadata: {
      meeting_id: row.id,
      status: status ?? null,
      meeting_type: row.meeting_type ?? null,
      meeting_date: row.meeting_date ?? null,
      start_time: row.start_time ?? null,
      end_time: row.end_time ?? null,
      location: row.location ?? null,
      outcome: row.outcome ?? null,
    },
  }
}

function mapReminder(row: Record<string, unknown>): TimelineItem {
  return {
    id: `reminder-${row.id}`,
    type: 'reminder',
    title: `Reminder: ${(row.title as string) || 'Untitled'}`,
    description: (row.description as string) || (row.notes as string) || '',
    created_at: row.created_at as string,
    metadata: {
      reminder_id: row.id,
      due_date: row.due_date ?? row.reminder_date ?? null,
      priority: row.priority ?? null,
      status: row.status ?? null,
      reminder_type: row.reminder_type ?? row.type ?? null,
    },
  }
}

function mapLead(row: Record<string, unknown>): TimelineItem {
  return {
    id: `lead-${row.id}`,
    type: 'lead_created',
    title: `Lead created – ${(row.lead_type as string) || 'General'}`,
    description:
      `${(row.customer_name as string) || 'Customer'} - Est. value: ${row.estimated_value ? `₹${Number(row.estimated_value).toLocaleString('en-IN')}` : 'N/A'}`,
    created_at: row.created_at as string,
    metadata: {
      lead_id: row.id,
      lead_type: row.lead_type ?? null,
      stage: row.stage ?? null,
      status: row.status ?? null,
      estimated_value: row.estimated_value ?? null,
      source: row.source ?? null,
      priority: row.priority ?? null,
    },
  }
}

function mapAudit(row: Record<string, unknown>): TimelineItem {
  const action = (row.action as string) || 'unknown'
  const entityType = (row.entity_type as string) || ''

  // Detect lead stage changes from audit logs
  const isStageChange =
    action === 'StageChanged' &&
    entityType === 'Lead' &&
    (row.new_values as Record<string, unknown>)?.stage !== undefined

  return {
    id: `audit-${row.id}`,
    type: isStageChange ? 'lead_stage_change' : 'audit',
    title: isStageChange
      ? `Lead stage changed${(row.new_values as Record<string, unknown>)?.stage ? ` to ${(row.new_values as Record<string, unknown>).stage}` : ''}`
      : `${formatAction(action)} ${entityType}`.trim(),
    description: (row.changes_summary as string) || '',
    created_at: row.created_at as string,
    metadata: {
      audit_id: row.id,
      action,
      entity_type: entityType,
      entity_id: row.entity_id ?? null,
      old_values: row.old_values ?? null,
      new_values: row.new_values ?? null,
      ip_address: row.ip_address ?? null,
    },
  }
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    login: 'Logged in',
    export: 'Exported',
    import: 'Imported',
    assign: 'Assigned',
    archive: 'Archived',
  }
  return map[action.toLowerCase()] ?? action.charAt(0).toUpperCase() + action.slice(1)
}

// ---------------------------------------------------------------------
// GET – Customer 360 Timeline
// ---------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    // Auth
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Role check
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    // Validate customerId
    const { customerId } = await params
    if (!isValidUUID(customerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid customer ID format' },
        { status: 400 }
      )
    }

    // Verify customer ownership
    const { data: customer, error: customerError } = await supabase
      .from('dse_customers')
      .select('id, created_at')
      .eq('id', customerId)
      .eq('dse_user_id', user.id)
      .maybeSingle()

    if (customerError) {
      apiLogger.error('Timeline: customer lookup failed', customerError, {
        customerId,
        userId: user.id,
      })
      return NextResponse.json(
        { success: false, error: 'Failed to verify customer ownership' },
        { status: 500 }
      )
    }

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or access denied' },
        { status: 404 }
      )
    }

    // Parse pagination
    const searchParams = request.nextUrl.searchParams
    const { page, limit, offset } = validatePagination(
      searchParams.get('page'),
      searchParams.get('limit')
    )

    // Fetch all timeline data sources in parallel
    const [
      notesResult,
      visitsResult,
      meetingsResult,
      remindersResult,
      leadsResult,
      auditResult,
    ] = await Promise.all([
      supabase
        .from('dse_notes')
        .select('id, content, category, is_pinned, created_at')
        .eq('customer_id', customerId)
        .eq('author_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('dse_visits')
        .select(
          'id, visit_purpose, outcome_notes, visit_date, visit_type, check_in_time, check_out_time, check_in_address, check_in_latitude, check_in_longitude, check_out_address, outcome, duration_minutes, created_at'
        )
        .eq('customer_id', customerId)
        .eq('dse_user_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('dse_meetings')
        .select(
          'id, agenda, notes, status, meeting_type, meeting_date, start_time, end_time, location, outcome, created_at'
        )
        .eq('customer_id', customerId)
        .eq('dse_user_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('dse_reminders')
        .select(
          'id, title, description, notes, due_date, reminder_date, priority, status, reminder_type, type, created_at'
        )
        .eq('customer_id', customerId)
        .eq('dse_user_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('dse_leads')
        .select(
          'id, customer_name, lead_type, stage, status, estimated_value, source, priority, created_at'
        )
        .eq('customer_id', customerId)
        .eq('dse_user_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('dse_audit_log')
        .select(
          'id, action, entity_type, entity_id, changes_summary, old_values, new_values, ip_address, created_at'
        )
        .eq('entity_id', customerId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    // Log any individual query errors but continue with available data
    const queryErrors: string[] = []
    if (notesResult.error) queryErrors.push('notes')
    if (visitsResult.error) queryErrors.push('visits')
    if (meetingsResult.error) queryErrors.push('meetings')
    if (remindersResult.error) queryErrors.push('reminders')
    if (leadsResult.error) queryErrors.push('leads')
    if (auditResult.error) queryErrors.push('audit')

    if (queryErrors.length > 0) {
      apiLogger.warn('Timeline: partial data – some queries failed', {
        customerId,
        userId: user.id,
        failedSources: queryErrors,
      })
    }

    // Map rows to timeline items
    const notes = (notesResult.data ?? []).map(mapNote)
    const visits = (visitsResult.data ?? []).map(mapVisit)
    const meetings = (meetingsResult.data ?? []).map(mapMeeting)
    const reminders = (remindersResult.data ?? []).map(mapReminder)
    const leads = (leadsResult.data ?? []).map(mapLead)
    const auditItems = (auditResult.data ?? []).map(mapAudit)

    // Merge and sort descending by created_at
    const allItems: TimelineItem[] = [
      ...notes,
      ...visits,
      ...meetings,
      ...reminders,
      ...leads,
      ...auditItems,
    ].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const totalItems = allItems.length

    // Paginate
    const paginatedItems = allItems.slice(offset, offset + limit)

    // Build summary
    const allContactDates = [
      ...notes.map((i) => i.created_at),
      ...visits.map((i) => i.created_at),
      ...meetings.map((i) => i.created_at),
    ]
    const lastContactDate =
      allContactDates.length > 0
        ? allContactDates.sort(
            (a, b) => new Date(b).getTime() - new Date(a).getTime()
          )[0]
        : null

    const firstContactDate =
      allItems.length > 0
        ? allItems.reduce((earliest, item) =>
            new Date(item.created_at) < new Date(earliest.created_at)
              ? item
              : earliest
          ).created_at
        : customer.created_at

    const daysSinceFirst = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(firstContactDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    )

    const totalInteractions = notes.length + visits.length + meetings.length
    const daysSinceLastContact = lastContactDate
      ? Math.floor(
          (Date.now() - new Date(lastContactDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : daysSinceFirst

    // Estimate deal value from leads
    const maxDealValue = (leadsResult.data ?? []).reduce(
      (max, lead) => Math.max(max, Number(lead.estimated_value) || 0),
      0
    )

    const hasActiveDeal = (leadsResult.data ?? []).some(
      (lead) =>
        lead.stage !== 'Won' && lead.stage !== 'Lost' && lead.status !== 'closed'
    )

    // Response rate approximation: proportion of meetings/visits that were completed
    const completedActivities = [
      ...(visitsResult.data ?? []).filter((v) => v.status === 'completed'),
      ...(meetingsResult.data ?? []).filter((m) => m.status === 'completed'),
    ].length
    const totalActivities =
      (visitsResult.data ?? []).length + (meetingsResult.data ?? []).length
    const responseRate =
      totalActivities > 0 ? completedActivities / totalActivities : 0

    const healthInput: CustomerHealthInput = {
      days_since_last_contact: daysSinceLastContact,
      total_interactions: totalInteractions,
      deal_value: maxDealValue,
      has_active_deal: hasActiveDeal,
      response_rate: responseRate,
    }

    const summary: TimelineSummary = {
      total_interactions: totalInteractions,
      last_contact_date: lastContactDate,
      total_notes: notes.length,
      total_visits: visits.length,
      total_meetings: meetings.length,
      customer_health_score: calculateCustomerHealthScore(healthInput),
      days_since_first_contact: daysSinceFirst,
    }

    return NextResponse.json({
      success: true,
      data: paginatedItems,
      summary,
      meta: {
        page,
        limit,
        total: totalItems,
        total_pages: Math.ceil(totalItems / limit),
        has_next: offset + limit < totalItems,
        has_prev: page > 1,
        ...(queryErrors.length > 0 && {
          partial: true,
          unavailable_sources: queryErrors,
        }),
      },
    })
  } catch (error) {
    apiLogger.error('Timeline: unexpected error', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
