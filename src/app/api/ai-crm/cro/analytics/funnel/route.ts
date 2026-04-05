import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  createErrorResponse,
} from '@/lib/api/ai-crm-middleware'
import { toEndOfDay } from '@/lib/constants/sales-pipeline'

export const dynamic = 'force-dynamic'

/** Validate ISO date string (YYYY-MM-DD) */
function isValidISODate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr))
}

/**
 * GET /api/ai-crm/cro/analytics/funnel
 *
 * Returns funnel analytics showing conversion rates at each stage:
 * Contacts -> Positive -> Leads -> Deals -> Sanctioned -> Disbursed
 *
 * Includes: time-in-stage, drop-off rates, and value at each stage.
 *
 * Supports date range filtering: ?from=2026-01-01&to=2026-02-28
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
  if (rateLimitResponse) return rateLimitResponse

  // Authenticate and verify CRO role
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')

    // Validate date params
    if (fromDate && !isValidISODate(fromDate)) {
      return createErrorResponse('Invalid "from" date format. Expected YYYY-MM-DD.', 400, requestId)
    }
    if (toDate && !isValidISODate(toDate)) {
      return createErrorResponse('Invalid "to" date format. Expected YYYY-MM-DD.', 400, requestId)
    }

    // Use toEndOfDay for inclusive end date boundary
    const toDateBoundary = toDate ? toEndOfDay(toDate) : null

    // Build count queries (same as before)
    const buildContactsQuery = () => {
      let q = supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_cro', user.id)
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    const buildPositiveQuery = () => {
      let q = supabase
        .from('crm_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_cro', user.id)
        .in('status', ['positive', 'converted'])
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    const buildLeadsQuery = () => {
      let q = supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    const buildDealsQuery = () => {
      let q = supabase
        .from('crm_deals')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    const buildSanctionedQuery = () => {
      let q = supabase
        .from('crm_deals')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
        .in('status', ['sanctioned', 'disbursed'])
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    const buildDisbursedQuery = () => {
      let q = supabase
        .from('crm_deals')
        .select('id', { count: 'exact', head: true })
        .eq('cro_id', user.id)
        .eq('status', 'disbursed')
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    // ---- NEW: Time-in-stage queries ----
    // Contacts: time from created_at to when status changed to positive (updated_at for positive contacts)
    const buildContactsTimeQuery = () => {
      let q = supabase
        .from('crm_contacts')
        .select('created_at, updated_at')
        .eq('assigned_to_cro', user.id)
        .in('status', ['positive', 'converted'])
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    // Leads: time from created_at to converted_at
    const buildLeadsTimeQuery = () => {
      let q = supabase
        .from('crm_leads')
        .select('created_at, converted_at')
        .eq('cro_id', user.id)
        .eq('status', 'converted')
        .not('converted_at', 'is', null)
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    // Deals: time from created_at to sanctioned_at / disbursed_at
    const buildDealsSanctionTimeQuery = () => {
      let q = supabase
        .from('crm_deals')
        .select('created_at, sanctioned_at')
        .eq('cro_id', user.id)
        .in('status', ['sanctioned', 'disbursed'])
        .not('sanctioned_at', 'is', null)
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    const buildDealsDisbursedTimeQuery = () => {
      let q = supabase
        .from('crm_deals')
        .select('created_at, disbursed_at')
        .eq('cro_id', user.id)
        .eq('status', 'disbursed')
        .not('disbursed_at', 'is', null)
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    // ---- NEW: Value at each stage queries ----
    const buildContactsValueQuery = () => {
      let q = supabase
        .from('crm_contacts')
        .select('loan_amount')
        .eq('assigned_to_cro', user.id)
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    const buildPositiveValueQuery = () => {
      let q = supabase
        .from('crm_contacts')
        .select('loan_amount')
        .eq('assigned_to_cro', user.id)
        .in('status', ['positive', 'converted'])
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    const buildLeadsValueQuery = () => {
      let q = supabase
        .from('crm_leads')
        .select('loan_amount')
        .eq('cro_id', user.id)
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    const buildDealsValueQuery = () => {
      let q = supabase
        .from('crm_deals')
        .select('loan_amount, sanctioned_amount')
        .eq('cro_id', user.id)
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    const buildSanctionedValueQuery = () => {
      let q = supabase
        .from('crm_deals')
        .select('loan_amount, sanctioned_amount')
        .eq('cro_id', user.id)
        .in('status', ['sanctioned', 'disbursed'])
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    const buildDisbursedValueQuery = () => {
      let q = supabase
        .from('crm_deals')
        .select('loan_amount, disbursed_amount')
        .eq('cro_id', user.id)
        .eq('status', 'disbursed')
      if (fromDate) q = q.gte('created_at', fromDate)
      if (toDateBoundary) q = q.lte('created_at', toDateBoundary)
      return q
    }

    // Parallelize all queries
    const [
      contactsResult,
      positiveResult,
      leadsResult,
      dealsResult,
      sanctionedResult,
      disbursedResult,
      // Time-in-stage
      contactsTimeResult,
      leadsTimeResult,
      dealsSanctionTimeResult,
      dealsDisbursedTimeResult,
      // Value at stage
      contactsValueResult,
      positiveValueResult,
      leadsValueResult,
      dealsValueResult,
      sanctionedValueResult,
      disbursedValueResult,
    ] = await Promise.all([
      buildContactsQuery(),
      buildPositiveQuery(),
      buildLeadsQuery(),
      buildDealsQuery(),
      buildSanctionedQuery(),
      buildDisbursedQuery(),
      // Time queries
      buildContactsTimeQuery(),
      buildLeadsTimeQuery(),
      buildDealsSanctionTimeQuery(),
      buildDealsDisbursedTimeQuery(),
      // Value queries
      buildContactsValueQuery(),
      buildPositiveValueQuery(),
      buildLeadsValueQuery(),
      buildDealsValueQuery(),
      buildSanctionedValueQuery(),
      buildDisbursedValueQuery(),
    ])

    // Check for errors
    const warnings: string[] = []
    if (contactsResult.error) warnings.push('contacts')
    if (positiveResult.error) warnings.push('positive_contacts')
    if (leadsResult.error) warnings.push('leads')
    if (dealsResult.error) warnings.push('deals')
    if (sanctionedResult.error) warnings.push('sanctioned')
    if (disbursedResult.error) warnings.push('disbursed')
    if (contactsTimeResult.error) warnings.push('contacts_time')
    if (leadsTimeResult.error) warnings.push('leads_time')
    if (dealsSanctionTimeResult.error) warnings.push('deals_sanction_time')
    if (dealsDisbursedTimeResult.error) warnings.push('deals_disbursed_time')

    if (warnings.length > 0) {
      logApiError(
        new Error(`Funnel partial query failures: ${warnings.join(', ')}`),
        request,
        { action: 'get_funnel_analytics_partial', requestId }
      )
    }

    const totalContacts = contactsResult.count ?? 0
    const totalPositive = positiveResult.count ?? 0
    const totalLeads = leadsResult.count ?? 0
    const totalDeals = dealsResult.count ?? 0
    const totalSanctioned = sanctionedResult.count ?? 0
    const totalDisbursed = disbursedResult.count ?? 0

    // ---- Calculate average time-in-stage (days) ----
    function avgDays(records: Array<{ created_at: string; [key: string]: string | null }>, endField: string): number {
      const valid = records.filter(r => r[endField])
      if (valid.length === 0) return 0
      const totalMs = valid.reduce((sum, r) => {
        const start = new Date(r.created_at).getTime()
        const end = new Date(r[endField] as string).getTime()
        return sum + Math.max(0, end - start)
      }, 0)
      return Math.round((totalMs / valid.length / (24 * 60 * 60 * 1000)) * 10) / 10
    }

    const contactsToPositiveDays = avgDays(contactsTimeResult.data || [], 'updated_at')
    const leadsToConvertedDays = avgDays(leadsTimeResult.data || [], 'converted_at')
    const dealsToSanctionedDays = avgDays(dealsSanctionTimeResult.data || [], 'sanctioned_at')
    const dealsToDisbursedDays = avgDays(dealsDisbursedTimeResult.data || [], 'disbursed_at')

    // ---- Calculate value at each stage ----
    function sumAmount(records: Array<Record<string, unknown>>, ...fields: string[]): number {
      return records.reduce((sum, r) => {
        for (const f of fields) {
          const val = Number(r[f] || 0)
          if (val > 0) return sum + val
        }
        return sum
      }, 0)
    }

    const contactsValue = sumAmount(contactsValueResult.data || [], 'loan_amount')
    const positiveValue = sumAmount(positiveValueResult.data || [], 'loan_amount')
    const leadsValue = sumAmount(leadsValueResult.data || [], 'loan_amount')
    const dealsValue = sumAmount(dealsValueResult.data || [], 'sanctioned_amount', 'loan_amount')
    const sanctionedValue = sumAmount(sanctionedValueResult.data || [], 'sanctioned_amount', 'loan_amount')
    const disbursedValue = sumAmount(disbursedValueResult.data || [], 'disbursed_amount', 'loan_amount')

    // Build funnel stages with enriched data
    const stages = [
      {
        name: 'Contacts',
        count: totalContacts,
        color: '#6366f1',
        avgDaysInStage: contactsToPositiveDays,
        value: Math.round(contactsValue),
      },
      {
        name: 'Positive',
        count: totalPositive,
        color: '#f59e0b',
        avgDaysInStage: 0, // Positive to lead time approximated from lead creation
        value: Math.round(positiveValue),
      },
      {
        name: 'Leads',
        count: totalLeads,
        color: '#f97316',
        avgDaysInStage: leadsToConvertedDays,
        value: Math.round(leadsValue),
      },
      {
        name: 'Deals',
        count: totalDeals,
        color: '#22c55e',
        avgDaysInStage: dealsToSanctionedDays,
        value: Math.round(dealsValue),
      },
      {
        name: 'Sanctioned',
        count: totalSanctioned,
        color: '#3b82f6',
        avgDaysInStage: dealsToDisbursedDays,
        value: Math.round(sanctionedValue),
      },
      {
        name: 'Disbursed',
        count: totalDisbursed,
        color: '#10b981',
        avgDaysInStage: 0,
        value: Math.round(disbursedValue),
      },
    ]

    // Calculate conversion rates and drop-off between stages
    const conversions = stages.map((stage, index) => {
      if (index === 0) return { ...stage, conversionRate: 100, dropOff: 0 }
      const prevCount = stages[index - 1].count
      const rate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 0
      return {
        ...stage,
        conversionRate: rate,
        dropOff: prevCount > 0 ? 100 - rate : 0,
      }
    })

    // Overall conversion
    const overallRate = totalContacts > 0
      ? Math.round((totalDeals / totalContacts) * 100)
      : 0

    return NextResponse.json({
      success: true,
      data: {
        stages: conversions,
        overallConversionRate: overallRate,
        totalContacts,
        totalDeals,
        totalDisbursed,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'get_funnel_analytics', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
