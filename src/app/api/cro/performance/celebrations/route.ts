
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCROAuth } from '@/lib/middleware/cro-auth'
import { apiLogger } from '@/lib/utils/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Celebration {
  id: string
  type: 'top_performer' | 'target_achieved' | 'record_broken' | 'badge_earned' | 'streak'
  title: string
  description: string
  employee_name: string
  icon: string
  highlight_color: string
  created_at: string
  metric_value?: string
}

// ---------------------------------------------------------------------------
// GET - Fetch team celebrations
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'this_month'

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Determine date range based on filter
    let startDate: string
    const endDate = now.toISOString()

    switch (filter) {
      case 'today': {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        break
      }
      case 'this_week': {
        const dayOfWeek = now.getDay()
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        weekStart.setHours(0, 0, 0, 0)
        startDate = weekStart.toISOString()
        break
      }
      case 'this_month':
      default: {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        break
      }
    }

    const celebrations: Celebration[] = []
    let celebrationIndex = 0

    // -----------------------------------------------------------------------
    // 1. Try fetching from cro_team_celebrations table first
    // -----------------------------------------------------------------------

    try {
      const { data: tableCelebrations, error } = await supabase
        .from('cro_team_celebrations')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && tableCelebrations && tableCelebrations.length > 0) {
        for (const c of tableCelebrations) {
          celebrations.push({
            id: c.id || `table-${celebrationIndex++}`,
            type: c.type || 'target_achieved',
            title: c.title || 'Achievement',
            description: c.description || '',
            employee_name: c.employee_name || 'Team Member',
            icon: c.icon || '🏆',
            highlight_color: c.highlight_color || 'orange',
            created_at: c.created_at,
            metric_value: c.metric_value || undefined,
          })
        }
      }
    } catch {
      // Table doesn't exist - generate from performance data below
    }

    // -----------------------------------------------------------------------
    // 2. Dynamically generate celebrations from cro_monthly_summary
    // -----------------------------------------------------------------------

    if (celebrations.length === 0) {
      try {
        // Get all CRO summaries for current month to find top performers
        const { data: monthlySummaries } = await supabase
          .from('cro_monthly_summary')
          .select(`
            cro_id,
            month,
            performance_score,
            total_calls,
            total_leads_converted,
            total_cases_disbursed,
            total_revenue,
            company_rank
          `)
          .eq('month', currentMonth)
          .order('performance_score', { ascending: false })
          .limit(20)

        if (monthlySummaries && monthlySummaries.length > 0) {
          // Fetch employee names for all CRO IDs
          const croIds = monthlySummaries.map(s => s.cro_id)
          let nameMap: Record<string, string> = {}

          try {
            const { data: employees } = await supabase
              .from('employees')
              .select('id, display_name, first_name, last_name')
              .in('id', croIds)

            if (employees) {
              for (const emp of employees) {
                nameMap[emp.id] = emp.display_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Team Member'
              }
            }
          } catch {
            // Fallback: use "CRO" prefix
          }

          // --- Top 3 performers ---
          const rankLabels = ['1st', '2nd', '3rd']
          const rankIcons = ['🥇', '🥈', '🥉']
          const rankColors = ['yellow', 'gray', 'amber']

          for (let i = 0; i < Math.min(3, monthlySummaries.length); i++) {
            const summary = monthlySummaries[i]
            if ((summary.performance_score || 0) > 0) {
              celebrations.push({
                id: `top-performer-${i}-${celebrationIndex++}`,
                type: 'top_performer',
                title: `${rankLabels[i]} Place This Month`,
                description: `${nameMap[summary.cro_id] || 'Team Member'} is ranked ${rankLabels[i]} with a score of ${(summary.performance_score || 0).toFixed(1)}`,
                employee_name: nameMap[summary.cro_id] || 'Team Member',
                icon: rankIcons[i],
                highlight_color: rankColors[i],
                created_at: now.toISOString(),
                metric_value: `Score: ${(summary.performance_score || 0).toFixed(1)}`,
              })
            }
          }

          // --- Record-breaking metrics ---
          for (const summary of monthlySummaries.slice(0, 5)) {
            const name = nameMap[summary.cro_id] || 'Team Member'

            // High revenue achievers
            if ((summary.total_revenue || 0) >= 500000) {
              celebrations.push({
                id: `revenue-${summary.cro_id}-${celebrationIndex++}`,
                type: 'record_broken',
                title: 'Revenue Milestone',
                description: `${name} crossed ${formatCompactINR(summary.total_revenue)} in revenue this month!`,
                employee_name: name,
                icon: '💰',
                highlight_color: 'green',
                created_at: now.toISOString(),
                metric_value: formatCompactINR(summary.total_revenue),
              })
            }

            // High disbursement achievers
            if ((summary.total_cases_disbursed || 0) >= 10) {
              celebrations.push({
                id: `disbursed-${summary.cro_id}-${celebrationIndex++}`,
                type: 'target_achieved',
                title: 'Disbursement Champion',
                description: `${name} disbursed ${summary.total_cases_disbursed} cases this month!`,
                employee_name: name,
                icon: '🎯',
                highlight_color: 'blue',
                created_at: now.toISOString(),
                metric_value: `${summary.total_cases_disbursed} cases`,
              })
            }

            // High conversion achievers
            const totalLeads = summary.total_leads_converted || 0
            if (totalLeads >= 20) {
              celebrations.push({
                id: `conversion-${summary.cro_id}-${celebrationIndex++}`,
                type: 'target_achieved',
                title: 'Conversion Star',
                description: `${name} converted ${totalLeads} leads this month!`,
                employee_name: name,
                icon: '⭐',
                highlight_color: 'purple',
                created_at: now.toISOString(),
                metric_value: `${totalLeads} conversions`,
              })
            }
          }

          // --- Check for earned badges ---
          try {
            const { data: recentBadges } = await supabase
              .from('cro_achievement_badges')
              .select('cro_id, badge_id, earned_at')
              .gte('earned_at', startDate)
              .order('earned_at', { ascending: false })
              .limit(5)

            if (recentBadges && recentBadges.length > 0) {
              for (const badge of recentBadges) {
                const name = nameMap[badge.cro_id] || 'Team Member'
                const badgeName = badge.badge_id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

                celebrations.push({
                  id: `badge-${badge.cro_id}-${badge.badge_id}-${celebrationIndex++}`,
                  type: 'badge_earned',
                  title: 'New Badge Earned!',
                  description: `${name} earned the "${badgeName}" badge!`,
                  employee_name: name,
                  icon: '🏅',
                  highlight_color: 'orange',
                  created_at: badge.earned_at,
                  metric_value: badgeName,
                })
              }
            }
          } catch {
            // cro_achievement_badges may not exist
          }

          // --- Streak celebrations ---
          try {
            const startOfMonthDate = new Date(now.getFullYear(), now.getMonth(), 1)
              .toISOString()
              .split('T')[0]
            const todayDate = now.toISOString().split('T')[0]

            for (const summary of monthlySummaries.slice(0, 5)) {
              const { data: dailyData } = await supabase
                .from('cro_daily_metrics')
                .select('date, calls_made, leads_generated')
                .eq('cro_id', summary.cro_id)
                .gte('date', startOfMonthDate)
                .lte('date', todayDate)
                .order('date', { ascending: true })

              if (dailyData && dailyData.length >= 5) {
                // Check for 5+ day streak of making calls
                let streak = 0
                let maxStreak = 0
                for (const day of dailyData) {
                  if ((day.calls_made || 0) > 0) {
                    streak++
                    maxStreak = Math.max(maxStreak, streak)
                  } else {
                    streak = 0
                  }
                }

                if (maxStreak >= 10) {
                  const name = nameMap[summary.cro_id] || 'Team Member'
                  celebrations.push({
                    id: `streak-${summary.cro_id}-${celebrationIndex++}`,
                    type: 'streak',
                    title: `${maxStreak}-Day Active Streak!`,
                    description: `${name} has been consistently active for ${maxStreak} days straight!`,
                    employee_name: name,
                    icon: '🔥',
                    highlight_color: 'red',
                    created_at: now.toISOString(),
                    metric_value: `${maxStreak} days`,
                  })
                }
              }
            }
          } catch {
            // Streak calculation failed - skip
          }
        }
      } catch {
        // cro_monthly_summary may not exist
      }
    }

    // Sort by created_at descending and limit to 10
    celebrations.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const limitedCelebrations = celebrations.slice(0, 10)

    return NextResponse.json({
      success: true,
      data: {
        celebrations: limitedCelebrations,
        total: limitedCelebrations.length,
        filter,
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching celebrations', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch celebrations' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Helper: format compact INR
// ---------------------------------------------------------------------------

function formatCompactINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount.toLocaleString('en-IN')}`
}
