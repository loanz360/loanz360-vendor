/**
 * Super Admin Lead Timeline API
 * GET /api/superadmin/lead-timeline
 *
 * Provides a unified activity timeline for a specific lead.
 * Supports search mode (find leads) and timeline mode (view activities).
 *
 * Query params:
 *   - search: string  -> search leads by name/mobile/email
 *   - lead_id: string -> get timeline for a specific lead
 *   - types: string   -> comma-separated event type filter
 *   - from: string    -> ISO date range start
 *   - to: string      -> ISO date range end
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Super Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('lead_id')
    const search = searchParams.get('search')

    // ─── Search Mode ─────────────────────────────────────────────────
    if (search && !leadId) {
      const searchTerm = `%${search}%`

      // Also try matching by UUID-like lead_id directly
      let leads: unknown[] = []
      let searchError: unknown = null

      // Check if search term looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search)

      if (isUUID) {
        const { data, error } = await supabase
          .from('partner_leads')
          .select('id, customer_name, customer_mobile, customer_email, loan_type, required_loan_amount, lead_status, form_status, created_at, converted')
          .eq('id', search)
          .limit(1)

        leads = data || []
        searchError = error
      } else {
        const { data, error } = await supabase
          .from('partner_leads')
          .select('id, customer_name, customer_mobile, customer_email, loan_type, required_loan_amount, lead_status, form_status, created_at, converted')
          .or(`customer_name.ilike.${searchTerm},customer_mobile.ilike.${searchTerm},customer_email.ilike.${searchTerm}`)
          .order('created_at', { ascending: false })
          .limit(20)

        leads = data || []
        searchError = error
      }

      if (searchError) {
        apiLogger.error('[Lead Timeline] Search error', searchError)
        return NextResponse.json(
          { success: false, error: 'Failed to search leads' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        mode: 'search',
        data: { leads }
      })
    }

    // ─── Timeline Mode ──────────────────────────────────────────────
    if (leadId) {
      // Get lead details
      const { data: lead, error: leadError } = await supabase
        .from('partner_leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle()

      if (leadError || !lead) {
        return NextResponse.json(
          { success: false, error: 'Lead not found' },
          { status: 404 }
        )
      }

      // Fetch activity log entries for this lead
      const [activityRes, commRes] = await Promise.all([
        supabase
          .from('admin_activity_log')
          .select('*')
          .eq('target_id', leadId)
          .order('created_at', { ascending: false })
          .limit(100),
        // Try communication log - may not exist
        supabase
          .from('communication_log')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(50)
          .then(res => res)
          .catch(() => ({ data: [], error: null }))
      ])

      const activities = activityRes.data || []
      const communications = commRes?.data || []

      // Build unified timeline
      const timeline: TimelineEvent[] = []

      // Lead creation event
      timeline.push({
        id: `created-${lead.id}`,
        type: 'lead_created',
        timestamp: lead.created_at,
        title: 'Lead Created',
        description: `New lead for ${formatLoanType(lead.loan_type)} - ${formatIndianCurrency(lead.required_loan_amount || 0)}`,
        actor: lead.partner_id ? 'Partner' : 'System',
        metadata: { loan_type: lead.loan_type, amount: lead.required_loan_amount }
      })

      // Activity log events
      activities.forEach((act: unknown) => {
        timeline.push({
          id: act.id,
          type: mapActivityType(act.action_type),
          timestamp: act.created_at,
          title: formatActionTitle(act.action_type),
          description: act.details?.description || act.details?.message || `${act.action_type} on ${act.target_type}`,
          actor: act.details?.actor_name || act.details?.performed_by || 'Admin',
          metadata: act.details || {}
        })
      })

      // Communication events
      communications.forEach((comm: unknown) => {
        timeline.push({
          id: comm.id,
          type: 'communication',
          timestamp: comm.created_at,
          title: `${(comm.channel || 'Message').charAt(0).toUpperCase() + (comm.channel || 'message').slice(1)} Sent`,
          description: comm.subject || comm.message || 'Communication sent to lead',
          actor: comm.sent_by || 'System',
          metadata: { channel: comm.channel, status: comm.status }
        })
      })

      // Sort by timestamp descending (newest first)
      timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // Apply optional type filter
      const typesParam = searchParams.get('types')
      const fromParam = searchParams.get('from')
      const toParam = searchParams.get('to')

      let filtered = timeline

      if (typesParam) {
        const allowedTypes = typesParam.split(',').map(t => t.trim())
        filtered = filtered.filter(evt => allowedTypes.includes(evt.type))
      }
      if (fromParam) {
        const fromDate = new Date(fromParam).getTime()
        filtered = filtered.filter(evt => new Date(evt.timestamp).getTime() >= fromDate)
      }
      if (toParam) {
        const toDate = new Date(toParam).getTime()
        filtered = filtered.filter(evt => new Date(evt.timestamp).getTime() <= toDate)
      }

      return NextResponse.json({
        success: true,
        mode: 'timeline',
        data: {
          lead,
          timeline: filtered,
          totalEvents: timeline.length,
        }
      })
    }

    return NextResponse.json(
      { success: false, error: 'Provide either search or lead_id query parameter' },
      { status: 400 }
    )
  } catch (error: unknown) {
    apiLogger.error('[Lead Timeline API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── Types ─────────────────────────────────────────────────────────

interface TimelineEvent {
  id: string
  type: string
  timestamp: string
  title: string
  description: string
  actor: string
  metadata: Record<string, unknown>
}

// ─── Helpers ───────────────────────────────────────────────────────

function mapActivityType(actionType: string): string {
  const at = (actionType || '').toLowerCase()
  if (at.includes('status') || at.includes('update_status')) return 'status_changed'
  if (at.includes('assign') || at.includes('cro')) return 'assigned'
  if (at.includes('note') || at.includes('comment')) return 'note_added'
  if (at.includes('document') || at.includes('upload') || at.includes('file')) return 'document_uploaded'
  if (at.includes('email') || at.includes('sms') || at.includes('whatsapp') || at.includes('message')) return 'communication'
  if (at.includes('form') || at.includes('application')) return 'form_updated'
  return 'admin_action'
}

function formatActionTitle(actionType: string): string {
  return (actionType || 'Action')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

function formatLoanType(loanType: string | null): string {
  if (!loanType) return 'Loan'
  return loanType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function formatIndianCurrency(amount: number): string {
  if (!amount) return '₹0'
  return `₹${amount.toLocaleString('en-IN')}`
}

