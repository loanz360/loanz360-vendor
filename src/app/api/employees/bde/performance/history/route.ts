import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

        const supabase = await createClient()

        // Get current user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('id, full_name, sub_role, location')
            .eq('id', user.id)
            .maybeSingle()

        if (profileError || !profile) {
            return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 })
        }

        // Verify user is a BDE
        if (profile.sub_role !== 'BUSINESS_DEVELOPMENT_EXECUTIVE') {
            return NextResponse.json(
                { error: 'Access denied. This endpoint is for BDEs only.' },
                { status: 403 }
            )
        }

        // Get month parameter from query string
        const { searchParams } = new URL(request.url)
        const monthParam = searchParams.get('month') // Format: YYYY-MM

        if (!monthParam) {
            return NextResponse.json({ success: false, error: 'Month parameter is required (format: YYYY-MM)' }, { status: 400 })
        }

        // Parse month parameter
        const [year, month] = monthParam.split('-').map(Number)
        if (!year || !month || month < 1 || month > 12) {
            return NextResponse.json({ success: false, error: 'Invalid month format. Use YYYY-MM' }, { status: 400 })
        }

        // Get selected month start and end dates
        const selectedMonthStart = new Date(year, month - 1, 1)
        const selectedMonthEnd = new Date(year, month, 0, 23, 59, 59)

        // Get previous month for comparison
        const previousMonthStart = new Date(year, month - 2, 1)
        const previousMonthEnd = new Date(year, month - 1, 0, 23, 59, 59)

        // Fetch selected month performance metrics
        const { data: selectedMonthApps, error: appsError } = await supabase
            .from('crm_leads')
            .select('id, status, loan_amount, created_at')
            .eq('cro_id', user.id)
            .is('deleted_at', null)
            .gte('created_at', selectedMonthStart.toISOString())
            .lte('created_at', selectedMonthEnd.toISOString())

        if (appsError) {
            apiLogger.error('Error fetching applications', appsError)
            return NextResponse.json({ success: false, error: 'Failed to fetch applications' }, { status: 500 })
        }

        // Calculate selected month metrics
        const currentMonth = {
            totalAssigned: selectedMonthApps?.length || 0,
            loginCompleted: selectedMonthApps?.filter((app: any) => app.status === 'active' || app.status === 'follow_up').length || 0,
            sanctioned: selectedMonthApps?.filter((app: any) => app.status === 'qualified').length || 0,
            dropped: selectedMonthApps?.filter((app: any) => app.status === 'dropped').length || 0,
            disbursed: selectedMonthApps?.filter((app: any) => app.status === 'converted').length || 0,
            rejected: selectedMonthApps?.filter((app: any) => app.status === 'dropped').length || 0,
        }

        // Fetch previous month data for comparison
        const { data: previousMonthApps } = await supabase
            .from('crm_leads')
            .select('id, status, loan_amount')
            .eq('cro_id', user.id)
            .is('deleted_at', null)
            .gte('created_at', previousMonthStart.toISOString())
            .lte('created_at', previousMonthEnd.toISOString())

        const previousMonth = {
            totalAssigned: previousMonthApps?.length || 0,
            loginCompleted: previousMonthApps?.filter((app: any) => app.status === 'active' || app.status === 'follow_up').length || 0,
            sanctioned: previousMonthApps?.filter((app: any) => app.status === 'qualified').length || 0,
            dropped: previousMonthApps?.filter((app: any) => app.status === 'dropped').length || 0,
            disbursed: previousMonthApps?.filter((app: any) => app.status === 'converted').length || 0,
            rejected: previousMonthApps?.filter((app: any) => app.status === 'dropped').length || 0,
        }

        // Calculate month-over-month trends
        const trends = {
            totalAssigned: calculateTrend(currentMonth.totalAssigned, previousMonth.totalAssigned),
            loginCompleted: calculateTrend(currentMonth.loginCompleted, previousMonth.loginCompleted),
            sanctioned: calculateTrend(currentMonth.sanctioned, previousMonth.sanctioned),
            dropped: calculateTrend(currentMonth.dropped, previousMonth.dropped),
            disbursed: calculateTrend(currentMonth.disbursed, previousMonth.disbursed),
            rejected: calculateTrend(currentMonth.rejected, previousMonth.rejected),
        }

        // Get daily trends for selected month
        const dailyTrends = await getDailyTrends(supabase, user.id, selectedMonthStart, selectedMonthEnd)

        // Get organization benchmark for selected month
        const benchmark = await getOrganizationBenchmark(supabase, selectedMonthStart, selectedMonthEnd)

        // Get leaderboard for selected month
        const leaderboard = await getLeaderboard(supabase, user.id, profile.location, selectedMonthStart, selectedMonthEnd)

        // Find current user rank
        const currentUserRank = leaderboard.findIndex((entry: any) => entry.userId === user.id) + 1

        // Calculate last month summary (month before selected month)
        const lastMonth = {
            filesDisbursed: previousMonthApps?.filter((app: any) => app.status === 'converted').length || 0,
            volumeDisbursed: previousMonthApps
                ?.filter((app: any) => app.status === 'converted')
                .reduce((sum: number, app: any) => sum + (app.loan_amount || 0), 0) || 0,
        }

        return NextResponse.json({
            userId: user.id,
            userName: profile.full_name,
            selectedMonth: monthParam,
            currentMonth,
            previousMonth,
            trends,
            lastMonth,
            dailyTrends,
            benchmark,
            leaderboard,
            currentUserRank: currentUserRank || leaderboard.length + 1,
        })
    } catch (error: unknown) {
        apiLogger.error('Error in BDE historical performance API', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// Helper function to calculate trend percentage
function calculateTrend(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'neutral' } {
    if (previous === 0) {
        return {
            value: current > 0 ? 100 : 0,
            direction: current > 0 ? 'up' : 'neutral',
        }
    }

    const percentChange = ((current - previous) / previous) * 100

    return {
        value: Math.abs(Math.round(percentChange)),
        direction: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'neutral',
    }
}

// Helper function to get daily trends
async function getDailyTrends(
    supabase: any,
    userId: string,
    startDate: Date,
    endDate: Date
) {
    const { data: apps } = await supabase
        .from('crm_leads')
        .select('created_at, status')
        .eq('cro_id', userId)
        .is('deleted_at', null)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })

    if (!apps || apps.length === 0) {
        return []
    }

    // Group by date
    const trendsByDate: Record<string, any> = {}

    apps.forEach((app: any) => {
        const date = new Date(app.created_at).toISOString().split('T')[0]
        if (!trendsByDate[date]) {
            trendsByDate[date] = {
                date,
                filesProcessed: 0,
                sanctioned: 0,
                disbursed: 0,
                dropped: 0,
            }
        }

        trendsByDate[date].filesProcessed++
        if (app.status === 'qualified') trendsByDate[date].sanctioned++
        if (app.status === 'converted') trendsByDate[date].disbursed++
        if (app.status === 'dropped') trendsByDate[date].dropped++
    })

    return Object.values(trendsByDate)
}

