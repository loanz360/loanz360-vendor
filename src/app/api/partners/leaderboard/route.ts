import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


interface PartnerRow {
  id: string
  partner_id: string
  full_name: string
  partner_type: string
  profile_picture_url: string | null
  city: string | null
  state_name: string | null
  created_at: string
}

interface LeadRow {
  partner_id: string
  status: string
}

interface CommissionRow {
  partner_id: string
  amount: string | number
}

/**
 * GET /api/partners/leaderboard
 * Returns partner leaderboard ranked by leads converted + commission earned
 *
 * Query Parameters:
 * - partner_type: 'BA' | 'BP' | 'CP' | 'ALL' (default: 'ALL')
 * - period: '7d' | '30d' | '90d' | 'all' (default: '30d')
 * - metric: 'leads' | 'conversions' | 'commission' (default: 'conversions')
 * - limit: number (default: 20)
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const partnerType = searchParams.get('partner_type')?.toUpperCase() || 'ALL'
    const period = searchParams.get('period') || '30d'
    const metric = searchParams.get('metric') || 'conversions'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    // Calculate date filter
    let dateFilter: string | null = null
    const now = new Date()
    if (period === '7d') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (period === '30d') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    } else if (period === '90d') {
      dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    }

    // Fetch all active partners of the specified type
    let partnerQuery = supabase
      .from('partners')
      .select('id, partner_id, full_name, partner_type, profile_picture_url, city, state_name, created_at')
      .eq('is_active', true)

    if (partnerType !== 'ALL') {
      const typeMap: Record<string, string> = {
        'BA': 'BUSINESS_ASSOCIATE',
        'BP': 'BUSINESS_PARTNER',
        'CP': 'CHANNEL_PARTNER',
      }
      partnerQuery = partnerQuery.eq('partner_type', typeMap[partnerType] || partnerType)
    } else {
      partnerQuery = partnerQuery.in('partner_type', ['BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER'])
    }

    const { data: partners, error: partnersError } = await partnerQuery

    if (partnersError) {
      apiLogger.error('Leaderboard: failed to fetch partners', partnersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partners' },
        { status: 500 }
      )
    }

    if (!partners || partners.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        period,
        metric,
        count: 0,
      })
    }

    const partnerIds = partners.map((p: PartnerRow) => p.id)

    // Fetch leads for these partners
    let leadsQuery = supabase
      .from('leads')
      .select('partner_id, status')
      .in('partner_id', partnerIds)

    if (dateFilter) {
      leadsQuery = leadsQuery.gte('created_at', dateFilter)
    }

    const { data: leads } = await leadsQuery

    // Aggregate leads per partner
    const leadStats: Record<string, { total: number; converted: number }> = {}
    if (leads) {
      leads.forEach((lead: LeadRow) => {
        if (!leadStats[lead.partner_id]) {
          leadStats[lead.partner_id] = { total: 0, converted: 0 }
        }
        leadStats[lead.partner_id].total++
        if (lead.status === 'SANCTIONED' || lead.status === 'DISBURSED') {
          leadStats[lead.partner_id].converted++
        }
      })
    }

    // Fetch commissions for these partners
    let commQuery = supabase
      .from('partner_commissions')
      .select('partner_id, amount')
      .in('partner_id', partnerIds)
      .eq('status', 'PAID')

    if (dateFilter) {
      commQuery = commQuery.gte('created_at', dateFilter)
    }

    const { data: commissions } = await commQuery

    // Aggregate commissions per partner
    const commStats: Record<string, number> = {}
    if (commissions) {
      commissions.forEach((c: CommissionRow) => {
        if (!commStats[c.partner_id]) commStats[c.partner_id] = 0
        commStats[c.partner_id] += parseFloat(String(c.amount)) || 0
      })
    }

    // Build leaderboard entries
    const entries = partners.map((p: PartnerRow) => {
      const leads = leadStats[p.id] || { total: 0, converted: 0 }
      const commission = commStats[p.id] || 0
      const conversionRate = leads.total > 0 ? Math.round((leads.converted / leads.total) * 1000) / 10 : 0

      let score = 0
      if (metric === 'leads') score = leads.total
      else if (metric === 'conversions') score = leads.converted
      else if (metric === 'commission') score = commission

      return {
        partnerId: p.partner_id,
        name: p.full_name,
        partnerType: p.partner_type,
        profileUrl: p.profile_picture_url,
        city: p.city,
        state: p.state_name,
        totalLeads: leads.total,
        conversions: leads.converted,
        conversionRate,
        totalCommission: Math.round(commission),
        score,
        joinedAt: p.created_at,
      }
    })

    // Sort by score descending
    entries.sort((a: { score: number }, b: { score: number }) => b.score - a.score)

    // Assign ranks and limit
    const ranked = entries.slice(0, limit).map((entry: typeof entries[number], index: number) => ({
      ...entry,
      rank: index + 1,
    }))

    // Find current user's rank
    const { data: currentPartner } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .in('partner_type', ['BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER'])
      .limit(1)
      .maybeSingle()

    let myRank: number | null = null
    if (currentPartner) {
      const myIndex = entries.findIndex((e: typeof entries[number]) => e.partnerId === currentPartner.partner_id)
      if (myIndex >= 0) myRank = myIndex + 1
    }

    return NextResponse.json({
      success: true,
      data: ranked,
      myRank,
      totalParticipants: entries.length,
      period,
      metric,
      count: ranked.length,
    })

  } catch (error: unknown) {
    apiLogger.error('Leaderboard: unexpected error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
