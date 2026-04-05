import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { sendLeadNotification } from '@/lib/notifications/ulap-lead-notifications'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

interface LeadRow {
  id: string
  lead_id: string
  customer_name: string
  loan_type: string
  status: string
  updated_at: string
  created_at: string
}

/**
 * GET /api/partners/reminders
 * Returns leads that need follow-up (stale leads with no activity)
 *
 * Query Parameters:
 * - days: number of days of inactivity before flagging (default: 3)
 * - limit: max results (default: 20)
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

    const { searchParams } = new URL(request.url)
    const staleDays = parseInt(searchParams.get('days') || '3')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    // Get partner record
    const { data: partner } = await supabase
      .from('partners')
      .select('id, partner_type')
      .eq('user_id', user.id)
      .in('partner_type', ['BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER'])
      .limit(1)
      .maybeSingle()

    if (!partner) {
      return NextResponse.json({ success: false, error: 'Partner not found' }, { status: 404 })
    }

    // Calculate the cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - staleDays)

    // Fetch leads that are in active statuses but haven't been updated recently
    const activeStatuses = ['NEW', 'IN_PROGRESS', 'PROCESSING', 'PENDING', 'SUBMITTED', 'UNDER_REVIEW']

    const { data: staleLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, lead_id, customer_name, loan_type, status, updated_at, created_at')
      .eq('partner_id', partner.id)
      .in('status', activeStatuses)
      .lt('updated_at', cutoffDate.toISOString())
      .order('updated_at', { ascending: true })
      .limit(limit)

    if (leadsError) {
      apiLogger.error('Reminders: failed to fetch stale leads', leadsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch reminders' }, { status: 500 })
    }

    const now = Date.now()
    const reminders = (staleLeads || []).map((lead: LeadRow) => {
      const lastActivity = new Date(lead.updated_at || lead.created_at).getTime()
      const daysInactive = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24))

      let urgency: 'low' | 'medium' | 'high' = 'low'
      if (daysInactive >= 7) urgency = 'high'
      else if (daysInactive >= 5) urgency = 'medium'

      return {
        leadId: lead.lead_id || lead.id,
        customerName: lead.customer_name,
        loanType: lead.loan_type,
        status: lead.status,
        lastActivity: lead.updated_at || lead.created_at,
        daysInactive,
        urgency,
        message: `Follow up needed - ${daysInactive} day${daysInactive !== 1 ? 's' : ''} since last activity`,
      }
    })

    // Count by urgency
    const summary = {
      total: reminders.length,
      high: reminders.filter((r: { urgency: string }) => r.urgency === 'high').length,
      medium: reminders.filter((r: { urgency: string }) => r.urgency === 'medium').length,
      low: reminders.filter((r: { urgency: string }) => r.urgency === 'low').length,
    }

    return NextResponse.json({
      success: true,
      data: reminders,
      summary,
      staleDays,
    })

  } catch (error: unknown) {
    apiLogger.error('Reminders: unexpected error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/partners/reminders
 * Triggers follow-up reminder notifications for specific leads
 *
 * Body: { lead_ids: string[] } - IDs of leads to send reminders for
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { lead_ids } = await request.json()
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'lead_ids array is required' }, { status: 400 })
    }

    // Get partner record
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!partner) {
      return NextResponse.json({ success: false, error: 'Partner not found' }, { status: 404 })
    }

    // Fetch leads to send reminders for
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, lead_id, customer_name, customer_mobile, customer_email, loan_type, required_loan_amount')
      .eq('partner_id', partner.id)
      .in('id', lead_ids.slice(0, 20))

    if (leadsError || !leads || leads.length === 0) {
      return NextResponse.json({ success: false, error: 'No matching leads found' }, { status: 404 })
    }

    // Send follow-up reminder notifications (non-blocking)
    const results = await Promise.allSettled(
      leads.map(lead =>
        sendLeadNotification({
          type: 'FOLLOW_UP_REMINDER',
          leadId: lead.id,
          leadNumber: lead.lead_id || lead.id,
          customerName: lead.customer_name || '',
          customerMobile: lead.customer_mobile || '',
          customerEmail: lead.customer_email || undefined,
          loanType: lead.loan_type || 'Not Specified',
          loanAmount: lead.required_loan_amount || 0,
          partnerId: partner.id,
        })
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({
      success: true,
      data: { sent, failed, total: leads.length },
      message: `Follow-up reminders sent for ${sent} lead${sent !== 1 ? 's' : ''}`,
    })

  } catch (error: unknown) {
    apiLogger.error('Reminders POST: unexpected error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