// Helper function to get organization benchmark
async function getOrganizationBenchmark(
    supabase: any,
    startDate: Date,
    endDate: Date
) {
    const { data: bdes } = await supabase
        .from('users')
        .select('id')
        .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')

    if (!bdes || bdes.length === 0) {
        return {
            avgCasesByBDEs: 0,
            totalCasesInOrg: 0,
        }
    }

    const bdeIds = bdes.map((bde: any) => bde.id)

    const { data: allApps } = await supabase
        .from('crm_leads')
        .select('cro_id')
        .in('cro_id', bdeIds)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

    if (!allApps || allApps.length === 0) {
        return {
            avgCasesByBDEs: 0,
            totalCasesInOrg: 0,
        }
    }

    const casesByBDE: Record<string, number> = {}
    allApps.forEach((app: any) => {
        casesByBDE[app.cro_id] = (casesByBDE[app.cro_id] || 0) + 1
    })

    const caseCounts = Object.values(casesByBDE)
    const avgCases = caseCounts.reduce((sum, count) => sum + count, 0) / caseCounts.length

    return {
        avgCasesByBDEs: Math.round(avgCases * 10) / 10,
        totalCasesInOrg: allApps.length,
    }
}

// Helper function to get leaderboard
async function getLeaderboard(
    supabase: any,
    currentUserId: string,
    userLocation: string,
    startDate: Date,
    endDate: Date
) {
    const { data: bdes } = await supabase
        .from('users')
        .select('id, full_name, location')
        .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')

    if (!bdes || bdes.length === 0) {
        return []
    }

    const leaderboardData = await Promise.all(
        bdes.map(async (bde: any) => {
            const { data: apps } = await supabase
                .from('crm_leads')
                .select('status, loan_amount')
                .eq('cro_id', bde.id)
                .is('deleted_at', null)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())

            const totalApps = apps?.length || 0
            const disbursed = apps?.filter((app: any) => app.status === 'converted').length || 0
            const volume = apps
                ?.filter((app: any) => app.status === 'converted')
                .reduce((sum: number, app: any) => sum + (app.loan_amount || 0), 0) || 0

            const conversionRate = totalApps > 0 ? (disbursed / totalApps) * 100 : 0

            return {
                userId: bde.id,
                name: bde.full_name,
                location: bde.location,
                disbursed,
                volume,
                conversionRate,
                isCurrentUser: bde.id === currentUserId,
            }
        })
    )

    leaderboardData.sort((a, b) => {
        if (b.disbursed !== a.disbursed) {
            return b.disbursed - a.disbursed
        }
        return b.volume - a.volume
    })

    return leaderboardData.map((entry, index) => ({
        ...entry,
        rank: index + 1,
    }))
}
