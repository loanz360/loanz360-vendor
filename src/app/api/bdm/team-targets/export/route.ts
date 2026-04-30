/**
 * BDM Team Targets - Export Data API
 * Exports team performance data in various formats (CSV, Excel-like JSON)
 * BDM access only
 *
 * Rate Limit: 30 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function POST(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await exportDataHandler(req)
  })
}

async function exportDataHandler(request: NextRequest) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Verify BDM role
    if (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: BDM access required',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    // =====================================================
    // 2. PARSE REQUEST BODY
    // =====================================================

    const body = await request.json()
    const { month, year, format = 'csv', includeDaily = false, includeBadges = false } = body

    // Validate required fields
    if (!month || !year) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: month, year',
        },
        { status: 400 }
      )
    }

    // =====================================================
    // 3. FETCH OVERVIEW DATA
    // =====================================================

    const { data: overview, error: overviewError } = await supabase
      .rpc('get_bdm_monthly_overview', {
        p_bdm_user_id: bdmUserId,
        p_month: month,
        p_year: year,
      })
      .maybeSingle()

    if (overviewError || !overview) {
      apiLogger.error('Error fetching overview', overviewError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch data',
        },
        { status: 500 }
      )
    }

    // =====================================================
    // 4. FORMAT DATA FOR EXPORT
    // =====================================================

    const exportData: any[] = []

    // Header row (for CSV)
    const headers = [
      'BDE Name',
      'Employee Code',
      'Status',
      'Leads Contacted',
      'Target Leads',
      'Leads Achievement %',
      'Conversions',
      'Target Conversions',
      'Conversions Achievement %',
      'Revenue (₹)',
      'Target Revenue (₹)',
      'Revenue Achievement %',
      'Conversion Rate %',
      'Active Days',
      'Activity Rate %',
      'Current Streak',
      'Grade',
    ]

    if (includeBadges) {
      headers.push('Badges Earned', 'Badge Points')
    }

    // Add header row
    exportData.push(headers)

    // Add BDE performance rows
    overview.bde_performance?.forEach((bde: any) => {
      const row = [
        bde.bde_name,
        bde.employee_code,
        bde.status,
        bde.leads_contacted || 0,
        bde.target_leads || 0,
        bde.achievement_leads?.toFixed(1) || '0.0',
        bde.conversions || 0,
        bde.target_conversions || 0,
        bde.achievement_conversions?.toFixed(1) || '0.0',
        bde.revenue || 0,
        bde.target_revenue || 0,
        bde.achievement_revenue?.toFixed(1) || '0.0',
        bde.conversion_rate?.toFixed(2) || '0.00',
        bde.active_days || 0,
        bde.activity_rate?.toFixed(1) || '0.0',
        bde.current_streak || 0,
        bde.grade || 'N/A',
      ]

      if (includeBadges) {
        row.push(bde.badges_earned || 0, bde.badge_points || 0)
      }

      exportData.push(row)
    })

    // =====================================================
    // 5. ADD SUMMARY ROW
    // =====================================================

    const summaryRow = [
      'TEAM TOTAL',
      '',
      '',
      overview.total_leads_contacted || 0,
      overview.target_leads || 0,
      overview.achievement_leads?.toFixed(1) || '0.0',
      overview.total_conversions || 0,
      overview.target_conversions || 0,
      overview.achievement_conversions?.toFixed(1) || '0.0',
      overview.total_revenue || 0,
      overview.target_revenue || 0,
      overview.achievement_revenue?.toFixed(1) || '0.0',
      overview.team_conversion_rate?.toFixed(2) || '0.00',
      '',
      '',
      '',
      '',
    ]

    if (includeBadges) {
      summaryRow.push('', '')
    }

    exportData.push(summaryRow)

    // =====================================================
    // 6. FETCH DAILY DATA IF REQUESTED
    // =====================================================

    let dailyData: any[] = []
    if (includeDaily) {
      const dailyHeaders = ['Date', 'BDE Name', 'Leads', 'Conversions', 'Revenue (₹)', 'Conversion Rate %']
      dailyData.push(dailyHeaders)

      for (const bde of overview.bde_performance || []) {
        const { data: daily } = await supabase
          .from('daily_bde_activity')
          .select('activity_date, leads_contacted, conversions, revenue, conversion_rate')
          .eq('user_id', bde.bde_id)
          .eq('activity_month', month)
          .eq('activity_year', year)
          .order('activity_date', { ascending: true })

        daily?.forEach((day) => {
          dailyData.push([
            day.activity_date,
            bde.bde_name,
            day.leads_contacted || 0,
            day.conversions || 0,
            day.revenue || 0,
            day.conversion_rate?.toFixed(2) || '0.00',
          ])
        })
      }
    }

    // =====================================================
    // 7. FETCH BADGES DATA IF REQUESTED
    // =====================================================

    let badgesData: any[] = []
    if (includeBadges) {
      const badgesHeaders = ['BDE Name', 'Badge Name', 'Category', 'Rarity', 'Points', 'Earned Date']
      badgesData.push(badgesHeaders)

      const teamBDEs = overview.bde_performance?.map((bde: any) => bde.bde_id) || []

      if (teamBDEs.length > 0) {
        const { data: badges } = await supabase
          .from('bde_earned_badges')
          .select(
            `
            earned_at,
            users!bde_earned_badges_user_id_fkey(name),
            achievement_badges(badge_name, category, rarity, points)
          `
          )
          .in('user_id', teamBDEs)
          .eq('earned_for_month', month)
          .eq('earned_for_year', year)
          .order('earned_at', { ascending: false })

        badges?.forEach((badge: any) => {
          const user = badge.users as any
          const badgeInfo = badge.achievement_badges as any

          badgesData.push([
            user?.name || 'Unknown',
            badgeInfo?.badge_name || 'Unknown',
            badgeInfo?.category || '',
            badgeInfo?.rarity || '',
            badgeInfo?.points || 0,
            new Date(badge.earned_at).toLocaleDateString(),
          ])
        })
      }
    }

    // =====================================================
    // 8. FORMAT RESPONSE BASED ON FORMAT
    // =====================================================

    if (format === 'csv') {
      // Convert to CSV format
      const csvRows: string[] = []

      // Add metadata
      csvRows.push(`BDM Team Performance Report - ${month}/${year}`)
      csvRows.push(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`)
      csvRows.push('')

      // Add main data
      csvRows.push('MONTHLY OVERVIEW')
      exportData.forEach((row) => {
        csvRows.push(row.map((cell: any) => `"${cell}"`).join(','))
      })

      // Add daily data if included
      if (includeDaily && dailyData.length > 0) {
        csvRows.push('')
        csvRows.push('DAILY ACTIVITY')
        dailyData.forEach((row) => {
          csvRows.push(row.map((cell: any) => `"${cell}"`).join(','))
        })
      }

      // Add badges data if included
      if (includeBadges && badgesData.length > 0) {
        csvRows.push('')
        csvRows.push('BADGES EARNED')
        badgesData.forEach((row) => {
          csvRows.push(row.map((cell: any) => `"${cell}"`).join(','))
        })
      }

      const csvContent = csvRows.join('\n')

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="team_performance_${month}_${year}.csv"`,
        },
      })
    } else {
      // Return JSON format for Excel processing on client side
      return NextResponse.json({
        success: true,
        data: {
          metadata: {
            month,
            year,
            generatedAt: new Date().toISOString(),
            bdmName: auth.user?.name || 'Unknown',
          },
          overview: exportData,
          daily: includeDaily ? dailyData : null,
          badges: includeBadges ? badgesData : null,
        },
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    apiLogger.error('Error in exportDataHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
