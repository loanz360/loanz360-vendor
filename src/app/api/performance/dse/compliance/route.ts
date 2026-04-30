import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import type { ComplianceSummary } from '@/lib/types/dse-enhanced-performance.types'


/**
 * GET /api/performance/dse/compliance
 * Returns DSA compliance summary for the authenticated DSE.
 * Tracks MITC disclosure, KYC, interest rate disclosures, etc.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const months = Math.min(Math.max(parseInt(searchParams.get('months') || '3'), 1), 12)

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const adminClient = createSupabaseAdmin()
    const { data: profile } = await adminClient
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    // Fetch compliance records
    const { data: records, error: compError } = await adminClient
      .from('dse_compliance_tracking')
      .select('*')
      .eq('dse_user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (compError) {
      apiLogger.error('Error fetching compliance data', compError)
      return NextResponse.json({ error: 'Failed to fetch compliance data' }, { status: 500 })
    }

    const entries = records || []

    // Calculate compliance summary
    const totalApplications = entries.length
    const fullyCompliant = entries.filter((e) =>
      e.mitc_disclosed &&
      e.interest_rate_disclosed &&
      e.charges_disclosed &&
      e.customer_consent_obtained &&
      e.kyc_verified
    ).length

    const allIssues = entries.flatMap((e) => e.issues || [])
    const criticalIssues = allIssues.filter((i: unknown) => i.severity === 'critical').length
    const avgScore = entries.length > 0
      ? entries.reduce((sum, e) => sum + (e.compliance_score || 0), 0) / entries.length
      : 100

    const summary: ComplianceSummary = {
      total_applications: totalApplications,
      fully_compliant: fullyCompliant,
      compliance_rate: totalApplications > 0 ? (fullyCompliant / totalApplications) * 100 : 100,
      issues_count: allIssues.length,
      average_compliance_score: Number(avgScore.toFixed(1)),
      critical_issues: criticalIssues,
    }

    // Compliance checklist breakdown
    const checklistBreakdown = {
      mitc_disclosure: {
        compliant: entries.filter((e) => e.mitc_disclosed).length,
        total: totalApplications,
        rate: totalApplications > 0 ? (entries.filter((e) => e.mitc_disclosed).length / totalApplications) * 100 : 100,
      },
      interest_rate_disclosure: {
        compliant: entries.filter((e) => e.interest_rate_disclosed).length,
        total: totalApplications,
        rate: totalApplications > 0 ? (entries.filter((e) => e.interest_rate_disclosed).length / totalApplications) * 100 : 100,
      },
      charges_disclosure: {
        compliant: entries.filter((e) => e.charges_disclosed).length,
        total: totalApplications,
        rate: totalApplications > 0 ? (entries.filter((e) => e.charges_disclosed).length / totalApplications) * 100 : 100,
      },
      customer_consent: {
        compliant: entries.filter((e) => e.customer_consent_obtained).length,
        total: totalApplications,
        rate: totalApplications > 0 ? (entries.filter((e) => e.customer_consent_obtained).length / totalApplications) * 100 : 100,
      },
      kyc_verification: {
        compliant: entries.filter((e) => e.kyc_verified).length,
        total: totalApplications,
        rate: totalApplications > 0 ? (entries.filter((e) => e.kyc_verified).length / totalApplications) * 100 : 100,
      },
      cooling_off_period: {
        compliant: entries.filter((e) => e.cooling_off_period_respected).length,
        total: totalApplications,
        rate: totalApplications > 0 ? (entries.filter((e) => e.cooling_off_period_respected).length / totalApplications) * 100 : 100,
      },
    }

    // Recent non-compliant items
    const nonCompliantItems = entries
      .filter((e) =>
        !e.mitc_disclosed ||
        !e.interest_rate_disclosed ||
        !e.charges_disclosed ||
        !e.customer_consent_obtained ||
        !e.kyc_verified
      )
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        loan_application_id: e.loan_application_id,
        compliance_score: e.compliance_score,
        missing_items: [
          !e.mitc_disclosed && 'MITC Disclosure',
          !e.interest_rate_disclosed && 'Interest Rate Disclosure',
          !e.charges_disclosed && 'Charges Disclosure',
          !e.customer_consent_obtained && 'Customer Consent',
          !e.kyc_verified && 'KYC Verification',
          !e.cooling_off_period_respected && 'Cooling Off Period',
        ].filter(Boolean),
        created_at: e.created_at,
      }))

    return NextResponse.json({
      summary,
      checklist_breakdown: checklistBreakdown,
      non_compliant_items: nonCompliantItems,
      period: { months },
    })
  } catch (error) {
    apiLogger.error('Error in compliance API', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
