import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'
import { validateSortColumn, validatePagination } from '@/lib/validations/dse-validation'


const VALID_SORT_COLUMNS = ['created_at', 'customer_name', 'estimated_value', 'lead_stage'] as const

// GET - Unified pipeline view combining DSE's own leads + partner leads
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { searchParams } = new URL(request.url)
    const { page, limit, offset } = validatePagination(searchParams.get('page'), searchParams.get('limit'))
    const source = searchParams.get('source') || 'all' // all | my_direct | from_partners
    const search = sanitizeSearchInput(searchParams.get('search') || '')
    const stage = searchParams.get('stage') || ''
    const leadType = searchParams.get('leadType') || ''
    const sortColumn = validateSortColumn(searchParams.get('sortBy'), [...VALID_SORT_COLUMNS], 'created_at')
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    const results: any[] = []
    const warnings: string[] = []
    let totalMyDirect = 0
    let totalFromPartners = 0

    // Fix 1: When source is "all", split the limit between both tables
    // so combined results stay within the requested limit
    const dseLimit = source === 'all' ? Math.ceil(limit / 2) : limit
    const partnerLimit = source === 'all' ? Math.floor(limit / 2) : limit
    const dseOffset = source === 'all' ? Math.ceil(offset / 2) : offset
    const partnerOffset = source === 'all' ? Math.floor(offset / 2) : offset

    // Fix 2: Columns that exist on partner_leads for sort validation
    const PARTNER_LEADS_SORTABLE_COLUMNS = ['created_at', 'customer_first_name', 'loan_amount', 'lead_status']
    const SORT_COLUMN_MAP: Record<string, string> = {
      'created_at': 'created_at',
      'customer_name': 'customer_first_name',
      'estimated_value': 'loan_amount',
      'lead_stage': 'lead_status',
    }
    const partnerSortColumn = SORT_COLUMN_MAP[sortColumn] && PARTNER_LEADS_SORTABLE_COLUMNS.includes(SORT_COLUMN_MAP[sortColumn])
      ? SORT_COLUMN_MAP[sortColumn]
      : 'created_at'

    // --- Unfiltered total counts for tab sourceCounts ---
    let unfilteredMyDirect = 0
    let unfilteredFromPartners = 0

    // Get unfiltered count for my_direct
    if (source === 'all' || source === 'my_direct') {
      const { count: rawCount, error: rawErr } = await supabase
        .from('dse_leads')
        .select('id', { count: 'exact', head: true })
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false)

      if (rawErr) {
        apiLogger.error('Error fetching unfiltered DSE lead count', rawErr)
      }
      unfilteredMyDirect = rawCount || 0
    }

    // Get unfiltered count for from_partners (need partner IDs)
    let partnerUserIds: string[] = []
    let partnerMap = new Map<string, any>()

    if (source === 'all' || source === 'from_partners') {
      const { data: partners } = await supabase
        .from('partners')
        .select('id, user_id, full_name, partner_type')
        .eq('recruited_by_cpe', user.id)

      if (partners && partners.length > 0) {
        partnerUserIds = partners.map((p: any) => p.user_id).filter(Boolean)
        partnerMap = new Map(partners.map((p: any) => [p.user_id, p]))

        if (partnerUserIds.length > 0) {
          const { count: rawPlCount, error: rawPlErr } = await supabase
            .from('partner_leads')
            .select('id', { count: 'exact', head: true })
            .in('partner_user_id', partnerUserIds)

          if (rawPlErr) {
            apiLogger.error('Error fetching unfiltered partner lead count', rawPlErr)
          }
          unfilteredFromPartners = rawPlCount || 0
        }
      }
    }

    // Fetch DSE's own leads (My Direct) with DB-level pagination
    if (source === 'all' || source === 'my_direct') {
      let query = supabase
        .from('dse_leads')
        .select('id, lead_id, customer_name, mobile, email, city, state, lead_type, lead_stage, estimated_value, source_type, created_at, next_followup_at, company_name, probability_percentage, lead_score', { count: 'exact' })
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false)

      if (search) {
        query = query.or(`customer_name.ilike.%${search}%,company_name.ilike.%${search}%,mobile.ilike.%${search}%,lead_id.ilike.%${search}%`)
      }
      if (stage) {
        query = query.eq('lead_stage', stage)
      }
      if (leadType) {
        query = query.eq('lead_type', leadType)
      }

      // Apply DB-level sort and pagination (use split limit when source is "all")
      const { data: dseLeads, count, error } = await query
        .order(sortColumn, { ascending: sortOrder === 'asc' })
        .range(dseOffset, dseOffset + dseLimit - 1)

      if (error) {
        apiLogger.error('Error fetching DSE leads for unified view', error)
        warnings.push('Failed to fetch some direct leads. Results may be incomplete.')
      }

      totalMyDirect = count || 0

      if (dseLeads) {
        for (const lead of dseLeads) {
          results.push({
            id: lead.id,
            lead_id: lead.lead_id,
            customer_name: lead.customer_name,
            mobile: lead.mobile,
            email: lead.email,
            city: lead.city,
            state: lead.state,
            lead_type: lead.lead_type,
            lead_stage: lead.lead_stage,
            estimated_value: lead.estimated_value,
            source_type: lead.source_type || 'dse_direct',
            created_at: lead.created_at,
            next_followup_at: lead.next_followup_at,
            company_name: lead.company_name,
            probability_percentage: lead.probability_percentage,
            lead_score: lead.lead_score,
            // Source metadata
            _source: 'my_direct',
            _editable: true,
            _partner_name: null,
            _partner_type: null,
          })
        }
      }
    }

    // Fetch partner leads (From Partners) - LIMITED FIELDS ONLY, with DB-level pagination
    if (source === 'all' || source === 'from_partners') {
      if (partnerUserIds.length > 0) {
        let plQuery = supabase
          .from('partner_leads')
          .select('id, lead_id, customer_first_name, customer_city, loan_type, loan_amount, lead_status, form_status, created_at, partner_user_id, assigned_bde_name', { count: 'exact' })
          .in('partner_user_id', partnerUserIds)

        if (search) {
          plQuery = plQuery.or(`customer_first_name.ilike.%${search}%,lead_id.ilike.%${search}%`)
        }
        if (stage) {
          plQuery = plQuery.eq('lead_status', stage)
        }
        if (leadType) {
          plQuery = plQuery.eq('loan_type', leadType)
        }

        // Apply DB-level sort and pagination (use mapped sort column + split limit when source is "all")
        const { data: partnerLeads, count: plCount, error: plError } = await plQuery
          .order(partnerSortColumn, { ascending: sortOrder === 'asc' })
          .range(partnerOffset, partnerOffset + partnerLimit - 1)

        if (plError) {
          apiLogger.error('Error fetching partner leads for unified view', plError)
          warnings.push('Failed to fetch some partner leads. Results may be incomplete.')
        }

        totalFromPartners = plCount || 0

        if (partnerLeads) {
          for (const pl of partnerLeads) {
            const partner = partnerMap.get(pl.partner_user_id)
            results.push({
              id: pl.id,
              lead_id: pl.lead_id,
              customer_name: pl.customer_first_name || 'Customer', // First name only
              mobile: null, // HIDDEN - no PII
              email: null, // HIDDEN - no PII
              city: pl.customer_city,
              state: null,
              lead_type: pl.loan_type,
              lead_stage: pl.lead_status || pl.form_status,
              estimated_value: pl.loan_amount,
              source_type: 'from_partner',
              created_at: pl.created_at,
              next_followup_at: null,
              company_name: null,
              probability_percentage: null,
              lead_score: null,
              // Source metadata
              _source: 'from_partner',
              _editable: false,
              _partner_name: partner?.full_name || 'Unknown Partner',
              _partner_type: partner?.partner_type || 'BA',
              _assigned_bde: pl.assigned_bde_name,
            })
          }
        }
      }
    }

    // Sort merged results (since we merged two DB-paginated sources)
    results.sort((a, b) => {
      const valA = a[sortColumn]
      const valB = b[sortColumn]

      if (sortColumn === 'created_at') {
        const dateA = new Date(valA).getTime()
        const dateB = new Date(valB).getTime()
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'desc' ? valB - valA : valA - valB
      }

      // String comparison
      const strA = String(valA || '').toLowerCase()
      const strB = String(valB || '').toLowerCase()
      return sortOrder === 'desc' ? strB.localeCompare(strA) : strA.localeCompare(strB)
    })

    // Total count across both sources (filtered)
    const totalCount = totalMyDirect + totalFromPartners

    // Fix 3: Pipeline stats from full dataset via separate aggregate queries (not just current page)
    const stageBreakdown: Record<string, { count: number; value: number; my_direct: number; from_partners: number }> = {}

    // Aggregate DSE leads by stage (full dataset, no pagination)
    if (source === 'all' || source === 'my_direct') {
      const { data: dseStages, error: dseStageErr } = await supabase
        .from('dse_leads')
        .select('lead_stage, estimated_value')
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false)

      if (dseStageErr) {
        apiLogger.error('Error fetching DSE lead stage stats', dseStageErr)
      }

      if (dseStages) {
        for (const row of dseStages) {
          const stageKey = row.lead_stage || 'Unknown'
          if (!stageBreakdown[stageKey]) {
            stageBreakdown[stageKey] = { count: 0, value: 0, my_direct: 0, from_partners: 0 }
          }
          stageBreakdown[stageKey].count++
          stageBreakdown[stageKey].value += row.estimated_value || 0
          stageBreakdown[stageKey].my_direct++
        }
      }
    }

    // Aggregate partner leads by stage (full dataset, no pagination)
    if ((source === 'all' || source === 'from_partners') && partnerUserIds.length > 0) {
      const { data: plStages, error: plStageErr } = await supabase
        .from('partner_leads')
        .select('lead_status, loan_amount')
        .in('partner_user_id', partnerUserIds)

      if (plStageErr) {
        apiLogger.error('Error fetching partner lead stage stats', plStageErr)
      }

      if (plStages) {
        for (const row of plStages) {
          const stageKey = row.lead_status || 'Unknown'
          if (!stageBreakdown[stageKey]) {
            stageBreakdown[stageKey] = { count: 0, value: 0, my_direct: 0, from_partners: 0 }
          }
          stageBreakdown[stageKey].count++
          stageBreakdown[stageKey].value += row.loan_amount || 0
          stageBreakdown[stageKey].from_partners++
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        leads: results,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        },
        sourceCounts: {
          all: unfilteredMyDirect + unfilteredFromPartners,
          my_direct: unfilteredMyDirect,
          from_partners: unfilteredFromPartners
        },
        pipelineStats: stageBreakdown,
        ...(warnings.length > 0 ? { warnings } : {})
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error in unified pipeline', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
