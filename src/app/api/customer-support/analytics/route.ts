
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Check for super admin session cookie (primary auth method)
    const superAdminSession = request.cookies.get('super_admin_session')?.value

    if (!superAdminSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Super Admin access required' }, { status: 401 })
    }

    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '30d'

    let dateFilter = ''
    const now = new Date()
    if (timeframe === '7d') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (timeframe === '30d') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    } else if (timeframe === '90d') {
      dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    }

    let query = supabase.from('customer_support_tickets').select('*')
    if (dateFilter) query = query.gte('created_at', dateFilter)

    const { data: ticketsData, error: ticketsError } = await query

    // Handle missing table gracefully - return empty analytics
    let tickets = ticketsData || []

    if (ticketsError) {
      apiLogger.error('Error fetching tickets (table may not exist yet)', ticketsError)
      // Continue with empty data instead of erroring
    }

    const analytics = {
      overview: {
        total_tickets: tickets?.length || 0,
        open_tickets: tickets?.filter(t => ['new', 'assigned', 'in_progress'].includes(t.status)).length || 0,
        resolved_tickets: tickets?.filter(t => t.status === 'resolved').length || 0,
        closed_tickets: tickets?.filter(t => t.status === 'closed').length || 0,
        sla_breached: tickets?.filter(t => t.sla_breached).length || 0,
      },
      by_status: {
        new: tickets?.filter(t => t.status === 'new').length || 0,
        assigned: tickets?.filter(t => t.status === 'assigned').length || 0,
        in_progress: tickets?.filter(t => t.status === 'in_progress').length || 0,
        pending_customer: tickets?.filter(t => t.status === 'pending_customer').length || 0,
        pending_internal: tickets?.filter(t => t.status === 'pending_internal').length || 0,
        resolved: tickets?.filter(t => t.status === 'resolved').length || 0,
        closed: tickets?.filter(t => t.status === 'closed').length || 0,
        on_hold: tickets?.filter(t => t.status === 'on_hold').length || 0,
        escalated: tickets?.filter(t => t.status === 'escalated').length || 0,
        reopened: tickets?.filter(t => t.status === 'reopened').length || 0,
      },
      by_priority: {
        urgent: tickets?.filter(t => t.priority === 'urgent').length || 0,
        high: tickets?.filter(t => t.priority === 'high').length || 0,
        medium: tickets?.filter(t => t.priority === 'medium').length || 0,
        low: tickets?.filter(t => t.priority === 'low').length || 0,
      },
      by_category: {
        loan_application: tickets?.filter(t => t.category === 'loan_application').length || 0,
        loan_status: tickets?.filter(t => t.category === 'loan_status').length || 0,
        document_verification: tickets?.filter(t => t.category === 'document_verification').length || 0,
        payment_disbursement: tickets?.filter(t => t.category === 'payment_disbursement').length || 0,
        emi_payment: tickets?.filter(t => t.category === 'emi_payment').length || 0,
        technical_issue: tickets?.filter(t => t.category === 'technical_issue').length || 0,
        account_management: tickets?.filter(t => t.category === 'account_management').length || 0,
        complaint: tickets?.filter(t => t.category === 'complaint').length || 0,
        general_inquiry: tickets?.filter(t => t.category === 'general_inquiry').length || 0,
      },
      by_department: {
        customer_support: tickets?.filter(t => t.assigned_department === 'customer_support').length || 0,
        loan_processing: tickets?.filter(t => t.assigned_department === 'loan_processing').length || 0,
        technical_team: tickets?.filter(t => t.assigned_department === 'technical_team').length || 0,
        finance_team: tickets?.filter(t => t.assigned_department === 'finance_team').length || 0,
        operations_team: tickets?.filter(t => t.assigned_department === 'operations_team').length || 0,
      },
      response_times: {
        avg_first_response_hours: '0',
        avg_resolution_hours: '0',
        tickets_with_response: 0,
        tickets_resolved: tickets?.filter(t => t.resolved_at).length || 0,
      },
      sla_compliance: {
        total_tickets: tickets?.length || 0,
        sla_met: tickets?.filter(t => !t.sla_breached).length || 0,
        sla_breached: tickets?.filter(t => t.sla_breached).length || 0,
        compliance_rate: tickets?.length ? ((tickets.filter(t => !t.sla_breached).length / tickets.length) * 100).toFixed(1) : '0',
      },
      trends: { last_7_days: [], last_30_days: [] },
    }

    return NextResponse.json({ analytics }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
