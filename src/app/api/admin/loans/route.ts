import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'


export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const loanType = searchParams.get('type') || ''
    const offset = (page - 1) * limit

    let query = supabase
      .from('loan_applications_v2')
      .select(`
        id, application_id, loan_amount_requested, loan_tenure_months,
        status, created_at, updated_at, submitted_at,
        approved_amount, approved_interest_rate, total_disbursed,
        loan_category_id, created_by_type, assigned_to_id,
        primary_applicant_id
      `, { count: 'exact' })

    if (search) {
      query = query.or(`application_id.ilike.%${search}%`)
    }
    if (status) query = query.eq('status', status)

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: loans, error, count } = await query

    if (error) {
      // Fallback to loan_applications if v2 doesn't exist
      const { data: legacyLoans, error: legacyErr, count: legacyCount } = await supabase
        .from('loan_applications')
        .select('id, loan_type, amount, status, customer_name, application_number, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (legacyErr) {
        return NextResponse.json({ success: false, error: 'Failed to fetch loans' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: legacyLoans || [],
        total: legacyCount || 0,
        page, limit,
        totalPages: Math.ceil((legacyCount || 0) / limit)
      })
    }

    // Enrich with applicant names
    const applicantIds = (loans || []).map((l: unknown) => l.primary_applicant_id).filter(Boolean)
    let applicantMap: Record<string, string> = {}
    if (applicantIds.length > 0) {
      try {
        const { data: applicants } = await supabase
          .from('loan_applicant_profiles')
          .select('id, first_name, last_name')
          .in('id', applicantIds)
        if (applicants) {
          applicants.forEach((a: unknown) => {
            applicantMap[a.id] = `${a.first_name || ''} ${a.last_name || ''}`.trim()
          })
        }
      } catch { /* ignore */ }
    }

    // Stats summary
    const allStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DISBURSED', 'REJECTED', 'PENDING_APPROVAL']
    let statusCounts: Record<string, number> = {}
    try {
      for (const s of allStatuses) {
        const { count: cnt } = await supabase.from('loan_applications_v2').select('*', { count: 'exact', head: true }).eq('status', s)
        if (cnt) statusCounts[s] = cnt
      }
    } catch { /* ignore */ }

    const enriched = (loans || []).map((l: unknown) => ({
      ...l,
      customerName: applicantMap[l.primary_applicant_id] || 'Unknown Customer',
      amount: l.loan_amount_requested,
      applicationNumber: l.application_id,
    }))

    return NextResponse.json({
      success: true,
      data: enriched,
      total: count || 0,
      page, limit,
      totalPages: Math.ceil((count || 0) / limit),
      statusCounts
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
