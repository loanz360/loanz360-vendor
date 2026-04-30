import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'
import { buildSearchFilter } from '@/lib/utils/search-sanitizer'


// GET - List partners recruited by this DSE with accurate summary stats
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20')), 100)
    const offset = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const partnerType = searchParams.get('partner_type') || ''
    const status = searchParams.get('status') || ''
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') === 'asc'

    // FIX: Run summary stats query SEPARATELY from paginated data query
    // This ensures summary reflects ALL partners, not just current page
    const [summaryResult, paginatedResult] = await Promise.all([
      // Summary: aggregate stats across ALL partners for this DSE
      (async () => {
        const { data: allPartners, count: totalCount } = await supabase
          .from('partners')
          .select('is_active, total_leads, leads_sanctioned', { count: 'exact' })
          .eq('recruited_by_cpe', userId)

        const partners = allPartners || []
        return {
          total: totalCount || 0,
          active: partners.filter((p: Record<string, unknown>) => p.is_active === true).length,
          inactive: partners.filter((p: Record<string, unknown>) => p.is_active === false).length,
          total_leads: partners.reduce((sum: number, p: Record<string, unknown>) => sum + ((p.total_leads as number) || 0), 0),
          total_sanctioned: partners.reduce((sum: number, p: Record<string, unknown>) => sum + ((p.leads_sanctioned as number) || 0), 0),
          overall_conversion_rate: (() => {
            const totalLeads = partners.reduce((s: number, p: Record<string, unknown>) => s + ((p.total_leads as number) || 0), 0)
            const totalSanctioned = partners.reduce((s: number, p: Record<string, unknown>) => s + ((p.leads_sanctioned as number) || 0), 0)
            return totalLeads > 0 ? Math.round((totalSanctioned / totalLeads) * 100) : 0
          })(),
        }
      })(),

      // Paginated partners with filters
      (async () => {
        let query = supabase
          .from('partners')
          .select(`
            id, partner_id, partner_type, full_name, mobile_number, work_email,
            city, state, is_active, joining_date,
            total_leads, leads_in_progress, leads_sanctioned, leads_dropped,
            estimated_payout, actual_payout, lifetime_earnings,
            total_logins, last_login_at,
            created_at, updated_at
          `, { count: 'exact' })
          .eq('recruited_by_cpe', userId)

        // Apply filters
        if (partnerType) {
          query = query.eq('partner_type', partnerType)
        }
        if (status === 'active') {
          query = query.eq('is_active', true)
        } else if (status === 'inactive') {
          query = query.eq('is_active', false)
        }

        // Sanitized search filter
        const searchFilter = buildSearchFilter(search, ['full_name', 'mobile_number', 'partner_id', 'work_email'])
        if (searchFilter) {
          query = query.or(searchFilter)
        }

        // Sorting
        const validSortColumns = ['created_at', 'full_name', 'total_leads', 'leads_sanctioned', 'lifetime_earnings', 'last_login_at']
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
        query = query.order(sortColumn, { ascending: sortOrder })

        // Pagination
        query = query.range(offset, offset + limit - 1)

        return query
      })(),
    ])

    const { data: partners, error: fetchError, count } = paginatedResult

    if (fetchError) {
      apiLogger.error('DSE my-partners list error', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partners', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    // Enrich with computed fields
    const now = new Date()
    const enrichedPartners = (partners || []).map((p: Record<string, unknown>) => {
      const totalLeads = (p.total_leads as number) || 0
      const sanctioned = (p.leads_sanctioned as number) || 0
      const conversionRate = totalLeads > 0 ? Math.round((sanctioned / totalLeads) * 100) : 0
      const lastLogin = p.last_login_at ? new Date(p.last_login_at as string) : null
      const daysSinceLogin = lastLogin ? Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)) : null

      // Churn risk classification
      let churnRisk: 'GREEN' | 'YELLOW' | 'RED' | 'BLACK' = 'GREEN'
      if (!p.is_active) {
        churnRisk = 'BLACK'
      } else if (daysSinceLogin !== null && daysSinceLogin > 30) {
        churnRisk = 'RED'
      } else if (daysSinceLogin !== null && daysSinceLogin > 14) {
        churnRisk = 'YELLOW'
      }

      return {
        ...p,
        conversion_rate: conversionRate,
        days_since_last_login: daysSinceLogin,
        partner_type_label: (p.partner_type as string || '').replace(/_/g, ' '),
        churn_risk: churnRisk,
      }
    })

    return NextResponse.json({
      success: true,
      data: enrichedPartners,
      summary: summaryResult,
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: unknown) {
    apiLogger.error('DSE my-partners error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
