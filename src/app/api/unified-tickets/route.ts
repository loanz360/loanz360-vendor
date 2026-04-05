export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * Unified Tickets API
 * Provides a single endpoint to access tickets from all sources
 * (Employee, Customer, Partner)
 */

export interface UnifiedTicket {
  ticket_source: 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
  unified_ticket_id: string
  id: string
  ticket_number: string
  subject: string
  description: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: string
  requester_id: string
  requester_type: string
  requester_name: string
  requester_email: string
  requester_phone: string | null
  assigned_to_id: string | null
  assigned_to_name: string | null
  assigned_department: string | null
  is_anonymous: boolean
  is_confidential: boolean
  escalation_level: number
  first_response_at: string | null
  resolved_at: string | null
  closed_at: string | null
  response_time_hours: number | null
  resolution_time_hours: number | null
  reopened_count: number
  sla_deadline: string | null
  sla_breached: boolean
  created_at: string
  updated_at: string
}

export interface UnifiedTicketFilters {
  sources?: ('EMPLOYEE' | 'CUSTOMER' | 'PARTNER')[]
  status?: string[]
  priority?: string[]
  category?: string[]
  department?: string[]
  assignedTo?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  slaBreached?: boolean
  escalated?: boolean
}

export interface UnifiedTicketCounts {
  total: number
  by_source: {
    EMPLOYEE: number
    CUSTOMER: number
    PARTNER: number
  }
  by_status: Record<string, number>
  by_priority: Record<string, number>
  sla_breached: number
  unassigned: number
  urgent: number
}

