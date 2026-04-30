import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


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

        // Handle profile not found error properly
        if (profileError || !profile) {
            apiLogger.error('User profile not found', {
                userId: user.id,
                error: profileError?.message,
            })
            return NextResponse.json(
                {
                    error: 'User profile not found. Please contact administrator.',
                    details: 'Your user profile needs to be set up before accessing performance data.',
                },
                { status: 404 }
            )
        }

        // Verify user is a BDE
        if (profile.sub_role !== 'BUSINESS_DEVELOPMENT_EXECUTIVE') {
            return NextResponse.json(
                { error: 'Access denied. This endpoint is for BDEs only.' },
                { status: 403 }
            )
        }

        // Get current month start and end dates
        const now = new Date()
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

        // Fetch current month performance metrics from crm_leads table
        const { data: currentMonthApps, error: appsError } = await supabase
            .from('crm_leads')
            .select('id, status, loan_amount, created_at')
            .eq('cro_id', user.id)
            .is('deleted_at', null)
            .gte('created_at', currentMonthStart.toISOString())
            .lte('created_at', currentMonthEnd.toISOString())

        if (appsError) {
            apiLogger.error('Error fetching applications', appsError)
            return NextResponse.json({ success: false, error: 'Failed to fetch applications' }, { status: 500 })
        }

        // Calculate current month metrics using crm_leads schema
        // Status mapping: 'active'/'follow_up' = login completed,
        // 'converted' = disbursed, 'dropped' = dropped/rejected
        const currentMonth = {
            totalAssigned: currentMonthApps?.length || 0,
            loginCompleted: currentMonthApps?.filter((app: any) =>
                app.status === 'active' || app.status === 'follow_up'
            ).length || 0,
            sanctioned: 0, // No direct equivalent in new schema
            dropped: currentMonthApps?.filter((app: any) =>
                app.status === 'dropped'
            ).length || 0,
            disbursed: currentMonthApps?.filter((app: any) =>
                app.status === 'converted'
            ).length || 0,
            rejected: 0, // Included in 'dropped' count above
        }

        // Fetch last month data
        const { data: lastMonthApps } = await supabase
            .from('crm_leads')
            .select('id, status, loan_amount')
            .eq('cro_id', user.id)
            .is('deleted_at', null)
            .gte('created_at', lastMonthStart.toISOString())
            .lte('created_at', lastMonthEnd.toISOString())

        const lastMonth = {
            filesDisbursed: lastMonthApps?.filter((app: any) => app.status === 'converted').length || 0,
            volumeDisbursed: lastMonthApps
                ?.filter((app: any) => app.status === 'converted')
                .reduce((sum: number, app: any) => sum + (app.loan_amount || 0), 0) || 0,
        }

        // Get daily trends for current month
        const dailyTrends = await getDailyTrends(supabase, user.id, currentMonthStart, currentMonthEnd)

        // Get organization benchmark
        const benchmark = await getOrganizationBenchmark(supabase, currentMonthStart, currentMonthEnd)

        // Get leaderboard
        const leaderboard = await getLeaderboard(supabase, user.id, profile.location, currentMonthStart, currentMonthEnd)

        // Find current user rank
        const currentUserRank = leaderboard.findIndex((entry: any) => entry.userId === user.id) + 1

        return NextResponse.json({
            userId: user.id,
            userName: profile.full_name,
            currentMonth,
            lastMonth,
            dailyTrends,
            benchmark,
            leaderboard,
            currentUserRank: currentUserRank || leaderboard.length + 1,
        })
    } catch (error: unknown) {
        apiLogger.error('Error in BDE performance API', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
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
    // Get all BDEs
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

    // Get all applications for BDEs in current month
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

    // Count cases per BDE
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
    // Get all BDEs (optionally filter by location)
    const { data: bdes } = await supabase
        .from('users')
        .select('id, full_name, location')
        .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
    // Uncomment to filter by location:
    // .eq('location', userLocation)

    if (!bdes || bdes.length === 0) {
        return []
    }

    // Get performance data for each BDE
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

    // Sort by disbursed count (descending), then by volume
    leaderboardData.sort((a, b) => {
        if (b.disbursed !== a.disbursed) {
            return b.disbursed - a.disbursed
        }
        return b.volume - a.volume
    })

    // Add rank
    return leaderboardData.map((entry, index) => ({
        ...entry,
        rank: index + 1,
    }))
}
