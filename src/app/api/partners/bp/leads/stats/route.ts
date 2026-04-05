/**
 * API Route: BP Lead Statistics
 * GET /api/partners/bp/leads/stats - Get lead statistics for BP
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
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' } as LeadStatsResponse,
        { status: 404 }
      )
    }

    // 3. Get statistics using database function
    const { data: stats, error: statsError } = await supabase
      .rpc('get_partner_lead_stats', { p_partner_id: partner.id })
      .maybeSingle()

    if (statsError) {
      apiLogger.error('Stats fetch error', statsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch statistics' } as LeadStatsResponse,
        { status: 500 }
      )
    }

    // 4. Get lead quality distribution
    const { data: qualityLeads } = await supabase
      .from('leads')
      .select('lead_quality_score')
      .eq('partner_id', partner.id)
      .not('lead_quality_score', 'is', null)

    let high_quality_leads = 0
    let medium_quality_leads = 0
    let low_quality_leads = 0

    if (qualityLeads) {
      qualityLeads.forEach((lead) => {
        const score = lead.lead_quality_score || 0
        if (score >= 80) high_quality_leads++
        else if (score >= 50) medium_quality_leads++
        else low_quality_leads++
      })
    }

    // 5. Get qualified leads count
    const { count: qualifiedCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', partner.id)
      .eq('lead_status', 'QUALIFIED')

    // 6. Return response with extended stats
    return NextResponse.json({
      success: true,
      data: {
        ...(stats || {
          total_leads: 0,
          pending_leads: 0,
          opened_leads: 0,
          filled_leads: 0,
          submitted_leads: 0,
          converted_leads: 0,
          dropped_leads: 0,
          whatsapp_sent_count: 0,
          conversion_rate: 0,
        }),
        // Analytics extensions
        qualified_leads: qualifiedCount || 0,
        high_quality_leads,
        medium_quality_leads,
        low_quality_leads,
      },
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
