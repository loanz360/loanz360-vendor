
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get real-time activity feed
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const since = searchParams.get('since') // ISO timestamp for incremental updates

    const activities: any[] = []

    // Build time filter
    const timeFilter = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Get recent calls
    const { data: recentCalls } = await supabase
      .from('ts_calls')
      .select('id, title, status, outcome, contact_name, scheduled_date, scheduled_time, updated_at')
      .eq('sales_executive_id', user.id)
      .gte('updated_at', timeFilter)
      .order('updated_at', { ascending: false })
      .limit(limit)

    recentCalls?.forEach(call => {
      activities.push({
        id: `call_${call.id}`,
        type: 'CALL',
        action: call.status === 'COMPLETED' ? 'completed' : call.status === 'SCHEDULED' ? 'scheduled' : 'updated',
        title: call.title,
        subtitle: call.contact_name || '',
        status: call.status,
        outcome: call.outcome,
        timestamp: call.updated_at,
        metadata: {
          scheduled_date: call.scheduled_date,
          scheduled_time: call.scheduled_time
        }
      })
    })

    // Get recent tasks
    const { data: recentTasks } = await supabase
      .from('ts_tasks')
      .select('id, title, status, priority, updated_at')
      .eq('sales_executive_id', user.id)
      .gte('updated_at', timeFilter)
      .order('updated_at', { ascending: false })
      .limit(limit)

    recentTasks?.forEach(task => {
      activities.push({
        id: `task_${task.id}`,
        type: 'TASK',
        action: task.status === 'COMPLETED' ? 'completed' : task.status === 'IN_PROGRESS' ? 'started' : 'updated',
        title: task.title,
        subtitle: `Priority: ${task.priority}`,
        status: task.status,
        timestamp: task.updated_at,
        metadata: {
          priority: task.priority
        }
      })
    })

    // Get recent point transactions
    const { data: recentPoints } = await supabase
      .from('ts_points_transactions')
      .select('id, points, category, description, created_at')
      .eq('sales_executive_id', user.id)
      .gte('created_at', timeFilter)
      .order('created_at', { ascending: false })
      .limit(limit)

    recentPoints?.forEach(tx => {
      activities.push({
        id: `points_${tx.id}`,
        type: 'POINTS',
        action: tx.points > 0 ? 'earned' : 'spent',
        title: `${tx.points > 0 ? '+' : ''}${tx.points} Points`,
        subtitle: tx.description || tx.category,
        timestamp: tx.created_at,
        metadata: {
          points: tx.points,
          category: tx.category
        }
      })
    })

    // Get recent badges
    const { data: recentBadges } = await supabase
      .from('ts_user_badges')
      .select(`
        id,
        earned_at,
        badge:ts_badges(name, icon, tier, rarity)
      `)
      .eq('sales_executive_id', user.id)
      .gte('earned_at', timeFilter)
      .order('earned_at', { ascending: false })
      .limit(5)

    recentBadges?.forEach((ub: any) => {
      activities.push({
        id: `badge_${ub.id}`,
        type: 'BADGE',
        action: 'unlocked',
        title: `Badge Unlocked: ${ub.badge?.name}`,
        subtitle: `${ub.badge?.tier} tier - ${ub.badge?.rarity}`,
        timestamp: ub.earned_at,
        metadata: {
          badge_name: ub.badge?.name,
          badge_icon: ub.badge?.icon,
          tier: ub.badge?.tier
        }
      })
    })

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Limit to requested amount
    const limitedActivities = activities.slice(0, limit)

    return NextResponse.json({
      success: true,
      data: {
        activities: limitedActivities,
        count: limitedActivities.length,
        latest_timestamp: limitedActivities[0]?.timestamp || timeFilter
      }
    })
  } catch (error) {
    apiLogger.error('Activity feed error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity feed' },
      { status: 500 }
    )
  }
}
