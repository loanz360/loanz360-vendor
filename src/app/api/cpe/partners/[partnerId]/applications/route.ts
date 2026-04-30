
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/cpe/partners/[partnerId]/applications
 *
 * Get list of loan applications sourced by a specific partner
 * Query params:
 *   - status: Filter by application status
 *   - dateFrom: Start date (YYYY-MM-DD)
 *   - dateTo: End date (YYYY-MM-DD)
 *   - limit: Number of records (default: 20)
 *   - offset: Pagination offset (default: 0)
 *
 * Returns:
 *   - List of applications with details
 *   - Pagination info
 *   - Status summary
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a Channel Partner Executive
    const isCPE = await verifyCPERole(supabase, user)

    if (!isCPE) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Channel Partner Executive role required.' },
        { status: 403 }
      )
    }

    const { partnerId } = params

    // Verify partner belongs to this CPE
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, full_name, partner_type')
      .eq('id', partnerId)
      .eq('recruited_by_cpe', user.id)
      .maybeSingle()

    if (partnerError || !partner) {
      apiLogger.error('Error fetching partner', partnerError)
      return NextResponse.json(
        { success: false, error: 'Partner not found or access denied' },
        { status: 404 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query for applications
    let query = supabase
      .from('loan_applications')
      .select(
        `
        id,
        applicant_name,
        applicant_mobile,
        loan_amount,
        loan_type,
        status,
        created_at,
        updated_at,
        disbursed_amount,
        disbursed_at,
        rejection_reason
      `,
        { count: 'exact' }
      )
      .eq('sourced_by_partner', partnerId)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    if (dateTo) {
      const dateToEnd = new Date(dateTo)
      dateToEnd.setHours(23, 59, 59, 999)
      query = query.lte('created_at', dateToEnd.toISOString())
    }

    // Execute query with pagination
    const { data: applications, error: applicationsError, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (applicationsError) {
      apiLogger.error('Error fetching applications', applicationsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch applications' },
        { status: 500 }
      )
    }

    // Get status summary (all applications for this partner)
    const { data: allApplications, error: summaryError } = await supabase
      .from('loan_applications')
      .select('status, loan_amount, disbursed_amount')
      .eq('sourced_by_partner', partnerId)

    if (summaryError) {
      apiLogger.error('Error fetching status summary', summaryError)
    }

    // Calculate status summary
    const statusSummary = {
      total: allApplications?.length || 0,
      created: 0,
      submitted: 0,
      underReview: 0,
      verified: 0,
      approved: 0,
      disbursed: 0,
      rejected: 0,
      totalLoanAmount: 0,
      totalDisbursed: 0,
    }

    allApplications?.forEach((app) => {
      statusSummary.totalLoanAmount += parseFloat(app.loan_amount || 0)
      statusSummary.totalDisbursed += parseFloat(app.disbursed_amount || 0)

      const appStatus = app.status?.toLowerCase()
      if (appStatus === 'created') statusSummary.created++
      else if (appStatus === 'submitted') statusSummary.submitted++
      else if (appStatus === 'under_review') statusSummary.underReview++
      else if (appStatus === 'verified') statusSummary.verified++
      else if (appStatus === 'approved') statusSummary.approved++
      else if (appStatus === 'disbursed') statusSummary.disbursed++
      else if (appStatus === 'rejected') statusSummary.rejected++
    })

    // Calculate conversion rate
    const conversionRate = statusSummary.total > 0 ? (statusSummary.disbursed / statusSummary.total) * 100 : 0

    // Format applications for response
    const formattedApplications = applications?.map((app) => ({
      id: app.id,
      applicantName: app.applicant_name,
      applicantMobile: app.applicant_mobile,
      loanAmount: app.loan_amount,
      loanType: app.loan_type,
      status: app.status,
      statusDisplay: app.status?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'N/A',
      createdAt: app.created_at,
      createdDate: new Date(app.created_at).toLocaleDateString('en-IN'),
      updatedAt: app.updated_at,
      disbursedAmount: app.disbursed_amount,
      disbursedAt: app.disbursed_at,
      rejectionReason: app.rejection_reason,
      // Calculated fields
      daysSinceCreation: Math.floor(
        (new Date().getTime() - new Date(app.created_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
      isDisbursed: app.status === 'DISBURSED',
      isRejected: app.status === 'REJECTED',
      isPending: !['DISBURSED', 'REJECTED'].includes(app.status || ''),
    }))

    const response = {
      success: true,
      data: {
        partner: {
          id: partner.id,
          name: partner.full_name,
          type: partner.partner_type,
        },
        applications: formattedApplications,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil((count || 0) / limit),
        },
        statusSummary: {
          ...statusSummary,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
          avgLoanAmount: statusSummary.total > 0 ? parseFloat((statusSummary.totalLoanAmount / statusSummary.total).toFixed(2)) : 0,
        },
        appliedFilters: {
          status: status || null,
          dateRange: {
            from: dateFrom || null,
            to: dateTo || null,
          },
        },
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in partner applications API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
