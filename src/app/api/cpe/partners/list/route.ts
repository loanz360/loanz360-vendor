
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/cpe/partners/list
 *
 * Get paginated list of partners managed by CPE with filters
 * Query params:
 *   - partnerType: BUSINESS_ASSOCIATE | BUSINESS_PARTNER | CHANNEL_PARTNER
 *   - status: ACTIVE | INACTIVE | SUSPENDED | PENDING
 *   - registrationMonth: YYYY-MM
 *   - businessMin: Minimum business volume
 *   - businessMax: Maximum business volume
 *   - search: Search by name or mobile
 *   - sortBy: name | created_at | total_business_sourced | total_applications_sourced (default: created_at)
 *   - sortOrder: asc | desc (default: desc)
 *   - limit: Number of records (default: 20)
 *   - offset: Pagination offset (default: 0)
 *
 * Returns:
 *   - List of partners with summary data
 *   - Pagination info
 *   - Filter summary (counts by type, status)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
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
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const partnerType = searchParams.get('partnerType')
    const status = searchParams.get('status')
    const registrationMonth = searchParams.get('registrationMonth')
    const businessMin = searchParams.get('businessMin')
    const businessMax = searchParams.get('businessMax')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Validate sortBy parameter
    const validSortColumns = ['full_name', 'created_at', 'total_business_sourced', 'total_applications_sourced']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'

    // Build base query
    let query = supabase
      .from('partners')
      .select(
        `
        id,
        full_name,
        mobile_number,
        email,
        partner_type,
        status,
        created_at,
        total_business_sourced,
        total_applications_sourced,
        last_active_at,
        profile_picture_url
      `,
        { count: 'exact' }
      )
      .eq('recruited_by_cpe', user.id)

    // Apply filters
    if (partnerType) {
      query = query.eq('partner_type', partnerType)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (registrationMonth) {
      const startDate = `${registrationMonth}-01`
      const endDate = new Date(registrationMonth)
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(0) // Last day of the month
      const endDateStr = endDate.toISOString().split('T')[0]

      query = query.gte('created_at', startDate).lte('created_at', `${endDateStr}T23:59:59.999Z`)
    }

    if (businessMin) {
      query = query.gte('total_business_sourced', parseFloat(businessMin))
    }

    if (businessMax) {
      query = query.lte('total_business_sourced', parseFloat(businessMax))
    }

    if (search) {
      // Search in name or mobile
      query = query.or(`full_name.ilike.%${search}%,mobile_number.ilike.%${search}%`)
    }

    // Apply sorting and pagination
    const { data: partners, error: partnersError, count } = await query
      .order(sortColumn, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    if (partnersError) {
      apiLogger.error('Error fetching partners list', partnersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partners list' },
        { status: 500 }
      )
    }

    // Get filter summary (counts by type and status) - all partners for this CPE
    const { data: allPartners, error: summaryError } = await supabase
      .from('partners')
      .select('partner_type, status')
      .eq('recruited_by_cpe', user.id)

    if (summaryError) {
      apiLogger.error('Error fetching filter summary', summaryError)
    }

    // Calculate filter summary
    const filterSummary = {
      byType: {
        BUSINESS_ASSOCIATE: 0,
        BUSINESS_PARTNER: 0,
        CHANNEL_PARTNER: 0,
      },
      byStatus: {
        ACTIVE: 0,
        INACTIVE: 0,
        SUSPENDED: 0,
        PENDING: 0,
      },
      total: allPartners?.length || 0,
    }

    allPartners?.forEach((partner) => {
      if (partner.partner_type && filterSummary.byType[partner.partner_type as keyof typeof filterSummary.byType] !== undefined) {
        filterSummary.byType[partner.partner_type as keyof typeof filterSummary.byType]++
      }
      if (partner.status && filterSummary.byStatus[partner.status as keyof typeof filterSummary.byStatus] !== undefined) {
        filterSummary.byStatus[partner.status as keyof typeof filterSummary.byStatus]++
      }
    })

    // Format partners for response
    const formattedPartners = partners?.map((partner) => ({
      id: partner.id,
      fullName: partner.full_name,
      mobileNumber: partner.mobile_number,
      email: partner.email,
      partnerType: partner.partner_type,
      partnerTypeDisplay: partner.partner_type?.replace(/_/g, ' ') || 'N/A',
      status: partner.status,
      registeredAt: partner.created_at,
      registrationDate: new Date(partner.created_at).toLocaleDateString('en-IN'),
      totalBusinessSourced: partner.total_business_sourced || 0,
      totalApplicationsSourced: partner.total_applications_sourced || 0,
      lastActiveAt: partner.last_active_at,
      profilePictureUrl: partner.profile_picture_url,
      // Calculated fields
      daysSinceRegistration: Math.floor(
        (new Date().getTime() - new Date(partner.created_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
      isActive: partner.status === 'ACTIVE',
      businessPerApplication: partner.total_applications_sourced
        ? (partner.total_business_sourced || 0) / partner.total_applications_sourced
        : 0,
    }))

    const response = {
      success: true,
      data: {
        partners: formattedPartners,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil((count || 0) / limit),
        },
        filterSummary,
        appliedFilters: {
          partnerType: partnerType || null,
          status: status || null,
          registrationMonth: registrationMonth || null,
          businessRange: {
            min: businessMin ? parseFloat(businessMin) : null,
            max: businessMax ? parseFloat(businessMax) : null,
          },
          search: search || null,
          sortBy: sortColumn,
          sortOrder,
        },
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in partners list API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
