import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

async function verifyDSMRole(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) return null
  if (profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_MANAGER') return null
  return profile
}

// GET - List all partner leads from DSEs in this DSM's team (field-filtered, read-only)
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
    const stage = searchParams.get('stage') || ''
    const loanType = searchParams.get('loan_type') || ''
    const dseId = searchParams.get('dse_id') || ''

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
        pipeline: {},
        dseList: [],
        meta: { page, limit, total: 0, totalPages: 0 }
      })
    }

    const dseIds = dseId ? [dseId] : teamDSEs.map((d: any) => d.id)

    // Get partners recruited by team DSEs
    const { data: partners } = await supabase
      .from('partners')
      .select('id, user_id, full_name, partner_type, recruited_by_cpe')
      .in('recruited_by_cpe', dseIds)

    if (!partners || partners.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pipeline: {},
        dseList: teamDSEs.map((d: any) => ({ id: d.id, name: d.full_name, code: d.employee_code })),
        meta: { page, limit, total: 0, totalPages: 0 }
      })
    }

    const partnerUserIds = partners.map((p: any) => p.user_id).filter(Boolean)
    const partnerMap = new Map(partners.map((p: any) => [p.user_id, p]))
    const dseMap = new Map(teamDSEs.map((d: any) => [d.id, d]))

    if (partnerUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pipeline: {},
        dseList: teamDSEs.map((d: any) => ({ id: d.id, name: d.full_name, code: d.employee_code })),
        meta: { page, limit, total: 0, totalPages: 0 }
      })
    }

    // Query partner leads - FIELD FILTERED (no PII)
    let query = supabase
      .from('partner_leads')
      .select('id, lead_id, customer_first_name, customer_city, loan_type, loan_amount, lead_status, form_status, created_at, partner_user_id, assigned_bde_name', { count: 'exact' })
      .in('partner_user_id', partnerUserIds)

    if (search) {
      query = query.or(`customer_first_name.ilike.%${search}%,lead_id.ilike.%${search}%`)
    }
    if (stage) {
      query = query.eq('lead_status', stage)
    }
    if (loanType) {
      query = query.eq('loan_type', loanType)
    }

    const offset = (page - 1) * limit
    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: leads, count, error: queryError } = await query

    if (queryError) throw queryError

    // Enrich with partner and DSE info
    const enrichedLeads = (leads || []).map((lead: any) => {
      const partner = partnerMap.get(lead.partner_user_id)
      const dse = partner ? dseMap.get(partner.recruited_by_cpe) : null
      return {
        id: lead.id,
        lead_id: lead.lead_id,
        customer_name: lead.customer_first_name || 'Customer',
        customer_city: lead.customer_city,
        loan_type: lead.loan_type,
        loan_amount: lead.loan_amount,
        lead_status: lead.lead_status,
        form_status: lead.form_status,
        created_at: lead.created_at,
        assigned_bde: lead.assigned_bde_name,
        partner_name: partner?.full_name || 'Unknown',
        partner_type: partner?.partner_type || '-',
        dse_name: dse?.full_name || 'Unknown',
        dse_code: dse?.employee_code || '-',
        is_read_only: true,
      }
    })

    // Pipeline summary
    const { data: allLeads } = await supabase
      .from('partner_leads')
      .select('lead_status, loan_amount')
      .in('partner_user_id', partnerUserIds)

    const pipeline: Record<string, { count: number; value: number }> = {}
    for (const l of (allLeads || [])) {
      const s = l.lead_status || 'Unknown'
      if (!pipeline[s]) pipeline[s] = { count: 0, value: 0 }
      pipeline[s].count++
      pipeline[s].value += l.loan_amount || 0
    }

    return NextResponse.json({
      success: true,
      data: enrichedLeads,
      pipeline,
      dseList: teamDSEs.map((d: any) => ({ id: d.id, name: d.full_name, code: d.employee_code })),
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching team partner leads', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