/**
 * GET /api/unified-tickets
 * Fetch tickets from all sources with unified filtering
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Super Admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id, full_name, role')
      .eq('id', user.id)
      .maybeSingle()

    if (!superAdmin) {
      return NextResponse.json(
        { error: 'Only Super Admin can access unified tickets' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Parse filters
    const sources = searchParams.get('sources')?.split(',') as ('EMPLOYEE' | 'CUSTOMER' | 'PARTNER')[] | undefined
    const status = searchParams.get('status')?.split(',')
    const priority = searchParams.get('priority')?.split(',')
    const category = searchParams.get('category')?.split(',')
    const department = searchParams.get('department')?.split(',')
    const assignedTo = searchParams.get('assigned_to')
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const slaBreached = searchParams.get('sla_breached') === 'true'
    const escalated = searchParams.get('escalated') === 'true'
    const unassigned = searchParams.get('unassigned') === 'true'

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    // Sorting
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') === 'asc' ? 'asc' : 'desc'

    // Per-source query cap to prevent unbounded memory usage
    // We fetch more than page size to ensure correct cross-source sorting
    const perSourceLimit = Math.max(limit * 3, 200)

    // Build unified query
    const tickets: UnifiedTicket[] = []
    let totalCount = 0
    const counts: UnifiedTicketCounts = {
      total: 0,
      by_source: { EMPLOYEE: 0, CUSTOMER: 0, PARTNER: 0 },
      by_status: {},
      by_priority: {},
      sla_breached: 0,
      unassigned: 0,
      urgent: 0
    }

    // Fetch from each source based on filters
    const sourcesToFetch = sources || ['EMPLOYEE', 'CUSTOMER', 'PARTNER']

    // EMPLOYEE TICKETS
    if (sourcesToFetch.includes('EMPLOYEE')) {
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          employee:employees!support_tickets_employee_id_fkey(
            id, full_name, email
          ),
          assignee:employees!support_tickets_assigned_user_id_fkey(
            id, full_name
          ),
          messages:ticket_messages(count)
        `, { count: 'exact' })

      // Apply filters
      if (status?.length) query = query.in('status', status)
      if (priority?.length) query = query.in('priority', priority)
      if (category?.length) query = query.in('category', category)
      if (assignedTo) query = query.eq('assigned_user_id', assignedTo)
      if (unassigned) query = query.is('assigned_user_id', null)
      if (search) {
        const sanitized = search.replace(/[%_\\'"();]/g, '')
        if (sanitized.length > 0) {
          query = query.or(`subject.ilike.%${sanitized}%,ticket_number.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
        }
      }
      if (slaBreached) query = query.eq('sla_breached', true)
      if (dateFrom) query = query.gte('created_at', dateFrom)
      if (dateTo) query = query.lte('created_at', dateTo)
      if (escalated) query = query.gt('escalation_level', 0)

      const { data: empTickets, count: empCount } = await query
        .order(sortBy as any, { ascending: sortOrder === 'asc' })
        .limit(perSourceLimit)

      if (empTickets) {
        counts.by_source.EMPLOYEE = empCount || 0
        empTickets.forEach((t: any) => {
          tickets.push({
            ticket_source: 'EMPLOYEE',
            unified_ticket_id: `EMP-${t.ticket_number}`,
            id: t.id,
            ticket_number: t.ticket_number,
            subject: t.subject,
            description: t.description,
            category: t.category,
            priority: t.priority,
            status: t.status,
            requester_id: t.employee_id,
            requester_type: 'EMPLOYEE',
            requester_name: t.is_anonymous ? 'Anonymous' : t.employee?.full_name || 'Unknown',
            requester_email: t.is_anonymous ? '' : t.employee?.email || '',
            requester_phone: null,
            assigned_to_id: t.assigned_user_id,
            assigned_to_name: t.assignee?.full_name || null,
            assigned_department: t.assigned_to,
            is_anonymous: t.is_anonymous || false,
            is_confidential: t.is_confidential || false,
            escalation_level: t.escalation_level || 0,
            first_response_at: t.first_response_at,
            resolved_at: t.resolved_at,
            closed_at: t.closed_at,
            response_time_hours: t.response_time_hours,
            resolution_time_hours: t.resolution_time_hours,
            reopened_count: t.reopened_count || 0,
            sla_deadline: t.sla_deadline,
            sla_breached: t.sla_breached || false,
            created_at: t.created_at,
            updated_at: t.updated_at
          })

          // Update counts
          counts.by_status[t.status] = (counts.by_status[t.status] || 0) + 1
          counts.by_priority[t.priority] = (counts.by_priority[t.priority] || 0) + 1
          if (t.sla_breached) counts.sla_breached++
          if (!t.assigned_user_id) counts.unassigned++
          if (t.priority === 'urgent') counts.urgent++
        })
      }
    }

    // CUSTOMER TICKETS
    if (sourcesToFetch.includes('CUSTOMER')) {
      let query = supabase
        .from('customer_support_tickets')
        .select(`
          *,
          assignee:employees!customer_support_tickets_assigned_to_customer_support_id_fkey(
            id, full_name
          ),
          messages:customer_ticket_messages(count)
        `, { count: 'exact' })

      if (status?.length) query = query.in('status', status)
      if (priority?.length) query = query.in('priority', priority)
      if (category?.length) query = query.in('category', category)
      if (department?.length) query = query.in('routed_to_department', department)
      if (assignedTo) query = query.eq('assigned_to_customer_support_id', assignedTo)
      if (unassigned) query = query.is('assigned_to_customer_support_id', null)
      if (slaBreached) query = query.eq('sla_breached', true)
      if (search) {
        const sanitized = search.replace(/[%_\\'"();]/g, '')
        if (sanitized.length > 0) {
          query = query.or(`subject.ilike.%${sanitized}%,ticket_number.ilike.%${sanitized}%,customer_name.ilike.%${sanitized}%`)
        }
      }
      if (dateFrom) query = query.gte('created_at', dateFrom)
      if (dateTo) query = query.lte('created_at', dateTo)
      if (escalated) query = query.gt('escalation_level', 0)

      const { data: custTickets, count: custCount } = await query
        .order(sortBy as any, { ascending: sortOrder === 'asc' })
        .limit(perSourceLimit)

      if (custTickets) {
        counts.by_source.CUSTOMER = custCount || 0
        custTickets.forEach((t: any) => {
          tickets.push({
            ticket_source: 'CUSTOMER',
            unified_ticket_id: `CST-${t.ticket_number}`,
            id: t.id,
            ticket_number: t.ticket_number,
            subject: t.subject,
            description: t.description,
            category: t.category,
            priority: t.priority,
            status: t.status,
            requester_id: t.customer_id,
            requester_type: 'CUSTOMER',
            requester_name: t.customer_name || 'Unknown Customer',
            requester_email: t.customer_email || '',
            requester_phone: t.customer_phone,
            assigned_to_id: t.assigned_to_customer_support_id,
            assigned_to_name: t.assignee?.full_name || null,
            assigned_department: t.routed_to_department,
            is_anonymous: false,
            is_confidential: t.is_confidential || false,
            escalation_level: t.escalation_level || 0,
            first_response_at: t.first_response_at,
            resolved_at: t.resolved_at,
            closed_at: t.closed_at,
            response_time_hours: t.response_time_hours,
            resolution_time_hours: t.resolution_time_hours,
            reopened_count: t.reopened_count || 0,
            sla_deadline: t.sla_deadline,
            sla_breached: t.sla_breached || false,
            created_at: t.created_at,
            updated_at: t.updated_at
          })

          counts.by_status[t.status] = (counts.by_status[t.status] || 0) + 1
          counts.by_priority[t.priority] = (counts.by_priority[t.priority] || 0) + 1
          if (t.sla_breached) counts.sla_breached++
          if (!t.assigned_to_customer_support_id) counts.unassigned++
          if (t.priority === 'urgent') counts.urgent++
        })
      }
    }

    // PARTNER TICKETS
    if (sourcesToFetch.includes('PARTNER')) {
      let query = supabase
        .from('partner_support_tickets')
        .select(`
          *,
          assignee:employees!partner_support_tickets_assigned_to_partner_support_id_fkey(
            id, full_name
          ),
          routed_employee:employees!partner_support_tickets_routed_to_employee_id_fkey(
            id, full_name
          ),
          messages:partner_ticket_messages(count)
        `, { count: 'exact' })

      if (status?.length) query = query.in('status', status)
      if (priority?.length) query = query.in('priority', priority)
      if (category?.length) query = query.in('category', category)
      if (department?.length) query = query.in('routed_to_department', department)
      if (assignedTo) {
        query = query.or(`assigned_to_partner_support_id.eq.${assignedTo},routed_to_employee_id.eq.${assignedTo}`)
      }
      if (unassigned) {
        query = query.is('assigned_to_partner_support_id', null).is('routed_to_employee_id', null)
      }
      if (slaBreached) query = query.eq('sla_breached', true)
      if (search) {
        const sanitized = search.replace(/[%_\\'"();]/g, '')
        if (sanitized.length > 0) {
          query = query.or(`subject.ilike.%${sanitized}%,ticket_number.ilike.%${sanitized}%,partner_name.ilike.%${sanitized}%`)
        }
      }
      if (dateFrom) query = query.gte('created_at', dateFrom)
      if (dateTo) query = query.lte('created_at', dateTo)
      if (escalated) query = query.gt('escalation_level', 0)

      const { data: partnerTickets, count: partnerCount } = await query
        .order(sortBy as any, { ascending: sortOrder === 'asc' })
        .limit(perSourceLimit)

      if (partnerTickets) {
        counts.by_source.PARTNER = partnerCount || 0
        partnerTickets.forEach((t: any) => {
          tickets.push({
            ticket_source: 'PARTNER',
            unified_ticket_id: `PTR-${t.ticket_number}`,
            id: t.id,
            ticket_number: t.ticket_number,
            subject: t.subject,
            description: t.description,
            category: t.category,
            priority: t.priority,
            status: t.status,
            requester_id: t.partner_id,
            requester_type: 'PARTNER',
            requester_name: t.partner_name || 'Unknown Partner',
            requester_email: t.partner_email || '',
            requester_phone: null,
            assigned_to_id: t.assigned_to_partner_support_id || t.routed_to_employee_id,
            assigned_to_name: t.assignee?.full_name || t.routed_employee?.full_name || null,
            assigned_department: t.routed_to_department,
            is_anonymous: false,
            is_confidential: t.is_confidential || false,
            escalation_level: t.escalation_level || 0,
            first_response_at: t.first_response_at,
            resolved_at: t.resolved_at,
            closed_at: t.closed_at,
            response_time_hours: t.response_time_hours,
            resolution_time_hours: t.resolution_time_hours,
            reopened_count: t.reopened_count || 0,
            sla_deadline: t.sla_deadline,
            sla_breached: t.sla_breached || false,
            created_at: t.created_at,
            updated_at: t.updated_at
          })

          counts.by_status[t.status] = (counts.by_status[t.status] || 0) + 1
          counts.by_priority[t.priority] = (counts.by_priority[t.priority] || 0) + 1
          if (t.sla_breached) counts.sla_breached++
          if (!t.assigned_to_partner_support_id && !t.routed_to_employee_id) counts.unassigned++
          if (t.priority === 'urgent') counts.urgent++
        })
      }
    }

    // Sort combined results with null-safe comparison
    tickets.sort((a, b) => {
      const aVal = (a as any)[sortBy]
      const bVal = (b as any)[sortBy]
      // Handle null/undefined values - push them to the end
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      }
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    })

    // Apply pagination (database-level pagination per source is not feasible with
    // cross-source sorting, so we paginate the merged+sorted results but limit
    // each source query to a reasonable cap to prevent memory issues)
    const paginatedTickets = tickets.slice(offset, offset + limit)
    totalCount = tickets.length
    counts.total = totalCount

    return NextResponse.json({
      tickets: paginatedTickets,
      counts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'getUnifiedTickets' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
