import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


async function verifyDSMRole(supabase: unknown, userId: string) {
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) return null
  if (profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_MANAGER') return null
  return profile
}

// GET - List all partners recruited by DSEs in this DSM's team
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await verifyDSMRole(supabase, user.id)
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Access denied. DSM role required.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const search = searchParams.get('search') || ''
    const partnerType = searchParams.get('partner_type') || ''
    const status = searchParams.get('status') || ''
    const dseId = searchParams.get('dse_id') || '' // filter by specific DSE

    // Get all DSEs in this DSM's team
    const { data: teamDSEs } = await supabase
      .from('users')
      .select('id, full_name, employee_code')
      .eq('role', 'EMPLOYEE')
      .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
      .eq('manager_user_id', user.id)

    if (!teamDSEs || teamDSEs.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: { total: 0, active: 0, inactive: 0, total_leads: 0, total_sanctioned: 0 },
        dseList: [],
        meta: { page, limit, total: 0, totalPages: 0 }
      })
    }

    const dseIds = dseId ? [dseId] : teamDSEs.map((d: Record<string, unknown>) => d.id)
    const dseMap = new Map(teamDSEs.map((d: Record<string, unknown>) => [d.id, d]))

    // Query partners recruited by team DSEs
    let query = supabase
      .from('partners')
      .select('id, partner_id, partner_type, full_name, mobile_number, work_email, city, state, is_active, joining_date, recruited_by_cpe, created_at', { count: 'exact' })
      .in('recruited_by_cpe', dseIds)

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,mobile_number.ilike.%${search}%,partner_id.ilike.%${search}%`)
    }
    if (partnerType) {
      query = query.eq('partner_type', partnerType)
    }
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'inactive') {
      query = query.eq('is_active', false)
    }

    const offset = (page - 1) * limit
    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: partners, count, error: queryError } = await query

    if (queryError) throw queryError

    // Get lead counts for each partner
    const partnerUserIds = (partners || []).map((p: unknown) => p.id)
    let leadCounts: Record<string, { total: number; sanctioned: number }> = {}

    if (partnerUserIds.length > 0) {
      // Query partner_leads to get counts
      const { data: allPartnerUserIds } = await supabase
        .from('partners')
        .select('id, user_id')
        .in('id', partnerUserIds)

      if (allPartnerUserIds) {
        const userIds = allPartnerUserIds.map((p: unknown) => p.user_id).filter(Boolean)
        const partnerIdToUserId = new Map(allPartnerUserIds.map((p: unknown) => [p.id, p.user_id]))

        if (userIds.length > 0) {
          const { data: leads } = await supabase
            .from('partner_leads')
            .select('partner_user_id, lead_status')
            .in('partner_user_id', userIds)

          if (leads) {
            const userIdToPartnerId = new Map(allPartnerUserIds.map((p: unknown) => [p.user_id, p.id]))
            for (const lead of leads) {
              const pId = userIdToPartnerId.get(lead.partner_user_id)
              if (pId) {
                if (!leadCounts[pId]) leadCounts[pId] = { total: 0, sanctioned: 0 }
                leadCounts[pId].total++
                if (lead.lead_status === 'SANCTIONED' || lead.lead_status === 'DISBURSED') {
                  leadCounts[pId].sanctioned++
                }
              }
            }
          }
        }
      }
    }

    // Enrich partners with DSE name and lead counts
    const enrichedPartners = (partners || []).map((p: unknown) => {
      const dse = dseMap.get(p.recruited_by_cpe)
      const leads = leadCounts[p.id] || { total: 0, sanctioned: 0 }
      return {
        ...p,
        recruited_by_name: dse?.full_name || 'Unknown',
        recruited_by_code: dse?.employee_code || '-',
        total_leads: leads.total,
        leads_sanctioned: leads.sanctioned,
        conversion_rate: leads.total > 0 ? Math.round((leads.sanctioned / leads.total) * 100) : 0,
      }
    })

    // Summary stats for all team partners
    const { data: allTeamPartners } = await supabase
      .from('partners')
      .select('id, is_active', { count: 'exact' })
      .in('recruited_by_cpe', teamDSEs.map((d: Record<string, unknown>) => d.id))

    const totalPartners = allTeamPartners?.length || 0
    const activePartners = allTeamPartners?.filter((p: unknown) => p.is_active).length || 0

    return NextResponse.json({
      success: true,
      data: enrichedPartners,
      summary: {
        total: totalPartners,
        active: activePartners,
        inactive: totalPartners - activePartners,
        total_leads: Object.values(leadCounts).reduce((s, l) => s + l.total, 0),
        total_sanctioned: Object.values(leadCounts).reduce((s, l) => s + l.sanctioned, 0),
      },
      dseList: teamDSEs.map((d: Record<string, unknown>) => ({ id: d.id, name: d.full_name, code: d.employee_code })),
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching team partners', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
