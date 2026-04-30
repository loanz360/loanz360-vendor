
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BATeamMember } from '@/types/bp-profile'

interface RPCTeamMember {
  id: string
  partner_id: string
  full_name: string
  mobile_number: string
  email: string
  work_email: string
  profile_picture_url: string | null
  status: string
  is_active: boolean
  created_at: string
  joining_date: string
  city: string | null
  state: string | null
  state_name: string | null
  total_leads: number
  leads_sanctioned: number
  total_commission: number
  lifetime_earnings: number
  last_lead_date: string | null
}

interface LeadRow {
  partner_id: string
  status: string
}

interface CommissionRow {
  partner_id: string
  amount: string | number
}

interface PartnerStatusRow {
  status: string
  is_active: boolean
}

interface LeadStats {
  total: number
  sanctioned: number
  in_progress: number
  dropped: number
}

/**
 * GET /api/partners/bp/team/members
 * Fetches all Business Associates under the current Business Partner
 * Returns enriched data for My Team section cards and popups
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sort_by') || 'full_name'
    const sortOrder = searchParams.get('sort_order') || 'asc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Fetch partner to verify they are a BP
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Business Partner profile not found' },
        { status: 404 }
      )
    }

    // Try using the RPC function first (if exists)
    try {
      const { data: teamMembers, error: rpcError } = await supabase
        .rpc('get_bp_team_members_detailed', { bp_id: partner.id })

      if (!rpcError && teamMembers) {
        // Apply filters on returned data
        let filteredMembers = teamMembers

        if (status && status !== 'all') {
          filteredMembers = filteredMembers.filter((m: RPCTeamMember) =>
            m.status?.toUpperCase() === status.toUpperCase()
          )
        }

        if (search) {
          const searchLower = search.toLowerCase()
          filteredMembers = filteredMembers.filter((m: RPCTeamMember) =>
            m.full_name?.toLowerCase().includes(searchLower) ||
            m.partner_id?.toLowerCase().includes(searchLower) ||
            m.email?.toLowerCase().includes(searchLower) ||
            m.mobile_number?.includes(search)
          )
        }

        // Sort
        filteredMembers.sort((a: RPCTeamMember, b: RPCTeamMember) => {
          const aVal = (a as Record<string, unknown>)[sortBy] || ''
          const bVal = (b as Record<string, unknown>)[sortBy] || ''
          const comparison = String(aVal).localeCompare(String(bVal))
          return sortOrder === 'desc' ? -comparison : comparison
        })

        // Format for response
        const formattedMembers: BATeamMember[] = filteredMembers.map((member: RPCTeamMember) => ({
          ba_id: member.partner_id || member.id,
          full_name: member.full_name || 'Unknown',
          mobile_number: member.mobile_number || '',
          email_id: member.email || member.work_email || '',
          profile_photo_url: member.profile_picture_url || null,
          status: member.status || 'PENDING',
          onboarding_date: member.created_at || member.joining_date || '',
          total_leads_submitted: member.total_leads || 0,
          total_leads_converted: member.leads_sanctioned || 0,
          conversion_rate: calculateConversionRate(
            member.total_leads || 0,
            member.leads_sanctioned || 0
          ),
          total_commission_earned: member.total_commission || member.lifetime_earnings || 0,
          last_lead_date: member.last_lead_date || null,
          city: member.city || null,
          state: member.state || member.state_name || null,
          performance_rating: calculatePerformanceRating(
            member.total_leads || 0,
            member.leads_sanctioned || 0
          )
        }))

        // Calculate stats
        const stats = {
          total: formattedMembers.length,
          active: formattedMembers.filter(m => m.status === 'ACTIVE').length,
          inactive: formattedMembers.filter(m => m.status === 'INACTIVE').length,
          pending: formattedMembers.filter(m => m.status === 'PENDING').length,
          suspended: formattedMembers.filter(m => m.status === 'SUSPENDED').length
        }

        // Paginate
        const offset = (page - 1) * limit
        const paginatedMembers = formattedMembers.slice(offset, offset + limit)

        return NextResponse.json({
          success: true,
          data: paginatedMembers,
          stats,
          total: formattedMembers.length,
          page,
          limit
        })
      }
    } catch {
      apiLogger.debug('RPC function not available, using direct query')
    }

    // Fallback: Direct query to partners table
    let query = supabase
      .from('partners')
      .select(`
        id,
        partner_id,
        full_name,
        mobile_number,
        work_email,
        profile_picture_url,
        status,
        is_active,
        created_at,
        city,
        state_name,
        recruiting_bp_id
      `, { count: 'exact' })
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .eq('recruiting_bp_id', partner.id)

    // Apply status filter
    if (status && status !== 'all') {
      if (status === 'ACTIVE') {
        query = query.eq('is_active', true)
      } else if (status === 'INACTIVE') {
        query = query.eq('is_active', false)
      } else {
        query = query.eq('status', status)
      }
    }

    // Apply search filter
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,partner_id.ilike.%${search}%,work_email.ilike.%${search}%,mobile_number.ilike.%${search}%`)
    }

    // Apply sorting
    const ascending = sortOrder !== 'desc'
    query = query.order(sortBy, { ascending })

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: baPartners, count, error: queryError } = await query

    if (queryError) {
      apiLogger.error('Error fetching team members', queryError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch team members' },
        { status: 500 }
      )
    }

    // Get lead stats for each BA (batch query)
    const baIds = (baPartners || []).map((p: { id: string }) => p.id)

    let leadStats: Record<string, LeadStats> = {}
    if (baIds.length > 0) {
      const { data: stats } = await supabase
        .from('leads')
        .select('partner_id, status')
        .in('partner_id', baIds)

      if (stats) {
        // Aggregate stats per partner
        stats.forEach((lead: LeadRow) => {
          if (!leadStats[lead.partner_id]) {
            leadStats[lead.partner_id] = {
              total: 0,
              sanctioned: 0,
              in_progress: 0,
              dropped: 0
            }
          }
          leadStats[lead.partner_id].total++
          if (lead.status === 'SANCTIONED' || lead.status === 'DISBURSED') {
            leadStats[lead.partner_id].sanctioned++
          } else if (lead.status === 'IN_PROGRESS' || lead.status === 'PROCESSING') {
            leadStats[lead.partner_id].in_progress++
          } else if (lead.status === 'DROPPED' || lead.status === 'REJECTED') {
            leadStats[lead.partner_id].dropped++
          }
        })
      }
    }

    // Get commission stats for each BA
    let commissionStats: Record<string, number> = {}
    if (baIds.length > 0) {
      const { data: commissions } = await supabase
        .from('partner_commissions')
        .select('partner_id, amount')
        .in('partner_id', baIds)
        .eq('status', 'PAID')

      if (commissions) {
        commissions.forEach((comm: CommissionRow) => {
          if (!commissionStats[comm.partner_id]) {
            commissionStats[comm.partner_id] = 0
          }
          commissionStats[comm.partner_id] += parseFloat(comm.amount) || 0
        })
      }
    }

    // Format response
    const formattedMembers: BATeamMember[] = (baPartners || []).map((ba: typeof baPartners[number]) => {
      const stats = leadStats[ba.id] || { total: 0, sanctioned: 0 }
      const commission = commissionStats[ba.id] || 0

      return {
        ba_id: ba.partner_id || ba.id,
        full_name: ba.full_name || 'Unknown',
        mobile_number: ba.mobile_number || '',
        email_id: ba.work_email || '',
        profile_photo_url: ba.profile_picture_url,
        status: ba.is_active ? 'ACTIVE' : (ba.status || 'INACTIVE'),
        onboarding_date: ba.created_at,
        total_leads_submitted: stats.total,
        total_leads_converted: stats.sanctioned,
        conversion_rate: calculateConversionRate(stats.total, stats.sanctioned),
        total_commission_earned: commission,
        last_lead_date: null, // Would need additional query
        city: ba.city,
        state: ba.state_name,
        performance_rating: calculatePerformanceRating(stats.total, stats.sanctioned)
      }
    })

    // Calculate overall stats
    const allStats = await getTeamStats(supabase, partner.id)

    return NextResponse.json({
      success: true,
      data: formattedMembers,
      stats: allStats,
      total: count || 0,
      page,
      limit
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/bp/team/members', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate conversion rate
function calculateConversionRate(total: number, converted: number): number {
  if (total === 0) return 0
  return Math.round((converted / total) * 100 * 10) / 10
}

// Helper function to calculate performance rating
function calculatePerformanceRating(
  totalLeads: number,
  convertedLeads: number
): 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | null {
  if (totalLeads === 0) return null

  const rate = (convertedLeads / totalLeads) * 100

  if (rate >= 30) return 'EXCELLENT'
  if (rate >= 20) return 'GOOD'
  if (rate >= 10) return 'AVERAGE'
  return 'POOR'
}

// Helper function to get team stats
async function getTeamStats(supabase: SupabaseClient, bpId: string): Promise<{
  total: number
  active: number
  inactive: number
  pending: number
  suspended: number
}> {
  try {
    const { data: members } = await supabase
      .from('partners')
      .select('status, is_active')
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .eq('recruiting_bp_id', bpId)

    if (!members) {
      return { total: 0, active: 0, inactive: 0, pending: 0, suspended: 0 }
    }

    return {
      total: members.length,
      active: members.filter((m: PartnerStatusRow) => m.is_active === true || m.status === 'ACTIVE').length,
      inactive: members.filter((m: PartnerStatusRow) => m.is_active === false && m.status !== 'PENDING' && m.status !== 'SUSPENDED').length,
      pending: members.filter((m: PartnerStatusRow) => m.status === 'PENDING' || m.status === 'PENDING_VERIFICATION').length,
      suspended: members.filter((m: PartnerStatusRow) => m.status === 'SUSPENDED').length
    }
  } catch (error: unknown) {
    apiLogger.error('Error getting team stats', error)
    return { total: 0, active: 0, inactive: 0, pending: 0, suspended: 0 }
  }
}
