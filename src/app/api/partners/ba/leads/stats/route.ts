/**
 * API Route: BA Lead Statistics
 * GET /api/partners/ba/leads/stats - Get lead statistics for BA
 *
 * Rate Limit: 60 requests per minute (read operation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type { LeadStatsResponse } from '@/types/partner-leads'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Apply rate limiting (ADDED)
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as LeadStatsResponse,
        { status: 401 }
      )
    }

    // 2. Get partner information
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' } as LeadStatsResponse,
        { status: 404 }
      )
    }

    // 3. Get statistics from leads table
    let stats = {
      total_leads: 0,
      pending_leads: 0,
      opened_leads: 0,
      filled_leads: 0,
      submitted_leads: 0,
      converted_leads: 0,
      dropped_leads: 0,
      whatsapp_sent_count: 0,
      conversion_rate: 0,
    }

    try {
      // Try RPC function first
      const { data: rpcStats, error: rpcError } = await supabase
        .rpc('get_partner_lead_stats', { p_partner_id: partner.id })
        .maybeSingle()

      if (!rpcError && rpcStats) {
        stats = rpcStats
      } else {
        // Fallback: Calculate stats from leads table directly
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('lead_status, form_status')
          .eq('partner_id', partner.id)

        if (!leadsError && leads) {
          stats.total_leads = leads.length
          stats.pending_leads = leads.filter((l) =>
            ['NEW_UNASSIGNED', 'NEW', 'PENDING'].includes(l.lead_status || '')
          ).length
          stats.submitted_leads = leads.filter((l) =>
            ['SUBMITTED', 'PHASE_1_SUBMITTED', 'PHASE_2_SUBMITTED'].includes(l.form_status || '')
          ).length
          stats.converted_leads = leads.filter((l) =>
            ['DISBURSED', 'SANCTIONED', 'APPROVED', 'CONVERTED'].includes(l.lead_status || '')
          ).length
          stats.dropped_leads = leads.filter((l) =>
            ['REJECTED', 'CANCELLED', 'CLOSED', 'EXPIRED'].includes(l.lead_status || '')
          ).length
          stats.opened_leads = leads.filter((l) =>
            ['IN_PROGRESS', 'CONTACTED', 'DOCUMENTS_PENDING'].includes(l.lead_status || '')
          ).length
          stats.filled_leads = leads.filter((l) =>
            l.form_status === 'PHASE_2_SUBMITTED' || (l.form_status || '').includes('COMPLETED')
          ).length
          stats.conversion_rate =
            stats.total_leads > 0
              ? Math.round((stats.converted_leads / stats.total_leads) * 100)
              : 0
        }
      }
    } catch (statsError) {
      apiLogger.error('Stats fetch error (falling back to zeros)', statsError)
      // Keep default zeros
    }

    // 4. Return response
    return NextResponse.json({
      success: true,
      data: stats,
    } as LeadStatsResponse)
  } catch (error) {
    apiLogger.error('Get stats error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as LeadStatsResponse,
      { status: 500 }
    )
  }
}
