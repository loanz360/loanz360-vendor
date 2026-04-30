import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


const VALID_TIMEFRAMES = ['7d', '30d', '90d']

/**
 * GET /api/superadmin/customer-management/analytics
 * Fetch customer analytics with optimized queries
 *
 * Rate Limit: 60 requests per minute
 *
 * Query Parameters:
 * - timeframe: 7d | 30d | 90d (default: 30d)
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  return readRateLimiter(request, async (req) => {
    return await getAnalyticsHandler(req)
  })
}

async function getAnalyticsHandler(request: NextRequest) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '30d'

    // Validate timeframe
    if (!VALID_TIMEFRAMES.includes(timeframe)) {
      return NextResponse.json({
        success: false,
        error: `Invalid timeframe. Must be one of: ${VALID_TIMEFRAMES.join(', ')}`
      }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // Calculate date filter
    const now = new Date()
    let dateFilter: string

    if (timeframe === '7d') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (timeframe === '30d') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    } else {
      dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    }

    // Use database aggregation instead of fetching all data
    // This is much more efficient for large datasets
    const { data: customerStats, error: statsError } = await supabase
      .rpc('get_customer_analytics', {
        p_timeframe_days: timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
      })

    if (statsError) {
      apiLogger.error('Error fetching customer analytics', statsError)
      // Fallback to basic query if RPC doesn't exist yet
      return await getLegacyAnalytics(supabase, dateFilter)
    }

    return NextResponse.json({
      success: true,
      analytics: customerStats
    }, { status: 200 })

  } catch (error) {
    apiLogger.error('Error in customer analytics API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Fallback legacy analytics (will be replaced by database function)
async function getLegacyAnalytics(supabase: ReturnType<typeof createSupabaseAdmin>, dateFilter: string) {
  try {
    // Fetch aggregated customer counts by category using GROUP BY
    const { data: customersByCategory } = await supabase
      .from('customers')
      .select(`
        customer_category,
        users!inner(sub_role, status, created_at)
      `)

    const customers = customersByCategory || []

    // Fetch loan applications
    let loanQuery = supabase
      .from('loan_applications')
      .select('*')

    if (dateFilter) {
      loanQuery = loanQuery.gte('created_at', dateFilter)
    }

    const { data: loansData, error: loansError } = await loanQuery

    if (loansError) {
      apiLogger.error('Error fetching loans', loansError)
    }

    const loans = loansData || []

    // Fetch customer activities
    let activitiesQuery = supabase
      .from('customer_activities')
      .select('*')

    if (dateFilter) {
      activitiesQuery = activitiesQuery.gte('created_at', dateFilter)
    }

    const { data: activitiesData, error: activitiesError } = await activitiesQuery

    if (activitiesError) {
      apiLogger.error('Error fetching activities', activitiesError)
    }

    const activities = activitiesData || []

    // Calculate analytics by category
    const categories = {
      'INDIVIDUAL': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'SALARIED': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'PROPRIETOR': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'PARTNERSHIP': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'PRIVATE_LIMITED_COMPANY': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'PUBLIC_LIMITED_COMPANY': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'LLP': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'DOCTOR': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'LAWYER': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'PURE_RENTAL': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'AGRICULTURE': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'NRI': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'CHARTERED_ACCOUNTANT': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'COMPANY_SECRETARY': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'HUF': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
    }

    // Count customers by sub_role
    customers.forEach((customer: unknown) => {
      const subRole = customer.users?.sub_role
      if (subRole && categories[subRole as keyof typeof categories]) {
        categories[subRole as keyof typeof categories].count++
      }
    })

    // Calculate growth trends (simplified - compare with previous period)
    const previousPeriodStart = new Date(now.getTime() - (dateFilter ? (2 * (now.getTime() - new Date(dateFilter).getTime())) : 60 * 24 * 60 * 60 * 1000))

    Object.keys(categories).forEach(key => {
      const category = key as keyof typeof categories
      const previousCount = customers.filter((c: unknown) => {
        const subRole = c.users?.sub_role
        const createdAt = new Date(c.created_at)
        return subRole === category && createdAt < new Date(dateFilter || now) && createdAt >= previousPeriodStart
      }).length

      const currentCount = categories[category].count
      categories[category].growth = currentCount - previousCount
      categories[category].trend = currentCount > previousCount ? 'up' : currentCount < previousCount ? 'down' : 'neutral'
    })

    // Calculate activity types
    const activityTypes = {
      'REGISTRATION': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'LOGIN': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'LOAN_APPLICATION': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'DOCUMENT_UPLOAD': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
      'SUPPORT_TICKET': { count: 0, growth: 0, trend: 'neutral' as 'up' | 'down' | 'neutral' },
    }

    activities.forEach((activity: unknown) => {
      const activityType = activity.activity_type
      if (activityType === 'REGISTRATION') {
        activityTypes.REGISTRATION.count++
      } else if (activityType === 'LOGIN') {
        activityTypes.LOGIN.count++
      } else if (activityType.includes('LOAN')) {
        activityTypes.LOAN_APPLICATION.count++
      } else if (activityType === 'DOCUMENT_UPLOAD') {
        activityTypes.DOCUMENT_UPLOAD.count++
      } else if (activityType.includes('SUPPORT_TICKET')) {
        activityTypes.SUPPORT_TICKET.count++
      }
    })

    // Calculate KYC status distribution
    const kycPending = customers.filter((c: unknown) => c.kyc_status === 'PENDING').length
    const kycUnderReview = customers.filter((c: unknown) => c.kyc_status === 'UNDER_REVIEW').length
    const kycApproved = customers.filter((c: unknown) => c.kyc_status === 'APPROVED').length
    const kycRejected = customers.filter((c: unknown) => c.kyc_status === 'REJECTED').length

    // Calculate loan application status
    const loansDraft = loans.filter((l: unknown) => l.application_status === 'DRAFT').length
    const loansSubmitted = loans.filter((l: unknown) => l.application_status === 'SUBMITTED').length
    const loansUnderReview = loans.filter((l: unknown) => l.application_status === 'UNDER_REVIEW').length
    const loansApproved = loans.filter((l: unknown) => l.application_status === 'APPROVED').length
    const loansRejected = loans.filter((l: unknown) => l.application_status === 'REJECTED').length
    const loansDisbursed = loans.filter((l: unknown) => l.application_status === 'DISBURSED').length

    // Calculate total loan amount
    const totalLoanAmount = loans.reduce((sum: number, loan: unknown) => sum + (parseFloat(loan.loan_amount) || 0), 0)
    const approvedLoanAmount = loans
      .filter((l: unknown) => ['APPROVED', 'DISBURSED'].includes(l.application_status))
      .reduce((sum: number, loan: unknown) => sum + (parseFloat(loan.loan_amount) || 0), 0)

    // Build analytics response
    const analytics = {
      overview: {
        total_customers: customers.length,
        active_customers: customers.filter((c: unknown) => c.users?.status === 'ACTIVE').length,
        new_customers_period: customers.filter((c: unknown) => {
          const createdAt = new Date(c.created_at)
          return dateFilter ? createdAt >= new Date(dateFilter) : true
        }).length,
        inactive_customers: customers.filter((c: unknown) => c.users?.status === 'INACTIVE').length,
      },
      by_category: categories,
      by_activity_type: activityTypes,
      kyc_status: {
        pending: kycPending,
        under_review: kycUnderReview,
        approved: kycApproved,
        rejected: kycRejected,
        total: customers.length,
        approval_rate: customers.length > 0 ? ((kycApproved / customers.length) * 100).toFixed(1) : '0',
      },
      loan_applications: {
        total: loans.length,
        draft: loansDraft,
        submitted: loansSubmitted,
        under_review: loansUnderReview,
        approved: loansApproved,
        rejected: loansRejected,
        disbursed: loansDisbursed,
        total_amount: totalLoanAmount.toFixed(2),
        approved_amount: approvedLoanAmount.toFixed(2),
        approval_rate: loans.length > 0 ? ((loansApproved / loans.length) * 100).toFixed(1) : '0',
      },
      recent_activities: activities.slice(0, 50).map((activity: unknown) => ({
        id: activity.id,
        customer_name: activity.customer_name,
        customer_email: activity.customer_email,
        activity_type: activity.activity_type,
        activity_title: activity.activity_title,
        activity_description: activity.activity_description,
        created_at: activity.created_at,
      })),
    }

    return NextResponse.json({ analytics }, { status: 200 })
  } catch (error) {
    apiLogger.error('Error in customer analytics API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
